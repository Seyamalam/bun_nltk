import { expect, test } from "bun:test";
import {
  loadLinearSvmTextClassifier,
  loadLogisticTextClassifier,
  trainLinearSvmTextClassifier,
  trainLogisticTextClassifier,
  type LinearModelExample,
} from "../index";

const trainRows: LinearModelExample[] = [
  { label: "pos", text: "fast smooth stable excellent happy" },
  { label: "pos", text: "great reliable strong positive upgrade" },
  { label: "neg", text: "slow broken unstable awful painful" },
  { label: "neg", text: "bad crash error negative delay" },
];

const testRows: LinearModelExample[] = [
  { label: "pos", text: "fast stable reliable" },
  { label: "neg", text: "broken crash delay" },
  { label: "pos", text: "excellent strong happy" },
  { label: "neg", text: "awful unstable slow" },
];

test("logistic classifier trains and predicts", () => {
  const clf = trainLogisticTextClassifier(trainRows, { epochs: 20, learningRate: 0.12, maxFeatures: 1024 });
  const evalOut = clf.evaluate(testRows);
  expect(evalOut.accuracy).toBeGreaterThanOrEqual(0.75);
  expect(clf.classify("fast smooth upgrade")).toBe("pos");
  expect(clf.classify("broken crash error")).toBe("neg");
});

test("logistic classifier serializes and reloads", () => {
  const clf = trainLogisticTextClassifier(trainRows, { epochs: 18, learningRate: 0.1 });
  const loaded = loadLogisticTextClassifier(clf.toJSON());
  expect(loaded.classify("great stable positive")).toBe(clf.classify("great stable positive"));
  expect(loaded.classify("bad unstable crash")).toBe(clf.classify("bad unstable crash"));
});

test("linear svm classifier trains and predicts", () => {
  const clf = trainLinearSvmTextClassifier(trainRows, { epochs: 24, learningRate: 0.08, maxFeatures: 1024 });
  const evalOut = clf.evaluate(testRows);
  expect(evalOut.accuracy).toBeGreaterThanOrEqual(0.75);
  expect(clf.classify("reliable fast strong")).toBe("pos");
  expect(clf.classify("awful delay crash")).toBe("neg");
});

test("linear svm classifier serializes and reloads", () => {
  const clf = trainLinearSvmTextClassifier(trainRows, { epochs: 18, learningRate: 0.07 });
  const loaded = loadLinearSvmTextClassifier(clf.toJSON());
  expect(loaded.classify("stable fast happy")).toBe(clf.classify("stable fast happy"));
  expect(loaded.classify("negative crash slow")).toBe(clf.classify("negative crash slow"));
});

test("native and TypeScript linear trainers produce equivalent models", () => {
  const cases = [
    {
      native: trainLogisticTextClassifier(trainRows, {
        epochs: 12,
        learningRate: 0.1,
        useNativeTraining: true,
      }).toJSON(),
      js: trainLogisticTextClassifier(trainRows, {
        epochs: 12,
        learningRate: 0.1,
        useNativeScoring: false,
        useNativeTraining: false,
      }).toJSON(),
    },
    {
      native: trainLinearSvmTextClassifier(trainRows, {
        epochs: 12,
        learningRate: 0.07,
        useNativeTraining: true,
      }).toJSON(),
      js: trainLinearSvmTextClassifier(trainRows, {
        epochs: 12,
        learningRate: 0.07,
        useNativeScoring: false,
        useNativeTraining: false,
      }).toJSON(),
    },
  ];

  for (const pair of cases) {
    expect(pair.native.labels).toEqual(pair.js.labels);
    expect(pair.native.weights.length).toBe(pair.js.weights.length);
    for (let index = 0; index < pair.native.weights.length; index += 1) {
      expect(pair.native.weights[index]!).toBeCloseTo(pair.js.weights[index]!, 10);
    }
    for (let index = 0; index < pair.native.bias.length; index += 1) {
      expect(pair.native.bias[index]!).toBeCloseTo(pair.js.bias[index]!, 10);
    }
  }
});
