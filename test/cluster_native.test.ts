import { expect, test } from "bun:test";
import { KMeansClusterer } from "../src/cluster_kmeans";

const vectors = [
  [0, 0],
  [0, 1],
  [1, 0],
  [10, 10],
  [10, 11],
  [11, 10],
];

test("native and TypeScript Euclidean K-means produce equivalent centroids", () => {
  const options = {
    initialMeans: [vectors[0]!, vectors[3]!],
    convTest: 1e-9,
  };
  const native = new KMeansClusterer(2, null, { ...options, useNative: true });
  const js = new KMeansClusterer(2, null, { ...options, useNative: false });
  native.cluster(vectors.map((vector) => [...vector]));
  js.cluster(vectors.map((vector) => [...vector]));

  const nativeMeans = native.means()!;
  const jsMeans = js.means()!;
  expect(nativeMeans.length).toBe(jsMeans.length);
  for (let cluster = 0; cluster < nativeMeans.length; cluster += 1) {
    for (let dimension = 0; dimension < nativeMeans[cluster]!.length; dimension += 1) {
      expect(nativeMeans[cluster]![dimension]!).toBeCloseTo(jsMeans[cluster]![dimension]!, 12);
    }
  }
});
