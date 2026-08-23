/**
 * Translation model that considers how a word can be aligned to multiple
 * words in another language (port of nltk.translate.ibm3.IBMModel3).
 *
 * Adds fertility, distortion d(j | i,l,m), and NULL-generation probability
 * on top of Model 2. Seeded from IBM Model 2 when no tables are given.
 */
import {
  AlignmentInfo,
  MIN_PROB,
  SamplingModel,
  type AlignedSent,
} from "./ibm_sampling";
import { IBMModelBase, Counts, factorial } from "./ibm_model";
import { IBMModel2 } from "./ibm2";

class Model3Counts extends Counts {
  /** distortion[j][i][l][m] */
  distortion = new Map<number, Map<number, Map<number, Map<number, number>>>>();
  /** distortion_for_any_j[i][l][m] */
  distortion_for_any_j = new Map<number, Map<number, Map<number, number>>>();

  updateDistortion(
    count: number,
    alignment: readonly number[],
    j: number,
    l: number,
    m: number,
  ): void {
    const i = alignment[j]!;
    let jRow = this.distortion.get(j);
    if (!jRow) {
      jRow = new Map();
      this.distortion.set(j, jRow);
    }
    let iRow = jRow.get(i);
    if (!iRow) {
      iRow = new Map();
      jRow.set(i, iRow);
    }
    let lRow = iRow.get(l);
    if (!lRow) {
      lRow = new Map();
      iRow.set(l, lRow);
    }
    lRow.set(m, (lRow.get(m) ?? 0) + count);

    let anyI = this.distortion_for_any_j.get(i);
    if (!anyI) {
      anyI = new Map();
      this.distortion_for_any_j.set(i, anyI);
    }
    let anyL = anyI.get(l);
    if (!anyL) {
      anyL = new Map();
      anyI.set(l, anyL);
    }
    anyL.set(m, (anyL.get(m) ?? 0) + count);
  }
}

export class IBMModel3 extends SamplingModel {
  /** Probability(j | i,l,m): distortion_table[j][i][l][m]. */
  distortion_table = new Map<number, Map<number, Map<number, Map<number, number>>>>();

  constructor(
    corpus: readonly AlignedSent[],
    iterations: number,
    probabilityTables?: {
      translation_table: IBMModelBase["translation_table"];
      alignment_table: IBMModelBase["alignment_table"];
      fertility_table: IBMModelBase["fertility_table"];
      p1: number;
      distortion_table: Map<number, Map<number, Map<number, Map<number, number>>>>;
    },
  ) {
    super(corpus);
    this.resetProbabilities();

    if (!probabilityTables) {
      const ibm2 = new IBMModel2(corpus, iterations);
      this.translation_table = ibm2.translation_table;
      this.alignment_table = ibm2.alignment_table;
      this.setUniformProbabilities(corpus);
    } else {
      this.translation_table = probabilityTables.translation_table;
      this.alignment_table = probabilityTables.alignment_table;
      this.fertility_table = probabilityTables.fertility_table;
      this.p1 = probabilityTables.p1;
      this.distortion_table = probabilityTables.distortion_table;
    }

    for (let n = 0; n < iterations; n += 1) {
      this.train(corpus);
    }
  }

  override resetProbabilities(): void {
    super.resetProbabilities();
    this.distortion_table = new Map();
  }

  private setUniformProbabilities(corpus: readonly AlignedSent[]): void {
    // d(j | i,l,m) = 1 / m
    const lMCombinations = new Set<string>();
    for (const aligned of corpus) {
      const l = aligned.mots.length;
      const m = aligned.words.length;
      const key = `${l}:${m}`;
      if (!lMCombinations.has(key)) {
        lMCombinations.add(key);
        const initialProb = 1 / m;
        if (initialProb < MIN_PROB) {
          console.warn(`A target sentence is too long (${m} words). Results may be less accurate.`);
        }
        for (let j = 1; j <= m; j += 1) {
          for (let i = 0; i <= l; i += 1) {
            let jRow = this.distortion_table.get(j);
            if (!jRow) {
              jRow = new Map();
              this.distortion_table.set(j, jRow);
            }
            let iRow = jRow.get(i);
            if (!iRow) {
              iRow = new Map();
              jRow.set(i, iRow);
            }
            let lRow = iRow.get(l);
            if (!lRow) {
              lRow = new Map();
              iRow.set(l, lRow);
            }
            lRow.set(m, initialProb);
          }
        }
      }
    }

    // Simple initialization from GIZA++
    for (const [phi, p] of [[0, 0.2], [1, 0.65], [2, 0.1], [3, 0.04]] as const) {
      const row = new Map<string, number>();
      for (const s of this.src_vocab) row.set(s, p);
      this.fertility_table.set(phi, row);
    }
    const MAX_FERTILITY = 10;
    const initialFertProb = 0.01 / (MAX_FERTILITY - 4);
    for (let phi = 4; phi < MAX_FERTILITY; phi += 1) {
      const row = new Map<string, number>();
      for (const s of this.src_vocab) row.set(s, initialFertProb);
      this.fertility_table.set(phi, row);
    }

    this.p1 = 0.5;
  }

  override train(parallel_corpus: readonly AlignedSent[]): void {
    const counts = new Model3Counts();
    for (const alignedSentence of parallel_corpus) {
      const l = alignedSentence.mots.length;
      const m = alignedSentence.words.length;

      const { sampled, best } = this.sample(alignedSentence);

      // E step (a)
      let totalCount = 0;
      for (const a of sampled) totalCount += this.probTAGivenS(a);

      // E step (b)
      for (const alignmentInfo of sampled) {
        const count = this.probTAGivenS(alignmentInfo);
        const normalizedCount = count / totalCount;

        for (let j = 1; j <= m; j += 1) {
          counts.updateLexicalTranslation(normalizedCount, alignmentInfo.alignment, alignmentInfo.trg_sentence, alignmentInfo.src_sentence, j);
          counts.updateDistortion(normalizedCount, alignmentInfo.alignment, j, l, m);
        }
        const fertilityOfNull = alignmentInfo.fertilityOfI(0);
        counts.updateNullGeneration(normalizedCount, fertilityOfNull, m);
        counts.updateFertility(normalizedCount, alignmentInfo.src_sentence, (i) => alignmentInfo.fertilityOfI(i));
      }
    }

    // M step — keep the alignment table (don't retrain), reset the rest.
    const existingAlignmentTable = this.alignment_table;
    this.resetProbabilities();
    this.alignment_table = existingAlignmentTable;

    this.maximizeLexicalTranslationProbabilities(counts);
    this.maximizeDistortionProbabilities(counts);
    this.maximizeFertilityProbabilities(counts);
    this.maximizeNullGenerationProbabilities(counts);
  }

  private maximizeDistortionProbabilities(counts: Model3Counts): void {
    for (const [j, iS] of counts.distortion) {
      for (const [i, srcLengths] of iS) {
        for (const [l, trgLengths] of srcLengths) {
          for (const [m, value] of trgLengths) {
            const any = counts.distortion_for_any_j.get(i)?.get(l)?.get(m) ?? MIN_PROB;
            const estimate = value / any;
            let jRow = this.distortion_table.get(j);
            if (!jRow) {
              jRow = new Map();
              this.distortion_table.set(j, jRow);
            }
            let iRow = jRow.get(i);
            if (!iRow) {
              iRow = new Map();
              jRow.set(i, iRow);
            }
            let lRow = iRow.get(l);
            if (!lRow) {
              lRow = new Map();
              iRow.set(l, lRow);
            }
            lRow.set(m, Math.max(estimate, MIN_PROB));
          }
        }
      }
    }
  }

  override probTAGivenS(alignmentInfo: AlignmentInfo): number {
    const srcSentence = alignmentInfo.src_sentence;
    const trgSentence = alignmentInfo.trg_sentence;
    const l = srcSentence.length - 1;
    const m = trgSentence.length - 1;
    const p1 = this.p1;
    const p0 = 1 - p1;

    let probability = 1.0;

    // NULL insertion probability
    const nullFertility = alignmentInfo.fertilityOfI(0);
    probability *= p1 ** nullFertility * p0 ** (m - 2 * nullFertility);
    if (probability < MIN_PROB) return MIN_PROB;

    // Combination (m - null_fertility) choose null_fertility
    for (let i = 1; i <= nullFertility; i += 1) {
      probability *= (m - nullFertility - i + 1) / i;
      if (probability < MIN_PROB) return MIN_PROB;
    }

    // Fertility probabilities
    for (let i = 1; i <= l; i += 1) {
      const fertility = alignmentInfo.fertilityOfI(i);
      probability *= factorial(fertility) * (this.fertility_table.get(fertility)?.get(srcSentence[i]!) ?? MIN_PROB);
      if (probability < MIN_PROB) return MIN_PROB;
    }

    // Lexical and distortion probabilities
    for (let j = 1; j <= m; j += 1) {
      const t = trgSentence[j]!;
      const i = alignmentInfo.alignment[j]!;
      const s = srcSentence[i]!;
      probability *=
        (this.translation_table.get(t)?.get(s) ?? MIN_PROB) *
        (this.distortion_table.get(j)?.get(i)?.get(l)?.get(m) ?? MIN_PROB);
      if (probability < MIN_PROB) return MIN_PROB;
    }

    return probability;
  }
}

