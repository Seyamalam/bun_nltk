import {
  trainLinearSvmTextClassifier,
  trainLogisticTextClassifier,
  type LinearModelExample,
} from "../index";

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function generateDataset(trainSize = 6000, testSize = 1200): { train: LinearModelExample[]; test: LinearModelExample[] } {
  const labels = ["alpha", "beta", "gamma", "delta"] as const;
  const perLabelLex = labels.map((name, labelIdx) =>
    Array.from({ length: 300 }, (_, i) => `${name}_tok_${labelIdx}_${i}`),
  );
  const shared = Array.from({ length: 600 }, (_, i) => `shared_tok_${i}`);
  const row = (label: (typeof labels)[number], i: number): LinearModelExample => {
    const lid = labels.indexOf(label);
    const own = perLabelLex[lid]!;
    const tok: string[] = [];
    for (let k = 0; k < 10; k += 1) tok.push(own[(i * (k + 3) + k * 17) % own.length]!);
    for (let k = 0; k < 4; k += 1) tok.push(shared[(i * (k + 5) + k * 29) % shared.length]!);
    return { label, text: tok.join(" ") };
  };
  const train: LinearModelExample[] = [];
  const test: LinearModelExample[] = [];
  for (let i = 0; i < trainSize; i += 1) train.push(row(labels[i % labels.length]!, i));
  for (let i = 0; i < testSize; i += 1) test.push(row(labels[i % labels.length]!, i + trainSize));
  return { train, test };
}

function benchLogistic(train: LinearModelExample[], test: LinearModelExample[], rounds: number, native: boolean) {
  const times: number[] = [];
  let accuracy = 0;
  for (let i = 0; i < rounds; i += 1) {
    const started = performance.now();
    const model = trainLogisticTextClassifier(train, {
      epochs: 16,
      learningRate: 0.1,
      l2: 1e-4,
      maxFeatures: 12000,
      useNativeScoring: native,
    });
    accuracy = model.evaluate(test).accuracy;
    times.push((performance.now() - started) / 1000);
  }
  return { median_seconds: median(times), accuracy };
}

function benchSvm(train: LinearModelExample[], test: LinearModelExample[], rounds: number, native: boolean) {
  const times: number[] = [];
  let accuracy = 0;
  for (let i = 0; i < rounds; i += 1) {
    const started = performance.now();
    const model = trainLinearSvmTextClassifier(train, {
      epochs: 16,
      learningRate: 0.06,
      l2: 3e-4,
      margin: 1,
      maxFeatures: 12000,
      useNativeScoring: native,
    });
    accuracy = model.evaluate(test).accuracy;
    times.push((performance.now() - started) / 1000);
  }
  return { median_seconds: median(times), accuracy };
}

function main() {
  const trainSize = Number(process.argv[2] ?? "6000");
  const testSize = Number(process.argv[3] ?? "1200");
  const rounds = Number(process.argv[4] ?? "3");
  const { train, test } = generateDataset(trainSize, testSize);

  const logNative = benchLogistic(train, test, rounds, true);
  const logJs = benchLogistic(train, test, rounds, false);
  const svmNative = benchSvm(train, test, rounds, true);
  const svmJs = benchSvm(train, test, rounds, false);

  console.log(
    JSON.stringify(
      {
        train_size: train.length,
        test_size: test.length,
        rounds,
        logistic: {
          native_seconds_median: logNative.median_seconds,
          js_seconds_median: logJs.median_seconds,
          speedup_native_vs_js: logJs.median_seconds / logNative.median_seconds,
          native_accuracy: logNative.accuracy,
          js_accuracy: logJs.accuracy,
        },
        svm: {
          native_seconds_median: svmNative.median_seconds,
          js_seconds_median: svmJs.median_seconds,
          speedup_native_vs_js: svmJs.median_seconds / svmNative.median_seconds,
          native_accuracy: svmNative.accuracy,
          js_accuracy: svmJs.accuracy,
        },
      },
      null,
      2,
    ),
  );
}

main();
