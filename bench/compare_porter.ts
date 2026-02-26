import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { porterStemAscii, tokenizeAscii } from "../index";

type PythonResult = {
  token_count: number;
  sample: string[];
  total_seconds: number;
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function runNative(text: string, rounds: number) {
  const tokens = tokenizeAscii(text);
  const timings: number[] = [];
  let sample: string[] = [];

  for (let i = 0; i < rounds; i += 1) {
    const started = performance.now();
    const stems = tokens.map((t) => porterStemAscii(t));
    timings.push((performance.now() - started) / 1000);
    sample = stems.slice(0, 50);
  }

  return {
    tokenCount: tokens.length,
    sample,
    medianSeconds: median(timings),
  };
}

function runPython(inputPath: string): PythonResult {
  const proc = Bun.spawnSync(["python", "bench/python_porter_baseline.py", "--input", inputPath], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });

  if (proc.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(proc.stderr));
  }

  return JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as PythonResult;
}

function main() {
  const inputPath = process.argv[2] ?? "bench/datasets/synthetic.txt";
  const rounds = Number(process.argv[3] ?? "3");

  const text = readFileSync(resolve(import.meta.dir, "..", inputPath), "utf8");
  const native = runNative(text, rounds);
  const python = runPython(inputPath);

  if (native.tokenCount !== python.token_count) {
    throw new Error(`token count mismatch native=${native.tokenCount} python=${python.token_count}`);
  }
  if (JSON.stringify(native.sample) !== JSON.stringify(python.sample)) {
    throw new Error("sample stem mismatch");
  }

  const speedup = python.total_seconds / native.medianSeconds;

  console.log(
    JSON.stringify(
      {
        dataset: inputPath,
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
