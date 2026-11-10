import { describe, expect, test } from "bun:test";
import {
  everygrams, skipgrams, ngrams, pad_sequence, choose, edge_closure, flatten,
  unique_list, acyclic_depth_first, acyclic_branches_depth_first, cut_string,
  tokenwrap, unweighted_minimum_spanning_tree, unweighted_minimum_spanning_dict,
  Index, invert_dict, guess_encoding, slice_bounds, breadth_first,
  acyclic_breadth_first, in_idle,
} from "../src/util_nltk";

// util-differential: values pinned against Python NLTK 3.10.3 (test/util_nltk_oracle.py).

const g = (n: string) => ({ A: ["B", "C"], B: ["C"], C: ["B"] } as Record<string, string[]>)[n]!;

describe("nltk.util ngram iterators", () => {
  test("everygrams matches oracle", () => {
    expect([...everygrams("a b c".split(" "))]).toEqual([["a"], ["a", "b"], ["a", "b", "c"], ["b"], ["b", "c"], ["c"]]);
    expect([...everygrams("a b c".split(" "), 1, 2)]).toEqual([["a"], ["a", "b"], ["b"], ["b", "c"], ["c"]]);
  });
  test("skipgrams match oracle", () => {
    const sent = "Insurgents killed in ongoing fighting".split(" ");
    expect([...skipgrams(sent, 2, 2)]).toEqual([
      ["Insurgents", "killed"], ["Insurgents", "in"], ["Insurgents", "ongoing"],
      ["killed", "in"], ["killed", "ongoing"], ["killed", "fighting"],
      ["in", "ongoing"], ["in", "fighting"], ["ongoing", "fighting"]]);
    expect([...skipgrams(sent, 3, 2)]).toEqual([
      ["Insurgents", "killed", "in"], ["Insurgents", "killed", "ongoing"], ["Insurgents", "killed", "fighting"],
      ["Insurgents", "in", "ongoing"], ["Insurgents", "in", "fighting"], ["Insurgents", "ongoing", "fighting"],
      ["killed", "in", "ongoing"], ["killed", "in", "fighting"], ["killed", "ongoing", "fighting"],
      ["in", "ongoing", "fighting"]]);
  });
  test("ngrams and pad_sequence match oracle", () => {
    expect([...ngrams([1, 2, 3, 4, 5], 3)]).toEqual([[1, 2, 3], [2, 3, 4], [3, 4, 5]]);
    expect([...pad_sequence<number | string>([1, 2, 3], 2, { pad_left: true, pad_right: true, left_pad_symbol: "<s>", right_pad_symbol: "</s>" })])
      .toEqual(["<s>", 1, 2, 3, "</s>"]);
    expect([...ngrams<number | undefined>([1, 2, 3, 4, 5], 2, { pad_right: true })])
      .toEqual([[1, 2], [2, 3], [3, 4], [4, 5], [5, undefined]]);
  });
});

describe("nltk.util graph + misc helpers", () => {
  test("choose matches oracle", () => {
    expect([choose(4, 2), choose(6, 2), choose(10, 3), choose(5, 0), choose(3, 7)]).toEqual([6, 15, 120, 1, 0]);
  });
  test("edge_closure discards cycles like NLTK", () => {
    expect([...edge_closure("A", g)]).toEqual([["A", "B"], ["A", "C"], ["B", "C"], ["C", "B"]]);
  });
  test("spanning tree helpers match oracle", () => {
    expect(unweighted_minimum_spanning_tree("A", g)).toEqual(["A", ["B"], ["C"]]);
    expect(unweighted_minimum_spanning_dict("A", g).get("A")).toEqual(["B", "C"]);
    expect(unweighted_minimum_spanning_dict("A", g).get("B")).toEqual([]);
  });
  test("acyclic traversals match oracle", () => {
    expect(acyclic_depth_first("A", g, -1, "...")).toEqual(["A", ["B", ["C", "Cycle(B,-4,...)"]], "Cycle(C,-2,...)"]);
    expect(acyclic_branches_depth_first("A", g, -1, "...")).toEqual(["A", ["B", ["C", "Cycle(B,-4,...)"]], ["C", ["B", "Cycle(C,-4,...)"]]]);
    expect([...acyclic_breadth_first("A", g)]).toEqual(["A", "B", "C"]);
    expect([...breadth_first("A", g, 1)]).toEqual(["A", "B", "C"]);
  });
  test("flatten/unique_list/Index match oracle", () => {
    expect(flatten(1, 2, ["b", "a", ["c", "d"]], 3)).toEqual([1, 2, "b", "a", "c", "d", 3]);
    expect(unique_list([1, 2, 1, 3, 2, 4])).toEqual([1, 2, 3, 4]);
    const idx = new Index([["a", 1], ["b", 2], ["a", 3]] as const);
    expect(idx.get("a")).toEqual([1, 3]);
    expect(idx.get("b")).toEqual([2]);
  });
  test("cut_string/tokenwrap match oracle", () => {
    expect(cut_string("abc def ghi", 5)).toBe("abc d");
    expect(cut_string("abc def ghi", -4)).toBe(" ghi");
    expect(tokenwrap(["the", "quick", "brown", "fox", "jumps"], " ", 10)).toBe("the quick\nbrown fox\njumps");
  });
  test("invert_dict and guess_encoding", () => {
    const inv = invert_dict({ a: ["x", "y"], b: ["x"], c: 3 } as Record<string, unknown>);
    expect(inv.get("x")).toEqual(["a", "b"]);
    expect(inv.get("y")).toEqual(["a"]);
    expect(inv.get(3)).toBe("c");
    expect(guess_encoding(new TextEncoder().encode("héllo"))[1]).toBe("utf-8");
    expect(guess_encoding(new Uint8Array([0xe9, 0x65]))[1]).toBe("latin-1");
  });
  test("slice_bounds resolves slices like NLTK", () => {
    const seq = [10, 20, 30, 40];
    expect(slice_bounds(seq, { start: 1, stop: 3 })).toEqual([1, 3]);
    expect(slice_bounds(seq, { start: -2 })).toEqual([2, 4]);
    expect(slice_bounds(seq, { start: 1, stop: 99 })).toEqual([1, 4]);
    expect(slice_bounds(seq, { step: 2 }, true)).toEqual([0, 4, 2]);
  });
  test("in_idle is false outside IDLE", () => {
    expect(in_idle()).toBe(false);
  });
});
