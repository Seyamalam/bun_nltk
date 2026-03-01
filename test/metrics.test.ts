import { expect, test } from "bun:test";
import { confusionMatrix, corpusBleu, editDistance, sentenceBleu } from "../index";

test("editDistance supports substitutions and transpositions", () => {
  expect(editDistance("kitten", "sitting")).toBe(3);
  expect(editDistance("ab", "ba", { transpositions: true })).toBe(1);
  expect(editDistance("ab", "ba", { transpositions: false })).toBe(2);
});

test("sentenceBleu and corpusBleu return bounded scores", () => {
  const refs = [["the", "cat", "is", "on", "the", "mat"], ["there", "is", "a", "cat", "on", "the", "mat"]];
  const hyp = ["the", "cat", "is", "on", "the", "mat"];
  const s = sentenceBleu(refs, hyp);
  expect(s).toBeGreaterThan(0.9);
  expect(s).toBeLessThanOrEqual(1);

  const c = corpusBleu([refs], [hyp]);
  expect(c).toBeGreaterThan(0.9);
  expect(c).toBeLessThanOrEqual(1);
});

test("confusionMatrix computes labels, matrix, and accuracy", () => {
  const row = confusionMatrix(["pos", "neg", "pos"], ["pos", "pos", "pos"]);
  expect(row.labels).toEqual(["neg", "pos"]);
  expect(row.matrix).toEqual([
    [0, 1],
    [0, 2],
  ]);
  expect(row.accuracy).toBeCloseTo(2 / 3, 6);
});

