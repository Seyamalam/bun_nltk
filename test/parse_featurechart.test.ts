import { expect, test } from "bun:test";
import { resolve } from "node:path";
import {
  FeatureChartParser,
  FeatureEarleyChartParser,
  FeatureTreeEdge,
  FeatStructNonterminal,
  InstantiateVarsChart,
  find_variables,
  unify,
} from "../index";
import {
  FeatureBottomUpChartParser,
  FeatureBottomUpLeftCornerChartParser,
  FeatureGrammar,
  FeatureIncrementalBottomUpChartParser,
  FeatureIncrementalBottomUpLeftCornerChartParser,
  FeatureIncrementalTopDownChartParser,
  FeatureTopDownChartParser,
} from "../src/parse_feature";
import { FeatDict, FeatStruct, Variable, reprValue } from "../src/featstruct";
import { treeToBracket } from "../src/tree_transforms";
import type { ParseTree } from "../src/parse";

const ORACLE = resolve(import.meta.dir, "parse_featurechart_oracle.py");
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

// Same text as nltk.parse.featurechart.demo_grammar (quoted terminals become
// leaves; our reader keeps them bare like NLTK).
const DEMO_GRAMMAR = `
S  -> NP VP
PP -> Prep NP
NP -> NP PP
VP -> VP PP
VP -> Verb NP
VP -> Verb
NP -> Det[pl=?x] Noun[pl=?x]
NP -> "John"
NP -> "I"
Det -> "the"
Det -> "my"
Det[-pl] -> "a"
Noun[-pl] -> "dog"
Noun[-pl] -> "cookie"
Verb -> "ate"
Verb -> "saw"
Prep -> "with"
Prep -> "under"
`;

const TOKENS = "I saw John with a dog with my cookie".split(" ");

function normTree(t: ParseTree): string {
  return treeToBracket(t).replace(/[\s\n]+/g, "");
}

test("feature-chart parsers match oracle trees for all eight strategies", () => {
  const grammar = FeatureGrammar.fromstring(DEMO_GRAMMAR);
  const parsers: Record<string, { parse(toks: string[]): ParseTree[] }> = {
    FeatureChartParser: new FeatureChartParser(grammar),
    FeatureTopDownChartParser: new FeatureTopDownChartParser(grammar),
    FeatureBottomUpChartParser: new FeatureBottomUpChartParser(grammar),
    FeatureBottomUpLeftCornerChartParser: new FeatureBottomUpLeftCornerChartParser(grammar),
    FeatureEarleyChartParser: new FeatureEarleyChartParser(grammar),
    FeatureIncrementalTopDownChartParser: new FeatureIncrementalTopDownChartParser(grammar),
    FeatureIncrementalBottomUpChartParser: new FeatureIncrementalBottomUpChartParser(grammar),
    FeatureIncrementalBottomUpLeftCornerChartParser: new FeatureIncrementalBottomUpLeftCornerChartParser(grammar),
  };
  const oracle = runOracle<Record<string, { count: number; trees: string[] }>>({ kind: "parse", tokens: TOKENS });
  for (const [name, parser] of Object.entries(parsers)) {
    const trees = parser.parse(TOKENS).map(normTree).sort();
    expect(oracle[name], name).toBeDefined();
    expect(trees, name).toEqual(oracle[name]!.trees);
    expect(trees.length, name).toBe(oracle[name]!.count);
  }
});

test("unify matches oracle results and bindings", () => {
  const cases: [string, string][] = [
    ["[A=?x]", "[B=?y]"],
    ["[NUM=sg]", "[NUM=pl]"],
    ["[NUM=?x]", "[NUM=sg]"],
    ["[A=[B=?x],C=?x]", "[A=[B=dog]]"],
    ["[TYPE=S]", "[]"],
  ];
  const oracle = runOracle<{ result: string | null; bindings: Record<string, string> }[]>({ kind: "unify", cases });
  const reader = FeatStruct.fromstring;
  cases.forEach(([a, b], i) => {
    const bindings = new Map<string, import("../src/featstruct").FeatValue>();
    const result = unify(reader(a), reader(b), bindings, { rename_vars: true });
    const expected = oracle[i]!;
    if (expected.result === null) {
      expect(result).toBeNull();
    } else {
      expect(result).not.toBeNull();
      expect(reprValue(result as never).replace(/[\s\n]+/g, "")).toBe(expected.result!.replace(/[\s\n]+/g, ""));
    }
    const got: Record<string, string> = {};
    for (const [k, v] of [...bindings.entries()].sort(([x], [y]) => x.localeCompare(y))) {
      got[k] = v instanceof Variable ? `'${v.name.slice(1)}'` : typeof v === "string" ? `'${v}'` : String(v);
    }
    expect(got).toEqual(expected.bindings);
  });
});

test("FeatureGrammar indexes productions by TYPE feature like the oracle", () => {
  const oracle = runOracle<{ start: string; lhs_prods: string[]; rhs0: string; rhs_prods: string[]; n_prods: number }>({ kind: "grammar" });
  const g = FeatureGrammar.fromstring(DEMO_GRAMMAR);
  expect(g.productions().length).toBe(oracle.n_prods);
  const lhsProds = g.productions({ lhs: g.start() });
  // Oracle: productions(lhs=start) → all S prods regardless of feature details.
  expect(lhsProds.length).toBe(oracle.lhs_prods.length);
  const rhs0 = g.productions()[0]!.rhs()[0]!;
  expect(g.productions({ rhs: rhs0 }).length).toBe(oracle.rhs_prods.length);
  expect(g.start()).toBeInstanceOf(FeatStructNonterminal);
});

test("FeatureTreeEdge applies bindings on completion like the oracle", () => {
  const grammar = FeatureGrammar.fromstring(`S -> NP[NUM=?n]\nNP[NUM=sg] -> "dog"`);
  const prod = grammar.productions()[0]!;
  const bindings = new Map<string, import("../src/featstruct").FeatValue>([["?n", "sg"]]);
  const complete = new FeatureTreeEdge([0, 1], prod.lhs(), prod.rhs(), 1, bindings);
  expect(complete.is_complete()).toBe(true);
  expect(complete.bindings().size).toBe(0); // bindings cleared once applied
  const rhs0 = complete.rhs()[0] as FeatStructNonterminal;
  expect(rhs0).toBeInstanceOf(FeatStructNonterminal);
  expect(rhs0.get("NUM")).toBe("sg");
});

test("InstantiateVarsChart renames @-vars on complete edges", () => {
  // '@'-vars are constructed programmatically (NLTK reader has no @ syntax).
  const num = new FeatDict({ type: "NP", NUM: new Variable("@x") });
  const lhs = new FeatStructNonterminal(num);
  const chart = new InstantiateVarsChart(["dog"]);
  const edge = new FeatureTreeEdge([0, 1], lhs, ["dog"], 1);
  chart.insert(edge, []);
  const bound = (edge.lhs() as FeatStructNonterminal).get("NUM") as { name?: string } | undefined;
  expect(bound).toBeDefined();
  expect(String(bound)).not.toBe("@x");
  expect((bound?.name ?? String(bound)).startsWith("@")).toBe(false);
});

test("find_variables discovers variables across a structure", () => {
  const oracle = runOracle<string[]>({ kind: "vars", fstruct: "[A=?x,B=[C=?y],D='dog']" });
  const vars = find_variables(FeatStruct.fromstring("[A=?x,B=[C=?y],D='dog']")).map((v) => v.name).sort();
  expect(vars).toEqual(oracle);
});
