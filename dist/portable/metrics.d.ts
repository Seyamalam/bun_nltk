export { ConfusionMatrix, accuracy } from './confusion_metrics.js';

type BleuWeights = number[];
type BleuPrecision = {
    numerator: number;
    denominator: number;
};
type BleuSmoothingContext = {
    references: string[][];
    hypothesis: string[];
    hypLen: number;
};
type BleuSmoothingResult = Array<number | BleuPrecision>;
type BleuSmoothingFn = (pN: BleuSmoothingResult, context: BleuSmoothingContext) => BleuSmoothingResult;
type EditDistanceOptions = {
    substitutionCost?: number;
    transpositions?: boolean;
};
declare function modifiedPrecision(references: string[][], hypothesis: string[], n: number): BleuPrecision;
declare function closestRefLength(references: string[][], hypLen: number): number;
declare function brevityPenalty(closestRefLen: number, hypLen: number): number;
declare class SmoothingFunction {
    readonly epsilon: number;
    readonly alpha: number;
    readonly k: number;
    constructor(epsilon?: number, alpha?: number, k?: number);
    method0: BleuSmoothingFn;
    method1: BleuSmoothingFn;
    method2: BleuSmoothingFn;
    method3: BleuSmoothingFn;
    method4: BleuSmoothingFn;
    method5: BleuSmoothingFn;
    method6: BleuSmoothingFn;
    method7: BleuSmoothingFn;
}
declare function sentenceBleu(references: string[][], hypothesis: string[], weights?: BleuWeights, smoothingFunction?: BleuSmoothingFn, autoReweigh?: boolean): number;
declare function sentenceBleu(references: string[][], hypothesis: string[], weights: BleuWeights[], smoothingFunction?: BleuSmoothingFn, autoReweigh?: boolean): number[];
declare function corpusBleu(listOfReferences: string[][][], hypotheses: string[][], weights?: BleuWeights, smoothingFunction?: BleuSmoothingFn, autoReweigh?: boolean): number;
declare function corpusBleu(listOfReferences: string[][][], hypotheses: string[][], weights: BleuWeights[], smoothingFunction?: BleuSmoothingFn, autoReweigh?: boolean): number[];
declare function editDistance(left: string, right: string, options?: EditDistanceOptions): number;
type ConfusionMatrixResult<T = string> = {
    labels: T[];
    matrix: number[][];
    accuracy: number;
};
declare function confusionMatrix<T>(gold: T[], predicted: T[]): ConfusionMatrixResult<T>;

export { SmoothingFunction, brevityPenalty, closestRefLength, confusionMatrix, corpusBleu, editDistance, modifiedPrecision, sentenceBleu };
export type { BleuPrecision, BleuSmoothingContext, BleuSmoothingFn, BleuSmoothingResult, BleuWeights, ConfusionMatrixResult, EditDistanceOptions };
