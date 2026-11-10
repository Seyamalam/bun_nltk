import { describe, expect, test } from "bun:test";
import { ParsingRuntime, Tree } from "../src/rust_parse";

// Values pinned from Python NLTK 3.10.3 (see test/tree_oracle.py).

describe("Tree nltk.tree.tree member surface (NLTK 3.10.3)", async () => {
  const runtime = await ParsingRuntime.load();

  test("chomsky_normal_form default (right, all siblings)", () => {
    const t = Tree.fromstring(runtime, "(S (NP a b c) (VP (V d) (NP e f)))");
    t.chomsky_normal_form();
    expect(String(t)).toBe("(S (NP a (NP|<b-c> b c)) (VP (V d) (NP e f)))");
  });

  test("un_chomsky_normal_form restores structure", () => {
    const t = Tree.fromstring(runtime, "(S (NP a b c) (VP (V d) (NP e f)))");
    t.chomsky_normal_form();
    t.un_chomsky_normal_form();
    expect(String(t)).toBe("(S (NP a b c) (VP (V d) (NP e f)))");
  });

  test("chomsky_normal_form left factor", () => {
    const t = Tree.fromstring(runtime, "(S (NP a b c) (VP (V d) (NP e f g)))");
    t.chomsky_normal_form("left");
    expect(String(t)).toBe("(S (NP (NP|<a-b> a b) c) (VP (V d) (NP (NP|<e-f> e f) g)))");
  });

  test("chomsky_normal_form vertMarkov annotation", () => {
    const t = Tree.fromstring(runtime, "(S (NP a b c) (VP (V d) (NP e f)))");
    t.chomsky_normal_form("right", undefined, 2);
    expect(String(t)).toBe("(S (NP a (NP|<b-c> b c)) (VP^<S> (V d) (NP e f)))");
  });

  test("chomsky_normal_form horzMarkov truncation", () => {
    const t = Tree.fromstring(runtime, "(S (NP a b c d) (VP x))");
    t.chomsky_normal_form("right", 1);
    expect(String(t)).toBe("(S (NP a (NP|<b> b (NP|<c> c d))) (VP x))");
  });

  test("collapse_unary default and collapsePOS/collapseRoot", () => {
    const t = Tree.fromstring(runtime, "(A (B (C (D x))))");
    t.collapse_unary();
    expect(String(t)).toBe("(A (B+C (D x)))");
    const t2 = Tree.fromstring(runtime, "(A (B (C (D x))))");
    t2.collapse_unary(true);
    expect(String(t2)).toBe("(A (B+C+D x))");
    const t3 = Tree.fromstring(runtime, "(TOP (S (NP x)))");
    t3.collapse_unary(false, true);
    expect(String(t3)).toBe("(TOP+S (NP x))");
  });

  test("pformat_latex_qtree / pformat_latex_forest", () => {
    const t = Tree.fromstring(runtime, "(S (NP the dog) (VP chased))");
    expect(t.pformat_latex_qtree()).toBe("\\Tree [.S [.NP the dog ] [.VP chased ] ]");
    expect(t.pformat_latex_forest()).toBe(
      "\\begin{forest}\n  [S [NP [the] [dog] ] [VP [chased] ] ]\n\\end{forest}",
    );
  });

  test("list protocol: index/count/remove/sort", () => {
    const t = Tree.fromstring(runtime, "(S (B x) (A y) (C z))");
    t.sort();
    expect(String(t)).toBe("(S (A y) (B x) (C z))");
    t.sort(undefined, true);
    expect(String(t)).toBe("(S (C z) (B x) (A y))");
    const t2 = Tree.fromstring(runtime, "(S a b)");
    t2.append("c");
    expect(String(t2)).toBe("(S a b c)");
    expect(t2.index("b")).toBe(1);
    expect(t2.count("a")).toBe(1);
    t2.remove("a");
    expect(String(t2)).toBe("(S b c)");
  });

  test("fromlist / convert / freeze / pprint", () => {
    const built = Tree.fromlist(runtime, [["A", "B"], "c", "d"]) as Tree;
    expect(built.label()).toBe("['A', 'B']");
    expect(built.length).toBe(2);
    expect(built.leaves() as unknown[]).toEqual([null, null]);
    const t = Tree.fromstring(runtime, "(S (NP x) (VP y))");
    const converted = Tree.convert(runtime, t);
    expect(converted instanceof Tree && String(converted)).toBe("(S (NP x) (VP y))");
    const frozen = t.freeze();
    expect(String(frozen)).toBe("(S (NP x) (VP y))");
    expect(t.pprint()).toBe("(S (NP x) (VP y))");
  });
});
