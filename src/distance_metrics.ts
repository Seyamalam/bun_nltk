import { readFileSync } from "node:fs";
import { syncWasm } from "./sync_wasm.ts";
import { internLabels } from "./metrics_wasm.ts";

export type LabelSet<T> = Set<T>;
export type Segmentation = string | ReadonlyArray<string | number | boolean>;
export type Ranking = Record<string, number> | ReadonlyArray<readonly [unknown, number]> | ReadonlyMap<unknown, number>;
export type ProbabilityMap = Record<string, number>;

function setScore<T>(op: number, a: LabelSet<T>, b: LabelSet<T>, alpha = 0.5, extra: T[] = []): number | null {
  if (!(a instanceof Set) || !(b instanceof Set)) throw new TypeError("reference and test should be sets");
  const input = internLabels(a, b, extra);
  const result = syncWasm().evaluationMetrics().setScore(op, input.a, input.b, extra.length ? input.ids.get(extra[0]!)! : 0, typeof alpha === "number" ? alpha : NaN);
  if (typeof alpha !== "number" && result !== null && result !== 0) throw new TypeError("alpha must be numeric");
  return result;
}

/** NLTK Jaccard distance; two empty sets raise ZeroDivisionError. */
export function jaccardDistance<T>(a: LabelSet<T>, b: LabelSet<T>): number { return setScore(0, a, b)!; }
/** NLTK MASI distance; two empty sets raise ZeroDivisionError. */
export function masiDistance<T>(a: LabelSet<T>, b: LabelSet<T>): number { return setScore(1, a, b)!; }
/** JS strict label equality is preserved (objects are not stringified). */
export function binaryDistance(a: unknown, b: unknown): number { return syncWasm().evaluationMetrics().binary(a === b); }
/** Canonical Dice extension; not an NLTK 3.10.3 API. */
export function sorensenDiceSimilarity<T>(a: LabelSet<T>, b: LabelSet<T>): number { return setScore(2, a, b)!; }
export function sorensenDiceDistance<T>(a: LabelSet<T>, b: LabelSet<T>): number { return setScore(3, a, b)!; }
export function intervalDistance(a: number, b: number): number {
  if (typeof a !== "number" || typeof b !== "number") throw new TypeError("non-numeric labels not supported with interval distance");
  return syncWasm().evaluationMetrics().interval(a, b);
}
export function presence<T>(label: T): (x: LabelSet<T>, y: LabelSet<T>) => number {
  return (x, y) => setScore(7, x, y, 0.5, [label])!;
}
export function fractionalPresence<T>(label: T): (x: LabelSet<T>, y: LabelSet<T>) => number {
  return (x, y) => setScore(8, x, y, 0.5, [label])!;
}

/** Existing string-label file adapter (NLTK itself takes singleton frozensets). */
export function customDistance(file: string): (x: string, y: string) => number {
  const data = new Map<string, Map<string, number>>();
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    const [a, b, dist] = trimmed.split("\t");
    if (a === undefined || b === undefined || dist === undefined) throw new RangeError(`malformed custom distance line: ${trimmed}`);
    const value = Number.parseFloat(dist);
    const row = data.get(a) ?? new Map<string, number>(); row.set(b, value); data.set(a, row);
    const reverse = data.get(b) ?? new Map<string, number>(); reverse.set(a, value); data.set(b, reverse);
  }
  return (x, y) => {
    const value = data.get(x)?.get(y);
    if (value === undefined) throw new RangeError(`no custom distance defined for (${x}, ${y})`);
    return value;
  };
}

export function editDistanceAlign(s1: string, s2: string, substitutionCost = 1): Array<[number, number]> {
  return syncWasm().editDistanceAlign(s1, s2, substitutionCost);
}
/** Empty test maps to Python None, not numeric NaN. */
export function precision<T>(reference: LabelSet<T>, test: LabelSet<T>): number | null { return setScore(4, reference, test); }
export function recall<T>(reference: LabelSet<T>, test: LabelSet<T>): number | null { return setScore(5, reference, test); }
export function fMeasure<T>(reference: LabelSet<T>, test: LabelSet<T>, alpha = 0.5): number | null { return setScore(6, reference, test, alpha); }

/** Probability-map adapter for NLTK ProbDistI.logprob (zero/missing -> -1e300). */
export function logLikelihood(reference: ReadonlyArray<string>, test: ReadonlyArray<ProbabilityMap>): number {
  if (reference.length !== test.length) throw new RangeError("Lists must have the same length.");
  const probabilities = Float64Array.from(reference, (label, i) => {
    const dist = test[i];
    if (dist === undefined) throw new TypeError(`distribution ${i} missing`);
    const value = Object.hasOwn(dist, label) ? dist[label]! : 0;
    if (typeof value !== "number") throw new TypeError("probabilities must be numeric");
    return value;
  });
  return syncWasm().evaluationMetrics().logLikelihood(probabilities);
}

function segmentationInput(a: Segmentation, b: Segmentation, boundary: string | number | boolean): { a: Uint32Array; b: Uint32Array; ab: Uint32Array; bb: Uint32Array; flags: number } {
  if ((typeof a !== "string" && !Array.isArray(a)) || (typeof b !== "string" && !Array.isArray(b))) throw new TypeError("segmentations must be strings or arrays");
  const left = typeof a === "string" ? Array.from(a) : a;
  const right = typeof b === "string" ? Array.from(b) : b;
  if (left.length !== right.length) throw new RangeError("Segmentations have unequal length");
  if ((typeof a === "string" || typeof b === "string") && typeof boundary !== "string") throw new TypeError("string boundary must be a string");
  const ab = typeof a === "string" ? Array.from(boundary as string) : [boundary];
  const bb = typeof b === "string" ? Array.from(boundary as string) : [boundary];
  // Python's list boundary comparison considers True == 1 and False == 0.
  const normalize = (v: string | number | boolean): string | number => typeof v === "boolean" ? Number(v) : v;
  const labels = internLabels(left.map(normalize), right.map(normalize), [...ab, ...bb].map(normalize));
  return { a: labels.a, b: labels.b,
    ab: Uint32Array.from(ab, (v) => labels.ids.get(normalize(v))!), bb: Uint32Array.from(bb, (v) => labels.ids.get(normalize(v))!),
    flags: Number(typeof a === "string") | (Number(typeof b === "string") << 1) };
}
export function windowdiff(seg1: Segmentation, seg2: Segmentation, k: number, boundary: string | number | boolean = "1", weighted = false): number {
  const input = segmentationInput(seg1, seg2, boundary);
  if (!Number.isSafeInteger(k)) throw new TypeError("window width must be an integer");
  if (k < 0) throw new RangeError("Window width k should not be negative");
  if (k > input.a.length) throw new RangeError("Window width k should be smaller or equal than segmentation lengths");
  return syncWasm().evaluationMetrics().segmentation(input.a, input.b, input.ab, input.bb, input.flags | (weighted ? 16 : 0), k);
}
export function pk(ref: Segmentation, hyp: Segmentation, k: number | null = null, boundary: string | number | boolean = "1"): number {
  const input = segmentationInput(ref, hyp, boundary);
  if (k !== null && !Number.isSafeInteger(k)) throw new TypeError("window width must be an integer");
  if (k !== null && k < 0) throw new RangeError("Window width k should not be negative");
  return syncWasm().evaluationMetrics().segmentation(input.a, input.b, input.ab, input.bb, input.flags | 4 | (k === null ? 8 : 0), k ?? 0);
}

function rankingPairs(ranks: Ranking): Array<readonly [unknown, number]> {
  if (ranks instanceof Map || Array.isArray(ranks)) return [...ranks];
  if (typeof ranks === "object" && ranks !== null) return Object.entries(ranks);
  throw new TypeError("rankings must be records, maps, or key/rank pairs");
}
function rankValues(pairs: ReadonlyArray<readonly [unknown, number]>): Float64Array {
  return Float64Array.from(pairs, (pair) => {
    if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[1] !== "number") throw new TypeError("rank pairs must contain a key and numeric rank");
    return pair[1];
  });
}
export function spearmanCorrelation(ranks1: Ranking, ranks2: Ranking): number {
  const a = rankingPairs(ranks1), b = rankingPairs(ranks2);
  const ar = rankValues(a), br = rankValues(b);
  const input = internLabels(a.map((v) => v[0]), b.map((v) => v[0]));
  return syncWasm().evaluationMetrics().spearman(input.a, ar, input.b, br);
}
export function ranksFromSequence<T>(sequence: Iterable<T>): Array<[T, number]> {
  // This is an enumeration adapter, not a scoring algorithm.
  return Array.from(sequence, (value, i) => [value, i]);
}
/** Input order is preserved; scores are not sorted by NLTK. */
export function ranksFromScores<T>(scores: Iterable<readonly [T, number]>, rankGap = 1e-15): Array<[T, number]> {
  if (typeof rankGap !== "number") throw new TypeError("rankGap must be numeric");
  const pairs = [...scores];
  const ranks = syncWasm().evaluationMetrics().ranks(rankValues(pairs), rankGap);
  return pairs.map(([key], i) => [key, ranks[i]!]);
}
export { ranksFromSequence as ranks_from_sequence, ranksFromScores as ranks_from_scores };

export const MAX_DISTANCE_INPUT_LEN = 2000;

function checkDistanceInputLen(s1: string, s2: string, funcName: string): void {
  const longest = Math.max(s1.length, s2.length);
  if (longest > MAX_DISTANCE_INPUT_LEN) {
    throw new Error(`${funcName}: input length ${longest} exceeds MAX_DISTANCE_INPUT_LEN (${MAX_DISTANCE_INPUT_LEN}). This function is super-linear in the input length over two untrusted strings (CWE-407/CWE-400); a long input is a CPU/memory DoS. Raise nltk.metrics.distance.MAX_DISTANCE_INPUT_LEN if you need to compare longer trusted strings.`);
  }
}

export function jaro_similarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  checkDistanceInputLen(s1, s2, "jaro_similarity");
  const lenS1 = s1.length, lenS2 = s2.length;
  const matchBound = Math.floor(Math.max(lenS1, lenS2) / 2) - 1;
  let matches = 0;
  let transpositions = 0;
  const flagged1: number[] = [];
  const matched2 = new Set<number>();
  for (let i = 0; i < lenS1; i++) {
    const upperbound = Math.min(i + matchBound, lenS2 - 1);
    const lowerbound = Math.max(0, i - matchBound);
    for (let j = lowerbound; j <= upperbound; j++) {
      if (s1[i] === s2[j] && !matched2.has(j)) {
        matches += 1;
        flagged1.push(i);
        matched2.add(j);
        break;
      }
    }
  }
  const flagged2 = [...matched2].sort((a, b) => a - b);
  for (let k = 0; k < flagged1.length; k++) {
    if (s1[flagged1[k]!] !== s2[flagged2[k]!]) transpositions += 1;
  }
  if (matches === 0) return 0.0;
  return (1 / 3) * (matches / lenS1 + matches / lenS2 + (matches - Math.floor(transpositions / 2)) / matches);
}

export function jaro_winkler_similarity(s1: string, s2: string, p = 0.1, maxL = 4): number {
  if (!(0 <= maxL * p && maxL * p <= 1)) {
    console.warn("The product  `max_l * p` might not fall between [0,1].Jaro-Winkler similarity might not be between 0 and 1.");
  }
  const jaroSim = jaro_similarity(s1, s2);
  let l = 0;
  const n = Math.min(s1.length, s2.length);
  for (let i = 0; i < n; i++) {
    if (s1[i] === s2[i]) l += 1;
    else break;
    if (l === maxL) break;
  }
  return jaroSim + l * p * (1 - jaroSim);
}
export { jaro_similarity as jaroSimilarity, jaro_winkler_similarity as jaroWinklerSimilarity };

export function ghd(ref: string | readonly (string | number | boolean)[], hyp: string | readonly (string | number | boolean)[], insCost = 2.0, delCost = 2.0, shiftCostCoeff = 1.0, boundary: string | number | boolean = "1"): number {
  const refArr = typeof ref === "string" ? [...ref] : [...ref];
  const hypArr = typeof hyp === "string" ? [...hyp] : [...hyp];
  const refIdx = refArr.flatMap((v, i) => (v === boundary ? [i] : []));
  const hypIdx = hypArr.flatMap((v, i) => (v === boundary ? [i] : []));
  const nref = refIdx.length, nhyp = hypIdx.length;
  if (nref === 0 && nhyp === 0) return 0.0;
  if (nref > 0 && nhyp === 0) return nref * insCost;
  if (nref === 0 && nhyp > 0) return nhyp * delCost;
  const mat: number[][] = Array.from({ length: nhyp + 1 }, (_, i) =>
    Array.from({ length: nref + 1 }, (_, j) => (i === 0 ? insCost * j : j === 0 ? delCost * i : 0)));
  for (let i = 0; i < hypIdx.length; i++) {
    for (let j = 0; j < refIdx.length; j++) {
      const rowi = hypIdx[i]!, colj = refIdx[j]!;
      const shiftCost = shiftCostCoeff * Math.abs(rowi - colj) + mat[i]![j]!;
      let tcost: number;
      if (rowi === colj) tcost = mat[i]![j]!;
      else if (rowi > colj) tcost = delCost + mat[i]![j + 1]!;
      else tcost = insCost + mat[i + 1]![j]!;
      mat[i + 1]![j + 1] = Math.min(tcost, shiftCost);
    }
  }
  return mat[nhyp]![nref]!;
}

export function approxrand<T>(a: readonly T[], b: readonly T[], kwargs: {
  shuffles?: number; statistic?: (lst: readonly T[]) => number; verbose?: boolean; rng?: () => number;
} = {}): [number, number, number] {
  const factorial = (n: number) => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
  const shuffles = Math.min(kwargs.shuffles ?? 999, factorial(a.length + b.length));
  const stat = kwargs.statistic ?? ((lst: readonly T[]) => (lst as unknown as number[]).reduce((x, y) => x + y, 0) / lst.length);
  const verbose = kwargs.verbose ?? false;
  const rng = kwargs.rng ?? Math.random;
  const actualStat = Math.abs(stat(a) - stat(b));
  if (verbose) { console.log(`shuffles: ${shuffles}`); console.log(`actual statistic: ${actualStat}`); }
  let c = 1e-100;
  const lst = [...a, ...b];
  const indices = lst.map((_, i) => i);
  for (let i = 0; i < shuffles; i++) {
    if (verbose && i % 10 === 0) console.log(`shuffle: ${i}`);
    for (let j = indices.length - 1; j > 0; j--) {
      const k = Math.floor(rng() * (j + 1));
      [indices[j], indices[k]] = [indices[k]!, indices[j]!];
    }
    const pseudoA = stat(indices.slice(0, a.length).map((x) => lst[x]!));
    const pseudoB = stat(indices.slice(a.length).map((x) => lst[x]!));
    const pseudoStat = Math.abs(pseudoA - pseudoB);
    if (pseudoStat >= actualStat) c += 1;
    if (verbose && i % 10 === 0) { console.log(`pseudo-statistic: ${pseudoStat}`); console.log(`significance: ${(c + 1) / (i + 1)}`); }
  }
  const significance = (c + 1) / (shuffles + 1);
  if (verbose) console.log(`significance: ${significance}`);
  return [significance, c, shuffles];
}
