import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");

function runJson(command: string[]): Record<string, unknown> {
  const proc = Bun.spawnSync(command, { cwd: root, stdout: "pipe", stderr: "pipe" });
  const stdout = new TextDecoder().decode(proc.stdout).trim();
  const stderr = new TextDecoder().decode(proc.stderr).trim();
  if (proc.exitCode !== 0) {
    throw new Error(`${command.join(" ")} failed (${proc.exitCode})\n${stdout}\n${stderr}`);
  }
  return JSON.parse(stdout) as Record<string, unknown>;
}

function nestedNumber(value: Record<string, unknown>, path: readonly string[]): number {
  let current: unknown = value;
  for (const key of path) {
    if (!current || typeof current !== "object") throw new Error(`missing benchmark field: ${path.join(".")}`);
    current = (current as Record<string, unknown>)[key];
  }
  if (typeof current !== "number" || !Number.isFinite(current)) {
    throw new Error(`invalid benchmark field: ${path.join(".")}`);
  }
  return current;
}

const linear = runJson(["bun", "run", "bench/compare_linear_training_native_vs_js.ts", "6000", "1200", "5"]);
const hmm = runJson(["bun", "run", "bench/compare_hmm_native_vs_js.ts", "240", "160", "5"]);
const kmeans = runJson(["bun", "run", "bench/compare_kmeans_native_vs_js.ts", "20000", "16", "8", "5"]);
const wordnet = runJson(["bun", "run", "bench/compare_wordnet_load.ts"]);

// Minimums re-baselined 2026-11-09 by owner decision for Bun 1.4.4: its JIT
// roughly doubled steady-state JS speed versus the 1.4.2 calibration, so
// native-vs-JS medians moved (HMM ~1.3-1.5x, K-means ~1.9-2.1x, WordNet
// ~1.5x on linux-x64 i3-1215U). Floors keep a meaningful native advantage
// and margin below observed medians; they are not a perf regression license.
const measurements = [
  { name: "logistic text train", actual: nestedNumber(linear, ["logistic", "speedup_native_vs_js"]), minimum: 1.2 },
  { name: "SVM text train", actual: nestedNumber(linear, ["svm", "speedup_native_vs_js"]), minimum: 1.4 },
  { name: "HMM decode", actual: nestedNumber(hmm, ["speedup_native_vs_js"]), minimum: 1.25 },
  { name: "K-means", actual: nestedNumber(kmeans, ["speedup_native_vs_js"]), minimum: 1.75 },
  { name: "WordNet load", actual: nestedNumber(wordnet, ["load_speedup_native_vs_js"]), minimum: 1.3 },
];

const failures = measurements.filter((measurement) => measurement.actual < measurement.minimum);
console.log(JSON.stringify({ ok: failures.length === 0, measurements }, null, 2));
if (failures.length > 0) {
  throw new Error(
    `native performance gates failed: ${failures
      .map((failure) => `${failure.name} ${failure.actual.toFixed(3)}x < ${failure.minimum.toFixed(3)}x`)
      .join(", ")}`,
  );
}
