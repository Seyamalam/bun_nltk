import { resolve } from "node:path";
import { chartParse, leftCornerParse, parseCfgGrammar, type ParseTree } from "../index";

const grammarText = `
S -> NP VP
NP -> Det N | Name
VP -> V NP
Det -> 'the' | 'a'
N -> 'cat' | 'dog'
V -> 'sees' | 'likes'
Name -> 'alice' | 'bob'
`;

function toBracket(tree: ParseTree): string {
  const children = tree.children.map((child) => (typeof child === "string" ? child : toBracket(child))).join(" ");
  return `(${tree.label}${children ? ` ${children}` : ""})`;
}

function main() {
  const grammar = parseCfgGrammar(grammarText);
  const tokens = ["alice", "sees", "the", "dog"];
  const jsTrees = leftCornerParse(tokens, grammar);
  const chartTrees = chartParse(tokens, grammar);
  const payload = JSON.stringify({ grammar: grammarText, tokens });
  const proc = Bun.spawnSync(["python", "bench/python_leftcorner_baseline.py", "--payload", payload], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as {
    parse_count: number;
    trees: string[];
  };
  const parity = jsTrees.length === py.parse_count && toBracket(jsTrees[0]!) === (py.trees[0] ?? null);
  const chartAgree = jsTrees.length > 0 && chartTrees.length > 0 && toBracket(jsTrees[0]!) === toBracket(chartTrees[0]!);
  if (!parity || !chartAgree) {
    throw new Error(
      `leftcorner parity failed: parity=${parity} chart_agree=${chartAgree} js=${jsTrees.length} py=${py.parse_count}`,
    );
  }
  console.log(JSON.stringify({ parity: true, parse_count: jsTrees.length, chart_agree: chartAgree }, null, 2));
}

main();
