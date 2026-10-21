import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";

export const nativeTargets = ["darwin-arm64", "linux-x64", "win32-x64"] as const;
export type NativeTarget = (typeof nativeTargets)[number];
export type SourceSnapshot = { revision: string; sha256: string; files: Record<string, string> };
export type NativeProvenance = {
  schema_version: 1;
  target: NativeTarget;
  generated_at: string;
  source: SourceSnapshot;
  artifact: { sha256: string; bytes: number };
  build: { command: string[]; rustc: string; cargo: string; flags: Record<string, string> };
  host: { platform: string; architecture: string; os_release: string; rustc_host: string };
  validation: { status: "passed"; kind: "source-native-smoke"; report_sha256: string };
};

export function sha256(bytes: string | Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function git(root: string, args: string[]): string | undefined {
  const result = Bun.spawnSync(["git", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
  return result.exitCode === 0 ? new TextDecoder().decode(result.stdout).trim() : undefined;
}

export function sourcePaths(root: string): string[] {
  const paths: string[] = [];
  function walk(path: string): void {
    if (!existsSync(join(root, path))) return;
    if (lstatSync(join(root, path)).isSymbolicLink()) throw new Error(`Native build inputs must not be symlinks: ${path}`);
    for (const entry of readdirSync(join(root, path), { withFileTypes: true })) {
      const child = `${path}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error(`Native build inputs must not be symlinks: ${child}`);
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile()) paths.push(child);
    }
  }
  walk("rust/src");
  walk(".cargo");
  walk("rust/.cargo");
  for (const path of ["rust/Cargo.toml", "rust/Cargo.lock", "rust/build.rs", "rust/rust-toolchain", "rust/rust-toolchain.toml", "rust-toolchain", "rust-toolchain.toml"]) {
    if (existsSync(join(root, path))) {
      if (lstatSync(join(root, path)).isSymbolicLink()) throw new Error(`Native build inputs must not be symlinks: ${path}`);
      paths.push(path);
    }
  }
  return paths.sort();
}

export function sourceSnapshot(root: string): SourceSnapshot {
  const revision = git(root, ["rev-parse", "HEAD"]);
  if (!revision) throw new Error("Native provenance requires a Git checkout");
  const files = Object.fromEntries(sourcePaths(root).map((path) => [path, sha256(readFileSync(join(root, path)))]));
  return { revision, sha256: sha256(JSON.stringify(files)), files };
}

export function assertCommittedSources(root: string, source: SourceSnapshot): void {
  for (const [path, digest] of Object.entries(source.files)) {
    const proc = Bun.spawnSync(["git", "show", `${source.revision}:${path}`], { cwd: root, stdout: "pipe", stderr: "pipe" });
    if (proc.exitCode !== 0 || sha256(proc.stdout) !== digest) {
      throw new Error(`Commit native build input before refresh: ${path}`);
    }
  }
  const recorded = git(root, ["ls-tree", "-r", "--name-only", source.revision, "rust/src", "rust/Cargo.toml", "rust/Cargo.lock", "rust/build.rs", ".cargo", "rust/.cargo", "rust/rust-toolchain", "rust/rust-toolchain.toml", "rust-toolchain", "rust-toolchain.toml"]);
  if (recorded?.split("\n").some((path) => path && !source.files[path])) {
    throw new Error("Commit deleted native build inputs before refresh");
  }
}

export function artifactPath(root: string, target: NativeTarget): string {
  const ext = target === "linux-x64" ? "so" : target === "darwin-arm64" ? "dylib" : "dll";
  return join(root, "native", "prebuilt", target, `bun_nltk.${ext}`);
}

export function hostStatus(target: NativeTarget, platform: string, architecture: string, rustcHost?: string) {
  const runtime = `${platform}-${architecture}`;
  const expected = target === "linux-x64" ? /^x86_64-unknown-linux-gnu$/
    : target === "darwin-arm64" ? /^aarch64-apple-darwin$/ : /^x86_64-pc-windows-(msvc|gnu)$/;
  if (runtime !== target) return { status: "blocked" as const, reason: `Requires genuine ${target}; current host is ${runtime}` };
  if (rustcHost !== undefined && !expected.test(rustcHost)) {
    return { status: "blocked" as const, reason: `Rust compiler host ${rustcHost} is not native for ${target}` };
  }
  return { status: "available" as const, reason: "Current runtime matches; refresh additionally checks the Rust compiler host" };
}

export function validateNativeSignature(bytes: Uint8Array, target: NativeTarget): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const has = (at: number, expected: number[]) => expected.every((value, i) => bytes[at + i] === value);
  let valid = false;
  if (target === "linux-x64") {
    valid = bytes.length >= 64 && has(0, [0x7f, 0x45, 0x4c, 0x46, 2, 1]) && view.getUint16(16, true) === 3 && view.getUint16(18, true) === 0x3e;
  } else if (target === "darwin-arm64") {
    valid = bytes.length >= 32 && has(0, [0xcf, 0xfa, 0xed, 0xfe]) && view.getUint32(4, true) === 0x0100000c && view.getUint32(12, true) === 6;
  } else if (bytes.length >= 64 && has(0, [0x4d, 0x5a])) {
    const pe = view.getUint32(0x3c, true);
    valid = pe + 26 <= bytes.length && has(pe, [0x50, 0x45, 0, 0]) && view.getUint16(pe + 4, true) === 0x8664 && (view.getUint16(pe + 22, true) & 0x2000) !== 0 && view.getUint16(pe + 24, true) === 0x20b;
  }
  if (!valid) throw new Error(`Invalid ${target} native shared-library signature`);
}

export function inspectNativeArtifact(root: string, target: NativeTarget, path = artifactPath(root, target), provenancePath = `${path}.provenance.json`) {
  const base = { target, path: relative(root, path), source_revision: null as string | null };
  if (!existsSync(path)) return { ...base, status: "missing" as const, reason: "Artifact is absent" };
  const bytes = readFileSync(path);
  const artifact = { ...base, bytes: bytes.length, sha256: sha256(bytes) };
  try { validateNativeSignature(bytes, target); } catch (error) {
    return { ...artifact, status: "invalid" as const, reason: String(error) };
  }
  const source = sourceSnapshot(root);
  if (!existsSync(provenancePath)) {
    const recordedRevision = git(root, ["log", "-1", "--format=%H", "--", relative(root, path)]);
    const changed = recordedRevision ? git(root, ["diff", "--name-only", recordedRevision, "--", "rust/src", "rust/Cargo.toml", "rust/Cargo.lock", "rust/build.rs", ".cargo", "rust/.cargo", "rust/rust-toolchain", "rust/rust-toolchain.toml", "rust-toolchain", "rust-toolchain.toml"]) : undefined;
    return {
      ...artifact, status: changed ? "stale" as const : "unverified" as const,
      reason: changed ? "Native inputs changed since the artifact was recorded; no build provenance exists" : "No build provenance; recording a binary in Git is not source-build or host-validation evidence",
      artifact_recorded_revision: recordedRevision ?? null,
      changed_inputs: changed ? changed.split("\n") : [],
    };
  }
  try {
    const provenance = JSON.parse(readFileSync(provenancePath, "utf8")) as NativeProvenance;
    if (provenance.schema_version !== 1 || provenance.target !== target || provenance.artifact.sha256 !== artifact.sha256 || provenance.artifact.bytes !== bytes.length || !/^[a-f0-9]{40}$/.test(provenance.source.revision) || sha256(JSON.stringify(provenance.source.files)) !== provenance.source.sha256) {
      throw new Error("Provenance does not match artifact bytes, target, or source manifest");
    }
    const identified = { ...artifact, source_revision: provenance.source.revision };
    if (provenance.source.sha256 !== source.sha256) return { ...identified, status: "stale" as const, reason: "Build input fingerprint differs from this checkout" };
    assertCommittedSources(root, provenance.source);
    const validationHost = hostStatus(target, provenance.host.platform, provenance.host.architecture, provenance.host.rustc_host);
    const buildTarget = provenance.build.command[provenance.build.command.indexOf("--target") + 1];
    if (!provenance.build.command.includes("build") || !provenance.build.command.includes("--locked") || !provenance.build.command.includes("--release") || buildTarget !== provenance.host.rustc_host || provenance.build.command.some((part) => part === "zigbuild" || part === "cross")) {
      return { ...identified, status: "unverified" as const, reason: "Build command is not a locked source build for the compiler's native host" };
    }
    const reportPath = join(dirname(provenancePath), "smoke.json");
    if (validationHost.status !== "available" || provenance.validation.status !== "passed" || provenance.validation.kind !== "source-native-smoke" || !existsSync(reportPath) || sha256(readFileSync(reportPath)) !== provenance.validation.report_sha256) {
      return { ...identified, status: "unverified" as const, reason: "Matching sources, but missing or mismatched genuine-host smoke evidence" };
    }
    const smoke = JSON.parse(readFileSync(reportPath, "utf8")) as { ok?: boolean; target?: string; artifact_sha256?: string; host?: { platform: string; architecture: string } };
    if (!smoke.ok || smoke.target !== target || smoke.artifact_sha256 !== artifact.sha256 || !smoke.host || hostStatus(target, smoke.host.platform, smoke.host.architecture).status !== "available") {
      throw new Error("Smoke report does not match artifact or host");
    }
    return { ...identified, status: "fresh" as const, reason: "Matching source fingerprint and byte-bound genuine-host source smoke evidence (not package or cross-platform validation)" };
  } catch (error) {
    return { ...artifact, status: "invalid" as const, reason: `Invalid provenance: ${String(error)}` };
  }
}
