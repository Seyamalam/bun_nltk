import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { trainPositiveNaiveBayesTextClassifier } from "../index";

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function makeRows(size: number, kind: "pos" | "neg"): string[] {
  const prefix = kind === "pos" ? "p" : "n";
  const rows: string[] = [];
  for (let i = 0; i < size; i += 1) {
    const a = `${prefix}_tok_${i}`;
    const b = `${prefix}_mix_${(i * 7 + 11) % Math.max(1, size)}`;
    const c = `common_${i % 64}`;
    rows.push(`${a} ${b} ${c} ${prefix}_signal`);
  }
  return rows;
}

function runNative(positive: string[], unlabeled: string[], testRows: Array<{ label: string; text: string }>, rounds: number) {
  const timings: number[] = [];
  let last = trainPositiveNaiveBayesTextClassifier(positive, unlabeled, {
    positivePrior: 0.5,
    positiveLabel: "pos",
    negativeLabel: "neg",
  });
  for (let i = 0; i < rounds; i += 1) {
    const started = performance.now();
    last = trainPositiveNaiveBayesTextClassifier(positive, unlabeled, {
      positivePrior: 0.5,
      positiveLabel: "pos",
      negativeLabel: "neg",
    });
    timings.push((performance.now() - started) / 1000);
  }
  return { accuracy: last.evaluate(testRows).accuracy, median_seconds: median(timings) };
}

function runPython(positive: string[], unlabeled: string[], testRows: Array<{ label: string; text: string }>) {
  const root = resolve(import.meta.dir, "..");
  const payload = JSON.stringify({
    positive,
    unlabeled,
    test: testRows,
    positive_prior: 0.5,
    positive_label: "pos",
    negative_label: "neg",
    rounds: 1,
  });
  const artifacts = resolve(root, "artifacts");
  mkdirSync(artifacts, { recursive: true });
  const payloadPath = resolve(artifacts, `positive_nb_payload_${Date.now()}.json`);
  writeFileSync(payloadPath, payload, "utf8");
  const proc = Bun.spawnSync(["python", "bench/python_positive_nb_baseline.py", "--payload-file", payloadPath], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
  return JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as { accuracy: number; total_seconds: number };
}

function main() {
  const positiveSize = Number(process.argv[2] ?? "800");
  const unlabeledSize = Number(process.argv[3] ?? "2400");
  const testSize = Number(process.argv[4] ?? "500");
  const rounds = Number(process.argv[5] ?? "3");

  const pos = makeRows(positiveSize, "pos");
  const negUnl = makeRows(Math.max(1, unlabeledSize - positiveSize), "neg");
  const unlabeled = [...pos, ...negUnl];
  const testRows = [
    ...makeRows(Math.floor(testSize / 2), "pos").map((text) => ({ label: "pos", text })),
    ...makeRows(Math.ceil(testSize / 2), "neg").map((text) => ({ label: "neg", text })),
  ];

  const native = runNative(pos, unlabeled, testRows, rounds);
  const python = runPython(pos, unlabeled, testRows);
  console.log(
    JSON.stringify(
      {
        positive_size: pos.length,
        unlabeled_size: unlabeled.length,
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
