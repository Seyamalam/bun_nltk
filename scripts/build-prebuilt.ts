import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");

type PrebuiltTarget = {
  platform: "linux" | "win32";
  arch: "x64";
  zigTarget: string;
  ext: "so" | "dll";
};

const targets: PrebuiltTarget[] = [
  {
    platform: "linux",
    arch: "x64",
    zigTarget: "x86_64-linux-gnu",
    ext: "so",
  },
  {
    platform: "win32",
    arch: "x64",
    zigTarget: "x86_64-windows-gnu",
    ext: "dll",
  },
];

function findZigBinary(): string {
  if (process.env.BUN_NLTK_ZIG_BIN) return process.env.BUN_NLTK_ZIG_BIN;
  if (process.platform !== "win32") return "zig";

  const localAppData = process.env.LOCALAPPDATA ?? "";
  const winGetLink = join(localAppData, "Microsoft", "WinGet", "Links", "zig.exe");
  if (existsSync(winGetLink)) return winGetLink;

  const packageRoot = join(localAppData, "Microsoft", "WinGet", "Packages");
  const zigPackageDir = join(packageRoot, "zig.zig_Microsoft.Winget.Source_8wekyb3d8bbwe");
  if (existsSync(zigPackageDir)) {
    const childDirs = readdirSync(zigPackageDir, { withFileTypes: true });
    for (const dirent of childDirs) {
      if (!dirent.isDirectory()) continue;
      const candidate = join(zigPackageDir, dirent.name, "zig.exe");
      if (existsSync(candidate)) return candidate;
    }
  }

  return "zig";
}

const zigBin = findZigBinary();

for (const target of targets) {
  const outDir = join(root, "native", "prebuilt", `${target.platform}-${target.arch}`);
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `bun_nltk.${target.ext}`);

  const proc = Bun.spawnSync(
    [
      zigBin,
      "build-lib",
      "zig/src/lib.zig",
      "-dynamic",
      "-O",
      "ReleaseFast",
      "-lc",
      "-target",
      target.zigTarget,
      `-femit-bin=${outPath}`,
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

  console.log(`Built prebuilt native: ${outPath} (target: ${target.zigTarget}, zig: ${zigBin})`);
}
