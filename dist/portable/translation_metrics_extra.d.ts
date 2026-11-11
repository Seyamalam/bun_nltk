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
declare function sentenceChrF(reference: string | string[], hypothesis: string | string[], minLen?: number, maxLen?: number, beta?: number, ignoreWhitespace?: boolean): number;
declare function nistLengthPenalty(refLen: number, hypLen: number): number;
declare function corpusNist(listOfReferences: string[][][], hypotheses: string[][], options?: NistOptions): number;
declare function sentenceNist(references: string[][], hypothesis: string[], options?: NistOptions): number;
declare function sentenceNist(references: string[][], hypothesis: string[], n?: number): number;
/** nltk.translate.chrf_score.chrf_precision_recall_fscore_support — per-order ngram P/R/F + tp. */
declare function chrf_precision_recall_fscore_support<T>(reference: readonly T[], hypothesis: readonly T[], n: number, beta?: number, epsilon?: number): [number, number, number, number];

export { chrf_precision_recall_fscore_support as chrfPrecisionRecallFscoreSupport, chrf_precision_recall_fscore_support, corpusChrF, corpusNist, corpusChrF as corpus_chrf, corpusNist as corpus_nist, nistLengthPenalty, nistLengthPenalty as nist_length_penalty, sentenceChrF, sentenceNist, sentenceChrF as sentence_chrf, sentenceNist as sentence_nist };
export type { ChrFOptions, NistOptions };
