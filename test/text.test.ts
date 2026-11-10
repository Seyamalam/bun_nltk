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

// NLTK 3.10.3 oracle pins — ConcordanceIndex contract.
test("ConcordanceIndex: NLTK find_concordance/print_concordance/offsets pins", () => {
  const toks = "the quick brown dog jumps over the lazy dog".split(" ");
  const ci = new ConcordanceIndex(toks);
  expect(ci.offsets("dog")).toEqual([3, 8]);
  // defaultdict: missing lookup returns [] AND registers the key (8 types in repr)
  expect(ci.offsets("missing")).toEqual([]);
  expect(ci.toString()).toBe("<ConcordanceIndex for 9 tokens (8 types)>");
  const lines = ci.findConcordance("dog", 40);
  expect(lines[0]!.line).toBe("  the quick brown dog jumps over the la");
  expect(lines[0]!.offset).toBe(3);
  expect(lines[0]!.left).toEqual(["the", "quick", "brown"]);
  expect(lines[0]!.right).toEqual(["jumps", "over", "the", "lazy", "dog"]);
  // line 2 keeps the trailing space (NLTK does not trim)
  expect(lines[1]!.line).toBe("mps over the lazy dog ");
  // print_concordance format
  expect(ci.printConcordance("dog", 40, 1)).toBe(
    "Displaying 1 of 2 matches:\n  the quick brown dog jumps over the la\n",
  );
  expect(ci.printConcordance("zebra", 40)).toBe("no matches\n");
  // phrase
  expect(ci.findConcordance(["the", "lazy"], 40)[0]!.line).toBe(" dog jumps over the lazy dog");
});
