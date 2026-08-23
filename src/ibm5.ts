/**
 * Translation model that keeps track of vacant positions in the target
 * sentence to decide where to place translated words
 * (port of nltk.translate.ibm5.IBMModel5).
 *
 * Uses Model 4 scoring for hill climbing and pruning (as in NLTK), then
 * vacancy-based probabilities for its own EM steps.
 */
import { AlignmentInfo, MIN_PROB, SamplingModel, type AlignedSent } from "./ibm_sampling";
import { IBMModelBase, Counts, factorial, longestTargetSentenceLength } from "./ibm_model";
import { IBMModel4, type SrcTrgClasses } from "./ibm4";

/** Tracks occupied positions in a target sentence (1-indexed with dummy at 0). */
class Slots {
  private readonly slots: boolean[];

  constructor(targetSentenceLength: number) {
    this.slots = new Array<boolean>(targetSentenceLength + 1).fill(false);
  }

  get length(): number {
    return this.slots.length - 1;
  }

  occupy(position: number): void {
    this.slots[position] = true;
  }

  vacanciesAt(position: number): number {
    let vacancies = 0;
    for (let k = 1; k <= position; k += 1) {
      if (!this.slots[k]) vacancies += 1;
    }
    return vacancies;
  }
}

class Model5Counts extends Counts {
  /** head_vacancy[dv][max_v][trg_class] */
  head_vacancy = new Map<number, Map<number, Map<number, number>>>();
  head_vacancy_for_any_dv = new Map<number, Map<number, number>>();
  /** non_head_vacancy[dv][max_v][trg_class] */
  non_head_vacancy = new Map<number, Map<number, Map<number, number>>>();
  non_head_vacancy_for_any_dv = new Map<number, Map<number, number>>();

  updateVacancy(
    count: number,
    alignmentInfo: AlignmentInfo,
    i: number,
    trgClasses: SrcTrgClasses,
    slots: Slots,
  ): void {
    const tablet = alignmentInfo.cepts[i]!;
    const tabletLength = tablet.length;
    let totalVacancies = slots.vacanciesAt(slots.length);

    if (tabletLength === 0) return; // zero fertility words

    // Head word
    const j = tablet[0]!;
    const previousCept = alignmentInfo.previousCept(j);
    const previousCenter = alignmentInfo.centerOfCept(previousCept);
    const dvHead = slots.vacanciesAt(j) - slots.vacanciesAt(previousCenter);
    const maxVHead = totalVacancies - tabletLength + 1;
    const headTrgClass = trgClasses[alignmentInfo.trg_sentence[j]!]!;
    this.addTo(this.head_vacancy, dvHead, maxVHead, headTrgClass, count);
    this.addAny(this.head_vacancy_for_any_dv, maxVHead, headTrgClass, count);
    slots.occupy(j);
    totalVacancies -= 1;

    // Non-head words
    for (let k = 1; k < tabletLength; k += 1) {
      const previousPosition = tablet[k - 1]!;
      const previousVacancies = slots.vacanciesAt(previousPosition);
      const jj = tablet[k]!;
      const dv = slots.vacanciesAt(jj) - previousVacancies;
      const maxV = totalVacancies - tabletLength + k + 1 - previousVacancies;
      const trgClass = trgClasses[alignmentInfo.trg_sentence[jj]!]!;
      this.addTo(this.non_head_vacancy, dv, maxV, trgClass, count);
      this.addAny(this.non_head_vacancy_for_any_dv, maxV, trgClass, count);
      slots.occupy(jj);
      totalVacancies -= 1;
    }
  }

  private addTo(
    table: Map<number, Map<number, Map<number, number>>>,
    dv: number,
    maxV: number,
    trgClass: number,
    count: number,
  ): void {
    let dvRow = table.get(dv);
    if (!dvRow) {
      dvRow = new Map();
      table.set(dv, dvRow);
    }
    let vRow = dvRow.get(maxV);
    if (!vRow) {
      vRow = new Map();
      dvRow.set(maxV, vRow);
    }
    vRow.set(trgClass, (vRow.get(trgClass) ?? 0) + count);
  }

  private addAny(
    table: Map<number, Map<number, number>>,
    maxV: number,
    trgClass: number,
    count: number,
  ): void {
    let vRow = table.get(maxV);
    if (!vRow) {
      vRow = new Map();
      table.set(maxV, vRow);
    }
    vRow.set(trgClass, (vRow.get(trgClass) ?? 0) + count);
  }
}

/** Alignments scoring below this factor of the best are pruned during sampling. */
const MIN_SCORE_FACTOR = 0.2;

export class IBMModel5 extends SamplingModel {
  /** Probability(vacancy difference | remaining valid positions, target word class). */
  head_vacancy_table = new Map<number, Map<number, Map<number, number>>>();
  non_head_vacancy_table = new Map<number, Map<number, Map<number, number>>>();
  head_distortion_table = new Map<number, Map<number | null, Map<number, number>>>();
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
      head_vacancy_table: Map<number, Map<number, Map<number, number>>>;
      non_head_vacancy_table: Map<number, Map<number, Map<number, number>>>;
    },
  ) {
    super(corpus);
    this.resetProbabilities();
    this.src_classes = sourceWordClasses;
    this.trg_classes = targetWordClasses;

    if (!probabilityTables) {
      const ibm4 = new IBMModel4(corpus, iterations, sourceWordClasses, targetWordClasses);
      this.translation_table = ibm4.translation_table;
      this.alignment_table = ibm4.alignment_table;
      this.fertility_table = ibm4.fertility_table;
      this.p1 = ibm4.p1;
      this.head_distortion_table = ibm4.head_distortion_table;
      this.non_head_distortion_table = ibm4.non_head_distortion_table;
      this.setUniformProbabilities(corpus);
    } else {
      this.translation_table = probabilityTables.translation_table;
      this.alignment_table = probabilityTables.alignment_table;
      this.fertility_table = probabilityTables.fertility_table;
      this.p1 = probabilityTables.p1;
      this.head_distortion_table = probabilityTables.head_distortion_table;
      this.non_head_distortion_table = probabilityTables.non_head_distortion_table;
      this.head_vacancy_table = probabilityTables.head_vacancy_table;
      this.non_head_vacancy_table = probabilityTables.non_head_vacancy_table;
    }

    for (let n = 0; n < iterations; n += 1) {
      this.train(corpus);
    }
  }

  override resetProbabilities(): void {
    super.resetProbabilities();
    this.head_vacancy_table = new Map();
    this.non_head_vacancy_table = new Map();
  }

  private setUniformProbabilities(corpus: readonly AlignedSent[]): void {
    const maxM = longestTargetSentenceLength(corpus);
    for (let maxV = 1; maxV <= maxM; maxV += 1) {
      for (let dv = 1; dv <= maxM; dv += 1) {
        const initialProb = 1 / (2 * maxV);
        this.ensureVacancy(this.head_vacancy_table, dv, maxV, initialProb);
        this.ensureVacancy(this.head_vacancy_table, -(dv - 1), maxV, initialProb);
        this.ensureVacancy(this.non_head_vacancy_table, dv, maxV, initialProb);
        this.ensureVacancy(this.non_head_vacancy_table, -(dv - 1), maxV, initialProb);
      }
    }
  }

  private ensureVacancy(
    table: Map<number, Map<number, Map<number, number>>>,
    dv: number,
    maxV: number,
    initialProb: number,
  ): void {
    let dvRow = table.get(dv);
    if (!dvRow) {
      dvRow = new Map();
      table.set(dv, dvRow);
    }
    if (!dvRow.has(maxV)) {
      dvRow.set(maxV, new Map());
    }
    void initialProb; // defaults are applied at lookup time via ?? MIN_PROB
  }

  override train(parallel_corpus: readonly AlignedSent[]): void {
    const counts = new Model5Counts();
    for (const alignedSentence of parallel_corpus) {
      const l = alignedSentence.mots.length;
      const m = alignedSentence.words.length;

      // Sample using Model 4 scoring, then prune.
      const { sampled: unpruned, best } = this.sample(alignedSentence);

      // Prune alignments substantially worse than the best (Model 4 score).
      let bestScore = 0;
      const scored: Array<{ info: AlignmentInfo; score: number }> = [];
      for (const info of unpruned) {
        const score = IBMModel4.model4ProbTAGivenS(info, this as unknown as IBMModel4);
        bestScore = Math.max(score, bestScore);
        scored.push({ info, score });
      }
      const threshold = MIN_SCORE_FACTOR * bestScore;
      const sampled = new Set(scored.filter((s) => s.score > threshold).map((s) => s.info));

      let totalCount = 0;
      for (const a of sampled) totalCount += this.probTAGivenS(a);

      for (const alignmentInfo of sampled) {
        const count = this.probTAGivenS(alignmentInfo);
        const normalizedCount = count / totalCount;

        for (let j = 1; j <= m; j += 1) {
          counts.updateLexicalTranslation(normalizedCount, alignmentInfo.alignment, alignmentInfo.trg_sentence, alignmentInfo.src_sentence, j);
        }
        const slots = new Slots(m);
        for (let i = 1; i <= l; i += 1) {
          counts.updateVacancy(normalizedCount, alignmentInfo, i, this.trg_classes, slots);
        }
        counts.updateNullGeneration(normalizedCount, alignmentInfo.fertilityOfI(0), m);
        counts.updateFertility(normalizedCount, alignmentInfo.src_sentence, (i) => alignmentInfo.fertilityOfI(i));
      }
    }

    const existingAlignmentTable = this.alignment_table;
    this.resetProbabilities();
    this.alignment_table = existingAlignmentTable;

    this.maximizeLexicalTranslationProbabilities(counts);
    this.maximizeVacancyProbabilities(counts);
    this.maximizeFertilityProbabilities(counts);
    this.maximizeNullGenerationProbabilities(counts);
  }

  /** NLTK Model 5 hill climbs with Model 4 scoring. */
  override hillclimb(alignmentInfo: AlignmentInfo, jPegged?: number): AlignmentInfo {
    let alignment = alignmentInfo;
    let maxProbability = IBMModel4.model4ProbTAGivenS(alignment, this as unknown as IBMModel4);

    for (;;) {
      const oldKey = alignment.key();
      for (const neighbor of this.neighboring(alignment, jPegged)) {
        const neighborProbability = IBMModel4.model4ProbTAGivenS(neighbor, this as unknown as IBMModel4);
        if (neighborProbability > maxProbability) {
          alignment = neighbor;
          maxProbability = neighborProbability;
        }
      }
      if (alignment.key() === oldKey) break;
    }

    alignment.score = maxProbability;
    return alignment;
  }

  override probTAGivenS(alignmentInfo: AlignmentInfo): number {
    let probability = 1.0;
    const slots = new Slots(alignmentInfo.trg_sentence.length - 1);

    // NULL generation term
    {
      const p1 = this.p1;
      const p0 = 1 - p1;
      const nullFertility = alignmentInfo.fertilityOfI(0);
      const m = alignmentInfo.trg_sentence.length - 1;
      probability *= p1 ** nullFertility * p0 ** (m - 2 * nullFertility);
      if (probability < MIN_PROB) return MIN_PROB;
      for (let i = 1; i <= nullFertility; i += 1) {
        probability *= (m - nullFertility - i + 1) / i;
      }
      if (probability < MIN_PROB) return MIN_PROB;
    }

    // Fertility term
    {
      const srcSentence = alignmentInfo.src_sentence;
      for (let i = 1; i < srcSentence.length; i += 1) {
        const fertility = alignmentInfo.fertilityOfI(i);
        probability *= factorial(fertility) * (this.fertility_table.get(fertility)?.get(srcSentence[i]!) ?? MIN_PROB);
        if (probability < MIN_PROB) return MIN_PROB;
      }
    }

    // Lexical translation term
    for (let j = 1; j < alignmentInfo.trg_sentence.length; j += 1) {
      const t = alignmentInfo.trg_sentence[j]!;
      const i = alignmentInfo.alignment[j]!;
      const s = alignmentInfo.src_sentence[i]!;
      probability *= this.translation_table.get(t)?.get(s) ?? MIN_PROB;
      if (probability < MIN_PROB) return MIN_PROB;
    }

    // Vacancy term per source position
    for (let i = 1; i < alignmentInfo.src_sentence.length; i += 1) {
      const value = this.vacancyTerm(alignmentInfo, i, slots);
      if (value < MIN_PROB) return MIN_PROB;
      probability *= value;
      if (probability < MIN_PROB) return MIN_PROB;
    }

    return probability;
  }

  private vacancyTerm(alignmentInfo: AlignmentInfo, i: number, slots: Slots): number {
    let value = 1.0;
    const tablet = alignmentInfo.cepts[i]!;
    const tabletLength = tablet.length;
    let totalVacancies = slots.vacanciesAt(slots.length);

    if (tabletLength === 0) return value;

    // Head word
    const j = tablet[0]!;
    const previousCept = alignmentInfo.previousCept(j);
    const previousCenter = alignmentInfo.centerOfCept(previousCept);
    const dvHead = slots.vacanciesAt(j) - slots.vacanciesAt(previousCenter);
    const maxVHead = totalVacancies - tabletLength + 1;
    const headTrgClass = this.trg_classes[alignmentInfo.trg_sentence[j]!]!;
    value *= this.head_vacancy_table.get(dvHead)?.get(maxVHead)?.get(headTrgClass) ?? MIN_PROB;
    slots.occupy(j);
    totalVacancies -= 1;
    if (value < MIN_PROB) return MIN_PROB;

    // Non-head words
    for (let k = 1; k < tabletLength; k += 1) {
      const previousPosition = tablet[k - 1]!;
      const previousVacancies = slots.vacanciesAt(previousPosition);
      const jj = tablet[k]!;
      const dv = slots.vacanciesAt(jj) - previousVacancies;
      const maxV = totalVacancies - tabletLength + k + 1 - previousVacancies;
      const trgClass = this.trg_classes[alignmentInfo.trg_sentence[jj]!]!;
      value *= this.non_head_vacancy_table.get(dv)?.get(maxV)?.get(trgClass) ?? MIN_PROB;
      slots.occupy(jj);
      totalVacancies -= 1;
      if (value < MIN_PROB) return MIN_PROB;
    }

    return value;
  }

  private maximizeVacancyProbabilities(counts: Model5Counts): void {
    const maximize = (
      table: Map<number, Map<number, Map<number, number>>>,
      countsTable: Map<number, Map<number, Map<number, number>>>,
      anyTable: Map<number, Map<number, number>>,
    ): void => {
      for (const [dv, maxVs] of countsTable) {
        for (const [maxV, trgClasses] of maxVs) {
          for (const [tCls, value] of trgClasses) {
            const any = anyTable.get(maxV)?.get(tCls) ?? MIN_PROB;
            const estimate = value / any;
            let dvRow = table.get(dv);
            if (!dvRow) {
              dvRow = new Map();
              table.set(dv, dvRow);
            }
            let vRow = dvRow.get(maxV);
            if (!vRow) {
              vRow = new Map();
              dvRow.set(maxV, vRow);
            }
            vRow.set(tCls, Math.max(estimate, MIN_PROB));
          }
        }
      }
    };

    maximize(this.head_vacancy_table, counts.head_vacancy, counts.head_vacancy_for_any_dv);
    maximize(this.non_head_vacancy_table, counts.non_head_vacancy, counts.non_head_vacancy_for_any_dv);
  }
}
