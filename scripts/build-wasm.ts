import { copyFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const outPath = join(root, "native", "bun_nltk.wasm");
mkdirSync(join(root, "native"), { recursive: true });

const cargoBin = process.env.BUN_NLTK_CARGO_BIN ?? "cargo";
const target = "wasm32-unknown-unknown";

const proc = Bun.spawnSync(
  [cargoBin, "build", "--release", "--target", target, "--manifest-path", join("rust", "Cargo.toml")],
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

copyFileSync(
  join(root, "rust", "target", target, "release", "bun_nltk.wasm"),
  outPath,
);

console.log(`Built wasm library: ${outPath} (cargo: ${cargoBin})`);
