import { describe, expect, test } from "bun:test";
import { NLTKWordTokenizer } from "../index";

// nltk-word-tokenizer-differential: pinned against Python NLTK 3.10.3
// (test/nltk_word_tokenizer_oracle.py).

describe("nltk.tokenize.nltk.NLTKWordTokenizer", () => {
  const t = new NLTKWordTokenizer();
  const cases: Array<[string, string[]]> = [
    [
      "Good muffins cost $3.88 in New York.  Please buy me\ntwo of them.\nThanks.",
      ["Good", "muffins", "cost", "$", "3.88", "in", "New", "York.", "Please", "buy", "me", "two", "of", "them.", "Thanks", "."],
    ],
    [
      '"Hello," he said, "it\'s me!"',
      ["``", "Hello", ",", "''", "he", "said", ",", "``", "it", "'s", "me", "!", "''"],
    ],
    [
      "She can't've done it 'tisn't fair--really.",
      ["She", "can't", "'ve", "done", "it", "'", "tis", "n't", "fair", "--", "really", "."],
    ],
    [
      "The price (in dollars) is [too] {high}; 'twas 50% off!",
      ["The", "price", "(", "in", "dollars", ")", "is", "[", "too", "]", "{", "high", "}", ";", "'", "twas", "50", "%", "off", "!"],
    ],
    [
      "D'ye wanna gimme more'n that?",
      ["D", "'ye", "wan", "na", "gim", "me", "more", "'n", "that", "?"],
    ],
    [
      "'Single' and \"double\" quotes «guillemets» „low“ ‘curly’.",
      ["'", "Single", "'", "and", "``", "double", "''", "quotes", "«", "guillemets", "»", "„", "low", "“", "‘", "curly", "’", "."],
    ],
  ];

  test("tokenize matches oracle", () => {
    for (const [input, expected] of cases) expect(t.tokenize(input)).toEqual(expected);
  });

  test("convert_parentheses", () => {
    expect(t.tokenize("a (b) c", true)).toEqual(["a", "-LRB-", "b", "-RRB-", "c"]);
  });

  test("span_tokenize docstring case", () => {
    const s = "Good muffins cost $3.88\nin New (York).  Please (buy) me\ntwo of them.\n(Thanks).";
    expect([...t.span_tokenize(s)]).toEqual([
      [0, 4], [5, 12], [13, 17], [18, 19], [19, 23], [24, 26], [27, 30], [31, 32],
      [32, 36], [36, 37], [37, 38], [40, 46], [47, 48], [48, 51], [51, 52], [53, 55],
      [56, 59], [60, 62], [63, 68], [69, 70], [70, 76], [76, 77], [77, 78],
    ]);
  });
});
