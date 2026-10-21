export { WasmNltk, type WasmNltkInit } from './wasm.js';
export { type PositiveFeatureOptions, RustNaiveBayesClassifier, RustPositiveNaiveBayesClassifier } from './feature_nb.js';
export { type FeatureTreeOptions, RustDecisionTreeClassifier } from './feature_tree.js';
export { type FeatureMaxentOptions, type FeatureMaxentSerialized, RustMaxentClassifier } from './feature_maxent.js';
export { type BlanklineHandling, type TokenSpan } from './tokenizer_types.js';
export { BlanklineTokenizer, LineTokenizer, SpaceTokenizer, TabTokenizer, WhitespaceTokenizer, blanklineTokenize, blanklineTokenize as blankline_tokenize, lineTokenize, lineTokenize as line_tokenize } from './tokenizers_basic.js';
export { type FeatureSet, type FeatureValue, type LabeledFeatureset } from './feature_types.js';
export { TreebankWordDetokenizer, TreebankWordTokenizer, WordPunctTokenizer, treebankWordTokenize, wordPunctTokenize } from './tokenizers_treebank.js';

declare function tokenizeAscii(text: string): string[];
declare function normalizeTokensAscii(text: string, removeStopwords?: boolean): string[];
declare function normalizeTokensUnicode(text: string, removeStopwords?: boolean): string[];
declare function countTokensAscii(text: string): number;
declare function countUniqueTokensAscii(text: string): number;
declare function countNgramsAscii(text: string, n: number): number;
declare function countUniqueNgramsAscii(text: string, n: number): number;
type AsciiMetrics = {
    tokens: number;
    uniqueTokens: number;
    ngrams: number;
    uniqueNgrams: number;
};
declare function computeAsciiMetrics(text: string, n: number): AsciiMetrics;
declare function ngramsAscii(text: string, n: number): string[][];
declare const POS_TAG_NAMES: readonly ["NN", "NNP", "CD", "VBG", "VBD", "RB", "DT", "CC", "PRP", "VB"];
type PosTagName = (typeof POS_TAG_NAMES)[number];
type PosTag = {
    token: string;
    tag: PosTagName;
    tagId: number;
    start: number;
    length: number;
};
declare function posTagAscii(text: string): PosTag[];
declare function everygramsAscii(text: string, minLen?: number, maxLen?: number): string[][];
declare function skipgramsAscii(text: string, n: number, k: number): string[][];
declare function hashTokenAscii(token: string): bigint;
declare function hashNgram(tokenHashes: bigint[], n: number): bigint;
declare function tokenFreqDistHashAscii(text: string): Map<bigint, number>;
declare function ngramFreqDistHashAscii(text: string, n: number): Map<bigint, number>;
type PmiBigram = {
    leftHash: bigint;
    rightHash: bigint;
    score: number;
};
type TokenFreqDistIds = {
    tokens: string[];
    counts: number[];
    tokenToId: Map<string, number>;
    totalTokens: number;
};
type BigramWindowStatId = {
    leftId: number;
    rightId: number;
    count: number;
    pmi: number;
};
type BigramWindowStatToken = {
    left: string;
    right: string;
    leftId: number;
    rightId: number;
    count: number;
    pmi: number;
};
declare function tokenFreqDistIdsAscii(text: string): TokenFreqDistIds;
declare function bigramWindowStatsAsciiIds(text: string, windowSize?: number): BigramWindowStatId[];
declare function bigramWindowStatsAscii(text: string, windowSize?: number): BigramWindowStatToken[];
declare function topPmiBigramsAscii(text: string, topK: number, windowSize?: number): PmiBigram[];

declare function wordTokenizeSubset(text: string): string[];
declare class ToktokTokenizer {
    tokenize(text: string): string[];
}
declare class MWETokenizer {
    private readonly separator;
    private readonly phrases;
    private longest;
    constructor(mwes?: string[][], separator?: string);
    addMwe(tokens: string[]): void;
    tokenize(tokens: string[]): string[];
}
type TweetTokenizerOptions = {
    preserveCase?: boolean;
    stripHandles?: boolean;
    reduceLen?: boolean;
    matchPhoneNumbers?: boolean;
};
declare function tweetTokenizeSubset(text: string, opts?: TweetTokenizerOptions): string[];
declare class TweetTokenizer {
    private readonly options;
    constructor(opts?: TweetTokenizerOptions);
    tokenize(text: string): string[];
}
declare function toktokTokenize(text: string): string[];
declare function mweTokenize(tokens: string[], mwes: string[][], separator?: string): string[];
declare function tweetTokenize(text: string, opts?: TweetTokenizerOptions): string[];

type SentenceTokenizerOptions = {
    abbreviations?: Iterable<string>;
    learnAbbreviations?: boolean;
    orthographicHeuristics?: boolean;
};
declare function sentenceTokenizeSubset(text: string, options?: SentenceTokenizerOptions): string[];

/** Model marshaling and UTF-8/UTF-16 offset conversion; inference runs in Rust. */

type PunktSpan = [start: number, end: number];

type PunktModelSerialized = {
    version: number;
    abbreviations: string[];
    collocations: Array<[string, string]>;
    sentenceStarters: string[];
    orthoContext?: Record<string, number>;
    abbreviationScores?: Record<string, number>;
    orthographicContext?: Record<string, {
        lower: number;
        upper: number;
    }>;
};
type PunktTrainingOptions = {
    minAbbrevCount?: number;
    minCollocationCount?: number;
    minSentenceStarterCount?: number;
};
declare class PunktTrainerSubset {
    private readonly chunks;
    private options;
    private cached;
    train(text: string, options?: PunktTrainingOptions): this;
    finalize(): PunktModelSerialized;
    getParams(): PunktModelSerialized;
}
declare class PunktTrainer extends PunktTrainerSubset {
    loadTrainText(text: string): this;
}
declare class PunktSentenceTokenizerSubset {
    protected model: PunktModelSerialized;
    constructor(model?: PunktModelSerialized);
    tokenize(text: string, realignBoundaries?: boolean): string[];
    /** UTF-16 offsets for the Rust NLTK inference model (version 2). */
    spanTokenize(text: string, realignBoundaries?: boolean): PunktSpan[];
    train(text: string, options?: PunktTrainingOptions): this;
    getParams(): PunktModelSerialized;
}
declare class PunktSentenceTokenizer extends PunktSentenceTokenizerSubset {
    setParams(model: PunktModelSerialized): this;
}
declare function trainPunktModel(text: string, options?: PunktTrainingOptions): PunktModelSerialized;
declare function sentenceTokenizePunkt(text: string, model?: PunktModelSerialized, realignBoundaries?: boolean): string[];
declare function sentenceTokenizePunktCompat(text: string, model?: PunktModelSerialized): string[];
declare function defaultPunktModel(): PunktModelSerialized;
declare function serializePunktModel(model: PunktModelSerialized): string;
declare function parsePunktModel(payload: string | PunktModelSerialized): PunktModelSerialized;

type NgramOptions<P = null> = {
    pad_left?: boolean;
    pad_right?: boolean;
    left_pad_symbol?: P;
    right_pad_symbol?: P;
};
/** Lazy NLTK iterator semantics, with Rust-owned windows and JS object marshaling. */
declare function ngramsIterator<T, P = null>(sequence: Iterable<T>, n: number, options?: NgramOptions<P>): Generator<Array<T | P | null>, void, unknown>;

/** NLTK-compatible sentence tokenizer backed by the bundled English Punkt model. */
declare function sent_tokenize(text: string, language?: string): string[];
/** NLTK word tokenizer: Punkt sentences followed by the destructive word tokenizer. */
declare function word_tokenize(text: string, language?: string, preserve_line?: boolean): string[];
/** NLTK-compatible word-punctuation tokenizer. */
declare function wordpunct_tokenize(text: string): string[];
/** Materialized NLTK windows; preserves the existing array-returning API. */
declare function ngrams<T>(sequence: Iterable<T>, n: number): T[][];
declare function ngrams<T, P>(sequence: Iterable<T>, n: number, options: NgramOptions<P>): Array<Array<T | P | null>>;
declare function bigrams<T>(sequence: Iterable<T>): T[][];
declare function bigrams<T, P>(sequence: Iterable<T>, options: NgramOptions<P>): Array<Array<T | P | null>>;
declare function trigrams<T>(sequence: Iterable<T>): T[][];
declare function trigrams<T, P>(sequence: Iterable<T>, options: NgramOptions<P>): Array<Array<T | P | null>>;

export { MWETokenizer, PunktSentenceTokenizer, PunktSentenceTokenizerSubset, PunktTrainer, PunktTrainerSubset, ToktokTokenizer, TweetTokenizer, bigramWindowStatsAscii, bigramWindowStatsAsciiIds, bigrams, computeAsciiMetrics, countNgramsAscii, countTokensAscii, countUniqueNgramsAscii, countUniqueTokensAscii, defaultPunktModel, everygramsAscii, hashNgram, hashTokenAscii, mweTokenize, ngramFreqDistHashAscii, ngrams, ngramsAscii, ngramsIterator as ngrams_iter, normalizeTokensAscii, normalizeTokensUnicode, parsePunktModel, posTagAscii, sent_tokenize, sentenceTokenizePunkt, sentenceTokenizePunktCompat, sentenceTokenizeSubset, serializePunktModel, skipgramsAscii, tokenFreqDistHashAscii, tokenFreqDistIdsAscii, tokenizeAscii, toktokTokenize, topPmiBigramsAscii, trainPunktModel, trigrams, tweetTokenize, tweetTokenizeSubset, wordTokenizeSubset, word_tokenize, wordpunct_tokenize };
export type { AsciiMetrics, BigramWindowStatId, BigramWindowStatToken, NgramOptions, PmiBigram, PosTag, PosTagName, PunktModelSerialized, PunktTrainingOptions, SentenceTokenizerOptions, TokenFreqDistIds, TweetTokenizerOptions };
