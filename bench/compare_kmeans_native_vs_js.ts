import { KMeansClusterer } from "../src/cluster_kmeans";
import { bootstrapMedianRatio, median } from "./statistics";

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = Math.imul(value ^ (value >>> 15), value | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function makeVectors(pointCount: number, dimensions: number, clusterCount: number): number[][] {
  const random = mulberry32(0x5eed1234);
  return Array.from({ length: pointCount }, (_, point) => {
    const cluster = point % clusterCount;
    return Array.from({ length: dimensions }, (_, dimension) => {
      const center = cluster * 20 + dimension * 0.25;
      return center + (random() - 0.5) * 2;
    });
  });
}

function run(vectors: number[][], initialMeans: number[][], rounds: number, useNative: boolean) {
  const timings: number[] = [];
  let means: number[][] = [];
  for (let round = 0; round < rounds; round += 1) {
    const model = new KMeansClusterer(initialMeans.length, null, {
      initialMeans,
      convTest: 1e-7,
      useNative,
    });
    const started = performance.now();
    model.cluster(vectors);
    timings.push(performance.now() - started);
    means = model.means()!;
  }
  return { median_ms: median(timings), ms_samples: timings, means };
}
const pointCount = Math.max(2, Number(process.argv[2] ?? "20000"));
const dimensions = Math.max(1, Number(process.argv[3] ?? "16"));
const clusterCount = Math.max(1, Number(process.argv[4] ?? "8"));
const rounds = Math.max(1, Number(process.argv[5] ?? "5"));
const vectors = makeVectors(pointCount, dimensions, clusterCount);
const initialMeans = vectors.slice(0, clusterCount).map((vector) => [...vector]);
const native = run(vectors, initialMeans, rounds, true);
const js = run(vectors, initialMeans, rounds, false);
for (let cluster = 0; cluster < clusterCount; cluster += 1) {
  for (let dimension = 0; dimension < dimensions; dimension += 1) {
    if (Math.abs(native.means[cluster]![dimension]! - js.means[cluster]![dimension]!) > 1e-9) {
      throw new Error(`native/TypeScript K-means centroid mismatch at ${cluster}:${dimension}`);
    }
  }
}
const speedup = bootstrapMedianRatio(js.ms_samples, native.ms_samples);

console.log(
  JSON.stringify(
    {
      points: pointCount,
      dimensions,
      clusters: clusterCount,
      rounds,
      native_ms_median: native.median_ms,
      js_ms_median: js.median_ms,
      native_ms_samples: native.ms_samples,
      js_ms_samples: js.ms_samples,
      speedup_native_vs_js: speedup.estimate,
      speedup_ci95: speedup,
    },
    null,
    2,
  ),
);
