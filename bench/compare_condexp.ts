import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { trainConditionalExponentialTextClassifier, type ConditionalExponentialExample } from "../index";

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function makeRows(size: number, label: "pos" | "neg"): ConditionalExponentialExample[] {
  const posLex = ["great", "happy", "smooth", "excellent", "wonderful", "fast", "joy", "support"];
  const negLex = ["bad", "broken", "terrible", "slow", "awful", "hate", "angry", "painful"];
  const lex = label === "pos" ? posLex : negLex;
  const rows: ConditionalExponentialExample[] = [];
  for (let i = 0; i < size; i += 1) {
    const a = lex[i % lex.length]!;
    const b = lex[(i * 3 + 1) % lex.length]!;
    const c = lex[(i * 5 + 2) % lex.length]!;
    rows.push({ label, text: `${a} ${b} ${c} product support` });
  }
  return rows;
}

function runNative(trainRows: ConditionalExponentialExample[], testRows: ConditionalExponentialExample[], rounds: number) {
  const timings: number[] = [];
  let last = trainConditionalExponentialTextClassifier(trainRows, { epochs: 12, learningRate: 0.2, l2: 1e-4, maxFeatures: 4096 });
  for (let i = 0; i < rounds; i += 1) {
    const started = performance.now();
    last = trainConditionalExponentialTextClassifier(trainRows, { epochs: 12, learningRate: 0.2, l2: 1e-4, maxFeatures: 4096 });
    timings.push((performance.now() - started) / 1000);
  }
  return {
    accuracy: last.evaluate(testRows).accuracy,
    median_seconds: median(timings),
  };
}

function runPython(trainRows: ConditionalExponentialExample[], testRows: ConditionalExponentialExample[]) {
  const root = resolve(import.meta.dir, "..");
  const payload = JSON.stringify({ train: trainRows, test: testRows, max_iter: 12 });
  const artifacts = resolve(root, "artifacts");
  mkdirSync(artifacts, { recursive: true });
  const payloadPath = resolve(artifacts, `condexp_payload_${Date.now()}.json`);
  writeFileSync(payloadPath, payload, "utf8");
  const proc = Bun.spawnSync(["python", "bench/python_condexp_baseline.py", "--payload-file", payloadPath], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
  return JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as { accuracy: number; total_seconds: number };
}

function main() {
  const trainSize = Number(process.argv[2] ?? "1000");
  const testSize = Number(process.argv[3] ?? "300");
  const rounds = Number(process.argv[4] ?? "2");

  const trainRows = [...makeRows(Math.floor(trainSize / 2), "pos"), ...makeRows(Math.ceil(trainSize / 2), "neg")];
  const testRows = [...makeRows(Math.floor(testSize / 2), "pos"), ...makeRows(Math.ceil(testSize / 2), "neg")];
  const native = runNative(trainRows, testRows, rounds);
  const python = runPython(trainRows, testRows);
  console.log(
    JSON.stringify(
      {
        train_size: trainRows.length,
        test_size: testRows.length,
        rounds,
        native_accuracy: native.accuracy,
        python_accuracy: python.accuracy,
        native_seconds_median: native.median_seconds,
        python_seconds: python.total_seconds,
        speedup_vs_python: python.total_seconds / native.median_seconds,
      },
      null,
      2,
    ),
  );
}

main();
