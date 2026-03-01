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
  if (listOfReferences.length === 0 || hypotheses.length === 0) return 0;

  const clipped = [0, 0, 0, 0];
  const totals = [0, 0, 0, 0];
  let hypLen = 0;
  let refLen = 0;

  const size = Math.min(listOfReferences.length, hypotheses.length);
  for (let i = 0; i < size; i += 1) {
    const refs = listOfReferences[i] ?? [];
    const hyp = hypotheses[i] ?? [];
    if (refs.length === 0) continue;
    for (let n = 1; n <= 4; n += 1) {
      const row = modifiedPrecision(refs, hyp, n);
      clipped[n - 1] += row.clipped;
      totals[n - 1] += row.total;
    }
    hypLen += hyp.length;
    refLen += closestRefLength(refs, hyp.length);
  }

  if (hypLen === 0) return 0;
  const bp = hypLen > refLen ? 1 : Math.exp(1 - refLen / hypLen);
  let sum = 0;
  for (let i = 0; i < 4; i += 1) {
    const p = (clipped[i] + 1) / (totals[i] + 1);
    sum += (weights[i] ?? 0) * safeLog(p);
  }
  return bp * Math.exp(sum);
}

export function editDistance(left: string, right: string, options: EditDistanceOptions = {}): number {
  const substitutionCost = options.substitutionCost ?? 1;
  const transpositions = options.transpositions ?? false;

  const a = Array.from(left);
  const b = Array.from(right);
  const m = a.length;
  const n = b.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i += 1) dp[i]![0] = i;
  for (let j = 0; j <= n; j += 1) dp[0]![j] = j;

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const sub = dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : substitutionCost);
      const del = dp[i - 1]![j]! + 1;
      const ins = dp[i]![j - 1]! + 1;
      let best = Math.min(sub, del, ins);
      if (transpositions && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, dp[i - 2]![j - 2]! + 1);
      }
      dp[i]![j] = best;
    }
  }
  return dp[m]![n]!;
}

export type ConfusionMatrixResult = {
  labels: string[];
  matrix: number[][];
  accuracy: number;
};

export function confusionMatrix(gold: string[], predicted: string[]): ConfusionMatrixResult {
  const n = Math.min(gold.length, predicted.length);
  const labels = [...new Set([...gold.slice(0, n), ...predicted.slice(0, n)])].sort((a, b) => a.localeCompare(b));
  const index = new Map<string, number>(labels.map((label, i) => [label, i]));
  const matrix = Array.from({ length: labels.length }, () => Array<number>(labels.length).fill(0));

  let correct = 0;
  for (let i = 0; i < n; i += 1) {
    const g = gold[i]!;
    const p = predicted[i]!;
    const gi = index.get(g);
    const pi = index.get(p);
    if (gi === undefined || pi === undefined) continue;
    matrix[gi]![pi]! += 1;
    if (g === p) correct += 1;
  }

  return {
    labels,
    matrix,
    accuracy: n > 0 ? correct / n : 0,
  };
}

