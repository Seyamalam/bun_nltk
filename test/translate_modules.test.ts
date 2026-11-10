// Differential pins for nltk.translate.gdfa/gleu/lepor/phrase_based — see test/translate_modules_oracle.py
import { describe, expect, test } from "bun:test";
import {
  alignment,
  corpusGleu,
  corpusLepor,
  growDiagFinalAnd,
  harmonic,
  lengthPenalty,
  ngramPositionalPenalty,
  phraseExtraction,
  sentenceGleu,
  sentenceLepor,
} from "../index";

describe("nltk.translate.gdfa oracle parity", () => {
  test("grow_diag_final_and including out-of-bounds grow step", () => {
    expect(growDiagFinalAnd(2, 2, "1-1", "1-1 2-2")).toEqual([[1, 1], [2, 2]]);
    expect(growDiagFinalAnd(2, 2, "0-0", "0-0 1-1")).toEqual([[0, 0], [1, 1]]);
    expect(growDiagFinalAnd(3, 3, "0-0 2-2", "0-0 1-1 2-1")).toEqual([[0, 0], [1, 1], [2, 1], [2, 2]]);
  });
});

describe("nltk.translate.gleu oracle parity", () => {
  const ref = [["the", "cat", "sat"], ["on", "the", "mat"]];
  const hyp = ["the", "cat", "sat", "on", "the", "mat"];
  test("sentence/corpus gleu", () => {
    expect(sentenceGleu(ref, hyp)).toBe(0.3333333333333333);
    expect(corpusGleu([ref], [hyp])).toBe(0.3333333333333333);
  });
});

describe("nltk.translate.lepor oracle parity", () => {
  test("length_penalty", () => {
    expect(lengthPenalty(["a", "b", "c"], ["a", "b"])).toBe(1.3956124250860895);
  });
  test("alignment", () => {
    expect(alignment(["a", "b"], ["a", "b"])).toEqual([1, 2]);
    expect(alignment(["the", "cat", "sat"], ["a", "cat", "x"])).toEqual([2]);
  });
  test("harmonic", () => {
    expect(harmonic(2, 3, 2, 0.9, 0.3)).toBe(0.7272727272727275);
    expect(harmonic(2, 2, 2, 0.9, 0.3)).toBe(1.0000000000000002);
  });
  test("ngram_positional_penalty", () => {
    expect(ngramPositionalPenalty(["a", "b", "c"], ["a", "b", "c"])).toEqual([1.0, 3]);
    expect(ngramPositionalPenalty(["the", "cat"], ["cat", "the"])).toEqual([0.6065306597126334, 2]);
  });
  test("sentence/corpus lepor", () => {
    expect(sentenceLepor(["a b c"], "a b c")).toEqual([1.0000000000000002]);
    expect(sentenceLepor(["the cat"], "a cat")).toEqual([0.3894003915357026]);
    expect(corpusLepor([["a b"]], ["a b"])).toEqual([[1.0000000000000002]]);
  });
});

describe("nltk.translate.phrase_based oracle parity", () => {
  test("phrase_extraction", () => {
    expect(phraseExtraction("a b c", "a b c", [[0, 0]])).toEqual([
      [[0, 1], [0, 1], "a", "a"],
      [[0, 1], [0, 2], "a", "a b"],
      [[0, 1], [0, 3], "a", "a b c"],
      [[0, 2], [0, 1], "a b", "a"],
      [[0, 2], [0, 2], "a b", "a b"],
      [[0, 2], [0, 3], "a b", "a b c"],
      [[0, 3], [0, 1], "a b c", "a"],
      [[0, 3], [0, 2], "a b c", "a b"],
      [[0, 3], [0, 3], "a b c", "a b c"],
    ]);
    expect(phraseExtraction("ich gehe ja", "i go", [[0, 0], [1, 1]])).toEqual([
      [[0, 1], [0, 1], "ich", "i"],
      [[0, 2], [0, 2], "ich gehe", "i go"],
      [[0, 3], [0, 2], "ich gehe ja", "i go"],
      [[1, 2], [1, 2], "gehe", "go"],
      [[1, 3], [1, 2], "gehe ja", "go"],
    ]);
  });
});
