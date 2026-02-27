import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { loadMaxEntTextClassifier, trainMaxEntTextClassifier, type MaxEntExample, type MaxEntSerialized } from "../index";

const trainRows: MaxEntExample[] = [
  { label: "pos", text: "excellent amazing great product happy joy" },
  { label: "pos", text: "good wonderful fast happy smooth" },
  { label: "neg", text: "awful bad terrible product sad hate" },
  { label: "neg", text: "slow broken painful angry bad" },
  { label: "pos", text: "great smooth support love" },
  { label: "neg", text: "broken slow support hate" },
];

const testRows: MaxEntExample[] = [
  { label: "pos", text: "great happy smooth excellent" },
  { label: "neg", text: "bad broken terrible slow" },
  { label: "pos", text: "wonderful joy good fast" },
  { label: "neg", text: "awful hate angry painful" },
];

test("maxent classifier trains and predicts", () => {
  const clf = trainMaxEntTextClassifier(trainRows, { epochs: 14, learningRate: 0.2, l2: 1e-4, maxFeatures: 4096 });
  expect(clf.classify("excellent smooth great")).toBe("pos");
  expect(clf.classify("bad painful broken")).toBe("neg");
  const evalOut = clf.evaluate(testRows);
  expect(evalOut.accuracy).toBeGreaterThanOrEqual(0.75);
});

test("maxent classifier serializes and reloads", () => {
  const clf = trainMaxEntTextClassifier(trainRows, { epochs: 10, learningRate: 0.15, l2: 1e-4, maxFeatures: 4096 });
  const payload = clf.toJSON();
  const reloaded = loadMaxEntTextClassifier(payload);
  expect(reloaded.classify("excellent smooth great")).toBe(clf.classify("excellent smooth great"));
  expect(reloaded.classify("bad painful broken")).toBe(clf.classify("bad painful broken"));
});

test("maxent classifier parity agreement with python nltk maxent", () => {
  const clf = trainMaxEntTextClassifier(trainRows, { epochs: 14, learningRate: 0.2, l2: 1e-4, maxFeatures: 4096 });
  const jsPred = testRows.map((row) => clf.classify(row.text));
  const payload = JSON.stringify({
    train: trainRows,
    test: testRows,
    max_iter: 14,
  });
  const proc = Bun.spawnSync(["python", "bench/python_maxent_baseline.py", "--payload", payload], {
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
  expect(agreement).toBeGreaterThanOrEqual(0.75);
  expect(py.accuracy).toBeGreaterThanOrEqual(0.75);
});

test("maxent load rejects invalid payload lengths", () => {
  const invalid: MaxEntSerialized = {
    version: 1,
    labels: ["a", "b"],
    vocabulary: ["x"],
    weights: [[0]],
    bias: [0, 0],
    options: {
      epochs: 1,
      learningRate: 0.1,
      l2: 0,
      maxFeatures: 100,
    },
  };
  expect(() => loadMaxEntTextClassifier(invalid)).toThrow();
});

