import { describe, expect, test } from "bun:test";
import {
  AbsoluteDiscountingInterpolated,
  KneserNeyInterpolated,
  Laplace,
  Lidstone,
  MLE,
  NgramCounter,
  StupidBackoff,
  Vocabulary,
  WittenBellInterpolated,
} from "../src/lm_nltk";

// NLTK 3.10.3 oracle pins — nltk.lm LanguageModel/Vocabulary/NgramCounter
// Corpus: padded_everygram_pipeline(2, [['a','b','c','d']])
const TRAIN = [[['<s>'], ['<s>', 'a'], ['a'], ['a', 'b'], ['b'], ['b', 'c'], ['c'], ['c', 'd'], ['d'], ['d', '</s>'], ['</s>']]];
const VOCAB = ['<s>', 'a', 'b', 'c', 'd', '</s>'];
const r6 = (x: number) => Math.round(x * 1e6) / 1e6;

describe("LanguageModel score/perplexity matrix", () => {
  const cases: [string, () => InstanceType<typeof MLE>, [number, number, number]][] = [
    ["MLE", () => new MLE(2), [1.0, 0.166667, 1.0]],
    ["Lidstone", () => new Lidstone(0.1, 2), [0.647059, 0.164179, 1.545455]],
    ["Laplace", () => new Laplace(2), [0.25, 0.153846, 4.0]],
    ["StupidBackoff", () => new StupidBackoff(0.4, 2), [1.0, 0.166667, 1.0]],
    ["WittenBellInterpolated", () => new WittenBellInterpolated(2), [0.583333, 0.166667, 1.714286]],
    ["AbsoluteDiscountingInterpolated", () => new AbsoluteDiscountingInterpolated(2), [0.375, 0.166667, 2.666667]],
    ["KneserNeyInterpolated", () => new KneserNeyInterpolated(2), [0.92, 0.2, 1.086957]],
  ];
  for (const [name, make, [s1, s2, pp]] of cases) {
    test(name, () => {
      const lm = make();
      lm.fit(TRAIN, VOCAB);
      expect(r6(lm.score("b", ["a"]))).toBe(s1);
      expect(r6(lm.score("b"))).toBe(s2);
      expect(r6(lm.perplexity([["a", "b"], ["b", "c"]]))).toBe(pp);
    });
  }
});

describe("MLE misc members", () => {
  const m = new MLE(2);
  m.fit(TRAIN, VOCAB);

  test("generate is oracle-identical under seeded MT19937", () => {
    expect(m.generate(3, ["<s>"], 3)).toEqual(["a", "b", "c"]);
  });

  test("counts / logscore / context trimming", () => {
    expect(m.counts.N()).toBe(11);
    expect(m.counts.unigrams.get("a")).toBe(1);
    expect([...m.counts.get(2).get(["<s>"]).entries()]).toEqual([["a", 1]]);
    expect(m.logscore("a", ["<s>"])).toBe(0);
    expect(m.score("d", ["a", "b", "c", "d"])).toBe(0);
    expect(m.entropy([["<s>", "a"], ["a", "b"]])).toBe(-0);
  });

  test("logscore throws math domain error on zero score", () => {
    expect(() => m.logscore("zzz", ["a"])).toThrow(/math domain error/);
  });
});

describe("StupidBackoff context backoff", () => {
  test("overlong context backs off recursively", () => {
    const sb = new StupidBackoff(0.4, 2);
    sb.fit(TRAIN, VOCAB);
    expect(sb.score("d", ["a", "b", "c", "d"])).toBeCloseTo(0.06666666666666667, 12);
  });
});

describe("Vocabulary", () => {
  const v = new Vocabulary(["a", "c", "-", "d", "c", "a", "b", "r", "a", "c", "d"], 2);

  test("cutoff membership and counts", () => {
    expect(v.get("c")).toBe(3);
    expect(v.contains("c")).toBe(true);
    expect(v.get("b")).toBe(1);
    expect(v.contains("b")).toBe(false);
    expect(v.get("aliens")).toBe(0);
    expect([...v].sort()).toEqual(["<UNK>", "a", "c", "d"]);
    expect(v.length).toBe(4);
    expect(String(v)).toBe("<Vocabulary with cutoff=2 unk_label='<UNK>' and 4 items>");
  });

  test("lookup masks OOV words", () => {
    expect(v.lookup("a")).toBe("a");
    expect(v.lookup("aliens")).toBe("<UNK>");
    expect(v.lookup(["p", "a", "r", "d", "b", "c"])).toEqual(["<UNK>", "a", "<UNK>", "d", "<UNK>", "c"]);
    expect(() => v.lookup(3)).toThrow(TypeError);
  });

  test("update and cutoff validation", () => {
    expect(() => new Vocabulary([], 0)).toThrow(/Cutoff value cannot be less than 1/);
    const v2 = new Vocabulary(["a", "b", "c", "a", "b"], 2);
    v2.update(["b", "b", "c"]);
    expect(v2.get("b")).toBe(4);
  });
});

describe("NgramCounter", () => {
  const nc = new NgramCounter([[["a", "b"], ["c"], ["d", "e"]]]);

  test("orders, N, indexing, repr", () => {
    expect(nc.N()).toBe(3);
    expect(nc.get(2).get(["a"]).get("b")).toBe(1);
    expect(nc.get(1).get("a")).toBe(0);
    expect(nc.get("c")).toBe(1);
    expect(nc.get(["a"]).get("b")).toBe(1);
    expect(nc.ngramOrderCount).toBe(2);
    expect(String(nc)).toBe("<NgramCounter with 2 ngram orders and 3 ngrams>");
  });

  test("update requires tuples", () => {
    expect(() => nc.update([["x" as unknown as string[]]])).toThrow(TypeError);
  });
});

describe("fit contract", () => {
  test("empty vocab without vocabulary_text raises", () => {
    expect(() => new MLE(2).fit(TRAIN)).toThrow(/Cannot fit without a vocabulary/);
  });
});
