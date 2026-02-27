import { rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { trainMaxEntTextClassifier, type MaxEntExample } from "../index";

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function generateDataset(trainSize = 900, testSize = 250): { train: MaxEntExample[]; test: MaxEntExample[] } {
  const pos = ["good", "great", "excellent", "happy", "smooth", "fast", "love", "amazing"];
  const neg = ["bad", "awful", "terrible", "sad", "broken", "slow", "hate", "angry"];
  const shared = ["product", "service", "support", "quality", "update"];
  const make = (label: "pos" | "neg", i: number): MaxEntExample => {
    const sentiment = label === "pos" ? pos : neg;
    const a = sentiment[i % sentiment.length]!;
    const b = sentiment[(i * 7 + 3) % sentiment.length]!;
    const c = sentiment[(i * 13 + 2) % sentiment.length]!;
    const s = shared[(i * 5 + 1) % shared.length]!;
    return { label, text: `${a} ${b} ${s} ${c} ${label === "pos" ? "joy" : "pain"}` };
  };
  const train: MaxEntExample[] = [];
  const test: MaxEntExample[] = [];
  for (let i = 0; i < trainSize; i += 1) train.push(make(i % 2 === 0 ? "pos" : "neg", i));
  for (let i = 0; i < testSize; i += 1) test.push(make(i % 2 === 0 ? "pos" : "neg", i + trainSize));
  return { train, test };
}

function runNative(train: MaxEntExample[], test: MaxEntExample[], rounds: number) {
  const timings: number[] = [];
  let predictions: string[] = [];
  let accuracy = 0;
  for (let i = 0; i < rounds; i += 1) {
    const started = performance.now();
    const clf = trainMaxEntTextClassifier(train, { epochs: 12, learningRate: 0.2, l2: 1e-4, maxFeatures: 6000 });
    predictions = test.map((row) => clf.classify(row.text));
    accuracy = clf.evaluate(test).accuracy;
    timings.push((performance.now() - started) / 1000);
  }
  return { predictions, accuracy, median_seconds: median(timings) };
}

function runPython(train: MaxEntExample[], test: MaxEntExample[]) {
  const payloadPath = resolve(import.meta.dir, "datasets", "maxent_payload.json");
  writeFileSync(payloadPath, JSON.stringify({ train, test, max_iter: 12 }), "utf8");
  const proc = Bun.spawnSync(["python", "bench/python_maxent_baseline.py", "--payload-file", payloadPath], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  rmSync(payloadPath, { force: true });
  if (proc.exitCode !== 0) throw new Error(`python maxent baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  return JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as {
    predictions: string[];
    accuracy: number;
    total_seconds: number;
  };
}

function main() {
  const trainSize = Number(process.argv[2] ?? "900");
  const testSize = Number(process.argv[3] ?? "250");
  const rounds = Number(process.argv[4] ?? "2");
  const { train, test } = generateDataset(trainSize, testSize);
  const native = runNative(train, test, rounds);
  const python = runPython(train, test);
  const agreement =
    native.predictions.length === python.predictions.length
      ? native.predictions.filter((label, idx) => label === python.predictions[idx]!).length / native.predictions.length
      : 0;

  console.log(
    JSON.stringify(
      {
        train_size: train.length,
        test_size: test.length,
        rounds,
        agreement,
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

