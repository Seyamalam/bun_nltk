import { expect, test } from "bun:test";
import { resolve } from "node:path";
import {
  InsideChartParser, LongestChartParser, PCFG, RandomChartParser,
  UnsortedChartParser, BottomUpProbabilisticChartParser,
} from "../index";
import { ProbabilisticLeafEdge, ProbabilisticTreeEdge } from "../src/parse_dependency";
import {
  ProbabilisticBottomUpInitRule, ProbabilisticBottomUpPredictRule,
  ProbabilisticFundamentalRule, SingleEdgeProbabilisticFundamentalRule,
  type ProbabilisticParseTree,
} from "../src/parse_pchart";
import type { ParseTree } from "../src/parse";

const ORACLE = resolve(import.meta.dir, "parse_pchart_oracle.py");
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

const TOY_PCFG1 = `
S -> NP VP [1.0]
NP -> Det N [0.5] | NP PP [0.25] | 'John' [0.1] | 'I' [0.15]
Det -> 'the' [0.8] | 'my' [0.2]
N -> 'man' [0.5] | 'telescope' [0.5]
VP -> VP PP [0.1] | V NP [0.7] | V [0.2]
V -> 'ate' [0.35] | 'saw' [0.65]
PP -> P NP [1.0]
P -> 'with' [0.61] | 'under' [0.39]
`;

const TOY_PCFG2 = `
S    -> NP VP         [1.0]
VP   -> V NP          [.59]
VP   -> V             [.40]
VP   -> VP PP         [.01]
NP   -> Det N         [.41]
NP   -> Name          [.28]
NP   -> NP PP         [.31]
PP   -> P NP          [1.0]
V    -> 'saw'         [.21]
V    -> 'ate'         [.51]
V    -> 'ran'         [.28]
N    -> 'boy'         [.11]
N    -> 'cookie'      [.12]
N    -> 'table'       [.13]
N    -> 'telescope'   [.14]
N    -> 'hill'        [.5]
Name -> 'Jack'        [.52]
Name -> 'Bob'         [.48]
P    -> 'with'        [.61]
P    -> 'under'       [.39]
Det  -> 'the'         [.41]
Det  -> 'a'           [.31]
Det  -> 'my'          [.28]
`;

const GRAMMARS: Record<string, string> = { toy1: TOY_PCFG1, toy2: TOY_PCFG2 };
const SENTS: Record<string, string> = {
  toy1: "I saw John with my telescope",
  toy2: "the boy saw Jack with Bob under the table with a telescope",
};

function bracket(tree: ParseTree | ProbabilisticParseTree): string {
  const kids = tree.children
    .map((c) => (typeof c === "string" ? c : bracket(c)))
    .join(" ");
  return `(${tree.label}${kids ? ` ${kids}` : ""})`;
}

function normalize(treeStr: string): string {
  return treeStr.replace(/\s+/g, " ").replace(/\) \(/g, ")(").trim();
}

type ParseResult = { tree: string; prob: number };
type ParserCtor = new (g: PCFG, beam?: number) => BottomUpProbabilisticChartParser;
const PARSERS: Record<string, ParserCtor> = {
  inside: InsideChartParser,
  longest: LongestChartParser,
  unsorted: UnsortedChartParser,
};

test("pchart parsers differential: parse trees and probabilities match oracle", () => {
  const oracle = runOracle<Record<string, ParseResult[]>>({
    toy1_inside: { kind: "inside", grammar: "toy1" },
    toy1_longest: { kind: "longest", grammar: "toy1" },
    toy1_unsorted: { kind: "unsorted", grammar: "toy1" },
    toy2_inside: { kind: "inside", grammar: "toy2" },
    toy2_beam13: { kind: "inside", grammar: "toy2", beam_size: 13 },
    toy2_beam30: { kind: "inside", grammar: "toy2", beam_size: 30 },
  });

  for (const key of ["toy1_inside", "toy1_longest", "toy1_unsorted", "toy2_inside"] as const) {
    const [, kind] = key.split("_") as [string, string];
    const gname = key.startsWith("toy1") ? "toy1" : "toy2";
    const grammar = PCFG.fromstring(GRAMMARS[gname]!);
    const trees = [...new PARSERS[kind!]!(grammar).parse(SENTS[gname]!.split(" "))];
    const expected = oracle[key]!;
    expect(trees.length).toBe(expected.length);
    for (let i = 0; i < trees.length; i++) {
      expect(trees[i]!.prob!).toBe(expected[i]!.prob);
      expect(normalize(bracket(trees[i]!))).toBe(normalize(expected[i]!.tree));
    }
  }

  // Beam behavior: beam_size=13 prunes the whole queue for the 12-token
  // sentence; beam_size=30 keeps every edge and recovers all 14 parses.
  const grammar2 = PCFG.fromstring(TOY_PCFG2);
  const toks2 = SENTS.toy2!.split(" ");
  expect([...new InsideChartParser(grammar2, 13).parse(toks2)].length).toBe(oracle.toy2_beam13!.length);
  const beam30 = [...new InsideChartParser(grammar2, 30).parse(toks2)];
  expect(beam30.length).toBe(oracle.toy2_beam30!.length);
  expect(beam30.map((t) => t.prob)).toEqual(oracle.toy2_beam30!.map((t) => t.prob));
});

test("pchart random parser: same parse multiset as oracle", () => {
  const oracle = runOracle<Record<string, ParseResult[]>>({
    rnd: { kind: "random", grammar: "toy1", seed: 7 },
  });
  const grammar = PCFG.fromstring(TOY_PCFG1);
  // Deterministic rand sequence exercises the queue-shuffle path.
  const seq = [0.9, 0.1, 0.7, 0.3, 0.5, 0.2, 0.8, 0.4, 0.6, 0.0];
  let i = 0;
  const trees = [...new RandomChartParser(grammar, 0, 0, () => seq[i++ % seq.length]!).parse(SENTS.toy1!.split(" "))];
  const key = (rs: ParseResult[]) => rs.map((r) => `${r.prob}|${normalize(r.tree)}`).sort();
  expect(key(trees.map((t) => ({ prob: t.prob!, tree: bracket(t) })))).toEqual(key(oracle.rnd!));
});

test("pchart rules and edges: NUM_EDGES, prob propagation, parser contract", () => {
  expect(new ProbabilisticBottomUpInitRule().NUM_EDGES).toBe(0);
  expect(new ProbabilisticBottomUpPredictRule().NUM_EDGES).toBe(1);
  expect(new ProbabilisticFundamentalRule().NUM_EDGES).toBe(2);
  expect(new SingleEdgeProbabilisticFundamentalRule().NUM_EDGES).toBe(1);
  expect(String(new SingleEdgeProbabilisticFundamentalRule())).toBe("Fundamental Rule");

  const leaf = new ProbabilisticLeafEdge("dog", 4);
  expect(leaf.prob()).toBe(1.0);
  const edge = new ProbabilisticTreeEdge(0.5, [0, 1], "NP" as never, ["dog"], 1);
  expect(edge.prob()).toBe(0.5);

  const grammar = PCFG.fromstring(TOY_PCFG1);
  const beamed = new InsideChartParser(grammar, 5, 0);
  expect(beamed.beam_size).toBe(5);
  expect(beamed.grammar()).toBe(grammar);
  const parser = new InsideChartParser(grammar);
  const one = parser.parse_one(SENTS.toy1!.split(" "));
  expect(one).not.toBeNull();
  expect([...parser.parse_all(SENTS.toy1!.split(" "))].length).toBe(2);

  // Oracle raises ValueError for non-PCFG grammars.
  expect(() => new InsideChartParser({} as PCFG)).toThrow(/probabilistic PCFG/);
});
