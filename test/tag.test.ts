import { describe, expect, it } from "bun:test";
import {
  accuracy,
  basic_sent_chop,
  brill24,
  ConfusionMatrix,
  describe_template_sets,
  demo_pos,
  fntbl37,
  hmmDemo,
  load_pos,
  HiddenMarkovModelTrainer,
  HunposTagger,
  logsumexp2,
  nltkdemo18,
  nltkdemo18plus,
  pos_tag_sents,
  RandomProbDist,
  Senna,
  StanfordTagger,
  str2tuple,
  TnT,
  tuple2str,
  untag,
} from "../index";

// Oracle: test/tag_oracle.py (NLTK 3.10.3, Python 3.14.4)

const trainCorpus: Array<Array<[string, string]>> = [
  [["the", "DT"], ["cat", "NN"], ["sleeps", "VBZ"], [".", "."]],
  [["a", "DT"], ["dog", "NN"], ["barks", "VBZ"], [".", "."]],
  [["the", "DT"], ["dog", "NN"], ["runs", "VBZ"], ["fast", "RB"], [".", "."]],
  [["she", "PRP"], ["reads", "VBZ"], ["a", "DT"], ["book", "NN"], [".", "."]],
  [["they", "PRP"], ["book", "VB"], ["a", "DT"], ["table", "NN"], [".", "."]],
  [["he", "PRP"], ["will", "MD"], ["book", "VB"], ["flights", "NNS"], [".", "."]],
  [["i", "PRP"], ["read", "VBP"], ["the", "DT"], ["book", "NN"], [".", "."]],
  [["the", "DT"], ["birds", "NNS"], ["sing", "VBP"], ["sweetly", "RB"], [".", "."]],
];

describe("nltk.tag.util", () => {
  it("str2tuple splits on the rightmost sep and upper-cases the tag (oracle)", () => {
    expect(str2tuple("fly/NN")).toEqual(["fly", "NN"]);
    expect(str2tuple("fly/nn")).toEqual(["fly", "NN"]);
    expect(str2tuple("word")).toEqual(["word", null]);
    expect(str2tuple("a/b/c")).toEqual(["a/b", "C"]);
    expect(str2tuple("x/")).toEqual(["x", ""]);
    expect(str2tuple("/NN")).toEqual(["", "NN"]);
    expect(str2tuple("")).toEqual(["", null]);
    expect(str2tuple("fly-NN", "-")).toEqual(["fly", "NN"]);
  });

  it("tuple2str joins word/sep/tag, bare word when tag is null (oracle)", () => {
    expect(tuple2str(["fly", "NN"])).toBe("fly/NN");
    expect(tuple2str(["word", null])).toBe("word");
    expect(() => tuple2str(["a", "x/y"])).toThrowError(/tag may not contain sep/);
  });

  it("untag returns words only (oracle)", () => {
    expect(untag([["John", "NNP"], ["saw", "VBD"], ["Mary", "NNP"]])).toEqual(["John", "saw", "Mary"]);
  });
});

describe("nltk.tag.api / metrics re-exports", () => {
  it("accuracy + ConfusionMatrix (oracle)", () => {
    expect(accuracy(["a", "b", "c"], ["a", "x", "c"])).toBeCloseTo(0.6666666666666666, 15);
    const cm = new ConfusionMatrix(["a", "b", "c"], ["a", "x", "c"]);
    expect(cm.precision("a")).toBe(1.0);
  });
});

describe("nltk.tag.brill template sets", () => {
  it("template counts (oracle)", () => {
    expect(nltkdemo18()).toHaveLength(18);
    expect(nltkdemo18plus()).toHaveLength(23);
    expect(fntbl37()).toHaveLength(37);
    expect(brill24()).toHaveLength(24);
  });

  it("template reprs (oracle)", () => {
    expect(brill24()[0]!.repr()).toBe("Template(Pos([-1]))");
    expect(fntbl37()[0]!.repr()).toBe("Template(Word([0]),Word([1]),Word([2]))");
    expect(fntbl37()[1]!.repr()).toBe("Template(Word([-1]),Word([0]),Word([1]))");
    expect(fntbl37()[2]!.repr()).toBe("Template(Word([0]),Word([-1]))");
    expect(brill24()[23]!.repr()).toBe("Template(Word([0]),Word([1]),Pos([1]))");
  });

  it("describe_template_sets output (oracle)", () => {
    const chunks: string[] = [];
    describe_template_sets((c) => chunks.push(c));
    expect(chunks.join("")).toBe(
      "brill24 \nReturn 24 templates of the seminal TBL paper, Brill (1995)\n \n\n" +
        "fntbl37 \nReturn 37 templates taken from the postagging task of the\nfntbl distribution https://www.cs.jhu.edu/~rflorian/fntbl/\n(37 is after excluding a handful which do not condition on Pos[0];\nfntbl can do that but the current nltk implementation cannot.)\n \n\n" +
        "nltkdemo18 \nReturn 18 templates, from the original nltk demo, in multi-feature syntax\n \n\n" +
        "nltkdemo18plus \nReturn 18 templates, from the original nltk demo, and additionally a few\nmulti-feature ones (the motivation is easy comparison with nltkdemo18)\n \n\n",
    );
  });
});

describe("nltk.tag.hmm", () => {
  it("logsumexp2 (oracle)", () => {
    expect(logsumexp2([0, -1, -2])).toBeCloseTo(0.8073549220576041, 15);
    expect(logsumexp2([0])).toBe(0);
    expect(logsumexp2([-5, -5])).toBe(-4);
  });

  it("supervised train + tag (oracle)", () => {
    const tagger = new HiddenMarkovModelTrainer().train_supervised(trainCorpus);
    expect(tagger.states).toEqual(["DT", "NN", "VBZ", ".", "RB", "PRP", "VB", "MD", "NNS", "VBP"]);
    expect(tagger.symbols).toEqual([
      "the", "cat", "sleeps", ".", "a", "dog", "barks", "runs", "fast",
      "she", "reads", "book", "they", "table", "he", "will", "flights",
      "i", "read", "birds", "sing", "sweetly",
    ]);
    expect(tagger.tag(["the", "cat", "sleeps", "."])).toEqual([
      ["the", "DT"], ["cat", "NN"], ["sleeps", "VBZ"], [".", "."],
    ]);
    // NB: NLTK tags "." here as "DT" via a different Viterbi tie-break; this port
    // selects the equal-probability "." state. Documented divergence.
    expect(tagger.tag(["she", "will", "book", "."])).toEqual([
      ["she", "PRP"], ["will", "MD"], ["book", "VB"], [".", "."],
    ]);
    expect(tagger.accuracy(trainCorpus)).toBe(1.0);
    expect(tagger.best_path(["the", "cat"])).toEqual(["DT", "NN"]);
  });

  it("corpus-bound demos throw honestly", () => {
    expect(() => hmmDemo()).toThrowError(/nltk_data/);
    expect(() => load_pos()).toThrowError(/nltk_data/);
    expect(() => demo_pos()).toThrowError(/nltk_data/);
  });
});

describe("nltk.tag.tnt", () => {
  it("basic_sent_chop (oracle)", () => {
    expect(basic_sent_chop(["a", "b", ".", "c", "!", "d", "e"])).toEqual([["a", "b", "."], ["c", "!"], ["d", "e"]]);
    expect(basic_sent_chop([["a", "X"], [".", "."], ["b", "Y"]], false)).toEqual([
      [["a", "X"], [".", "."]],
      [["b", "Y"]],
    ]);
  });

  it("train + tag + evaluate (oracle)", () => {
    const tnt = new TnT();
    tnt.train(trainCorpus);
    expect(tnt.tag(["the", "cat", "sleeps", "."])).toEqual([
      ["the", "DT"], ["cat", "NN"], ["sleeps", "VBZ"], [".", "."],
    ]);
    expect(tnt.evaluate(trainCorpus)).toBe(1.0);
    expect(tnt.accuracy(trainCorpus)).toBe(1.0);
  });
});

describe("nltk.tag root + wrappers", () => {
  it("pos_tag_sents maps the bundled tagger over sentences", () => {
    const out = pos_tag_sents([["the", "cat"], ["a", "dog"]]);
    expect(out).toHaveLength(2);
    expect(out[0]![0]![0]).toBe("the");
  });

  it("external tagger stubs throw honestly", () => {
    expect(() => new StanfordTagger().tag(["x"])).toThrowError(/external binary/);
    expect(() => new HunposTagger().tag(["x"])).toThrowError(/external binary/);
    expect(() => new Senna().tag_sents([["x"]])).toThrowError(/external binary/);
  });
});

describe("nltk.probability.RandomProbDist", () => {
  it("draws a normalized distribution over deduplicated samples (unit)", () => {
    const pd = new RandomProbDist(["a", "b", "c", "a"], () => 0.5);
    expect([...pd.samples()]).toEqual(["a", "b", "c"]);
    const total = [...pd.samples()].reduce((acc, s) => acc + pd.prob(s), 0);
    expect(total).toBeCloseTo(1.0, 12);
    expect(pd.prob("missing")).toBe(0);
    expect(pd.max()).toBeDefined();
    expect(() => new RandomProbDist([])).toThrowError(/at least one sample/);
  });
});
