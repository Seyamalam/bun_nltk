import { expect, test } from "bun:test";
import { trainNgramLanguageModel } from "../src/lm";

// NLTK 3.10.3 KneserNeyInterpolated(3, discount=.75), padded_everygram_pipeline.
test("Kneser-Ney one-token corpus has exact padded continuation probabilities", () => {
  const model = trainNgramLanguageModel([["a"]], {
    order: 3,
    model: "kneser_ney_interpolated",
    discount: 0.75,
  });
  const probes = [
    { word: "a", context: ["<s>", "<s>"] },
    { word: "a", context: ["<s>"] },
    { word: "a", context: [] },
    { word: "unknown", context: [] },
    { word: "unknown", context: ["a"] },
  ];
  const expected = [0.71875, 0.625, 0.25, 0, 0];
  for (const [i, probe] of probes.entries())
    expect(model.score(probe.word, probe.context)).toBeCloseTo(expected[i]!, 12);
  const batch = model.evaluateBatch(probes, ["a"]);
  batch.scores.forEach((score, i) => expect(score).toBeCloseTo(expected[i]!, 12));
});
test("Kneser-Ney lower orders count unique predecessors, not repeated occurrences", () => {
  const model = trainNgramLanguageModel(
    [
      ["a", "b"],
      ["a", "b"],
      ["x", "b"],
    ],
    { order: 3, model: "kneser_ney_interpolated", discount: 0.75 },
  );
  const probe = { word: "b", context: ["a"] };
  expect(model.score(probe.word, probe.context)).toBeCloseTo(0.4642857142857143, 12);
  expect(model.evaluateBatch([probe], ["a", "b"]).scores[0]).toBeCloseTo(0.4642857142857143, 12);
});
