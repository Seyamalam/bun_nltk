import { copyFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");

type PrebuiltTarget = {
  platform: "linux" | "win32";
  arch: "x64";
  rustTarget: string;
  ext: "so" | "dll";
};

const targets: PrebuiltTarget[] = [
  {
    platform: "linux",
    arch: "x64",
    rustTarget: "x86_64-unknown-linux-gnu",
    ext: "so",
  },
  {
    platform: "win32",
    arch: "x64",
    rustTarget: "x86_64-pc-windows-gnu",
    ext: "dll",
  },
];

const cargoBin = process.env.BUN_NLTK_CARGO_BIN ?? "cargo";

for (const target of targets) {
  const outDir = join(root, "native", "prebuilt", `${target.platform}-${target.arch}`);
  mkdirSync(outDir, { recursive: true });
  const cargoLibName =
    target.ext === "dll" ? "bun_nltk.dll" : `libbun_nltk.${target.ext}`;
  const cargoOutPath = join(root, "rust", "target", target.rustTarget, "release", cargoLibName);
  const outPath = join(outDir, `bun_nltk.${target.ext}`);

  const proc = Bun.spawnSync(
    [
      cargoBin,
      "build",
      "--release",
      "--target",
      target.rustTarget,
      "--manifest-path",
      join("rust", "Cargo.toml"),
    ],
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

  console.log(`Built prebuilt native: ${outPath} (target: ${target.rustTarget}, cargo: ${cargoBin})`);
}
