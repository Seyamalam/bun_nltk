// Differential pins for nltk.cluster — see test/cluster_oracle.py
import { describe, expect, test } from "bun:test";
import { GAAClusterer, euclideanDistance, cosineDistance } from "../index";

describe("nltk.cluster oracle parity", () => {
  const vectors = [[2, 1], [5, 3], [1, 3], [2, 1.5], [6, 4]];

  test("gaac cluster/classify/dendrogram", () => {
    const c = new GAAClusterer(3);
    c.cluster(vectors, true);
    expect(vectors.map((v) => c.clusterName(v))).toEqual([[2, 1], [5, 3], [1, 3], [2, 1.5], [6, 4]]);
    expect(c.classify([2, 2])).toBe(2);
    expect(c.classify([5.5, 3.5])).toBe(2);
    expect(c.classify([1, 3.1])).toBe(1);
    const d = c.dendrogram()!;
    expect(d.groups(3).map((g) => g.map((l) => l as unknown as number[]))).toEqual([
      [[2, 1]], [[1, 3]], [[5, 3], [6, 4], [2, 1.5]],
    ]);
    expect(d.toString()).toBe("<Dendrogram with 5 leaves>");
  });

  test("euclidean/cosine distance", () => {
    expect(euclideanDistance([0, 0], [3, 4])).toBe(5);
    expect(cosineDistance([1, 0], [0, 1])).toBe(1);
    expect(cosineDistance([1, 0], [1, 0])).toBe(0);
  });
});
