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
