/**
 * port of nltk.translate.ibm4.IBMModel4 — distortion based on word classes
 * and the position of the previous cept's center, plus non-head displacement.
 */
import { AlignmentInfo, MIN_PROB, SamplingModel, type AlignedSent } from "./ibm_sampling";
import { IBMModelBase, Counts, factorial } from "./ibm_model";
import { IBMModel3 } from "./ibm3";

class Model4Counts extends Counts {
  /** head_distortion[dj][src_class][trg_class] */
  head_distortion = new Map<number, Map<number | null, Map<number, number>>>();
  head_distortion_for_any_dj = new Map<number | null, Map<number, number>>();
  /** non_head_distortion[dj][trg_class] */
  non_head_distortion = new Map<number, Map<number, number>>();
  non_head_distortion_for_any_dj = new Map<number, number>();

  updateDistortion(
    count: number,
    alignmentInfo: AlignmentInfo,
    j: number,
    srcClasses: Record<string, number>,
    trgClasses: Record<string, number>,
  ): void {
    const i = alignmentInfo.alignment[j]!;
    const t = alignmentInfo.trg_sentence[j]!;
    if (i === 0) {
      // aligned to NULL: no distortion count
      return;
    }
    if (alignmentInfo.isHeadWord(j)) {
      const previousCept = alignmentInfo.previousCept(j);
      let srcClass: number | null = null;
      if (previousCept !== null) {
        const previousSrcWord = alignmentInfo.src_sentence[previousCept]!;
        srcClass = srcClasses[previousSrcWord] ?? null;
      }
      const trgClass = trgClasses[t]!;
      const dj = j - alignmentInfo.centerOfCept(previousCept);

      let djRow = this.head_distortion.get(dj);
      if (!djRow) {
        djRow = new Map();
        this.head_distortion.set(dj, djRow);
      }
      let sRow = djRow.get(srcClass);
      if (!sRow) {
        sRow = new Map();
        djRow.set(srcClass, sRow);
      }
      sRow.set(trgClass, (sRow.get(trgClass) ?? 0) + count);

      let anyS = this.head_distortion_for_any_dj.get(srcClass);
      if (!anyS) {
        anyS = new Map();
        this.head_distortion_for_any_dj.set(srcClass, anyS);
      }
      anyS.set(trgClass, (anyS.get(trgClass) ?? 0) + count);
    } else {
      const previousJ = alignmentInfo.previousInTablet(j)!;
      const trgClass = trgClasses[t]!;
      const dj = j - previousJ;

      let djRow = this.non_head_distortion.get(dj);
      if (!djRow) {
        djRow = new Map();
        this.non_head_distortion.set(dj, djRow);
      }
      djRow.set(trgClass, (djRow.get(trgClass) ?? 0) + count);
      this.non_head_distortion_for_any_dj.set(
        trgClass,
        (this.non_head_distortion_for_any_dj.get(trgClass) ?? 0) + count,
      );
    }
  }
}

export type SrcTrgClasses = Record<string, number>;

export class IBMModel4 extends SamplingModel {
  /** Probability(displacement of head word | src class of previous cept, trg class). */
  head_distortion_table = new Map<number, Map<number | null, Map<number, number>>>();
  /** Probability(displacement of non-head word | target word class). */
  non_head_distortion_table = new Map<number, Map<number, number>>();
  src_classes: SrcTrgClasses;
  trg_classes: SrcTrgClasses;

  constructor(
    corpus: readonly AlignedSent[],
    iterations: number,
    sourceWordClasses: SrcTrgClasses,
    targetWordClasses: SrcTrgClasses,
    probabilityTables?: {
      translation_table: IBMModelBase["translation_table"];
      alignment_table: IBMModelBase["alignment_table"];
      fertility_table: IBMModelBase["fertility_table"];
      p1: number;
      head_distortion_table: Map<number, Map<number | null, Map<number, number>>>;
      non_head_distortion_table: Map<number, Map<number, number>>;
    },
  ) {
    super(corpus);
    this.resetProbabilities();
    this.src_classes = sourceWordClasses;
    this.trg_classes = targetWordClasses;

    if (!probabilityTables) {
      const ibm3 = new IBMModel3(corpus, iterations);
      this.translation_table = ibm3.translation_table;
      this.alignment_table = ibm3.alignment_table;
      this.fertility_table = ibm3.fertility_table;
      this.p1 = ibm3.p1;
      this.setUniformProbabilities(corpus);
    } else {
      this.translation_table = probabilityTables.translation_table;
      this.alignment_table = probabilityTables.alignment_table;
      this.fertility_table = probabilityTables.fertility_table;
      this.p1 = probabilityTables.p1;
      this.head_distortion_table = probabilityTables.head_distortion_table;
      this.non_head_distortion_table = probabilityTables.non_head_distortion_table;
    }

    for (let n = 0; n < iterations; n += 1) {
      this.train(corpus);
    }
  }

  override resetProbabilities(): void {
    super.resetProbabilities();
    this.head_distortion_table = new Map();
    this.non_head_distortion_table = new Map();
  }

  private setUniformProbabilities(corpus: readonly AlignedSent[]): void {
    const maxM = Math.max(...corpus.map((a) => a.words.length));
    const initialProb = maxM <= 1 ? MIN_PROB : 1 / (2 * (maxM - 1));
    if (initialProb < MIN_PROB) {
      console.warn(`A target sentence is too long (${maxM} words). Results may be less accurate.`);
    }
    for (let dj = 1; dj < maxM; dj += 1) {
      this.head_distortion_table.set(dj, new Map());
      this.head_distortion_table.set(-dj, new Map());
      this.non_head_distortion_table.set(dj, new Map());
      this.non_head_distortion_table.set(-dj, new Map());
    }
  }

  override train(parallel_corpus: readonly AlignedSent[]): void {
    const counts = new Model4Counts();
    for (const alignedSentence of parallel_corpus) {
      const m = alignedSentence.words.length;
      const { sampled } = this.sample(alignedSentence);

      let totalCount = 0;
      for (const a of sampled) totalCount += this.probTAGivenS(a);

      for (const alignmentInfo of sampled) {
        const count = this.probTAGivenS(alignmentInfo);
        const normalizedCount = count / totalCount;

        for (let j = 1; j <= m; j += 1) {
          counts.updateLexicalTranslation(normalizedCount, alignmentInfo.alignment, alignmentInfo.trg_sentence, alignmentInfo.src_sentence, j);
          counts.updateDistortion(normalizedCount, alignmentInfo, j, this.src_classes, this.trg_classes);
        }
        counts.updateNullGeneration(normalizedCount, alignmentInfo.fertilityOfI(0), m);
        counts.updateFertility(normalizedCount, alignmentInfo.src_sentence, (i) => alignmentInfo.fertilityOfI(i));
      }
    }

    const existingAlignmentTable = this.alignment_table;
    this.resetProbabilities();
    this.alignment_table = existingAlignmentTable;

    this.maximizeLexicalTranslationProbabilities(counts);
    this.maximizeDistortionProbabilities(counts);
    this.maximizeFertilityProbabilities(counts);
    this.maximizeNullGenerationProbabilities(counts);
  }

  private maximizeDistortionProbabilities(counts: Model4Counts): void {
    for (const [dj, srcClasses] of counts.head_distortion) {
      for (const [sCls, trgClasses] of srcClasses) {
        for (const [tCls, value] of trgClasses) {
          const any = counts.head_distortion_for_any_dj.get(sCls)?.get(tCls) ?? MIN_PROB;
          const estimate = value / any;
          let djRow = this.head_distortion_table.get(dj);
          if (!djRow) {
            djRow = new Map();
            this.head_distortion_table.set(dj, djRow);
          }
          let sRow = djRow.get(sCls);
          if (!sRow) {
            sRow = new Map();
            djRow.set(sCls, sRow);
          }
          sRow.set(tCls, Math.max(estimate, MIN_PROB));
        }
      }
    }

    for (const [dj, trgClasses] of counts.non_head_distortion) {
      for (const [tCls, value] of trgClasses) {
        const any = counts.non_head_distortion_for_any_dj.get(tCls) ?? MIN_PROB;
        const estimate = value / any;
        let djRow = this.non_head_distortion_table.get(dj);
        if (!djRow) {
          djRow = new Map();
          this.non_head_distortion_table.set(dj, djRow);
        }
        djRow.set(tCls, Math.max(estimate, MIN_PROB));
      }
    }
  }

  override probTAGivenS(alignmentInfo: AlignmentInfo): number {
    return IBMModel4.model4ProbTAGivenS(alignmentInfo, this);
  }

  /** Exposed for Model 5 to reuse. */
  static model4ProbTAGivenS(alignmentInfo: AlignmentInfo, model: IBMModel4): number {
    let probability = 1.0;

    const nullGenerationTerm = (): number => {
      let value = 1.0;
      const p1 = model.p1;
      const p0 = 1 - p1;
      const nullFertility = alignmentInfo.fertilityOfI(0);
      const m = alignmentInfo.trg_sentence.length - 1;
      value *= p1 ** nullFertility * p0 ** (m - 2 * nullFertility);
      if (value < MIN_PROB) return MIN_PROB;
      for (let i = 1; i <= nullFertility; i += 1) {
        value *= (m - nullFertility - i + 1) / i;
      }
      return value;
    };

    const fertilityTerm = (): number => {
      let value = 1.0;
      const srcSentence = alignmentInfo.src_sentence;
      for (let i = 1; i < srcSentence.length; i += 1) {
        const fertility = alignmentInfo.fertilityOfI(i);
        value *= factorial(fertility) * (model.fertility_table.get(fertility)?.get(srcSentence[i]!) ?? MIN_PROB);
        if (value < MIN_PROB) return MIN_PROB;
      }
      return value;
    };

    const lexicalTerm = (j: number): number => {
      const t = alignmentInfo.trg_sentence[j]!;
      const i = alignmentInfo.alignment[j]!;
      const s = alignmentInfo.src_sentence[i]!;
      return model.translation_table.get(t)?.get(s) ?? MIN_PROB;
    };

    const distortionTerm = (j: number): number => {
      const t = alignmentInfo.trg_sentence[j]!;
      const i = alignmentInfo.alignment[j]!;
      if (i === 0) return 1.0; // aligned to NULL

      if (alignmentInfo.isHeadWord(j)) {
        const previousCept = alignmentInfo.previousCept(j);
        let srcClass: number | null = null;
        if (previousCept !== null) {
          const previousS = alignmentInfo.src_sentence[previousCept]!;
          srcClass = model.src_classes[previousS] ?? null;
        }
        const trgClass = model.trg_classes[t]!;
        const dj = j - alignmentInfo.centerOfCept(previousCept);
        return model.head_distortion_table.get(dj)?.get(srcClass)?.get(trgClass) ?? MIN_PROB;
      }

      const previousPosition = alignmentInfo.previousInTablet(j)!;
      const trgClass = model.trg_classes[t]!;
      const dj = j - previousPosition;
      return model.non_head_distortion_table.get(dj)?.get(trgClass) ?? MIN_PROB;
    };

    probability *= nullGenerationTerm();
    if (probability < MIN_PROB) return MIN_PROB;
    probability *= fertilityTerm();
    if (probability < MIN_PROB) return MIN_PROB;

    for (let j = 1; j < alignmentInfo.trg_sentence.length; j += 1) {
      probability *= lexicalTerm(j);
      if (probability < MIN_PROB) return MIN_PROB;
      probability *= distortionTerm(j);
      if (probability < MIN_PROB) return MIN_PROB;
    }

    return probability;
  }

  /** Model-4 scoring used by Model 5's hillclimb/prune. */
  static scoreWith(alignmentInfo: AlignmentInfo, modelLike: { p1: number } & IBMModel4): number {
    return IBMModel4.model4ProbTAGivenS(alignmentInfo, modelLike as IBMModel4);
  }
}
