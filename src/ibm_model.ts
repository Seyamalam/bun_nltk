/**
 * Common methods and classes for all IBM models (port of nltk.translate.ibm_model).
 *
 * See IBMModel1/IBMModel2/... for specific implementations. The IBM models are
 * generative models that learn lexical translation probabilities
 * p(target word | source word) from a sentence-aligned parallel corpus using EM.
 *
 * Conventions (mirroring NLTK):
 * - Words in a sentence are one-indexed; index 0 is reserved for NULL in the
 *   source sentence.
 * - Each target word aligns to exactly one source word or NULL.
 *
 * Reference: Koehn 2010, "Statistical Machine Translation"; Brown et al. 1993.
 */

/** Minimum probability to avoid division by zero / precision errors. */
export const MIN_PROB = 1.0e-12;

/** A sentence in the target language paired with its translation (mots). */
export type AlignedSentInput = {
  /** Target language words (the translation output). */
  words: string[];
  /** Source language words (the input). */
  mots: string[];
};

/** Zero-indexed alignment pair (j, i): target position j -> source position i,
 * where i is -0-based over mots with i = 0 meaning NULL... NLTK uses i as an
 * index into [None] + mots, so alignment stores i = 0 for NULL and i >= 1 for
 * mots[i - 1]. We keep NLTK's convention: Alignment entries are (j, i) with
 * j zero-indexed into words and i zero-indexed into [NULL, ...mots]. */
export type AlignmentPair = readonly [j: number, i: number];

/** Counts data object accumulated during EM training. */
export class Counts {
  t_given_s = new Map<string, Map<string, number>>();
  any_t_given_s = new Map<string, number>();
  p0 = 0.0;
  p1 = 0.0;
  fertility = new Map<number, Map<string, number>>();
  fertility_for_any_phi = new Map<string, number>();

  updateLexicalTranslation(
    count: number,
    alignment: readonly number[],
    trgSentence: readonly string[],
    srcSentence: readonly string[],
    j: number,
  ): void {
    const i = alignment[j]!;
    const t = trgSentence[j]!;
    const s = srcSentence[i]!;
    let row = this.t_given_s.get(t);
    if (!row) {
      row = new Map();
      this.t_given_s.set(t, row);
    }
    row.set(s, (row.get(s) ?? 0) + count);
    this.any_t_given_s.set(s, (this.any_t_given_s.get(s) ?? 0) + count);
  }

  updateNullGeneration(count: number, fertilityOfNull: number, m: number): void {
    this.p1 += fertilityOfNull * count;
    this.p0 += (m - 2 * fertilityOfNull) * count;
  }

  updateFertility(
    count: number,
    srcSentence: readonly string[],
    fertilityOf: (i: number) => number,
  ): void {
    for (let i = 0; i < srcSentence.length; i += 1) {
      const s = srcSentence[i]!;
      const phi = fertilityOf(i);
      let row = this.fertility.get(phi);
      if (!row) {
        row = new Map();
        this.fertility.set(phi, row);
      }
      row.set(s, (row.get(s) ?? 0) + count);
      this.fertility_for_any_phi.set(s, (this.fertility_for_any_phi.get(s) ?? 0) + count);
    }
  }

  /** Number of times word i of the source occurs in the alignment. */
  static fertilityOfI(alignment: readonly number[], srcLen: number, i: number): number {
    let count = 0;
    for (let j = 1; j < alignment.length; j += 1) {
      if (alignment[j] === i) count += 1;
    }
    void srcLen;
    return count;
  }
}

/** Longest target sentence length in the corpus. */
export function longestTargetSentenceLength(corpus: readonly AlignedSentInput[]): number {
  let maxM = 0;
  for (const aligned of corpus) {
    maxM = Math.max(maxM, aligned.words.length);
  }
  return maxM;
}

/** Abstract base state shared by all IBM model implementations. */
export abstract class IBMModelBase {
  MIN_PROB = MIN_PROB;

  /** Probability(target | source): translation_table[t][s]. NULL key is "NULL". */
  translation_table = new Map<string, Map<string, number>>();

  /** Probability(i | j, l, m): alignment_table[i][j][l][m]. Models 2+. */
  alignment_table = new Map<number, Map<number, Map<number, Map<number, number>>>>();

  /** Probability(fertility | source word). Models 3+. */
  fertility_table = new Map<number, Map<string, number>>();

  /** Probability that a generated word requires another target word aligned to NULL. */
  p1 = 0.5;

  src_vocab = new Set<string>();
  trg_vocab = new Set<string>();

  static readonly NULL = "NULL";

  constructor(corpus: readonly AlignedSentInput[]) {
    this.initVocab(corpus);
  }

  protected initVocab(corpus: readonly AlignedSentInput[]): void {
    for (const aligned of corpus) {
      for (const w of aligned.words) this.trg_vocab.add(w);
      for (const m of aligned.mots) this.src_vocab.add(m);
    }
    // NLTK uses None as the NULL key; we use the sentinel string "NULL".
    this.src_vocab.add(IBMModelBase.NULL);
  }

  resetProbabilities(): void {
    this.translation_table = new Map();
    this.alignment_table = new Map();
    this.fertility_table = new Map();
    this.p1 = 0.5;
  }

  get(t: string, s: string): number {
    return this.translation_table.get(t)?.get(s) ?? MIN_PROB;
  }

  setProb(t: string, s: string, value: number): void {
    let row = this.translation_table.get(t);
    if (!row) {
      row = new Map();
      this.translation_table.set(t, row);
    }
    row.set(s, value);
  }

  maximizeLexicalTranslationProbabilities(counts: {
    t_given_s: Map<string, Map<string, number>>;
    any_t_given_s: Map<string, number>;
  }): void {
    for (const [t, srcWords] of counts.t_given_s) {
      for (const [s, count] of srcWords) {
        const any = counts.any_t_given_s.get(s) ?? 0;
        const estimate = count / any;
        this.setProb(t, s, Math.max(estimate, MIN_PROB));
      }
    }
  }

  maximizeFertilityProbabilities(counts: Counts): void {
    for (const [phi, srcWords] of counts.fertility) {
      for (const [s, count] of srcWords) {
        const any = counts.fertility_for_any_phi.get(s) ?? 0;
        const estimate = count / any;
        let row = this.fertility_table.get(phi);
        if (!row) {
          row = new Map();
          this.fertility_table.set(phi, row);
        }
        row.set(s, Math.max(estimate, MIN_PROB));
      }
    }
  }

  maximizeNullGenerationProbabilities(counts: Counts): void {
    let p1Estimate = counts.p1 / (counts.p1 + counts.p0);
    p1Estimate = Math.max(p1Estimate, MIN_PROB);
    this.p1 = Math.min(p1Estimate, 1 - MIN_PROB);
  }

  abstract train(parallel_corpus: readonly AlignedSentInput[]): void;

  /**
   * Best word alignment for one sentence pair, stored zero-indexed:
   * alignment[j] = i where i indexes [NULL, ...mots].
   */
  bestAlignments(corpus: readonly AlignedSentInput[]): AlignmentPair[][] {
    return corpus.map((pair) => {
      const out: AlignmentPair[] = [];
      for (let j = 0; j < pair.words.length; j += 1) {
        const t = pair.words[j]!;
        let bestProb = Math.max(this.get(t, IBMModelBase.NULL), MIN_PROB);
        let bestPoint = 0; // NULL
        for (let i = 1; i <= pair.mots.length; i += 1) {
          const alignProb = this.get(t, pair.mots[i - 1]!);
          if (alignProb >= bestProb) {
            // prefer newer word in case of tie
            bestProb = alignProb;
            bestPoint = i;
          }
        }
        out.push([j, bestPoint]);
      }
      return out;
    });
  }
}

/** Factorial (small n; used by IBM models 3-5). */
export function factorial(n: number): number {
  let out = 1;
  for (let i = 2; i <= n; i += 1) out *= i;
  return out;
}
