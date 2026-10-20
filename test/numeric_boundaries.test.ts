import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { kmeansFitEuclideanNative, linearScoresSparseIdsNative, linearTrainSparseIdsNative, perceptronPredictBatchNative } from "../src/native";
import { WasmNltk } from "../src/wasm";

const ids = Uint32Array.of(0), offsets = Uint32Array.of(0, 1), weights = Float32Array.of(1, 0);

test("native and WASM perceptron validate dimensions, offsets and weight capacity before allocation", async () => {
  const wasm = await WasmNltk.init();
  try {
    const predict = wasm.perceptronPredictBatch.bind(wasm);
    for (const run of [predict, perceptronPredictBatchNative]) {
      for (const count of [0, -1, 1.5, NaN, Infinity, 65537, 2 ** 32 + 2]) {
        expect(() => run(ids, offsets, weights, 1, count)).toThrow(RangeError);
      }
      for (const count of [-1, 1.5, NaN, Infinity, 2 ** 32 + 1]) {
        expect(() => run(ids, offsets, weights, count, 2)).toThrow(RangeError);
      }
      expect(() => run(ids, offsets, Float32Array.of(1), 1, 2)).toThrow("weights length");
      for (const row of [[0, 2], [1, 1], [0, 1, 0], [0, 0], []]) {
        expect(() => run(ids, Uint32Array.from(row), weights, 1, 2)).toThrow(RangeError);
      }
      for (const value of [NaN, Infinity, -Infinity]) {
        expect(() => run(ids, offsets, Float32Array.of(value, 0), 1, 2)).toThrow("finite");
      }
      expect([...run(ids, offsets, weights, 1, 2)]).toEqual([0]);
      expect([...run(new Uint32Array(), new Uint32Array(), new Float32Array(), 0, 2)]).toEqual([]);
      expect([...run(Uint32Array.of(0xffffffff), Uint32Array.of(0, 0, 1), new Float32Array(), 0, 2)]).toEqual([0, 0]);
      const fullTags = new Float32Array(65536);
      fullTags[65535] = 1;
      expect([...run(ids, offsets, fullTags, 1, 65536)]).toEqual([65535]);
      expect(() => run(Uint32Array.of(0, 0), Uint32Array.of(0, 2), Float32Array.of(3e38), 1, 1)).toThrow();
    }
    const initial = wasm.memoryBytes;
    expect(() => predict(ids, offsets, weights, 0xffffffff, 65536)).toThrow(RangeError);
    expect(wasm.memoryBytes).toBe(initial);
  } finally { wasm.dispose(); }
});

test("WASM perceptron ABI rejects undersized weights and overflowing dimensions before reading pointers", () => {
  const instance = new WebAssembly.Instance(new WebAssembly.Module(readFileSync(new URL("../native/bun_nltk.wasm", import.meta.url))), {});
  const run = instance.exports.bunnltk_wasm_perceptron_predict_batch as (...args: number[]) => void;
  const error = instance.exports.bunnltk_wasm_last_error_code as () => number;
  expect(run.length).toBe(9);
  run(1, 1, 1, 1, 1, 1, 2, 1, 1);
  expect(error()).toBe(3); // insufficient capacity; no pointer is dereferenced
  run(1, 1, 1, 1, 1, 0xffffffff, 65536, 1, 0xffffffff);
  expect(error()).toBe(3);
  run(1, 1, 1, 1, 1, 1, 65537, 1, 65537);
  expect(error()).toBe(1);
});

const sparse = { docOffsets: offsets, featureIds: ids, featureValues: Float64Array.of(1), classCount: 1, featureCount: 1 };
const training = { ...sparse, labelIds: Uint32Array.of(0), algorithm: "logistic" as const, epochs: 1, learningRate: 0.1, l2: 0 };
const scoring = { ...sparse, weights: Float64Array.of(1), bias: Float64Array.of(0) };

test("native sparse linear APIs reject malformed offsets, lossy dimensions and nonfinite values", () => {
  for (const row of [[0, 2], [1, 1], [0, 1, 0], [0, 0], []]) {
    expect(() => linearScoresSparseIdsNative({ ...scoring, docOffsets: Uint32Array.from(row) })).toThrow(RangeError);
    expect(() => linearTrainSparseIdsNative({ ...training, docOffsets: Uint32Array.from(row) })).toThrow(RangeError);
  }
  for (const count of [-1, 1.5, NaN, Infinity, 2 ** 32 + 1]) {
    expect(() => linearScoresSparseIdsNative({ ...scoring, classCount: count })).toThrow(RangeError);
    expect(() => linearTrainSparseIdsNative({ ...training, featureCount: count })).toThrow(RangeError);
  }
  expect(() => linearScoresSparseIdsNative({ ...scoring, weights: new Float64Array() })).toThrow("weights and bias");
  expect(() => linearTrainSparseIdsNative({ ...training, labelIds: Uint32Array.of(1) })).toThrow("labelIds");
  expect(() => linearTrainSparseIdsNative({ ...training, classCount: 0xffffffff, featureCount: 0xffffffff })).toThrow(RangeError);
  for (const value of [NaN, Infinity, -Infinity]) {
    for (const key of ["featureValues", "weights", "bias"] as const) {
      expect(() => linearScoresSparseIdsNative({ ...scoring, [key]: Float64Array.of(value) })).toThrow("finite");
    }
    expect(() => linearTrainSparseIdsNative({ ...training, featureValues: Float64Array.of(value) })).toThrow("finite");
  }
  expect([...linearScoresSparseIdsNative(scoring)]).toEqual([1]);
  expect([...linearTrainSparseIdsNative(training).weights]).toEqual([0.05]);
});

test("native sparse linear training rejects invalid hyperparameters before allocating", () => {
  for (const epochs of [0, -1, 1.5, NaN, Infinity, 2 ** 32 + 1]) {
    expect(() => linearTrainSparseIdsNative({ ...training, epochs })).toThrow(RangeError);
  }
  for (const learningRate of [0, -1, NaN, Infinity]) expect(() => linearTrainSparseIdsNative({ ...training, learningRate })).toThrow(RangeError);
  for (const l2 of [-1, NaN, Infinity]) expect(() => linearTrainSparseIdsNative({ ...training, l2 })).toThrow(RangeError);
  for (const margin of [0, -1, NaN, Infinity]) expect(() => linearTrainSparseIdsNative({ ...training, margin })).toThrow(RangeError);
  expect(() => linearTrainSparseIdsNative({ ...training, algorithm: "unknown" as "svm" })).toThrow(TypeError);
});

const cluster = { vectors: Float64Array.of(0, 2, 10, 12), pointCount: 4, dimensions: 1, clusterCount: 2, convergence: 1e-9, avoidEmptyClusters: false, initialMeans: Float64Array.of(0, 10) };

test("native k-means tolerates oversized output storage without changing its tail", () => {
  const initialMeans = Float64Array.of(0, 10, 77);
  expect([...kmeansFitEuclideanNative({ ...cluster, initialMeans }).means]).toEqual([1, 11, 77]);
  expect([...initialMeans]).toEqual([0, 10, 77]);
});

test("native k-means rejects nonfinite values, short buffers and invalid dimensions", () => {
  for (const key of ["pointCount", "dimensions", "clusterCount", "maxIterations"] as const) {
    for (const value of [0, -1, 1.5, NaN, Infinity, 2 ** 32 + 1]) {
      expect(() => kmeansFitEuclideanNative({ ...cluster, [key]: value })).toThrow(RangeError);
    }
  }
  for (const convergence of [-1, NaN, Infinity]) expect(() => kmeansFitEuclideanNative({ ...cluster, convergence })).toThrow(RangeError);
  for (const value of [NaN, Infinity, -Infinity]) {
    expect(() => kmeansFitEuclideanNative({ ...cluster, vectors: Float64Array.of(value, 2, 10, 12) })).toThrow("finite");
    expect(() => kmeansFitEuclideanNative({ ...cluster, initialMeans: Float64Array.of(value, 10) })).toThrow("finite");
  }
  expect(() => kmeansFitEuclideanNative({ ...cluster, initialMeans: Float64Array.of(0) })).toThrow("dimension");
  expect(() => kmeansFitEuclideanNative({ ...cluster, dimensions: 0xffffffff })).toThrow(RangeError);
  expect(() => kmeansFitEuclideanNative({ ...cluster, vectors: Float64Array.of(0, Number.MAX_VALUE, 10, 12) })).toThrow();
});
