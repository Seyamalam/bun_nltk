import { resolve } from "node:path";
import { chartParse, parseCfgGrammar, type ParseTree } from "../index";

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
  const children = tree.children.map((child) => (typeof child === "string" ? child : toBracket(child))).join(" ");
  return `(${tree.label}${children ? ` ${children}` : ""})`;
}

function main() {
  const tokens = ["alice", "sees", "the", "dog"];
  const jsTrees = chartParse(tokens, parseCfgGrammar(grammarText)).map(toBracket);
  const payload = JSON.stringify({ grammar: grammarText, tokens });
  const proc = Bun.spawnSync(["python", "bench/python_parser_baseline.py", "--payload", payload], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    throw new Error(`python parser baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  }
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as { parse_count: number; trees: string[] };
  const parity = jsTrees.length === py.parse_count && jsTrees[0] === py.trees[0];
  if (!parity) {
    throw new Error("parser parity failed");
  }
  console.log(
    JSON.stringify(
      {
        parity,
        parse_count: jsTrees.length,
      },
      null,
      2,
    ),
  );
}

main();

