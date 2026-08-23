/**
 * RIBES score (port of nltk.translate.ribes_score).
 *
 * Rank-based Intuitive Bilingual Evaluation:
 *   RIBES = kendall_tau * alpha^p1 * beta^bp
 *
 * Isozaki et al. (2010), "Automatic Evaluation of Translation Quality for
 * Distant Language Pairs" (EMNLP). Matches NLTK's re-implementation
 * (not the official RIBES script).
 */

export const MAX_ALIGNMENT_LEN = 2000;

function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return Math.round(result);
}

/**
 * Word rank alignment: word indices of the hypothesis w.r.t. reference order.
 *
 * Examples from Isozaki et al. 2010 (0-indexed):
 *   ref = "he was interested in world history because he read the book"
 *   hyp = "he read the book because he was interested in world history"
 *   -> [7, 8, 9, 10, 6, 0, 1, 2, 3, 4, 5]
 */
export function wordRankAlignment(reference: string[], hypothesis: string[]): number[] {
  if (Math.max(reference.length, hypothesis.length) > MAX_ALIGNMENT_LEN) {
    throw new Error(
      `word_rank_alignment: sequence length exceeds MAX_ALIGNMENT_LEN (${MAX_ALIGNMENT_LEN}).`,
    );
  }

  const hypLen = hypothesis.length;
  const refLen = reference.length;

  // Occurrence counts per token for the O(1) unigram checks.
  const refCount = new Map<string, number>();
  for (const w of reference) refCount.set(w, (refCount.get(w) ?? 0) + 1);
  const hypCount = new Map<string, number>();
  for (const w of hypothesis) hypCount.set(w, (hypCount.get(w) ?? 0) + 1);

  const ngramCountCache = new Map<string, number>();

  // Overlapping contiguous-occurrence count via KMP.
  function countNgram(sequence: string[], seqId: string, ngram: string[]): number {
    const key = seqId + "\x1f" + ngram.join("\x1e");
    const cached = ngramCountCache.get(key);
    if (cached !== undefined) return cached;
    const m = ngram.length;
    let count = 0;
    if (m > 0 && m <= sequence.length) {
      const prefix = new Array<number>(m).fill(0);
      let k = 0;
      for (let j = 1; j < m; j++) {
        while (k > 0 && ngram[j] !== ngram[k]) k = prefix[k - 1]!;
        if (ngram[j] === ngram[k]) k += 1;
        prefix[j] = k;
      }
      k = 0;
      for (const token of sequence) {
        while (k > 0 && token !== ngram[k]) k = prefix[k - 1]!;
        if (token === ngram[k]) {
          k += 1;
          if (k === m) {
            count += 1;
            k = prefix[k - 1]!;
          }
        }
      }
    }
    ngramCountCache.set(key, count);
    return count;
  }

  /** First index in `sentence` where `ngram` occurs contiguously. */
  function positionOfNgram(ngram: string[], sentence: string[]): number | undefined {
    outer: for (let i = 0; i + ngram.length <= sentence.length; i++) {
      for (let j = 0; j < ngram.length; j++) {
        if (sentence[i + j] !== ngram[j]) continue outer;
      }
      return i;
    }
    return undefined;
  }

  const worder: number[] = [];
  for (let i = 0; i < hypLen; i++) {
    const hWord = hypothesis[i]!;
    if (!reference.includes(hWord)) continue;

    const hCount = hypCount.get(hWord)!;
    const rCount = refCount.get(hWord)!;
    if (hCount === 1 && rCount === 1) {
      worder.push(reference.indexOf(hWord));
      continue;
    }

    const maxWindowSize = Math.min(Math.max(i, hypLen - i + 1), refLen);
    let matched = false;
    for (let window = 1; window < maxWindowSize; window++) {
      if (i + window < hypLen) {
        const rightContextNgram = hypothesis.slice(i, i + window + 1);
        const numRef = countNgram(reference, "ref", rightContextNgram);
        const numHyp = countNgram(hypothesis, "hyp", rightContextNgram);
        if (numRef === 1 && numHyp === 1) {
          const pos = positionOfNgram(rightContextNgram, reference);
          if (pos !== undefined) worder.push(pos);
          matched = true;
          break;
        }
      }
      if (window <= i) {
        const leftContextNgram = hypothesis.slice(i - window, i + 1);
        const numRef = countNgram(reference, "ref", leftContextNgram);
        const numHyp = countNgram(hypothesis, "hyp", leftContextNgram);
        if (numRef === 1 && numHyp === 1) {
          const pos = positionOfNgram(leftContextNgram, reference);
          if (pos !== undefined) worder.push(pos + leftContextNgram.length - 1);
          matched = true;
          break;
        }
      }
    }
    void matched;
  }
  return worder;
}

/** Group monotonic +1 sequences of length >= 2 out of `worder`. */
export function findIncreasingSequences(worder: number[]): number[][] {
  const result: number[][] = [];
  let current: number[] = [];
  for (let i = 0; i < worder.length; i++) {
    if (current.length === 0 || worder[i] === current[current.length - 1]! + 1) {
      current.push(worder[i]!);
    } else {
      if (current.length > 1) result.push(current);
      current = [worder[i]!];
    }
  }
  if (current.length > 1) result.push(current);
  return result;
}

/**
 * Kendall's Tau over the word alignment.
 * tau = 2*increasing_pairs/possible_pairs - 1; normalized to [0,1] by default.
 */
export function kendallTau(worder: number[], normalize = true): number {
  const len = worder.length;
  let tau: number;
  if (len < 2) {
    tau = -1;
  } else {
    const increasingSequences = findIncreasingSequences(worder);
    const numIncreasingPairs = increasingSequences.reduce((sum, seq) => sum + choose(seq.length, 2), 0);
    const numPossiblePairs = choose(len, 2);
    tau = (2 * numIncreasingPairs) / numPossiblePairs - 1;
  }
  return normalize ? (tau + 1) / 2 : tau;
}

/**
 * Spearman's Rho over the word alignment.
 * rho = 1 - sum(d²)/choose(len+1, 3); normalized to [0,1] by default.
 */
export function spearmanRho(worder: number[], normalize = true): number {
  const len = worder.length;
  let sumDSquare = 0;
  for (let i = 0; i < len; i++) sumDSquare += (worder[i]! - i) ** 2;
  const rho = 1 - sumDSquare / choose(len + 1, 3);
  return normalize ? (rho + 1) / 2 : rho;
}

/**
 * Sentence-level RIBES — best score across references.
 */
export function sentenceRibes(
  references: string[][],
  hypothesis: string[],
  alpha = 0.25,
  beta = 0.10,
): number {
  if (references.length === 0 || hypothesis.length === 0) return 0.0;

  let bestRibes = -1.0;
  for (const reference of references) {
    const worder = wordRankAlignment(reference, hypothesis);
    const nkt = kendallTau(worder);
    const bp = Math.min(1.0, Math.exp(1.0 - reference.length / hypothesis.length));
    const p1 = worder.length / hypothesis.length;
    const ribes = nkt * Math.pow(p1, alpha) * Math.pow(bp, beta);
    if (ribes > bestRibes) bestRibes = ribes;
  }
  return bestRibes;
}

/**
 * Corpus-level RIBES — macro-average of per-sentence best scores.
 */
export function corpusRibes(
  listOfReferences: string[][][],
  hypotheses: string[][],
  alpha = 0.25,
  beta = 0.10,
): number {
  if (hypotheses.length === 0) return 0.0;
  if (listOfReferences.length !== hypotheses.length) {
    throw new Error("The number of reference sets must match the number of hypotheses.");
  }
  let total = 0.0;
  for (let i = 0; i < hypotheses.length; i++) {
    total += sentenceRibes(listOfReferences[i]!, hypotheses[i]!, alpha, beta);
  }
  return total / hypotheses.length;
}
