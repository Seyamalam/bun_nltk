// bun test spawns pinned Python oracles (NLTK 3.10.3 / Python 3.14.4) as bare
// `python3`, which Bun resolves against the boot-time PATH only. Re-exec the
// real test run with the repo .venv prepended when it exists; otherwise the
// ambient python3 is used and oracle failures surface exactly as before.
import { existsSync } from "node:fs";
import { delimiter, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const venvBin = resolve(root, ".venv/bin");
const env = { ...process.env };
if (existsSync(resolve(venvBin, "python3")) && !(env.PATH ?? "").split(delimiter).includes(venvBin)) {
  env.PATH = `${venvBin}${delimiter}${env.PATH ?? ""}`;
}

const proc = Bun.spawnSync([process.execPath, "test", "./test", ...process.argv.slice(2)], {
  cwd: root,
  env,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});
process.exit(proc.exitCode ?? 1);
