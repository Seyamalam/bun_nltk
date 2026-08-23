/**
 * LEPOR score (port of nltk.translate.lepor).
 *
 * Han et al. (2012) "LEPOR: A Robust Evaluation Metric for Machine Translation
 * with Augmented Factors"  https://aclanthology.org/C12-2044
 * All 6 functions are a verbatim port of the NLTK implementation.
 */

import { treebankWordTokenize } from "./tokenizers";

// ---------------------------------------------------------------------------
// 1. length_penalty
// ---------------------------------------------------------------------------
export function lengthPenalty(reference: string[], hypothesis: string[]): number {
  const refLen = reference.length;
  const hypLen = hypothesis.length;
  if (refLen === hypLen) return 1;
  if (refLen < hypLen) return Math.exp(1 - refLen / hypLen);
  return Math.exp(1 - hypLen / refLen);
}
export const length_penalty = lengthPenalty;

// ---------------------------------------------------------------------------
// 2. alignment
// ---------------------------------------------------------------------------
export function alignment(refTokens: string[], hypTokens: string[]): number[] {
  const aligns: number[] = [];
  const hypLen = hypTokens.length;
  const refLen = refTokens.length;

  const refPositions = new Map<string, number[]>();
  for (let idx = 0; idx < refTokens.length; idx++) {
    const tok = refTokens[idx]!;
    const list = refPositions.get(tok);
    if (list) list.push(idx);
    else refPositions.set(tok, [idx]);
  }

  for (let hypIndex = 0; hypIndex < hypTokens.length; hypIndex++) {
    const hypToken = hypTokens[hypIndex]!;
    const refIndexes: number[] = refPositions.get(hypToken) ?? [];
    if (refIndexes.length === 0) {
      aligns.push(-1);
    } else if (refIndexes.length === 1) {
      aligns.push(refIndexes[0]!);
    } else {
      const isMatched: boolean[] = new Array(refIndexes.length).fill(false);
      for (let ind = 0; ind < refIndexes.length; ind++) {
        const refIndex = refIndexes[ind]!;
        if (
          refIndex - 1 > 0 &&
          refIndex - 1 < refLen &&
          hypIndex - 1 > 0 &&
          hypIndex - 1 < hypLen &&
          refTokens[refIndex - 1] === hypTokens[hypIndex - 1]
        ) {
          isMatched[ind] = true;
        } else if (
          refIndex + 1 > 0 &&
          refIndex + 1 < refLen &&
          hypIndex + 1 > 0 &&
          hypIndex + 1 < hypLen &&
          refTokens[refIndex + 1] === hypTokens[hypIndex + 1]
        ) {
          isMatched[ind] = true;
        } else {
          isMatched[ind] = false;
        }
      }
      const trueCount = isMatched.filter(Boolean).length;
      if (trueCount === 1) {
        const idx = isMatched.indexOf(true);
        aligns.push(refIndexes[idx]!);
      } else if (trueCount > 1) {
        let minDistance = 0;
        let minIndex = 0;
        for (let k = 0; k < isMatched.length; k++) {
          if (isMatched[k]) {
            const ri = refIndexes[k]!;
            const distance = Math.abs(hypIndex - ri);
            if (distance > minDistance) {
              minDistance = distance;
              minIndex = ri;
            }
          }
        }
        aligns.push(minIndex);
      } else {
        let minDistance = 0;
        let minIndex = 0;
        for (const ri of refIndexes) {
          const distance = Math.abs(hypIndex - ri);
          if (distance > minDistance) {
            minDistance = distance;
            minIndex = ri;
          }
        }
        aligns.push(minIndex);
      }
    }
  }
  return aligns.filter((a) => a !== -1).map((a) => a + 1);
}

// ---------------------------------------------------------------------------
// 3. ngram_positional_penalty
// ---------------------------------------------------------------------------
export function ngramPositionalPenalty(
  refTokens: string[],
  hypTokens: string[],
): [number, number] {
  const al = alignment(refTokens, hypTokens);
  const matchCount = al.length;
  const pd: number[] = [];
  for (let i = 0; i < al.length; i++) {
    const a = al[i]!;
    pd.push(Math.abs((i + 1) / hypTokens.length - a / refTokens.length));
  }
  const npd = pd.reduce((s, v) => s + v, 0) / hypTokens.length;
  // Guard same as Python: when matchCount=0, pd is empty so npd = 0, exp(0)=1 — matches Python (sum([])/len == 0)
  return [Math.exp(-npd), matchCount];
}
export const ngram_positional_penalty = ngramPositionalPenalty;

// ---------------------------------------------------------------------------
// 4. harmonic
// ---------------------------------------------------------------------------
export function harmonic(
  matchCount: number,
  referenceLength: number,
  hypothesisLength: number,
  alpha: number,
  beta: number,
): number {
  const epsilon = Number.EPSILON;
  const precision = matchCount / hypothesisLength;
  const recall = matchCount / referenceLength;
  return (alpha + beta) / (alpha / (recall + epsilon) + beta / (precision + epsilon));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
type TokenizerFn = (s: string) => string[];
const defaultTokenizer: TokenizerFn = (s) => treebankWordTokenize(s);

function tokenizeIfNeeded(
  s: string | string[],
  tokenizer: TokenizerFn | null | undefined,
): string[] {
  if (Array.isArray(s)) return [...s];
  const fn: TokenizerFn = tokenizer ?? defaultTokenizer;
  return fn(s);
}

// ---------------------------------------------------------------------------
// 5. sentence_lepor
// ---------------------------------------------------------------------------
export function sentenceLepor(
  references: Array<string | string[]>,
  hypothesis: string | string[],
  alpha = 1.0,
  beta = 1.0,
  tokenizer?: TokenizerFn | null,
): number[] {
  const fn: TokenizerFn | null | undefined = tokenizer;
  const hypTokens: string[] = tokenizeIfNeeded(hypothesis, fn);
  const refTokenLists: string[][] = references.map((r) => tokenizeIfNeeded(r as string | string[], fn));

  const scores: number[] = [];
  for (const reference of refTokenLists) {
    if (reference.length === 0 || hypTokens.length === 0) {
      throw new Error("One of the sentence is empty. Exit.");
    }
    const lp = lengthPenalty(reference, hypTokens);
    const [npd, matchCount] = ngramPositionalPenalty(reference, hypTokens);
    const h = harmonic(matchCount, reference.length, hypTokens.length, alpha, beta);
    scores.push(lp * npd * h);
  }
  return scores;
}
export const sentence_lepor = sentenceLepor;

// ---------------------------------------------------------------------------
// 6. corpus_lepor
// ---------------------------------------------------------------------------
export function corpusLepor(
  references: Array<Array<string | string[]>>,
  hypotheses: Array<string | string[]>,
  alpha = 1.0,
  beta = 1.0,
  tokenizer?: TokenizerFn | null,
): number[][] {
  if (references.length === 0 || hypotheses.length === 0) {
    throw new Error("There is an Empty list. Exit.");
  }
  if (references.length !== hypotheses.length) {
    throw new Error("The number of hypothesis and their reference(s) should be the same");
  }
  const out: number[][] = [];
  for (let i = 0; i < references.length; i++) {
    out.push(sentenceLepor(references[i]!, hypotheses[i]!, alpha, beta, tokenizer));
  }
  return out;
}
export const corpus_lepor = corpusLepor;
