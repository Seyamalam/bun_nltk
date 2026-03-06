import { expect, test } from "bun:test";
import {
  addLogs,
  ConditionalFreqDist,
  ConditionalProbDist,
  DictionaryProbDist,
  ELEProbDist,
  entropy,
  FreqDist,
  LaplaceProbDist,
  LidstoneProbDist,
  logLikelihood,
  MLEProbDist,
  SimpleGoodTuringProbDist,
  sumLogs,
  WittenBellProbDist,
} from "../index";

function expectClose(actual: number, expected: number, digits = 12) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(10 ** -digits);
}

test("DictionaryProbDist supports normalization and log space", () => {
  const pdist = new DictionaryProbDist({ a: 2, b: 1 }, false, true);
  expectClose(pdist.prob("a"), 2 / 3);
  expectClose(pdist.prob("b"), 1 / 3);
  expect(pdist.max()).toBe("a");

  const logDist = new DictionaryProbDist(new Map([["x", -2], ["y", -1]]), true, false);
  expectClose(logDist.logprob("y"), -1);
  expectClose(logDist.prob("x"), 0.25);
  expect(logDist.logprob("missing")).toBe(Number.NEGATIVE_INFINITY);
});

test("MLE, Lidstone, Laplace, and ELE distributions match NLTK formulas", () => {
  const fd = new FreqDist("aab");

  const mle = new MLEProbDist(fd);
  expectClose(mle.prob("a"), 2 / 3);
  expect(mle.max()).toBe("a");

  const lidstone = new LidstoneProbDist(fd, 0.5);
  expectClose(lidstone.prob("a"), (2 + 0.5) / (3 + 2 * 0.5));
  expectClose(lidstone.prob("b"), (1 + 0.5) / (3 + 2 * 0.5));
  expectClose(lidstone.discount(), (0.5 * 2) / (3 + 0.5 * 2));

  const laplace = new LaplaceProbDist(fd);
  expectClose(laplace.prob("a"), 3 / 5);
  expectClose(laplace.prob("b"), 2 / 5);

  const ele = new ELEProbDist(fd);
  expectClose(ele.prob("a"), 2.5 / 4);
  expectClose(ele.prob("b"), 1.5 / 4);
});

test("Lidstone family validates bin counts", () => {
  expect(() => new LidstoneProbDist(new FreqDist<string>(), 0.1)).toThrow();
  expect(() => new LaplaceProbDist(new FreqDist("abc"), 2)).toThrow();
});

test("ConditionalProbDist wraps ConditionalFreqDist with factory distributions", () => {
  const cfd = new ConditionalFreqDist<string, string>([
    ["noun", "dog"],
    ["noun", "dog"],
    ["noun", "cat"],
    ["verb", "run"],
  ]);

  const cpdist = new ConditionalProbDist(cfd, ELEProbDist);
  expectClose(cpdist.get("noun").prob("dog"), 2.5 / 4);
  expectClose(cpdist.get("noun").prob("cat"), 1.5 / 4);
  expectClose(cpdist.get("verb").prob("run"), 1);
  expect(cpdist.conditions()).toEqual(["noun", "verb"]);

  const missing = new ConditionalProbDist(cfd, LaplaceProbDist, 4).get("adj");
  expectClose(missing.prob("bright"), 1 / 4);
});

test("WittenBellProbDist allocates leftover mass to unseen bins", () => {
  const fd = new FreqDist("aab");
  const dist = new WittenBellProbDist(fd, 4);

  expectClose(dist.prob("a"), 2 / 5);
  expectClose(dist.prob("b"), 1 / 5);
  expectClose(dist.prob("c"), 1 / 5);
  expectClose(dist.prob("d"), 1 / 5);
});

test("SimpleGoodTuringProbDist keeps a valid discounted distribution", () => {
  const fd = new FreqDist("aaaabbccdef");
  const dist = new SimpleGoodTuringProbDist(fd, fd.B() + 2);
  const unseen = dist.prob("zzz");

  expect(unseen).toBeGreaterThan(0);
  expect(dist.prob("a")).toBeGreaterThan(dist.prob("d"));
  expect(dist.discount()).toBeGreaterThan(0);

  let total = unseen * 2;
  for (const sample of fd.keys()) {
    total += dist.prob(sample);
  }
  expect(Math.abs(total - 1)).toBeLessThanOrEqual(0.15);
});

test("Probability helpers match expected information-theory semantics", () => {
  expectClose(addLogs(-2, -2), -1);
  expectClose(sumLogs([-2, -2]), -1);

  const actual = new DictionaryProbDist({ a: 0.75, b: 0.25 });
  const testDist = new DictionaryProbDist({ a: 0.5, b: 0.5 });
  expectClose(entropy(actual), 0.8112781244591328);
  expectClose(logLikelihood(testDist, actual), -1);
});
