import { describe, expect, test } from "bun:test";
import { CFG, Nonterminal } from "../src/grammar";
import { FundamentalRule, LC_STRATEGY, LeafEdge, TD_STRATEGY } from "../src/chart";
import { ChartParser } from "../src/parser_tagger_compat";
import type { ParseTree } from "../src/parse";

// NLTK 3.10.3 oracle pins — nltk.parse.chart ChartParser/Chart/edges
const GRAMMAR = `S -> NP VP
NP -> Det N | Det N PP
VP -> V NP | V NP PP
PP -> P NP
Det -> 'the' | 'a'
N -> 'man' | 'park' | 'dog'
V -> 'saw' | 'walked'
P -> 'in' | 'with'`;
const TOKENS = ["the", "man", "saw", "a", "dog", "in", "the", "park"];

const fmt = (t: ParseTree | string): string =>
  typeof t === "string" ? t : `(${t.label}${t.children.length ? " " + t.children.map(fmt).join(" ") : ""})`;

describe("nltk.parse.chart oracle parity (3.10.3)", () => {
  test("chart_parse edge set, parses, and trees match NLTK", () => {
    const g = CFG.fromstring(GRAMMAR);
    const p = new ChartParser(g);
    const chart = p.chart_parse(TOKENS);
    expect(chart.num_edges()).toBe(44);
    const parses = [...chart.parses(g.start())];
    expect(parses).toHaveLength(2);
    expect(parses.map(fmt)).toEqual([
      "(S (NP (Det the) (N man)) (VP (V saw) (NP (Det a) (N dog)) (PP (P in) (NP (Det the) (N park)))))",
      "(S (NP (Det the) (N man)) (VP (V saw) (NP (Det a) (N dog) (PP (P in) (NP (Det the) (N park))))))",
    ]);
  });

  test("edge str/repr and pretty formats match NLTK", () => {
    const g = CFG.fromstring(GRAMMAR);
    const chart = new ChartParser(g).chart_parse(TOKENS);
    const sorted = chart.edges().sort((a, b) => (String(a) < String(b) ? -1 : 1));
    expect(sorted.slice(0, 6).map(String)).toEqual([
      "[0:1] 'the'",
      "[0:1] Det -> 'the' *",
      "[0:1] NP -> Det * N",
      "[0:1] NP -> Det * N PP",
      "[0:2] NP -> Det N *",
      "[0:2] NP -> Det N * PP",
    ]);
    expect(chart.pretty_format_edge(chart.edges()[3]!, 8)).toBe(
      "|.       .       .       [-------]       .       .       .       .| [3:4] 'a'",
    );
    expect(chart.pretty_format_leaves(8)).toBe("|.  the  .  man  .  saw  .   a   .  dog  .   in  .  the  .  park .|");
  });

  test("strategies: agenda/no-agenda/TD/LC edge counts match NLTK", () => {
    const g2 = CFG.fromstring("S -> A B\nA -> 'a' |\nB -> 'b'");
    expect(new ChartParser(g2).chart_parse(["a", "b"]).num_edges()).toBe(13);
    expect(new ChartParser(g2, { useAgenda: false }).chart_parse(["a", "b"]).num_edges()).toBe(13);
    expect(new ChartParser(g2, { strategy: TD_STRATEGY }).chart_parse(["a", "b"]).num_edges()).toBe(11);
    expect(new ChartParser(g2, { strategy: LC_STRATEGY }).chart_parse(["a", "b"]).num_edges()).toBe(6);
    expect([...new ChartParser(g2).iterParse(["a", "b"])].map(fmt)).toEqual(["(S (A a) (B b))"]);
  });

  test("ParserI surface: grammar(), parse_one, parse_all, parse_sents", () => {
    const g = CFG.fromstring(GRAMMAR);
    const p = new ChartParser(g);
    expect(p.grammar().start().symbol()).toBe("S");
    expect(fmt(p.parse_one(TOKENS)!)).toStartWith("(S (NP (Det the)");
    expect(p.parse_all(TOKENS)).toHaveLength(2);
    // NLTK: VP requires NP after V, so "the man walked" has no parse.
    expect([...p.parse_sents([TOKENS, ["the", "man", "walked"]])].map((ts) => ts.length)).toEqual([2, 0]);
    expect(p.parse(["the", "man", "walked"])).toHaveLength(0);
  });

  test("check_coverage propagates ValueError on uncovered tokens", () => {
    const g = CFG.fromstring(GRAMMAR);
    expect(() => new ChartParser(g).chart_parse(["the", "man", "zzz"])).toThrow(
      "Grammar does not cover some of the input words",
    );
  });

  test("select() restrictions filter edges like NLTK", () => {
    const g = CFG.fromstring(GRAMMAR);
    const chart = new ChartParser(g).chart_parse(TOKENS);
    const complete = chart.select({ is_complete: true });
    expect(complete.length).toBeGreaterThan(0);
    expect(complete.every((e) => e.is_complete())).toBe(true);
    // Both parses share one S edge; ambiguity lives in child_pointer_lists.
    expect(chart.select({ start: 0, end: 8, lhs: new Nonterminal("S") })).toHaveLength(1);
    const leafEdges = chart.select({ lhs: "the" });
    expect(leafEdges.every((e) => e instanceof LeafEdge)).toBe(true);
  });

  test("child_pointer_lists reconstruct trees; insert dedupes", () => {
    const g = CFG.fromstring(GRAMMAR);
    const chart = new ChartParser(g).chart_parse(TOKENS);
    const sEdges = chart.select({ start: 0, end: 8, lhs: new Nonterminal("S") });
    expect(sEdges).toHaveLength(1);
    expect(chart.child_pointer_lists(sEdges[0]!)).toHaveLength(2);
    expect(chart.insert(sEdges[0]!)).toBe(false);
  });

  test("incomplete-edge trees append childless subtrees like NLTK", () => {
    const g = CFG.fromstring(GRAMMAR);
    const chart = new ChartParser(g).chart_parse(TOKENS);
    const inc = chart.select({ is_incomplete: true })[0]!;
    const trees = chart.trees(inc, { complete: false });
    expect(trees.length).toBeGreaterThan(0);
  });

  test("use_agenda disabled for NUM_EDGES>1 strategy", () => {
    const g = CFG.fromstring(GRAMMAR);
    const p = new ChartParser(g, { strategy: [new FundamentalRule()] });
    expect(p.chart_parse(TOKENS).num_edges()).toBe(0);
  });
});
