import { WasmNltk } from './wasm.js';
export { type WasmNltkInit } from './wasm.js';
export { type GrammarSymbol, Nonterminal, Production, CFG as RustCFG, RustEarleyParser, type RustParseOptions, type RustParseResult, type RustTreeOrder, type RustTreePosition, type StringTree, Tree, type TreeFormatOptions, nonterminals } from './rust_parse.js';
export { type PositiveFeatureOptions, RustNaiveBayesClassifier, RustPositiveNaiveBayesClassifier } from './feature_nb.js';
export { type FeatureTreeOptions, RustDecisionTreeClassifier } from './feature_tree.js';
export { type a as FeatureMaxentOptions, type g as FeatureMaxentSerialized, R as RustMaxentClassifier } from './types/feature_maxent.d-DoqsStDs.js';
export { type BlanklineHandling, type TokenSpan } from './tokenizer_types.js';
export { BlanklineTokenizer, LineTokenizer, SpaceTokenizer, TabTokenizer, WhitespaceTokenizer, blanklineTokenize, blanklineTokenize as blankline_tokenize, lineTokenize, lineTokenize as line_tokenize } from './tokenizers_basic.js';
export { type FeatureSet, type FeatureValue, type LabeledFeatureset } from './feature_types.js';
export { ParsingRuntime } from './parsing_runtime.js';
export { TreebankWordDetokenizer, TreebankWordTokenizer, WordPunctTokenizer, treebankWordTokenize, wordPunctTokenize } from './tokenizers_treebank.js';
import './metrics_wasm.js';

type LanguageModelType = "mle" | "lidstone" | "laplace" | "kneser_ney_interpolated" | "stupid_backoff" | "witten_bell_interpolated" | "absolute_discounting_interpolated";
type NgramLanguageModelOptions = {
    order: number;
    model?: LanguageModelType;
    gamma?: number;
    discount?: number;
    alpha?: number;
    padLeft?: boolean;
    padRight?: boolean;
    startToken?: string;
    endToken?: string;
};
type LmProbe = {
    word: string;
    context?: string[];
};
/** Existing normalized-token contract; vocabulary/counts/smoothing/evaluation are Rust-owned. */
declare class NgramLanguageModel {
    readonly order: number;
    readonly model: LanguageModelType;
    readonly gamma: number;
    readonly discount: number;
    readonly alpha: number;
    readonly padLeft: boolean;
    readonly padRight: boolean;
    readonly startToken: string;
    readonly endToken: string;
    readonly vocabulary: string[];
    private readonly tokenToId;
    private readonly transport;
    private readonly handle;
    private readonly unknownId;
    private disposed;
    constructor(sentences: string[][], options: NgramLanguageModelOptions, runtime?: WasmNltk);
    private encodeToken;
    private evaluate;
    score(word: string, context?: string[]): number;
    logScore(word: string, context?: string[]): number;
    logscore(word: string, context?: string[]): number;
    perplexity(tokens: string[]): number;
    evaluateBatch(probes: LmProbe[], perplexityTokens: string[]): {
        scores: number[];
        perplexity: number;
    };
    dispose(): void;
}
/** Explicit-runtime portable surface: one shared artifact, no native imports or fallback. */
declare class RustNgramLanguageModel extends NgramLanguageModel {
    constructor(runtime: WasmNltk, sentences: string[][], options: NgramLanguageModelOptions);
}
declare function trainNgramLanguageModel(sentences: string[][], options: NgramLanguageModelOptions): NgramLanguageModel;

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
type PunktDebugDecision = {
    /** JavaScript UTF-16 index, unlike Python's code-point index. */
    period_index: number;
    text: string;
    type1: string;
    type2: string;
    type1_in_abbrs: boolean;
    type1_is_initial: boolean;
    type2_is_sent_starter: boolean;
    type2_ortho_heuristic: boolean | "unknown";
    type2_ortho_contexts: string[];
    collocation: boolean;
    reason: string;
    break_decision: boolean | null;
};
declare class PunktTrainerSubset {
    private readonly chunks;
    private options;
    private cached;
    train(text: string, options?: PunktTrainingOptions): this;
    finalize(): PunktModelSerialized;
    getParams(): PunktModelSerialized;
    get_params(): PunktModelSerialized;
}
declare class PunktTrainer extends PunktTrainerSubset {
    loadTrainText(text: string): this;
    load_train_text(text: string): this;
}
declare class PunktSentenceTokenizerSubset {
    protected model: PunktModelSerialized;
    constructor(model?: PunktModelSerialized);
    tokenize(text: string, realignBoundaries?: boolean): string[];
    /** UTF-16 offsets for the Rust NLTK inference model (version 2). */
    spanTokenize(text: string, realignBoundaries?: boolean): PunktSpan[];
    span_tokenize(text: string, realignBoundaries?: boolean): PunktSpan[];
    debugDecisions(text: string): PunktDebugDecision[];
    debug_decisions(text: string): PunktDebugDecision[];
    train(text: string, options?: PunktTrainingOptions): this;
    getParams(): PunktModelSerialized;
    get_params(): PunktModelSerialized;
}
declare class PunktSentenceTokenizer extends PunktSentenceTokenizerSubset {
    setParams(model: PunktModelSerialized): this;
    set_params(model: PunktModelSerialized): this;
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

export { MWETokenizer, NgramLanguageModel, PunktSentenceTokenizer, PunktSentenceTokenizerSubset, PunktTrainer, PunktTrainerSubset, RustNgramLanguageModel, ToktokTokenizer, TweetTokenizer, WasmNltk, bigramWindowStatsAscii, bigramWindowStatsAsciiIds, bigrams, computeAsciiMetrics, countNgramsAscii, countTokensAscii, countUniqueNgramsAscii, countUniqueTokensAscii, defaultPunktModel, everygramsAscii, hashNgram, hashTokenAscii, mweTokenize, ngramFreqDistHashAscii, ngrams, ngramsAscii, ngramsIterator as ngrams_iter, normalizeTokensAscii, normalizeTokensUnicode, parsePunktModel, posTagAscii, sent_tokenize, sentenceTokenizePunkt, sentenceTokenizePunktCompat, sentenceTokenizeSubset, serializePunktModel, skipgramsAscii, tokenFreqDistHashAscii, tokenFreqDistIdsAscii, tokenizeAscii, toktokTokenize, topPmiBigramsAscii, trainNgramLanguageModel, trainPunktModel, trainNgramLanguageModel as train_ngram_language_model, trigrams, tweetTokenize, tweetTokenizeSubset, wordTokenizeSubset, word_tokenize, wordpunct_tokenize };
export type { AsciiMetrics, BigramWindowStatId, BigramWindowStatToken, LanguageModelType, LmProbe, NgramLanguageModelOptions, NgramOptions, PmiBigram, PosTag, PosTagName, PunktDebugDecision, PunktModelSerialized, PunktTrainingOptions, SentenceTokenizerOptions, TokenFreqDistIds, TweetTokenizerOptions };
