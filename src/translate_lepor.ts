/**
 * LEPOR score (port of nltk.translate.lepor).
 * Han et al. (2012) "LEPOR: A Robust Evaluation Metric for Machine Translation".
 */
export function lengthPenalty(refLen: number, hypLen: number): number {
  if (hypLen === 0) return 0;
  if (hypLen > refLen) return 1;
  return Math.exp(1 - refLen / hypLen);
}

export function alignment(refTokens: string[], hypTokens: string[]): [number, number, number] {
  const refSet = new Set(refTokens);
  const hypSet = new Set(hypTokens);
  let aligned = 0;
  const refCounts = new Map<string, number>();
  for (const t of refTokens) refCounts.set(t, (refCounts.get(t) ?? 0) + 1);
  const hypCounts = new Map<string, number>();
  for (const t of hypTokens) hypCounts.set(t, (hypCounts.get(t) ?? 0) + 1);
  for (const t of refSet) if (hypSet.has(t)) aligned += Math.min(refCounts.get(t)!, hypCounts.get(t)!);
  return [aligned, refTokens.length, hypTokens.length];
}

export function ngramPositionalPenalty(refTokens: string[], hypTokens: string[], n = 2): number {
  if (refTokens.length < n || hypTokens.length < n) return 1;
  const refNgrams = new Map<string, number[]>();
  for (let i = 0; i <= refTokens.length - n; i++) {
    const ng = refTokens.slice(i, i+n).join(" ");
    if (!refNgrams.has(ng)) refNgrams.set(ng, []);
    refNgrams.get(ng)!.push(i);
  }
  let penalty = 0, count = 0;
  for (let i = 0; i <= hypTokens.length - n; i++) {
    const ng = hypTokens.slice(i, i+n).join(" ");
    const refPos = refNgrams.get(ng);
    if (refPos && refPos.length) {
      const closest = refPos.reduce((a,b) => Math.abs(a-i) < Math.abs(b-i) ? a : b);
      penalty += Math.abs(closest - i);
      count++;
    }
  }
  if (count === 0) return 1;
  return Math.exp(-penalty / (count * hypTokens.length));
}

function harmonicMean(values: number[], weights?: number[]): number {
  if (values.length === 0) return 0;
  const w = weights ?? values.map(() => 1/values.length);
  let denom = 0;
  for (let i = 0; i < values.length; i++) {
    if (values[i] === 0) return 0;
    denom += w[i]! / values[i]!;
  }
  return 1 / denom;
}

export function sentenceLepor(
  references: string[][],
  hypothesis: string[],
  alpha = 0.9, beta = 0.9, n = 2,
): number {
  if (references.length === 0 || hypothesis.length === 0) return 0;
  // pick reference with closest length (NLTK behavior)
  let bestRef = references[0]!;
  let bestDiff = Math.abs(bestRef.length - hypothesis.length);
  for (const ref of references.slice(1)) {
    const d = Math.abs(ref.length - hypothesis.length);
    if (d < bestDiff) { bestDiff = d; bestRef = ref; }
  }
  const [aligned] = alignment(bestRef, hypothesis);
  const precision = hypothesis.length ? aligned / hypothesis.length : 0;
  const recall = bestRef.length ? aligned / bestRef.length : 0;
  if (precision === 0 || recall === 0) return 0;
  const lp = lengthPenalty(bestRef.length, hypothesis.length);
  const npp = ngramPositionalPenalty(bestRef, hypothesis, n);
  const hMean = harmonicMean([precision, recall], [alpha, 1-alpha]);
  return lp * npp * hMean;
}

export function corpusLepor(
  listOfReferences: string[][][],
  hypotheses: string[][],
  alpha = 0.9, beta = 0.9, n = 2,
): number {
  if (hypotheses.length === 0) return 0;
  let total = 0;
  for (let i = 0; i < hypotheses.length; i++) total += sentenceLepor(listOfReferences[i] ?? [], hypotheses[i] ?? [], alpha, beta, n);
  return total / hypotheses.length;
}
