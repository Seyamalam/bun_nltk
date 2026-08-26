import { copyFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");

type PrebuiltTarget = {
  platform: "darwin" | "linux" | "win32";
  arch: "arm64" | "x64";
  rustTarget: string;
  buildTarget?: string;
  ext: "dylib" | "so" | "dll";
  cross: boolean;
};

const targets: PrebuiltTarget[] = [
  {
    platform: "darwin",
    arch: "arm64",
    rustTarget: "aarch64-apple-darwin",
    ext: "dylib",
    cross: false,
  },
  {
    platform: "linux",
    arch: "x64",
    rustTarget: "x86_64-unknown-linux-gnu",
    buildTarget: "x86_64-unknown-linux-gnu.2.17",
    ext: "so",
    cross: true,
  },
  {
    platform: "win32",
    arch: "x64",
    rustTarget: "x86_64-pc-windows-gnu",
    ext: "dll",
    cross: true,
  },
];

const cargoBin = process.env.BUN_NLTK_CARGO_BIN ?? "cargo";

if (process.platform !== "darwin" || process.arch !== "arm64") {
  throw new Error("the local three-platform build currently requires a darwin-arm64 host");
}

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
      target.cross ? "zigbuild" : "build",
      "--release",
      "--target",
      target.buildTarget ?? target.rustTarget,
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

  console.log(
    `Built prebuilt native: ${outPath} (target: ${target.buildTarget ?? target.rustTarget}, command: ${cargoBin} ${
      target.cross ? "zigbuild" : "build"
    })`,
  );
}
