export type ChrFOptions = {
  minLen?: number;
  maxLen?: number;
  beta?: number;
  ignoreWhitespace?: boolean;
};

export type NistOptions = {
  n?: number;
};

const CHRF_EPSILON = 1e-16;

function chrFPreprocess(sent: string | string[], ignoreWhitespace: boolean): string {
  const text = typeof sent === "string" ? sent : sent.join(" ");
  return ignoreWhitespace ? text.replace(/\s+/g, "") : text;
}

function ngramCounts(sequence: string[], n: number): Map<string, number> {
  const out = new Map<string, number>();
  if (n <= 0 || sequence.length < n) return out;
  for (let i = 0; i + n <= sequence.length; i += 1) {
    const key = sequence.slice(i, i + n).join("\u0001");
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
}

function chrfPrecisionRecallFscoreSupport(
  reference: string,
  hypothesis: string,
  n: number,
  beta: number,
): { prec: number; rec: number; fscore: number; tp: number } {
  const refNgrams = ngramCounts(Array.from(reference), n);
  const hypNgrams = ngramCounts(Array.from(hypothesis), n);

  let tp = 0;
  for (const [key, hypCount] of hypNgrams.entries()) {
    const refCount = refNgrams.get(key);
    if (refCount !== undefined) tp += Math.min(refCount, hypCount);
  }
  const tpfp = [...hypNgrams.values()].reduce((a, b) => a + b, 0);
  const tpfn = [...refNgrams.values()].reduce((a, b) => a + b, 0);

  if (tpfp === 0 || tpfn === 0) {
    return { prec: CHRF_EPSILON, rec: CHRF_EPSILON, fscore: CHRF_EPSILON, tp };
  }

  const prec = tp / tpfp;
  const rec = tp / tpfn;
  const factor = beta ** 2;
  const denominator = factor * prec + rec;
  if (denominator === 0) {
    return { prec: CHRF_EPSILON, rec: CHRF_EPSILON, fscore: CHRF_EPSILON, tp };
  }
  const fscore = ((1 + factor) * (prec * rec)) / denominator;
  return { prec, rec, fscore, tp };
}

export function corpusChrF(
  references: Array<string | string[]>,
  hypotheses: Array<string | string[]>,
  options: ChrFOptions = {},
): number {
  const minLen = options.minLen ?? 1;
  const maxLen = options.maxLen ?? 6;
  const beta = options.beta ?? 3.0;
  const ignoreWhitespace = options.ignoreWhitespace ?? true;

  if (references.length !== hypotheses.length) {
    throw new Error("The number of hypotheses and their references should be the same");
  }
  if (maxLen < minLen) {
    throw new Error("chrF requires at least one n-gram order (max_len >= min_len)");
  }
  const numSents = hypotheses.length;

  const perOrderSums = new Map<number, number>();
  for (let i = 0; i < numSents; i += 1) {
    const reference = chrFPreprocess(references[i]!, ignoreWhitespace);
    const hypothesis = chrFPreprocess(hypotheses[i]!, ignoreWhitespace);
    for (let n = minLen; n <= maxLen; n += 1) {
      const { fscore } = chrfPrecisionRecallFscoreSupport(reference, hypothesis, n, beta);
      perOrderSums.set(n, (perOrderSums.get(n) ?? 0) + fscore);
    }
  }

  let total = 0;
  for (const sum of perOrderSums.values()) total += sum;
  return total / (maxLen - minLen + 1) / numSents;
}

export function sentenceChrF(
  reference: string | string[],
  hypothesis: string | string[],
  options: ChrFOptions = {},
): number {
  return corpusChrF([reference], [hypothesis], options);
}

function log2(x: number): number {
  return Math.log(x) / Math.log(2);
}

type NistTuple = [precision: number, numerator: number, denominator: number, refLen: number];

function tupleLess(a: NistTuple, b: NistTuple): boolean {
  for (let i = 0; i < 4; i += 1) {
    if (a[i]! < b[i]!) return true;
    if (a[i]! > b[i]!) return false;
  }
  return false;
}

export function nistLengthPenalty(refLen: number, hypLen: number): number {
  const ratio = hypLen / refLen;
  if (ratio > 0 && ratio < 1) {
    const beta = Math.log(0.5) / Math.log(1.5) ** 2;
    return Math.exp(beta * Math.log(ratio) ** 2);
  }
  return Math.max(Math.min(ratio, 1.0), 0.0);
}

export function corpusNist(
  listOfReferences: string[][][],
  hypotheses: string[][],
  options: NistOptions = {},
): number {
  const n = options.n ?? 5;
  if (listOfReferences.length !== hypotheses.length) {
    throw new Error("The number of hypotheses and their reference(s) should be the same");
  }

  const ngramFreq = new Map<string, number>();
  let totalReferenceWords = 0;
  for (const references of listOfReferences) {
    for (const reference of references) {
      for (let i = 1; i <= n; i += 1) {
        for (const [key, count] of ngramCounts(reference, i).entries()) {
          ngramFreq.set(key, (ngramFreq.get(key) ?? 0) + count);
        }
      }
      totalReferenceWords += reference.length;
    }
  }

  const informationWeights = new Map<string, number>();
  for (const [ngramKey, freq] of ngramFreq.entries()) {
    const parts = ngramKey.split("\u0001");
    const mgramKey = parts.length > 1 ? parts.slice(0, -1).join("\u0001") : "";
    const numerator =
      mgramKey !== "" && ngramFreq.has(mgramKey) ? ngramFreq.get(mgramKey)! : totalReferenceWords;
    informationWeights.set(ngramKey, log2(numerator / freq));
  }

  const numeratorPerNgram = new Map<number, number>();
  const denominatorPerNgram = new Map<number, number>();
  let lRef = 0;
  let lSys = 0;

  for (let i = 1; i <= n; i += 1) {
    for (let s = 0; s < hypotheses.length; s += 1) {
      const references = listOfReferences[s]!;
      const hypothesis = hypotheses[s]!;
      const hypLen = hypothesis.length;
      if (references.length === 0) {
        throw new Error("each hypothesis needs at least one reference for NIST");
      }

      let best: NistTuple | null = null;
      for (const reference of references) {
        const refLen = reference.length;
        const hypNgrams = hypLen >= i ? ngramCounts(hypothesis, i) : new Map<string, number>();
        const refNgrams = reference.length >= i ? ngramCounts(reference, i) : new Map<string, number>();

        let numerator = 0;
        for (const [key, count] of hypNgrams.entries()) {
          const refCount = refNgrams.get(key);
          if (refCount !== undefined) {
            numerator += (informationWeights.get(key) ?? 0) * Math.min(count, refCount);
          }
        }
        const denominator = [...hypNgrams.values()].reduce((a, b) => a + b, 0);
        const precision = denominator === 0 ? 0 : numerator / denominator;
        const candidate: NistTuple = [precision, numerator, denominator, refLen];
        if (best === null || tupleLess(best, candidate)) best = candidate;
      }

      const chosen: NistTuple = best ?? [0, 0, 0, 0];
      numeratorPerNgram.set(i, (numeratorPerNgram.get(i) ?? 0) + chosen[1]);
      denominatorPerNgram.set(i, (denominatorPerNgram.get(i) ?? 0) + chosen[2]);
      lRef += chosen[3];
      lSys += hypLen;
    }
  }

  let nistPrecision = 0;
  for (const [order, denominator] of denominatorPerNgram.entries()) {
    if (denominator === 0) {
      throw new Error(`nist: no ${order}-grams in any hypothesis (python raises ZeroDivisionError)`);
    }
    nistPrecision += (numeratorPerNgram.get(order) ?? 0) / denominator;
  }
  return nistPrecision * nistLengthPenalty(lRef, lSys);
}

export function sentenceNist(
  references: string[][],
  hypothesis: string[],
  options: NistOptions = {},
): number {
  return corpusNist([references], [hypothesis], options);
}
