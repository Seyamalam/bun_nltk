import { expect, test } from "bun:test";
import {
  DecisionTreeClassifier,
  MaxentClassifier,
  NaiveBayesClassifier,
  PositiveNaiveBayesClassifier,
} from "../index";

const labeled = [
  [{ good: true, fun: true, score: 9 }, "pos"],
  [{ good: true, bright: true, score: 8 }, "pos"],
  [{ bad: true, dull: true, score: 1 }, "neg"],
  [{ bad: true, dark: true, score: 2 }, "neg"],
] as const;

test("NaiveBayesClassifier supports feature-dict training and probability output", () => {
  const classifier = NaiveBayesClassifier.train(labeled);
  expect(classifier.classify({ good: true, fun: true, score: 10 })).toBe("pos");
  expect(classifier.classify({ bad: true, dark: true, score: 0 })).toBe("neg");

  const pdist = classifier.probClassify({ good: true, bright: true, score: 7 });
  expect(pdist.max()).toBe("pos");
  expectCloseToOne(pdist.prob("pos") + pdist.prob("neg"));
});

test("DecisionTreeClassifier supports feature-dict compatibility workflow", () => {
  const classifier = DecisionTreeClassifier.train(labeled, { maxDepth: 4 });
  expect(classifier.classify({ good: true, score: 9 })).toBe("pos");
  expect(classifier.classifyMany([{ bad: true, score: 1 }, { bright: true, score: 8 }])).toEqual(["neg", "pos"]);
});

test("MaxentClassifier exposes NLTK-style classify/probClassify methods", () => {
  const classifier = MaxentClassifier.train(labeled, { epochs: 20, learningRate: 0.2, maxFeatures: 200 });
  const pdist = classifier.probClassify({ good: true, fun: true, score: 9 });
  expect(pdist.max()).toBe("pos");
  expectCloseToOne(pdist.prob("pos") + pdist.prob("neg"));
  expect(classifier.labels()).toEqual(["neg", "pos"]);
});

test("PositiveNaiveBayesClassifier trains from positive and unlabeled feature sets", () => {
  const classifier = PositiveNaiveBayesClassifier.train(
    [
      { sunny: true, warm: true },
      { sunny: true, bright: true },
    ],
    [
      { rainy: true, cold: true },
      { sunny: true, warm: true },
      { cloudy: true, mild: true },
    ],
    { positiveLabel: "weather_pos", negativeLabel: "weather_neg", positivePrior: 0.4 },
  );

  const pdist = classifier.probClassify({ sunny: true, warm: true });
  expect(pdist.max()).toBe("weather_pos");
  expect(classifier.labels()).toEqual(["weather_pos", "weather_neg"]);
  expectCloseToOne(pdist.prob("weather_pos") + pdist.prob("weather_neg"));
});

function expectCloseToOne(value: number) {
  expect(Math.abs(value - 1)).toBeLessThanOrEqual(1e-9);
}
