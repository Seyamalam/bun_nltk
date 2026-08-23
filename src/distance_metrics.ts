import { readFileSync } from "node:fs";

/**
 * Pure-algorithm distance metrics ported from NLTK for parity with
 * `nltk.metrics.distance`, `nltk.metrics.scores`, `nltk.metrics.segmentation`
 * and `nltk.metrics.spearman` (NLTK 3.10.3 semantics).
 */

export type LabelSet<T> = Set<T>;

export type Segmentation = string | ReadonlyArray<string | number | boolean>;

export type Ranking =
  | Record<string, number>
  | ReadonlyArray<readonly [string | number, number]>;

export type ProbabilityMap = Record<string, number>;

function setSize<T>(set: Set<T>): number {
  return set.size;
}

function setIntersectionSize<T>(a: Set<T>, b: Set<T>): number {
  let count = 0;
  for (const item of a) if (b.has(item)) count += 1;
  return count;
}

function setUnionSize<T>(a: Set<T>, b: Set<T>): number {
  let count = a.size;
  for (const item of b) if (!a.has(item)) count += 1;
  return count;
}

/**
 * Port of `nltk.metrics.distance.jaccard_distance`.
 *
 * Distance metric comparing set-similarity:
 * `(len(union) - len(intersection)) / len(union)`.
 *
 * Matches NLTK exactly: raises (like Python's ZeroDivisionError) when both
 * sets are empty, because NLTK performs an unguarded division by the union
 * size.
 */
export function jaccardDistance<T>(label1: LabelSet<T>, label2: LabelSet<T>): number {
  const unionLen = setUnionSize(label1, label2);
  if (unionLen === 0) {
    throw new RangeError("jaccard_distance is undefined for two empty sets (NLTK divides by zero)");
  }
  const intersectionLen = setIntersectionSize(label1, label2);
  return (unionLen - intersectionLen) / unionLen;
}

/**
 * Port of `nltk.metrics.distance.masi_distance`.
 *
 * Measuring Agreement on Set-Valued Items (MASI) distance
 * (Passonneau 2006). Uses the NLTK 3.10.3 weights m ∈ {1, 2/3, 1/3, 0}.
 */
export function masiDistance<T>(label1: LabelSet<T>, label2: LabelSet<T>): number {
  const lenIntersection = setIntersectionSize(label1, label2);
  const lenUnion = setUnionSize(label1, label2);
  const lenLabel1 = setSize(label1);
  const lenLabel2 = setSize(label2);

  let m: number;
  if (lenLabel1 === lenLabel2 && lenLabel1 === lenIntersection) {
    m = 1;
  } else if (lenIntersection === Math.min(lenLabel1, lenLabel2)) {
    m = 2 / 3;
  } else if (lenIntersection > 0) {
    m = 1 / 3;
  } else {
    m = 0;
  }

  return 1 - (lenIntersection / lenUnion) * m;
}

/**
 * Port of `nltk.metrics.distance.binary_distance`.
 *
 * Simple equality test: 0.0 if the labels are identical, 1.0 otherwise.
 */
export function binaryDistance(label1: unknown, label2: unknown): number {
  return label1 === label2 ? 0.0 : 1.0;
}

/**
 * Sørensen–Dice similarity coefficient for sets:
 * `2 * |intersection| / (|label1| + |label2|)`.
 *
 * NOTE: this function does not exist in NLTK 3.10.3 (added upstream later),
 * so there is no python-parity coverage; semantics follow the canonical
 * NLTK definition.
 */
export function sorensenDiceSimilarity<T>(label1: LabelSet<T>, label2: LabelSet<T>): number {
  const denom = setSize(label1) + setSize(label2);
  if (denom === 0) {
    throw new RangeError("sorensen_dice_similarity is undefined for two empty sets");
  }
  return (2 * setIntersectionSize(label1, label2)) / denom;
}

/**
 * Distance form of {@link sorensenDiceSimilarity}: `1 - similarity`.
 */
export function sorensenDiceDistance<T>(label1: LabelSet<T>, label2: LabelSet<T>): number {
  return 1 - sorensenDiceSimilarity(label1, label2);
}

/**
 * Port of `nltk.metrics.distance.interval_distance`.
 *
 * Krippendorff's interval distance metric: `(label1 - label2) ** 2`.
 * Non-numeric labels raise (NLTK prints a message and effectively fails).
 */
export function intervalDistance(label1: number, label2: number): number {
  if (typeof label1 !== "number" || typeof label2 !== "number") {
    throw new TypeError("non-numeric labels not supported with interval distance");
  }
  return (label1 - label2) ** 2;
}

/**
 * Port of `nltk.metrics.distance.presence`.
 *
 * Higher-order function returning a distance function that tests presence
 * of `label` in both argument sets: 1.0 when membership agrees, 0.0 otherwise.
 */
export function presence<T>(label: T): (x: LabelSet<T>, y: LabelSet<T>) => number {
  return (x, y) => (x.has(label) === y.has(label) ? 1.0 : 0.0);
}

/**
 * Port of `nltk.metrics.distance.fractional_presence`.
 *
 * Higher-order function returning a distance function weighted by the
 * fractional presence of `label` in each set, replicating NLTK's
 * short-circuiting `or` chain (first non-zero term wins, 0 fallback).
 */
export function fractionalPresence<T>(
  label: T,
): (x: LabelSet<T>, y: LabelSet<T>) => number {
  return (x, y) => {
    const inX = x.has(label);
    const inY = y.has(label);
    const nx = x.size;
    const ny = y.size;

    const terms: number[] = [];
    terms.push(inX && inY ? Math.abs(1 / nx - 1 / ny) : 0);
    terms.push(!inX && !inY ? 0 : 0);
    terms.push(inX && !inY ? Math.abs(1 / nx) : 0);
    terms.push(!inX && inY ? 1 / ny : 0);

    for (const term of terms) {
      if (term !== 0) return term;
    }
    return 0;
  };
}

/**
 * Port of `nltk.metrics.distance.custom_distance`.
 *
 * Builds a lookup distance function from a tab-separated file whose lines
 * have the form `labelA\tlabelB\tdistance`. The pair is treated as an
 * unordered key (mirroring NLTK's frozenset-of-frozensets key).
 */
export function customDistance(file: string): (x: string, y: string) => number {
  const data = new Map<string, number>();
  const content = readFileSync(file, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    const [labelA, labelB, dist] = trimmed.split("\t");
    if (labelA === undefined || labelB === undefined || dist === undefined) {
      throw new RangeError(`malformed custom distance line: ${trimmed}`);
    }
    const key = labelA < labelB ? `${labelA}\u0000${labelB}` : `${labelB}\u0000${labelA}`;
    data.set(key, Number.parseFloat(dist));
  }
  return (x, y) => {
    const key = x < y ? `${x}\u0000${y}` : `${y}\u0000${x}`;
    const value = data.get(key);
    if (value === undefined) {
      throw new RangeError(`no custom distance defined for (${x}, ${y})`);
    }
    return value;
  };
}

function editDistInit(len1: number, len2: number): number[][] {
  const lev: number[][] = [];
  for (let i = 0; i < len1; i += 1) lev.push(new Array<number>(len2).fill(0));
  for (let i = 0; i < len1; i += 1) lev[i]![0] = i;
  for (let j = 0; j < len2; j += 1) lev[0]![j] = j;
  return lev;
}

function editDistBacktrace(lev: number[][]): Array<[number, number]> {
  let i = lev.length - 1;
  let j = (lev[0]?.length ?? 0) - 1;
  const alignment: Array<[number, number]> = [[i, j]];

  while (i !== 0 || j !== 0) {
    // Operation precedence: substitute, skip s1, skip s2 (first minimum wins,
    // mirroring Python's stable `min` over the ordered directions list).
    const directions: Array<[number, number]> = [
      [i - 1, j - 1],
      [i - 1, j],
      [i, j - 1],
    ];
    let bestCost = Number.POSITIVE_INFINITY;
    const first = directions[0];
    if (first === undefined) throw new RangeError("no directions to backtrace");
    let best: [number, number] = first;
    for (const [di, dj] of directions) {
      const cost = di >= 0 && dj >= 0 ? (lev[di]?.[dj] ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
      if (cost < bestCost) {
        bestCost = cost;
        best = [di, dj];
      }
    }
    [i, j] = best;
    alignment.push([i, j]);
  }

  return alignment.reverse();
}

/**
 * Port of `nltk.metrics.distance.edit_distance_align`.
 *
 * Minimum Levenshtein edit-distance based alignment mapping between two
 * strings, returned as a list of `[i, j]` index pairs starting from the
 * `(0, 0)` start state. Backtrace precedence on ties: substitute, skip s1,
 * skip s2 (carried out in reverse string order), exactly as NLTK documents.
 */
export function editDistanceAlign(
  s1: string,
  s2: string,
  substitutionCost = 1,
): Array<[number, number]> {
  const len1 = s1.length;
  const len2 = s2.length;
  const lev = editDistInit(len1 + 1, len2 + 1);

  for (let i = 1; i <= len1; i += 1) {
    for (let j = 1; j <= len2; j += 1) {
      const c1 = s1[i - 1];
      const c2 = s2[j - 1];
      const a = lev[i - 1]![j]! + 1;
      const b = lev[i]![j - 1]! + 1;
      const c = lev[i - 1]![j - 1]! + (c1 !== c2 ? substitutionCost : 0);
      lev[i]![j] = Math.min(a, b, c);
    }
  }

  return editDistBacktrace(lev);
}

/**
 * Port of `nltk.metrics.scores.precision`.
 *
 * Fraction of test values appearing in the reference set:
 * `|reference ∩ test| / |test|`. Returns `null` when `test` is empty,
 * matching NLTK's `None`.
 */
export function precision<T>(reference: LabelSet<T>, test: LabelSet<T>): number | null {
  if (test.size === 0) return null;
  return setIntersectionSize(reference, test) / test.size;
}

/**
 * Port of `nltk.metrics.scores.recall`.
 *
 * Fraction of reference values appearing in the test set:
 * `|reference ∩ test| / |reference|`. Returns `null` when `reference`
 * is empty, matching NLTK's `None`.
 */
export function recall<T>(reference: LabelSet<T>, test: LabelSet<T>): number | null {
  if (reference.size === 0) return null;
  return setIntersectionSize(reference, test) / reference.size;
}

/**
 * Port of `nltk.metrics.scores.f_measure`.
 *
 * Weighted harmonic mean of precision and recall:
 * `1 / (alpha / p + (1 - alpha) / r)`. Returns `null` when either input set
 * is empty and `0` when either p or r is zero, matching NLTK.
 */
export function fMeasure<T>(
  reference: LabelSet<T>,
  test: LabelSet<T>,
  alpha = 0.5,
): number | null {
  const p = precision(reference, test);
  const r = recall(reference, test);
  if (p === null || r === null) return null;
  if (p === 0 || r === 0) return 0;
  return 1.0 / (alpha / p + (1 - alpha) / r);
}

/**
 * Port of `nltk.metrics.scores.log_likelihood`.
 *
 * Average log likelihood of the reference values under the given
 * probability distributions (`dist.logprob(val)` averaged over positions,
 * log base 2 per NLTK's `ProbDistI.logprob`). Distributions are plain
 * probability maps keyed by label.
 */
export function logLikelihood(
  reference: ReadonlyArray<string>,
  test: ReadonlyArray<ProbabilityMap>,
): number {
  if (reference.length !== test.length) {
    throw new RangeError("Lists must have the same length.");
  }
  let total = 0;
  for (let i = 0; i < reference.length; i += 1) {
    const label = reference[i];
    if (label === undefined) throw new RangeError("reference label missing");
    const dist = test[i];
    if (dist === undefined) throw new RangeError(`distribution ${i} missing`);
    const prob = dist[label];
    if (prob === undefined) {
      throw new RangeError(`No probability for label ${label} in distribution ${i}`);
    }
    total += Math.log2(prob);
  }
  return total / reference.length;
}

function countBoundary(seq: Segmentation, boundary: string | number | boolean): number {
  let count = 0;
  for (const item of seq) if (item === boundary) count += 1;
  return count;
}

function sliceSegmentation(
  seq: Segmentation,
  start: number,
  end: number,
): Array<string | number | boolean> {
  if (typeof seq === "string") {
    return seq.slice(start, end).split("");
  }
  return seq.slice(start, end) as Array<string | number | boolean>;
}

/**
 * Port of `nltk.metrics.segmentation.windowdiff`.
 *
 * Windowdiff score for a pair of segmentations over a two-item vocabulary,
 * where `boundary` marks segment edges. `weighted` selects the variant that
 * accumulates raw boundary-count differences instead of capping them at 1.
 */
export function windowdiff(
  seg1: Segmentation,
  seg2: Segmentation,
  k: number,
  boundary: string | number | boolean = "1",
  weighted = false,
): number {
  const len1 = typeof seg1 === "string" ? seg1.length : seg1.length;
  const len2 = typeof seg2 === "string" ? seg2.length : seg2.length;
  if (len1 !== len2) {
    throw new RangeError("Segmentations have unequal length");
  }
  if (k > len1) {
    throw new RangeError("Window width k should be smaller or equal than segmentation lengths");
  }

  let wd = 0;
  for (let i = 0; i <= len1 - k; i += 1) {
    const ndiff = Math.abs(
      countBoundary(sliceSegmentation(seg1, i, i + k), boundary) -
        countBoundary(sliceSegmentation(seg2, i, i + k), boundary),
    );
    wd += weighted ? ndiff : Math.min(1, ndiff);
  }
  return wd / (len1 - k + 1.0);
}

/**
 * Beeferman's Pk text segmentation evaluation metric
 * (port of `nltk.metrics.segmentation.pk`).
 *
 * When `k` is null it defaults to
 * `round(len(ref) / (boundaryCount(ref) * 2))` using Python's
 * round-half-to-even semantics.
 */
export function pk(
  ref: Segmentation,
  hyp: Segmentation,
  k: number | null = null,
  boundary: string | number | boolean = "1",
): number {
  const refLen = typeof ref === "string" ? ref.length : ref.length;
  const hypLen = typeof hyp === "string" ? hyp.length : hyp.length;
  if (refLen !== hypLen) {
    throw new RangeError("Segmentations have unequal length");
  }

  let window = k;
  if (window === null) {
    const boundaryCount = countBoundary(ref, boundary);
    window = pythonRoundHalfEven(refLen / (boundaryCount * 2.0));
  }

  let err = 0;
  for (let i = 0; i <= refLen - window; i += 1) {
    const r = countBoundary(sliceSegmentation(ref, i, i + window), boundary) > 0;
    const h = countBoundary(sliceSegmentation(hyp, i, i + window), boundary) > 0;
    if (r !== h) err += 1;
  }
  return err / (refLen - window + 1.0);
}

function pythonRoundHalfEven(x: number): number {
  const floor = Math.floor(x);
  const diff = x - floor;
  if (diff > 0.5) return floor + 1;
  if (diff < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

function rankingRecordToMap(ranks: Record<string, number>): Map<string, number> {
  const map = new Map<string, number>();
  for (const key of Object.keys(ranks)) map.set(key, ranks[key] ?? 0);
  return map;
}

function rankingToMap(ranks: Ranking): Map<string, number> {
  if (Array.isArray(ranks)) {
    const record: Record<string, number> = {};
    for (const [key, rank] of ranks) record[String(key)] = rank;
    return rankingRecordToMap(record);
  }
  if (typeof ranks === "object" && ranks !== null && !Array.isArray(ranks)) return rankingRecordToMap({ ...(ranks as Readonly<Record<string, number>>) });
  throw new RangeError("unexpected ranking shape");
}

/**
 * Port of `nltk.metrics.spearman.spearman_correlation`.
 *
 * Spearman rank correlation coefficient for two rankings given as maps or
 * sequences of `[key, rank]` pairs. Only keys present in both rankings are
 * considered; returns 0.0 when the coefficient is undefined (fewer than two
 * shared keys), matching NLTK's ZeroDivisionError fallback.
 */
export function spearmanCorrelation(ranks1: Ranking, ranks2: Ranking): number {
  const map1 = rankingToMap(ranks1);
  const map2 = rankingToMap(ranks2);

  let n = 0;
  let res = 0;
  for (const [key, rank1] of map1.entries()) {
    if (!map2.has(key)) continue;
    const d = rank1 - map2.get(key)!;
    res += d * d;
    n += 1;
  }

  const denominator = n * (n * n - 1);
  if (denominator === 0) return 0.0;
  return 1 - (6 * res) / denominator;
}
