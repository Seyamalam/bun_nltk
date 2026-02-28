import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { leftCornerParse, parseCfgGrammar, type ParseTree } from "../index";

const grammarText = `
S -> NP VP
NP -> Det N | Name
VP -> V NP
Det -> 'the' | 'a'
N -> 'cat' | 'dog'
V -> 'sees' | 'likes'
Name -> 'alice' | 'bob'
`;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function toBracket(tree: ParseTree): string {
  const children = tree.children.map((child) => (typeof child === "string" ? child : toBracket(child))).join(" ");
  return `(${tree.label}${children ? ` ${children}` : ""})`;
}

function buildCases(size = 1200): string[][] {
  const base = [
    ["alice", "sees", "the", "dog"],
    ["bob", "likes", "a", "cat"],
    ["alice", "likes", "the", "cat"],
    ["bob", "sees", "a", "dog"],
  ];
  const out: string[][] = [];
  while (out.length < size) out.push(...base);
  return out.slice(0, size);
}

function runNative(cases: string[][], rounds: number) {
  const grammar = parseCfgGrammar(grammarText);
  const timings: number[] = [];
  let first: ParseTree[] = [];
  for (let i = 0; i < rounds; i += 1) {
    const started = performance.now();
    for (const tokens of cases) {
      const trees = leftCornerParse(tokens, grammar);
      if (first.length === 0) first = trees;
    }
    timings.push((performance.now() - started) / 1000);
  }
  return {
    median_seconds: median(timings),
    first_count: first.length,
    first_tree: first[0] ? toBracket(first[0]) : null,
  };
}

function runPython(cases: string[][], rounds: number) {
  const root = resolve(import.meta.dir, "..");
  const payload = JSON.stringify({
    grammar: grammarText,
    cases,
    rounds,
  });
  const artifacts = resolve(root, "artifacts");
  mkdirSync(artifacts, { recursive: true });
  const payloadPath = resolve(artifacts, `leftcorner_payload_${Date.now()}.json`);
  writeFileSync(payloadPath, payload, "utf8");
  const proc = Bun.spawnSync(["python", "bench/python_leftcorner_baseline.py", "--payload-file", payloadPath], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    throw new Error(`python left-corner baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  }
  return JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as {
    parse_count: number;
    trees: string[];
    total_seconds: number;
  };
}

function main() {
  const size = Number(process.argv[2] ?? "1200");
  const rounds = Number(process.argv[3] ?? "3");
  const cases = buildCases(size);
  const native = runNative(cases, rounds);
  const python = runPython(cases, rounds);

  console.log(
    JSON.stringify(
      {
        case_count: cases.length,
        rounds,
        parity_first_count: native.first_count === python.parse_count,
        parity_first_tree: native.first_tree === (python.trees[0] ?? null),
        native_seconds_median: native.median_seconds,
        python_seconds: python.total_seconds,
        speedup_vs_python: python.total_seconds / native.median_seconds,
      },
      null,
      2,
    ),
  );
}

main();
