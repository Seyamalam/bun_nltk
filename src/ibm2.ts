/**
 * Alignment-based lexical translation model
 * (port of nltk.translate.ibm2.IBMModel2).
 *
 * Extends Model 1 with an alignment model a(i | j, l, m). Translation
 * direction is from `mots` (source) to `words` (target). When no probability
 * tables are given, the translation table is seeded from IBM Model 1 trained
 * with 2x iterations (mirroring NLTK).
 */
import { IBMModelBase, MIN_PROB, type AlignedSentInput } from "./ibm_model";
import { IBMModel1 } from "./ibm1";

class Model2Counts {
  t_given_s = new Map<string, Map<string, number>>();
  any_t_given_s = new Map<string, number>();
  /** alignment[i][j][l][m] */
  alignment = new Map<number, Map<number, Map<number, Map<number, number>>>>();
  /** alignment_for_any_i[j][l][m] */
  alignment_for_any_i = new Map<number, Map<number, Map<number, number>>>();

  updateLexicalTranslation(normalizedCount: number, s: string, t: string): void {
    let row = this.t_given_s.get(t);
    if (!row) {
      row = new Map();
      this.t_given_s.set(t, row);
    }
    row.set(s, (row.get(s) ?? 0) + normalizedCount);
    this.any_t_given_s.set(s, (this.any_t_given_s.get(s) ?? 0) + normalizedCount);
  }

  private ensureAlignment(i: number, j: number, l: number, m: number) {
    let iRow = this.alignment.get(i);
    if (!iRow) {
      iRow = new Map();
      this.alignment.set(i, iRow);
    }
    let jRow = iRow.get(j);
    if (!jRow) {
      jRow = new Map();
      iRow.set(j, jRow);
    }
    let lRow = jRow.get(l);
    if (!lRow) {
      lRow = new Map();
      jRow.set(l, lRow);
    }
    return lRow;
  }

  updateAlignment(normalizedCount: number, i: number, j: number, l: number, m: number): void {
    const lRow = this.ensureAlignment(i, j, l, m);
    lRow.set(m, (lRow.get(m) ?? 0) + normalizedCount);

    let anyJ = this.alignment_for_any_i.get(j);
    if (!anyJ) {
      anyJ = new Map();
      this.alignment_for_any_i.set(j, anyJ);
    }
    let anyL = anyJ.get(l);
    if (!anyL) {
      anyL = new Map();
      anyJ.set(l, anyL);
    }
    anyL.set(m, (anyL.get(m) ?? 0) + normalizedCount);
  }
}

export type IBM2ProbabilityTables = {
  translation_table: Map<string, Map<string, number>>;
  alignment_table: Map<number, Map<number, Map<number, Map<number, number>>>>;
};

export class IBMModel2 extends IBMModelBase {
  constructor(
    corpus: readonly AlignedSentInput[],
    iterations: number,
    probabilityTables?: IBM2ProbabilityTables,
  ) {
    super(corpus);

    if (!probabilityTables) {
      const ibm1 = new IBMModel1(corpus, 2 * iterations);
      this.translation_table = ibm1.translation_table;
      this.setUniformProbabilities(corpus);
    } else {
      this.translation_table = probabilityTables.translation_table;
      this.alignment_table = probabilityTables.alignment_table;
    }

    for (let n = 0; n < iterations; n += 1) {
      this.train(corpus);
    }
  }

  private setUniformProbabilities(corpus: readonly AlignedSentInput[]): void {
    // a(i | j,l,m) = 1 / (l+1)
    const lMCombinations = new Set<string>();
    for (const aligned of corpus) {
      const l = aligned.mots.length;
      const m = aligned.words.length;
      const key = `${l}:${m}`;
      if (!lMCombinations.has(key)) {
        lMCombinations.add(key);
        const initialProb = 1 / (l + 1);
        if (initialProb < MIN_PROB) {
          console.warn(`A source sentence is too long (${l} words). Results may be less accurate.`);
        }
        for (let i = 0; i <= l; i += 1) {
          for (let j = 1; j <= m; j += 1) {
            let iRow = this.alignment_table.get(i);
            if (!iRow) {
              iRow = new Map();
              this.alignment_table.set(i, iRow);
            }
            let jRow = iRow.get(j);
            if (!jRow) {
              jRow = new Map();
              iRow.set(j, jRow);
            }
            let lRow = jRow.get(l);
            if (!lRow) {
              lRow = new Map();
              jRow.set(l, lRow);
            }
            lRow.set(m, initialProb);
          }
        }
      }
    }
  }

  override train(parallel_corpus: readonly AlignedSentInput[]): void {
    const counts = new Model2Counts();
    for (const aligned of parallel_corpus) {
      const srcSentence = [IBMModelBase.NULL, ...aligned.mots];
      // NLTK prepends "UNUSED" so trg_sentence is 1-indexed.
      const trgSentence = ["UNUSED", ...aligned.words];
      const l = aligned.mots.length;
      const m = aligned.words.length;

      const totalCount = this.probAllAlignments(srcSentence, trgSentence);

      for (let j = 1; j <= m; j += 1) {
        const t = trgSentence[j]!;
        for (let i = 0; i <= l; i += 1) {
          const s = srcSentence[i]!;
          const count = this.probAlignmentPoint(i, j, srcSentence, trgSentence);
          const normalized = count / (totalCount.get(t) ?? MIN_PROB);
          counts.updateLexicalTranslation(normalized, s, t);
          counts.updateAlignment(normalized, i, j, l, m);
        }
      }
    }

    this.maximizeLexicalTranslationProbabilities(counts);
    this.maximizeAlignmentProbabilities(counts);
  }

  private maximizeAlignmentProbabilities(counts: Model2Counts): void {
    for (const [i, jS] of counts.alignment) {
      for (const [j, srcLengths] of jS) {
        for (const [l, trgLengths] of srcLengths) {
          for (const [m, value] of trgLengths) {
            const any = counts.alignment_for_any_i.get(j)?.get(l)?.get(m) ?? MIN_PROB;
            const estimate = value / any;
            let iRow = this.alignment_table.get(i);
            if (!iRow) {
              iRow = new Map();
              this.alignment_table.set(i, iRow);
            }
            let jRow = iRow.get(j);
            if (!jRow) {
              jRow = new Map();
              iRow.set(j, jRow);
            }
            let lRow = jRow.get(l);
            if (!lRow) {
              lRow = new Map();
              jRow.set(l, lRow);
            }
            lRow.set(m, Math.max(estimate, MIN_PROB));
          }
        }
      }
    }
  }

  private probAllAlignments(
    srcSentence: readonly string[],
    trgSentence: readonly string[],
  ): Map<string, number> {
    const alignmentProbForT = new Map<string, number>();
    for (let j = 1; j < trgSentence.length; j += 1) {
      const t = trgSentence[j]!;
      for (let i = 0; i < srcSentence.length; i += 1) {
        alignmentProbForT.set(
          t,
          (alignmentProbForT.get(t) ?? 0) + this.probAlignmentPoint(i, j, srcSentence, trgSentence),
        );
      }
    }
    return alignmentProbForT;
  }

  private probAlignmentPoint(
    i: number,
    j: number,
    srcSentence: readonly string[],
    trgSentence: readonly string[],
  ): number {
    const l = srcSentence.length - 1;
    const m = trgSentence.length - 1;
    const s = srcSentence[i]!;
    const t = trgSentence[j]!;
    return (
      (this.translation_table.get(t)?.get(s) ?? MIN_PROB) *
      (this.alignment_table.get(i)?.get(j)?.get(l)?.get(m) ?? MIN_PROB)
    );
  }

  /** Probability of target sentence and an alignment given the source. */
  probTAGivenS(alignment: readonly number[], srcSentence: readonly string[], trgSentence: readonly string[]): number {
    let prob = 1.0;
    const l = srcSentence.length - 1;
    const m = trgSentence.length - 1;
    for (let j = 1; j < alignment.length; j += 1) {
      const i = alignment[j]!;
      const t = trgSentence[j]!;
      const s = srcSentence[i]!;
      prob *= (this.translation_table.get(t)?.get(s) ?? MIN_PROB) *
        (this.alignment_table.get(i)?.get(j)?.get(l)?.get(m) ?? MIN_PROB);
    }
    return Math.max(prob, MIN_PROB);
  }
}
