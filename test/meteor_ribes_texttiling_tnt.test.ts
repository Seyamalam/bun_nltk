import { describe, expect, test } from "bun:test";
import { singleMeteorScore, meteorScore } from "../src/translate_meteor";
import {
  sentenceRibes,
  corpusRibes,
  wordRankAlignment,
  kendallTau,
  spearmanRho,
} from "../src/translate_ribes";
import { TextTilingTokenizer } from "../src/tokenize_texttiling";
import { TnT } from "../src/tag_tnt";

// ---------------------------------------------------------------------------
// METEOR — expected values from nltk 3.10.3
// ---------------------------------------------------------------------------

describe("METEOR", () => {
  const hyp1 = "It is a guide to action which ensures that the military always obeys the commands of the party".split(" ");
  const ref1 = "It is a guide to action that ensures that the military will forever heed Party commands".split(" ");
  const ref2 = "It is the guiding principle which guarantees the military forces always being under the command of the Party".split(" ");
  const ref3 = "It is the practical guide for the army always to heed the directions of the party".split(" ");

  test("single_meteor_score matches NLTK doctest 0.6944", () => {
    expect(singleMeteorScore(ref1, hyp1)).toBeCloseTo(0.6944444444444445, 12);
  });

  test("no overlap scores 0 (NLTK ZeroDivisionError path)", () => {
    expect(singleMeteorScore(["this", "is", "a", "cat"], ["non", "matching", "hypothesis"])).toBe(0);
  });

  test("meteor_score picks the best of multiple references", () => {
    expect(meteorScore([ref1, ref2, ref3], hyp1)).toBeCloseTo(0.6944444444444445, 12);
  });
});

// ---------------------------------------------------------------------------
// RIBES — expected values from nltk 3.10.3
// ---------------------------------------------------------------------------

describe("RIBES", () => {
  test("word_rank_alignment H0 example (Isozaki et al. 2010)", () => {
    const ref = "he was interested in world history because he read the book".split(" ");
    const hyp = "he read the book because he was interested in world history".split(" ");
    expect(wordRankAlignment(ref, hyp)).toEqual([7, 8, 9, 10, 6, 0, 1, 2, 3, 4, 5]);
  });

  test("word_rank_alignment H1 example", () => {
    const ref = "John hit Bob yesterday".split(" ");
    const hyp = "Bob hit John yesterday".split(" ");
    expect(wordRankAlignment(ref, hyp)).toEqual([2, 1, 0, 3]);
  });

  test("kendall_tau matches NLTK doctests", () => {
    const worder = [7, 8, 9, 10, 6, 0, 1, 2, 3, 4, 5];
    expect(kendallTau(worder, false)).toBeCloseTo(-0.23636363636363636, 12);
    expect(kendallTau(worder)).toBeCloseTo(0.38181818181818183, 12);
  });

  test("spearman_rho matches NLTK doctests", () => {
    const worder = [7, 8, 9, 10, 6, 0, 1, 2, 3, 4, 5];
    expect(spearmanRho(worder, false)).toBeCloseTo(-0.5909090909090909, 12);
    expect(spearmanRho(worder)).toBeCloseTo(0.20454545454545456, 12);
  });

  test("corpus_ribes matches NLTK doctest 0.3597", () => {
    const ref1a = "It is a guide to action that ensures that the military will forever heed Party commands".split(" ");
    const ref1b = "It is the guiding principle which guarantees the military forces always being under the command of the Party".split(" ");
    const ref1c = "It is the practical guide for the army always to heed the directions of the party".split(" ");
    const ref2a = "he was interested in world history because he read the book".split(" ");
    const hyp1 = "It is a guide to action which ensures that the military always obeys the commands of the party".split(" ");
    const hyp2 = "he read the book because he was interested in world history".split(" ");
    expect(corpusRibes([[ref1a, ref1b, ref1c], [ref2a]], [hyp1, hyp2])).toBeCloseTo(0.35970295471471503, 10);
  });

  test("sentence_ribes single reference matches python baseline", () => {
    const ref1a = "It is a guide to action that ensures that the military will forever heed Party commands".split(" ");
    const hyp1 = "It is a guide to action which ensures that the military always obeys the commands of the party".split(" ");
    expect(sentenceRibes([ref1a], hyp1)).toBeCloseTo(0.3375877276112482, 12);
  });
});

// ---------------------------------------------------------------------------
// TextTiling
// ---------------------------------------------------------------------------

const TT_TEXT = `This is a text about dogs. Dogs are great pets. Dogs love to play fetch and go for walks in the park with their owners every day.

Cats are different from dogs in many ways. Cats prefer staying indoors and sleeping. Cat behavior is more independent than dog behavior.

Computers are machines that process information quickly. Computer science studies computation and algorithms. Programming computers is a useful skill today.`;

describe("TextTilingTokenizer", () => {
  test("segments at topic boundaries like python nltk (w=10,k=5)", () => {
    const tt = new TextTilingTokenizer({ w: 10, k: 5, stopwords: [] });
    const segs = tt.tokenize(TT_TEXT);
    // Python NLTK produces two segments with the boundary in paragraph 2.
    expect(segs.length).toBe(2);
    expect(segs[0]!.startsWith("This is a text about dogs")).toBe(true);
  });

  test("vocabulary_introduction method runs and returns segments", () => {
    const tt = new TextTilingTokenizer({
      w: 10,
      k: 5,
      stopwords: [],
      similarityMethod: VOCAB_INTRO(),
    });
    const segs = tt.tokenize(TT_TEXT.repeat(2));
    expect(segs.length).toBeGreaterThanOrEqual(1);
    expect(segs.join("").length).toBeGreaterThan(0);
  });
});

function VOCAB_INTRO() {
  // avoid importing constant twice in this file
  return "vocabulary_introduction" as const;
}

// ---------------------------------------------------------------------------
// TnT
// ---------------------------------------------------------------------------

const TNT_TRAIN: Array<Array<[string, string]>> = [
  [["the", "DT"], ["dog", "NN"], ["barks", "VBZ"]],
  [["the", "DT"], ["cat", "NN"], ["sleeps", "VBZ"]],
  [["a", "DT"], ["dog", "NN"], ["sleeps", "VBZ"]],
  [["the", "DT"], ["quick", "JJ"], ["fox", "NN"], ["jumps", "VBZ"]],
  [["dogs", "NNS"], ["run", "VBP"], ["fast", "RB"]],
];

describe("TnT tagger", () => {
  const tnt = new TnT();
  tnt.train(TNT_TRAIN);

  test("known-word tagging matches python nltk output", () => {
    expect(tnt.tag(["the", "dog", "runs"])).toEqual([
      ["the", "DT"],
      ["dog", "NN"],
      ["runs", "VBZ"],
    ]);
    expect(tnt.tag(["a", "cat", "jumps"])).toEqual([
      ["a", "DT"],
      ["cat", "NN"],
      ["jumps", "VBZ"],
    ]);
  });

  test("unknown words route through the suffix model like python nltk", () => {
    expect(tnt.tag(["the", "flurbish", "snarks"])).toEqual([
      ["the", "DT"],
      ["flurbish", "NN"],
      ["snarks", "VBZ"],
    ]);
  });

  test("empty input returns empty tags", () => {
    expect(tnt.tag([])).toEqual([]);
  });
});
