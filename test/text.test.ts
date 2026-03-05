import { expect, test } from "bun:test";
import { ConcordanceIndex, ContextIndex, Text } from "../index";

test("ConcordanceIndex locates word and phrase occurrences", () => {
  const tokens = ["The", "dog", "ran", "past", "the", "dog", "house"];
  const index = new ConcordanceIndex(tokens, (token) => token.toLowerCase());

  expect(index.offsets("dog")).toEqual([1, 5]);
  expect(index.findConcordance("dog", 40)).toHaveLength(2);
  expect(index.findConcordance(["the", "dog"], 40)).toHaveLength(2);
  expect(index.concordance("dog", 40, 1)).toHaveLength(1);
});

test("ContextIndex computes similar words and common contexts", () => {
  const tokens = ["I", "saw", "a", "dog", "today", "I", "saw", "a", "cat", "today", "I", "saw", "a", "dog", "yesterday"];
  const index = new ContextIndex(tokens, {
    filter: (token) => /^[A-Za-z]+$/.test(token),
    key: (token) => token.toLowerCase(),
  });

  expect(index.similarWords("dog", 3)).toContain("cat");
  const common = index.commonContexts(["dog", "cat"], true);
  expect(common.get(["a", "today"])).toBeGreaterThan(0);
});

test("Text exposes vocab, concordance, collocations, and context helpers", () => {
  const text = new Text(
    ["bright", "star", "bright", "moon", "bright", "star", "shines", "bright", "star"],
    "demo",
  );

  expect(text.count("bright")).toBe(4);
  expect(text.index("moon")).toBe(3);
  expect(text.vocab().mostCommon()).toEqual([
    ["bright", 4],
    ["star", 3],
    ["moon", 1],
    ["shines", 1],
  ]);
  expect(text.concordance("star", 40, 2)).toHaveLength(2);
  expect(text.collocationList(3, 2, { minFreq: 2, stopwords: [] })).toEqual([["bright", "star"]]);
  expect(text.collocations(3, 2)).toEqual(["bright star"]);
});

test("Text commonContexts returns ranked shared context tuples", () => {
  const text = new Text(["I", "saw", "a", "dog", "today", "I", "saw", "a", "cat", "today"]);
  expect(text.similar("dog", 5)).toContain("cat");
  expect(text.commonContexts(["dog", "cat"])).toEqual([["a", "today"]]);
});
