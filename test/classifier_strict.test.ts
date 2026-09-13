import { NaiveBayesClassifier, MaxentClassifier } from "../src/classifier_compat";
import { expect, test } from "bun:test";
import { trainNaiveBayesTextClassifier, loadNaiveBayesTextClassifier } from "../src/classify";
import { trainMaxEntTextClassifier, loadMaxEntTextClassifier } from "../src/maxent";
import {
  ConditionalExponentialTextClassifier,
  trainConditionalExponentialTextClassifier,
} from "../src/conditional_exponential";
const rows = [
  { label: "A", text: "good good good" },
  { label: "B", text: "bad" },
];
test("NLTK Naive Bayes treats token counts as categorical values and ignores unseen features", () => {
  const model = trainNaiveBayesTextClassifier(rows);
  expect(model.classify("good")).toBe("B");
  expect(model.classify("unknown")).toBe("B");
  expect(model.classify("good good good")).toBe("A");
  const scores = model.predict("good good good");
  expect(2 ** scores.find((x) => x.label === "A")!.logProb).toBeCloseTo(0.75, 12);
});
test("NLTK IIS encoding distinguishes count values and has no implicit bias", () => {
  const model = trainMaxEntTextClassifier(rows, { epochs: 4 });
  expect(model.classify("good")).toBe("B");
  expect(model.predict("good").every((x) => x.probability === 0.5)).toBe(true);
  expect(model.predict("").every((x) => x.probability === 0.5)).toBe(true);
  expect(model.predict("good good good").find((x) => x.label === "A")!.probability).toBeCloseTo(0.8, 10);
});

test("legacy multinomial NB and SGD MaxEnt models still round-trip", () => {
  const nb = trainNaiveBayesTextClassifier(rows, { model: "multinomial" });
  const me = trainMaxEntTextClassifier(rows, { algorithm: "sgd", epochs: 4 });
  expect(nb.toJSON().version).toBe(1);
  expect(me.toJSON().version).toBe(1);
  expect(loadNaiveBayesTextClassifier(nb.toJSON()).predict("good")).toEqual(nb.predict("good"));
  expect(loadMaxEntTextClassifier(me.toJSON()).predict("good")).toEqual(me.predict("good"));
});
test("IIS learns long documents without overflowing feature updates", () => {
  const text = Array.from({ length: 1100 }, (_, i) => `word${i}`).join(" ");
  const model = trainMaxEntTextClassifier([{ label: "A", text }, { label: "B", text: "other" }], {
    epochs: 4,
  });
  const payload = model.toJSON();
  expect(payload.version).toBe(2);
  expect(payload.weights.flat().every(Number.isFinite)).toBe(true);
  for (const query of [text, "other", "unknown"]) {
    const predictions = model.predict(query);
    expect(predictions.every((row) => Number.isFinite(row.probability))).toBe(true);
    expect(predictions.reduce((sum, row) => sum + row.probability, 0)).toBeCloseTo(1, 12);
  }
  expect(model.predict(text).find((row) => row.label === "A")!.probability).toBeCloseTo(0.8, 10);
  expect(loadMaxEntTextClassifier(payload).predict(text)).toEqual(model.predict(text));
});
test("MaxEnt wrappers accept explicit SGD training and honor its options", () => {
  const options = { algorithm: "sgd", epochs: 4, learningRate: 0.03 } as const;
  const expected = trainMaxEntTextClassifier(rows, options);
  const conditional = new ConditionalExponentialTextClassifier({ algorithm: "sgd", epochs: 4, learningRate: 0.03 }).train(rows);
  const trained = trainConditionalExponentialTextClassifier(rows, { algorithm: "sgd", epochs: 4, learningRate: 0.03 });
  expect(conditional.toJSON().maxent.version).toBe(1);
  expect(conditional.predict("good")).toEqual(expected.predict("good"));
  expect(trained.predict("good")).toEqual(expected.predict("good"));

  const wrapper = MaxentClassifier.train([[{ mood: "good" }, "A"], [{ mood: "bad" }, "B"]], {
    algorithm: "sgd", epochs: 4, learningRate: 0.03,
  });
  const textModel = trainMaxEntTextClassifier([
    { label: "A", text: "feature mood value good" },
    { label: "B", text: "feature mood value bad" },
  ], options);
  for (const prediction of textModel.predict("feature mood value good")) {
    expect(wrapper.probClassify({ mood: "good" }).prob(prediction.label)).toBeCloseTo(prediction.probability, 12);
  }
});
test("feature-wrapper probabilities respect each NB model logarithm base", () => {
  for (const kind of ["categorical", "multinomial"] as const) {
    const nb = trainNaiveBayesTextClassifier([...rows, rows[0]!], { model: kind });
    const wrapper = new NaiveBayesClassifier(nb);
    const scores = nb.predict("");
    const weights = scores.map((row) => nb.logBase ** row.logProb),
      sum = weights.reduce((a, b) => a + b, 0);
    scores.forEach((row, i) =>
      expect(wrapper.probClassify({}).prob(row.label)).toBeCloseTo(weights[i]! / sum, 12),
    );
  }
});
