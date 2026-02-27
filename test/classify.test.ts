import { expect, test } from "bun:test";
import { resolve } from "node:path";
import {
  loadNaiveBayesTextClassifier,
  trainNaiveBayesTextClassifier,
  type NaiveBayesExample,
  type NaiveBayesSerialized,
} from "../index";

const trainRows: NaiveBayesExample[] = [
  { label: "pos", text: "excellent amazing great product happy joy" },
  { label: "pos", text: "good wonderful fast happy smooth" },
  { label: "neg", text: "awful bad terrible product sad hate" },
  { label: "neg", text: "slow broken painful angry bad" },
];

const testRows: NaiveBayesExample[] = [
  { label: "pos", text: "great happy smooth excellent" },
  { label: "neg", text: "bad broken terrible slow" },
  { label: "pos", text: "wonderful joy good fast" },
  { label: "neg", text: "awful hate angry painful" },
];

test("naive bayes classifier trains and predicts", () => {
  const clf = trainNaiveBayesTextClassifier(trainRows, { smoothing: 1.0 });
  expect(clf.classify("amazing happy good")).toBe("pos");
  expect(clf.classify("terrible bad hate")).toBe("neg");
  const evalOut = clf.evaluate(testRows);
  expect(evalOut.accuracy).toBeGreaterThanOrEqual(0.75);
});

test("naive bayes classifier serializes and reloads", () => {
  const clf = trainNaiveBayesTextClassifier(trainRows, { smoothing: 0.7 });
  const serialized = clf.toJSON();
  const reloaded = loadNaiveBayesTextClassifier(serialized);
  expect(reloaded.classify("excellent smooth great")).toBe(clf.classify("excellent smooth great"));
  expect(reloaded.classify("bad painful broken")).toBe(clf.classify("bad painful broken"));
});

test("naive bayes classifier parity with python nltk baseline", () => {
  const clf = trainNaiveBayesTextClassifier(trainRows, { smoothing: 1.0 });
  const jsPred = testRows.map((row) => clf.classify(row.text));
  const payload = JSON.stringify({
    train: trainRows,
    test: testRows,
    rounds: 1,
  } satisfies { train: NaiveBayesExample[]; test: NaiveBayesExample[]; rounds: number });

  const proc = Bun.spawnSync(["python", "bench/python_classifier_baseline.py", "--payload", payload], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(proc.stderr));
  }
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as {
    accuracy: number;
    predictions: string[];
  };
  const pyAcc = py.accuracy;
  const jsAcc = clf.evaluate(testRows).accuracy;
  expect(jsAcc).toBeGreaterThanOrEqual(0.75);
  expect(pyAcc).toBeGreaterThanOrEqual(0.75);
  expect(py.predictions).toEqual(jsPred);
});

test("naive bayes load rejects invalid payload lengths", () => {
  const invalid: NaiveBayesSerialized = {
    version: 1,
    smoothing: 1,
    totalDocs: 1,
    labels: ["x"],
    labelDocCounts: [],
    labelTokenTotals: [1],
    vocabulary: [],
    tokenCountsByLabel: [[]],
  };
  expect(() => loadNaiveBayesTextClassifier(invalid)).toThrow();
});

