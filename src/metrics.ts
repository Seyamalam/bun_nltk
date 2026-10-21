import { syncWasm } from "./sync_wasm.ts";
import { ConfusionMatrix } from "./confusion_metrics.ts";
export { accuracy, ConfusionMatrix } from "./confusion_metrics.ts";

export type BleuWeights = [number, number, number, number];

export type EditDistanceOptions = {
  substitutionCost?: number;
  transpositions?: boolean;
};

function ngrams(tokens: string[], n: number): string[] {
  if (n <= 0 || tokens.length < n) return [];
  const out: string[] = [];
  for (let i = 0; i + n <= tokens.length; i += 1) {
    out.push(tokens.slice(i, i + n).join("\u0001"));
  }
  return out;
}

function countMap(values: string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const key of values) out.set(key, (out.get(key) ?? 0) + 1);
  return out;
}

function modifiedPrecision(references: string[][], hypothesis: string[], n: number): { clipped: number; total: number } {
  const hypNgrams = ngrams(hypothesis, n);
  const total = hypNgrams.length;
  if (total === 0) return { clipped: 0, total: 0 };

  const hypCounts = countMap(hypNgrams);
  const maxRefCounts = new Map<string, number>();
  for (const ref of references) {
    const refCounts = countMap(ngrams(ref, n));
    for (const [key, value] of refCounts.entries()) {
      const prev = maxRefCounts.get(key) ?? 0;
      if (value > prev) maxRefCounts.set(key, value);
    }
  }

  let clipped = 0;
  for (const [key, value] of hypCounts.entries()) {
    clipped += Math.min(value, maxRefCounts.get(key) ?? 0);
  }
  return { clipped, total };
}

function closestRefLength(references: string[][], hypLen: number): number {
  let best = references[0]?.length ?? 0;
  let bestDelta = Math.abs(best - hypLen);
  for (const ref of references) {
    const delta = Math.abs(ref.length - hypLen);
    if (delta < bestDelta || (delta === bestDelta && ref.length < best)) {
      best = ref.length;
      bestDelta = delta;
    }
  }
  return best;
}

function safeLog(x: number): number {
  return Math.log(Math.max(x, 1e-12));
}

export function sentenceBleu(
  references: string[][],
  hypothesis: string[],
  weights: BleuWeights = [0.25, 0.25, 0.25, 0.25],
): number {
  if (references.length === 0) return 0;
  if (hypothesis.length === 0) return 0;

  const precisions: number[] = [];
  for (let n = 1; n <= 4; n += 1) {
    const { clipped, total } = modifiedPrecision(references, hypothesis, n);
    precisions.push((clipped + 1) / (total + 1));
  }

  const hypLen = hypothesis.length;
  const refLen = closestRefLength(references, hypLen);
  const bp = hypLen > refLen ? 1 : Math.exp(1 - refLen / Math.max(hypLen, 1));

  let sum = 0;
  for (let i = 0; i < 4; i += 1) {
    sum += (weights[i] ?? 0) * safeLog(precisions[i] ?? 1e-12);
  }
  return bp * Math.exp(sum);
}

export function corpusBleu(
  listOfReferences: string[][][],
  hypotheses: string[][],
  weights: BleuWeights = [0.25, 0.25, 0.25, 0.25],
): number {
  if (listOfReferences.length !== hypotheses.length) {
    throw new RangeError("The number of hypotheses and their reference(s) should be the same");
  }
  if (listOfReferences.length === 0 || hypotheses.length === 0) return 0;

  const clipped = [0, 0, 0, 0];
  const totals = [0, 0, 0, 0];
  let hypLen = 0;
  let refLen = 0;

  const size = hypotheses.length;
  for (let i = 0; i < size; i += 1) {
    const refs = listOfReferences[i] ?? [];
    const hyp = hypotheses[i] ?? [];
    if (refs.length === 0) continue;
    for (let n = 1; n <= 4; n += 1) {
      const row = modifiedPrecision(refs, hyp, n);
      clipped[n - 1]! += row.clipped;
      totals[n - 1]! += row.total;
    }
    hypLen += hyp.length;
    refLen += closestRefLength(refs, hyp.length);
  }

  if (hypLen === 0) return 0;
  const bp = hypLen > refLen ? 1 : Math.exp(1 - refLen / hypLen);
  let sum = 0;
  for (let i = 0; i < 4; i += 1) {
    const p = (clipped[i]! + 1) / (totals[i]! + 1);
    sum += (weights[i] ?? 0) * safeLog(p);
  }
  return bp * Math.exp(sum);
}

export function editDistance(left: string, right: string, options: EditDistanceOptions = {}): number {
  return syncWasm().editDistance(left, right, options);
}

export type ConfusionMatrixResult<T = string> = {
  labels: T[];
  matrix: number[][];
  accuracy: number;
};

export function confusionMatrix<T>(gold: T[], predicted: T[]): ConfusionMatrixResult<T> {
  const cm = new ConfusionMatrix(gold, predicted);
  return {
    labels: cm.labels,
    matrix: cm.toMatrix(),
    // Preserve this convenience API's historical empty result (not NLTK accuracy).
    accuracy: cm.accuracy,
  };
}
