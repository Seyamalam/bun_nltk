import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { delimiter, resolve } from "node:path";

type ParityResult = {
  ok: boolean;
  checks: Record<string, boolean>;
};

const root = resolve(import.meta.dir, "..");
const artifactDir = resolve(root, "artifacts");
const outputPath = resolve(artifactDir, "fidelity-report.json");
const localPythonBin = resolve(root, ".venv", "bin");
const commandEnv = existsSync(resolve(localPythonBin, "python3"))
  ? { ...process.env, PATH: `${localPythonBin}${delimiter}${process.env.PATH ?? ""}` }
  : process.env;

function run(command: string[]): string {
  const proc = Bun.spawnSync(command, {
    cwd: root,
    env: commandEnv,
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = new TextDecoder().decode(proc.stdout).trim();
  const stderr = new TextDecoder().decode(proc.stderr).trim();
  if (proc.exitCode !== 0) {
    throw new Error(`${command.join(" ")} failed (${proc.exitCode})\nstdout:\n${stdout}\nstderr:\n${stderr}`);
  }
  return stdout;
}

function extractJson(payload: string): Record<string, unknown> {
  const start = payload.indexOf("{");
  const end = payload.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error(`could not find JSON in output:\n${payload}`);
  return JSON.parse(payload.slice(start, end + 1)) as Record<string, unknown>;
}

const python = JSON.parse(
  run([
    "python3",
    "-c",
    "import json,platform,nltk; print(json.dumps({'python': platform.python_version(), 'nltk': nltk.__version__}))",
  ]),
) as { python: string; nltk: string };
const parity = extractJson(run(["bun", "run", "bench/parity_all.ts"])) as ParityResult;
const entries = Object.entries(parity.checks);
const failed = entries.filter(([, passed]) => !passed).map(([name]) => name);
if (!parity.ok || failed.length > 0) {
  throw new Error(`behavioral fidelity groups failed: ${failed.join(", ")}`);
}

const report = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  ok: true,
  scope: {
    check_groups: entries.length,
    passed_groups: entries.length - failed.length,
    failed_groups: failed.length,
    separate_from_import_coverage: true,
    oracle: "live Python NLTK outputs plus versioned NLTK-derived fixtures",
    limitation: "The project author maintains this differential gate; it is not an external replication.",
  },
  environment: {
    bun: Bun.version,
    python: python.python,
    nltk: python.nltk,
  },
  checks: parity.checks,
};

mkdirSync(artifactDir, { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, output: outputPath, check_groups: entries.length }, null, 2));
