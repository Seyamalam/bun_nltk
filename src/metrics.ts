import { syncWasm } from "./sync_wasm.ts";
import { ConfusionMatrix } from "./confusion_metrics.ts";
export { accuracy, ConfusionMatrix } from "./confusion_metrics.ts";

export type BleuWeights = number[];

export type BleuPrecision = { numerator: number; denominator: number };

export type BleuSmoothingContext = {
  references: string[][];
  hypothesis: string[];
  hypLen: number;
};

export type BleuSmoothingResult = Array<number | BleuPrecision>;
export type BleuSmoothingFn = (pN: BleuSmoothingResult, context: BleuSmoothingContext) => BleuSmoothingResult;

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

function precisionValue(p: number | BleuPrecision): number {
  return typeof p === "number" ? p : p.numerator / p.denominator;
}

function fractionOf(p: number | BleuPrecision): BleuPrecision {
  return typeof p === "number" ? { numerator: p, denominator: 1 } : p;
}

export function modifiedPrecision(references: string[][], hypothesis: string[], n: number): BleuPrecision {
  const hypNgrams = ngrams(hypothesis, n);
  const total = hypNgrams.length;
  if (total === 0) return { numerator: 0, denominator: 1 };

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
  return { numerator: clipped, denominator: Math.max(1, total) };
}

export function closestRefLength(references: string[][], hypLen: number): number {
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

export function brevityPenalty(closestRefLen: number, hypLen: number): number {
  if (hypLen > closestRefLen) return 1;
  return Math.exp(1 - closestRefLen / hypLen);
}

const DEFAULT_BLEU_WEIGHTS: BleuWeights = [0.25, 0.25, 0.25, 0.25];

export class SmoothingFunction {
  constructor(
    public readonly epsilon = 0.1,
    public readonly alpha = 5,
    public readonly k = 5,
  ) {}

  method0: BleuSmoothingFn = (pN) => pN.map((p) => (fractionOf(p).numerator !== 0 ? p : Number.MIN_VALUE));

  method1: BleuSmoothingFn = (pN) =>
    pN.map((p) => (fractionOf(p).numerator === 0 ? this.epsilon / fractionOf(p).denominator : p));

  method2: BleuSmoothingFn = (pN) =>
    pN.map((p, i) => (i === 0 ? p : { numerator: fractionOf(p).numerator + 1, denominator: fractionOf(p).denominator + 1 }));

  method3: BleuSmoothingFn = (pN) => {
    const out = pN.slice();
    let incvnt = 1;
    for (let i = 0; i < out.length; i += 1) {
      const p = fractionOf(out[i]!);
      if (p.numerator === 0) {
        out[i] = 1 / (2 ** incvnt * p.denominator);
        incvnt += 1;
      }
    }
    return out;
  };

  method4: BleuSmoothingFn = (pN, context) => {
    const out = pN.slice();
    const hypLen = context.hypLen || context.hypothesis.length;
    let incvnt = 1;
    for (let i = 0; i < out.length; i += 1) {
      const p = fractionOf(out[i]!);
      if (p.numerator === 0 && hypLen > 1) {
        const numerator = 1 / ((2 ** incvnt * this.k) / Math.log(hypLen));
        out[i] = numerator / p.denominator;
        incvnt += 1;
      }
    }
    return out;
  };

  method5: BleuSmoothingFn = (pN, context) => {
    const out: BleuSmoothingResult = pN.slice();
    const plus1 = [
      ...pN.map(precisionValue),
      precisionValue(modifiedPrecision(context.references, context.hypothesis, 5)),
    ];
    let prev = precisionValue(out[0] ?? { numerator: 0, denominator: 1 }) + 1;
    for (let i = 0; i < out.length; i += 1) {
      const v = (prev + precisionValue(out[i]!) + plus1[i + 1]!) / 3;
      out[i] = v;
      prev = v;
    }
    return out;
  };

  method6: BleuSmoothingFn = (pN, context) => {
    const out: BleuSmoothingResult = pN.slice();
    if (out.length < 3 || precisionValue(out[2]!) === 0) {
      throw new Error("This smoothing method requires non-zero precision for bigrams.");
    }
    for (let i = 2; i < out.length; i += 1) {
      const p = out[i]!;
      const m = fractionOf(p).numerator;
      const l = Math.max(0, context.hypothesis.length - i);
      const pPrev2 = precisionValue(out[i - 2]!);
      const pi0 = pPrev2 === 0 ? 0 : precisionValue(out[i - 1]!) ** 2 / pPrev2;
      out[i] = (m + this.alpha * pi0) / (l + this.alpha);
    }
    return out;
  };

  method7: BleuSmoothingFn = (pN, context) => this.method5(this.method4(pN, context), context);
}

const defaultBleuSmoothing = new SmoothingFunction().method0;

function isWeightsList(weights: BleuWeights | BleuWeights[]): weights is BleuWeights[] {
  return Array.isArray(weights[0]);
}

export function sentenceBleu(
  references: string[][],
  hypothesis: string[],
  weights?: BleuWeights,
  smoothingFunction?: BleuSmoothingFn,
  autoReweigh?: boolean,
): number;
export function sentenceBleu(
  references: string[][],
  hypothesis: string[],
  weights: BleuWeights[],
  smoothingFunction?: BleuSmoothingFn,
  autoReweigh?: boolean,
): number[];
export function sentenceBleu(
  references: string[][],
  hypothesis: string[],
  weights: BleuWeights | BleuWeights[] = DEFAULT_BLEU_WEIGHTS,
  smoothingFunction?: BleuSmoothingFn,
  autoReweigh = false,
): number | number[] {
  return corpusBleu([references], [hypothesis], weights as BleuWeights[], smoothingFunction, autoReweigh) as
    | number
    | number[];
}

export function corpusBleu(
  listOfReferences: string[][][],
  hypotheses: string[][],
  weights?: BleuWeights,
  smoothingFunction?: BleuSmoothingFn,
  autoReweigh?: boolean,
): number;
export function corpusBleu(
  listOfReferences: string[][][],
  hypotheses: string[][],
  weights: BleuWeights[],
  smoothingFunction?: BleuSmoothingFn,
  autoReweigh?: boolean,
): number[];
export function corpusBleu(
  listOfReferences: string[][][],
  hypotheses: string[][],
  weights: BleuWeights | BleuWeights[] = DEFAULT_BLEU_WEIGHTS,
  smoothingFunction?: BleuSmoothingFn,
  autoReweigh = false,
): number | number[] {
  if (listOfReferences.length !== hypotheses.length) {
    throw new RangeError("The number of hypotheses and their reference(s) should be the same");
  }

  const weightList: BleuWeights[] = isWeightsList(weights) ? weights : [weights];
  const maxWeightLength = weightList.reduce((max, w) => Math.max(max, w.length), 0);

  const pNumerators = Array.from<number>({ length: maxWeightLength + 1 }).fill(0);
  const pDenominators = Array.from<number>({ length: maxWeightLength + 1 }).fill(0);
  let hypLengths = 0;
  let refLengths = 0;
  let lastRefs: string[][] = [];
  let lastHyp: string[] = [];

  for (let i = 0; i < hypotheses.length; i += 1) {
    const refs = listOfReferences[i] ?? [];
    const hyp = hypotheses[i] ?? [];
    lastRefs = refs;
    lastHyp = hyp;
    for (let n = 1; n <= maxWeightLength; n += 1) {
      const p = modifiedPrecision(refs, hyp, n);
      pNumerators[n]! += p.numerator;
      pDenominators[n]! += p.denominator;
    }
    hypLengths += hyp.length;
    refLengths += closestRefLength(refs, hyp.length);
  }

  const bp = brevityPenalty(refLengths, hypLengths);

  const pN: BleuPrecision[] = [];
  for (let i = 1; i <= maxWeightLength; i += 1) {
    pN.push({ numerator: pNumerators[i]!, denominator: pDenominators[i]! });
  }

  if ((pNumerators[1] ?? 0) === 0) {
    return weightList.length === 1 ? 0 : weightList.map(() => 0);
  }

  const smooth = smoothingFunction ?? defaultBleuSmoothing;
  const smoothed = smooth(pN, { references: lastRefs, hypothesis: lastHyp, hypLen: hypLengths });

  const scores = weightList.map((weight) => {
    let w = weight;
    if (autoReweigh && hypLengths < 4 && w.length === 4 && w.every((x) => x === 0.25)) {
      w = Array.from({ length: hypLengths }, () => 1 / hypLengths);
    }
    let s = 0;
    for (let i = 0; i < w.length && i < smoothed.length; i += 1) {
      const p = precisionValue(smoothed[i]!);
      if (p > 0) s += w[i]! * Math.log(p);
    }
    return bp * Math.exp(s);
  });
  return scores.length === 1 ? scores[0]! : scores;
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
