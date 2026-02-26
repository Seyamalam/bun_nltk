import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  computeAsciiMetrics,
  nativeLibraryPath,
} from "../index";

type PythonResult = {
  tokens: number;
  unique_tokens: number;
  ngrams: number;
  unique_ngrams: number;
  tokenize_seconds: number;
  count_seconds: number;
  total_seconds: number;
};

function ensureNativeBuilt(): void {
  const path = nativeLibraryPath();
  if (existsSync(path)) return;

  const build = Bun.spawnSync(["bun", "run", "build:zig"], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "inherit",
    stderr: "inherit",
  });

  if (build.exitCode !== 0) {
    throw new Error("failed to build native library");
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function runNative(text: string, n: number, rounds: number) {
  const timings: number[] = [];
  let result = { tokens: 0, uniqueTokens: 0, ngrams: 0, uniqueNgrams: 0 };

  for (let i = 0; i < rounds; i += 1) {
    const started = performance.now();
    result = computeAsciiMetrics(text, n);
    const elapsedMs = performance.now() - started;
    timings.push(elapsedMs / 1000);
  }

  return {
    ...result,
    medianSeconds: median(timings),
    timings,
  };
}

function runPython(inputPath: string, n: number): PythonResult {
  const proc = Bun.spawnSync(["python", "bench/python_baseline.py", "--input", inputPath, "--n", String(n)], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });

  if (proc.exitCode !== 0) {
    const stderr = new TextDecoder().decode(proc.stderr);
    throw new Error(`python baseline failed: ${stderr}`);
  }

  const stdout = new TextDecoder().decode(proc.stdout).trim();
  return JSON.parse(stdout) as PythonResult;
}

function main() {
  const inputPath = process.argv[2] ?? "bench/datasets/synthetic.txt";
  const n = Number(process.argv[3] ?? "2");
  const rounds = Number(process.argv[4] ?? "5");

  ensureNativeBuilt();

  const absolutePath = resolve(import.meta.dir, "..", inputPath);
  const text = readFileSync(absolutePath, "utf8");

  const native = runNative(text, n, rounds);
  const py = runPython(inputPath, n);

  if (
    native.tokens !== py.tokens ||
    native.uniqueTokens !== py.unique_tokens ||
    native.ngrams !== py.ngrams ||
    native.uniqueNgrams !== py.unique_ngrams
  ) {
    throw new Error(
      `parity mismatch: native=${JSON.stringify(native)} python=${JSON.stringify(py)}`,
    );
  }

  const speedup = py.total_seconds / native.medianSeconds;

  console.log(JSON.stringify({
    dataset: inputPath,
    n,
    rounds,
    parity: true,
    native_seconds_median: native.medianSeconds,
    python_seconds: py.total_seconds,
    speedup_vs_python: speedup,
    native,
    python: py,
  }, null, 2));
}

main();
