import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sentenceTokenizePunkt } from "../index";

type PythonResult = {
  sentence_count: number;
  sentences: string[];
  total_seconds: number;
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function runNative(text: string, rounds: number) {
  const timings: number[] = [];
  let sentences: string[] = [];
  for (let i = 0; i < rounds; i += 1) {
    const started = performance.now();
    sentences = sentenceTokenizePunkt(text);
    timings.push((performance.now() - started) / 1000);
  }
  return {
    sentence_count: sentences.length,
    sample: sentences.slice(0, 100),
    median_seconds: median(timings),
  };
}

function runPython(inputPath: string): PythonResult {
  const proc = Bun.spawnSync(["python", "bench/python_sentence_baseline.py", "--input", inputPath, "--rounds", "1"], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    throw new Error(`python sentence baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  }
  return JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as PythonResult;
}

function main() {
  const inputPath = process.argv[2] ?? "bench/datasets/synthetic.txt";
  const rounds = Number(process.argv[3] ?? "5");
  const absPath = resolve(import.meta.dir, "..", inputPath);
  const text = readFileSync(absPath, "utf8");

  const native = runNative(text, rounds);
  const python = runPython(inputPath);
  const paritySample = JSON.stringify(native.sample) === JSON.stringify(python.sentences.slice(0, native.sample.length));

  console.log(
    JSON.stringify(
      {
        dataset: inputPath,
        rounds,
        parity_sample: paritySample,
        parity_sentence_count: native.sentence_count === python.sentence_count,
        native_seconds_median: native.median_seconds,
        python_seconds: python.total_seconds,
        speedup_vs_python: python.total_seconds / native.median_seconds,
        native_sentence_count: native.sentence_count,
        python_sentence_count: python.sentence_count,
      },
      null,
      2,
    ),
  );
}

main();
