import { expect, test } from "bun:test";
import {
  countNgramsAscii,
  countTokensAscii,
  countUniqueNgramsAscii,
  countUniqueTokensAscii,
  countNgramsAsciiJs,
  countTokensAsciiJs,
  countUniqueNgramsAsciiJs,
  countUniqueTokensAsciiJs,
  ngramsAscii,
  ngramsAsciiNative,
  ngramFreqDistHashAscii,
  ngramFreqDistHashAsciiJs,
  topPmiBigramsAscii,
  topPmiBigramsAsciiJs,
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
    const actual = topPmiBigramsAscii(text, 5);
    const expected = topPmiBigramsAsciiJs(text, 5);

    expect(actual.length).toBe(expected.length);
    for (let i = 0; i < expected.length; i += 1) {
      expect(actual[i]!.leftHash).toBe(expected[i]!.leftHash);
      expect(actual[i]!.rightHash).toBe(expected[i]!.rightHash);
      expect(Math.abs(actual[i]!.score - expected[i]!.score)).toBeLessThanOrEqual(1e-12);
    }
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
  expect(topPmiBigramsAscii("", 5)).toEqual([]);
});
