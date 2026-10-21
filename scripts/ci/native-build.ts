import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { release } from "node:os";
import { optimizeWasmInPlace } from "../wasm-opt.ts";

const root = resolve(import.meta.dir, "../..");
const host = `${process.platform}-${process.arch}`;
const triples: Record<string, string> = {
  "linux-x64": "x86_64-unknown-linux-gnu",
  "darwin-arm64": "aarch64-apple-darwin",
  "win32-x64": "x86_64-pc-windows-msvc",
};
const expected = process.env.BUN_NLTK_EXPECT_HOST ?? host;
if (expected !== host || !triples[host]) throw new Error(`Expected real ${expected} host; got ${host}`);
if (process.env.CARGO_BUILD_TARGET) throw new Error("CI builds cannot inherit CARGO_BUILD_TARGET");
const mode = process.argv[2];
if (mode !== "native" && mode !== "wasm" && mode !== "compat") throw new Error("usage: native-build.ts native|wasm|compat");
const targetDir = resolve(root, process.env.CARGO_TARGET_DIR ?? `rust/target/semaphore-${process.env.SEMAPHORE_JOB_ID ?? "local"}`);
// Deterministic helper embedding must not depend on this checkout's pathname.
const env = { ...process.env, CARGO_TARGET_DIR: targetDir, RUSTFLAGS: `--remap-path-prefix=${root}=/bun_nltk` };
function run(command: string[]): string {
  const child = Bun.spawnSync(command, { cwd: root, env, stdout: "pipe", stderr: "pipe" });
  const stdout = new TextDecoder().decode(child.stdout).trim();
  const stderr = new TextDecoder().decode(child.stderr).trim();
  if (child.exitCode !== 0) throw new Error(`${command.join(" ")} failed\n${stdout}\n${stderr}`);
  return stdout;
}
const rustc = run(["rustc", "-vV"]);
const versions = JSON.parse(readFileSync(resolve(root, "scripts/ci/versions.json"), "utf8")) as { rust: string };
if (!rustc.startsWith(`rustc ${versions.rust} `)) throw new Error(`Expected pinned Rust ${versions.rust}\n${rustc}`);
if (!rustc.includes(`host: ${triples[host]}`)) throw new Error(`Rust host is not ${triples[host]}\n${rustc}`);
<<<<<<< HEAD
const triple = mode === "wasm" ? "wasm32-unknown-unknown" : triples[host]!;
const manifest = resolve(root, "rust/Cargo.toml");
const profile = mode === "wasm" ? "wasm" : "release";
run(["cargo", "build", "--locked", "--profile", profile, "--manifest-path", manifest, "--target", triple]);
const extension = process.platform === "win32" ? "dll" : process.platform === "darwin" ? "dylib" : "so";
const filename = mode === "wasm" ? "bun_nltk.wasm" : process.platform === "win32" ? "bun_nltk.dll" : `libbun_nltk.${extension}`;
const output = mode === "wasm" ? "native/bun_nltk.wasm" : `native/prebuilt/${host}/bun_nltk.${extension}`;
const source = resolve(targetDir, triple, profile, filename);
=======
const triple = mode === "native" ? triples[host]! : "wasm32-unknown-unknown";
const crate = mode === "compat" ? "rust/compat" : "rust";
const manifest = resolve(root, crate, "Cargo.toml");
run(["cargo", "build", "--locked", "--release", "--manifest-path", manifest, "--target", triple]);
const extension = process.platform === "win32" ? "dll" : process.platform === "darwin" ? "dylib" : "so";
const filename = mode === "compat" ? "bun_nltk_compat.wasm" : mode === "wasm" ? "bun_nltk.wasm" : process.platform === "win32" ? "bun_nltk.dll" : `libbun_nltk.${extension}`;
const output = mode === "compat" ? `artifacts/semaphore-native/${host}/bun_nltk_compat.wasm` : mode === "wasm" ? "native/bun_nltk.wasm" : `native/prebuilt/${host}/bun_nltk.${extension}`;
const source = resolve(targetDir, triple, "release", filename);
>>>>>>> f8b59c1 (ci: pin inventory oracle and enforce integrated Rust hygiene checks)
mkdirSync(dirname(resolve(root, output)), { recursive: true });
copyFileSync(source, resolve(root, output));
if (mode === "wasm") optimizeWasmInPlace(resolve(root, output), root);
if (mode === "native") copyFileSync(source, resolve(root, `native/bun_nltk.${extension}`));
const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const reportDirectory = resolve(root, "artifacts/semaphore-native", host);
mkdirSync(reportDirectory, { recursive: true });
writeFileSync(resolve(reportDirectory, `build-${mode}.json`), JSON.stringify({
  schema_version: 1,
  source_revision: run(["git", "rev-parse", "HEAD"]),
  cargo_manifest: `${crate}/Cargo.toml`,
  cargo_lock_sha256: sha256(resolve(root, crate, "Cargo.lock")),
  rustflags: env.RUSTFLAGS,
  host, os_release: release(), triple, rustc, bun: Bun.version,
  artifact: { path: output, sha256: sha256(resolve(root, output)), bytes: readFileSync(resolve(root, output)).length },
  cargo_target_dir: relative(root, targetDir),
  scope: "Locked source build on the stated host; behavioral verification is a separate step.",
}, null, 2) + "\n");
console.log(`Built ${output} on ${host}, target ${triple}`);
