/**
 * K-Means clusterer — port of nltk/cluster/kmeans.py
 *
 * Faithful to NLTK hill-climbing batch K-means with optional kmeans++ init,
 * euclidean/cosine iteration, convergence test, repeats + best-means selection.
 */

import {
  cosineDistance,
  euclideanDistance,
  vectorAdd,
  vectorDiv,
  type Vector,
} from "./cluster_api.ts";
import { VectorSpaceClusterer } from "./cluster_util.ts";

export type DistanceFn = (a: Vector, b: Vector) => number;

export interface KMeansOptions {
  distance?: DistanceFn;
  repeats?: number;
  convTest?: number;
  initialMeans?: Vector[] | null;
  normalise?: boolean;
  svdDimensions?: number | null;
  avoidEmptyClusters?: boolean;
  seed?: number;
  useKMeansPlusPlus?: boolean;
}

// Simple seeded RNG (xorshift32) for determinism when seed provided
function makeRng(seed: number): () => number {
  let s = seed >>> 0 || 0x9e3779b9;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return (s >>> 0) / 0xffffffff;
  };
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleWithoutReplacement<T>(arr: T[], k: number, rng: () => number): T[] {
  const copy = arr.slice();
  // Fisher-Yates partial
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, k);
}

function kmeansPlusPlus(
  vectors: Vector[],
  k: number,
  distance: DistanceFn,
  rng: () => number,
): Vector[] {
  if (vectors.length === 0) return [];
  const means: Vector[] = [];
  // first centre uniformly
  means.push(vectors[Math.floor(rng() * vectors.length)]!.slice());
  while (means.length < k) {
    // d^2 to nearest centre
    const dists = vectors.map((v) => {
      let best = Infinity;
      for (const m of means) {
        const d = distance(v, m);
        if (d < best) best = d;
      }
      return best * best;
    });
    const total = dists.reduce((a, b) => a + b, 0);
    if (total === 0) {
      // all points coincident — fill randomly
      const remaining = k - means.length;
      const extra = sampleWithoutReplacement(vectors, remaining, rng);
      for (const e of extra) means.push(e.slice());
      break;
    }
    let r = rng() * total;
    let idx = 0;
    for (; idx < dists.length; idx++) {
      r -= dists[idx]!;
      if (r <= 0) break;
    }
    if (idx >= vectors.length) idx = vectors.length - 1;
    means.push(vectors[idx]!.slice());
  }
  return means;
}

export class KMeansClusterer extends VectorSpaceClusterer {
  private _numMeans: number;
  private _distance: DistanceFn;
  private _convTest: number;
  private _means: Vector[] | null;
  private _repeats: number;
  private _rng: () => number;
  private _avoidEmptyClusters: boolean;
  private _useKMeansPP: boolean;

  constructor(
    numMeans: number,
    distance: DistanceFn | null = euclideanDistance,
    options: KMeansOptions | number = {},
  ) {
    // Support legacy positional repeats: new KMeansClusterer(k, dist, repeats)
    let opts: KMeansOptions = {};
    if (typeof options === "number") opts = { repeats: options };
    else opts = options ?? {};

    const normalise = opts.normalise ?? false;
    const svdDimensions = opts.svdDimensions ?? null;
    super(normalise, svdDimensions);

    this._numMeans = numMeans;
    this._distance = distance ?? euclideanDistance;
    this._convTest = opts.convTest ?? 1e-6;
    this._means = opts.initialMeans ? opts.initialMeans.map((v) => v.slice()) : null;
    if (this._means) {
      if (this._means.length !== numMeans) throw new RangeError("initialMeans length must equal numMeans");
    }
    this._repeats = opts.repeats ?? 1;
    if (this._repeats < 1) throw new RangeError("repeats must be >=1");
    if (this._means && this._repeats > 1) {
      // NLTK warns but we just honour first trial means then resample
    }
    this._avoidEmptyClusters = opts.avoidEmptyClusters ?? false;
    this._useKMeansPP = opts.useKMeansPlusPlus ?? false;

    if (opts.seed !== undefined) this._rng = mulberry32(opts.seed);
    else this._rng = Math.random;

    // expose distance helpers for external use
    void makeRng;
  }

  // Allow injecting rng for testing
  setRng(rng: () => number): void {
    this._rng = rng;
  }

  override clusterVectorspace(vectors: Vector[], trace = false): void {
    const allMeans: Vector[][] = [];
    for (let trial = 0; trial < this._repeats; trial++) {
      if (trace) console.log(`k-means trial ${trial}`);
      // choose initial means
      if (!this._means || trial > 0) {
        // NLTK: sample uniformly; we support kmeans++ optionally
        if (this._useKMeansPP) {
          this._means = kmeansPlusPlus(vectors, this._numMeans, this._distance, this._rng);
        } else {
          this._means = sampleWithoutReplacement(vectors, this._numMeans, this._rng).map((v) => v.slice());
        }
      }
      this._clusterOnce(vectors, trace);
      allMeans.push(this._means!.map((v) => v.slice()));
    }

    if (allMeans.length > 1) {
      for (const m of allMeans) m.sort((a, b) => {
        const sa = a.reduce((x, y) => x + y, 0);
        const sb = b.reduce((x, y) => x + y, 0);
        return sa - sb;
      });
      let bestIdx = 0;
      let bestScore = Infinity;
      for (let i = 0; i < allMeans.length; i++) {
        let d = 0;
        for (let j = 0; j < allMeans.length; j++) {
          if (i === j) continue;
          d += this._sumDistances(allMeans[i]!, allMeans[j]!);
        }
        if (d < bestScore) { bestScore = d; bestIdx = i; }
      }
      this._means = allMeans[bestIdx]!;
    }
  }

  private _clusterOnce(vectors: Vector[], trace: boolean): void {
    if (this._numMeans >= vectors.length) {
      // degenerate: each vector is its own mean (or fewer)
      // keep current means as-is — NLTK skips loop when num_means >= len(vectors)
      return;
    }
    let converged = false;
    while (!converged) {
      const clusters: Vector[][] = Array.from({ length: this._numMeans }, () => []);
      for (const v of vectors) {
        const idx = this.classifyVectorspace(v);
        clusters[idx]!.push(v);
      }
      if (trace) console.log("iteration");
      const newMeans = clusters.map((c, i) => this._centroid(c, this._means![i]!));
      const diff = this._sumDistances(this._means!, newMeans);
      if (diff < this._convTest) converged = true;
      this._means = newMeans;
    }
  }

  override classifyVectorspace(vector: Vector): number {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < this._means!.length; i++) {
      const d = this._distance(vector, this._means![i]!);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    return bestIdx;
  }

  override numClusters(): number {
    return this._means ? this._means.length : this._numMeans;
  }

  means(): Vector[] | null {
    return this._means ? this._means.map((v) => v.slice()) : null;
  }

  private _sumDistances(a: Vector[], b: Vector[]): number {
    let s = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) s += this._distance(a[i]!, b[i]!);
    return s;
  }

  private _centroid(cluster: Vector[], mean: Vector): Vector {
    if (this._avoidEmptyClusters) {
      let acc = mean.slice();
      for (const v of cluster) acc = vectorAdd(acc, v);
      return vectorDiv(acc, 1 + cluster.length);
    }
    if (cluster.length === 0) {
      throw new Error("Empty cluster — try avoidEmptyClusters: true");
    }
    let acc = cluster[0]!.slice();
    for (let i = 1; i < cluster.length; i++) acc = vectorAdd(acc, cluster[i]!);
    return vectorDiv(acc, cluster.length);
  }

  override toString(): string {
    return `<KMeansClusterer means=${JSON.stringify(this._means)} repeats=${this._repeats}>`;
  }
}

// Convenience re-exports matching nltk.cluster
export { cosineDistance, euclideanDistance };
