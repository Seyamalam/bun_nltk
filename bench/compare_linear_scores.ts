import { rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { linearScoresSparseIdsNative } from "../index";

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function checksum(values: Float64Array): number {
  let acc = 0;
  for (let i = 0; i < values.length; i += 1) acc += values[i]! * ((i % 97) + 1);
  return acc;
}

function jsScores(input: {
  docOffsets: Uint32Array;
  featureIds: Uint32Array;
  featureValues: Float64Array;
  classCount: number;
  featureCount: number;
  weights: Float64Array;
  bias: Float64Array;
}): Float64Array {
  const docs = input.docOffsets.length - 1;
  const out = new Float64Array(docs * input.classCount);
  for (let d = 0; d < docs; d += 1) {
    const start = input.docOffsets[d]!;
    const end = input.docOffsets[d + 1]!;
    const base = d * input.classCount;
    for (let c = 0; c < input.classCount; c += 1) out[base + c] = input.bias[c]!;
    for (let i = start; i < end; i += 1) {
      const fid = input.featureIds[i]!;
      if (fid >= input.featureCount) continue;
      const value = input.featureValues[i]!;
      for (let c = 0; c < input.classCount; c += 1) {
        out[base + c] += input.weights[c * input.featureCount + fid]! * value;
      }
    }
  }
  return out;
}

function makeRng(seed = 1337): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state;
  };
}

function generateInput(docCount: number, featureCount: number, classCount: number, nnzPerDoc: number) {
  const rng = makeRng(1337);
  const docOffsets = new Uint32Array(docCount + 1);
  const featureIds = new Uint32Array(docCount * nnzPerDoc);
  const featureValues = new Float64Array(docCount * nnzPerDoc);

  let cursor = 0;
  for (let d = 0; d < docCount; d += 1) {
    docOffsets[d] = cursor;
    for (let j = 0; j < nnzPerDoc; j += 1) {
      featureIds[cursor] = rng() % featureCount;
      featureValues[cursor] = ((rng() % 1000) + 1) / 1000;
      cursor += 1;
    }
  }
  docOffsets[docCount] = cursor;

  const weights = new Float64Array(classCount * featureCount);
  for (let i = 0; i < weights.length; i += 1) {
    weights[i] = ((rng() % 2001) - 1000) / 5000;
  }
  const bias = new Float64Array(classCount);
  for (let i = 0; i < classCount; i += 1) bias[i] = ((rng() % 2001) - 1000) / 1000;

  return { docOffsets, featureIds, featureValues, classCount, featureCount, weights, bias };
}

function runNative(
  input: ReturnType<typeof generateInput>,
  rounds: number,
): { medianSeconds: number; out: Float64Array; checksum: number } {
  const timings: number[] = [];
  let out = new Float64Array(0);
  for (let i = 0; i < rounds; i += 1) {
    const started = performance.now();
    out = linearScoresSparseIdsNative(input);
    timings.push((performance.now() - started) / 1000);
  }
  return {
    medianSeconds: median(timings),
    out,
    checksum: checksum(out),
  };
}

function runPython(input: ReturnType<typeof generateInput>, rounds: number): { total_seconds: number; checksum: number } {
  const payloadPath = resolve(import.meta.dir, "datasets", "linear_scores_payload.json");
  const payload = {
    doc_offsets: [...input.docOffsets],
    feature_ids: [...input.featureIds],
    feature_values: [...input.featureValues],
    class_count: input.classCount,
    feature_count: input.featureCount,
    weights: [...input.weights],
    bias: [...input.bias],
    rounds,
  };
  writeFileSync(payloadPath, `${JSON.stringify(payload)}\n`, "utf8");
  const proc = Bun.spawnSync(["python", "bench/python_linear_scores_baseline.py", "--payload-file", payloadPath], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  rmSync(payloadPath, { force: true });
  if (proc.exitCode !== 0) {
    throw new Error(`python linear baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  }
  return JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as { total_seconds: number; checksum: number };
}

function main() {
  const docCount = Number(process.argv[2] ?? "6000");
  const featureCount = Number(process.argv[3] ?? "12000");
  const classCount = Number(process.argv[4] ?? "6");
  const nnzPerDoc = Number(process.argv[5] ?? "40");
  const rounds = Number(process.argv[6] ?? "5");
  const input = generateInput(docCount, featureCount, classCount, nnzPerDoc);

  const native = runNative(input, rounds);
  const js = jsScores(input);
  let maxAbsDiff = 0;
  for (let i = 0; i < js.length; i += 1) {
    const diff = Math.abs(js[i]! - native.out[i]!);
    if (diff > maxAbsDiff) maxAbsDiff = diff;
  }
  const py = runPython(input, rounds);

  console.log(
    JSON.stringify(
      {
        doc_count: docCount,
        feature_count: featureCount,
        class_count: classCount,
        nnz_per_doc: nnzPerDoc,
        rounds,
        native_seconds_median: native.medianSeconds,
        python_seconds: py.total_seconds,
        speedup_vs_python: py.total_seconds / native.medianSeconds,
        percent_faster: (py.total_seconds / native.medianSeconds - 1) * 100,
        native_checksum: native.checksum,
        python_checksum: py.checksum,
        checksum_abs_delta: Math.abs(native.checksum - py.checksum),
        max_abs_diff_vs_js: maxAbsDiff,
      },
      null,
      2,
    ),
  );
}

main();
