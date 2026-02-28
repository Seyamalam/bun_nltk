import { rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { earleyParse, parseCfgGrammar } from "../index";

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

const grammarText = `
S -> NP VP
NP -> Det N | Name
VP -> V NP
Det -> 'the' | 'a'
N -> 'cat' | 'dog'
V -> 'sees' | 'likes'
Name -> 'alice'
`;

function generateCases(total = 2000): string[][] {
  const det = ["the", "a"];
  const noun = ["cat", "dog"];
  const verb = ["sees", "likes"];
  const out: string[][] = [];
  for (let i = 0; i < total; i += 1) {
    out.push(["alice", verb[i % verb.length]!, det[(i * 3 + 1) % det.length]!, noun[(i * 5 + 2) % noun.length]!]);
  }
  return out;
}

function runNative(cases: string[][], rounds: number): { median_seconds: number; parsed: number } {
  const grammar = parseCfgGrammar(grammarText);
  const timings: number[] = [];
  let parsed = 0;
  for (let r = 0; r < rounds; r += 1) {
    const started = performance.now();
    parsed = 0;
    for (const tokens of cases) parsed += earleyParse(tokens, grammar).length > 0 ? 1 : 0;
    timings.push((performance.now() - started) / 1000);
  }
  return { median_seconds: median(timings), parsed };
}

function runPython(cases: string[][]): { total_seconds: number; parsed: number } {
  const payloadPath = resolve(import.meta.dir, "datasets", "earley_compare_payload.json");
  writeFileSync(payloadPath, `${JSON.stringify({ grammar: grammarText, cases }, null, 2)}\n`, "utf8");
  const started = performance.now();
  const proc = Bun.spawnSync(["python", "bench/python_earley_baseline.py", "--payload-file", payloadPath], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  rmSync(payloadPath, { force: true });
  if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
  const parsed = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as {
    ok: boolean;
    results: Array<{ parse_count: number }>;
  };
  const total_seconds = (performance.now() - started) / 1000;
  const parsedCount = parsed.results.filter((r) => r.parse_count > 0).length;
  return { total_seconds, parsed: parsedCount };
}

function main() {
  const total = Number(process.argv[2] ?? "2000");
  const rounds = Number(process.argv[3] ?? "3");
  const cases = generateCases(total);
  const native = runNative(cases, rounds);
  const python = runPython(cases);
  const parity = native.parsed === python.parsed;
  console.log(
    JSON.stringify(
      {
        case_count: total,
        rounds,
        parsed_native: native.parsed,
        parsed_python: python.parsed,
        parity,
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
