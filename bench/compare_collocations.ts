import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { topPmiBigramsAscii } from "../index";

type PythonResult = {
  total_seconds: number;
  top: [string, string, number][];
  token_count: number;
  unique_bigram_count: number;
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1]! + sorted[mid]!) / 2;
  return sorted[mid]!;
}

function runNative(text: string, topK: number, rounds: number) {
  const timings: number[] = [];
  let result = topPmiBigramsAscii(text, topK);

  for (let i = 0; i < rounds; i += 1) {
    const started = performance.now();
    result = topPmiBigramsAscii(text, topK);
    timings.push((performance.now() - started) / 1000);
  }

  return {
    top: result,
    timings,
    medianSeconds: median(timings),
  };
}

function runPython(inputPath: string, topK: number): PythonResult {
  const proc = Bun.spawnSync(
    ["python", "bench/python_collocations_baseline.py", "--input", inputPath, "--top-k", String(topK)],
    {
      cwd: resolve(import.meta.dir, ".."),
      stdout: "pipe",
      stderr: "pipe",
    },
  );

  if (proc.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(proc.stderr));
  }

  return JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as PythonResult;
}

function ensureParity(nativeTop: ReturnType<typeof runNative>["top"], pythonTop: PythonResult["top"]) {
  if (nativeTop.length !== pythonTop.length) {
    throw new Error(`top length mismatch native=${nativeTop.length} python=${pythonTop.length}`);
  }

  for (let i = 0; i < pythonTop.length; i += 1) {
    const [pl, pr, ps] = pythonTop[i]!;
    const n = nativeTop[i]!;
    if (n.leftHash !== BigInt(pl) || n.rightHash !== BigInt(pr) || Math.abs(n.score - ps) > 1e-10) {
      throw new Error(`parity mismatch at index ${i}`);
    }
  }
}

function main() {
  const inputPath = process.argv[2] ?? "bench/datasets/synthetic.txt";
  const topK = Number(process.argv[3] ?? "50");
  const rounds = Number(process.argv[4] ?? "5");

  const abs = resolve(import.meta.dir, "..", inputPath);
  const text = readFileSync(abs, "utf8");

  const native = runNative(text, topK, rounds);
  const python = runPython(inputPath, topK);
  ensureParity(native.top, python.top);

  const speedup = python.total_seconds / native.medianSeconds;

  console.log(
    JSON.stringify(
      {
        dataset: inputPath,
        topK,
        rounds,
        parity: true,
        native_seconds_median: native.medianSeconds,
        python_seconds: python.total_seconds,
        speedup_vs_python: speedup,
      },
      null,
      2,
    ),
  );
}

main();
