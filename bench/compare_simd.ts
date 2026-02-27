import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  countNormalizedTokensAscii,
  countNormalizedTokensAsciiScalar,
  countTokensAscii,
  countTokensAsciiScalar,
} from "../index";

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function measure(fn: () => number, rounds: number): { medianSeconds: number; value: number } {
  const times: number[] = [];
  let value = 0;
  for (let i = 0; i < rounds; i += 1) {
    const started = performance.now();
    value = fn();
    times.push((performance.now() - started) / 1000);
  }
  return { medianSeconds: median(times), value };
}

function main() {
  const inputPath = process.argv[2] ?? "bench/datasets/synthetic.txt";
  const rounds = Number(process.argv[3] ?? "5");
  const text = readFileSync(resolve(import.meta.dir, "..", inputPath), "utf8");

  const tokenFast = measure(() => countTokensAscii(text), rounds);
  const tokenScalar = measure(() => countTokensAsciiScalar(text), rounds);
  if (tokenFast.value !== tokenScalar.value) throw new Error("token parity mismatch");

  const normFast = measure(() => countNormalizedTokensAscii(text, false), rounds);
  const normScalar = measure(() => countNormalizedTokensAsciiScalar(text, false), rounds);
  if (normFast.value !== normScalar.value) throw new Error("normalized parity mismatch");

  console.log(
    JSON.stringify(
      {
        dataset: inputPath,
        rounds,
        token: {
          fast_seconds_median: tokenFast.medianSeconds,
          scalar_seconds_median: tokenScalar.medianSeconds,
          speedup_vs_scalar: tokenScalar.medianSeconds / tokenFast.medianSeconds,
          value: tokenFast.value,
        },
        normalization_no_stopwords: {
          fast_seconds_median: normFast.medianSeconds,
          scalar_seconds_median: normScalar.medianSeconds,
          speedup_vs_scalar: normScalar.medianSeconds / normFast.medianSeconds,
          value: normFast.value,
        },
      },
      null,
      2,
    ),
  );
}

main();
