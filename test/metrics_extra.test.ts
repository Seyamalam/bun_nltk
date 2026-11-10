import { describe, expect, test } from "bun:test";
import { jaro_similarity, jaro_winkler_similarity, ghd, approxrand } from "../src/distance_metrics";
import { chrf_precision_recall_fscore_support } from "../src/translation_metrics_extra";
import { Fraction } from "../src/fraction";

// metrics-extra-differential: values pinned against Python NLTK 3.10.3 (test/metrics_extra_oracle.py).

describe("nltk.metrics.distance jaro family", () => {
  test("jaro_similarity oracle pins", () => {
    expect(jaro_similarity("dixon", "dickson")).toBeCloseTo(0.7904761904761904, 12);
    expect(jaro_similarity("dwayne", "duane")).toBeCloseTo(0.8222222222222222, 12);
    expect(jaro_similarity("SHACKLEFORD", "SHACKELFORD")).toBeCloseTo(0.9696969696969697, 12);
    expect(jaro_similarity("", "nonempty")).toBe(0.0);
    expect(jaro_similarity("a", "b")).toBe(0.0);
    expect(jaro_similarity("", "")).toBe(1.0);
  });
  test("jaro_winkler_similarity oracle pins", () => {
    expect(jaro_winkler_similarity("dixon", "dickson")).toBeCloseTo(0.8323809523809523, 12);
    expect(jaro_winkler_similarity("dwayne", "duane")).toBeCloseTo(0.84, 12);
    expect(jaro_winkler_similarity("SHACKLEFORD", "SHACKELFORD")).toBeCloseTo(0.9818181818181818, 12);
    expect(jaro_winkler_similarity("TANYA", "TONYA", 0.1, 100)).toBeCloseTo(0.88, 12);
    expect(jaro_winkler_similarity("", "")).toBe(1.0);
  });
});

describe("nltk.metrics.segmentation ghd", () => {
  test("ghd oracle pins (Kulyukin examples)", () => {
    expect(ghd("1100100000", "1100010000", 1.0, 1.0, 0.5)).toBe(0.5);
    expect(ghd("1100100000", "1100000001", 1.0, 1.0, 0.5)).toBe(2.0);
    expect(ghd("011", "110", 1.0, 1.0, 0.5)).toBe(1.0);
    expect(ghd("1", "0", 1.0, 1.0, 0.5)).toBe(1.0);
    expect(ghd("111", "000", 1.0, 1.0, 0.5)).toBe(3.0);
    expect(ghd("000", "111", 1.0, 2.0, 0.5)).toBe(6.0);
    expect(ghd("000", "000", 1.0, 1.0, 0.5)).toBe(0.0);
    expect(ghd("100", "000", 2.0, 1.0, 0.5)).toBe(2.0);
  });
});

describe("nltk.metrics.scores approxrand", () => {
  test("deterministic pins", () => {
    expect(approxrand([1, 2], [1, 2])).toEqual([1.0, 24, 24]);
    const [sig, c, shuffles] = approxrand([1, 2], [4, 5], { shuffles: 10 ** 9 });
    expect(shuffles).toBe(24); // min(requested, (len a + len b)!)
    expect(sig).toBe((c + 1) / (shuffles + 1));
  });
});

describe("nltk.translate chrf_precision_recall_fscore_support", () => {
  test("oracle pins", () => {
    expect(chrf_precision_recall_fscore_support([..."abcde"], [..."abdfe"], 2)).toEqual([0.25, 0.25, 0.25, 1]);
    expect(chrf_precision_recall_fscore_support([..."abc"], [..."xyz"], 2)).toEqual([1e-16, 1e-16, 1e-16, 0]);
    expect(chrf_precision_recall_fscore_support([..."aaa"], [..."aa"], 2)).toEqual([1.0, 0.5, 0.5263157894736842, 1]);
    expect(chrf_precision_recall_fscore_support([], [..."ab"], 2)).toEqual([1e-16, 1e-16, 1e-16, 0]);
    expect(chrf_precision_recall_fscore_support([..."ab"], [], 2)).toEqual([1e-16, 1e-16, 1e-16, 0]);
  });
});

describe("Fraction (Python fractions parity)", () => {
  test("construction and arithmetic match CPython", () => {
    expect(String(new Fraction(3, 4))).toBe("3/4");
    expect(String(new Fraction("5/6"))).toBe("5/6");
    expect(new Fraction(7, 8).toNumber()).toBe(0.875);
    expect(String(new Fraction(0.5))).toBe("1/2");
    expect(String(new Fraction(1, 3).limit_denominator(10))).toBe("1/3");
    expect(String(new Fraction(-3, 4).numerator)).toBe("-3");
    expect(String(new Fraction(-3, 4).denominator)).toBe("4");
    expect(String(new Fraction(1, 2).add(new Fraction(1, 3)))).toBe("5/6");
    expect(new Fraction(2, 3).is_integer()).toBe(false);
    expect(new Fraction(4, 2).is_integer()).toBe(true);
    expect(String(new Fraction(1, 3).add(2))).toBe("7/3");
    expect(String(new Fraction(355, 113).limit_denominator(10))).toBe("22/7");
  });
});
