import { expect, test } from "bun:test";
import { loadPositiveNaiveBayesTextClassifier, trainPositiveNaiveBayesTextClassifier } from "../index";

const positiveTrain = [
  "excellent amazing great product happy joy",
  "good wonderful fast happy smooth",
  "great smooth support love",
  "joyful excellent quality",
];

const unlabeledTrain = [
  ...positiveTrain,
  "awful bad terrible product sad hate",
  "slow broken painful angry bad",
  "refund delay broken support",
  "hate angry failure",
];

const evalRows = [
  { label: "pos", text: "great happy smooth excellent" },
  { label: "neg", text: "bad broken terrible slow" },
  { label: "pos", text: "wonderful joy good fast" },
  { label: "neg", text: "awful hate angry painful" },
];

test("positive naive bayes trains and predicts", () => {
  const clf = trainPositiveNaiveBayesTextClassifier(positiveTrain, unlabeledTrain, {
    positivePrior: 0.5,
    positiveLabel: "pos",
    negativeLabel: "neg",
  });
  expect(clf.classify("great happy good")).toBe("pos");
  expect(clf.classify("awful bad hate")).toBe("neg");
  expect(clf.evaluate(evalRows).accuracy).toBeGreaterThanOrEqual(0.75);
});

test("positive naive bayes serializes and reloads", () => {
  const clf = trainPositiveNaiveBayesTextClassifier(positiveTrain, unlabeledTrain, {
    positivePrior: 0.5,
    positiveLabel: "pos",
    negativeLabel: "neg",
  });
  const restored = loadPositiveNaiveBayesTextClassifier(clf.toJSON());
  expect(restored.classify("excellent smooth great")).toBe(clf.classify("excellent smooth great"));
  expect(restored.classify("bad painful broken")).toBe(clf.classify("bad painful broken"));
});
