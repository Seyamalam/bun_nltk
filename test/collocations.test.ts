import { expect, test } from "bun:test";
import { BigramAssocMeasures, BigramCollocationFinder } from "../index";

const SENT = ["this", "this", "is", "is", "a", "a", "test", "test"] as const;

function expectClose(actual: number, expected: number, digits = 12) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(10 ** -digits);
}

test("BigramCollocationFinder.fromWords reproduces the NLTK window_size=2 sample", () => {
  const finder = BigramCollocationFinder.fromWords(SENT);

  expect(finder.wordFd.mostCommon()).toEqual([
    ["this", 2],
    ["is", 2],
    ["a", 2],
    ["test", 2],
  ]);
  expect(finder.ngramFd.mostCommon()).toEqual([
    [["this", "this"], 1],
    [["this", "is"], 1],
    [["is", "is"], 1],
    [["is", "a"], 1],
    [["a", "a"], 1],
    [["a", "test"], 1],
    [["test", "test"], 1],
  ]);

  const scored = finder.scoreNgrams(BigramAssocMeasures.pmi);
  expect(scored).toHaveLength(7);
  for (const [, score] of scored) {
    expectClose(score, 1.0);
  }
});

test("BigramCollocationFinder reproduces the NLTK window_size=3 PMI sample", () => {
  const finder = BigramCollocationFinder.fromWords(SENT, 3);

  expect(finder.ngramFd.get(["this", "is"])).toBe(3);
  expect(finder.ngramFd.get(["is", "a"])).toBe(3);
  expect(finder.ngramFd.get(["a", "test"])).toBe(3);
  expect(finder.ngramFd.get(["this", "this"])).toBe(1);

  const scores = new Map(
    finder.scoreNgrams(BigramAssocMeasures.pmi).map(([ngram, score]) => [ngram.join(" "), score]),
  );
  expectClose(scores.get("this is")!, 1.584962500721156);
  expectClose(scores.get("is a")!, 1.584962500721156);
  expectClose(scores.get("a test")!, 1.584962500721156);
  expectClose(scores.get("this this")!, 0);
});

test("BigramCollocationFinder reproduces the NLTK window_size=5 PMI sample", () => {
  const finder = BigramCollocationFinder.fromWords(SENT, 5);

  expect(finder.ngramFd.get(["this", "is"])).toBe(4);
  expect(finder.ngramFd.get(["this", "a"])).toBe(3);
  expect(finder.ngramFd.get(["is", "test"])).toBe(3);

  const scores = new Map(
    finder.scoreNgrams(BigramAssocMeasures.pmi).map(([ngram, score]) => [ngram.join(" "), score]),
  );
  expectClose(scores.get("this is")!, 1.0);
  expectClose(scores.get("this a")!, 0.5849625007211562);
  expectClose(scores.get("is test")!, 0.5849625007211562);
  expectClose(scores.get("this this")!, -1.0);
});

test("BigramAssocMeasures exposes core association formulas", () => {
  expectClose(BigramAssocMeasures.raw_freq(4, [5, 7], 20), 0.2);
  expectClose(BigramAssocMeasures.dice(4, [5, 7], 20), 2 / 3);
  expect(BigramAssocMeasures.chi_sq(20, [42, 20], 14_307_668)).toBeGreaterThan(0);
  expect(BigramAssocMeasures.likelihood_ratio(20, [42, 20], 14_307_668)).toBeGreaterThan(0);
});

test("BigramCollocationFinder filters and nbest mirror the NLTK-style workflow", () => {
  const finder = BigramCollocationFinder.fromWords(
    ["new", "york", "city", "new", "york", "state", "new", "york", "city"],
    2,
  );
  finder.applyFreqFilter(2);
  finder.applyWordFilter((word) => word === "state");

  expect(finder.nbest(BigramAssocMeasures.raw_freq, 3)).toEqual([
    ["new", "york"],
    ["york", "city"],
  ]);
  expect([...finder.aboveScore(BigramAssocMeasures.raw_freq, 0.1)]).toEqual([
    ["new", "york"],
    ["york", "city"],
  ]);
});

test("BigramCollocationFinder.fromDocuments and fromTextAscii preserve document boundaries", () => {
  const fromDocuments = BigramCollocationFinder.fromDocuments([
    ["alpha", "beta"],
    ["beta", "gamma"],
  ]);
  expect(fromDocuments.ngramFd.get(["alpha", "beta"])).toBe(1);
  expect(fromDocuments.ngramFd.get(["beta", "gamma"])).toBe(1);
  expect(fromDocuments.ngramFd.get(["beta", "beta"])).toBe(0);

  const fromText = BigramCollocationFinder.fromTextAscii("This is a test. This is only a test.", { windowSize: 2 });
  expect(fromText.wordFd.mostCommon()).toEqual(
    BigramCollocationFinder.fromWords(["this", "is", "a", "test", "this", "is", "only", "a", "test"]).wordFd.mostCommon(),
  );
  expect(fromText.ngramFd.get(["this", "is"])).toBe(2);
  expectClose(fromText.scoreNgram(BigramAssocMeasures.raw_freq, "this", "is")!, 2 / 9);
  expectClose(fromText.scoreNgram(BigramAssocMeasures.raw_freq, "a", "test")!, 2 / 9);
});
