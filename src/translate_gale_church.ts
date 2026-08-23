/**
 * Gale-Church sentence alignment (port of nltk.translate.gale_church).
 *
 * Aligns two sequences of sentence lengths via dynamic programming.
 */

const LOG2 = Math.log(2);
export const MAX_ALIGN_BLOCKS = 4000;

export const LanguageIndependent = {
  PRIORS: new Map<string, number>([
    ["1,0", 0.0099], ["0,1", 0.0099], ["1,1", 0.89], ["2,1", 0.089], ["1,2", 0.089], ["2,2", 0.011],
  ]),
  AVERAGE_CHARACTERS: 1,
  VARIANCE_CHARACTERS: 6.8,
} as const;

function erfcc(x: number): number {
  const z = Math.abs(x);
  let t = 1 / (1 + 0.5 * z);
  let r = t * Math.exp(-z*z -1.26551223 + t*(1.00002368 + t*(0.37409196 + t*(0.09678418 + t*(-0.18628806 + t*(0.27886807 + t*(-1.13520398 + t*(1.48851587 + t*(-0.82215223 + t*0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}
function normCdf(x: number): number { return 1 - 0.5 * erfcc(x / Math.SQRT2); }
function normLogSf(x: number): number {
  try { const v = 1 - normCdf(x); return v <= 0 ? Number.NEGATIVE_INFINITY : Math.log(v); }
  catch { return Number.NEGATIVE_INFINITY; }
}

export function alignLogProb(
  i: number, j: number,
  sourceSentsLens: number[], targetSentsLens: number[],
  alignment: [number, number],
  params: typeof LanguageIndependent = LanguageIndependent,
): number {
  const [a0, a1] = alignment;
  let lS = 0, lT = 0;
  for (let k = 0; k < a0; k++) lS += sourceSentsLens[i - k - 1] ?? 0;
  for (let k = 0; k < a1; k++) lT += targetSentsLens[j - k - 1] ?? 0;
  try {
    const m = (lS + lT / (params as any).AVERAGE_CHARACTERS) / 2;
    const delta = (lS * (params as any).AVERAGE_CHARACTERS - lT) / Math.sqrt(m * (params as any).VARIANCE_CHARACTERS);
    const key = `${a0},${a1}`;
    const prior = (params as any).PRIORS.get(key) ?? 0.01;
    return -(LOG2 + normLogSf(Math.abs(delta)) + Math.log(prior));
  } catch { return Number.NEGATIVE_INFINITY; }
}

export function trace(
  backlinks: Map<string, [number, number] | null>,
  sourceSentsLens: number[],
  targetSentsLens: number[],
): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let i = sourceSentsLens.length, j = targetSentsLens.length;
  while (i > 0 || j > 0) {
    const a = backlinks.get(`${i},${j}`);
    if (!a) break;
    const [a0, a1] = a;
    // expand multi-sentence alignments into 1-1 pairs for compatibility with NLTK's trace output
    if (a0 === 1 && a1 === 1) out.push([i-1, j-1]);
    else if (a0 === 2 && a1 === 1) { out.push([i-1, j-1]); out.push([i-2, j-1]); }
    else if (a0 === 1 && a1 === 2) { out.push([i-1, j-1]); out.push([i-1, j-2]); }
    else if (a0 === 2 && a1 === 2) { out.push([i-2, j-2]); out.push([i-1, j-1]); }
    else if (a0 === 1 && a1 === 0) out.push([i-1, -1]);
    else if (a0 === 0 && a1 === 1) out.push([-1, j-1]);
    else out.push([i-a0, j-a1] as any);
    i -= a0; j -= a1;
    if (out.length > 100000) break;
  }
  return out.reverse();
}

export function alignBlocks(
  sourceSentsLens: number[],
  targetSentsLens: number[],
  params: typeof LanguageIndependent = LanguageIndependent,
): Array<[number, number]> {
  const longest = Math.max(sourceSentsLens.length, targetSentsLens.length);
  if (longest > MAX_ALIGN_BLOCKS) throw new Error(`align_blocks: ${longest} exceeds MAX_ALIGN_BLOCKS ${MAX_ALIGN_BLOCKS}`);
  const alignmentTypes: Array<[number,number]> = [[1,0],[0,1],[1,1],[2,1],[1,2],[2,2]];
  const D: number[][] = [[]];
  const backlinks = new Map<string, [number,number] | null>();
  for (let i = 0; i <= sourceSentsLens.length; i++) {
    for (let j = 0; j <= targetSentsLens.length; j++) {
      let minDist = Infinity;
      let minAlign: [number,number] | null = null;
      for (const a of alignmentTypes) {
        const prevI = -1 - a[0];
        const prevJ = j - a[1];
        const row = D.length + prevI;
        if (row < 0 || row >= D.length || prevJ < 0 || prevJ >= (D[row]?.length ?? 0)) {
          // handle i=0/j=0 edge: only (0,0) is valid start
          if (i === a[0] && j === a[1]) {
            const p = alignLogProb(i, j, sourceSentsLens, targetSentsLens, a as [number,number], params);
            if (p < minDist) { minDist = p; minAlign = a as [number,number]; }
          }
          continue;
        }
        const prev = D[row]?.[prevJ];
        if (prev === undefined) continue;
        const p = prev + alignLogProb(i, j, sourceSentsLens, targetSentsLens, a as [number,number], params);
        if (p < minDist) { minDist = p; minAlign = a as [number,number]; }
      }
      if (!isFinite(minDist)) minDist = 0;
      backlinks.set(`${i},${j}`, minAlign);
      D[D.length - 1]!.push(minDist);
    }
    if (D.length > 2) D.shift();
    D.push([]);
  }
  // Trace is handled via backlinks; for now return the simple block pairing
  // NLTK's trace walks backlinks to produce sentence-to-sentence pairs
  return trace(backlinks, sourceSentsLens, targetSentsLens);
}
