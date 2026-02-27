import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { computeAsciiMetrics, WasmNltk } from "../index";

type PythonResult = {
  tokens: number;
  ngrams: number;
  total_seconds: number;
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function runNative(text: string, n: number, rounds: number) {
  const timings: number[] = [];
  let metrics = { tokens: 0, uniqueTokens: 0, ngrams: 0, uniqueNgrams: 0 };
  for (let i = 0; i < rounds; i += 1) {
    const started = performance.now();
    metrics = computeAsciiMetrics(text, n);
    timings.push((performance.now() - started) / 1000);
  }
  return {
    tokens: metrics.tokens,
    ngrams: metrics.ngrams,
    medianSeconds: median(timings),
  };
}

async function runWasm(text: string, n: number, rounds: number) {
  const wasm = await WasmNltk.init();
  try {
    const timings: number[] = [];
    let metrics = { tokens: 0, uniqueTokens: 0, ngrams: 0, uniqueNgrams: 0 };
    for (let i = 0; i < rounds; i += 1) {
      const started = performance.now();
      metrics = wasm.computeAsciiMetrics(text, n);
      timings.push((performance.now() - started) / 1000);
    }
    return {
      tokens: metrics.tokens,
      ngrams: metrics.ngrams,
      medianSeconds: median(timings),
    };
  } finally {
    wasm.dispose();
  }
}

function runPython(inputPath: string, n: number): PythonResult {
  const proc = Bun.spawnSync(["python", "bench/python_baseline.py", "--input", inputPath, "--n", String(n)], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(proc.stderr));
  }
  return JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as PythonResult;
}

async function main() {
  const inputPath = process.argv[2] ?? "bench/datasets/synthetic.txt";
  const n = Number(process.argv[3] ?? "2");
  const rounds = Number(process.argv[4] ?? "5");

  const root = resolve(import.meta.dir, "..");
  const text = readFileSync(resolve(root, inputPath), "utf8");

  const native = runNative(text, n, rounds);
  const wasm = await runWasm(text, n, rounds);
  const python = runPython(inputPath, n);

  if (native.tokens !== python.tokens || native.ngrams !== python.ngrams) {
    throw new Error("native/python parity mismatch");
  }
  if (wasm.tokens !== python.tokens || wasm.ngrams !== python.ngrams) {
    throw new Error("wasm/python parity mismatch");
  }

  console.log(
    JSON.stringify(
      {
        dataset: inputPath,
        n,
        rounds,
        parity: true,
        tokens: python.tokens,
        ngrams: python.ngrams,
        native_seconds_median: native.medianSeconds,
        wasm_seconds_median: wasm.medianSeconds,
        python_seconds: python.total_seconds,
        native_speedup_vs_python: python.total_seconds / native.medianSeconds,
        wasm_speedup_vs_python: python.total_seconds / wasm.medianSeconds,
      },
      null,
      2,
    ),
  );
}

await main();
