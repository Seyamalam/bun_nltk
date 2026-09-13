import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { delimiter, resolve } from "node:path";
import { summarizeParity, type CheckResult } from "./parity-status";
const root = resolve(import.meta.dir, ".."),
  outputPath = resolve(root, "artifacts/fidelity-report.json");
const localBin = resolve(root, ".venv/bin");
const env = existsSync(resolve(localBin, "python3"))
  ? { ...process.env, PATH: `${localBin}${delimiter}${process.env.PATH ?? ""}` }
  : process.env;
const python = Bun.spawnSync(
  [
    "python3",
    "-c",
    "import json,platform,nltk; print(json.dumps({'python':platform.python_version(),'nltk':nltk.__version__}))",
  ],
  { cwd: root, env, stdout: "pipe", stderr: "pipe" },
);
const proc = Bun.spawnSync(["bun", "run", "bench/parity_all.ts"], {
  cwd: root,
  env,
  stdout: "pipe",
  stderr: "pipe",
});
let results: Record<string, CheckResult>;
try {
  results = JSON.parse(new TextDecoder().decode(proc.stdout)).results;
  if (!results) throw new Error("Missing results");
} catch {
  results = {
    suite: {
      status: "failed",
      required: true,
      reason: new TextDecoder().decode(proc.stderr) || "Suite produced no valid result",
    },
  };
}
if (python.exitCode !== 0)
  results.oracle = {
    status: "failed",
    required: true,
    reason: new TextDecoder().decode(python.stderr),
  };
if (
  proc.exitCode !== 0 &&
  Object.values(results).every((r) => !r.required || r.status === "passed")
)
  results.suite = { status: "failed", required: true, reason: `Suite exited ${proc.exitCode}` };
const summary = summarizeParity(results);
const report = {
  schema_version: 2,
  generated_at: new Date().toISOString(),
  ...summary,
  scope: {
    check_groups: Object.keys(results).length,
    ...summary.counts,
    separate_from_import_coverage: true,
    separate_from_speed: true,
    oracle: "Live Python NLTK plus versioned NLTK-derived fixtures",
    limitation:
      "Passing means exact agreement within the stated fixtures and tolerances, not complete NLTK equivalence.",
  },
  environment: {
    bun: Bun.version,
    ...(python.exitCode === 0 ? JSON.parse(new TextDecoder().decode(python.stdout)) : {}),
  },
};
mkdirSync(resolve(root, "artifacts"), { recursive: true });
writeFileSync(outputPath, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ ok: report.ok, output: outputPath, ...summary.counts }, null, 2));
if (!report.ok) process.exitCode = 1;
