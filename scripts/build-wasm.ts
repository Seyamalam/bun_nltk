import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const outPath = join(root, "native", "bun_nltk.wasm");
mkdirSync(dirname(outPath), { recursive: true });

function findZigBinary(): string {
  if (process.env.BUN_NLTK_ZIG_BIN) {
    return process.env.BUN_NLTK_ZIG_BIN;
  }

  if (process.platform !== "win32") {
    return "zig";
  }

  const localAppData = process.env.LOCALAPPDATA ?? "";
  const winGetLink = join(localAppData, "Microsoft", "WinGet", "Links", "zig.exe");
  if (existsSync(winGetLink)) {
    return winGetLink;
  }

  const packageRoot = join(localAppData, "Microsoft", "WinGet", "Packages");
  const zigPackageDir = join(packageRoot, "zig.zig_Microsoft.Winget.Source_8wekyb3d8bbwe");
  if (existsSync(zigPackageDir)) {
    const childDirs = readdirSync(zigPackageDir, { withFileTypes: true });
    for (const dirent of childDirs) {
      if (!dirent.isDirectory()) continue;
      const candidate = join(zigPackageDir, dirent.name, "zig.exe");
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return "zig";
}

const zigBin = findZigBinary();

const proc = Bun.spawnSync(
  [
    zigBin,
    "build-exe",
    "zig/src/wasm_exports.zig",
    "-target",
    "wasm32-freestanding",
    "-O",
    "ReleaseFast",
    "-fno-entry",
    "-rdynamic",
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

console.log(`Built wasm library: ${outPath} (zig: ${zigBin})`);
