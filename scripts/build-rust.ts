import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const ext = process.platform === "win32" ? "dll" : process.platform === "darwin" ? "dylib" : "so";

const cargoLibName = process.platform === "win32" ? "bun_nltk.dll" : `libbun_nltk.${ext}`;
const cargoTargetDir = resolve(process.env.CARGO_TARGET_DIR ?? join(root, "rust", "target"));
const cargoOutPath = join(cargoTargetDir, "release", cargoLibName);
const outPath = join(root, "native", `bun_nltk.${ext}`);

mkdirSync(dirname(outPath), { recursive: true });

const cargoBin = process.env.BUN_NLTK_CARGO_BIN ?? "cargo";

const proc = Bun.spawnSync(
  [cargoBin, "build", "--locked", "--release", "--manifest-path", join("rust", "Cargo.toml"), "--target-dir", cargoTargetDir],
  {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  },
);

if (proc.exitCode !== 0) {
  console.error(new TextDecoder().decode(proc.stdout));
  console.error(new TextDecoder().decode(proc.stderr));
  process.exit(proc.exitCode ?? 1);
}

copyFileSync(cargoOutPath, outPath);

console.log(`Built native library: ${outPath}`);
console.log(`Developer output only (cargo: ${cargoBin}); packaged prebuilts are unchanged. Use build:prebuilt with --output-dir for byte-bound genuine-host provenance.`);
