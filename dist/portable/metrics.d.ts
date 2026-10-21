export { ConfusionMatrix, accuracy } from './confusion_metrics.js';

type BleuWeights = [number, number, number, number];
type EditDistanceOptions = {
    substitutionCost?: number;
    transpositions?: boolean;
};
declare function sentenceBleu(references: string[][], hypothesis: string[], weights?: BleuWeights): number;
declare function corpusBleu(listOfReferences: string[][][], hypotheses: string[][], weights?: BleuWeights): number;
declare function editDistance(left: string, right: string, options?: EditDistanceOptions): number;
type ConfusionMatrixResult<T = string> = {
    labels: T[];
    matrix: number[][];
    accuracy: number;
};
declare function confusionMatrix<T>(gold: T[], predicted: T[]): ConfusionMatrixResult<T>;

export { confusionMatrix, corpusBleu, editDistance, sentenceBleu };
export type { BleuWeights, ConfusionMatrixResult, EditDistanceOptions };
