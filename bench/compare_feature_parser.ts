import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { featureChartParse, parseFeatureCfgGrammar } from "../index";

const grammarText = `
S[num=?n] -> NP[num=?n] VP[num=?n]
NP[num=sg] -> 'dog'
NP[num=pl] -> 'dogs'
VP[num=sg] -> 'runs'
VP[num=pl] -> 'run'
`;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function buildCases(size = 1200): string[][] {
  const base = [
    ["dog", "runs"],
    ["dogs", "run"],
  ];
  const out: string[][] = [];
  while (out.length < size) out.push(...base);
  return out.slice(0, size);
}

function runNative(cases: string[][], rounds: number) {
  const grammar = parseFeatureCfgGrammar(grammarText);
  const timings: number[] = [];
  let firstCount = 0;
  for (let i = 0; i < rounds; i += 1) {
    const started = performance.now();
    for (const tokens of cases) {
      const trees = featureChartParse(tokens, grammar);
      if (firstCount === 0) firstCount = trees.length;
    }
    timings.push((performance.now() - started) / 1000);
  }
  return {
    median_seconds: median(timings),
    first_count: firstCount,
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
  const payloadPath = resolve(artifacts, `feature_parser_payload_${Date.now()}.json`);
  writeFileSync(payloadPath, payload, "utf8");
  const proc = Bun.spawnSync(["python", "bench/python_feature_parser_baseline.py", "--payload-file", payloadPath], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    throw new Error(`python feature parser baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  }
  return JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as {
    parse_count: number;
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
