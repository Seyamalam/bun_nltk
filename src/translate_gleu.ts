/**
 * GLEU score (port of nltk.translate.gleu_score).
 *
 * Wu et al. (2016) Google NMT — precision/recall over everygrams(1..4).
 */

function everygrams(tokens: string[], minLen: number, maxLen: number): string[][] {
  const out: string[][] = [];
  for (let n = minLen; n <= maxLen; n++) {
    for (let i = 0; i + n <= tokens.length; i++) out.push(tokens.slice(i, i+n));
  }
  return out;
}

function counterKey(ng: string[]): string { return ng.join("\x1f"); }

function countGrams(tokens: string[], minLen: number, maxLen: number): Map<string, number> {
  const c = new Map<string, number>();
  for (const g of everygrams(tokens, minLen, maxLen)) {
    const k = counterKey(g);
    c.set(k, (c.get(k) ?? 0) + 1);
  }
  return c;
}

function sumCounts(c: Map<string, number>): number {
  let s = 0; for (const v of c.values()) s += v; return s;
}

function overlapHypRef(hyp: Map<string, number>, ref: Map<string, number>): number {
  let tp = 0;
  for (const [k, hv] of hyp) {
    const rv = ref.get(k);
    if (rv !== undefined) tp += Math.min(hv, rv);
  }
  return tp;
}

export function corpusGleu(
  listOfReferences: string[][][],
  hypotheses: string[][],
  minLen = 1,
  maxLen = 4,
): number {
  if (listOfReferences.length !== hypotheses.length) throw new Error("hypotheses and references length mismatch");
  let corpusMatch = 0, corpusAll = 0;
  for (let i = 0; i < hypotheses.length; i++) {
    const hyp = hypotheses[i]!;
    const refs = listOfReferences[i]!;
    const hypC = countGrams(hyp, minLen, maxLen);
    const tpfp = sumCounts(hypC);
    let best: [number, number] | null = null;
    let bestScore = -1;
    for (const ref of refs) {
      const refC = countGrams(ref, minLen, maxLen);
      const tpfn = sumCounts(refC);
      const tp = overlapHypRef(hypC, refC);
      const nAll = Math.max(tpfp, tpfn);
      if (nAll === 0) continue;
      const s = tp / nAll;
      if (s > bestScore) { bestScore = s; best = [tp, nAll]; }
    }
    if (best) { corpusMatch += best[0]; corpusAll += best[1]; }
  }
  return corpusAll === 0 ? 0 : corpusMatch / corpusAll;
}

export function sentenceGleu(
  references: string[][],
  hypothesis: string[],
  minLen = 1,
  maxLen = 4,
): number {
  return corpusGleu([references], [hypothesis], minLen, maxLen);
}
