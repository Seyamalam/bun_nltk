type NpmPackFile = {
  path: string;
  size: number;
  mode: number;
};

type NpmPackRecord = {
  files: NpmPackFile[];
};

const requiredFiles = [
  "native/prebuilt/linux-x64/bun_nltk.so",
  "native/prebuilt/win32-x64/bun_nltk.dll",
  "native/bun_nltk.wasm",
  "models/wordnet_full.bin",
  "models/wordnet_full.sha256.json",
];

const forbiddenFiles = [
  "native/bun_nltk.dll",
  "native/bun_nltk.pdb",
  "native/lib.lib",
  "native/prebuilt/win32-x64/bun_nltk.pdb",
  "native/prebuilt/win32-x64/lib.lib",
];

const lifecycleScripts = ["preinstall", "install", "postinstall", "prepare"];

function runNpmPackDryRun(): NpmPackRecord {
  const proc = Bun.spawnSync(["npm", "pack", "--dry-run", "--json"], {
    stdout: "pipe",
    stderr: "pipe",
  });

  if (proc.exitCode !== 0) {
    throw new Error(
      `npm pack --dry-run failed with code ${proc.exitCode}\nstdout:\n${new TextDecoder().decode(
        proc.stdout,
      )}\nstderr:\n${new TextDecoder().decode(proc.stderr)}`,
    );
  }

  const stdout = new TextDecoder().decode(proc.stdout).trim();
  const parsed = JSON.parse(stdout) as NpmPackRecord[];
  if (!Array.isArray(parsed) || parsed.length === 0 || !Array.isArray(parsed[0]?.files)) {
    throw new Error(`unexpected npm pack JSON output: ${stdout}`);
  }
  return parsed[0]!;
}

async function main() {
  const pack = runNpmPackDryRun();
  const packagedPaths = new Set(pack.files.map((f) => f.path));

  const missing = requiredFiles.filter((path) => !packagedPaths.has(path));
  if (missing.length > 0) {
    throw new Error(`missing required packaged files: ${missing.join(", ")}`);
  }

  const leaked = forbiddenFiles.filter((path) => packagedPaths.has(path));
  if (leaked.length > 0) {
    throw new Error(`forbidden files leaked into package: ${leaked.join(", ")}`);
  }

  const pkgJson = JSON.parse(await Bun.file("package.json").text()) as {
    scripts?: Record<string, string>;
  };
  const lifecyclePresent = lifecycleScripts.filter((name) => Boolean(pkgJson.scripts?.[name]));
  if (lifecyclePresent.length > 0) {
    throw new Error(`disallowed lifecycle scripts in package.json: ${lifecyclePresent.join(", ")}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        requiredFiles,
        forbiddenFilesChecked: forbiddenFiles.length,
        lifecycleScriptsChecked: lifecycleScripts,
      },
      null,
      2,
    ),
  );
}

await main();
