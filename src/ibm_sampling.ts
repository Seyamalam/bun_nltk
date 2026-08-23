/**
 * AlignmentInfo, sampling (hill climbing + pegging), and neighbor generation
 * shared by IBM Models 3, 4 and 5 (port of nltk.translate.ibm_model internals).
 *
 * Alignments inside AlignmentInfo are one-indexed: alignment[j] for j in
 * 1..m gives the source position i in 0..l aligned to target position j.
 * Position 0 of the source sentence is NULL.
 */

import { IBMModelBase } from "./ibm_model";

export const MIN_PROB = 1.0e-12;

export const IBM_NULL = "NULL";
export const UNUSED = "UNUSED";

export type AlignedSent = { words: string[]; mots: string[] };

export class AlignmentInfo {
  /** alignment[j] = source position aligned to target position j. */
  readonly alignment: readonly number[];
  /** Source sentence with NULL at index 0. */
  readonly src_sentence: readonly string[];
  /** Target sentence with dummy at index 0. */
  readonly trg_sentence: readonly string[];
  /** cepts[i] = ascending target positions aligned to source position i. */
  readonly cepts: ReadonlyArray<ReadonlyArray<number>>;
  score: number = 0;

  constructor(
    alignment: readonly number[],
    srcSentence: readonly string[],
    trgSentence: readonly string[],
    cepts: ReadonlyArray<ReadonlyArray<number>>,
  ) {
    // Copy so mutations by neighbors don't leak; also makes equality cheap via key().
    this.alignment = [...alignment];
    this.src_sentence = [...srcSentence];
    this.trg_sentence = [...trgSentence];
    this.cepts = cepts.map((c) => [...c]);
  }

  fertilityOfI(i: number): number {
    return this.cepts[i]!.length;
  }

  isHeadWord(j: number): boolean {
    const i = this.alignment[j]!;
    return this.cepts[i]![0] === j;
  }

  centerOfCept(i: number | null): number {
    if (i === null) return 0;
    const cept = this.cepts[i]!;
    let sum = 0;
    for (const p of cept) sum += p;
    return Math.ceil(sum / cept.length);
  }

  previousCept(j: number): number | null {
    const i = this.alignment[j]!;
    if (i === 0) {
      throw new Error("Words aligned to NULL cannot have a previous cept");
    }
    let previousCept = i - 1;
    while (previousCept > 0 && this.fertilityOfI(previousCept) === 0) {
      previousCept -= 1;
    }
    return previousCept <= 0 ? null : previousCept;
  }

  previousInTablet(j: number): number | null {
    const i = this.alignment[j]!;
    const tablet = this.cepts[i]!;
    const pos = tablet.indexOf(j);
    if (pos === 0) return null;
    return tablet[pos - 1] ?? null;
  }

  zeroIndexedAlignment(): Array<[number, number]> {
    const out: Array<[number, number]> = [];
    for (let j = 1; j < this.alignment.length; j += 1) {
      const i = this.alignment[j]!;
      out.push([j - 1, i === 0 ? (null as unknown as number) : i - 1]);
    }
    return out;
  }

  /** Canonical identity for set membership: alignment tuple only (matches NLTK,
   * where AlignmentInfo hash/eq is based on alignment + sentences). */
  key(): string {
    return `${this.alignment.join(",")}|${this.src_sentence.join(" ")}|${this.trg_sentence.join(" ")}`;
  }
}

/** Insert value into a sorted array (insort_left). */
function insortLeft(arr: number[], value: number): void {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid]! < value) lo = mid + 1;
    else hi = mid;
  }
  arr.splice(lo, 0, value);
}

/** Context passed to sampling/hillclimbing so models supply their own scorers. */
export interface Scorer {
  probTAGivenS(alignment: AlignmentInfo): number;
}

export abstract class SamplingModel extends IBMModelBase implements Scorer {
  abstract probTAGivenS(alignment: AlignmentInfo): number;

  bestModel2Alignment(sentencePair: AlignedSent, jPegged?: number, iPegged = 0): AlignmentInfo {
    const srcSentence = [IBM_NULL, ...sentencePair.mots];
    const trgSentence = [UNUSED, ...sentencePair.words];

    const l = srcSentence.length - 1;
    const m = trgSentence.length - 1;

    const alignment = new Array<number>(m + 1).fill(0);
    const cepts: number[][] = Array.from({ length: l + 1 }, () => []);

    for (let j = 1; j <= m; j += 1) {
      let bestI: number;
      if (j === jPegged) {
        bestI = iPegged;
      } else {
        bestI = 0;
        let maxAlignmentProb = MIN_PROB;
        const t = trgSentence[j]!;
        for (let i = 0; i <= l; i += 1) {
          const s = srcSentence[i]!;
          const alignmentProb =
            (this.translation_table.get(t)?.get(s) ?? MIN_PROB) *
            (this.alignment_table.get(i)?.get(j)?.get(l)?.get(m) ?? MIN_PROB);
          if (alignmentProb >= maxAlignmentProb) {
            maxAlignmentProb = alignmentProb;
            bestI = i;
          }
        }
      }
      alignment[j] = bestI;
      cepts[bestI]!.push(j);
    }
    for (const cept of cepts) cept.sort((x, y) => x - y);

    return new AlignmentInfo(alignment, srcSentence, trgSentence, cepts);
  }

  hillclimb(alignmentInfo: AlignmentInfo, jPegged?: number): AlignmentInfo {
    let alignment = alignmentInfo;
    let maxProbability = this.probTAGivenS(alignment);

    for (;;) {
      const oldAlignment = alignment;
      for (const neighbor of this.neighboring(alignment, jPegged)) {
        const neighborProbability = this.probTAGivenS(neighbor);
        if (neighborProbability > maxProbability) {
          alignment = neighbor;
          maxProbability = neighborProbability;
        }
      }
      if (alignment === oldAlignment || alignment.key() === oldAlignment.key()) break;
    }

    alignment.score = maxProbability;
    return alignment;
  }

  neighboring(alignmentInfo: AlignmentInfo, jPegged?: number): Set<AlignmentInfo> {
    const byKey = new Map<string, AlignmentInfo>();
    const add = (a: AlignmentInfo) => byKey.set(a.key(), a);

    const l = alignmentInfo.src_sentence.length - 1;
    const m = alignmentInfo.trg_sentence.length - 1;
    const originalAlignment = alignmentInfo.alignment;
    const originalcepts = alignmentInfo.cepts;

    for (let j = 1; j <= m; j += 1) {
      if (j !== jPegged) {
        for (let i = 0; i <= l; i += 1) {
          const newAlignment = [...originalAlignment];
          const newcepts = originalcepts.map((c) => [...c]);
          const oldI = originalAlignment[j]!;
          newAlignment[j] = i;
          insortLeft(newcepts[i]!, j);
          const idx = newcepts[oldI]!.indexOf(j);
          if (idx >= 0) newcepts[oldI]!.splice(idx, 1);
          add(new AlignmentInfo(newAlignment, alignmentInfo.src_sentence, alignmentInfo.trg_sentence, newcepts));
        }
      }
    }

    for (let j = 1; j <= m; j += 1) {
      if (j !== jPegged) {
        for (let otherJ = 1; otherJ <= m; otherJ += 1) {
          if (otherJ !== jPegged && otherJ !== j) {
            const newAlignment = [...originalAlignment];
            const newcepts = originalcepts.map((c) => [...c]);
            const otherI = originalAlignment[otherJ]!;
            const i = originalAlignment[j]!;
            newAlignment[j] = otherI;
            newAlignment[otherJ] = i;

            let idx = newcepts[otherI]!.indexOf(otherJ);
            if (idx >= 0) newcepts[otherI]!.splice(idx, 1);
            insortLeft(newcepts[otherI]!, j);
            idx = newcepts[i]!.indexOf(j);
            if (idx >= 0) newcepts[i]!.splice(idx, 1);
            insortLeft(newcepts[i]!, otherJ);

            add(new AlignmentInfo(newAlignment, alignmentInfo.src_sentence, alignmentInfo.trg_sentence, newcepts));
          }
        }
      }
    }

    return new Set(byKey.values());
  }

  sample(sentencePair: AlignedSent): { sampled: Set<AlignmentInfo>; best: AlignmentInfo } {
    const sampledByKey = new Map<string, AlignmentInfo>();
    const l = sentencePair.mots.length;
    const m = sentencePair.words.length;

    const initialAlignment = this.bestModel2Alignment(sentencePair);
    const potentialAlignment = this.hillclimb(initialAlignment);
    for (const n of this.neighboring(potentialAlignment)) sampledByKey.set(n.key(), n);
    let bestAlignment = potentialAlignment;

    for (let j = 1; j <= m; j += 1) {
      for (let i = 0; i <= l; i += 1) {
        const initial = this.bestModel2Alignment(sentencePair, j, i);
        const potential = this.hillclimb(initial, j);
        for (const n of this.neighboring(potential, j)) sampledByKey.set(n.key(), n);
        if (potential.score > bestAlignment.score) bestAlignment = potential;
      }
    }

    return { sampled: new Set(sampledByKey.values()), best: bestAlignment };
  }
}
