import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { parsePcfgGrammar, probabilisticChartParse, type ParseTree } from "../index";

const grammarText = `
S -> NP VP [1.0]
NP -> Det N [0.55] | Name [0.45]
VP -> V NP [1.0]
Det -> 'the' [0.5] | 'a' [0.5]
N -> 'cat' [0.5] | 'dog' [0.5]
V -> 'sees' [0.6] | 'likes' [0.4]
Name -> 'alice' [0.5] | 'bob' [0.5]
`;

function toBracket(tree: ParseTree): string {
  const children = tree.children
    .map((child) => (typeof child === "string" ? child : toBracket(child)))
    .join(" ");
  return `(${tree.label}${children ? ` ${children}` : ""})`;
}

test("pcfg parser returns best parse with finite probability", () => {
  const grammar = parsePcfgGrammar(grammarText);
  const parsed = probabilisticChartParse(["alice", "sees", "the", "dog"], grammar);
  expect(parsed).not.toBeNull();
  expect(parsed!.prob).toBeGreaterThan(0);
  expect(Number.isFinite(parsed!.logProb)).toBe(true);
});

test("pcfg parser parity with python nltk viterbi parser", () => {
  const grammar = parsePcfgGrammar(grammarText);
  const tokens = ["alice", "sees", "the", "dog"];
  const js = probabilisticChartParse(tokens, grammar);
  expect(js).not.toBeNull();

  const payload = JSON.stringify({ grammar: grammarText, tokens });
  const proc = Bun.spawnSync(["python", "bench/python_pcfg_baseline.py", "--payload", payload], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as { tree: string | null; prob: number };

  expect(toBracket(js!.tree)).toBe(py.tree);
  expect(Math.abs(js!.prob - py.prob)).toBeLessThanOrEqual(1e-6);
});

