import { rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { earleyParse, parseCfgGrammar, type ParseTree } from "../index";

const grammarText = `
S -> NP VP
NP -> Det N | Name
VP -> V NP
Det -> 'the' | 'a'
N -> 'cat' | 'dog'
V -> 'sees' | 'likes'
Name -> 'alice'
`;

const cases = [
  ["alice", "sees", "the", "dog"],
  ["alice", "likes", "a", "cat"],
  ["alice", "sees", "a", "cat"],
];

function toBracket(tree: ParseTree): string {
  const children = tree.children.map((c) => (typeof c === "string" ? c : toBracket(c))).join(" ");
  return `(${tree.label}${children ? ` ${children}` : ""})`;
}

function normalizePyTree(tree: string): string {
  // NLTK string tree has newlines/extra spaces; normalize before comparing.
  return tree.replace(/\s+/g, " ").trim();
}

function main() {
  const grammar = parseCfgGrammar(grammarText);
  const js = cases.map((tokens) => {
    const trees = earleyParse(tokens, grammar, { maxTrees: 16 });
    return {
      tokens,
      parse_count: trees.length,
      first_tree: trees[0] ? toBracket(trees[0]) : null,
    };
  });

  const payloadPath = resolve(import.meta.dir, "datasets", "earley_payload.json");
  writeFileSync(payloadPath, `${JSON.stringify({ grammar: grammarText, cases }, null, 2)}\n`, "utf8");
  const proc = Bun.spawnSync(["python", "bench/python_earley_baseline.py", "--payload-file", payloadPath], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  rmSync(payloadPath, { force: true });
  if (proc.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(proc.stderr));
  }
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as {
    ok: boolean;
    results: Array<{ parse_count: number; first_tree: string | null }>;
  };

  let countParity = true;
  let firstTreeAgreement = 0;
  for (let i = 0; i < js.length; i += 1) {
    if (js[i]!.parse_count !== py.results[i]!.parse_count) countParity = false;
    const jsTree = js[i]!.first_tree ? normalizePyTree(js[i]!.first_tree!) : null;
    const pyTree = py.results[i]!.first_tree ? normalizePyTree(py.results[i]!.first_tree!) : null;
    if (jsTree && pyTree && jsTree === pyTree) firstTreeAgreement += 1;
  }
  const agreement = js.length === 0 ? 1 : firstTreeAgreement / js.length;
  const parity = countParity && agreement >= 0.66;

  if (!parity) {
    throw new Error(`earley parity mismatch: count_parity=${countParity} tree_agreement=${agreement.toFixed(3)}`);
  }

  console.log(
    JSON.stringify(
      {
        parity,
        count_parity: countParity,
        first_tree_agreement: agreement,
      },
      null,
      2,
    ),
  );
}

main();
