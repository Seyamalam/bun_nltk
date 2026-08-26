import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const tarball = resolve(process.argv[2] ?? "");
if (!process.argv[2] || !existsSync(tarball)) throw new Error("usage: npm-smoke-linux.ts <package.tgz>");

const proc = Bun.spawnSync(
  [
    "docker",
    "run",
    "--rm",
    "--platform",
    "linux/amd64",
    "--volume",
    `${root}:/repo:ro`,
    "--volume",
    `${tarball}:/package.tgz:ro`,
    "--workdir",
    "/repo",
    "python:3.12-slim",
    "python3",
    "scripts/smoke_linux_native.py",
    "/package.tgz",
  ],
  { cwd: root, stdout: "inherit", stderr: "inherit" },
);

if (proc.exitCode !== 0) throw new Error(`Linux packaged-prebuilt smoke failed with exit code ${proc.exitCode}`);
