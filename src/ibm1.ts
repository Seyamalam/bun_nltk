/**
 * Lexical translation model that ignores word order
 * (port of nltk.translate.ibm1.IBMModel1).
 *
 * Translation direction is from `mots` (source) to `words` (target).
 *
 * Example (mirrors the NLTK doctest):
 * ```
 * const bitext = [
 *   { mots: ['klein', 'ist', 'das', 'haus'], words: ['the', 'house', 'is', 'small'] },
 *   ...
 * ];
 * const ibm1 = new IBMModel1(bitext, 5);
 * ibm1.translation_table.get('buch')?.get('book')  // ~0.889
 * ```
 */
import { IBMModelBase, MIN_PROB, Counts, type AlignedSentInput } from "./ibm_model";

export class IBMModel1 extends IBMModelBase {
  constructor(
    corpus: readonly AlignedSentInput[],
    iterations: number,
    probabilityTables?: { translation_table: Map<string, Map<string, number>> },
  ) {
    super(corpus);

    if (!probabilityTables) {
      this.setUniformProbabilities();
    } else {
      this.translation_table = probabilityTables.translation_table;
    }

    for (let n = 0; n < iterations; n += 1) {
      this.train(corpus);
    }
    // NLTK's IBMModel1.__init__ ends with align_all(corpus).
  }

  private setUniformProbabilities(): void {
    const initialProb = 1 / this.trg_vocab.size;
    if (initialProb < MIN_PROB) {
      console.warn(`Target language vocabulary is too large (${this.trg_vocab.size} words). Results may be less accurate.`);
    }
    for (const t of this.trg_vocab) {
      const row = new Map<string, number>();
      for (const s of this.src_vocab) row.set(s, initialProb);
      row.set(IBMModelBase.NULL, initialProb);
      this.translation_table.set(t, row);
    }
  }

  override train(parallel_corpus: readonly AlignedSentInput[]): void {
    const counts = new Counts();
    for (const aligned of parallel_corpus) {
      const trgSentence = aligned.words;
      // NLTK prepends None to the source sentence; we use the NULL sentinel.
      const srcSentence = [IBMModelBase.NULL, ...aligned.mots];

      // E step (a): normalization factors
      const totalCount = this.probAllAlignments(srcSentence, trgSentence);

      // E step (b): collect counts
      for (const t of trgSentence) {
        for (const s of srcSentence) {
          const count = this.probAlignmentPoint(s, t);
          const normalized = count / (totalCount.get(t) ?? MIN_PROB);
          let row = counts.t_given_s.get(t);
          if (!row) {
            row = new Map();
            counts.t_given_s.set(t, row);
          }
          row.set(s, (row.get(s) ?? 0) + normalized);
          counts.any_t_given_s.set(s, (counts.any_t_given_s.get(s) ?? 0) + normalized);
        }
      }
    }

    // M step
    this.maximizeLexicalTranslationProbabilities(counts);
  }

  /** Marginal alignment probability contribution for each target word t. */
  private probAllAlignments(
    srcSentence: readonly string[],
    trgSentence: readonly string[],
  ): Map<string, number> {
    const alignmentProbForT = new Map<string, number>();
    for (const t of trgSentence) {
      for (const s of srcSentence) {
        alignmentProbForT.set(t, (alignmentProbForT.get(t) ?? 0) + this.probAlignmentPoint(s, t));
      }
    }
    return alignmentProbForT;
  }

  private probAlignmentPoint(s: string, t: string): number {
    return this.translation_table.get(t)?.get(s) ?? MIN_PROB;
  }

  /** Probability of the target sentence and an alignment given the source. */
  probTAGivenS(alignment: readonly number[], srcSentence: readonly string[], trgSentence: readonly string[]): number {
    let prob = 1.0;
    for (let j = 1; j < alignment.length; j += 1) {
      // skip dummy zeroeth element
      const i = alignment[j]!;
      const trgWord = trgSentence[j]!;
      const srcWord = srcSentence[i]!;
      prob *= this.get(trgWord, srcWord);
    }
    return Math.max(prob, MIN_PROB);
  }
}
