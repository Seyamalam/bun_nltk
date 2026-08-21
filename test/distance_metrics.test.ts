import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  binaryDistance,
  customDistance,
  editDistanceAlign,
  fMeasure,
  fractionalPresence,
  intervalDistance,
  jaccardDistance,
  metricsLogLikelihood as logLikelihood,
  masiDistance,
  pk,
  precision,
  presence,
  recall,
  sorensenDiceDistance,
  sorensenDiceSimilarity,
  spearmanCorrelation,
  windowdiff,
} from "../index";

test("jaccardDistance matches NLTK semantics", () => {
  expect(jaccardDistance(new Set(["a", "b", "c"]), new Set(["a", "b", "d"]))).toBe(0.5);
  expect(jaccardDistance(new Set([1, 2, 3]), new Set([1, 2, 3]))).toBe(0);
  expect(jaccardDistance(new Set(["x"]), new Set(["y"]))).toBe(1);
});

test("jaccardDistance raises for two empty sets like NLTK's ZeroDivisionError", () => {
  // Verified against nltk 3.10.3: jaccard_distance(set(), set()) raises
  // ZeroDivisionError because the union size divides unguarded.
  expect(() => jaccardDistance(new Set(), new Set())).toThrow();
});

test("masiDistance uses NLTK 3.10.3 weights (1, 2/3, 1/3, 0)", () => {
  expect(masiDistance(new Set([1, 2]), new Set([1, 2, 3, 4]))).toBeCloseTo(0.6666666666666667, 12);
  expect(masiDistance(new Set([1, 2]), new Set([1, 2]))).toBe(1 - (2 / 2) * 1);
  expect(masiDistance(new Set([1, 2]), new Set([2, 3]))).toBeCloseTo(1 - (1 / 3) * (1 / 3), 12);
  expect(masiDistance(new Set([1]), new Set([2]))).toBe(1);
});

test("binaryDistance is 0 for identical labels and 1 otherwise", () => {
  expect(binaryDistance(1, 1)).toBe(0.0);
  expect(binaryDistance(1, 3)).toBe(1.0);
  expect(binaryDistance("a", "a")).toBe(0.0);
});

test("sorensenDiceSimilarity/Distance follow the canonical definition", () => {
  const a = new Set(["a", "b", "c"]);
  const b = new Set(["a", "b", "d"]);
  expect(sorensenDiceSimilarity(a, b)).toBeCloseTo(2 / 3, 12);
  expect(sorensenDiceDistance(a, b)).toBeCloseTo(1 / 3, 12);
  expect(sorensenDiceSimilarity(new Set([1]), new Set([1]))).toBe(1);
});

test("intervalDistance squares the numeric difference", () => {
  expect(intervalDistance(1, 10)).toBe(81);
  expect(intervalDistance(4, -5)).toBe(81);
  expect(intervalDistance(0, 0)).toBe(0);
});

test("presence returns a membership-agreement distance function", () => {
  const d = presence("a");
  expect(d(new Set(["a", "b"]), new Set(["a"]))).toBe(1.0);
  expect(d(new Set(["a"]), new Set(["b"]))).toBe(0.0);
  expect(d(new Set(), new Set())).toBe(1.0);
});

test("fractionalPresence weights by fractional membership", () => {
  const d = fractionalPresence("a");
  expect(d(new Set(["a"]), new Set(["a", "b"]))).toBeCloseTo(Math.abs(1 - 0.5), 12);
  expect(d(new Set(["a"]), new Set(["b"]))).toBeCloseTo(1, 12);
  expect(d(new Set(["b"]), new Set(["a"]))).toBeCloseTo(1, 12);
  expect(d(new Set(["b"]), new Set(["c"]))).toBe(0);
});

test("customDistance reads an unordered TSV lookup table", () => {
  const dir = mkdtempSync(resolve(tmpdir(), "distance-metrics-"));
  try {
    const file = resolve(dir, "dist.tsv");
    writeFileSync(file, "a\tb\t0.5\nx\ty\t0.25\n");
    const d = customDistance(file);
    expect(d("a", "b")).toBe(0.5);
    expect(d("b", "a")).toBe(0.5);
    expect(d("y", "x")).toBe(0.25);
    expect(() => d("a", "c")).toThrow();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("editDistanceAlign reproduces NLTK doctest alignments", () => {
  expect(editDistanceAlign("shine", "shine")).toEqual([
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 4],
    [5, 5],
  ]);
  expect(editDistanceAlign("rain", "brainy")).toEqual([
    [0, 0],
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [4, 6],
  ]);
  expect(editDistanceAlign("", "brainy")).toEqual([
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
    [0, 5],
    [0, 6],
  ]);
  expect(editDistanceAlign("", "")).toEqual([[0, 0]]);
});

test("precision/recall/fMeasure match NLTK scores semantics incl. None cases", () => {
  const ref = new Set(["a", "b", "c"]);
  const test = new Set(["a", "b", "d"]);
  expect(precision(ref, test)).toBeCloseTo(2 / 3, 12);
  expect(recall(ref, test)).toBeCloseTo(2 / 3, 12);
  expect(fMeasure(ref, test)).toBeCloseTo(2 / 3, 12);

  expect(precision(new Set(["a"]), new Set())).toBeNull();
  expect(recall(new Set(), new Set(["a"]))).toBeNull();
  expect(fMeasure(new Set(["a"]), new Set())).toBeNull();

  const disjointRef = new Set(["x"]);
  const disjointTest = new Set(["y"]);
  expect(precision(disjointRef, disjointTest)).toBe(0);
  expect(fMeasure(disjointRef, disjointTest)).toBe(0);

  expect(fMeasure(new Set(["a", "b"]), new Set(["b", "a"]), 0.75)).toBe(1);
});

test("logLikelihood averages base-2 log probabilities", () => {
  const ll = logLikelihood(
    ["a", "b"],
    [
      { a: 0.7, b: 0.3 },
      { a: 0.2, b: 0.8 },
    ],
  );
  expect(ll).toBeCloseTo((Math.log2(0.7) + Math.log2(0.8)) / 2, 12);
  expect(() => logLikelihood(["a"], [])).toThrow();
});

test("windowdiff matches NLTK doctests", () => {
  const s1 = "000100000010";
  const s2 = "000010000100";
  const s3 = "100000010000";
  expect(windowdiff(s1, s1, 3)).toBeCloseTo(0.0, 12);
  expect(windowdiff(s1, s2, 3)).toBeCloseTo(0.3, 12);
  expect(windowdiff(s2, s3, 3)).toBeCloseTo(0.8, 12);
  expect(windowdiff(s1, s2, 3, "1", true)).toBeCloseTo(0.3, 12);
  expect(() => windowdiff("01", "011", 1)).toThrow();
});

test("pk matches NLTK doctests and defaults k via half-even rounding", () => {
  const ref = "0100".repeat(100);
  // NLTK doctest prints '%.2f' -> '0.50' for the raw value 0.4987...
  expect(pk(ref, "1".repeat(400), 2)).toBeCloseTo(0.5, 2);
  expect(pk(ref, "0".repeat(400), 2)).toBeCloseTo(0.5, 2);
  expect(pk(ref, ref, 2)).toBeCloseTo(0.0, 12);
  // k omitted: k = round(len/(boundaryCount*2)) with Python half-to-even
  // -> round(400/(100*2)) = 2, identical result to passing k=2 explicitly.
  expect(pk(ref, "1".repeat(400))).toBe(pk(ref, "1".repeat(400), 2));
});

test("spearmanCorrelation handles dicts, pair sequences, and undefined cases", () => {
  expect(spearmanCorrelation({ a: 1, b: 2, c: 3 }, { a: 1, b: 3, c: 2 })).toBeCloseTo(0.5, 12);
  expect(spearmanCorrelation({ a: 1, b: 2, c: 3 }, { a: 3, b: 2, c: 1 })).toBe(-1);
  expect(
    spearmanCorrelation(
      [
        ["a", 1],
        ["b", 2],
      ],
      [
        ["a", 2],
        ["b", 1],
      ],
    ),
  ).toBe(-1);
  // Undefined with fewer than two shared keys -> 0.0 (NLTK fallback).
  expect(spearmanCorrelation({ a: 1 }, { a: 1 })).toBe(0.0);
});

type PythonDistanceResult = {
  jaccard: number[];
  masi: number[];
  binary: number[];
  interval: number[];
  align: number[][][];
  precision: Array<number | null>;
  recall: Array<number | null>;
  f_measure: Array<number | null>;
  loglik: number[];
  windowdiff: number[];
  pk: number[];
  spearman: number[];
};

function runPythonBaseline(payload: unknown): PythonDistanceResult {
  const proc = Bun.spawnSync(
    ["python3", "bench/python_distance_baseline.py", "--payload", JSON.stringify(payload)],
    {
      cwd: resolve(import.meta.dir, ".."),
      stdout: "pipe",
      stderr: "pipe",
    },
  );

  if (proc.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(proc.stderr));
  }

  return JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as PythonDistanceResult;
}

test("python3 baseline parity for distance metrics", () => {
  const payload = {
    jaccard_pairs: [
      [["a", "b", "c"], ["a", "b", "d"]],
      [[1, 2, 3], [1, 2, 3]],
    ],
    masi_pairs: [
      [[1, 2], [1, 2, 3, 4]],
      [[1, 2], [2, 3]],
    ],
    binary_pairs: [
      ["same", "same"],
      ["a", "b"],
    ],
    interval_pairs: [
      [1, 10],
      [4, -5],
    ],
    align_pairs: [
      ["rain", "brainy"],
      ["kitten", "sitting"],
      ["", ""],
    ],
    prf_pairs: [
      [["a", "b", "c"], ["a", "b", "d"]],
      [["a"], []],
    ],
    prf_alpha_cases: [[["a", "b", "c"], ["a", "b", "d"], 0.25]],
    loglik_cases: [[["a", "b"], [{ a: 0.7, b: 0.3 }, { a: 0.2, b: 0.8 }]]],
    windowdiff_cases: [["000100000010", "000010000100", 3, "1", false]],
    pk_cases: [["0100010000", "1111111111", 2, "1"]],
    spearman_cases: [[{ a: 1, b: 2, c: 3 }, { a: 1, b: 3, c: 2 }]],
  };

  const py = runPythonBaseline(payload);

  expect(jaccardDistance(new Set(payload.jaccard_pairs[0][0]), new Set(payload.jaccard_pairs[0][1]))).toBe(py.jaccard[0]);
  expect(masiDistance(new Set(payload.masi_pairs[0][0]), new Set(payload.masi_pairs[0][1]))).toBe(py.masi[0]);
  expect(binaryDistance(...payload.binary_pairs[0])).toBe(py.binary[0]);
  expect(intervalDistance(...payload.interval_pairs[0])).toBe(py.interval[0]);
  expect(editDistanceAlign(...payload.align_pairs[0])).toEqual(py.align[0]);
  expect(precision(new Set(payload.prf_pairs[0][0]), new Set(payload.prf_pairs[0][1]))).toBe(py.precision[0]);
  expect(recall(new Set(payload.prf_pairs[0][0]), new Set(payload.prf_pairs[0][1]))).toBe(py.recall[0]);
  expect(fMeasure(new Set(payload.prf_alpha_cases[0][0]), new Set(payload.prf_alpha_cases[0][1]), payload.prf_alpha_cases[0][2])).toBe(py.f_measure[0]);
  expect(logLikelihood(...payload.loglik_cases[0])).toBe(py.loglik[0]);
  expect(windowdiff(...payload.windowdiff_cases[0])).toBe(py.windowdiff[0]);
  expect(pk(...payload.pk_cases[0])).toBe(py.pk[0]);
  expect(spearmanCorrelation(...payload.spearman_cases[0])).toBe(py.spearman[0]);

  // Empty-test precision maps to Python None -> JSON null.
  expect(precision(new Set(payload.prf_pairs[1][0]), new Set(payload.prf_pairs[1][1]))).toBe(py.precision[1]);
});
