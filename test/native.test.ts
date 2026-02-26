import { expect, test } from "bun:test";
import {
  countNgramsAscii,
  countTokensAscii,
  countUniqueNgramsAscii,
  countUniqueTokensAscii,
  bigramWindowStatsAscii,
  bigramWindowStatsAsciiIds,
  bigramWindowStatsAsciiIdsJs,
  bigramWindowStatsAsciiJs,
  countNgramsAsciiJs,
  countTokensAsciiJs,
  countUniqueNgramsAsciiJs,
  countUniqueTokensAsciiJs,
  ngramsAscii,
  ngramsAsciiNative,
  ngramFreqDistHashAscii,
  ngramFreqDistHashAsciiJs,
  porterStemAscii,
  topPmiBigramsAscii,
  topPmiBigramsAsciiJs,
  tokenFreqDistIdsAscii,
  tokenFreqDistIdsAsciiJs,
  tokenizeAscii,
  tokenizeAsciiNative,
  tokenFreqDistHashAscii,
  tokenFreqDistHashAsciiJs,
} from "../index";

const cases = [
  "this this is is a a test test",
  "My number is 601-984-4813, except it's not.",
  "Emoji test 👨‍👩‍👧‍👧 and accents resumé España München français",
  "Mixed123 CASE and apostrophe words like don't and O'Neill",
];

function expectHashMapsEqual(actual: Map<bigint, number>, expected: Map<bigint, number>) {
  expect(actual.size).toBe(expected.size);
  for (const [key, value] of expected.entries()) {
    expect(actual.get(key)).toBe(value);
  }
}

test("native token and ngram counters match JS reference", () => {
  for (const text of cases) {
    expect(countTokensAscii(text)).toBe(countTokensAsciiJs(text));
    expect(countUniqueTokensAscii(text)).toBe(countUniqueTokensAsciiJs(text));

    for (const n of [1, 2, 3]) {
      expect(countNgramsAscii(text, n)).toBe(countNgramsAsciiJs(text, n));
      expect(countUniqueNgramsAscii(text, n)).toBe(countUniqueNgramsAsciiJs(text, n));
    }
  }
});

test("native hash freqdists match JS reference", () => {
  for (const text of cases) {
    expectHashMapsEqual(tokenFreqDistHashAscii(text), tokenFreqDistHashAsciiJs(text));

    for (const n of [1, 2, 3]) {
      expectHashMapsEqual(ngramFreqDistHashAscii(text, n), ngramFreqDistHashAsciiJs(text, n));
    }
  }
});

test("native token and ngram materialization matches JS reference", () => {
  for (const text of cases) {
    expect(tokenizeAsciiNative(text)).toEqual(tokenizeAscii(text));

    for (const n of [1, 2, 3]) {
      expect(ngramsAsciiNative(text, n)).toEqual(ngramsAscii(text, n));
    }
  }
});

test("native top PMI bigrams match JS reference", () => {
  for (const text of cases) {
    const actual = topPmiBigramsAscii(text, 5, 2);
    const expected = topPmiBigramsAsciiJs(text, 5, 2);

    expect(actual.length).toBe(expected.length);
    for (let i = 0; i < expected.length; i += 1) {
      expect(actual[i]!.leftHash).toBe(expected[i]!.leftHash);
      expect(actual[i]!.rightHash).toBe(expected[i]!.rightHash);
      expect(Math.abs(actual[i]!.score - expected[i]!.score)).toBeLessThanOrEqual(1e-12);
    }
  }
});

test("native token freqdist IDs are reversible and match JS reference", () => {
  const text = "Apple apple APPLE banana BANANA";
  const actual = tokenFreqDistIdsAscii(text);
  const expected = tokenFreqDistIdsAsciiJs(text);

  expect(actual.tokens).toEqual(["apple", "banana"]);
  expect(actual.counts).toEqual([3, 2]);
  expect(actual.totalTokens).toBe(5);

  expect(actual.tokens).toEqual(expected.tokens);
  expect(actual.counts).toEqual(expected.counts);
  expect(actual.totalTokens).toEqual(expected.totalTokens);
});

test("native bigram window stats IDs and token view match JS reference", () => {
  for (const text of cases) {
    for (const windowSize of [2, 3, 5]) {
      const actualId = bigramWindowStatsAsciiIds(text, windowSize);
      const expectedId = bigramWindowStatsAsciiIdsJs(text, windowSize);
      expect(actualId.length).toBe(expectedId.length);
      for (let i = 0; i < expectedId.length; i += 1) {
        expect(actualId[i]!.leftId).toBe(expectedId[i]!.leftId);
        expect(actualId[i]!.rightId).toBe(expectedId[i]!.rightId);
        expect(actualId[i]!.count).toBe(expectedId[i]!.count);
        expect(Math.abs(actualId[i]!.pmi - expectedId[i]!.pmi)).toBeLessThanOrEqual(1e-12);
      }

      const actualToken = bigramWindowStatsAscii(text, windowSize);
      const expectedToken = bigramWindowStatsAsciiJs(text, windowSize);
      expect(actualToken.length).toBe(expectedToken.length);
      for (let i = 0; i < expectedToken.length; i += 1) {
        expect(actualToken[i]!.left).toBe(expectedToken[i]!.left);
        expect(actualToken[i]!.right).toBe(expectedToken[i]!.right);
        expect(actualToken[i]!.count).toBe(expectedToken[i]!.count);
        expect(Math.abs(actualToken[i]!.pmi - expectedToken[i]!.pmi)).toBeLessThanOrEqual(1e-12);
      }
    }
  }
});

test("windowed PMI reproduces NLTK collocation sample values", () => {
  const text = "this this is is a a test test";
  const hash = (token: string) => {
    let h = 14695981039346656037n;
    for (let i = 0; i < token.length; i += 1) {
      h ^= BigInt(token.charCodeAt(i));
      h = (h * 1099511628211n) & 0xffffffffffffffffn;
    }
    return h;
  };

  const thisHash = hash("this");
  const isHash = hash("is");
  const aHash = hash("a");
  const testHash = hash("test");

  const window3 = topPmiBigramsAscii(text, 16, 3);
  const window3Ref = topPmiBigramsAsciiJs(text, 16, 3);
  expect(window3).toEqual(window3Ref);
  const score3 = (left: bigint, right: bigint) =>
    window3.find((x) => x.leftHash === left && x.rightHash === right)?.score;
  expect(score3(thisHash, isHash)).toBeCloseTo(1.584962500721156, 12);
  expect(score3(isHash, aHash)).toBeCloseTo(1.584962500721156, 12);
  expect(score3(aHash, testHash)).toBeCloseTo(1.584962500721156, 12);

  const window5 = topPmiBigramsAscii(text, 16, 5);
  const window5Ref = topPmiBigramsAsciiJs(text, 16, 5);
  expect(window5).toEqual(window5Ref);
  const score5 = (left: bigint, right: bigint) =>
    window5.find((x) => x.leftHash === left && x.rightHash === right)?.score;
  expect(score5(thisHash, aHash)).toBeCloseTo(0.5849625007211562, 12);
  expect(score5(isHash, testHash)).toBeCloseTo(0.5849625007211562, 12);
});

test("native porter stemmer matches NLTK-style vectors", () => {
  const vectors: Array<[string, string]> = [
    ["caresses", "caress"],
    ["ponies", "poni"],
    ["ties", "ti"],
    ["cats", "cat"],
    ["feed", "feed"],
    ["agreed", "agre"],
    ["plastered", "plaster"],
    ["motoring", "motor"],
    ["sing", "sing"],
    ["conflated", "conflat"],
    ["hopping", "hop"],
    ["filing", "file"],
    ["happy", "happi"],
    ["sky", "sky"],
    ["relational", "relat"],
    ["triplicate", "triplic"],
    ["probate", "probat"],
    ["rate", "rate"],
    ["controll", "control"],
    ["roll", "roll"],
    ["oed", "o"],
    ["On", "on"],
    ["Github", "github"],
  ];

  for (const [word, expected] of vectors) {
    expect(porterStemAscii(word)).toBe(expected);
  }
});

test("native handles empty input", () => {
  expect(countTokensAscii("")).toBe(0);
  expect(countUniqueTokensAscii("")).toBe(0);
  expect(countNgramsAscii("", 2)).toBe(0);
  expect(countUniqueNgramsAscii("", 2)).toBe(0);
  expect(tokenFreqDistHashAscii("").size).toBe(0);
  expect(ngramFreqDistHashAscii("", 2).size).toBe(0);
  expect(tokenizeAsciiNative("")).toEqual([]);
  expect(ngramsAsciiNative("", 2)).toEqual([]);
  expect(topPmiBigramsAscii("", 5, 2)).toEqual([]);
  expect(tokenFreqDistIdsAscii("").tokens).toEqual([]);
  expect(bigramWindowStatsAscii("", 2)).toEqual([]);
});
