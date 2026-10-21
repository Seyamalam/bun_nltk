import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { artifactPath, assertCommittedSources, hostStatus, inspectNativeArtifact, sha256, sourceSnapshot, validateNativeSignature } from "../scripts/native-provenance";
import type { NativeProvenance } from "../scripts/native-provenance";
import { assertStagingDirectory } from "../scripts/refresh-native-host";

const root = resolve(import.meta.dir, "..");
const tempRoot = existsSync("/tmp/opencode") ? "/tmp/opencode" : tmpdir();

function git(cwd: string, args: string[]): void {
  const proc = Bun.spawnSync(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
}

function elf(): Uint8Array {
  const bytes = new Uint8Array(64);
  bytes.set([0x7f, 0x45, 0x4c, 0x46, 2, 1]);
  const view = new DataView(bytes.buffer);
  view.setUint16(16, 3, true);
  view.setUint16(18, 0x3e, true);
  return bytes;
}

function fixture(run: (dir: string, path: string) => void): void {
  const dir = mkdtempSync(join(tempRoot, "bun-nltk-native-provenance-test-"));
  try {
    mkdirSync(join(dir, "rust/src"), { recursive: true });
    writeFileSync(join(dir, "rust/Cargo.toml"), "[package]\nname = 'fixture'\n");
    writeFileSync(join(dir, "rust/Cargo.lock"), "version = 4\n");
    writeFileSync(join(dir, "rust/src/lib.rs"), "pub fn identity() {}\n");
    const path = artifactPath(dir, "linux-x64");
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, elf());
    git(dir, ["init", "-q"]);
    git(dir, ["add", "."]);
    git(dir, ["-c", "user.name=Native Test", "-c", "user.email=native-test@example.invalid", "commit", "-qm", "fixture"]);
    run(dir, path);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function provenance(dir: string, path: string): NativeProvenance {
  const binary = readFileSync(path);
  const smoke = `${JSON.stringify({ ok: true, target: "linux-x64", artifact_sha256: sha256(binary), host: { platform: "linux", architecture: "x64" } })}\n`;
  writeFileSync(join(path, "..", "smoke.json"), smoke);
  const value: NativeProvenance = {
    schema_version: 1, target: "linux-x64", generated_at: "2026-10-21T00:00:00Z",
    source: sourceSnapshot(dir), artifact: { sha256: sha256(binary), bytes: binary.length },
    host: { platform: "linux", architecture: "x64", os_release: "fixture", rustc_host: "x86_64-unknown-linux-gnu" },
    build: { command: ["cargo", "build", "--locked", "--release", "--target", "x86_64-unknown-linux-gnu"], rustc: "fixture", cargo: "fixture", flags: {} },
    validation: { status: "passed", kind: "source-native-smoke", report_sha256: sha256(smoke) },
  };
  writeFileSync(`${path}.provenance.json`, JSON.stringify(value));
  return value;
}

test("host gates distinguish genuine native compiler hosts from foreign/cross targets", () => {
  expect(hostStatus("linux-x64", "linux", "x64", "x86_64-unknown-linux-gnu").status).toBe("available");
  expect(hostStatus("darwin-arm64", "darwin", "arm64", "aarch64-apple-darwin").status).toBe("available");
  for (const abi of ["msvc", "gnu"]) expect(hostStatus("win32-x64", "win32", "x64", `x86_64-pc-windows-${abi}`).status).toBe("available");
  expect(hostStatus("linux-x64", "darwin", "arm64", "x86_64-unknown-linux-gnu").status).toBe("blocked");
  expect(hostStatus("linux-x64", "linux", "x64", "x86_64-pc-windows-gnu").status).toBe("blocked");
  expect(hostStatus("linux-x64", "linux", "x64", "x86_64-unknown-linux-musl").status).toBe("blocked");
});

test("historical bytes without source provenance are unverified, then stale when native inputs change", () => fixture((dir, path) => {
  const original = inspectNativeArtifact(dir, "linux-x64");
  expect(original.status).toBe("unverified");
  expect(original.source_revision).toBeNull();
  writeFileSync(join(dir, "rust/src/lib.rs"), "pub fn changed() {}\n");
  const result = inspectNativeArtifact(dir, "linux-x64");
  expect(result.status).toBe("stale");
  expect("changed_inputs" in result && result.changed_inputs).toEqual(["rust/src/lib.rs"]);
  expect("sha256" in result && result.sha256).toBe(sha256(readFileSync(path)));
}));

test("source fingerprint survives non-native commits but detects dirty native bytes", () => fixture((dir, path) => {
  const metadata = provenance(dir, path);
  expect(inspectNativeArtifact(dir, "linux-x64").status).toBe("fresh");
  writeFileSync(join(dir, "notes.txt"), "not compiled\n");
  git(dir, ["add", "notes.txt"]);
  git(dir, ["-c", "user.name=Native Test", "-c", "user.email=native-test@example.invalid", "commit", "-qm", "notes"]);
  const fresh = inspectNativeArtifact(dir, "linux-x64");
  expect(fresh.status).toBe("fresh");
  expect(fresh.source_revision).toBe(metadata.source.revision);
  expect(sourceSnapshot(dir).revision).not.toBe(metadata.source.revision);
  writeFileSync(join(dir, "rust/src/lib.rs"), "pub fn dirty() {}\n");
  expect(inspectNativeArtifact(dir, "linux-x64").status).toBe("stale");
  expect(() => assertCommittedSources(dir, sourceSnapshot(dir))).toThrow("Commit native build input");
}));

test("freshness binds artifact, source manifest and genuine-host evidence bytes", () => fixture((dir, path) => {
  const metadata = provenance(dir, path);
  writeFileSync(join(path, "..", "smoke.json"), "{}\n");
  expect(inspectNativeArtifact(dir, "linux-x64").status).toBe("unverified");
  provenance(dir, path);
  metadata.host.platform = "darwin";
  writeFileSync(`${path}.provenance.json`, JSON.stringify(metadata));
  expect(inspectNativeArtifact(dir, "linux-x64").status).toBe("unverified");
  const cross = provenance(dir, path);
  cross.build.command[1] = "zigbuild";
  writeFileSync(`${path}.provenance.json`, JSON.stringify(cross));
  expect(inspectNativeArtifact(dir, "linux-x64").status).toBe("unverified");
  provenance(dir, path);
  writeFileSync(path, new Uint8Array([...elf(), 1]));
  expect(inspectNativeArtifact(dir, "linux-x64").status).toBe("invalid");
  writeFileSync(`${path}.provenance.json`, "{broken");
  expect(inspectNativeArtifact(dir, "linux-x64").status).toBe("invalid");
}));

test("freshness rejects a fabricated source revision rather than relabeling current HEAD", () => fixture((dir, path) => {
  const metadata = provenance(dir, path);
  metadata.source.revision = "a".repeat(40);
  writeFileSync(`${path}.provenance.json`, JSON.stringify(metadata));
  expect(inspectNativeArtifact(dir, "linux-x64").status).toBe("invalid");
}));

test("freshness reports missing and invalid artifacts without loading them", () => fixture((dir, path) => {
  expect(inspectNativeArtifact(dir, "win32-x64").status).toBe("missing");
  writeFileSync(path, "not native");
  expect(inspectNativeArtifact(dir, "linux-x64").status).toBe("invalid");
  expect(() => validateNativeSignature(new Uint8Array(0), "win32-x64")).toThrow();
  const wrongArch = elf();
  wrongArch[18] = 0xb7;
  expect(() => validateNativeSignature(wrongArch, "linux-x64")).toThrow();
}));

test("signature checks recognize macOS ARM64 and Windows x64 without claiming execution", () => {
  const mac = new Uint8Array(32);
  mac.set([0xcf, 0xfa, 0xed, 0xfe]);
  const macView = new DataView(mac.buffer);
  macView.setUint32(4, 0x0100000c, true);
  macView.setUint32(12, 6, true);
  expect(() => validateNativeSignature(mac, "darwin-arm64")).not.toThrow();
  macView.setUint32(4, 0x01000007, true);
  expect(() => validateNativeSignature(mac, "darwin-arm64")).toThrow();
  const win = new Uint8Array(128);
  win.set([0x4d, 0x5a]);
  const winView = new DataView(win.buffer);
  winView.setUint32(0x3c, 64, true);
  win.set([0x50, 0x45, 0, 0], 64);
  winView.setUint16(68, 0x8664, true);
  winView.setUint16(86, 0x2000, true);
  winView.setUint16(88, 0x20b, true);
  expect(() => validateNativeSignature(win, "win32-x64")).not.toThrow();
  winView.setUint32(0x3c, 0xfffffff0, true);
  expect(() => validateNativeSignature(win, "win32-x64")).toThrow("signature");
});

test("untracked, deleted and symlinked Rust/config build inputs cannot receive clean revision provenance", () => fixture((dir) => {
  writeFileSync(join(dir, "rust/src/new.rs"), "pub fn untracked() {}\n");
  expect(() => assertCommittedSources(dir, sourceSnapshot(dir))).toThrow();
  rmSync(join(dir, "rust/src/new.rs"));
  rmSync(join(dir, "rust/src/lib.rs"));
  expect(() => assertCommittedSources(dir, sourceSnapshot(dir))).toThrow("deleted");
  if (process.platform !== "win32") {
    symlinkSync(join(dir, "rust/Cargo.toml"), join(dir, "rust/src/lib.rs"));
    expect(() => sourceSnapshot(dir)).toThrow("symlinks");
  }
}));

test("staging guard never permits native/prebuilt, including symlink redirects", () => fixture((dir) => {
  expect(() => assertStagingDirectory(dir, join(dir, "native/prebuilt/linux-x64"))).toThrow("never overwrites");
  expect(() => assertStagingDirectory(dir, join(dir, "artifacts/native-candidate"))).not.toThrow();
  expect(() => assertStagingDirectory(dir, join(tempRoot, "native-candidate-external"))).not.toThrow();
  if (process.platform !== "win32") {
    mkdirSync(join(dir, "artifacts"));
    symlinkSync(join(dir, "native"), join(dir, "artifacts/redirect"));
    expect(() => assertStagingDirectory(dir, join(dir, "artifacts/redirect/prebuilt"))).toThrow("never overwrites");
  }
}));

test("foreign-host status is blocked, not a smoke pass; report-only exits successfully", () => {
  const target = process.platform === "win32" ? "linux-x64" : "win32-x64";
  const status = Bun.spawnSync([process.execPath, "run", "scripts/verify-native-host.ts", "--target", target, "--status"], { cwd: root, stdout: "pipe", stderr: "pipe" });
  expect(status.exitCode).toBe(0);
  const report = JSON.parse(new TextDecoder().decode(status.stdout));
  expect(report.ok).toBe(false);
  expect(report.host_validation.status).toBe("blocked");
  const build = Bun.spawnSync([process.execPath, "run", "scripts/build-prebuilt.ts", "--target", target], { cwd: root, stdout: "pipe", stderr: "pipe" });
  expect(build.exitCode).toBe(1);
  expect(JSON.parse(new TextDecoder().decode(build.stdout)).status).toBe("blocked");
});

test("candidate override cannot masquerade as a full packaged-host validation", () => {
  const proc = Bun.spawnSync([process.execPath, "run", "scripts/verify-native-host.ts", "--library", "unused-candidate"], {
    cwd: root, env: { ...process.env, BUN_NLTK_NATIVE_LIB: "" }, stdout: "pipe", stderr: "pipe",
  });
  expect(proc.exitCode).toBe(1);
  expect(new TextDecoder().decode(proc.stderr)).toContain("Candidate overrides require --smoke");
});
