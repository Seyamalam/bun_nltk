import { resolve } from "node:path";
import { parsePcfgGrammar, probabilisticChartParse } from "../index";

const grammarText = `
S -> NP VP [1.0]
NP -> Det N [0.55] | Name [0.45]
VP -> V NP [1.0]
Det -> 'the' [0.5] | 'a' [0.5]
N -> 'cat' [0.5] | 'dog' [0.5]
V -> 'sees' [0.6] | 'likes' [0.4]
Name -> 'alice' [0.5] | 'bob' [0.5]
`;

function toBracket(tree: { label: string; children: Array<string | { label: string; children: unknown[] }> }): string {
  const children = tree.children
    .map((child) => (typeof child === "string" ? child : toBracket(child as { label: string; children: unknown[] })))
    .join(" ");
  return `(${tree.label}${children ? ` ${children}` : ""})`;
}

function main() {
  const tokens = ["alice", "sees", "the", "dog"];
  const js = probabilisticChartParse(tokens, parsePcfgGrammar(grammarText));
  if (!js) throw new Error("pcfg parse returned null");
  const proc = Bun.spawnSync(
    ["python", "bench/python_pcfg_baseline.py", "--payload", JSON.stringify({ grammar: grammarText, tokens })],
    {
      cwd: resolve(import.meta.dir, ".."),
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  if (proc.exitCode !== 0) throw new Error(`python pcfg baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as { tree: string | null; prob: number };
  const parityTree = toBracket(js.tree as never) === py.tree;
  const parityProb = Math.abs(js.prob - py.prob) <= 1e-6;
  if (!parityTree || !parityProb) throw new Error("pcfg parity failed");
  console.log(JSON.stringify({ parity: true, parityTree, parityProb }, null, 2));
}

main();

