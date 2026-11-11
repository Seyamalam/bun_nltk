import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import {
  DemoScorer, DependencyGraph, DependencyGrammar,
  NonprojectiveDependencyParser, ProbabilisticNonprojectiveParser,
  ProbabilisticProjectiveDependencyParser, ProjectiveDependencyParser,
} from "../index";
import { treeToBracket } from "../src/tree_transforms";
import type { ParseTree } from "../src/parse";

const ORACLE = resolve(import.meta.dir, "parse_dep_oracle.py");
const PYTHON = resolve(import.meta.dir, "../.venv/bin/python3");

function runOracle<T>(payload: unknown): T {
  const proc = Bun.spawnSync([PYTHON, ORACLE], {
    cwd: resolve(import.meta.dir, ".."),
    stdin: new TextEncoder().encode(JSON.stringify(payload)),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
  // Oracle helpers may print noise (e.g. DemoScorer "Training..."); the JSON
  // result is always the last non-empty line.
  const lines = new TextDecoder().decode(proc.stdout).trim().split("\n").filter((l) => l.trim());
  return JSON.parse(lines[lines.length - 1]!) as T;
}

type DepsEntry = [string, number[]];
type NodeSnapshot = [number | null, string | null, string | null, number | null, string | null, DepsEntry[]];
type GraphSnapshot = { root: number | null; nodes: NodeSnapshot[] };
type Outcome<T> = { value: T } | { error: string; message: string };

function snapshot(g: DependencyGraph): GraphSnapshot {
  const nodes: NodeSnapshot[] = [];
  for (const n of g.nodes) {
    if (!n) continue;
    nodes.push([
      n.address, n.word, n.tag, n.head, n.rel,
      Object.entries(n.deps).map(([k, v]): DepsEntry => [k, [...v]]),
    ]);
  }
  return { root: g.root ? g.root.address : null, nodes };
}

test("nltk.parse.projectivedependencyparser > ProjectiveDependencyParser matches oracle trees", () => {
  const py = runOracle<string[]>({
    kind: "pdp",
    grammar: "\n'scratch' -> 'cats' | 'walls'\n'walls' -> 'the'\n'cats' -> 'the'\n",
    tokens: ["the", "cats", "scratch", "the", "walls"],
  });
  const grammar = DependencyGrammar.fromstring(`
'scratch' -> 'cats' | 'walls'
'walls' -> 'the'
'cats' -> 'the'
`);
  const pdp = new ProjectiveDependencyParser(grammar);
  const trees = [...pdp.parse(["the", "cats", "scratch", "the", "walls"])]
    .map((t) => treeToBracket(t as ParseTree));
  expect(trees).toEqual(py);
});

test("nltk.parse.projectivedependencyparser > ProbabilisticProjectiveDependencyParser train+parse matches oracle", () => {
  const py = runOracle<string[]>({
    kind: "ppdp",
    tokens: ["Cathy", "zag", "hen", "wild", "zwaaien", "."],
  });
  const conll2 = readFileSync(resolve(import.meta.dir, "fixtures/conll_data2.txt"), "utf8");
  const graphs = conll2.split(/\r?\n\r?\n/).filter((e) => e.trim()).map((e) => new DependencyGraph(e));
  const ppdp = new ProbabilisticProjectiveDependencyParser();
  ppdp.train(graphs);
  const trees = [...ppdp.parse(["Cathy", "zag", "hen", "wild", "zwaaien", "."])]
    .map((t) => treeToBracket(t as ParseTree));
  expect(trees).toEqual(py);
});

test("nltk.parse.nonprojectivedependencyparser > NonprojectiveDependencyParser yields oracle graph set", () => {
  const npGrammar = `
'taught' -> 'play' | 'man'
'man' -> 'the' | 'in'
'in' -> 'corner'
'corner' -> 'the'
'play' -> 'golf' | 'dachshund' | 'to'
'dachshund' -> 'his'
`;
  const py = runOracle<GraphSnapshot[]>({
    kind: "npdp",
    grammar: npGrammar,
    tokens: ["the", "man", "in", "the", "corner", "taught", "his", "dachshund", "to", "play", "golf"],
  });
  const ndp = new NonprojectiveDependencyParser(DependencyGrammar.fromstring(npGrammar), null);
  const graphs = [...ndp.parse(["the", "man", "in", "the", "corner", "taught", "his", "dachshund", "to", "play", "golf"])]
    .map(snapshot);
  expect(graphs).toEqual(py);
});

test("nltk.parse.nonprojectivedependencyparser > ProbabilisticNonprojectiveParser MST matches oracle incl. cycle quirk", () => {
  const py = runOracle<GraphSnapshot[]>({
    kind: "npp",
    tokens: ["v1", "v2", "v3"], tags: [null, null, null],
  });
  const npp = new ProbabilisticNonprojectiveParser();
  npp.train([], new DemoScorer());
  const graphs = [...npp.parse(["v1", "v2", "v3"], [null, null, null])].map(snapshot);
  expect(graphs).toEqual(py);
});

test("nltk.parse.dependencygraph > load() semantics match oracle", () => {
  const cases = [
    // Space-separated conll_data2 row — whitespace split (cell_separator=None).
    { name: "whitespace", conll: "1   Cathy   Cathy   N   N   feat   2   su   _  _\n2   zag   zag   V   V   f   0   ROOT   _  _\n3   hen   hen   Pron   Pron   f   2   obj1   _  _" },
    // Tab-separated.
    { name: "tabs", conll: "1\tCathy\t_\tN\t_\t_\t2\tsu\t_\t_\n2\tzag\t_\tV\t_\t_\t0\tROOT\t_\t_" },
    // Explicit "\t" separator on a leading-tab line -> '' cell -> 11 fields.
    { name: "leading_tab_explicit_sep", conll: "\t1\tCathy\tCathy\tN\tN\t_\t2\tsu\t_\t_\n\t2\tzag\tzag\tV\tV\t_\t0\tROOT\t_\t_", cell_separator: "\t" },
    // "_" head rows are skipped.
    { name: "underscore_head", conll: "1\tCathy\t_\tN\t_\t_\t_\t_\t_\t_\n2\tzag\t_\tV\t_\t_\t0\tROOT\t_\t_" },
    // Inconsistent cell counts -> AssertionError.
    { name: "bad_cells", conll: "1\tCathy\t_\tN\t_\t_\t2\tsu\t_\t_\n2\tzag\t_\tV" },
    // zero_based shifts heads, not addresses.
    { name: "zero_based", conll: "0\tCathy\t_\tN\t_\t_\t1\tsu\t_\t_\n1\tzag\t_\tV\t_\t_\t-1\tROOT\t_\t_", zero_based: true },
    // 3-cell with head 0 -> dep link under top_relation_label.
    { name: "three_cell_root", conll: "Cathy\tN\t2\nzag\tV\t0" },
    // Forward head reference (head row comes after dependent).
    { name: "forward_head", conll: "1\tmet\t_\tPrep\t_\t_\t3\tmod\t_\t_\n2\thaar\t_\tPron\t_\t_\t3\tobj1\t_\t_\n3\tmoeder\t_\tN\t_\t_\t0\tROOT\t_\t_" },
  ];
  const py = runOracle<Array<Outcome<GraphSnapshot>>>({ kind: "load", cases });
  cases.forEach((c, i) => {
    const expected = py[i]!;
    let result: Outcome<GraphSnapshot>;
    try {
      const dg = new DependencyGraph(c.conll, {
        cellSeparator: c.cell_separator ?? undefined,
        zeroBased: c.zero_based ?? undefined,
      });
      result = { value: snapshot(dg) };
    } catch (e) {
      const err = e as Error & { pyErrorName?: string };
      result = { error: err.pyErrorName ?? err.name, message: err.message };
    }
    if ("error" in expected) {
      expect("error" in result).toBe(true);
    } else {
      if ("error" in result) throw new Error(`${c.name}: ${result.error} ${result.message}`);
      expect(result.value).toEqual(expected.value);
    }
  });
});
