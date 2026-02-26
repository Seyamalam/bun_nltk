import { expect, test } from "bun:test";
import { normalizeTokens, normalizeTokensAscii, normalizeTokensUnicode, porterStemAscii } from "../index";

test("normalizeTokens uses native ASCII fast path semantics", () => {
  const input = "The quick brown fox and the dog";
  expect(normalizeTokens(input, { removeStopwords: true })).toEqual(["quick", "brown", "fox", "dog"]);
  expect(normalizeTokens(input, { removeStopwords: false })).toEqual(
    normalizeTokensAscii(input, false),
  );
});

test("normalizeTokens handles unicode fallback", () => {
  const input = "Résumé and München are in the dataset";
  const expected = normalizeTokensUnicode(input, true);
  expect(normalizeTokens(input, { removeStopwords: true })).toEqual(expected);
});

test("normalizeTokens optional stemming", () => {
  const input = "The runners were running quickly";
  const base = normalizeTokens(input, { removeStopwords: true, stem: false });
  const normalized = normalizeTokens(input, { removeStopwords: true, stem: true });
  expect(normalized).toEqual(base.map((token) => porterStemAscii(token)));
});
