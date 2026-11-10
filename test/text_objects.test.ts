import { describe, expect, test } from "bun:test";
import { TextCollection, TokenSearcher } from "../index";

// text-objects-differential: pinned against Python NLTK 3.10.3 (test/text_objects_oracle.py).

describe("nltk.text.TokenSearcher", () => {
  const t = new TokenSearcher(["the", "quick", "brown", "fox", "jumps", "over", "the", "lazy", "dog"]);
  test("findall matches oracle", () => {
    expect(t.findall("<a> (<.*>)")).toEqual([]);
    // One capture group → findall returns group text (Python re.findall semantics).
    expect(t.findall("<the> (<.*>)")).toEqual([["quick"], ["lazy"]]);
    expect(t.findall("<the><lazy>")).toEqual([["the", "lazy"]]);
  });
});

describe("nltk.text.TextCollection", () => {
  const tc = new TextCollection([["the", "quick", "fox"], ["the", "lazy", "dog"], ["fox", "runs", "the", "marathon"]]);
  test("tf/idf/tf_idf match oracle", () => {
    const texts = [["the", "quick", "fox"], ["the", "lazy", "dog"], ["fox", "runs", "the", "marathon"]];
    expect(tc.tf("the", texts[0]!)).toBeCloseTo(1 / 3, 12);
    expect(tc.idf("the")).toBe(0.0);
    expect(tc.idf("fox")).toBeCloseTo(0.4054651081081644, 12);
    expect(tc.tf_idf("the", texts[0]!)).toBe(0.0);
    expect(tc.tf_idf("fox", texts[0]!)).toBeCloseTo(0.4054651081081644 / 3, 12);
  });
});
