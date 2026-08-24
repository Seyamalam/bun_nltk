/**
 * Cluster API — port of nltk/cluster/api.py
 *
 * Defines ClusterI interface and core vector helpers (euclidean/cosine/normalise).
 */

export type Vector = number[];

// ---------------------------------------------------------------------------
// Vector helpers — JS-idiomatic replacements for numpy ops used in NLTK
// ---------------------------------------------------------------------------

export function dotProduct(a: Vector, b: Vector): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += (a[i] ?? 0) * (b[i] ?? 0);
  return s;
}

export function vectorNorm(v: Vector): number {
  return Math.sqrt(dotProduct(v, v));
}

export function vectorAdd(a: Vector, b: Vector): Vector {
  const n = Math.max(a.length, b.length);
  const out: Vector = new Array(n);
  for (let i = 0; i < n; i++) out[i] = (a[i] ?? 0) + (b[i] ?? 0);
  return out;
}

export function vectorSub(a: Vector, b: Vector): Vector {
  const n = Math.max(a.length, b.length);
  const out: Vector = new Array(n);
  for (let i = 0; i < n; i++) out[i] = (a[i] ?? 0) - (b[i] ?? 0);
  return out;
}

export function vectorScale(v: Vector, s: number): Vector {
  return v.map((x) => x * s);
}

export function vectorDiv(v: Vector, s: number): Vector {
  return v.map((x) => x / s);
}

export function zeroVector(dim: number): Vector {
  return new Array(dim).fill(0);
}

export function copyVector(v: Vector): Vector {
  return v.slice();
}

export function normalizeVector(v: Vector): Vector {
  const n = vectorNorm(v);
  if (n === 0) return v.slice();
  return vectorDiv(v, n);
}

export function euclideanDistance(a: Vector, b: Vector): number {
  let s = 0;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    s += d * d;
  }
  return Math.sqrt(s);
}

export function cosineDistance(a: Vector, b: Vector): number {
  const denom = vectorNorm(a) * vectorNorm(b);
  if (denom === 0) return 1;
  return 1 - dotProduct(a, b) / denom;
}

export function sumVectors(vectors: Vector[]): Vector {
  if (vectors.length === 0) return [];
  let acc = zeroVector(vectors[0]!.length);
  for (const v of vectors) acc = vectorAdd(acc, v);
  return acc;
}

export function meanVector(vectors: Vector[]): Vector {
  if (vectors.length === 0) throw new RangeError("mean of empty cluster");
  return vectorDiv(sumVectors(vectors), vectors.length);
}

// ---------------------------------------------------------------------------
// ClusterI — abstract interface matching nltk.cluster.api.ClusterI
// ---------------------------------------------------------------------------

export type ProbDist = Map<number, number> | Record<number, number>;

export abstract class ClusterI {
  abstract cluster(vectors: Vector[], assignClusters?: boolean): number[] | void;
  abstract classify(vector: Vector): number;
  abstract numClusters(): number;

  likelihood(_vector: Vector, label: number): number {
    return this.classify(_vector) === label ? 1.0 : 0.0;
  }

  classificationProbDist(vector: Vector): Map<number, number> {
    const names = this.clusterNames();
    const likelihoods = new Map<number, number>();
    let total = 0;
    for (const c of names) {
      const l = this.likelihood(vector, c);
      likelihoods.set(c, l);
      total += l;
    }
    if (total === 0) {
      // uniform fallback if all zero (avoid div/0 — matches NLTK would produce NaN but we return uniform)
      for (const c of names) likelihoods.set(c, 1 / names.length);
      return likelihoods;
    }
    for (const c of names) likelihoods.set(c, (likelihoods.get(c) ?? 0) / total);
    return likelihoods;
  }

  clusterNames(): number[] {
    return Array.from({ length: this.numClusters() }, (_, i) => i);
  }

  clusterName(index: number): number {
    return index;
  }
}
