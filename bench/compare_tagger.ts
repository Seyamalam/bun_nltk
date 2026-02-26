import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { posTagAsciiNative } from "../index";

type PythonResult = {
  token_count: number;
  tags: Array<{ token: string; tag: string }>;
  total_seconds: number;
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function runNative(text: string, rounds: number) {
  const timings: number[] = [];
  let tags: Array<{ token: string; tag: string }> = [];

  for (let i = 0; i < rounds; i += 1) {
    const started = performance.now();
    tags = posTagAsciiNative(text).map((row) => ({ token: row.token, tag: row.tag }));
    timings.push((performance.now() - started) / 1000);
  }

  return {
    token_count: tags.length,
    tags,
    median_seconds: median(timings),
  };
}

function runPython(inputPath: string): PythonResult {
  const proc = Bun.spawnSync(["python", "bench/python_tagger_baseline.py", "--input", inputPath], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });

  if (proc.exitCode !== 0) {
    throw new Error(`python tagger baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  }

  return JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as PythonResult;
}

function main() {
  const inputPath = process.argv[2] ?? "bench/datasets/synthetic.txt";
  const rounds = Number(process.argv[3] ?? "3");

  const absPath = resolve(import.meta.dir, "..", inputPath);
  const text = readFileSync(absPath, "utf8");
  const native = runNative(text, rounds);
  const python = runPython(inputPath);

  const parity = JSON.stringify(native.tags.slice(0, 2000)) === JSON.stringify(python.tags.slice(0, 2000));

  if (native.token_count !== python.token_count) {
    throw new Error("tagger token_count mismatch");
  }

  console.log(
    JSON.stringify(
      {
        dataset: inputPath,
        rounds,
        parity_sample_2000: parity,
        native_seconds_median: native.median_seconds,
        python_seconds: python.total_seconds,
        speedup_vs_python: python.total_seconds / native.median_seconds,
        token_count: native.token_count,
      },
      null,
      2,
    ),
  );
}

main();
