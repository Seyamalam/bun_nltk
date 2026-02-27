import { rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { trainNaiveBayesTextClassifier, type NaiveBayesExample } from "../index";

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function generateDataset(trainSize = 2400, testSize = 600): { train: NaiveBayesExample[]; test: NaiveBayesExample[] } {
  const posLex = ["good", "great", "excellent", "happy", "smooth", "fast", "love", "amazing"];
  const negLex = ["bad", "awful", "terrible", "sad", "broken", "slow", "hate", "angry"];
  const shared = ["product", "service", "support", "quality", "update"];

  const row = (label: "pos" | "neg", i: number): NaiveBayesExample => {
    const sentiment = label === "pos" ? posLex : negLex;
    const a = sentiment[i % sentiment.length]!;
    const b = sentiment[(i * 7 + 3) % sentiment.length]!;
    const c = sentiment[(i * 13 + 2) % sentiment.length]!;
    const s = shared[(i * 5 + 1) % shared.length]!;
    return { label, text: `${a} ${b} ${s} ${c} ${label === "pos" ? "joy" : "pain"}` };
  };

  const train: NaiveBayesExample[] = [];
  const test: NaiveBayesExample[] = [];
  for (let i = 0; i < trainSize; i += 1) train.push(row(i % 2 === 0 ? "pos" : "neg", i));
  for (let i = 0; i < testSize; i += 1) test.push(row(i % 2 === 0 ? "pos" : "neg", i + trainSize));
  return { train, test };
}

function runNative(train: NaiveBayesExample[], test: NaiveBayesExample[], rounds: number) {
  const timings: number[] = [];
  let accuracy = 0;
  let predictions: string[] = [];
  for (let i = 0; i < rounds; i += 1) {
    const started = performance.now();
    const clf = trainNaiveBayesTextClassifier(train, { smoothing: 1.0 });
    const evalOut = clf.evaluate(test);
    predictions = test.map((row) => clf.classify(row.text));
    accuracy = evalOut.accuracy;
    timings.push((performance.now() - started) / 1000);
  }
  return {
    median_seconds: median(timings),
    accuracy,
    predictions,
  };
}

function runPython(train: NaiveBayesExample[], test: NaiveBayesExample[], rounds: number) {
  const payloadPath = resolve(import.meta.dir, "datasets", "classifier_payload.json");
  writeFileSync(payloadPath, JSON.stringify({ train, test, rounds }), "utf8");
  const proc = Bun.spawnSync(["python", "bench/python_classifier_baseline.py", "--payload-file", payloadPath], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  rmSync(payloadPath, { force: true });
  if (proc.exitCode !== 0) {
    throw new Error(`python classifier baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  }
  return JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as {
    accuracy: number;
    predictions: string[];
    total_seconds: number;
  };
}

function main() {
  const trainSize = Number(process.argv[2] ?? "2400");
  const testSize = Number(process.argv[3] ?? "600");
  const rounds = Number(process.argv[4] ?? "4");
  const { train, test } = generateDataset(trainSize, testSize);

  const native = runNative(train, test, rounds);
  const python = runPython(train, test, rounds);
  const predictionsEqual = JSON.stringify(native.predictions) === JSON.stringify(python.predictions);

  console.log(
    JSON.stringify(
      {
        train_size: train.length,
        test_size: test.length,
        rounds,
        parity_predictions: predictionsEqual,
        parity_accuracy_delta: Math.abs(native.accuracy - python.accuracy),
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
