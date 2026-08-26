import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const tarball = resolve(process.argv[2] ?? "");
if (!process.argv[2] || !existsSync(tarball)) {
  throw new Error("usage: npm-smoke-windows.ts <package.tgz>");
}

function run(label: string, command: string[], cwd = root): string {
  const proc = Bun.spawnSync(command, { cwd, stdout: "pipe", stderr: "pipe" });
  const stdout = new TextDecoder().decode(proc.stdout).trim();
  const stderr = new TextDecoder().decode(proc.stderr).trim();
  if (proc.exitCode !== 0) {
    throw new Error(`${label} failed (${proc.exitCode})\nstdout:\n${stdout}\nstderr:\n${stderr}`);
  }
  return stdout;
}

const localTempRoot = resolve(root, "tmp");
mkdirSync(localTempRoot, { recursive: true });
const tempDir = mkdtempSync(join(localTempRoot, "windows-smoke-"));
const image = "bun-nltk-windows-smoke:trixie";

try {
  run("extract packaged Windows DLL", [
    "tar",
    "-xzf",
    tarball,
    "-C",
    tempDir,
    "--strip-components=4",
    "package/native/prebuilt/win32-x64/bun_nltk.dll",
  ]);

  const object = join(tempDir, "bun_nltk_smoke.o");
  const executable = join(tempDir, "bun_nltk_smoke.exe");
  run("compile Windows smoke object", [
    "zig",
    "cc",
    "-target",
    "x86_64-windows-gnu",
    "-O2",
    "-c",
    resolve(root, "scripts", "smoke_windows_native.c"),
    "-o",
    object,
  ]);
  run("link Windows smoke executable", [
    "zig",
    "cc",
    "-target",
    "x86_64-windows-gnu",
    "-nostdlib",
    "-Wl,--entry,mainCRTStartup",
    "-lkernel32",
    "-s",
    object,
    "-o",
    executable,
  ]);

  run("build local Wine runner", [
    "docker",
    "build",
    "--platform",
    "linux/amd64",
    "--tag",
    image,
    "--file",
    resolve(root, "scripts", "Dockerfile.windows-smoke"),
    resolve(root, "scripts"),
  ]);

  const output = run("execute packaged Windows DLL under Wine", [
    "docker",
    "run",
    "--rm",
    "--platform",
    "linux/amd64",
    "--volume",
    `${tempDir}:/work:ro`,
    "--workdir",
    "/work",
    image,
    "./bun_nltk_smoke.exe",
  ]);
  const result = JSON.parse(output) as { ok?: boolean; platform?: string; tokens?: number };
  if (!result.ok || result.platform !== "win32-x64-wine" || result.tokens !== 9) {
    throw new Error(`unexpected Windows smoke result: ${output}`);
  }
  console.log(JSON.stringify({ ...result, runner: "Wine 10 in local linux/amd64 Docker container" }, null, 2));
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
