type ChrFOptions = {
    minLen?: number;
    maxLen?: number;
    beta?: number;
    ignoreWhitespace?: boolean;
};
type NistOptions = {
    n?: number;
};
declare function corpusChrF(references: Array<string | string[]>, hypotheses: Array<string | string[]>, options?: ChrFOptions): number;
declare function sentenceChrF(reference: string | string[], hypothesis: string | string[], options?: ChrFOptions): number;
declare function nistLengthPenalty(refLen: number, hypLen: number): number;
declare function corpusNist(listOfReferences: string[][][], hypotheses: string[][], options?: NistOptions): number;
declare function sentenceNist(references: string[][], hypothesis: string[], options?: NistOptions): number;

export { corpusChrF, corpusNist, nistLengthPenalty, sentenceChrF, sentenceNist };
export type { ChrFOptions, NistOptions };
