import { resolve } from "node:path";
import { parsePcfgGrammar, probabilisticChartParse, type ProbabilisticParse } from "../index";

const grammarText = `
S -> NP VP [1.0]
NP -> Det N [0.55] | Name [0.45]
VP -> V NP [1.0]
Det -> 'the' [0.5] | 'a' [0.5]
N -> 'cat' [0.5] | 'dog' [0.5]
V -> 'sees' [0.6] | 'likes' [0.4]
Name -> 'alice' [0.5] | 'bob' [0.5]
`;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function toBracket(tree: { label: string; children: Array<string | { label: string; children: unknown[] }> }): string {
  const children = tree.children
    .map((child) => (typeof child === "string" ? child : toBracket(child as { label: string; children: unknown[] })))
    .join(" ");
  return `(${tree.label}${children ? ` ${children}` : ""})`;
}

function buildCases(size = 700): string[][] {
  const seed = [
    ["alice", "sees", "the", "dog"],
    ["bob", "likes", "a", "cat"],
    ["alice", "likes", "the", "cat"],
    ["bob", "sees", "a", "dog"],
  ];
  const out: string[][] = [];
  while (out.length < size) out.push(...seed);
  return out.slice(0, size);
}

function runNative(cases: string[][], rounds: number): { median_seconds: number; first: ProbabilisticParse | null } {
  const grammar = parsePcfgGrammar(grammarText);
  const timings: number[] = [];
  let first: ProbabilisticParse | null = null;
  for (let i = 0; i < rounds; i += 1) {
    const started = performance.now();
    for (const tokens of cases) {
      const parsed = probabilisticChartParse(tokens, grammar);
      if (!first && parsed) first = parsed;
    }
    timings.push((performance.now() - started) / 1000);
  }
  return { median_seconds: median(timings), first };
}

function runPython(cases: string[][], rounds: number): {
  parse_count: number;
  tree: string | null;
  prob: number;
  total_seconds: number;
} {
  const payload = JSON.stringify({ grammar: grammarText, cases, rounds });
  const proc = Bun.spawnSync(["python", "bench/python_pcfg_baseline.py", "--payload", payload], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) throw new Error(`python pcfg baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  return JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as {
    parse_count: number;
    tree: string | null;
    prob: number;
    total_seconds: number;
  };
}

function main() {
  const size = Number(process.argv[2] ?? "700");
  const rounds = Number(process.argv[3] ?? "3");
  const cases = buildCases(size);
  const native = runNative(cases, rounds);
  const python = runPython(cases, rounds);
  const nativeTree = native.first ? toBracket(native.first.tree as never) : null;
  const parityTree = nativeTree === python.tree;
  const parityProb = native.first ? Math.abs(native.first.prob - python.prob) <= 1e-6 : python.prob === 0;

  console.log(
    JSON.stringify(
      {
        case_count: cases.length,
        rounds,
        parity_tree: parityTree,
        parity_prob: parityProb,
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

