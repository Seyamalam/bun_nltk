import { describe, expect, test } from "bun:test";
import { Paice } from "../src/metrics_paice";
import { align } from "../src/metrics_aline";
import { ARLSTem } from "../src/stem_arlstem";
import { ARLSTem2 } from "../src/stem_arlstem2";
import { ISRIStemmer } from "../src/stem_isri";

// ---------------------------------------------------------------------------
// metrics.paice
// ---------------------------------------------------------------------------

describe("Paice stemming evaluation", () => {
  const lemmas: Record<string, string[]> = {
    kneel: ["kneel", "knelt"],
    range: ["range", "ranged"],
    ring: ["ring", "rang", "rung"],
  };
  // NLTK demo's first stems table (over-merged 'rang' group)
  const stemsOver: Record<string, string[]> = {
    kneel: ["kneel"],
    knelt: ["knelt"],
    rang: ["rang", "range", "ranged"],
    ring: ["ring"],
    rung: ["rung"],
  };

  test("totals and indexes match the NLTK demo values", () => {
    const p = new Paice(lemmas, stemsOver);
    expect(p.gumt).toBe(4);
    expect(p.gdmt).toBe(5);
    expect(p.gwmt).toBe(2);
    expect(p.gdnt).toBe(16);
    expect(p.ui).toBeCloseTo(0.8, 12);
    expect(p.oi).toBeCloseTo(0.125, 12);
    expect(p.sw).toBeCloseTo(0.15625, 12);
  });

  test("ERRT and truncation coordinates match python nltk exactly", () => {
    const p = new Paice(lemmas, stemsOver);
    expect(p.errt).toBeCloseTo(1.0, 12);
    expect(p.coords.map(([a, b]) => [a, b])).toEqual([
      [0.0, 1.0],
      [0.0, 0.375],
      [0.6, 0.125],
      [0.8, 0.125],
    ]);
  });

  test("update() after swapping stems recomputes statistics", () => {
    const p = new Paice(lemmas, stemsOver);
    p.stems = {
      kneel: ["kneel"],
      knelt: ["knelt"],
      rang: ["rang"],
      range: ["range", "ranged"],
      ring: ["ring"],
      rung: ["rung"],
    };
    p.update();
    // NLTK: gumt=4, gdmt=5, ui=0.8 (splitting 'rang' group leaves knelt/rung unmerged)
    expect(p.gumt).toBe(4);
    expect(p.gdmt).toBe(5);
    expect(p.ui).toBeCloseTo(0.8, 12);
  });

  test("align returns empty alignments for segments outside the feature matrix (NLTK behavior)", () => {
    // z/a are not in the feature matrix; NLTK's align does not validate and
    // returns empty alignment lists — match that rather than throwing.
    expect(align("zzz", "aaa")).toEqual([[], [], [], [], [], [], [], [], []]);
  });
});

// ---------------------------------------------------------------------------
// metrics.aline
// ---------------------------------------------------------------------------

describe("ALINE phonetic alignment", () => {
  test("align('aspire','aspirate') matches the NLTK result", () => {
    expect(align("aspire", "aspirate")).toEqual([
      [
        ["a", "a"],
        ["s", "s"],
        ["p", "p"],
        ["i", "i"],
        ["r", "r"],
        ["e", "a"],
      ],
    ]);
  });

  test("align('tu','du') matches the NLTK result", () => {
    expect(align("tu", "du")).toEqual([[["t", "d"], ["u", "u"]]]);
  });

  test("rejects epsilon outside [0,1]", () => {
    expect(() => align("tu", "du", 1.5)).toThrow(/Epsilon must be between/);
  });

  test("unknown segments produce empty alignment lists like NLTK (no validation error)", () => {
    // NLTK's align() does not reject unknown chars in practice — it yields
    // empty alignments. Keep parity with that behavior.
    expect(align("zzz", "aaa")).toEqual([[], [], [], [], [], [], [], [], []]);
  });
});

// ---------------------------------------------------------------------------
// Arabic stemmers
// ---------------------------------------------------------------------------

// Words chosen to exercise noun prefixes/suffixes, verb affixes and
// normalization; expected values captured from nltk 3.10.3 directly.
const ARL_CASES: Array<[string, string]> = [
  ["\u0627\u0644\u0645\u062f\u0631\u0633\u0629", "\u0645\u062f\u0631\u0633"], // المدرسة -> مدرس
  ["\u064a\u0630\u0647\u0628\u0648\u0646", "\u064a\u0630\u0647\u0628"], // يذهبون -> يذهب
  ["\u0643\u062a\u0627\u0628", "\u0643\u062a\u0627\u0628"], // كتاب unchanged
  ["\u0648\u0627\u0644\u0637\u0641\u0644", "\u0637\u0641\u0644"], // والطفل -> طفل
];

describe("ARLSTem (arlstem)", () => {
  const s = new ARLSTem();
  for (const [word, want] of ARL_CASES) {
    test(`stem(${JSON.stringify(word)}) === ${JSON.stringify(want)}`, () => {
      expect(s.stem(word)).toBe(want);
    });
  }
});

const ARL2_CASES: Array<[string, string]> = [
  ["\u0627\u0644\u0645\u062f\u0631\u0633\u0629", "\u0645\u062f\u0631\u0633"], // المدرسة -> مدرس
  ["\u064a\u0630\u0647\u0628\u0648\u0646", "\u064a\u0630\u0647\u0628"], // يذهبون -> يذهب
  ["\u0643\u062a\u0627\u0628", "\u0643\u062a\u0627\u0628"], // كتاب unchanged
  ["\u0645\u0633\u0627\u0641\u064a\u0631", "\u0645\u0633\u0627\u0641\u064a\u0631"], // مسافير unchanged
];

describe("ARLSTem2 (arlstem2)", () => {
  const s = new ARLSTem2();
  for (const [word, want] of ARL2_CASES) {
    test(`stem(${JSON.stringify(word)}) === ${JSON.stringify(want)}`, () => {
      expect(s.stem(word)).toBe(want);
    });
  }
});

const ISRI_CASES: Array<[string, string]> = [
  ["\u0627\u0644\u0645\u062f\u0631\u0633", "\u062f\u0631\u0633"], // المدرس -> درس
  ["\u064a\u0630\u0647\u0628\u0648\u0646", "\u0630\u0647\u0628"], // يذهبون -> ذهب
  ["\u0643\u062a\u0627\u0628", "\u0643\u062a\u0628"], // كتاب -> كتب
  ["\u0645\u0633\u0627\u0641\u064a\u0631", "\u0645\u0633\u0627\u0641\u064a\u0631"], // مسافير unchanged
];

describe("ISRIStemmer (isri)", () => {
  const s = new ISRIStemmer();
  for (const [word, want] of ISRI_CASES) {
    test(`stem(${JSON.stringify(word)}) === ${JSON.stringify(want)}`, () => {
      expect(s.stem(word)).toBe(want);
    });
  }

  test("stop words are returned untouched", () => {
    const stop = ISRI_CASES[0]![0];
    void stop;
    const st = new ISRIStemmer(["\u0643\u062a\u0627\u0628"]);
    expect(st.stem("\u0643\u062a\u0627\u0628")).toBe("\u0643\u062a\u0627\u0628");
  });
});
