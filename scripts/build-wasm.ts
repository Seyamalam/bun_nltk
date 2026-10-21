import { copyFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { optimizeWasmInPlace } from "./wasm-opt.ts";

const root = resolve(import.meta.dir, "..");
const outPath = join(root, "native", "bun_nltk.wasm");
mkdirSync(join(root, "native"), { recursive: true });

const cargoBin = process.env.BUN_NLTK_CARGO_BIN ?? "cargo";
const target = "wasm32-unknown-unknown";
const targetDir = process.env.CARGO_TARGET_DIR ?? join(root, "rust", "target");

const proc = Bun.spawnSync(
  [cargoBin, "build", "--locked", "--profile", "wasm", "--target", target, "--manifest-path", join("rust", "Cargo.toml")],
  {
    cwd: root,
    env: { ...process.env, CARGO_TARGET_DIR: targetDir },
    stdout: "pipe",
    stderr: "pipe",
  },
);

if (proc.exitCode !== 0) {
  console.error(new TextDecoder().decode(proc.stdout));
  console.error(new TextDecoder().decode(proc.stderr));
  process.exit(proc.exitCode ?? 1);
}

copyFileSync(join(targetDir, target, "wasm", "bun_nltk.wasm"), outPath);
optimizeWasmInPlace(outPath, root);

console.log(`Built wasm library: ${outPath} (cargo: ${cargoBin})`);
