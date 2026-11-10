import { describe, expect, test } from "bun:test";
import {
  GISEncoding, TadmEventMaxentFeatureEncoding, FunctionBackedMaxentFeatureEncoding,
  ConditionalExponentialClassifier, CutoffChecker,
  calculate_deltas, calculate_empirical_fcount, calculate_nfmap,
  train_maxent_classifier_with_gis, train_maxent_classifier_with_iis,
  write_megam_file, write_tadm_file, parse_megam_weights, parse_tadm_weights,
} from "../src/maxent_nltk";
import { BinaryMaxentFeatureEncoding } from "../src/maxent_feature_encoding";

// maxent-differential: values pinned against Python NLTK 3.10.3
// (test/maxent_nltk_oracle.py, PYTHONHASHSEED=0 — Python label order is
// set-ordered; ours is insertion order, which coincides under that seed).

const train: Array<[Record<string, number>, string]> = [
  [{ a: 1, b: 1, c: 1 }, "y"],
  [{ a: 1, b: 1, c: 0 }, "x"],
  [{ a: 1, b: 1, c: 1 }, "y"],
  [{ a: 0, b: 1, c: 1 }, "x"],
];
const train2: Array<[Record<string, number>, string]> = [
  [{ a: 1, b: 1 }, "y"], [{ a: 0, b: 1 }, "x"], [{ a: 1, b: 1 }, "y"], [{ a: 0, b: 1 }, "x"],
];

function writer(): { stream: { write(s: string): void }; text(): string } {
  const chunks: string[] = [];
  return { stream: { write: (s: string) => { chunks.push(s); } }, text: () => chunks.join("") };
}

describe("nltk.classify.maxent encodings", () => {
  test("GISEncoding train/C/encode matches oracle", () => {
    const enc = GISEncoding.train(train);
    expect(enc.C).toBe(4);
    expect(enc.length()).toBe(9);
    expect(enc.labels()).toEqual(["y", "x"]);
    expect(enc.encode({ a: 1, b: 1, c: 0 }, "x")).toEqual([[3, 1], [4, 1], [5, 1], [8, 1]]);
  });
  test("GISEncoding rejects total >= C", () => {
    const enc = new GISEncoding(["y"], [[["f", 1, "y"], 0]], false, false, 0);
    expect(() => enc.encode({ f: 1 }, "y")).toThrow("Correction feature is not high enough!");
    expect(enc.describe(1)).toBe("Correction feature (0)");
  });
  test("FunctionBackedMaxentFeatureEncoding matches oracle", () => {
    const fe = new FunctionBackedMaxentFeatureEncoding(() => [[0, 1], [1, 2]], 2, ["y", "x"]);
    expect(fe.encode({ a: 1 }, "y")).toEqual([[0, 1], [1, 2]]);
    expect(fe.length()).toBe(2);
    expect(fe.labels()).toEqual(["y", "x"]);
    expect(fe.describe(0)).toBe("no description available");
  });
  test("TadmEventMaxentFeatureEncoding matches oracle", () => {
    const te = TadmEventMaxentFeatureEncoding.train(train2);
    expect(te.length()).toBe(4);
    expect(te.labels()).toEqual(["y", "x"]);
    expect(te.encode({ a: 1, b: 1 }, "x")).toEqual([[2, 1], [3, 1]]);
    expect(te.describe(0)).toEqual(["a", "y"]);
    expect(te.describe(3)).toEqual(["b", "x"]);
  });
});

describe("nltk.classify.maxent GIS trainer", () => {
  const enc = GISEncoding.train(train);
  const mc = train_maxent_classifier_with_gis(train, { trace: 0, encoding: enc, max_iter: 10 });
  test("weights match oracle", () => {
    expect(mc.weights().map((w) => Math.round(w * 1e6) / 1e6)).toEqual(
      [0.450889, -0.20917, 0.450889, -0.730533, 0.225744, 1.628709, 1.628709, -0.730533, -0.576655]);
  });
  test("prob_classify/classify/most_informative/repr match oracle", () => {
    const pd = mc.prob_classify({ a: 1, b: 1, c: 1 });
    expect([...pd.samples()].sort().map((l) => [l, Math.round(pd.prob(l) * 1e6) / 1e6]))
      .toEqual([["x", 0.208113], ["y", 0.791887]]);
    expect(mc.classify({ a: 1, b: 1, c: 1 })).toBe("y");
    expect(mc.most_informative_features(3)).toEqual([5, 6, 3]);
    expect(mc.toString()).toBe("<ConditionalExponentialClassifier: 2 labels, 9 features>");
  });
});

describe("nltk.classify.maxent IIS trainer", () => {
  const enc2 = BinaryMaxentFeatureEncoding.train(train);
  const mc2 = train_maxent_classifier_with_iis(train, { trace: 0, encoding: enc2, max_iter: 10 });
  test("prob_classify matches oracle", () => {
    const pd2 = mc2.prob_classify({ a: 1, b: 1, c: 1 });
    expect([...pd2.samples()].sort().map((l) => [l, Math.round(pd2.prob(l) * 1e6) / 1e6]))
      .toEqual([["x", 0.192929], ["y", 0.807071]]);
  });
  test("calculate_deltas matches oracle", () => {
    const emp = calculate_empirical_fcount(train, enc2);
    for (let i = 0; i < emp.length; i++) emp[i]! /= train.length;
    const nfmap = calculate_nfmap(train, enc2);
    const nfarr = [...nfmap.entries()].sort((a, b) => a[1] - b[1]).map(([nf]) => nf);
    const unatt = new Set<number>();
    for (let i = 0; i < emp.length; i++) if (emp[i] === 0) unatt.add(i);
    const w0 = Array.from<number>({ length: emp.length }).fill(0);
    for (const f of unatt) w0[f] = -Infinity;
    const mc3 = new ConditionalExponentialClassifier(enc2, w0);
    const d = calculate_deltas(train, mc3, unatt, emp, nfmap, nfarr, nfarr, enc2);
    expect([...d].map((x) => Math.round(x * 1e6) / 1e6))
      .toEqual([0.154954, 0, 0.154954, -0.194988, 0, 0.333333, 0.333333, -0.194988]);
  });
});

describe("nltk.classify.maxent file IO", () => {
  const enc2 = BinaryMaxentFeatureEncoding.train(train);
  test("write_megam_file matches oracle", () => {
    const out = writer();
    write_megam_file(train, enc2, out.stream);
    expect(out.text()).toBe("0 # 0 1 2 # 3 4 7\n1 # 0 1 # 3 4 5\n0 # 0 1 2 # 3 4 7\n1 # 1 2 # 6 4 7\n");
  });
  test("write_tadm_file matches oracle", () => {
    const te = TadmEventMaxentFeatureEncoding.train(train2);
    const out = writer();
    write_tadm_file(train2, te, out.stream);
    expect(out.text()).toBe(
      "2\n1 2 0 1 1 1\n0 2 2 1 3 1\n2\n0 2 0 0 1 1\n1 2 2 0 3 1\n" +
      "2\n1 2 0 1 1 1\n0 2 2 1 3 1\n2\n0 2 0 0 1 1\n1 2 2 0 3 1\n");
  });
  test("parse weights match oracle", () => {
    expect([...parse_tadm_weights(["1.5\n", "-2.0\n", "3.25"])]).toEqual([1.5, -2, 3.25]);
    expect([...parse_megam_weights("0 0.5\n2 -1.25\n", 4)]).toEqual([0.5, 0, -1.25, 0]);
  });
});

describe("nltk.classify.maxent CutoffChecker + train()", () => {
  test("CutoffChecker iter/return matches oracle", () => {
    const mc = train_maxent_classifier_with_gis(train, { trace: 0, encoding: GISEncoding.train(train), max_iter: 10 });
    const cc = new CutoffChecker({ max_iter: 5 });
    expect(cc.iter).toBe(1);
    expect(cc.check(mc, train)).toBeUndefined();
    expect(cc.iter).toBe(2);
  });
  test("MaxentClassifier.train dispatches + validates kwargs", () => {
    const mct = ConditionalExponentialClassifier.train(train2, { algorithm: "gis", trace: 0, max_iter: 8 });
    expect(mct.classify({ a: 1, b: 1 })).toBe("y");
    expect(() => ConditionalExponentialClassifier.train(train2, { algorithm: "iis", trace: 0, bogus: 1 }))
      .toThrow("Unexpected keyword arg 'bogus'");
    expect(() => ConditionalExponentialClassifier.train(train2, { algorithm: "megam", trace: 0 }))
      .toThrow("megam");
  });
});
