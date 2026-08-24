/**
 * EM clusterer — port of nltk/cluster/em.py
 *
 * Gaussian mixture EM with E-step soft assignment and M-step re-estimation
 * (priors, means, covariances + bias). Faithful to NLTK but JS-idiomatic.
 */

import type { Vector } from "./cluster_api.ts";
import { VectorSpaceClusterer } from "./cluster_util.ts";

// ----- linear algebra helpers (generic n-dim) -----

function det(matrix: number[][]): number {
  const n = matrix.length;
  if (n === 0) return 1;
  if (n === 1) return matrix[0]![0]!;
  if (n === 2) return matrix[0]![0]! * matrix[1]![1]! - matrix[0]![1]! * matrix[1]![0]!;
  // LU decomposition (Doolittle) — determinant as product of U diagonal
  const a = matrix.map((r) => r.slice());
  let d = 1;
  for (let k = 0; k < n; k++) {
    // pivot
    let piv = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(a[i]![k]!) > Math.abs(a[piv]![k]!)) piv = i;
    if (piv !== k) { const tmp = a[k]!; a[k] = a[piv]!; a[piv] = tmp; d *= -1; }
    const pivotVal = a[k]![k]!;
    if (Math.abs(pivotVal) < 1e-12) return 0;
    d *= pivotVal;
    for (let i = k + 1; i < n; i++) {
      const factor = a[i]![k]! / pivotVal;
      for (let j = k + 1; j < n; j++) a[i]![j]! -= factor * a[k]![j]!;
    }
  }
  return d;
}

function invert(matrix: number[][]): number[][] | null {
  const n = matrix.length;
  const a = matrix.map((r) => r.slice());
  const inv: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  );
  // Gauss-Jordan
  for (let col = 0; col < n; col++) {
    // find pivot
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r]![col]!) > Math.abs(a[pivot]![col]!)) pivot = r;
    if (Math.abs(a[pivot]![col]!) < 1e-12) return null;
    if (pivot !== col) {
      [a[col], a[pivot]] = [a[pivot]!, a[col]!];
      [inv[col], inv[pivot]] = [inv[pivot]!, inv[col]!];
    }
    const piv = a[col]![col]!;
    for (let j = 0; j < n; j++) { a[col]![j]! /= piv; inv[col]![j]! /= piv; }
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = a[r]![col]!;
      if (factor === 0) continue;
      for (let j = 0; j < n; j++) { a[r]![j]! -= factor * a[col]![j]!; inv[r]![j]! -= factor * inv[col]![j]!; }
    }
  }
  return inv;
}

function outer(a: Vector, b: Vector): number[][] {
  const m = a.length;
  const n = b.length;
  const out: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) out[i]![j] = (a[i] ?? 0) * (b[j] ?? 0);
  return out;
}

function gaussian(mean: Vector, cov: number[][], x: Vector): number {
  const m = mean.length;
  // validate shape
  if (cov.length !== m || cov.some((r) => r.length !== m)) throw new RangeError("bad covariance shape");
  const d = det(cov);
  if (d <= 0) return 0; // singular / non-positive
  const inv = invert(cov);
  if (!inv) return 0;
  const a = Math.pow(d, -0.5) * Math.pow(2 * Math.PI, -m / 2);
  const dx = x.map((v, i) => v - (mean[i] ?? 0));
  // b = -0.5 * dx^T inv dx
  let tmp = 0;
  for (let i = 0; i < m; i++) {
    let row = 0;
    for (let j = 0; j < m; j++) row += (inv[i]![j] ?? 0) * (dx[j] ?? 0);
    tmp += (dx[i] ?? 0) * row;
  }
  const b = -0.5 * tmp;
  // underflow guard: exp(-1e3) ~0
  if (b < -700) return 0;
  return a * Math.exp(b);
}

// ----- EMClusterer -----

export interface EMOptions {
  priors?: number[] | null;
  covarianceMatrices?: number[][][] | null;
  convThreshold?: number;
  bias?: number;
  normalise?: boolean;
  svdDimensions?: number | null;
}

export class EMClusterer extends VectorSpaceClusterer {
  private _means: Vector[];
  private _numClusters: number;
  private _convThreshold: number;
  private _bias: number;
  private _priors: number[] | null;
  private _covariances: number[][][] | null;

  constructor(initialMeans: Vector[], options: EMOptions = {}) {
    const normalise = options.normalise ?? false;
    const svdDimensions = options.svdDimensions ?? null;
    super(normalise, svdDimensions);
    this._means = initialMeans.map((v) => v.slice());
    this._numClusters = initialMeans.length;
    this._convThreshold = options.convThreshold ?? 1e-6;
    this._bias = options.bias ?? 0.1;
    this._priors = options.priors ? options.priors.slice() : null;
    this._covariances = options.covarianceMatrices
      ? options.covarianceMatrices.map((m) => m.map((r) => r.slice()))
      : null;
  }

  override numClusters(): number {
    return this._numClusters;
  }

  getMeans(): Vector[] {
    return this._means.map((v) => v.slice());
  }

  getPriors(): number[] | null {
    return this._priors ? this._priors.slice() : null;
  }

  getCovariances(): number[][][] | null {
    return this._covariances ? this._covariances.map((m) => m.map((r) => r.slice())) : null;
  }

  override clusterVectorspace(vectors: Vector[], trace = false): void {
    if (vectors.length === 0) throw new RangeError("no vectors");
    const dim = vectors[0]!.length;
    let means = this._means;
    let priors = this._priors;
    if (!priors) {
      priors = this._priors = new Array(this._numClusters).fill(1 / this._numClusters);
    }
    let covs = this._covariances;
    if (!covs) {
      covs = this._covariances = Array.from({ length: this._numClusters }, () =>
        Array.from({ length: dim }, (_, i) =>
          Array.from({ length: dim }, (_, j) => (i === j ? 1 : 0)),
        ),
      );
    }

    let lastL = this._logLikelihood(vectors, priors, means, covs);
    let converged = false;
    let iter = 0;
    const maxIter = 1000;
    while (!converged && iter < maxIter) {
      iter += 1;
      if (trace) console.log(`iteration; loglikelihood ${lastL}`);

      // E-step: h[i][j]
      const h: number[][] = Array.from({ length: vectors.length }, () => new Array(this._numClusters).fill(0));
      for (let i = 0; i < vectors.length; i++) {
        let rowSum = 0;
        for (let j = 0; j < this._numClusters; j++) {
          const v = priors[j]! * gaussian(means[j]!, covs[j]!, vectors[i]!);
          h[i]![j] = v;
          rowSum += v;
        }
        if (rowSum === 0) {
          // uniform fallback (avoid NaN)
          for (let j = 0; j < this._numClusters; j++) h[i]![j] = 1 / this._numClusters;
        } else {
          for (let j = 0; j < this._numClusters; j++) h[i]![j]! /= rowSum;
        }
      }

      // M-step
      for (let j = 0; j < this._numClusters; j++) {
        let sumHj = 0;
        const newMean = new Array(dim).fill(0);
        let newCov: number[][] = Array.from({ length: dim }, () => new Array(dim).fill(0));
        for (let i = 0; i < vectors.length; i++) {
          const hij = h[i]![j]!;
          sumHj += hij;
          for (let d = 0; d < dim; d++) newMean[d]! += hij * (vectors[i]![d] ?? 0);
        }
        // accumulate outer products using old means (as in NLTK)
        for (let i = 0; i < vectors.length; i++) {
          const delta = vectors[i]!.map((v, d) => v - (means[j]![d] ?? 0));
          const o = outer(delta, delta);
          const hij = h[i]![j]!;
          for (let r = 0; r < dim; r++) for (let c = 0; c < dim; c++) newCov[r]![c]! += hij * (o[r]![c] ?? 0);
        }
        if (sumHj === 0) sumHj = 1e-12;
        for (let r = 0; r < dim; r++) for (let c = 0; c < dim; c++) newCov[r]![c]! /= sumHj;
        for (let d = 0; d < dim; d++) newMean[d]! /= sumHj;

        // bias
        for (let d = 0; d < dim; d++) newCov[d]![d]! += this._bias;

        covs[j] = newCov;
        means[j] = newMean;
        priors[j] = sumHj / vectors.length;
      }

      const l = this._logLikelihood(vectors, priors, means, covs);
      if (Math.abs(lastL - l) < this._convThreshold) converged = true;
      lastL = l;
      if (!Number.isFinite(lastL)) break;
    }

    this._means = means;
    this._priors = priors;
    this._covariances = covs;
  }

  override classifyVectorspace(vector: Vector): number {
    let best = -Infinity;
    let bestIdx = 0;
    for (let j = 0; j < this._numClusters; j++) {
      const p = (this._priors?.[j] ?? 0) * gaussian(this._means[j]!, this._covariances![j]!, vector);
      if (p > best) { best = p; bestIdx = j; }
    }
    return bestIdx;
  }

  override likelihoodVectorspace(vector: Vector, cluster: number): number {
    return (this._priors?.[cluster] ?? 0) * gaussian(this._means[cluster]!, this._covariances![cluster]!, vector);
  }

  private _logLikelihood(
    vectors: Vector[],
    priors: number[],
    means: Vector[],
    covs: number[][][],
  ): number {
    let llh = 0;
    for (const v of vectors) {
      let p = 0;
      for (let j = 0; j < priors.length; j++) p += (priors[j] ?? 0) * gaussian(means[j]!, covs[j]!, v);
      if (p <= 0) p = 1e-300;
      llh += Math.log(p);
    }
    return llh;
  }

  override toString(): string {
    return `<EMClusterer means=${JSON.stringify(this._means)}>`;
  }
}
