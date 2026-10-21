type LabelSet<T> = Set<T>;
type Segmentation = string | ReadonlyArray<string | number | boolean>;
type Ranking = Record<string, number> | ReadonlyArray<readonly [unknown, number]> | ReadonlyMap<unknown, number>;
type ProbabilityMap = Record<string, number>;
/** NLTK Jaccard distance; two empty sets raise ZeroDivisionError. */
declare function jaccardDistance<T>(a: LabelSet<T>, b: LabelSet<T>): number;
/** NLTK MASI distance; two empty sets raise ZeroDivisionError. */
declare function masiDistance<T>(a: LabelSet<T>, b: LabelSet<T>): number;
/** JS strict label equality is preserved (objects are not stringified). */
declare function binaryDistance(a: unknown, b: unknown): number;
/** Canonical Dice extension; not an NLTK 3.10.3 API. */
declare function sorensenDiceSimilarity<T>(a: LabelSet<T>, b: LabelSet<T>): number;
declare function sorensenDiceDistance<T>(a: LabelSet<T>, b: LabelSet<T>): number;
declare function intervalDistance(a: number, b: number): number;
declare function presence<T>(label: T): (x: LabelSet<T>, y: LabelSet<T>) => number;
declare function fractionalPresence<T>(label: T): (x: LabelSet<T>, y: LabelSet<T>) => number;
/** Existing string-label file adapter (NLTK itself takes singleton frozensets). */
declare function customDistance(file: string): (x: string, y: string) => number;
declare function editDistanceAlign(s1: string, s2: string, substitutionCost?: number): Array<[number, number]>;
/** Empty test maps to Python None, not numeric NaN. */
declare function precision<T>(reference: LabelSet<T>, test: LabelSet<T>): number | null;
declare function recall<T>(reference: LabelSet<T>, test: LabelSet<T>): number | null;
declare function fMeasure<T>(reference: LabelSet<T>, test: LabelSet<T>, alpha?: number): number | null;
/** Probability-map adapter for NLTK ProbDistI.logprob (zero/missing -> -1e300). */
declare function logLikelihood(reference: ReadonlyArray<string>, test: ReadonlyArray<ProbabilityMap>): number;
declare function windowdiff(seg1: Segmentation, seg2: Segmentation, k: number, boundary?: string | number | boolean, weighted?: boolean): number;
declare function pk(ref: Segmentation, hyp: Segmentation, k?: number | null, boundary?: string | number | boolean): number;
declare function spearmanCorrelation(ranks1: Ranking, ranks2: Ranking): number;
declare function ranksFromSequence<T>(sequence: Iterable<T>): Array<[T, number]>;
/** Input order is preserved; scores are not sorted by NLTK. */
declare function ranksFromScores<T>(scores: Iterable<readonly [T, number]>, rankGap?: number): Array<[T, number]>;

export { binaryDistance, customDistance, editDistanceAlign, fMeasure, fractionalPresence, intervalDistance, jaccardDistance, logLikelihood, masiDistance, pk, precision, presence, ranksFromScores, ranksFromSequence, ranksFromScores as ranks_from_scores, ranksFromSequence as ranks_from_sequence, recall, sorensenDiceDistance, sorensenDiceSimilarity, spearmanCorrelation, windowdiff };
export type { LabelSet, ProbabilityMap, Ranking, Segmentation };
