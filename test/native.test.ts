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
} from "../index";

const cases = [
  "this this is is a a test test",
  "My number is 601-984-4813, except it's not.",
  "Emoji test 👨‍👩‍👧‍👧 and accents resumé España München français",
  "Mixed123 CASE and apostrophe words like don't and O'Neill",
];

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

test("native handles empty input", () => {
  expect(countTokensAscii("")).toBe(0);
  expect(countUniqueTokensAscii("")).toBe(0);
  expect(countNgramsAscii("", 2)).toBe(0);
  expect(countUniqueNgramsAscii("", 2)).toBe(0);
});
