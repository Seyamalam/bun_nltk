import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { chartParse, parseCfgGrammar, parseTextWithCfg, type ParseTree } from "../index";

const grammarText = `
S -> NP VP
NP -> Det N | Name
VP -> V NP
Det -> 'the' | 'a'
N -> 'cat' | 'dog'
V -> 'sees' | 'likes'
Name -> 'alice'
`;

function toBracket(tree: ParseTree): string {
  const children = tree.children
    .map((child) => (typeof child === "string" ? child : toBracket(child)))
    .join(" ");
  return `(${tree.label}${children ? ` ${children}` : ""})`;
}

test("chart parser returns parse tree for simple CFG", () => {
  const grammar = parseCfgGrammar(grammarText);
  const trees = chartParse(["alice", "sees", "the", "dog"], grammar);
  expect(trees.length).toBeGreaterThan(0);
  expect(toBracket(trees[0]!)).toBe("(S (NP (Name alice)) (VP (V sees) (NP (Det the) (N dog))))");
});

test("parseTextWithCfg tokenizes and parses text", () => {
  const trees = parseTextWithCfg("Alice sees a cat.", grammarText);
  expect(trees.length).toBeGreaterThan(0);
  expect(toBracket(trees[0]!)).toContain("(V sees)");
});

test("chart parser parity with python nltk CFG chart parser", () => {
  const tokens = ["alice", "sees", "the", "dog"];
  const grammar = parseCfgGrammar(grammarText);
  const jsTrees = chartParse(tokens, grammar).map(toBracket);

  const payload = JSON.stringify({
    grammar: grammarText,
    tokens,
  });
  const proc = Bun.spawnSync(["python", "bench/python_parser_baseline.py", "--payload", payload], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(proc.stderr));
  }
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as {
    parse_count: number;
    trees: string[];
  };

  expect(jsTrees.length).toBe(py.parse_count);
  expect(jsTrees[0]).toBe(py.trees[0]);
});

