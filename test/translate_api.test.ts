// Differential pins for nltk.translate.api/metrics/gale_church — see test/translate_api_oracle.py
import { describe, expect, test } from "bun:test";
import {
  Alignment,
  AlignedSent,
  alignment_error_rate,
  align_texts,
  erfcc,
  norm_cdf,
  norm_logsf,
  position_of_ngram,
  split_at,
  parse_token_stream,
} from "../index";

describe("nltk.translate Alignment oracle parity", () => {
  const a = new Alignment([[0, 0], [1, 2], [2, 1], [4, 3]]);

  test("str/repr", () => {
    expect(a.toString()).toBe("0-0 1-2 2-1 4-3");
    expect(a.repr()).toBe("Alignment([(0, 0), (1, 2), (2, 1), (4, 3)])");
    expect(a.invert().repr()).toBe("Alignment([(0, 0), (1, 2), (2, 1), (3, 4)])");
    expect(Alignment.fromstring("0-0 1-2 2-1").repr()).toBe("Alignment([(0, 0), (1, 2), (2, 1)])");
  });

  test("indexing and range", () => {
    expect(a.get(0)).toEqual([[0, 0]]);
    expect(a.get(1)).toEqual([[1, 2]]);
    expect(a.get(3)).toEqual([]);
    expect(a.range()).toEqual([0, 1, 2, 3]);
    expect(a.range([1, 4])).toEqual([2, 3]);
  });

  test("AlignedSent", () => {
    const s = new AlignedSent(["the", "house"], ["das", "Haus"], new Alignment([[0, 0], [1, 1]]));
    expect(s.toString()).toBe("<AlignedSent: 'the house...' -> 'das Haus...'>");
    expect(s.invert().toString()).toBe("<AlignedSent: 'das Haus...' -> 'the house...'>");
    expect(s.words()).toEqual(["the", "house"]);
    expect(s.mots()).toEqual(["das", "Haus"]);
  });
});

describe("nltk.translate gale_church + metrics oracle parity", () => {
  test("erfcc / norm_cdf / norm_logsf", () => {
    expect(erfcc(1.7)).toBe(0.016209540258365067);
    expect(erfcc(-0.5)).toBe(1.5204999077232426);
    expect(norm_cdf(0.0)).toBe(0.49999998499999976);
    expect(norm_cdf(2.5)).toBe(0.9937903350257904);
    expect(norm_logsf(1.0)).toBe(-1.8410215979624924);
    expect(norm_logsf(-3.0)).toBe(-0.0013508100064299497);
  });

  test("align_texts", () => {
    expect(align_texts([[5, 5]], [[5, 6]])).toEqual([[[0, 0], [1, 1]]]);
    expect(() => align_texts([[1, 2]], [[1], [2]])).toThrowError(
      /Source and target texts do not have the same number of blocks/,
    );
  });

  test("alignment_error_rate", () => {
    const ref = new Alignment([[0, 0], [1, 1], [2, 2]]);
    const hyp = new Alignment([[0, 0], [1, 2], [2, 1]]);
    expect(alignment_error_rate(ref, hyp)).toBe(0.6666666666666667);
    const poss = new Alignment([[0, 0], [1, 1], [1, 2], [2, 1], [2, 2]]);
    expect(alignment_error_rate(ref, hyp, poss)).toBe(0.33333333333333337);
  });

  test("position_of_ngram", () => {
    expect(position_of_ngram(["b", "c"], ["a", "b", "c", "d"])).toBe(1);
    expect(position_of_ngram(["z"], ["a", "b"])).toBeNull();
  });

  // Python-3 NLTK's split_at/parse_token_stream always raise (py2-style it.next() +
  // PEP 479); bun_nltk implements the documented delimiter-splitting contract.
  test("split_at / parse_token_stream documented contract", () => {
    expect([...split_at([1, 2, "/", 3, "/", 4, 5] as (number | string)[], "/")]).toEqual([[1, 2], [3], [4, 5]]);
    expect(parse_token_stream(["hello", "world", ".EP.", "a", "b", "c", ".P.", "x"], ".P.", ".EP.")).toEqual([[10], [3, 1]]);
  });
});
