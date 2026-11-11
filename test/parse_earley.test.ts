import { expect, test } from "bun:test";
import { resolve } from "node:path";
import {
  CFG,
  EarleyChartParser,
  IncrementalBottomUpChartParser,
  IncrementalBottomUpLeftCornerChartParser,
  IncrementalChart,
  IncrementalChartParser,
  IncrementalLeftCornerChartParser,
  IncrementalTopDownChartParser,
} from "../index";
import {
  BU_INCREMENTAL_STRATEGY,
  BU_LC_INCREMENTAL_STRATEGY,
  CompleteFundamentalRule,
  CompleterRule,
  EARLEY_STRATEGY,
  FilteredCompleteFundamentalRule,
  LC_INCREMENTAL_STRATEGY,
  PredictorRule,
  ScannerRule,
  TD_INCREMENTAL_STRATEGY,
  type IncrementalChartParserOptions,
} from "../src/parse_earley";
import type { ParseTree } from "../src/parse";

const ORACLE = resolve(import.meta.dir, "parse_earley_oracle.py");
const PYTHON = resolve(import.meta.dir, "../.venv/bin/python3");

function runOracle<T>(payload: unknown): T {
  const proc = Bun.spawnSync([PYTHON, ORACLE], {
    cwd: resolve(import.meta.dir, ".."),
    stdin: new TextEncoder().encode(JSON.stringify(payload)),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
  const lines = new TextDecoder().decode(proc.stdout).trim().split("\n").filter((l) => l.trim());
  return JSON.parse(lines[lines.length - 1]!) as T;
}

// nltk.parse.chart.demo_grammar() productions, verbatim (including the
// PP -> 'with' NP literal-terminal quirk).
const DEMO_GRAMMAR_TEXT = `
S -> NP VP
PP -> 'with' NP
NP -> NP PP
VP -> VP PP
VP -> Verb NP
VP -> Verb
NP -> Det Noun
NP -> 'John'
NP -> 'I'
Det -> 'the'
Det -> 'my'
Det -> 'a'
Noun -> 'dog'
Noun -> 'cookie'
Verb -> 'ate'
Verb -> 'saw'
Prep -> 'with'
Prep -> 'under'
`;

const DEMO_SENT = "I saw John with a dog with my cookie";

function bracket(tree: ParseTree): string {
  const kids = tree.children.map((c) => (typeof c === "string" ? c : bracket(c))).join(" ");
  return `(${tree.label}${kids ? ` ${kids}` : ""})`;
}

const normalize = (s: string) => s.replace(/\s+/g, " ").trim();

type ChartResult = { parses: string[]; edges_by_end: number[]; num_edges: number };
type Ctor = new (g: CFG, o?: IncrementalChartParserOptions) => IncrementalChartParser;
const PARSERS: Record<string, Ctor> = {
  earley: EarleyChartParser,
  td: IncrementalTopDownChartParser,
  bu: IncrementalBottomUpChartParser,
  bu_lc: IncrementalBottomUpLeftCornerChartParser,
  lc: IncrementalLeftCornerChartParser,
};

test("earleychart parsers differential: parses and per-end edge counts match oracle", () => {
  const tokens = DEMO_SENT.split(" ");
  const oracle = runOracle<Record<string, ChartResult>>({
    earley: { kind: "earley", tokens },
    td: { kind: "td", tokens },
    bu: { kind: "bu", tokens },
    bu_lc: { kind: "bu_lc", tokens },
    lc: { kind: "lc", tokens },
  });
  for (const kind of ["earley", "td", "bu", "bu_lc", "lc"] as const) {
    const grammar = CFG.fromstring(DEMO_GRAMMAR_TEXT);
    const parser = new PARSERS[kind]!(grammar);
    const chart = parser.chart_parse(tokens);
    const expected = oracle[kind]!;
    expect(chart.num_edges()).toBe(expected.num_edges);
    const byEnd: number[] = [];
    for (let end = 0; end <= chart.num_leaves(); end++) {
      byEnd.push(chart.select({ end }).length);
    }
    expect(byEnd).toEqual(expected.edges_by_end);
    const parses = [...chart.parses(grammar.start())].map((t) => normalize(bracket(t)));
    expect(parses).toEqual(expected.parses.map(normalize));
    // Earley demo asserts exactly 5 parses.
    expect(parses.length).toBe(5);
  }
});

test("earleychart parser grammar-string coercion and parse helpers", () => {
  const tokens = ["john", "likes", "mary"];
  const grammar = `
S -> NP VP
NP -> 'john' | 'mary'
VP -> 'likes' NP
`;
  const trees = new EarleyChartParser(grammar).parse(tokens);
  expect(trees.map(bracket)).toEqual(["(S (NP john) (VP likes (NP mary)))"]);
  expect(new IncrementalBottomUpLeftCornerChartParser(grammar).parse_one(tokens)!.label).toBe("S");
});

test("IncrementalChart select requires end (oracle positional contract)", () => {
  const chart = new IncrementalChart(["a", "b"]);
  expect(() => chart.select({ start: 0 })).toThrow(/'end'/);
  expect(chart.select(0)).toEqual([]);
  expect(chart.select({ end: 0 })).toEqual([]);
});

test("earleychart rule classes and strategies", () => {
  expect(new CompleterRule().NUM_EDGES).toBe(1);
  expect(new ScannerRule().NUM_EDGES).toBe(1);
  expect(new PredictorRule().NUM_EDGES).toBe(1);
  expect(new CompleteFundamentalRule().NUM_EDGES).toBe(1);
  expect(new FilteredCompleteFundamentalRule().NUM_EDGES).toBe(1);
  expect(EARLEY_STRATEGY.map((r) => r.NUM_EDGES)).toEqual([0, 0, 1, 1, 1]);
  expect(TD_INCREMENTAL_STRATEGY.length).toBe(4);
  expect(BU_INCREMENTAL_STRATEGY.length).toBe(4);
  expect(BU_LC_INCREMENTAL_STRATEGY.length).toBe(4);
  expect(LC_INCREMENTAL_STRATEGY.length).toBe(3);

  // Oracle raises ValueError for strategies containing NUM_EDGES > 1 rules.
  const bad = { NUM_EDGES: 2, *apply(): Generator<never> {} } as never;
  expect(() => new IncrementalChartParser(DEMO_GRAMMAR_TEXT, { strategy: [bad] })).toThrow(/NUM_EDGES == 0 or 1/);
});
