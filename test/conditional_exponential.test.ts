import { expect, test } from "bun:test";
import { resolve } from "node:path";
import {
  loadConditionalExponentialTextClassifier,
  trainConditionalExponentialTextClassifier,
  type ConditionalExponentialExample,
} from "../index";

const trainRows: ConditionalExponentialExample[] = [
  { label: "pos", text: "excellent amazing great product happy joy" },
  { label: "pos", text: "good wonderful fast happy smooth" },
  { label: "neg", text: "awful bad terrible product sad hate" },
  { label: "neg", text: "slow broken painful angry bad" },
  { label: "pos", text: "great smooth support love" },
  { label: "neg", text: "broken slow support hate" },
];

const testRows: ConditionalExponentialExample[] = [
  { label: "pos", text: "great happy smooth excellent" },
  { label: "neg", text: "bad broken terrible slow" },
  { label: "pos", text: "wonderful joy good fast" },
  { label: "neg", text: "awful hate angry painful" },
];

test("conditional exponential classifier trains and predicts", () => {
  const clf = trainConditionalExponentialTextClassifier(trainRows, { epochs: 14, learningRate: 0.2, l2: 1e-4, maxFeatures: 4096 });
  expect(clf.classify("amazing happy good")).toBe("pos");
  expect(clf.classify("terrible bad hate")).toBe("neg");
  expect(clf.evaluate(testRows).accuracy).toBeGreaterThanOrEqual(0.75);
});

test("conditional exponential classifier serializes and reloads", () => {
  const clf = trainConditionalExponentialTextClassifier(trainRows, { epochs: 12, learningRate: 0.2, l2: 1e-4, maxFeatures: 4096 });
  const restored = loadConditionalExponentialTextClassifier(clf.toJSON());
  expect(restored.classify("excellent smooth great")).toBe(clf.classify("excellent smooth great"));
  expect(restored.classify("bad painful broken")).toBe(clf.classify("bad painful broken"));
});

test("conditional exponential parity with python nltk baseline", () => {
  const clf = trainConditionalExponentialTextClassifier(trainRows, { epochs: 14, learningRate: 0.2, l2: 1e-4, maxFeatures: 4096 });
  const jsPred = testRows.map((row) => clf.classify(row.text));
  const payload = JSON.stringify({
    train: trainRows,
    test: testRows,
    max_iter: 14,
  });
  const proc = Bun.spawnSync(["python", "bench/python_condexp_baseline.py", "--payload", payload], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as { predictions: string[]; accuracy: number };
  const agreement =
    jsPred.length === py.predictions.length
      ? jsPred.filter((label, idx) => label === py.predictions[idx]!).length / jsPred.length
      : 0;
  const jsAcc = clf.evaluate(testRows).accuracy;
  expect(jsAcc).toBeGreaterThanOrEqual(0.75);
  expect(py.accuracy).toBeGreaterThanOrEqual(0.75);
  expect(agreement).toBeGreaterThanOrEqual(0.75);
});
