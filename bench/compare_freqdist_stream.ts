import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  NativeFreqDistStream,
  nativeLibraryPath,
} from "../index";

type PythonResult = {
  token_unique: number;
  token_total: number;
  bigram_unique: number;
  bigram_total: number;
  conditional_unique: number;
  conditional_total: number;
  total_seconds: number;
};

type NativeResult = {
  token_unique: number;
  token_total: number;
  bigram_unique: number;
  bigram_total: number;
  conditional_unique: number;
  conditional_total: number;
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

function runPython(inputPath: string, chunkSize: number): PythonResult {
  const proc = Bun.spawnSync(
    ["python", "bench/python_freqdist_stream_baseline.py", "--input", inputPath, "--chunk-size", String(chunkSize)],
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

function runNative(text: string, chunkSize: number): NativeResult {
  const stream = new NativeFreqDistStream();
  const started = performance.now();
  try {
    for (let i = 0; i < text.length; i += chunkSize) {
      stream.update(text.slice(i, i + chunkSize));
    }
    stream.flush();

    const tokens = stream.tokenFreqDistHash();
    const bigrams = stream.bigramFreqDistHash();
    const conditional = stream.conditionalFreqDistHash();

    const tokenTotal = [...tokens.values()].reduce((sum, value) => sum + value, 0);
    const bigramTotal = bigrams.reduce((sum, row) => sum + row.count, 0);
    const conditionalTotal = conditional.reduce((sum, row) => sum + row.count, 0);

    const elapsed = (performance.now() - started) / 1000;
    return {
      token_unique: tokens.size,
      token_total: tokenTotal,
      bigram_unique: bigrams.length,
      bigram_total: bigramTotal,
      conditional_unique: conditional.length,
      conditional_total: conditionalTotal,
      total_seconds: elapsed,
    };
  } finally {
    stream.dispose();
  }
}

function main() {
  const inputPath = process.argv[2] ?? "bench/datasets/synthetic.txt";
  const chunkSize = Number(process.argv[3] ?? "2048");

  ensureNativeBuilt();

  const absolutePath = resolve(import.meta.dir, "..", inputPath);
  const text = readFileSync(absolutePath, "utf8");
  const native = runNative(text, chunkSize);
  const python = runPython(inputPath, chunkSize);

  if (
    native.token_unique !== python.token_unique ||
    native.token_total !== python.token_total ||
    native.bigram_unique !== python.bigram_unique ||
    native.bigram_total !== python.bigram_total ||
    native.conditional_unique !== python.conditional_unique ||
    native.conditional_total !== python.conditional_total
  ) {
    throw new Error(`parity mismatch native=${JSON.stringify(native)} python=${JSON.stringify(python)}`);
  }

  const speedup = python.total_seconds / native.total_seconds;
  console.log(
    JSON.stringify(
      {
        dataset: inputPath,
        chunk_size: chunkSize,
        parity: true,
        native_seconds: native.total_seconds,
        python_seconds: python.total_seconds,
        speedup_vs_python: speedup,
        native,
        python,
      },
      null,
      2,
    ),
  );
}

main();
