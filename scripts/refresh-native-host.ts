import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { release } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { artifactPath, assertCommittedSources, hostStatus, nativeTargets, sha256, sourceSnapshot, validateNativeSignature } from "./native-provenance";
import type { NativeProvenance, NativeTarget } from "./native-provenance";

function run(root: string, command: string[]): string {
  const proc = Bun.spawnSync(command, { cwd: root, env: { ...process.env, CARGO_BUILD_JOBS: process.env.CARGO_BUILD_JOBS ?? "2" }, stdout: "pipe", stderr: "pipe" });
  if (proc.exitCode !== 0) throw new Error(`${command[0]} failed (${proc.exitCode})\n${new TextDecoder().decode(proc.stdout)}\n${new TextDecoder().decode(proc.stderr)}`);
  return new TextDecoder().decode(proc.stdout).trim();
}

// Resolve existing parents too, so a symlink cannot turn a staged output into
// an overwrite of a release artifact. Only artifacts/ or outside-repo staging
// is allowed; there is deliberately no publish/promote/force option.
export function assertStagingDirectory(root: string, output: string): void {
  function canonical(path: string): string {
    return existsSync(path) ? realpathSync(path) : join(canonical(dirname(path)), basename(path));
  }
  const relativePath = relative(realpathSync(root), canonical(resolve(output)));
  const outside = isAbsolute(relativePath) || relativePath === ".." || relativePath.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`);
  if (!outside && relativePath !== "artifacts" && !relativePath.startsWith(`artifacts${process.platform === "win32" ? "\\" : "/"}`)) {
    throw new Error("Native refresh may only stage outside the checkout or under artifacts/; it never overwrites packaged binaries");
  }
}

export async function refreshNativeHost(args = process.argv.slice(2)) {
  const root = resolve(import.meta.dir, "..");
  const options = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i]!;
    const value = args[i + 1];
    if (!["--target", "--output-dir", "--target-dir"].includes(name) || !value || value.startsWith("--") || options.has(name)) throw new Error("usage: refresh-native-host.ts --output-dir <new staging directory> [--target <host>] [--target-dir <Cargo directory>]");
    options.set(name, value);
  }
  const target = options.get("--target") ?? `${process.platform}-${process.arch}`;
  if (!nativeTargets.includes(target as NativeTarget)) throw new Error(`Unsupported native host: ${target}`);
  const nativeTarget = target as NativeTarget;
  const hostGate = hostStatus(nativeTarget, process.platform, process.arch);
  if (hostGate.status === "blocked") return { ok: false as const, status: "blocked", target, reason: hostGate.reason };
  const rustc = run(root, [process.env.RUSTC ?? "rustc", "-vV"]);
  const rustcHost = rustc.match(/^host: (.+)$/m)?.[1] ?? "unknown";
  const compilerGate = hostStatus(nativeTarget, process.platform, process.arch, rustcHost);
  if (compilerGate.status === "blocked") return { ok: false as const, status: "blocked", target, reason: compilerGate.reason };
  if (!options.has("--output-dir")) throw new Error("--output-dir is required; refresh stages candidates, never release binaries");
  const output = resolve(options.get("--output-dir")!);
  assertStagingDirectory(root, output);
  if (existsSync(output)) throw new Error(`Refusing to reuse an existing staging directory: ${output}`);
  const targetDirectory = resolve(options.get("--target-dir") ?? process.env.CARGO_TARGET_DIR ?? join(root, "rust", "target", "native-host"));
  const source = sourceSnapshot(root);
  assertCommittedSources(root, source);
  const cargo = process.env.BUN_NLTK_CARGO_BIN ?? "cargo";
  const command = [cargo, "build", "--locked", "--release", "--target", rustcHost, "--manifest-path", join(root, "rust", "Cargo.toml"), "--target-dir", targetDirectory];
  // Explicit --target equals rustc's native host, even if Cargo's environment
  // has a default cross target. cargo-zigbuild/cross are never invoked.
  const cargoVersion = run(root, [cargo, "--version"]);
  run(root, command);
  const after = sourceSnapshot(root);
  if (after.sha256 !== source.sha256 || after.revision !== source.revision) throw new Error("Native sources/revision changed during the build; candidate is not attested");
  const destination = join(output, basename(artifactPath(root, nativeTarget)));
  const cargoName = process.platform === "win32" ? "bun_nltk.dll" : `lib${basename(destination)}`;
  const built = join(targetDirectory, rustcHost, "release", cargoName);
  const binary = readFileSync(built);
  validateNativeSignature(binary, nativeTarget);
  mkdirSync(output, { recursive: true });
  copyFileSync(built, destination);
  // Isolate Bun's native-library cache and environment override from the build
  // process. A failed smoke leaves a candidate but never a passing provenance.
  const smokeText = run(root, [process.execPath, "run", join(root, "scripts", "smoke-native-source.ts"), "--library", destination, "--target", target, "--strict"]);
  const smoke = JSON.parse(smokeText) as { ok?: boolean; artifact_sha256?: string };
  if (!smoke.ok || smoke.artifact_sha256 !== sha256(binary)) throw new Error("Native candidate smoke failed or loaded different bytes");
  const validatedSource = sourceSnapshot(root);
  if (validatedSource.sha256 !== source.sha256 || validatedSource.revision !== source.revision || sha256(readFileSync(destination)) !== sha256(binary)) {
    throw new Error("Native sources/revision or candidate changed during smoke; no provenance is written");
  }
  const smokeBytes = `${JSON.stringify(JSON.parse(smokeText), null, 2)}\n`;
  writeFileSync(join(output, "smoke.json"), smokeBytes, { flag: "wx" });
  const provenance: NativeProvenance = {
    schema_version: 1, target: nativeTarget, generated_at: new Date().toISOString(), source,
    artifact: { sha256: sha256(binary), bytes: binary.length },
    build: { command, rustc, cargo: cargoVersion, flags: Object.fromEntries(["RUSTFLAGS", "CARGO_ENCODED_RUSTFLAGS", "RUSTUP_TOOLCHAIN", "CARGO_BUILD_TARGET"].filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]!])) },
    host: { platform: process.platform, architecture: process.arch, os_release: release(), rustc_host: rustcHost },
    validation: { status: "passed", kind: "source-native-smoke", report_sha256: sha256(smokeBytes) },
  };
  writeFileSync(`${destination}.provenance.json`, `${JSON.stringify(provenance, null, 2)}\n`, { flag: "wx" });
  const shipped = artifactPath(root, nativeTarget);
  const shippedBytes = existsSync(shipped) ? readFileSync(shipped).length : null;
  return {
    ok: true as const, status: "source-smoke-passed", target, candidate: destination, provenance: `${destination}.provenance.json`, smoke: join(output, "smoke.json"),
    source_revision: source.revision, candidate_bytes: binary.length, shipped_bytes: shippedBytes, delta_bytes: shippedBytes === null ? null : binary.length - shippedBytes,
    package_validation: "not_run; candidate is not packaged", foreign_host_validation: "blocked; run separately on each genuine host",
  };
}

if (import.meta.main) {
  const report = await refreshNativeHost();
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}
