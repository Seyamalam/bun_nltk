import { expect, test } from "bun:test";
import {
  BigramAssocMeasures,
  BigramCollocationFinder,
  QuadgramAssocMeasures,
  QuadgramCollocationFinder,
  TrigramAssocMeasures,
  TrigramCollocationFinder,
} from "../index";

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

test("TrigramCollocationFinder matches the NLTK documentation workflow", () => {
  const tokens = ["I", "do", "not", "like", "green", "eggs", "and", "ham", ",", "I", "do", "not", "like", "them", "Sam", "I", "am", "!"];
  const finder = TrigramCollocationFinder.fromWords(tokens);
  const sortNgrams = <T>(rows: T[][]) => [...rows].sort((left, right) => left.join(" ").localeCompare(right.join(" ")));

  expect(finder.scoreNgrams(TrigramAssocMeasures.raw_freq).map(([ngram]) => ngram)).toHaveLength(14);
  expect(sortNgrams(finder.nbest(TrigramAssocMeasures.raw_freq, 2))).toEqual(sortNgrams([
    ["I", "do", "not"],
    ["do", "not", "like"],
  ]));

  const wide = TrigramCollocationFinder.fromWords(tokens, 4);
  expect(sortNgrams(wide.nbest(TrigramAssocMeasures.raw_freq, 4))).toEqual(sortNgrams([
    ["I", "do", "like"],
    ["I", "do", "not"],
    ["I", "not", "like"],
    ["do", "not", "like"],
  ]));

  finder.applyWordFilter((word) => word === "I" || word === "me");
  expect(finder.scoreNgrams(TrigramAssocMeasures.raw_freq)).toHaveLength(8);
  expect(sortNgrams([...finder.aboveScore(TrigramAssocMeasures.raw_freq, 1 / (tokens.length - 2))])).toEqual([["do", "not", "like"]]);
});

test("QuadgramCollocationFinder exposes contiguous fourgram candidates and ranking", () => {
  const tokens = ["I", "do", "not", "like", "green", "eggs", "and", "ham", ",", "I", "do", "not", "like", "them", "Sam", "I", "am", "!"];
  const finder = QuadgramCollocationFinder.fromWords(tokens);

  expect(finder.scoreNgrams(QuadgramAssocMeasures.raw_freq)).toHaveLength(14);
  expect(finder.scoreNgram(QuadgramAssocMeasures.raw_freq, "I", "do", "not", "like")).toBeGreaterThan(0);

  finder.applyWordFilter((word) => word === "!");
  expect(finder.scoreNgrams(QuadgramAssocMeasures.raw_freq).every(([ngram]) => !ngram.includes("!"))).toBeTrue();
});

test("TrigramAssocMeasures reproduces NLTK contingency examples", () => {
  expect(TrigramAssocMeasures._contingency(1, [1, 1, 1], [1, 73, 1], 2000)).toEqual([1, 0, 0, 0, 0, 72, 0, 1927]);
  expect(TrigramAssocMeasures._marginals(1, 0, 0, 0, 0, 72, 0, 1927)).toEqual([1, [1, 1, 1], [1, 73, 1], 2000]);
});

test("TrigramCollocationFinder builds counts and scores trigrams", () => {
  const finder = TrigramCollocationFinder.fromWords(SENT);
  expect(finder.wordFd.mostCommon()).toEqual([
    ["this", 2],
    ["is", 2],
    ["a", 2],
    ["test", 2],
  ]);
  expect(finder.ngramFd.mostCommon()).toEqual([
    [["this", "this", "is"], 1],
    [["this", "is", "is"], 1],
    [["is", "is", "a"], 1],
    [["is", "a", "a"], 1],
    [["a", "a", "test"], 1],
    [["a", "test", "test"], 1],
  ]);
  expectClose(finder.scoreNgram(TrigramAssocMeasures.pmi, "this", "this", "is")!, 3);
  expectClose(finder.scoreNgram(TrigramAssocMeasures.raw_freq, "a", "a", "test")!, 1 / 8);
});

test("QuadgramAssocMeasures reproduces NLTK marginal example", () => {
  expect(
    QuadgramAssocMeasures._marginals(1, 0, 2, 46, 552, 825, 2577, 34967, 1, 0, 2, 48, 7250, 9031, 28585, 356653),
  ).toEqual([
    1,
    [2, 553, 3, 1],
    [7804, 6, 3132, 1378, 49, 2],
    [38970, 17660, 100, 38970],
    440540,
  ]);
});

test("QuadgramCollocationFinder builds counts and scores quadgrams", () => {
  const finder = QuadgramCollocationFinder.fromWords(SENT);
  expect(finder.wordFd.mostCommon()).toEqual([
    ["this", 2],
    ["is", 2],
    ["a", 2],
    ["test", 2],
  ]);
  expect(finder.ngramFd.mostCommon()).toEqual([
    [["this", "this", "is", "is"], 1],
    [["this", "is", "is", "a"], 1],
    [["is", "is", "a", "a"], 1],
    [["is", "a", "a", "test"], 1],
    [["a", "a", "test", "test"], 1],
  ]);
  expectClose(finder.scoreNgram(QuadgramAssocMeasures.pmi, "this", "this", "is", "is")!, 5);
  expectClose(finder.scoreNgram(QuadgramAssocMeasures.raw_freq, "a", "a", "test", "test")!, 1 / 8);
});
