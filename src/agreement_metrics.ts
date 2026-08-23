/**
 * Port of `nltk.metrics.agreement` (NLTK 3.10.3): annotation-task agreement
 * coefficients computed from (coder, item, label) triples, optionally
 * parameterized by a distance metric between labels.
 *
 * Notation follows Artstein and Poesio (2007), as in the NLTK original.
 *
 * Supported coefficients:
 *  - observed agreement (`ao`, `avgAo`)
 *  - Bennett, Albert and Goldstein 1954 (`s`)
 *  - Scott 1955 multi-pi (`pi`)
 *  - Cohen 1960 kappa (`kappa`)
 *  - Davies and Fleiss 1982 multi-kappa (`multiKappa`)
 *  - Krippendorff 1980 alpha (`alpha`)
 *  - Cohen 1968 weighted kappa (`weightedKappa`, `doKw`)
 *
 * Additionally, the classic Fleiss (1971) kappa is provided as
 * {@link AnnotationTask.fleissKappa}; NLTK itself only exposes the
 * Davies-Fleiss variant under `multi_kappa`.
 */

import { binaryDistance } from "./distance_metrics";

/** A label assigned by a coder. Set-valued labels enable MASI-style distances. */
export type AnnotationLabel = string | number | Set<string | number>;

/** One annotation result: `(coder, item, label)`, mirroring NLTK triples. */
export type AnnotationTriple = readonly [coder: string, item: string, label: AnnotationLabel];

/**
 * Distance metric between two labels, returning a value in [0, 1].
 * Mirrors NLTK's `distance` argument (default `binary_distance`).
 */
export type AgreementDistanceFn = (label1: AnnotationLabel, label2: AnnotationLabel) => number;

interface AnnotationRow {
  coder: string;
  item: string;
  label: AnnotationLabel;
  /** Canonical identity of the label (Python relies on label hashability here). */
  key: string;
}

function labelKey(label: AnnotationLabel): string {
  if (label instanceof Set) {
    return "set:" + [...label].map(String).sort().join("\u0000");
  }
  return `${typeof label}:${String(label)}`;
}

function groupBy<T>(rows: readonly T[], selector: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = selector(row);
    const bucket = groups.get(key);
    if (bucket === undefined) {
      groups.set(key, [row]);
    } else {
      bucket.push(row);
    }
  }
  return groups;
}

/** Frequency map keyed by canonical label key, keeping one representative label. */
type LabelFreqs = Map<string, { label: AnnotationLabel; count: number }>;

function freqsOf(rows: Iterable<AnnotationRow>): LabelFreqs {
  const freqs: LabelFreqs = new Map();
  for (const row of rows) {
    const entry = freqs.get(row.key);
    if (entry === undefined) {
      freqs.set(row.key, { label: row.label, count: 1 });
    } else {
      entry.count += 1;
    }
  }
  return freqs;
}

/**
 * Represents an annotation task, i.e. people assign labels to items.
 *
 * Direct port of `nltk.metrics.agreement.AnnotationTask`. Coders and items are
 * strings (any hashable object in Python); labels may be scalars or sets (the
 * MASI metric requires set-valued labels, as in NLTK).
 *
 * GOTCHA: NLTK's `binary_distance` works on frozenset labels because Python
 * compares them by value; JS `Set` objects compare by identity, so pass a
 * value-equality distance (e.g. {@link masiDistance} from
 * `./distance_metrics`) when using set-valued labels.
 */
export class AnnotationTask {
  private readonly distanceFn: AgreementDistanceFn;
  private readonly rows: AnnotationRow[] = [];
  /** Unique items (NLTK `self.I`). */
  private readonly items = new Set<string>();
  /** Unique coders (NLTK `self.C`). */
  private readonly coders = new Set<string>();
  /** Unique labels (NLTK `self.K`). */
  private readonly labelKeys = new Set<string>();
  private readonly labelByKey = new Map<string, AnnotationLabel>();

  constructor(data?: Iterable<AnnotationTriple>, distance: AgreementDistanceFn = binaryDistance) {
    this.distanceFn = distance;
    if (data !== undefined) {
      this.loadArray(data);
    }
  }

  /**
   * Load a sequence of `(coder, item, label)` triples, appending to any data
   * already loaded. Port of `AnnotationTask.load_array`.
   */
  loadArray(array: Iterable<AnnotationTriple>): void {
    for (const [coder, item, label] of array) {
      this.coders.add(coder);
      this.items.add(item);
      const key = labelKey(label);
      this.labelKeys.add(key);
      if (!this.labelByKey.has(key)) {
        this.labelByKey.set(key, label);
      }
      this.rows.push({ coder, item, label, key });
    }
  }

  /**
   * Agreement between two coders on a given item.
   * Port of `AnnotationTask.agr`; throws when a coder has no annotation for
   * the item (NLTK raises `StopIteration`).
   */
  agr(cA: string, cB: string, item: string, rows?: readonly AnnotationRow[]): number {
    const data = rows ?? this.rows;
    const k1 = data.find((x) => (x.coder === cA || x.coder === cB) && x.item === item);
    if (k1 === undefined) {
      throw new Error(`no annotation found for item ${item}`);
    }
    const other = k1.coder === cA ? cB : cA;
    const k2 = data.find((x) => x.coder === other && x.item === item);
    if (k2 === undefined) {
      throw new Error(
        `StopIteration: coder ${other} has no annotation for item ${item} (NLTK behavior)`,
      );
    }
    return 1.0 - Number(this.distanceFn(k1.label, k2.label));
  }

  /** Count of annotations carrying label `key` (NLTK `Nk`). */
  Nk(key: string): number {
    return this.rows.filter((x) => x.key === key).length;
  }

  /** Count of annotations of label `key` on item `i` (NLTK `Nik`). */
  Nik(i: string, key: string): number {
    return this.rows.filter((x) => x.item === i && x.key === key).length;
  }

  /** Count of annotations of label `key` by coder `c` (NLTK `Nck`). */
  Nck(c: string, key: string): number {
    return this.rows.filter((x) => x.coder === c && x.key === key).length;
  }

  /**
   * Observed agreement between two coders on all items.
   * Port of `AnnotationTask.Ao`: the per-item agreements are summed and
   * divided by the TOTAL number of items in the task (`len(self.I)`), so items
   * missed by both coders silently lower the score — exactly as in NLTK.
   */
  ao(cA: string, cB: string): number {
    const filtered = this.rows.filter((x) => x.coder === cA || x.coder === cB);
    const grouped = groupBy(filtered, (x) => x.item);
    let total = 0;
    for (const [item, group] of grouped) {
      total += this.agr(cA, cB, item, group);
    }
    return total / this.items.size;
  }

  private pairwiseAverage(fn: (cA: string, cB: string) => number): number {
    let total = 0;
    let n = 0;
    const remaining = new Set(this.coders);
    for (const cA of this.coders) {
      remaining.delete(cA);
      for (const cB of remaining) {
        total += fn(cA, cB);
        n += 1;
      }
    }
    return total / n;
  }

  /** Average observed agreement across all coders and items (NLTK `avg_Ao`). */
  avgAo(): number {
    return this.pairwiseAverage((cA, cB) => this.ao(cA, cB));
  }

  /**
   * The observed disagreement for the weighted kappa coefficient,
   * averaged over all coder pairs (NLTK `Do_Kw`).
   */
  doKw(maxDistance = 1.0): number {
    return this.pairwiseAverage((cA, cB) => this.doKwPairwise(cA, cB, maxDistance));
  }

  /** Observed disagreement between two coders (NLTK `Do_Kw_pairwise`). */
  doKwPairwise(cA: string, cB: string, maxDistance = 1.0): number {
    let total = 0;
    const filtered = this.rows.filter((x) => x.coder === cA || x.coder === cB);
    for (const group of groupBy(filtered, (x) => x.item).values()) {
      // We should have two annotations; distance doesn't care which comes first.
      const first = group[0]!;
      const second = group[1];
      if (second === undefined) {
        throw new Error(`coder pair (${cA}, ${cB}) has fewer than two annotations for item ${first.item}`);
      }
      total += this.distanceFn(first.label, second.label);
    }
    return total / (this.items.size * maxDistance);
  }

  /** Bennett, Albert and Goldstein 1954 (NLTK `S`). */
  s(): number {
    const Ae = 1.0 / this.labelKeys.size;
    return (this.avgAo() - Ae) / (1.0 - Ae);
  }

  /**
   * Scott 1955 multi-pi; equivalent to K from Siegel and Castellan (1988)
   * (NLTK `pi`).
   */
  pi(): number {
    let total = 0;
    for (const key of this.labelKeys) {
      const f = this.Nk(key);
      total += f ** 2;
    }
    const Ae = total / (this.items.size * this.coders.size) ** 2;
    return (this.avgAo() - Ae) / (1 - Ae);
  }

  /** Expected agreement for Cohen's kappa between two coders (NLTK `Ae_kappa`). */
  aeKappa(cA: string, cB: string): number {
    let Ae = 0;
    const nitems = this.items.size;
    const conditional = new Map<string, Map<string, number>>();
    for (const row of this.rows) {
      let byCoder = conditional.get(row.key);
      if (byCoder === undefined) {
        byCoder = new Map();
        conditional.set(row.key, byCoder);
      }
      byCoder.set(row.coder, (byCoder.get(row.coder) ?? 0) + 1);
    }
    for (const byCoder of conditional.values()) {
      Ae += ((byCoder.get(cA) ?? 0) / nitems) * ((byCoder.get(cB) ?? 0) / nitems);
    }
    return Ae;
  }

  /** Cohen's kappa for one coder pair (NLTK `kappa_pairwise`). */
  kappaPairwise(cA: string, cB: string): number {
    const Ae = this.aeKappa(cA, cB);
    return (this.ao(cA, cB) - Ae) / (1.0 - Ae);
  }

  /**
   * Cohen 1960 kappa; averages naively over kappas for each coder pair
   * (NLTK `kappa`).
   */
  kappa(): number {
    return this.pairwiseAverage((cA, cB) => this.kappaPairwise(cA, cB));
  }

  /**
   * Davies and Fleiss 1982 multi-kappa; averages over observed and expected
   * agreements for each coder pair (NLTK `multi_kappa`).
   */
  multiKappa(): number {
    const Ae = this.pairwiseAverage((cA, cB) => this.aeKappa(cA, cB));
    return (this.avgAo() - Ae) / (1.0 - Ae);
  }

  /**
   * Expected disagreement for a label frequency distribution: the
   * distance-weighted average over all ordered label pairs, normalized by
   * `n * (n - 1)` (NLTK `Disagreement`).
   */
  disagreement(labelFreqs: LabelFreqs): number {
    let totalLabels = 0;
    for (const { count } of labelFreqs.values()) {
      totalLabels += count;
    }
    let pairs = 0;
    for (const { label: j, count: nj } of labelFreqs.values()) {
      for (const { label: l, count: nl } of labelFreqs.values()) {
        pairs += nj * nl * this.distanceFn(l, j);
      }
    }
    return (1.0 * pairs) / (totalLabels * (totalLabels - 1));
  }

  /**
   * Krippendorff 1980 alpha (NLTK `alpha`).
   *
   * Items with fewer than two annotations are ignored. Degenerate cases mirror
   * NLTK: no labels or a single coder/item raise; a single distinct label
   * returns 1.
   */
  alpha(): number {
    if (this.labelKeys.size === 0) {
      throw new RangeError("Cannot calculate alpha, no data present!");
    }
    if (this.labelKeys.size === 1) {
      return 1;
    }
    if (this.coders.size === 1 && this.items.size === 1) {
      throw new RangeError("Cannot calculate alpha, only one coder and item present!");
    }

    let totalDisagreement = 0;
    const allValidLabelsFreq: LabelFreqs = new Map();
    let totalDo = 0;
    for (const group of groupBy(this.rows, (x) => x.item).values()) {
      const labelFreqs = freqsOf(group);
      let labelsCount = 0;
      for (const { count } of labelFreqs.values()) {
        labelsCount += count;
      }
      if (labelsCount < 2) {
        // Ignore the item.
        continue;
      }
      for (const [key, entry] of labelFreqs) {
        const existing = allValidLabelsFreq.get(key);
        if (existing === undefined) {
          allValidLabelsFreq.set(key, { ...entry });
        } else {
          existing.count += entry.count;
        }
      }
      totalDo += this.disagreement(labelFreqs) * labelsCount;
    }

    if (allValidLabelsFreq.size === 1) {
      return 1;
    }

    let validTotal = 0;
    for (const { count } of allValidLabelsFreq.values()) {
      validTotal += count;
    }
    const do_ = totalDo / validTotal;
    const de = this.disagreement(allValidLabelsFreq);
    return 1.0 - do_ / de;
  }

  /** Cohen 1968 weighted kappa for one coder pair (NLTK `weighted_kappa_pairwise`). */
  weightedKappaPairwise(cA: string, cB: string, maxDistance = 1.0): number {
    const byCoder = new Map<string, Map<string, number>>();
    for (const row of this.rows) {
      if (row.coder !== cA && row.coder !== cB) {
        continue;
      }
      let freqs = byCoder.get(row.coder);
      if (freqs === undefined) {
        freqs = new Map();
        byCoder.set(row.coder, freqs);
      }
      freqs.set(row.key, (freqs.get(row.key) ?? 0) + 1);
    }
    const freqOf = (coder: string, key: string): number => byCoder.get(coder)?.get(key) ?? 0;

    let total = 0;
    for (const j of this.labelKeys) {
      for (const l of this.labelKeys) {
        total +=
          freqOf(cA, j) * freqOf(cB, l) * this.distanceFn(this.labelByKey.get(j)!, this.labelByKey.get(l)!);
      }
    }
    const De = total / (maxDistance * this.items.size ** 2);
    const Do = this.doKwPairwise(cA, cB);
    return 1.0 - Do / De;
  }

  /** Cohen 1968 weighted kappa, averaged over coder pairs (NLTK `weighted_kappa`). */
  weightedKappa(maxDistance = 1.0): number {
    return this.pairwiseAverage((cA, cB) => this.weightedKappaPairwise(cA, cB, maxDistance));
  }

  /**
   * Classic Fleiss (1971) kappa.
   *
   * NOT present in `nltk.metrics.agreement` (which offers the Davies-Fleiss
   * variant as `multi_kappa`); implemented from the standard definition:
   * each item must receive the same number of ratings `n >= 2`.
   */
  fleissKappa(): number {
    const grouped = groupBy(this.rows, (x) => x.item);
    const nItems = grouped.size;
    if (nItems === 0) {
      throw new RangeError("Cannot calculate Fleiss' kappa, no data present!");
    }
    let n = -1;
    let pBarSum = 0;
    const categoryTotals = new Map<string, number>();
    let totalRatings = 0;
    for (const group of grouped.values()) {
      if (n === -1) {
        n = group.length;
      } else if (group.length !== n) {
        throw new RangeError("Fleiss' kappa requires the same number of ratings per item");
      }
      if (n < 2) {
        throw new RangeError("Fleiss' kappa requires at least two ratings per item");
      }
      const freqs = freqsOf(group);
      let rowSumSq = 0;
      for (const [key, { count }] of freqs) {
        rowSumSq += count * count;
        categoryTotals.set(key, (categoryTotals.get(key) ?? 0) + count);
        totalRatings += count;
      }
      pBarSum += (rowSumSq - n) / (n * (n - 1));
    }
    const pBar = pBarSum / nItems;
    let pe = 0;
    for (const total of categoryTotals.values()) {
      const pj = total / totalRatings;
      pe += pj * pj;
    }
    return (pBar - pe) / (1 - pe);
  }
}

/**
 * Convenience wrapper mirroring the common NLTK idiom
 * `AnnotationTask(data=[...]).avg_Ao()`.
 */
export function averageObservedAgreement(data: Iterable<AnnotationTriple>): number {
  return new AnnotationTask(data).avgAo();
}
