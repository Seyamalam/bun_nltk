import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const packageJson = (await Bun.file(resolve(root, "package.json")).json()) as { version: string };
const artifactDir = resolve(root, "artifacts", "local-release");
const tarball = resolve(artifactDir, `bun_nltk-${packageJson.version}.tgz`);
mkdirSync(artifactDir, { recursive: true });
rmSync(tarball, { force: true });

function run(label: string, command: string[]): void {
  console.log(`\n[local release] ${label}`);
  const proc = Bun.spawnSync(command, { cwd: root, stdout: "inherit", stderr: "inherit" });
  if (proc.exitCode !== 0) throw new Error(`${label} failed with exit code ${proc.exitCode}`);
}

run("typecheck", ["bun", "run", "typecheck"]);
run("lint", ["bun", "run", "lint"]);
run("Rust tests", ["cargo", "test", "--manifest-path", "rust/Cargo.toml"]);
run("three-platform native build", ["bun", "run", "build:prebuilt"]);
run("WASM build", ["bun", "run", "build:wasm"]);
run("native artifact formats and sizes", ["bun", "run", "native:artifacts:check"]);
run("TypeScript test suite", ["bun", "test", "--timeout", "30000"]);
run("separate Python-oracle behavioral fidelity gate", ["bun", "run", "fidelity:gate"]);
run("native migration benchmark gates", ["bun", "run", "native:migration:gate"]);
run("package size", ["bun", "run", "package:size:check"]);
run("package contents", ["bun", "run", "pack:verify:prebuilt"]);
run("pack actual tarball", [
  "bun",
  "pm",
  "pack",
  "--ignore-scripts",
  "--destination",
  artifactDir,
]);
run("install and execute packaged prebuilt", ["bun", "run", "scripts/npm-smoke-test.ts", tarball]);

console.log(`\nLocal release validation passed: ${tarball}`);
console.log("Run native Linux validation with: bash scripts/verify-linux.sh");
console.log("Run native Windows validation with: scripts\\verify-windows.cmd");
