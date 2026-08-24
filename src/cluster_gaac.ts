/**
 * Group Average Agglomerative clusterer — port of nltk/cluster/gaac.py
 *
 * Starts with N singletons, repeatedly merges the pair with minimal
 * cosine distance between centroids (group-average, weighted by cluster size).
 * Dendrogram tracks merge order; cutting it at numClusters yields partition.
 */

import { cosineDistance, normalizeVector, type Vector } from "./cluster_api.ts";
import { Dendrogram, VectorSpaceClusterer } from "./cluster_util.ts";

export class GAAClusterer extends VectorSpaceClusterer {
  private _numClusters: number;
  private _dendrogram: Dendrogram | null = null;
  private _centroids: Vector[] = [];

  constructor(numClusters = 1, normalise = true, svdDimensions: number | null = null) {
    super(normalise, svdDimensions);
    this._numClusters = numClusters;
  }

  // Keep dendrogram initialised with raw vectors before delegation
  override cluster(vectors: Vector[], assignClusters = false, trace = false): number[] | void {
    this._dendrogram = new Dendrogram(vectors.map((v) => v.slice()));
    return super.cluster(vectors, assignClusters, trace);
  }

  override clusterVectorspace(vectors: Vector[], trace = false): void {
    const N = vectors.length;
    const clusterLen = new Array(N).fill(1);
    let clusterCount = N;
    const indexMap = Array.from({ length: N }, (_, i) => i);

    // distance matrix upper-triangle, rest Inf
    const dist: number[][] = Array.from({ length: N }, () => new Array(N).fill(Infinity));
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) dist[i]![j] = cosineDistance(vectors[i]!, vectors[j]!);
    }

    const argmin = (): [number, number] => {
      let best = Infinity;
      let bi = 0, bj = 1;
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const d = dist[i]![j]!;
        if (d < best) { best = d; bi = i; bj = j; }
      }
      return [bi, bj];
    };

    while (clusterCount > Math.max(this._numClusters, 1)) {
      const [i, j] = argmin();
      if (trace) console.log(`merging ${i} and ${j}`);
      this._mergeSimilarities(dist, clusterLen, i, j);
      // remove j
      for (let r = 0; r < N; r++) { dist[r]![j] = Infinity; dist[j]![r] = Infinity; }
      clusterLen[i] = clusterLen[i]! + clusterLen[j]!;
      this._dendrogram!.merge(indexMap[i]!, indexMap[j]!);
      clusterCount -= 1;
      // update indexMap: shift indices after j
      for (let k = j + 1; k < N; k++) indexMap[k]! -= 1;
      indexMap[j] = N; // sentinel
    }

    this.updateClusters(this._numClusters);
  }

  private _mergeSimilarities(dist: number[][], clusterLen: number[], i: number, j: number): void {
    const iW = clusterLen[i]!;
    const jW = clusterLen[j]!;
    const sum = iW + jW;
    const N = dist.length;
    // x < i : dist[x][i]
    for (let x = 0; x < i; x++) dist[x]![i] = (dist[x]![i]! * iW + dist[x]![j]! * jW) / sum;
    // i < x < j : dist[i][x] vs dist[x][j]
    for (let x = i + 1; x < j; x++) dist[i]![x] = (dist[i]![x]! * iW + dist[x]![j]! * jW) / sum;
    // x > j : dist[i][x] vs dist[j][x]
    for (let x = j + 1; x < N; x++) dist[i]![x] = (dist[i]![x]! * iW + dist[j]![x]! * jW) / sum;
    // symmetric lower entries aren't used (we keep upper triangle)
    // For safety also collapse row i tail
    // already done via dist[i][...] above; no need to divide again
  }

  updateClusters(numClusters: number): void {
    const groups = this._dendrogram!.groups(numClusters) as unknown as Vector[][];
    this._centroids = [];
    for (const cluster of groups) {
      if (cluster.length === 0) continue;
      let centroid: Vector;
      if (this._shouldNormalise) centroid = normalizeVector(cluster[0]!);
      else centroid = cluster[0]!.slice();
      for (let k = 1; k < cluster.length; k++) {
        const v = this._shouldNormalise ? normalizeVector(cluster[k]!) : cluster[k]!;
        for (let d = 0; d < centroid.length; d++) centroid[d]! += (v[d] ?? 0);
      }
      centroid = centroid.map((x) => x / cluster.length);
      this._centroids.push(centroid);
    }
    this._numClusters = this._centroids.length;
  }

  override classifyVectorspace(vector: Vector): number {
    let best = Infinity;
    let bestIdx = 0;
    for (let i = 0; i < this._numClusters; i++) {
      const d = cosineDistance(vector, this._centroids[i]!);
      if (d < best) { best = d; bestIdx = i; }
    }
    return bestIdx;
  }

  dendrogram(): Dendrogram | null {
    return this._dendrogram;
  }

  override numClusters(): number {
    return this._numClusters;
  }

  centroids(): Vector[] {
    return this._centroids.map((v) => v.slice());
  }

  override toString(): string {
    return `<GroupAverageAgglomerative Clusterer n=${this._numClusters}>`;
  }
}

// Alias as in NLTK (nltk.cluster.GAAClusterer / GAAC)
export const GAACClusterer = GAAClusterer;
export const GAACluster = GAAClusterer;
