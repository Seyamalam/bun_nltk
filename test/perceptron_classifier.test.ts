import { expect, test } from "bun:test";
import { loadPerceptronTextClassifier, trainPerceptronTextClassifier, type PerceptronExample } from "../index";

const trainRows: PerceptronExample[] = [
  { label: "pos", text: "excellent amazing great product happy joy" },
  { label: "pos", text: "good wonderful fast happy smooth" },
  { label: "neg", text: "awful bad terrible product sad hate" },
  { label: "neg", text: "slow broken painful angry bad" },
];

const testRows: PerceptronExample[] = [
  { label: "pos", text: "great happy smooth excellent" },
  { label: "neg", text: "bad broken terrible slow" },
  { label: "pos", text: "wonderful joy good fast" },
  { label: "neg", text: "awful hate angry painful" },
];

test("perceptron classifier trains and predicts", () => {
  const clf = trainPerceptronTextClassifier(trainRows, { epochs: 20, averaged: true });
  expect(clf.classify("amazing happy good")).toBe("pos");
  expect(clf.classify("terrible bad hate")).toBe("neg");
  const evalOut = clf.evaluate(testRows);
  expect(evalOut.accuracy).toBeGreaterThanOrEqual(0.75);
});

test("perceptron classifier serializes and reloads", () => {
  const clf = trainPerceptronTextClassifier(trainRows, { epochs: 16, averaged: true });
  const reloaded = loadPerceptronTextClassifier(clf.toJSON());
  expect(reloaded.classify("excellent smooth great")).toBe(clf.classify("excellent smooth great"));
  expect(reloaded.classify("bad painful broken")).toBe(clf.classify("bad painful broken"));
});
