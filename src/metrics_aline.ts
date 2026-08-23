/**
 * ALINE phonetic-sequence alignment (port of nltk.metrics.aline).
 *
 * Aligns two phonetic strings via Kondrak's (2002) ALINE algorithm.
 * Feature data lives in aline_data.ts, extracted verbatim from NLTK.
 */
import { consonants, featureMatrix, R_c, R_v, salience, similarityMatrix } from "./aline_data";

export const MAX_ALIGN_INPUT_LEN = 512;

const C_skip = -10; // Indels
const C_sub = 35; // Substitutions
const C_exp = 45; // Expansions/compressions
const C_vwl = 5; // Vowel/consonant relative weight

type Alignment = Array<[string, string]>;

function validateSegments(seq: string, name: string): void {
  for (let i = 0; i < seq.length; i++) {
    if (!(seq[i]! in featureMatrix)) {
      throw new Error(`Segment '${seq[i]}' at position ${i} in ${name} not found in feature_matrix`);
    }
  }
}

/** Score of an indel of P. (Kondrak 2002: 54) */
export function sigmaSkip(_p: string): number {
  return C_skip;
}

/** Score of a substitution of P with Q. (Kondrak 2002: 54) */
export function sigmaSub(p: string, q: string): number {
  return C_sub - delta(p, q) - V(p) - V(q);
}

/** Score of an expansion/compression. (Kondrak 2002: 54) */
export function sigmaExp(p: string, q: string): number {
  if (q.length !== 2) throw new Error(`sigma_exp expects q of length 2, got ${q.length}`);
  const q1 = q[0]!;
  const q2 = q[1]!;
  return C_exp - delta(p, q1) - delta(p, q2) - V(p) - Math.max(V(q1), V(q2));
}

/** Weighted sum of difference between P and Q. (Kondrak 2002: 54) */
export function delta(p: string, q: string): number {
  const features = relevantFeatures(p, q);
  let total = 0;
  for (const f of features) total += diff(p, q, f) * salience[f]!;
  return total;
}

/** Difference between phonetic segments P and Q for feature F. (Kondrak 2002: 52, 54) */
export function diff(p: string, q: string, f: string): number {
  const pFeatures = featureMatrix[p]!;
  const qFeatures = featureMatrix[q]!;
  return Math.abs(similarityMatrix[pFeatures[f]!]! - similarityMatrix[qFeatures[f]!]!);
}

/** Relevant features for segment comparison. (Kondrak 2002: 54) */
export function relevantFeatures(p: string, q: string): string[] {
  if (consonants.includes(p) || consonants.includes(q)) return R_c;
  return R_v;
}

/** Vowel weight if P is a vowel, else 0. (Kondrak 2002: 54) */
export function V(p: string): number {
  if (consonants.includes(p)) return 0;
  return C_vwl;
}

function retrieve(i: number, j: number, s: number, S: number[][], T: number, str1: string, str2: string, out: Alignment): Alignment {
  if (S[i]![j] === 0) return out;

  if (j > 1 && S[i - 1]![j - 2]! + sigmaExp(str1[i - 1]!, str2.slice(j - 2, j)) + s >= T) {
    out.unshift([str1[i - 1]!, str2.slice(j - 2, j)]);
    retrieve(i - 1, j - 2, s + sigmaExp(str1[i - 1]!, str2.slice(j - 2, j)), S, T, str1, str2, out);
  } else if (i > 1 && S[i - 2]![j - 1]! + sigmaExp(str2[j - 1]!, str1.slice(i - 2, i)) + s >= T) {
    out.unshift([str1.slice(i - 2, i), str2[j - 1]!]);
    retrieve(i - 2, j - 1, s + sigmaExp(str2[j - 1]!, str1.slice(i - 2, i)), S, T, str1, str2, out);
  } else if (S[i]![j - 1]! + sigmaSkip(str2[j - 1]!) + s >= T) {
    out.unshift(["-", str2[j - 1]!]);
    retrieve(i, j - 1, s + sigmaSkip(str2[j - 1]!), S, T, str1, str2, out);
  } else if (S[i - 1]![j]! + sigmaSkip(str1[i - 1]!) + s >= T) {
    out.unshift([str1[i - 1]!, "-"]);
    retrieve(i - 1, j, s + sigmaSkip(str1[i - 1]!), S, T, str1, str2, out);
  } else if (S[i - 1]![j - 1]! + sigmaSub(str1[i - 1]!, str2[j - 1]!) + s >= T) {
    out.unshift([str1[i - 1]!, str2[j - 1]!]);
    retrieve(i - 1, j - 1, s + sigmaSub(str1[i - 1]!, str2[j - 1]!), S, T, str1, str2, out);
  }
  return out;
}

/**
 * Compute the alignment(s) of two phonetic strings.
 *
 * @param epsilon adjusts the threshold score for near-optimal alignments (0..1)
 * @returns alignments of str1 and str2 — each is a list of [segment1, segment2]
 */
export function align(str1: string, str2: string, epsilon = 0): Alignment[] {
  if (epsilon < 0.0 || epsilon > 1.0) throw new Error("Epsilon must be between 0.0 and 1.0.");

  validateSegments(str1, "str1");
  validateSegments(str2, "str2");

  const longest = Math.max(str1.length, str2.length);
  if (longest > MAX_ALIGN_INPUT_LEN) {
    throw new Error(`align: input length ${longest} exceeds MAX_ALIGN_INPUT_LEN (${MAX_ALIGN_INPUT_LEN}).`);
  }

  const m = str1.length;
  const n = str2.length;
  const NEG_INF = Number.NEGATIVE_INFINITY;

  // Row 0 and column 0 initialized to 0 (Kondrak's initialization).
  const S: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const edit1 = S[i - 1]![j]! + sigmaSkip(str1[i - 1]!);
      const edit2 = S[i]![j - 1]! + sigmaSkip(str2[j - 1]!);
      const edit3 = S[i - 1]![j - 1]! + sigmaSub(str1[i - 1]!, str2[j - 1]!);
      const edit4 = i > 1 ? S[i - 2]![j - 1]! + sigmaExp(str2[j - 1]!, str1.slice(i - 2, i)) : NEG_INF;
      const edit5 = j > 1 ? S[i - 1]![j - 2]! + sigmaExp(str1[i - 1]!, str2.slice(j - 2, j)) : NEG_INF;
      S[i]![j] = Math.max(edit1, edit2, edit3, edit4, edit5, 0);
    }
  }

  let maxScore = NEG_INF;
  for (let i = 0; i <= m; i++) for (let j = 0; j <= n; j++) if (S[i]![j]! > maxScore) maxScore = S[i]![j]!;
  const T = (1 - epsilon) * maxScore;

  const alignments: Alignment[] = [];
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (S[i]![j]! >= T) {
        alignments.push(retrieve(i, j, 0, S, T, str1, str2, []));
      }
    }
  }
  return alignments;
}
