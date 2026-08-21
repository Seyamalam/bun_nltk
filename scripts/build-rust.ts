import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const ext = process.platform === "win32" ? "dll" : process.platform === "darwin" ? "dylib" : "so";

const cargoLibName = process.platform === "win32" ? "bun_nltk.dll" : `libbun_nltk.${ext}`;
const cargoOutPath = join(root, "rust", "target", "release", cargoLibName);
const outPath = join(root, "native", `bun_nltk.${ext}`);
const prebuiltPath = join(root, "native", "prebuilt", `${process.platform}-${process.arch}`, `bun_nltk.${ext}`);

mkdirSync(dirname(outPath), { recursive: true });
mkdirSync(dirname(prebuiltPath), { recursive: true });

const cargoBin = process.env.BUN_NLTK_CARGO_BIN ?? "cargo";

const proc = Bun.spawnSync(
  [cargoBin, "build", "--release", "--manifest-path", join("rust", "Cargo.toml")],
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
copyFileSync(cargoOutPath, prebuiltPath);

console.log(`Built native library: ${outPath}`);
console.log(`Prebuilt copy: ${prebuiltPath} (cargo: ${cargoBin})`);
