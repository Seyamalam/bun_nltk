import { expect, test } from "bun:test";
import { corpusBleu, sentenceBleu, SmoothingFunction } from "../index";

const REF1 = "It is a guide to action that ensures that the military will forever heed Party commands".split(" ");
const REF2 = "It is the guiding principle which guarantees the military forces always being under the command of the Party".split(" ");
const REF3 = "It is the practical guide for the army always to heed the directions of the party".split(" ");
const HYP1 = "It is a guide to action which ensures that the military always obeys the commands of the party".split(" ");
const HYP2 = "It is to insure the troops forever hearing the activity guidebook that party direct".split(" ");
const REFS = [REF1, REF2, REF3];

// Oracle values below are pinned against Python NLTK 3.10.3.

test("sentenceBleu matches NLTK doctest values", () => {
  expect(sentenceBleu(REFS, HYP1)).toBeCloseTo(0.5045666840058485, 12);
  const zero = sentenceBleu(REFS, HYP2);
  expect(zero).toBeGreaterThan(0);
  expect(zero).toBeLessThan(1e-100);
});

test("sentenceBleu no unigram overlap returns exactly 0", () => {
  expect(sentenceBleu([["x", "y", "z"]], ["a", "b"])).toBe(0);
  expect(sentenceBleu(REFS, [])).toBe(0);
});

test("SmoothingFunction methods match NLTK oracle values", () => {
  const chen = new SmoothingFunction();
  expect(sentenceBleu(REFS, HYP2, undefined, chen.method0)).toBeLessThan(1e-100);
  expect(sentenceBleu(REFS, HYP2, undefined, chen.method1)).toBeCloseTo(0.03703131191121491, 12);
  expect(sentenceBleu(REFS, HYP2, undefined, chen.method2)).toBeCloseTo(0.13111209575157431, 12);
  expect(sentenceBleu(REFS, HYP2, undefined, chen.method3)).toBeCloseTo(0.06963003305718092, 12);
  expect(sentenceBleu(REFS, HYP2, undefined, chen.method4)).toBeCloseTo(0.050586660655564, 12);
  expect(sentenceBleu(REFS, HYP2, undefined, chen.method5)).toBeCloseTo(0.13294741324283815, 12);
  expect(sentenceBleu(REFS, HYP2, undefined, chen.method7)).toBeCloseTo(0.14758356058214836, 12);
});

test("SmoothingFunction method6 requires nonzero bigram precision", () => {
  const chen = new SmoothingFunction();
  expect(() => sentenceBleu(REFS, HYP2, undefined, chen.method6)).toThrow(
    "This smoothing method requires non-zero precision for bigrams.",
  );
  expect(sentenceBleu(REFS, HYP1, undefined, chen.method6)).toBeCloseTo(0.5035485336373917, 12);
});

test("SmoothingFunction doctest block matches NLTK", () => {
  const ref = ["It is a guide to action that ensures that the military will forever heed Party commands".split(" ")];
  const hyp = "It is a guide to action which ensures that the military always obeys the commands of the party".split(" ");
  const chen = new SmoothingFunction();
  expect(sentenceBleu(ref, hyp, undefined, chen.method0)).toBeCloseTo(0.4118, 3);
  expect(sentenceBleu(ref, hyp, undefined, chen.method1)).toBeCloseTo(0.4118, 3);
  expect(sentenceBleu(ref, hyp, undefined, chen.method2)).toBeCloseTo(0.4452, 3);
  expect(sentenceBleu(ref, hyp, undefined, chen.method3)).toBeCloseTo(0.4118, 3);
  expect(sentenceBleu(ref, hyp, undefined, chen.method4)).toBeCloseTo(0.4118, 3);
  expect(sentenceBleu(ref, hyp, undefined, chen.method5)).toBeCloseTo(0.4905, 3);
  expect(sentenceBleu(ref, hyp, undefined, chen.method6)).toBeCloseTo(0.4135, 3);
  expect(sentenceBleu(ref, hyp, undefined, chen.method7)).toBeCloseTo(0.4905, 3);
});

test("custom and multiple weight tuples match NLTK", () => {
  expect(sentenceBleu(REFS, HYP1, [0.2, 0.2, 0.2, 0.2, 0.2])).toBeCloseTo(0.39202634084155785, 12);
  const multi = sentenceBleu(REFS, HYP1, [[0.5, 0.5], [1 / 3, 1 / 3, 1 / 3], [0.25, 0.25, 0.25, 0.25]]);
  expect(multi[0]).toBeCloseTo(0.7453559924999299, 12);
  expect(multi[1]).toBeCloseTo(0.6240726989348756, 12);
  expect(multi[2]).toBeCloseTo(0.5045666840058485, 12);
  expect(sentenceBleu(REFS, HYP1, [[0.25, 0.25, 0.25, 0.25]])).toBeCloseTo(0.5045666840058485, 12);
});

test("corpusBleu matches NLTK oracle values", () => {
  const chen = new SmoothingFunction();
  expect(corpusBleu([REFS, REFS], [HYP1, HYP2])).toBeCloseTo(0.3043537261305561, 12);
  expect(corpusBleu([REFS, REFS], [HYP1, HYP2], undefined, chen.method1)).toBeCloseTo(0.3043537261305561, 12);
  const multi = corpusBleu([REFS], [HYP1], [[0.5, 0.5], [0.25, 0.25, 0.25, 0.25]]);
  expect(multi[0]).toBeCloseTo(0.7453559924999299, 12);
  expect(multi[1]).toBeCloseTo(0.5045666840058485, 12);
});

test("auto_reweigh applies only to the default weight tuple on short corpora", () => {
  expect(sentenceBleu([["a", "b", "c"]], ["a", "b"], undefined, undefined, true)).toBeCloseTo(0.6065306597126334, 12);
  expect(sentenceBleu([["a", "b", "c"]], ["a", "b"])).toBeLessThan(1e-100);
  expect(sentenceBleu([["a", "b", "c"]], ["a", "b"], [0.4, 0.3, 0.2, 0.1], undefined, true)).toBeLessThan(1e-90);
});
