import { W as WasmNltk, R as RegexpTokenizer } from './types/wasm.d-vEZU3EsV.js';
import { SocialTokenizerRequest } from './index.browser.js';
export { M as MWETokenizer, M as RustMWETokenizer, T as RustToktokTokenizer, a as RustTweetTokenizer, T as ToktokTokenizer, a as TweetTokenizer, type b as TweetTokenizerOptions, type c as WasmNltkInit, d as casualTokenize, d as casual_tokenize, m as mweTokenize, m as mwe_tokenize, r as reduce_lengthening, e as regexp_span_tokenize, f as regexp_tokenize, g as remove_handles, s as string_span_tokenize, t as toktokTokenize, t as toktok_tokenize, h as tweetTokenize, h as tweet_tokenize } from './types/wasm.d-vEZU3EsV.js';
import { RustNaiveBayesClassifier, PositiveFeatureOptions } from './feature_nb.js';
export { RustPositiveNaiveBayesClassifier } from './feature_nb.js';
import { P as ProbDistLike, F as FreqDist, D as DictionaryProbDist, B as BinaryMaxentFeatureEncoding, b as MaxentFeatureMapping, c as MaxentEncodingOptions, d as MaxentMappingValue, R as RustMaxentClassifier, e as FeatureMaxentOptions, C as ConditionalProbDist, f as ConditionalFreqDist } from './types/feature_maxent.d-CRSpef1Y.js';
import { MaxentFeatureset, MaxentEncodingExample } from './feature_maxent.js';
export { type g as ConditionalFreqDistInput, h as ConditionalProbDistI, i as DictionaryConditionalProbDist, E as ELEProbDist, type j as FeatureMaxentSerialized, type k as FreqDistInput, L as LaplaceProbDist, l as LidstoneProbDist, m as MLEProbDist, n as MutableProbDist, o as PYTHON_BOOL, p as PYTHON_FLOAT, q as PYTHON_INT, type r as ProbDistFactory, s as ProbDistI, t as RandomProbDist, S as SimpleGoodTuringProbDist, T as TypedMaxentFeatureEncoding, U as UniformProbDist, W as WittenBellProbDist, u as addLogs, u as add_logs, v as entropy, w as logLikelihood, w as log_likelihood, x as pythonFloat, x as python_float, y as sumLogs, y as sum_logs } from './types/feature_maxent.d-CRSpef1Y.js';
import { RustDecisionTreeClassifier, FeatureTreeOptions } from './feature_tree.js';
export { type LanguageModelType, LegacyMWETokenizer, LegacyToktokTokenizer, LegacyTweetTokenizer, type LmProbe, NgramLanguageModel, type NgramLanguageModelOptions, type NgramOptions, type PunktModelSerialized, PunktSentenceTokenizerSubset, PunktTrainerSubset, type PunktTrainingOptions, RustNgramLanguageModel, PunktSentenceTokenizer as WasmPunktSentenceTokenizer, PunktTrainer as WasmPunktTrainer, bigramWindowStatsAsciiIds as bigramWindowStatsAsciiIdsJs, bigramWindowStatsAscii as bigramWindowStatsAsciiJs, bigramWindowStatsAsciiIds as bigram_window_stats_ascii_ids_js, bigramWindowStatsAscii as bigram_window_stats_ascii_js, bigrams, computeAsciiMetrics as computeAsciiMetricsJs, computeAsciiMetrics as compute_ascii_metrics_js, countNgramsAscii as countNgramsAsciiJs, countTokensAscii as countTokensAsciiJs, countUniqueNgramsAscii as countUniqueNgramsAsciiJs, countUniqueTokensAscii as countUniqueTokensAsciiJs, countNgramsAscii as count_ngrams_ascii_js, countTokensAscii as count_tokens_ascii_js, countUniqueNgramsAscii as count_unique_ngrams_ascii_js, countUniqueTokensAscii as count_unique_tokens_ascii_js, defaultPunktModel, defaultPunktModel as default_punkt_model, everygramsAscii, everygramsAscii as everygrams_ascii, hashNgram, hashTokenAscii, hashNgram as hash_ngram, hashTokenAscii as hash_token_ascii, legacyMweTokenize, legacyToktokTokenize, legacyTweetTokenize, legacyMweTokenize as legacy_mwe_tokenize, legacyToktokTokenize as legacy_toktok_tokenize, legacyTweetTokenize as legacy_tweet_tokenize, ngramFreqDistHashAscii as ngramFreqDistHashAsciiJs, ngramFreqDistHashAscii as ngram_freq_dist_hash_ascii_js, ngrams, ngramsAscii, ngramsAscii as ngrams_ascii, ngrams_iter, normalizeTokensAscii, normalizeTokensUnicode, normalizeTokensAscii as normalize_tokens_ascii, normalizeTokensUnicode as normalize_tokens_unicode, parsePunktModel, parsePunktModel as parse_punkt_model, posTagAscii, posTagAscii as pos_tag_ascii, sent_tokenize, sentenceTokenizePunkt, sentenceTokenizePunktCompat, sentenceTokenizeSubset, sentenceTokenizePunkt as sentence_tokenize_punkt, sentenceTokenizePunktCompat as sentence_tokenize_punkt_compat, sentenceTokenizeSubset as sentence_tokenize_subset, serializePunktModel, serializePunktModel as serialize_punkt_model, skipgramsAscii, skipgramsAscii as skipgrams_ascii, tokenFreqDistHashAscii as tokenFreqDistHashAsciiJs, tokenFreqDistIdsAscii as tokenFreqDistIdsAsciiJs, tokenFreqDistHashAscii as token_freq_dist_hash_ascii_js, tokenFreqDistIdsAscii as token_freq_dist_ids_ascii_js, tokenizeAscii, tokenizeAscii as tokenize_ascii, topPmiBigramsAscii as topPmiBigramsAsciiJs, topPmiBigramsAscii as top_pmi_bigrams_ascii_js, trainNgramLanguageModel, trainPunktModel, trainNgramLanguageModel as train_ngram_language_model, trainPunktModel as train_punkt_model, trigrams, tweetTokenizeSubset, tweetTokenizeSubset as tweet_tokenize_subset, wordTokenizeSubset, word_tokenize, wordTokenizeSubset as word_tokenize_subset, wordpunct_tokenize } from './index.browser.js';
export { MacIntyreContractions, TreebankWordDetokenizer, TreebankWordTokenizer, WordPunctTokenizer, align_tokens, treebankWordTokenize, treebankWordTokenize as treebank_word_tokenize, wordPunctTokenize, wordPunctTokenize as word_punct_tokenize } from './tokenizers_treebank.js';
export { BlanklineTokenizer, LineTokenizer, SpaceTokenizer, TabTokenizer, WhitespaceTokenizer, blanklineTokenize, blanklineTokenize as blankline_tokenize, lineTokenize, lineTokenize as line_tokenize } from './tokenizers_basic.js';
export { type BlanklineHandling, type TokenSpan } from './tokenizer_types.js';
import { P as ParseTree, G as GrammarSymbol, N as Nonterminal, C as CFG, a as Production, b as CfgGrammar, c as PCFG, d as PcfgGrammar, e as ProbabilisticParse, T as Tree } from './types/rust_parse.d-Cheopg5Z.js';
export { type f as CfgProduction, D as DependencyGrammar, g as DependencyProduction, type h as PcfgProduction, i as ProbabilisticDependencyGrammar, j as ProbabilisticProduction, R as RustCFG, k as RustEarleyParser, type l as RustParseOptions, type m as RustParseResult, type n as RustTreeOrder, type o as RustTreePosition, type S as StringTree, type p as TreeFormatOptions, q as chartParse, q as chart_parse, r as earleyParse, s as earleyRecognize, r as earley_parse, s as earley_recognize, t as inducePcfg, u as induce_pcfg, v as invertGraph, v as invert_graph, w as isNonterminal, x as isTerminal, y as is_nonterminal, z as is_terminal, A as leftCornerParse, A as left_corner_parse, B as nonterminals, E as parseCfgGrammar, F as parsePcfgGrammar, H as parseTextWithCfg, I as parseTextWithEarley, J as parseTextWithLeftCorner, K as parseTextWithPcfg, L as parseTextWithRecursiveDescent, E as parse_cfg_grammar, F as parse_pcfg_grammar, H as parse_text_with_cfg, I as parse_text_with_earley, J as parse_text_with_left_corner, K as parse_text_with_pcfg, L as parse_text_with_recursive_descent, M as probabilisticChartParse, M as probabilistic_chart_parse, O as readGrammar, Q as read_grammar, U as recursiveDescentParse, U as recursive_descent_parse, V as standardNontermParser, W as standard_nonterm_parser, X as transitiveClosure, X as transitive_closure } from './types/rust_parse.d-Cheopg5Z.js';
import { ConfusionMatrix } from './confusion_metrics.js';
export { accuracy } from './confusion_metrics.js';
import { FeatureSet, LabeledFeatureset } from './feature_types.js';
export { type FeatureValue } from './feature_types.js';
export { type BleuPrecision, type BleuSmoothingContext, type BleuSmoothingFn, type BleuSmoothingResult, type BleuWeights, type ConfusionMatrixResult, type EditDistanceOptions, SmoothingFunction, brevityPenalty, closestRefLength, confusionMatrix, confusionMatrix as confusion_matrix, corpusBleu, editDistance, editDistance as edit_distance, modifiedPrecision, sentenceBleu, sentenceBleu as sentence_bleu } from './metrics.js';
export { type LabelSet, MAX_DISTANCE_INPUT_LEN, type ProbabilityMap, type Ranking, type Segmentation, approxrand, binaryDistance, binaryDistance as binary_distance, customDistance, customDistance as custom_distance, editDistanceAlign, editDistanceAlign as edit_distance_align, fMeasure, fMeasure as f_measure, fractionalPresence, fractionalPresence as fractional_presence, ghd, intervalDistance, intervalDistance as interval_distance, jaccardDistance, jaccardDistance as jaccard_distance, jaroSimilarity as jaro_similarity, jaroWinklerSimilarity as jaro_winkler_similarity, masiDistance, masiDistance as masi_distance, logLikelihood as metricsLogLikelihood, logLikelihood as metrics_log_likelihood, pk, precision, presence, ranksFromScores, ranksFromSequence, ranksFromScores as ranks_from_scores, ranksFromSequence as ranks_from_sequence, recall, sorensenDiceDistance, sorensenDiceSimilarity, sorensenDiceDistance as sorensen_dice_distance, sorensenDiceSimilarity as sorensen_dice_similarity, spearmanCorrelation, spearmanCorrelation as spearman_correlation, windowdiff } from './distance_metrics.js';
export { type ChrFOptions, type NistOptions, chrfPrecisionRecallFscoreSupport as chrf_precision_recall_fscore_support, corpusChrF, corpusNist, corpusChrF as corpus_chr_f, corpusChrF as corpus_chrf, corpusNist as corpus_nist, nistLengthPenalty, nistLengthPenalty as nist_length_penalty, sentenceChrF, sentenceNist, sentenceChrF as sentence_chr_f, sentenceChrF as sentence_chrf, sentenceNist as sentence_nist } from './translation_metrics_extra.js';
import { ParsingRuntime } from './parsing_runtime.js';
import './metrics_wasm.js';

/** NLTK intentionally returns None for unseen values when Nr(0) is zero. */
declare class HeldoutProbDist<T> {
    readonly SUM_TO_ONE = false;
    private readonly base;
    private readonly held;
    private readonly countEstimates;
    private readonly maxCount;
    private readonly unseen;
    constructor(base: FreqDist<T>, held: FreqDist<T>, bins?: number | null);
    base_fdist(): FreqDist<T>;
    heldout_fdist(): FreqDist<T>;
    prob(sample: T): number | null;
    logprob(sample: T): number;
    logProb(sample: T): number;
    samples(): Iterable<T>;
    max(): T;
    discount(): never;
    toString(): string;
}
declare abstract class CrossValidationProbDist<T> implements ProbDistLike<T> {
    readonly SUM_TO_ONE = false;
    private readonly estimates;
    private readonly unseen;
    private readonly noPairs;
    private readonly sampleValues;
    private readonly distributions;
    constructor(freqdists: Iterable<FreqDist<T>>, bins: number | null);
    freqdists(): FreqDist<T>[];
    prob(sample: T): number;
    logprob(sample: T): number;
    logProb(sample: T): number;
    samples(): Iterable<T>;
    abstract max(): T;
    discount(): never;
    toString(): string;
}
type Trigram<T> = readonly [T, T, T];
declare class KneserNeyProbDist<T> implements ProbDistLike<Trigram<T>> {
    readonly SUM_TO_ONE = true;
    private readonly symbols;
    private readonly freqdist;
    private readonly handle;
    private disposed;
    private discountValue;
    constructor(freqdist: FreqDist<Trigram<T>>, _bins?: number | null, discount?: number);
    private ids;
    prob(trigram: Trigram<T>): number;
    logprob(sample: Trigram<T>): number;
    logProb(sample: Trigram<T>): number;
    discount(): number;
    set_discount(value: number): void;
    samples(): Iterable<Trigram<T>>;
    max(): Trigram<T>;
    dispose(): void;
    toString(): string;
}

declare function countTokensAscii(text: string): number;
declare function countTokensAsciiScalar(text: string): number;
declare function countUniqueTokensAscii(text: string): number;
declare function countNgramsAscii(text: string, n: number): number;
type AsciiMetrics = {
    tokens: number;
    uniqueTokens: number;
    ngrams: number;
    uniqueNgrams: number;
};
declare function computeAsciiMetrics(text: string, n: number): AsciiMetrics;
declare function countUniqueNgramsAscii(text: string, n: number): number;
declare function tokenFreqDistHashAscii(text: string): Map<bigint, number>;
declare function ngramFreqDistHashAscii(text: string, n: number): Map<bigint, number>;
declare function tokenizeAsciiNative(text: string): string[];
declare function sentenceTokenizePunktAsciiNative(text: string): string[];
declare function countNormalizedTokensAscii(text: string, removeStopwords?: boolean): number;
declare function countNormalizedTokensAsciiScalar(text: string, removeStopwords?: boolean): number;
declare function normalizeTokensAsciiNative(text: string, removeStopwords?: boolean): string[];
declare function ngramsAsciiNative(text: string, n: number): string[][];
declare function everygramsAsciiNative(text: string, minLen?: number, maxLen?: number): string[][];
declare function skipgramsAsciiNative(text: string, n: number, k: number): string[][];
declare const POS_TAG_NAMES: readonly ["NN", "NNP", "CD", "VBG", "VBD", "RB", "DT", "CC", "PRP", "VB"];
type PosTagName = (typeof POS_TAG_NAMES)[number];
type PosTag = {
    token: string;
    tag: PosTagName;
    tagId: number;
    start: number;
    length: number;
};
declare function posTagAsciiNative(text: string): PosTag[];
declare function perceptronPredictBatchNative(featureIds: Uint32Array, tokenOffsets: Uint32Array, weights: Float32Array, modelFeatureCount: number, tagCount: number): Uint16Array;
type PmiBigram = {
    leftHash: bigint;
    rightHash: bigint;
    score: number;
};
declare function topPmiBigramsAscii(text: string, topK: number, windowSize?: number): PmiBigram[];
type TokenFreqDistIds = {
    tokens: string[];
    counts: number[];
    tokenToId: Map<string, number>;
    totalTokens: number;
};
declare function tokenFreqDistIdsAscii(text: string): TokenFreqDistIds;
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
declare function bigramWindowStatsAsciiIds(text: string, windowSize?: number): BigramWindowStatId[];
declare function bigramWindowStatsAscii(text: string, windowSize?: number): BigramWindowStatToken[];
declare function porterStemAscii(token: string): string;
declare function wordnetMorphyAsciiNative(word: string, pos?: "n" | "v" | "a" | "r"): string;
type NativeLmModelType = "mle" | "lidstone" | "kneser_ney_interpolated";
declare function evaluateLanguageModelIdsNative(input: {
    tokenIds: Uint32Array;
    sentenceOffsets: Uint32Array;
    order: number;
    model: NativeLmModelType;
    gamma: number;
    discount: number;
    vocabSize: number;
    probeContextFlat: Uint32Array;
    probeContextLens: Uint32Array;
    probeWordIds: Uint32Array;
    perplexityTokenIds: Uint32Array;
    prefixTokenIds: Uint32Array;
}): {
    scores: Float64Array;
    perplexity: number;
};
declare function chunkIobIdsNative(input: {
    tokenTagIds: Uint16Array;
    atomAllowedOffsets: Uint32Array;
    atomAllowedLengths: Uint32Array;
    atomAllowedFlat: Uint16Array;
    atomMins: Uint8Array;
    atomMaxs: Uint8Array;
    ruleAtomOffsets: Uint32Array;
    ruleAtomCounts: Uint32Array;
    ruleLabelIds: Uint16Array;
}): {
    labelIds: Uint16Array;
    begins: Uint8Array;
};
declare function cykRecognizeIdsNative(input: {
    tokenBits: BigUint64Array;
    binaryLeft: Uint16Array;
    binaryRight: Uint16Array;
    binaryParent: Uint16Array;
    unaryChild: Uint16Array;
    unaryParent: Uint16Array;
    startSymbol: number;
}): boolean;
declare function naiveBayesLogScoresIdsNative(input: {
    docTokenIds: Uint32Array;
    vocabSize: number;
    tokenCountsMatrix: Uint32Array;
    labelDocCounts: Uint32Array;
    labelTokenTotals: Uint32Array;
    totalDocs: number;
    smoothing: number;
}): Float64Array;
declare function linearScoresSparseIdsNative(input: {
    docOffsets: Uint32Array;
    featureIds: Uint32Array;
    featureValues: Float64Array;
    classCount: number;
    featureCount: number;
    weights: Float64Array;
    bias: Float64Array;
}): Float64Array;
type NativeLinearTrainingAlgorithm = "logistic" | "svm";
declare function linearTrainSparseIdsNative(input: {
    docOffsets: Uint32Array;
    featureIds: Uint32Array;
    featureValues: Float64Array;
    labelIds: Uint32Array;
    classCount: number;
    featureCount: number;
    algorithm: NativeLinearTrainingAlgorithm;
    epochs: number;
    learningRate: number;
    l2: number;
    margin?: number;
}): {
    weights: Float64Array;
    bias: Float64Array;
};
type NativeLinearTextModel = {
    vocabulary: string[];
    weights: Float64Array;
    bias: Float64Array;
};
declare function linearTextTrainNative(input: {
    texts: readonly string[];
    labelIds: Uint32Array;
    classCount: number;
    ngramMin: number;
    ngramMax: number;
    binary: boolean;
    maxFeatures: number;
    algorithm: NativeLinearTrainingAlgorithm;
    epochs: number;
    learningRate: number;
    l2: number;
    margin?: number;
}): NativeLinearTextModel;
declare function hmmViterbiIdsNative(input: {
    symbolIds: Uint32Array;
    stateCount: number;
    symbolCount: number;
    priors: Float32Array;
    transitions: Float32Array;
    outputs: Float32Array;
}): Uint32Array;
declare function kmeansFitEuclideanNative(input: {
    vectors: Float64Array;
    pointCount: number;
    dimensions: number;
    clusterCount: number;
    convergence: number;
    avoidEmptyClusters: boolean;
    initialMeans: Float64Array;
    maxIterations?: number;
}): {
    means: Float64Array;
    iterations: number;
};
declare function porterStemAsciiTokens(tokens: string[]): string[];
type StreamBigramFreq = {
    leftHash: bigint;
    rightHash: bigint;
    count: number;
};
type StreamConditionalFreq = {
    tagId: number;
    tokenHash: bigint;
    count: number;
};
declare class NativeFreqDistStream {
    private handle;
    private disposed;
    constructor();
    private ensureOpen;
    update(text: string): void;
    flush(): void;
    tokenUniqueCount(): number;
    bigramUniqueCount(): number;
    conditionalUniqueCount(): number;
    tokenFreqDistHash(): Map<bigint, number>;
    bigramFreqDistHash(): StreamBigramFreq[];
    conditionalFreqDistHash(): StreamConditionalFreq[];
    toJson(): string;
    dispose(): void;
}
declare function nativeLibraryPath(): string;
/** JSON transport for the Rust tokenizer kernels; mirrors the WASM tokenizer
 * ABI, where a failed request still produces a JSON-encoded error string and
 * the last-error code is nonzero. The code must be read before the follow-up
 * calls, since every export resets it on entry. */
declare function tokenizerRequestNative(request: unknown): unknown;
declare function socialTokenizerNative(request: SocialTokenizerRequest): string[] | string;
/** True only when Bun can dlopen a native library exporting the tokenizer ABI. */
declare function nativeTokenizerAvailable(): boolean;

declare class PunktLanguageVars {
    sent_end_chars: string[];
    internal_punctuation: string;
    re_boundary_realignment: RegExp;
    get _re_sent_end_chars(): string;
    _re_word_start: string;
    get _re_non_word_chars(): string;
    _re_multi_char_punct: string;
    private _re_word_tokenizer?;
    _word_tokenizer_re(): RegExp;
    word_tokenize(s: string): string[];
    private _re_period_context?;
    period_context_re(): RegExp;
}
declare class PunktParameters {
    abbrev_types: Set<string>;
    collocations: Set<string>;
    sent_starters: Set<string>;
    ortho_context: Map<string, number>;
    clear_abbrevs(): void;
    clear_collocations(): void;
    clear_sent_starters(): void;
    clear_ortho_context(): void;
    add_ortho_context(typ: string, flag: number): void;
    _debug_ortho_context(typ: string): Generator<string>;
}
declare class PunktToken {
    static readonly _properties: readonly ["parastart", "linestart", "sentbreak", "abbr", "ellipsis"];
    tok: string;
    type: string;
    period_final: boolean;
    parastart: boolean | null;
    linestart: boolean | null;
    sentbreak: boolean | null;
    abbr: boolean | null;
    ellipsis: boolean | null;
    constructor(tok: string, params?: Record<string, boolean>);
    get type_no_period(): string;
    get type_no_sentperiod(): string;
    get first_upper(): boolean;
    get first_lower(): boolean;
    get first_case(): string;
    get is_ellipsis(): boolean;
    get is_number(): boolean;
    get is_initial(): boolean;
    get is_alpha(): boolean;
    get is_non_punct(): boolean;
    repr(): string;
    toString(): string;
}
declare class PunktBaseClass {
    protected _params: PunktParameters;
    protected _lang_vars: PunktLanguageVars;
    protected _Token: typeof PunktToken;
    constructor(lang_vars?: PunktLanguageVars, token_cls?: typeof PunktToken, params?: PunktParameters);
    _tokenize_words(plaintext: string): Generator<PunktToken>;
    _annotate_first_pass(tokens: Iterable<PunktToken>): Generator<PunktToken>;
    _first_pass_annotation(aug_tok: PunktToken): void;
}
declare class PunktTrainer extends PunktBaseClass {
    protected _type_fdist: FreqDist<string | null>;
    protected _num_period_toks: number;
    protected _collocation_fdist: FreqDist<string | null>;
    protected _sent_starter_fdist: FreqDist<string | null>;
    protected _sentbreak_count: number;
    protected _finalized: boolean;
    ABBREV: number;
    IGNORE_ABBREV_PENALTY: boolean;
    ABBREV_BACKOFF: number;
    COLLOCATION: number;
    SENT_STARTER: number;
    INCLUDE_ALL_COLLOCS: boolean;
    INCLUDE_ABBREV_COLLOCS: boolean;
    MIN_COLLOC_FREQ: number;
    constructor(train_text?: string, verbose?: boolean, lang_vars?: PunktLanguageVars, token_cls?: typeof PunktToken);
    get_params(): PunktParameters;
    getParams(): PunktParameters;
    train(text: string, verbose?: boolean, finalize?: boolean): void;
    train_tokens(tokens: Iterable<string>, verbose?: boolean, finalize?: boolean): void;
    trainTokens(tokens: Iterable<string>, verbose?: boolean, finalize?: boolean): void;
    _train_tokens(tokens: PunktToken[], verbose: boolean): void;
    _unique_types(tokens: PunktToken[]): Set<string>;
    finalize_training(verbose?: boolean): void;
    finalizeTraining(verbose?: boolean): void;
    freq_threshold(ortho_thresh?: number, type_thresh?: number, colloc_thres?: number, sentstart_thresh?: number): void;
    freqThreshold(ortho_thresh?: number, type_thresh?: number, colloc_thres?: number, sentstart_thresh?: number): void;
    _freq_threshold(fdist: FreqDist<string | null>, threshold: number): FreqDist<string | null>;
    _get_orthography_data(tokens: PunktToken[]): void;
    _reclassify_abbrev_types(types: Iterable<string>): Generator<[string, number, boolean]>;
    find_abbrev_types(): void;
    findAbbrevTypes(): void;
    _is_rare_abbrev_type(cur_tok: PunktToken, next_tok: PunktToken): boolean;
    static _dunning_log_likelihood(count_a: number, count_b: number, count_ab: number, N: number): number;
    static _col_log_likelihood(count_a: number, count_b: number, count_ab: number, N: number): number;
    _is_potential_collocation(aug_tok1: PunktToken, aug_tok2: PunktToken): boolean;
    _find_collocations(): Generator<[string, number]>;
    _is_potential_sent_starter(cur_tok: PunktToken, prev_tok: PunktToken): boolean;
    _find_sent_starters(): Generator<[string, number]>;
    _get_sentbreak_count(tokens: Iterable<PunktToken>): number;
}
type Span = [number, number];
type EndContextMatch = {
    start: number;
    end: number;
    text: string;
    after_tok: string;
    next_tok_start: number;
};
declare class PunktSentenceTokenizer extends PunktBaseClass {
    constructor(train_text?: string | PunktParameters, verbose?: boolean, lang_vars?: PunktLanguageVars, token_cls?: typeof PunktToken);
    train(train_text: string | PunktParameters, verbose?: boolean): PunktParameters;
    get _params_accessor(): PunktParameters;
    get params(): PunktParameters;
    tokenize(text: string, realign_boundaries?: boolean): string[];
    debug_decisions(text: string): Generator<Record<string, unknown>>;
    span_tokenize(text: string, realign_boundaries?: boolean): Generator<Span>;
    spanTokenize(text: string, realign_boundaries?: boolean): Span[];
    sentences_from_text(text: string, realign_boundaries?: boolean): string[];
    sentencesFromText(text: string, realign_boundaries?: boolean): string[];
    _get_last_whitespace_index(text: string): number;
    _match_potential_end_contexts(text: string): Generator<[EndContextMatch, string]>;
    _slices_from_text(text: string): Generator<Span>;
    _realign_boundaries(text: string, slices: Iterable<Span>): Generator<Span>;
    text_contains_sentbreak(text: string): boolean;
    textContainsSentbreak(text: string): boolean;
    sentences_from_text_legacy(text: string): Generator<string>;
    sentences_from_tokens(tokens: Iterable<string>): Generator<string[]>;
    _annotate_tokens(tokens: Iterable<PunktToken>): Generator<PunktToken>;
    _build_sentence_list(text: string, tokens: Iterable<PunktToken>): Generator<string>;
    dump(tokens: Iterable<PunktToken>): void;
    PUNCTUATION: string[];
    _annotate_second_pass(tokens: Iterable<PunktToken>): Generator<PunktToken>;
    _second_pass_annotation(aug_tok1: PunktToken, aug_tok2: PunktToken | null): string | undefined;
    _ortho_heuristic(aug_tok: PunktToken): boolean | "unknown";
    tokenize_sents(strings: readonly string[]): string[][];
    span_tokenize_sents(strings: readonly string[]): Generator<Span[]>;
}
declare class PunktTokenizer extends PunktSentenceTokenizer {
    private _lang;
    constructor(lang?: string);
    load_lang(lang?: string): void;
    loadLang(lang?: string): void;
    save_params(): void;
    saveParams(): void;
}
declare function load_punkt_params(lang_dir: string): PunktParameters;
declare function loadPunktParams(lang_dir: string): PunktParameters;
declare function save_punkt_params(params: PunktParameters, dir?: string): void;
declare function savePunktParams(params: PunktParameters, dir?: string): void;
declare function format_debug_decision(d: Record<string, unknown>): string;

type NormalizeOptions = {
    removeStopwords?: boolean;
    preferNativeAscii?: boolean;
    stem?: boolean;
};
declare function normalizeTokens(text: string, options?: NormalizeOptions): string[];

type TaggedToken$5 = {
    token: string;
    tag: string;
};
type ChunkNode = {
    kind: "chunk";
    label: string;
    tokens: TaggedToken$5[];
};
type ChunkElement = TaggedToken$5 | ChunkNode;
declare function regexpChunkParse(tokens: TaggedToken$5[], grammar: string): ChunkElement[];
type IobRow$1 = {
    token: string;
    tag: string;
    iob: string;
};
declare function chunkTreeToIob(tree: ChunkElement[]): IobRow$1[];

/**
 * Default rule grammar approximating NLTK's NE categories. Rules are applied
 * in order, so earlier (more specific) rules win:
 *
 * - ORGANIZATION: plural proper-noun heads (Corporations, Agencies)
 * - PERSON: runs of two or more singular proper nouns (first + last name)
 * - GPE: a single remaining singular proper noun (most single proper nouns
 *   in news text are geopolitical entities: countries, cities)
 * - LOCATION: adjective + proper noun ("Northern Ireland")
 * - MONEY / PERCENT / DATE: numeric expressions
 */
declare const DEFAULT_NE_GRAMMAR = "\nORGANIZATION: {<NNP><NNPS>|<NNPS>+}\nPERSON:       {<NNP><NNP>+}\nLOCATION:     {<JJ><NNP>+}\nGPE:          {<NNP>}\nMONEY:        {<$><CD>}\nPERCENT:      {<CD><%>}\n";
type NeChunkOptions = {
    /** Use an explicit rule grammar instead of the statistical model (RegexpParser syntax). */
    grammar?: string;
    /**
     * When true, use NLTK’s separately trained binary model with `NE` labels,
     * matching `ne_chunk(sentence, binary=True)`.
     */
    binary?: boolean;
};
/** Group tagged tokens into NE chunks (labeled nodes), NLTK `ne_chunk` style. */
declare function neChunk(taggedSentence: TaggedToken$5[], options?: NeChunkOptions): ChunkElement[];
type NeIobTuple = [word: string, pos: string, ne: string];
/** IOB-tagged view of the NE chunks: Array<[word, pos, ne]> with B-/I-/O tags. */
declare function neChunkIob(taggedSentence: TaggedToken$5[], options?: NeChunkOptions): NeIobTuple[];

type TextCatOptions = {
    /** Language name/code -> sample texts used to train that language's profile. */
    languages: Record<string, string[]>;
};
type LanguageDistance = {
    language: string;
    distance: number;
};
declare class TextCat {
    readonly fingerprints: Map<string, Map<string, number>>;
    lastDistances: Record<string, number>;
    constructor(options: TextCatOptions);
    /** Create frequency distribution of trigrams within text (NLTK `profile`). */
    profile(text: string): Map<string, number>;
    /**
     * Out-of-place measure between the text and one language profile
     * (NLTK `calc_dist`, using the rank-precomputation optimization NLTK added).
     */
    calcDist(langRanks: Map<string, number>, textRanks: Map<string, number>, trigram: string): number;
    /** Distances between the text and all trained languages (NLTK `lang_dists`). */
    langDists(text: string): Record<string, number>;
    /**
     * Most likely language for the text. Returns null/[] when ambiguous or
     * unclassifiable, mirroring `guess_language` semantics.
     */
    guessLanguage(text: string, returnAll?: boolean): string | null | string[];
}

/**
 * ParentedTree / ImmutableTree subset (nltk.tree).
 *
 * NLTK's ParentedTree keeps a `_parent` pointer and the node's index within
 * its parent, enabling O(1) `parent()`, `left_sibling()`, `right_sibling()`
 * and `root()` lookups. This port wraps the same {label, children} tree node
 * shape used by ./tree_transforms ({label, children: Array<Tree|string>}).
 *
 * ImmutableTree freezes the structure: any mutation attempt throws.
 */

type TreePosition$1 = number[];
type TreePositionsOrder = "preorder" | "postorder" | "leaves";
declare class ParentedTree {
    label: string;
    readonly children: Array<ParentedTree | string>;
    protected _parent: ParentedTree | null;
    protected _index: number;
    constructor(label: string, children?: Array<ParentedTree | string>, parent?: ParentedTree | null, index?: number);
    /** Build a ParentedTree hierarchy from a plain {label, children} tree. */
    static from(tree: ParseTree, parent?: ParentedTree | null, index?: number): ParentedTree;
    parent(): ParentedTree | null;
    /** Index of this node among its parent's children (root is -1). */
    index(): number;
    root(): ParentedTree;
    leftSibling(): ParentedTree | string | null;
    rightSibling(): ParentedTree | string | null;
    /**
     * Positions (index paths from this node) of every subtree, like
     * `Tree.treepositions`. Strings are leaves in our representation and are not
     * subtrees, so they only appear under order="leaves".
     */
    treepositions(order?: TreePositionsOrder): TreePosition$1[];
    /** Convert back to the plain {label, children} shape of ./tree_transforms. */
    toPlain(): ParseTree;
    setLabel(label: string): void;
    insertChild(index: number, child: ParentedTree | string): void;
    removeChild(index: number): ParentedTree | string;
    protected _reindex(): void;
}
/** A frozen tree: structural mutations throw. */
declare class ImmutableTree extends ParentedTree {
    private static assertMutable;
    static from(tree: ParseTree, parent?: ParentedTree | null, index?: number): ImmutableTree;
    setLabel(_label: string): never;
    insertChild(_index: number, _child: ParentedTree | string): never;
    removeChild(_index: number): never;
}

type BigramScoreFn<_T> = (n_ii: number, marginals: [number, number], total: number) => number;
type TrigramScoreFn<_T> = (n_iii: number, bigramMarginals: [number, number, number], unigramMarginals: [number, number, number], total: number) => number;
type QuadgramScoreFn<_T> = (n_iiii: number, trigramMarginals: [number, number, number, number], bigramMarginals: [number, number, number, number, number, number], unigramMarginals: [number, number, number, number], total: number) => number;
declare class BigramAssocMeasures {
    static _contingency(n_ii: number, [n_ix, n_xi]: [number, number], n_xx: number): [number, number, number, number];
    static _marginals(n_ii: number, n_oi: number, n_io: number, n_oo: number): [number, [number, number], number];
    static raw_freq(n_ii: number, _marginals: [number, number], n_xx: number): number;
    static student_t(n_ii: number, marginals: [number, number], n_xx: number): number;
    static mi_like(n_ii: number, marginals: [number, number], _n_xx: number, options?: {
        power?: number;
    }): number;
    static pmi(n_ii: number, marginals: [number, number], n_xx: number): number;
    static likelihood_ratio(n_ii: number, marginals: [number, number], n_xx: number): number;
    static poisson_stirling(n_ii: number, marginals: [number, number], n_xx: number): number;
    static jaccard(n_ii: number, marginals: [number, number], n_xx: number): number;
    static phi_sq(n_ii: number, marginals: [number, number], n_xx: number): number;
    static chi_sq(n_ii: number, marginals: [number, number], n_xx: number): number;
    static dice(n_ii: number, [n_ix, n_xi]: [number, number], _n_xx: number): number;
    static fisher(_n_ii: number, _marginals: [number, number], _n_xx: number): never;
    static _expected_values([n_ii, n_oi, n_io, n_oo]: [number, number, number, number]): [number, number, number, number];
}
declare class TrigramAssocMeasures {
    static _contingency(n_iii: number, [n_iix, n_ixi, n_xii]: [number, number, number], [n_ixx, n_xix, n_xxi]: [number, number, number], n_xxx: number): [number, number, number, number, number, number, number, number];
    static _marginals(n_iii: number, n_oii: number, n_ioi: number, n_ooi: number, n_iio: number, n_oio: number, n_ioo: number, n_ooo: number): [number, [number, number, number], [number, number, number], number];
    static raw_freq(n_iii: number, _bigramMarginals: [number, number, number], _unigramMarginals: [number, number, number], n_xxx: number): number;
    static student_t(n_iii: number, _bigramMarginals: [number, number, number], unigramMarginals: [number, number, number], n_xxx: number): number;
    static mi_like(n_iii: number, _bigramMarginals: [number, number, number], unigramMarginals: [number, number, number], _n_xxx: number, options?: {
        power?: number;
    }): number;
    static pmi(n_iii: number, _bigramMarginals: [number, number, number], unigramMarginals: [number, number, number], n_xxx: number): number;
    static likelihood_ratio(n_iii: number, bigramMarginals: [number, number, number], unigramMarginals: [number, number, number], n_xxx: number): number;
    static poisson_stirling(n_iii: number, _bigramMarginals: [number, number, number], unigramMarginals: [number, number, number], n_xxx: number): number;
    static jaccard(n_iii: number, bigramMarginals: [number, number, number], unigramMarginals: [number, number, number], n_xxx: number): number;
}
declare class QuadgramAssocMeasures {
    static _contingency(n_iiii: number, [n_iiix, n_iixi, n_ixii, n_xiii]: [number, number, number, number], [n_iixx, n_ixix, n_ixxi, n_xixi, n_xxii, n_xiix]: [number, number, number, number, number, number], [n_ixxx, n_xixx, n_xxix, n_xxxi]: [number, number, number, number], n_xxxx: number): number[];
    static _marginals(...contingency: [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number
    ]): [number, [number, number, number, number], [number, number, number, number, number, number], [number, number, number, number], number];
    static raw_freq(n_iiii: number, _trigramMarginals: [number, number, number, number], _bigramMarginals: [number, number, number, number, number, number], _unigramMarginals: [number, number, number, number], n_all: number): number;
    static student_t(n_iiii: number, _trigramMarginals: [number, number, number, number], _bigramMarginals: [number, number, number, number, number, number], unigramMarginals: [number, number, number, number], n_all: number): number;
    static mi_like(n_iiii: number, _trigramMarginals: [number, number, number, number], _bigramMarginals: [number, number, number, number, number, number], unigramMarginals: [number, number, number, number], _n_all: number, options?: {
        power?: number;
    }): number;
    static pmi(n_iiii: number, _trigramMarginals: [number, number, number, number], _bigramMarginals: [number, number, number, number, number, number], unigramMarginals: [number, number, number, number], n_all: number): number;
    static likelihood_ratio(n_iiii: number, trigramMarginals: [number, number, number, number], bigramMarginals: [number, number, number, number, number, number], unigramMarginals: [number, number, number, number], n_all: number): number;
    static poisson_stirling(n_iiii: number, _trigramMarginals: [number, number, number, number], _bigramMarginals: [number, number, number, number, number, number], unigramMarginals: [number, number, number, number], n_all: number): number;
    static jaccard(n_iiii: number, trigramMarginals: [number, number, number, number], bigramMarginals: [number, number, number, number, number, number], unigramMarginals: [number, number, number, number], n_all: number): number;
}
declare class BigramCollocationFinder<T = string> {
    #private;
    readonly wordFd: FreqDist<T>;
    ngramFd: FreqDist<[T, T]>;
    readonly windowSize: number;
    static readonly default_ws = 2;
    readonly N: number;
    constructor(wordFd: FreqDist<T>, ngramFd: FreqDist<[T, T]>, windowSize?: number);
    static fromWords<T>(words: Iterable<T>, windowSize?: number): BigramCollocationFinder<T>;
    static fromDocuments<T>(documents: Iterable<Iterable<T>>, windowSize?: number): BigramCollocationFinder<T>;
    static fromTextAscii(text: string, options?: {
        windowSize?: number;
        native?: boolean;
    }): BigramCollocationFinder<string>;
    applyFreqFilter(minFreq: number): this;
    applyNgramFilter(fn: (left: T, right: T) => boolean): this;
    applyWordFilter(fn: (word: T) => boolean): this;
    scoreNgram(scoreFn: BigramScoreFn<T>, left: T, right: T): number | null;
    get word_fd(): FreqDist<T>;
    get ngram_fd(): FreqDist<[T, T]>;
    set ngram_fd(value: FreqDist<[T, T]>);
    get window_size(): number;
    scoreNgrams(scoreFn: BigramScoreFn<T>): Array<[[T, T], number]>;
    score_ngrams(scoreFn: BigramScoreFn<T>): Array<[[T, T], number]>;
    score_ngram(scoreFn: BigramScoreFn<T>, left: T, right: T): number | null;
    nbest(scoreFn: BigramScoreFn<T>, count: number): Array<[T, T]>;
    aboveScore(scoreFn: BigramScoreFn<T>, minScore: number): IterableIterator<[T, T]>;
    above_score(scoreFn: BigramScoreFn<T>, minScore: number): IterableIterator<[T, T]>;
    apply_freq_filter(minFreq: number): this;
    apply_ngram_filter(fn: (left: T, right: T) => boolean): this;
    apply_word_filter(fn: (word: T) => boolean): this;
    static from_words<T>(words: Iterable<T>, windowSize?: number): BigramCollocationFinder<T>;
    static from_documents<T>(documents: Iterable<Iterable<T>>): BigramCollocationFinder<T>;
}
declare class TrigramCollocationFinder<T = string> {
    #private;
    readonly wordFd: FreqDist<T>;
    readonly bigramFd: FreqDist<[T, T]>;
    readonly wildcardFd: FreqDist<[T, T]>;
    ngramFd: FreqDist<[T, T, T]>;
    static readonly default_ws = 3;
    readonly N: number;
    constructor(wordFd: FreqDist<T>, bigramFd: FreqDist<[T, T]>, wildcardFd: FreqDist<[T, T]>, ngramFd: FreqDist<[T, T, T]>);
    static fromWords<T>(words: Iterable<T>, windowSize?: number): TrigramCollocationFinder<T>;
    bigramFinder(): BigramCollocationFinder<T>;
    applyFreqFilter(minFreq: number): this;
    applyNgramFilter(fn: (w1: T, w2: T, w3: T) => boolean): this;
    applyWordFilter(fn: (word: T) => boolean): this;
    scoreNgram(scoreFn: TrigramScoreFn<T>, w1: T, w2: T, w3: T): number | null;
    scoreNgrams(scoreFn: TrigramScoreFn<T>): Array<[[T, T, T], number]>;
    nbest(scoreFn: TrigramScoreFn<T>, count: number): Array<[T, T, T]>;
    aboveScore(scoreFn: TrigramScoreFn<T>, minScore: number): IterableIterator<[T, T, T]>;
}
declare class QuadgramCollocationFinder<T = string> {
    #private;
    readonly wordFd: FreqDist<T>;
    ngramFd: FreqDist<[T, T, T, T]>;
    readonly ii: FreqDist<[T, T]>;
    readonly iii: FreqDist<[T, T, T]>;
    readonly ixi: FreqDist<[T, T]>;
    readonly ixxi: FreqDist<[T, T]>;
    readonly iixi: FreqDist<[T, T, T]>;
    readonly ixii: FreqDist<[T, T, T]>;
    static readonly default_ws = 4;
    readonly N: number;
    constructor(wordFd: FreqDist<T>, ngramFd: FreqDist<[T, T, T, T]>, ii: FreqDist<[T, T]>, iii: FreqDist<[T, T, T]>, ixi: FreqDist<[T, T]>, ixxi: FreqDist<[T, T]>, iixi: FreqDist<[T, T, T]>, ixii: FreqDist<[T, T, T]>);
    static fromWords<T>(words: Iterable<T>, windowSize?: number): QuadgramCollocationFinder<T>;
    applyFreqFilter(minFreq: number): this;
    applyWordFilter(fn: (word: T) => boolean): this;
    applyNgramFilter(fn: (w1: T, w2: T, w3: T, w4: T) => boolean): this;
    scoreNgram(scoreFn: QuadgramScoreFn<T>, w1: T, w2: T, w3: T, w4: T): number | null;
    scoreNgrams(scoreFn: QuadgramScoreFn<T>): Array<[[T, T, T, T], number]>;
    nbest(scoreFn: QuadgramScoreFn<T>, count: number): Array<[T, T, T, T]>;
    aboveScore(scoreFn: QuadgramScoreFn<T>, minScore: number): IterableIterator<[T, T, T, T]>;
}

/**
 * NLTK processing-interface ABCs, ported from nltk.tokenize.api,
 * nltk.stem.api, nltk.tag.api, nltk.parse.api, nltk.classify.api and
 * nltk.probability. Each class replicates Python's "delegates to the
 * overridden sibling method" contract via prototype comparison.
 */
type TaggedToken$4<S = string, T = string> = [S, T];
declare abstract class StemmerI {
    /** Strip affixes from the token and return the stem. */
    abstract stem(token: string): string;
}
declare abstract class TokenizerI {
    /** Return a tokenized copy of `s`. */
    tokenize(s: string): string[];
    /** Integer `(start, end)` offsets for each token in `s`. */
    span_tokenize(_s: string): Array<[number, number]>;
    /** Apply `tokenize()` to each element of `strings`. */
    tokenize_sents(strings: readonly string[]): string[][];
    /** Apply `span_tokenize()` to each element of `strings`. */
    span_tokenize_sents(strings: readonly string[]): Generator<Array<[number, number]>>;
    spanTokenize(s: string): Array<[number, number]>;
    tokenizeSents(strings: readonly string[]): string[][];
    spanTokenizeSents(strings: readonly string[]): Array<Array<[number, number]>>;
}
declare abstract class TaggerI {
    /** Tag `tokens` — delegates to `tag_sents` when that is overridden. */
    tag(tokens: string[]): TaggedToken$4[];
    /** Apply `tag()` to each element of `sentences`. */
    tag_sents(sentences: Iterable<string[]>): TaggedToken$4[][];
    tagSents(sentences: Iterable<string[]>): TaggedToken$4[][];
    /** Deprecated alias of `accuracy` (NLTK `evaluate`). */
    evaluate(gold: readonly TaggedToken$4[][]): number;
    /** Score accuracy against the gold standard. */
    accuracy(gold: readonly TaggedToken$4[][]): number;
    /** ConfusionMatrix: gold tags as reference, predictions as test. */
    confusion(gold: readonly TaggedToken$4[][]): ConfusionMatrix;
    /** Per-tag precision over the gold standard (dict in NLTK, Map here). */
    precision(gold: readonly TaggedToken$4[][]): Map<string, number>;
    /** Per-tag recall over the gold standard. */
    recall(gold: readonly TaggedToken$4[][]): Map<string, number>;
    /** Per-tag F-measure over the gold standard. */
    f_measure(gold: readonly TaggedToken$4[][], alpha?: number): Map<string, number>;
    fMeasure(gold: readonly TaggedToken$4[][], alpha?: number): Map<string, number>;
    /** Per-tag precision/recall/F table (NLTK `evaluate_per_tag`). */
    evaluate_per_tag(gold: readonly TaggedToken$4[][]): string;
    evaluatePerTag(gold: readonly TaggedToken$4[][]): string;
}
/** A tagger that requires tokens to be featuresets. */
declare abstract class FeaturesetTaggerI extends TaggerI {
}
declare abstract class ParserI<T = string> {
    /** The grammar used by this parser. */
    grammar(): unknown;
    /** Iterate parse trees for `sent`. */
    parse(sent: readonly T[], ...args: unknown[]): Generator<unknown>;
    /** Apply `parse()` to each element of `sents`. */
    parse_sents(sents: Iterable<readonly T[]>, ...args: unknown[]): Generator<Generator<unknown>>;
    /** All parses of `sent` as a list. */
    parse_all(sent: readonly T[], ...args: unknown[]): unknown[];
    /** The first parse of `sent`, or null. */
    parse_one(sent: readonly T[], ...args: unknown[]): unknown | null;
    parseSents(sents: Iterable<readonly T[]>, ...args: unknown[]): Generator<Generator<unknown>>;
    parseAll(sent: readonly T[], ...args: unknown[]): unknown[];
    parseOne(sent: readonly T[], ...args: unknown[]): unknown | null;
}
declare abstract class ClassifierI<F = unknown, L = string> {
    /** The list of category labels used by this classifier. */
    labels(): L[];
    /** The most appropriate label for `featureset`. */
    classify(featureset: F): L;
    /** A probability distribution over labels for `featureset`. */
    prob_classify(featureset: F): unknown;
    /** Apply `classify()` to each element of `featuresets`. */
    classify_many(featuresets: readonly F[]): L[];
    /** Apply `prob_classify()` to each element of `featuresets`. */
    prob_classify_many(featuresets: readonly F[]): unknown[];
    probClassify(featureset: F): unknown;
    classifyMany(featuresets: readonly F[]): L[];
    probClassifyMany(featuresets: readonly F[]): unknown[];
}
declare class ProbabilisticMixIn {
    private _prob;
    private _logprob;
    constructor({ prob, logprob }?: {
        prob?: number;
        logprob?: number;
    });
    set_prob(prob: number): void;
    set_logprob(logprob: number): void;
    setProb(prob: number): void;
    setLogprob(logprob: number): void;
    prob(): number | null;
    logprob(): number | null;
}
declare class ImmutableProbabilisticMixIn extends ProbabilisticMixIn {
    set_prob(_prob: number): void;
    set_logprob(_logprob: number): void;
}

type TaggedToken$3 = readonly [word: string, tag: string];
type GoldSentence = readonly TaggedToken$3[];
type UntaggedSentence = readonly string[];
type TagContext = string | null | readonly (string | null | readonly (string | null)[])[];
type TaggerModel = ReadonlyMap<TagContext, string> | Record<string, string>;
interface NgramTaggerOptions {
    train?: readonly GoldSentence[];
    model?: TaggerModel;
    backoff?: SequentialBackoffTagger | null;
    cutoff?: number;
    verbose?: boolean;
}
declare abstract class SequentialBackoffTagger {
    readonly taggers: readonly SequentialBackoffTagger[];
    constructor(backoff?: SequentialBackoffTagger | null);
    get backoff(): SequentialBackoffTagger | null;
    tag(tokens: UntaggedSentence): Array<[string, string | null]>;
    tagOne(tokens: UntaggedSentence, index: number, history: ReadonlyArray<string | null>): string | null;
    tagSents(sentences: ReadonlyArray<UntaggedSentence>): Array<Array<[string, string | null]>>;
    evaluate(gold: ReadonlyArray<GoldSentence>): number;
    /** NLTK TaggerI.accuracy: retag the untagged gold tokens, compare tags. */
    accuracy(gold: ReadonlyArray<GoldSentence>): number;
    /** NLTK TaggerI.confusion: ConfusionMatrix of gold tags vs predicted tags. */
    confusion(gold: ReadonlyArray<GoldSentence>): ConfusionMatrix<string | null>;
    precision(gold: ReadonlyArray<GoldSentence>): Map<string | null, number>;
    recall(gold: ReadonlyArray<GoldSentence>): Map<string | null, number>;
    fMeasure(gold: ReadonlyArray<GoldSentence>, alpha?: number): Map<string | null, number>;
    f_measure(gold: ReadonlyArray<GoldSentence>, alpha?: number): Map<string | null, number>;
    /** NLTK TaggerI.evaluate_per_tag: tabulated per-tag metrics string. */
    evaluatePerTag(gold: ReadonlyArray<GoldSentence>, options?: {
        alpha?: number;
        truncate?: number;
        sortByCount?: boolean;
    }): string;
    abstract chooseTag(tokens: UntaggedSentence, index: number, history: ReadonlyArray<string | null>): string | null;
    abstract size(): number;
}
declare abstract class ContextTagger extends SequentialBackoffTagger {
    protected table: Map<string, {
        context: TagContext;
        tag: string;
    }>;
    constructor(backoff?: SequentialBackoffTagger | null);
    size(): number;
    protected loadModel(model: TaggerModel): void;
    train(taggedCorpus: ReadonlyArray<GoldSentence>, cutoff?: number, verbose?: boolean): void;
    chooseTag(tokens: UntaggedSentence, index: number, history: ReadonlyArray<string | null>): string | null;
    /** NLTK ``_context_to_tag`` view. */
    get contextToTag(): Map<TagContext, string>;
    abstract context(tokens: UntaggedSentence, index: number, history: ReadonlyArray<string | null>): TagContext | null;
}
declare class DefaultTagger extends SequentialBackoffTagger {
    #private;
    constructor(tag: string);
    get assignedTag(): string;
    size(): number;
    chooseTag(): string | null;
    toString(): string;
}
declare class NgramTagger extends ContextTagger {
    readonly n: number;
    constructor(n: number, options?: NgramTaggerOptions);
    context(tokens: UntaggedSentence, index: number, history: ReadonlyArray<string | null>): TagContext;
    encodeJsonObj(): [number, Record<string, string>, SequentialBackoffTagger | null];
    toString(): string;
}
declare class UnigramTagger extends ContextTagger {
    constructor(options?: NgramTaggerOptions);
    constructor(train?: readonly GoldSentence[] | null, model?: TaggerModel | null, backoff?: SequentialBackoffTagger | null, cutoff?: number, verbose?: boolean);
    context(tokens: UntaggedSentence, index: number): TagContext;
    encodeJsonObj(): [Record<string, string>, SequentialBackoffTagger | null];
    static decodeJsonObj(obj: [Record<string, string>, SequentialBackoffTagger | null]): SequentialBackoffTagger | null;
    toString(): string;
}
declare class BigramTagger extends NgramTagger {
    constructor(options?: NgramTaggerOptions);
    toString(): string;
}
declare class TrigramTagger extends NgramTagger {
    constructor(options?: NgramTaggerOptions);
    toString(): string;
}
declare class RegexpTagger extends SequentialBackoffTagger {
    readonly regexps: ReadonlyArray<{
        pattern: RegExp;
        tag: string;
    }>;
    constructor(regexps: ReadonlyArray<readonly [string, string]>, backoff?: SequentialBackoffTagger | null);
    size(): number;
    chooseTag(tokens: UntaggedSentence, index: number): string | null;
    toString(): string;
}
type FeatureDetector = (tokens: UntaggedSentence, index: number, history: readonly (string | null)[]) => Record<string, unknown>;
/** nltk.tag.sequential.AffixTagger — context = leading/trailing substring of the token. */
declare class AffixTagger extends ContextTagger {
    readonly affixLength: number;
    readonly minStemLength: number;
    private readonly minWordLength;
    constructor(train?: ReadonlyArray<GoldSentence> | null, model?: TaggerModel | null, affixLength?: number, minStemLength?: number, backoff?: SequentialBackoffTagger | null, cutoff?: number, verbose?: boolean);
    context(tokens: UntaggedSentence, index: number, _history?: readonly (string | null)[]): TagContext | null;
    encodeJsonObj(): [number, number, Map<TagContext, string>, SequentialBackoffTagger | null];
    static decodeJsonObj(obj: [number, number, Map<TagContext, string>, SequentialBackoffTagger | null]): AffixTagger;
    toString(): string;
}
interface FeaturesetClassifier {
    classify(featureset: Record<string, unknown>): string;
    prob_classify?(featureset: Record<string, unknown>): {
        max(): string;
        prob(x: string): number;
    };
    probClassify?(featureset: Record<string, unknown>): {
        max(): string;
        prob(x: string): number;
    };
}
/** nltk.tag.sequential.ClassifierBasedTagger — tagger driven by a classifier + feature detector. */
declare class ClassifierBasedTagger extends SequentialBackoffTagger {
    protected featureDetectorFn?: FeatureDetector;
    protected classifierObj?: FeaturesetClassifier;
    readonly cutoffProb?: number;
    constructor(options?: {
        feature_detector?: FeatureDetector;
        train?: ReadonlyArray<GoldSentence> | null;
        classifier_builder?: (labeled: ReadonlyArray<readonly [Record<string, unknown>, string]>) => FeaturesetClassifier;
        classifier?: FeaturesetClassifier | null;
        backoff?: SequentialBackoffTagger | null;
        cutoff_prob?: number;
        verbose?: boolean;
    });
    size(): number;
    feature_detector(tokens: UntaggedSentence, index: number, history: readonly (string | null)[]): Record<string, unknown>;
    classifier(): FeaturesetClassifier | undefined;
    chooseTag(tokens: UntaggedSentence, index: number, history: readonly (string | null)[]): string | null;
    private trainClassifier;
    toString(): string;
}
/** nltk.tag.sequential.ClassifierBasedPOSTagger — POS-specific feature detector. */
declare class ClassifierBasedPOSTagger extends ClassifierBasedTagger {
    feature_detector(tokens: UntaggedSentence, index: number, history: readonly (string | null)[]): Record<string, unknown>;
}

type MaxentEncodedVector = Array<[number, number]>;
interface MaxentEncodingLike {
    encode(featureset: MaxentFeatureset, label: string): MaxentEncodedVector;
    length(): number;
    labels(): string[];
    describe(fid: number): unknown;
}
type MaxentTrainToks = Iterable<MaxentEncodingExample>;
declare class MaxentFeatureEncodingI {
    encode(_featureset: unknown, _label: string): MaxentEncodedVector;
    length(): number;
    labels(): string[];
    describe(_fid: number): unknown;
}
declare class FunctionBackedMaxentFeatureEncoding extends MaxentFeatureEncodingI {
    private readonly _func;
    private readonly _length;
    private readonly _labels;
    constructor(func: (featureset: MaxentFeatureset, label: string) => MaxentEncodedVector, length: number, labels: string[]);
    encode(featureset: MaxentFeatureset, label: string): MaxentEncodedVector;
    length(): number;
    labels(): string[];
    describe(_fid: number): string;
}
declare class GISEncoding extends BinaryMaxentFeatureEncoding {
    private _C;
    constructor(labels: Iterable<string>, mapping: MaxentFeatureMapping, unseen_features?: boolean, alwayson_features?: boolean, C?: number | null);
    /** The non-negative constant that all encoded feature vectors will sum to. */
    get C(): number;
    encode(featureset: MaxentFeatureset, label: string): MaxentEncodedVector;
    length(): number;
    describe(f_id: number): string;
    static train(train_toks: MaxentTrainToks, count_cutoff?: number, labels?: Iterable<string> | null, options?: MaxentEncodingOptions): GISEncoding;
}
type TadmMapping = Iterable<readonly [readonly [string, string], number]>;
declare class TadmEventMaxentFeatureEncoding extends MaxentFeatureEncodingI {
    private readonly _mapping;
    private readonly _pairs;
    private readonly _labelMapping;
    private readonly _labels;
    constructor(labels: Iterable<string>, mapping: TadmMapping, _unseen_features?: boolean, _alwayson_features?: boolean);
    private pairKey;
    encode(featureset: MaxentFeatureset, label: string): MaxentEncodedVector;
    labels(): string[];
    describe(fid: number): readonly [string, string] | undefined;
    length(): number;
    static train(train_toks: MaxentTrainToks, _count_cutoff?: number, labels?: Iterable<string> | null, _options?: MaxentEncodingOptions): TadmEventMaxentFeatureEncoding;
}
type ProbClassifier = {
    prob_classify(featureset: MaxentFeatureset): {
        prob(label: string): number;
        max(): string;
        samples(): Iterable<string>;
    };
    prob_classify_many(featuresets: readonly MaxentFeatureset[]): Array<{
        prob(label: string): number;
    }>;
    classify_many(featuresets: readonly MaxentFeatureset[]): string[];
};
declare function classify_log_likelihood(classifier: ProbClassifier, gold: readonly MaxentEncodingExample[]): number;
declare function classify_accuracy(classifier: ProbClassifier, gold: readonly MaxentEncodingExample[]): number;
declare class CutoffChecker {
    cutoffs: Record<string, number>;
    ll: number | null;
    acc: number | null;
    iter: number;
    constructor(cutoffs: Record<string, number>);
    check(classifier: ProbClassifier, train_toks: readonly MaxentEncodingExample[]): boolean | undefined;
}
declare class ConditionalExponentialClassifier extends ClassifierI<MaxentFeatureset, string> {
    static readonly ALGORITHMS: string[];
    private readonly _encoding;
    private _weights;
    private readonly _logarithmic;
    private _mostInformative;
    constructor(encoding: MaxentEncodingLike, weights: ArrayLike<number>, logarithmic?: boolean);
    get encoding(): MaxentEncodingLike;
    labels(): string[];
    set_weights(new_weights: ArrayLike<number>): void;
    setWeights(new_weights: ArrayLike<number>): void;
    weights(): number[];
    classify(featureset: MaxentFeatureset): string;
    prob_classify(featureset: MaxentFeatureset): DictionaryProbDist<string>;
    probClassify(featureset: MaxentFeatureset): DictionaryProbDist<string>;
    classify_many(featuresets: readonly MaxentFeatureset[]): string[];
    prob_classify_many(featuresets: readonly MaxentFeatureset[]): DictionaryProbDist<string>[];
    classifyMany(featuresets: readonly MaxentFeatureset[]): string[];
    probClassifyMany(featuresets: readonly MaxentFeatureset[]): DictionaryProbDist<string>[];
    explain(featureset: MaxentFeatureset, columns?: number): void;
    most_informative_features(n?: number | null): number[];
    mostInformativeFeatures(n?: number | null): number[];
    show_most_informative_features(n?: number, show?: "all" | "neg" | "pos"): void;
    showMostInformativeFeatures(n?: number, show?: "all" | "neg" | "pos"): void;
    toString(): string;
    static train(train_toks: MaxentTrainToks, options?: {
        algorithm?: string | null;
        trace?: number;
        encoding?: MaxentEncodingLike | null;
        labels?: Iterable<string> | null;
        gaussian_prior_sigma?: number;
    } & Record<string, unknown>): ConditionalExponentialClassifier;
}
declare function calculate_empirical_fcount(train_toks: MaxentTrainToks, encoding: MaxentEncodingLike): Float64Array;
declare function calculate_estimated_fcount(classifier: ProbClassifier, train_toks: MaxentTrainToks, encoding: MaxentEncodingLike): Float64Array;
declare function calculate_nfmap(train_toks: MaxentTrainToks, encoding: MaxentEncodingLike): Map<number, number>;
declare function calculate_deltas(train_toks: MaxentTrainToks, classifier: ProbClassifier, unattested: ReadonlySet<number> | readonly number[], ffreq_empirical: ArrayLike<number>, nfmap: ReadonlyMap<number, number>, nfarray: ArrayLike<number>, nftranspose: ArrayLike<number> | ArrayLike<ArrayLike<number>>, encoding: MaxentEncodingLike): Float64Array;
type MaxentTrainOptions = {
    trace?: number;
    encoding?: MaxentEncodingLike | null;
    labels?: Iterable<string> | null;
} & Record<string, unknown>;
declare function train_maxent_classifier_with_gis(train_toks: MaxentTrainToks, options?: MaxentTrainOptions): ConditionalExponentialClassifier;
declare function train_maxent_classifier_with_iis(train_toks: MaxentTrainToks, options?: MaxentTrainOptions): ConditionalExponentialClassifier;
interface MaxentStreamLike {
    write(text: string): unknown;
}
declare function write_megam_file(train_toks: MaxentTrainToks, encoding: MaxentEncodingLike & {
    cost?: (featureset: MaxentFeatureset, label: string, l: string) => number;
}, stream: MaxentStreamLike, bernoulli?: boolean, explicit?: boolean): void;
declare function parse_megam_weights(s: string, features_count: number, explicit?: boolean): Float64Array;
declare function write_tadm_file(train_toks: MaxentTrainToks, encoding: MaxentEncodingLike, stream: MaxentStreamLike): void;
declare function parse_tadm_weights(paramfile: Iterable<string> | string): Float64Array;
type MaxentParams = readonly [Float64Array, Array<[[string, MaxentMappingValue, string], number]>, string[], Record<string, number>];
declare function load_maxent_params(tab_dir: string): MaxentParams;
declare function save_maxent_params(params: MaxentParams | {
    wgt: ArrayLike<number>;
    mpg: Iterable<readonly [readonly [string, MaxentMappingValue, string], number]>;
    lab: string[];
    aon: ReadonlyMap<string, number> | Record<string, number>;
}, tab_dir?: string): void;
declare function maxent_pos_tagger(): ClassifierBasedPOSTagger;

type ConcordanceLine = {
    left: string[];
    query: string;
    right: string[];
    offset: number;
    leftPrint: string;
    rightPrint: string;
    line: string;
    left_print: string;
    right_print: string;
};
type Context = [string, string];
declare class ConcordanceIndex {
    #private;
    private readonly tokensValue;
    private readonly key;
    constructor(tokensValue: string[], key?: (token: string) => string);
    tokens(): string[];
    offsets(word: string): number[];
    findConcordance(word: string | string[], width?: number): ConcordanceLine[];
    find_concordance(word: string | string[], width?: number): ConcordanceLine[];
    /** NLTK ``print_concordance`` rendered as a string (printing adapted). */
    printConcordance(word: string | string[], width?: number, lines?: number): string;
    print_concordance(word: string | string[], width?: number, lines?: number): string;
    concordance(word: string | string[], width?: number, lines?: number): string[];
    toString(): string;
}
declare class ContextIndex {
    #private;
    private readonly tokensValue;
    constructor(tokensValue: string[], options?: {
        contextFn?: (tokens: string[], index: number) => Context;
        filter?: (token: string) => boolean;
        key?: (token: string) => string;
    });
    tokens(): string[];
    similarWords(word: string, count?: number): string[];
    commonContexts(words: string[], failOnUnknown?: boolean): FreqDist<Context>;
}
declare class Text {
    #private;
    readonly tokens: string[];
    readonly name: string;
    constructor(tokens: Iterable<string>, name?: string);
    count(word: string): number;
    index(word: string): number;
    vocab(): FreqDist<string>;
    concordanceList(word: string | string[], width?: number, lines?: number): ConcordanceLine[];
    concordance(word: string | string[], width?: number, lines?: number): string[];
    collocationList(num?: number, windowSize?: number, options?: {
        minFreq?: number;
        scoreFn?: BigramScoreFn<string>;
        stopwords?: Iterable<string>;
    }): Array<[string, string]>;
    collocations(num?: number, windowSize?: number): string[];
    similar(word: string, num?: number): string[];
    commonContexts(words: string[], num?: number): Context[];
    common_contexts(words: string[], num?: number): Context[];
    concordance_list(word: string | string[], width?: number, lines?: number): ConcordanceLine[];
    collocation_list(num?: number, window_size?: number, options?: {
        minFreq?: number;
        scoreFn?: BigramScoreFn<string>;
        stopwords?: Iterable<string>;
    }): Array<[string, string]>;
    findall(regexp: string, timeout?: number): string;
    generate(length?: number, text_seed?: readonly string[], random_seed?: number): string;
    readability(_method: string): never;
    dispersion_plot(words: readonly string[]): number[][];
    dispersionPlot(words: readonly string[]): number[][];
    plot(...args: unknown[]): unknown;
    toString(): string;
}
/** nltk.text.TokenSearcher — regex search over a token stream using <token> markup. */
declare class TokenSearcher {
    private readonly raw;
    constructor(tokens: Iterable<string>);
    findall(regexp: string, _timeout?: number): string[][];
}
/** nltk.text.TextCollection — Text over a collection of texts with tf/idf helpers. */
declare class TextCollection extends Text {
    private readonly texts;
    private readonly idfCache;
    constructor(source: Iterable<Iterable<string>> | {
        words(fileid?: string): Iterable<string>;
        fileids(): string[];
    });
    tf(term: string, text: readonly string[]): number;
    idf(term: string): number;
    tf_idf(term: string, text: readonly string[]): number;
}

type CorpusDownloadOptions = {
    fetchBytes?: (url: string) => Promise<Uint8Array>;
    overwrite?: boolean;
    maxEntryBytes?: number;
    maxTotalBytes?: number;
    timeoutMs?: number;
};
declare function loadCorpusRegistryManifest(manifestPath: string): CorpusRegistryManifest;
declare function downloadCorpusRegistry(manifestOrPath: CorpusRegistryManifest | string, outDir: string, options?: CorpusDownloadOptions): Promise<string>;

type CorpusFile = {
    id: string;
    text: string;
    categories: string[];
};
type CorpusMiniIndex = {
    version: number;
    files: Array<{
        id: string;
        path: string;
        categories?: string[];
    }>;
};
type CorpusRegistryEntry = {
    id: string;
    url: string;
    categories?: string[];
    sha256?: string;
    fileName?: string;
};
type CorpusRegistryManifest = {
    version: number;
    entries: CorpusRegistryEntry[];
};
type ReadOptions = {
    fileIds?: string[];
    categories?: string[];
};
declare class CorpusReader$1 {
    private readonly files;
    constructor(files: CorpusFile[]);
    fileIds(options?: ReadOptions): string[];
    raw(options?: ReadOptions): string;
    words(options?: ReadOptions): string[];
    sents(options?: ReadOptions): string[];
    paras(options?: ReadOptions): string[];
    categories(): string[];
    private selectFiles;
}
declare function loadBundledMiniCorpus(rootPath?: string): CorpusReader$1;
declare function loadCorpusBundleFromIndex(indexPath: string): CorpusReader$1;

type TaggedToken$2 = {
    token: string;
    tag: string;
};
type ChunkedToken = {
    token: string;
    pos: string;
    chunk: string;
};
type TaggedSentence = TaggedToken$2[];
type ChunkedSentence = ChunkedToken[];
declare function parseConllTagged(text: string): TaggedSentence[];
declare function parseBrownTagged(text: string): TaggedSentence[];
declare function parseConllChunked(text: string): ChunkedSentence[];

type FeatureMap = Record<string, string>;
type FeatureSymbol = {
    base: string;
    features: FeatureMap;
    terminal: boolean;
    surface?: string;
};
type FeatureProduction = {
    lhs: FeatureSymbol;
    rhs: FeatureSymbol[];
};
type FeatureCfgGrammar = {
    startSymbol: FeatureSymbol;
    productions: FeatureProduction[];
};
declare function parseFeatureCfgGrammar(grammarText: string, options?: {
    startSymbol?: string;
}): FeatureCfgGrammar;
declare function featureChartParse(tokens: string[], grammar: FeatureCfgGrammar, options?: {
    maxTrees?: number;
    maxDepth?: number;
    startSymbol?: FeatureSymbol | string;
}): ParseTree[];
declare function parseTextWithFeatureCfg(text: string, grammar: FeatureCfgGrammar | string, options?: {
    maxTrees?: number;
    startSymbol?: string;
    normalizeTokens?: boolean;
    maxDepth?: number;
}): ParseTree[];
declare function featureEarleyParse(tokens: string[], grammar: FeatureCfgGrammar, options?: {
    maxTrees?: number;
    maxDepth?: number;
    startSymbol?: FeatureSymbol | string;
}): ParseTree[];
declare function parseTextWithFeatureEarley(text: string, grammar: FeatureCfgGrammar | string, options?: {
    maxTrees?: number;
    startSymbol?: string;
    normalizeTokens?: boolean;
    maxDepth?: number;
}): ParseTree[];

type CategoricalNBSerialized = {
    version: 2;
    model: "categorical";
    smoothing: number;
    totalDocs: number;
    labels: string[];
    labelDocCounts: number[];
    features: Array<[string, Array<Array<[number, number]>>]>;
};

type NaiveBayesSerialized$1 = {
    version: number;
    smoothing: number;
    totalDocs: number;
    labels: string[];
    labelDocCounts: number[];
    labelTokenTotals: number[];
    vocabulary: string[];
    tokenCountsByLabel: Array<Array<string | number>>;
};

type NaiveBayesExample = {
    label: string;
    text: string;
};
/** Categorical models return normalized base-2 log probabilities; v1 retains legacy scores. */
type NaiveBayesPrediction = {
    label: string;
    logProb: number;
};
type NaiveBayesSerialized = CategoricalNBSerialized | NaiveBayesSerialized$1;
type NaiveBayesOptions = {
    smoothing?: number;
    model?: "categorical" | "multinomial";
};
declare class NaiveBayesTextClassifier {
    private engine;
    constructor(options?: NaiveBayesOptions);
    get logBase(): number;
    train(examples: NaiveBayesExample[]): this;
    labels(): string[];
    predict(text: string): NaiveBayesPrediction[];
    classify(text: string): string;
    evaluate(examples: NaiveBayesExample[]): {
        accuracy: number;
        total: number;
        correct: number;
    };
    toJSON(): NaiveBayesSerialized;
    static fromSerialized(payload: NaiveBayesSerialized): NaiveBayesTextClassifier;
}
declare function trainNaiveBayesTextClassifier(examples: NaiveBayesExample[], options?: NaiveBayesOptions): NaiveBayesTextClassifier;
declare function loadNaiveBayesTextClassifier(payload: NaiveBayesSerialized): NaiveBayesTextClassifier;

type SparseVector = {
    indices: Uint32Array;
    values: Float64Array;
};
type VectorizerSerialized = {
    version: number;
    ngramMin: number;
    ngramMax: number;
    binary: boolean;
    maxFeatures: number;
    vocabulary: string[];
};
type VectorizerOptions = {
    ngramMin?: number;
    ngramMax?: number;
    binary?: boolean;
    maxFeatures?: number;
};
declare class TextFeatureVectorizer {
    readonly ngramMin: number;
    readonly ngramMax: number;
    readonly binary: boolean;
    readonly maxFeatures: number;
    private features;
    constructor(options?: VectorizerOptions);
    static fromJSON(payload: VectorizerSerialized): TextFeatureVectorizer;
    get featureCount(): number;
    vocabulary(): string[];
    fit(texts: string[]): this;
    transform(text: string): SparseVector;
    transformMany(texts: string[]): SparseVector[];
    toJSON(): VectorizerSerialized;
}
declare function flattenSparseBatch(rows: SparseVector[]): {
    docOffsets: Uint32Array;
    featureIds: Uint32Array;
    featureValues: Float64Array;
};

type DecisionTreeExample = {
    label: string;
    text: string;
};
type DecisionTreeSerialized = {
    version: number;
    labels: string[];
    options: {
        maxDepth: number;
        minSamples: number;
        maxCandidateFeatures: number;
    };
    vectorizer: VectorizerSerialized;
    tree: DecisionTreeNodeSerialized;
};
type DecisionTreeNodeSerialized = {
    kind: "leaf";
    label: string;
    counts: Record<string, number>;
} | {
    kind: "split";
    featureId: number;
    feature: string;
    absent: DecisionTreeNodeSerialized;
    present: DecisionTreeNodeSerialized;
};
type DecisionTreeOptions = {
    maxDepth?: number;
    minSamples?: number;
    maxCandidateFeatures?: number;
    maxFeatures?: number;
};
/** Rust owns legacy text stump/refinement training and tree traversal. */
declare class DecisionTreeTextClassifier {
    private readonly options;
    private vectorizer;
    private model;
    constructor(options?: DecisionTreeOptions);
    static fromJSON(payload: DecisionTreeSerialized): DecisionTreeTextClassifier;
    train(examples: DecisionTreeExample[]): this;
    private ensureModel;
    classify(text: string): string;
    predict(text: string): Array<{
        label: string;
        score: number;
    }>;
    evaluate(examples: DecisionTreeExample[]): {
        accuracy: number;
        total: number;
        correct: number;
    };
    toJSON(): DecisionTreeSerialized;
}
declare function trainDecisionTreeTextClassifier(examples: DecisionTreeExample[], options?: DecisionTreeOptions): DecisionTreeTextClassifier;
declare function loadDecisionTreeTextClassifier(payload: DecisionTreeSerialized): DecisionTreeTextClassifier;

type MaxEntExample = {
    label: string;
    text: string;
};
type MaxEntPrediction = {
    label: string;
    probability: number;
    logit: number;
};
type MaxEntSerialized$1 = {
    version: number;
    labels: string[];
    vocabulary: string[];
    weights: number[][];
    bias: number[];
    options: {
        epochs: number;
        learningRate: number;
        l2: number;
        maxFeatures: number;
    };
};
type MaxEntOptions$1 = {
    epochs?: number;
    learningRate?: number;
    l2?: number;
    maxFeatures?: number;
};

type IisSerialized = {
    version: 2;
    algorithm: "iis";
    labels: string[];
    features: [string, number, string][];
    weights: number[];
    epochs: number;
};

type MaxEntSerialized = IisSerialized | MaxEntSerialized$1;
type MaxEntOptions = MaxEntOptions$1 & {
    algorithm?: "iis" | "sgd";
};
declare class MaxEntTextClassifier {
    private engine;
    constructor(options?: MaxEntOptions);
    train(examples: MaxEntExample[]): this;
    labelsList(): string[];
    predict(text: string): MaxEntPrediction[];
    classify(text: string): string;
    evaluate(examples: MaxEntExample[]): {
        accuracy: number;
        total: number;
        correct: number;
    };
    toJSON(): MaxEntSerialized;
    static fromSerialized(payload: MaxEntSerialized): MaxEntTextClassifier;
}
declare function trainMaxEntTextClassifier(examples: MaxEntExample[], options?: MaxEntOptions): MaxEntTextClassifier;
declare function loadMaxEntTextClassifier(payload: MaxEntSerialized): MaxEntTextClassifier;

type PositivePrediction = {
    label: string;
    probability: number;
    logProb: number;
};

type PositiveNaiveBayesSerialized = {
    version: number;
    positiveLabel: string;
    negativeLabel: string;
    positivePrior: number;
    vocabulary: string[];
    presentLogPos: number[];
    absentLogPos: number[];
    presentLogNeg: number[];
    absentLogNeg: number[];
    absentLogPosSum: number;
    absentLogNegSum: number;
    options: {
        maxFeatures: number;
    };
};
type Options = {
    maxFeatures?: number;
    positivePrior?: number;
    positiveLabel?: string;
    negativeLabel?: string;
};
type TextRows = string[] | Array<{
    text: string;
}>;
/** Legacy Bernoulli positive/unlabeled text extension, not NLTK's categorical variant. */
declare class PositiveNaiveBayesTextClassifier {
    private state;
    constructor(options?: Options);
    static fromJSON(payload: PositiveNaiveBayesSerialized): PositiveNaiveBayesTextClassifier;
    train(positiveRows: TextRows, unlabeledRows: TextRows, options?: {
        positivePrior?: number;
    }): this;
    predict(text: string): PositivePrediction[];
    classify(text: string): string;
    evaluate(examples: Array<{
        label: string;
        text: string;
    }>): {
        accuracy: number;
        total: number;
        correct: number;
    };
    toJSON(): PositiveNaiveBayesSerialized;
}
declare function trainPositiveNaiveBayesTextClassifier(positiveRows: TextRows, unlabeledRows: TextRows, options?: Options): PositiveNaiveBayesTextClassifier;
declare function loadPositiveNaiveBayesTextClassifier(payload: PositiveNaiveBayesSerialized): PositiveNaiveBayesTextClassifier;

declare abstract class FeatureClassifierBase {
    protected abstract classifyText(text: string): string;
    protected abstract probClassifyText(text: string): DictionaryProbDist<string>;
    abstract labels(): string[];
    classify(featureset: FeatureSet): string;
    probClassify(featureset: FeatureSet): DictionaryProbDist<string>;
    classifyMany(featuresets: Iterable<FeatureSet>): string[];
    probClassifyMany(featuresets: Iterable<FeatureSet>): DictionaryProbDist<string>[];
    prob_classify(featureset: FeatureSet): DictionaryProbDist<string>;
    classify_many(featuresets: Iterable<FeatureSet>): string[];
    prob_classify_many(featuresets: Iterable<FeatureSet>): DictionaryProbDist<string>[];
}
declare class NaiveBayesClassifier extends FeatureClassifierBase {
    private readonly model;
    constructor(model: NaiveBayesTextClassifier | RustNaiveBayesClassifier);
    static train(labeledFeaturesets: Iterable<LabeledFeatureset>, options?: {
        smoothing?: number;
    }): NaiveBayesClassifier;
    classify(featureset: FeatureSet): string;
    probClassify(featureset: FeatureSet): DictionaryProbDist<string>;
    dispose(): void;
    protected classifyText(text: string): string;
    protected probClassifyText(text: string): DictionaryProbDist<string>;
    labels(): string[];
}
declare class DecisionTreeClassifier extends FeatureClassifierBase {
    private readonly model;
    constructor(model: DecisionTreeTextClassifier | RustDecisionTreeClassifier);
    static train(labeledFeaturesets: Iterable<LabeledFeatureset>, options?: FeatureTreeOptions): DecisionTreeClassifier;
    classify(featureset: FeatureSet): string;
    probClassify(featureset: FeatureSet): DictionaryProbDist<string>;
    dispose(): void;
    protected classifyText(text: string): string;
    protected probClassifyText(text: string): DictionaryProbDist<string>;
    labels(): string[];
}
type MaxentCompatOptions = Omit<FeatureMaxentOptions, "algorithm"> & {
    algorithm?: "iis" | "gis" | "sgd";
    /** Legacy text-model options; using any of them keeps the old adapter. */
    epochs?: number;
    learningRate?: number;
    l2?: number;
    maxFeatures?: number;
};
declare class MaxentClassifier extends FeatureClassifierBase {
    private readonly model;
    constructor(model: RustMaxentClassifier | MaxEntTextClassifier);
    static train(labeledFeaturesets: Iterable<MaxentEncodingExample>, options?: MaxentCompatOptions): MaxentClassifier;
    classify(featureset: MaxentFeatureset): string;
    probClassify(featureset: MaxentFeatureset): DictionaryProbDist<string>;
    classifyMany(featuresets: Iterable<MaxentFeatureset>): string[];
    probClassifyMany(featuresets: Iterable<MaxentFeatureset>): DictionaryProbDist<string>[];
    prob_classify(featureset: MaxentFeatureset): DictionaryProbDist<string>;
    classify_many(featuresets: Iterable<MaxentFeatureset>): string[];
    prob_classify_many(featuresets: Iterable<MaxentFeatureset>): DictionaryProbDist<string>[];
    dispose(): void;
    protected classifyText(text: string): string;
    protected probClassifyText(text: string): DictionaryProbDist<string>;
    labels(): string[];
    mostInformativeFeatures(limit?: number): Array<{
        weight: number;
        feature: string;
        value: string;
        label: string;
    }>;
    most_informative_features(limit?: number): Array<{
        weight: number;
        feature: string;
        value: string;
        label: string;
    }>;
}
declare class PositiveNaiveBayesClassifier extends FeatureClassifierBase {
    private readonly model;
    constructor(model: PositiveNaiveBayesTextClassifier | RustNaiveBayesClassifier);
    static train(positiveFeaturesets: Iterable<FeatureSet>, unlabeledFeaturesets: Iterable<FeatureSet>, options?: PositiveFeatureOptions): PositiveNaiveBayesClassifier;
    classify(featureset: FeatureSet): string;
    probClassify(featureset: FeatureSet): DictionaryProbDist<string>;
    dispose(): void;
    protected classifyText(text: string): string;
    protected probClassifyText(text: string): DictionaryProbDist<string>;
    labels(): string[];
}
/** `nltk.classify.decisiontree.f` — debug helper: train(x, binary=True, verbose=True). */
declare function f(x: Iterable<LabeledFeatureset>): DecisionTreeClassifier;

type ConditionalExponentialExample = MaxEntExample;
type ConditionalExponentialSerialized = {
    version: number;
    kind: "conditional_exponential";
    maxent: MaxEntSerialized;
};
declare class ConditionalExponentialTextClassifier {
    private model;
    constructor(options?: MaxEntOptions);
    static fromJSON(payload: ConditionalExponentialSerialized): ConditionalExponentialTextClassifier;
    train(examples: ConditionalExponentialExample[]): this;
    labelsList(): string[];
    predict(text: string): MaxEntPrediction[];
    classify(text: string): string;
    evaluate(examples: ConditionalExponentialExample[]): {
        accuracy: number;
        total: number;
        correct: number;
    };
    toJSON(): ConditionalExponentialSerialized;
}
declare function trainConditionalExponentialTextClassifier(examples: ConditionalExponentialExample[], options?: MaxEntOptions): ConditionalExponentialTextClassifier;
declare function loadConditionalExponentialTextClassifier(payload: ConditionalExponentialSerialized): ConditionalExponentialTextClassifier;

type LinearModelExample = {
    label: string;
    text: string;
};
type LogisticSerialized = {
    version: number;
    labels: string[];
    vectorizer: VectorizerSerialized;
    weights: number[];
    bias: number[];
    options: {
        epochs: number;
        learningRate: number;
        l2: number;
        maxFeatures: number;
        useNativeScoring?: boolean;
        useNativeTraining?: boolean;
    };
};
type LinearSvmSerialized = {
    version: number;
    labels: string[];
    vectorizer: VectorizerSerialized;
    weights: number[];
    bias: number[];
    options: {
        epochs: number;
        learningRate: number;
        l2: number;
        margin: number;
        maxFeatures: number;
        useNativeScoring?: boolean;
        useNativeTraining?: boolean;
    };
};
declare class LogisticTextClassifier {
    private readonly options;
    private vectorizer;
    private labels;
    private weights;
    private bias;
    constructor(options?: {
        epochs?: number;
        learningRate?: number;
        l2?: number;
        maxFeatures?: number;
        useNativeScoring?: boolean;
        useNativeTraining?: boolean;
    });
    static fromJSON(payload: LogisticSerialized): LogisticTextClassifier;
    train(examples: LinearModelExample[]): this;
    predict(text: string): Array<{
        label: string;
        probability: number;
        score: number;
    }>;
    classify(text: string): string;
    classifyBatch(texts: string[]): string[];
    evaluate(examples: LinearModelExample[]): {
        accuracy: number;
        total: number;
        correct: number;
    };
    toJSON(): LogisticSerialized;
}
declare class LinearSvmTextClassifier {
    private readonly options;
    private vectorizer;
    private labels;
    private weights;
    private bias;
    constructor(options?: {
        epochs?: number;
        learningRate?: number;
        l2?: number;
        margin?: number;
        maxFeatures?: number;
        useNativeScoring?: boolean;
        useNativeTraining?: boolean;
    });
    static fromJSON(payload: LinearSvmSerialized): LinearSvmTextClassifier;
    train(examples: LinearModelExample[]): this;
    predict(text: string): Array<{
        label: string;
        score: number;
    }>;
    classify(text: string): string;
    classifyBatch(texts: string[]): string[];
    evaluate(examples: LinearModelExample[]): {
        accuracy: number;
        total: number;
        correct: number;
    };
    toJSON(): LinearSvmSerialized;
}
declare function trainLogisticTextClassifier(examples: LinearModelExample[], options?: {
    epochs?: number;
    learningRate?: number;
    l2?: number;
    maxFeatures?: number;
    useNativeScoring?: boolean;
    useNativeTraining?: boolean;
}): LogisticTextClassifier;
declare function trainLinearSvmTextClassifier(examples: LinearModelExample[], options?: {
    epochs?: number;
    learningRate?: number;
    l2?: number;
    margin?: number;
    maxFeatures?: number;
    useNativeScoring?: boolean;
    useNativeTraining?: boolean;
}): LinearSvmTextClassifier;
declare function loadLogisticTextClassifier(payload: LogisticSerialized): LogisticTextClassifier;
declare function loadLinearSvmTextClassifier(payload: LinearSvmSerialized): LinearSvmTextClassifier;

type PerceptronExample = {
    label: string;
    text: string;
};
type PerceptronSerialized = {
    version: number;
    labels: string[];
    vectorizer: VectorizerSerialized;
    weights: number[];
    bias: number[];
    options: {
        epochs: number;
        learningRate: number;
        maxFeatures: number;
        averaged: boolean;
    };
};
declare class PerceptronTextClassifier {
    private readonly options;
    private readonly vectorizer;
    private labels;
    private weights;
    private bias;
    constructor(options?: {
        epochs?: number;
        learningRate?: number;
        maxFeatures?: number;
        averaged?: boolean;
    });
    static fromJSON(payload: PerceptronSerialized): PerceptronTextClassifier;
    train(examples: PerceptronExample[]): this;
    predict(text: string): Array<{
        label: string;
        score: number;
    }>;
    classify(text: string): string;
    evaluate(examples: PerceptronExample[]): {
        accuracy: number;
        total: number;
        correct: number;
    };
    toJSON(): PerceptronSerialized;
}
declare function trainPerceptronTextClassifier(examples: PerceptronExample[], options?: {
    epochs?: number;
    learningRate?: number;
    maxFeatures?: number;
    averaged?: boolean;
}): PerceptronTextClassifier;
declare function loadPerceptronTextClassifier(payload: PerceptronSerialized): PerceptronTextClassifier;

type WordNetPos = "n" | "v" | "a" | "r";
type WordNetMorphPos = WordNetPos | "s";
type WordNetSynset = {
    id: string;
    pos: WordNetPos;
    lemmas: string[];
    senseNums?: number[];
    gloss: string;
    examples: string[];
    hypernyms: string[];
    hyponyms: string[];
    similarTo: string[];
    antonyms: string[];
};
type WordNetMiniPayload = {
    version: number;
    synsets: WordNetSynset[];
};
type WordNetLookupQuery = {
    word: string;
    pos?: WordNetPos;
};
type WordNetLookupResult = WordNetLookupQuery & {
    root: string;
    synsets: WordNetSynset[];
};
declare class WordNet {
    private readonly byId;
    private readonly lemmaIndex;
    private readonly offsetIndex;
    private readonly senseKeyIndex;
    private makeOffsetKey;
    private static sensePosDigit;
    constructor(payload: WordNetMiniPayload);
    private resolveSynset;
    private adjacent;
    synset(id: string): WordNetSynset | null;
    allSynsets(pos?: WordNetPos): WordNetSynset[];
    synsets(word: string, pos?: WordNetPos): WordNetSynset[];
    lookupBatch(queries: readonly WordNetLookupQuery[]): WordNetLookupResult[];
    /** Per-lemma index.<pos> sense numbers; empty when the payload predates senseNums. */
    senseNumsFor(row: WordNetSynset): number[];
    lemmaNames(idOrSynset: string | WordNetSynset): string[];
    lemmas(pos?: WordNetPos): string[];
    protected hasLemma(lemma: string, pos: WordNetPos): boolean;
    _morphy(form: string, pos: WordNetMorphPos, checkExceptions?: boolean): string[];
    morphy(form: string, pos?: WordNetMorphPos | null, checkExceptions?: boolean): string | null;
    synsetFromPosAndOffset(pos: WordNetPos, offset: string | number): WordNetSynset | null;
    synset_from_pos_and_offset(pos: WordNetPos, offset: string | number): WordNetSynset | null;
    synsetFromSenseKey(senseKey: string): WordNetSynset | null;
    synset_from_sense_key(senseKey: string): WordNetSynset | null;
    senseKeys(word: string, pos?: WordNetPos): string[];
    hypernyms(idOrSynset: string | WordNetSynset): WordNetSynset[];
    hyponyms(idOrSynset: string | WordNetSynset): WordNetSynset[];
    similarTo(idOrSynset: string | WordNetSynset): WordNetSynset[];
    antonyms(idOrSynset: string | WordNetSynset): WordNetSynset[];
    hypernymPaths(idOrSynset: string | WordNetSynset, options?: {
        maxDepth?: number;
    }): WordNetSynset[][];
    shortestPathDistance(left: string | WordNetSynset, right: string | WordNetSynset, options?: {
        maxDepth?: number;
    }): number | null;
    pathSimilarity(left: string | WordNetSynset, right: string | WordNetSynset, options?: {
        maxDepth?: number;
    }): number | null;
    lowestCommonHypernyms(left: string | WordNetSynset, right: string | WordNetSynset, options?: {
        maxDepth?: number;
    }): WordNetSynset[];
}
declare function loadWordNetMini(path?: string): WordNet;
declare function loadWordNetExtended(path?: string): WordNet;
declare function loadWordNetPacked(path?: string): WordNet;
declare function loadWordNet(path?: string): WordNet;

declare class RegexpStemmer {
    private readonly regexp;
    private readonly globalRegexp;
    private readonly min;
    constructor(regexp: RegExp | string, min?: number);
    stem(word: string): string;
    toString(): string;
}
declare class LancasterStemmer {
    static readonly defaultRuleTuple: readonly string[];
    ruleDictionary: Record<string, string[]>;
    readonly stripPrefixFlag: boolean;
    readonly ruleTuple: readonly string[];
    constructor(ruleTuple?: readonly string[] | null, stripPrefixFlag?: boolean);
    parseRules(ruleTuple?: readonly string[] | null): void;
    stem(word: string): string;
    private doStemming;
    private getLastLetter;
    private isAcceptable;
    private applyRule;
    private stripPrefix;
    toString(): string;
}
/**
 * NLTK-compatible Snowball stemmer backed by real Snowball (Porter2-family)
 * implementations in ./snowball. Unsupported languages throw an Error
 * (mirroring NLTK's ValueError), both at construction time and via
 * {@link snowballStem}.
 *
 * `ignoreStopwords` mirrors NLTK's `ignore_stopwords`: the language's NLTK
 * stopwords list is loaded at construction (a language without a list raises
 * the same `'<X>Stemmer> has no list of stopwords' error NLTK raises), and
 * `stem` returns a stopword unchanged (lowercased, except Russian which is
 * checked un-normalized). The `porter` language delegates to the classic
 * {@link PorterStemmer} exactly like NLTK's snowball.PorterStemmer.
 */
declare class SnowballStemmer {
    static readonly languages: readonly string[];
    readonly language: string;
    readonly stopwords: Set<string>;
    readonly stemmer: {
        stem(word: string): string;
    };
    constructor(language?: string, ignoreStopwords?: boolean);
    stem(word: string): string;
}
declare const ArabicStemmer: {
    new (ignoreStopwords?: boolean): {
        readonly language: string;
        readonly stopwords: Set<string>;
        readonly stemmer: {
            stem(word: string): string;
        };
        stem(word: string): string;
    };
    readonly languages: readonly string[];
};
declare const DanishStemmer: {
    new (ignoreStopwords?: boolean): {
        readonly language: string;
        readonly stopwords: Set<string>;
        readonly stemmer: {
            stem(word: string): string;
        };
        stem(word: string): string;
    };
    readonly languages: readonly string[];
};
declare const DutchStemmer: {
    new (ignoreStopwords?: boolean): {
        readonly language: string;
        readonly stopwords: Set<string>;
        readonly stemmer: {
            stem(word: string): string;
        };
        stem(word: string): string;
    };
    readonly languages: readonly string[];
};
declare const EnglishStemmer: {
    new (ignoreStopwords?: boolean): {
        readonly language: string;
        readonly stopwords: Set<string>;
        readonly stemmer: {
            stem(word: string): string;
        };
        stem(word: string): string;
    };
    readonly languages: readonly string[];
};
declare const FinnishStemmer: {
    new (ignoreStopwords?: boolean): {
        readonly language: string;
        readonly stopwords: Set<string>;
        readonly stemmer: {
            stem(word: string): string;
        };
        stem(word: string): string;
    };
    readonly languages: readonly string[];
};
declare const FrenchStemmer: {
    new (ignoreStopwords?: boolean): {
        readonly language: string;
        readonly stopwords: Set<string>;
        readonly stemmer: {
            stem(word: string): string;
        };
        stem(word: string): string;
    };
    readonly languages: readonly string[];
};
declare const GermanStemmer: {
    new (ignoreStopwords?: boolean): {
        readonly language: string;
        readonly stopwords: Set<string>;
        readonly stemmer: {
            stem(word: string): string;
        };
        stem(word: string): string;
    };
    readonly languages: readonly string[];
};
declare const HungarianStemmer: {
    new (ignoreStopwords?: boolean): {
        readonly language: string;
        readonly stopwords: Set<string>;
        readonly stemmer: {
            stem(word: string): string;
        };
        stem(word: string): string;
    };
    readonly languages: readonly string[];
};
declare const ItalianStemmer: {
    new (ignoreStopwords?: boolean): {
        readonly language: string;
        readonly stopwords: Set<string>;
        readonly stemmer: {
            stem(word: string): string;
        };
        stem(word: string): string;
    };
    readonly languages: readonly string[];
};
declare const NorwegianStemmer: {
    new (ignoreStopwords?: boolean): {
        readonly language: string;
        readonly stopwords: Set<string>;
        readonly stemmer: {
            stem(word: string): string;
        };
        stem(word: string): string;
    };
    readonly languages: readonly string[];
};
declare const PortugueseStemmer: {
    new (ignoreStopwords?: boolean): {
        readonly language: string;
        readonly stopwords: Set<string>;
        readonly stemmer: {
            stem(word: string): string;
        };
        stem(word: string): string;
    };
    readonly languages: readonly string[];
};
declare const RomanianStemmer: {
    new (ignoreStopwords?: boolean): {
        readonly language: string;
        readonly stopwords: Set<string>;
        readonly stemmer: {
            stem(word: string): string;
        };
        stem(word: string): string;
    };
    readonly languages: readonly string[];
};
declare const RussianStemmer: {
    new (ignoreStopwords?: boolean): {
        readonly language: string;
        readonly stopwords: Set<string>;
        readonly stemmer: {
            stem(word: string): string;
        };
        stem(word: string): string;
    };
    readonly languages: readonly string[];
};
declare const SpanishStemmer: {
    new (ignoreStopwords?: boolean): {
        readonly language: string;
        readonly stopwords: Set<string>;
        readonly stemmer: {
            stem(word: string): string;
        };
        stem(word: string): string;
    };
    readonly languages: readonly string[];
};
declare const SwedishStemmer: {
    new (ignoreStopwords?: boolean): {
        readonly language: string;
        readonly stopwords: Set<string>;
        readonly stemmer: {
            stem(word: string): string;
        };
        stem(word: string): string;
    };
    readonly languages: readonly string[];
};
declare class WordNetLemmatizer {
    _morphy(form: string, pos?: string, checkExceptions?: boolean): string[];
    morphy(form: string, pos?: string | null, checkExceptions?: boolean): string | null;
    lemmatize(word: string, pos?: string): string;
    toString(): string;
}

type VaderPolarity = {
    neg: number;
    neu: number;
    pos: number;
    compound: number;
};
type VaderOptions = {
    lexicon?: Record<string, number>;
    lexiconFile?: string;
};
declare class SentiText {
    readonly text: string;
    readonly PUNC_LIST: readonly string[];
    readonly REGEX_REMOVE_PUNCTUATION: RegExp;
    readonly words_and_emoticons: string[];
    readonly is_cap_diff: boolean;
    constructor(text: string, puncList?: readonly string[], regexRemovePunctuation?: RegExp);
    private _words_plus_punc;
    private _words_and_emoticons;
    allcap_differential(words: readonly string[]): boolean;
}
declare class VaderConstants {
    readonly B_INCR = 0.293;
    readonly B_DECR = -0.293;
    readonly C_INCR = 0.733;
    readonly N_SCALAR = -0.74;
    readonly NEGATE: Set<string>;
    readonly BOOSTER_DICT: Readonly<Record<string, number>>;
    readonly PUNC_LIST: string[];
    readonly REGEX_REMOVE_PUNCTUATION: RegExp;
    negated(inputWords: readonly string[], includeNt?: boolean): boolean;
    normalize(score: number, alpha?: number): number;
    scalar_inc_dec(word: string, valence: number, isCapDiff: boolean): number;
}
declare class SentimentIntensityAnalyzer {
    readonly constants: VaderConstants;
    readonly lexicon: Readonly<Record<string, number>>;
    readonly lexicon_file: string;
    constructor(lexiconFile?: string | null);
    constructor(options?: VaderOptions);
    private resolveLexiconFile;
    /** NLTK ``make_lex_dict``: ``word\tmeasure`` lines → dict. */
    makeLexDict(lexiconFile?: string): Record<string, number>;
    make_lex_dict(): Record<string, number>;
    /** NLTK ``sentiment_valence``: scores one item, appends to sentiments. */
    sentimentValence(valence: number, sentitext: SentiText, item: string, i: number, sentiments: number[]): number[];
    sentiment_valence(valence: number, sentitext: SentiText, item: string, i: number, sentiments: number[]): number[];
    private leastCheck;
    /** NLTK ``score_valence``: sentiments → {neg,neu,pos,compound}. */
    scoreValence(sentiments: readonly number[], text: string): VaderPolarity;
    score_valence(sentiments: readonly number[], text: string): VaderPolarity;
    polarityScores(text: string): VaderPolarity;
    polarity_scores(text: string): VaderPolarity;
}

type PerceptronTaggerModelSerialized = {
    version: number;
    type: string;
    tags: string[];
    feature_count: number;
    tag_count: number;
    feature_index: Record<string, number>;
    weights: number[];
    metadata?: Record<string, unknown>;
};
type PerceptronTaggerModel = {
    version: number;
    tags: string[];
    featureCount: number;
    tagCount: number;
    featureIndex: Record<string, number>;
    weights: Float32Array;
    metadata?: Record<string, unknown>;
};
type PerceptronTaggedToken = {
    token: string;
    tag: string;
    tagId: number;
    start: number;
    length: number;
};
declare function preparePerceptronTaggerModel(payload: PerceptronTaggerModelSerialized): PerceptronTaggerModel;
declare function loadPerceptronTaggerModel(path?: string): PerceptronTaggerModel;
type PerceptronTaggerOptions$1 = {
    model?: PerceptronTaggerModel;
    wasm?: WasmNltk;
    useWasm?: boolean;
    useNative?: boolean;
};
declare function posTagPerceptronAscii(text: string, options?: PerceptronTaggerOptions$1): PerceptronTaggedToken[];

type PerceptronWeights = Record<string, Record<string, number>>;
type PerceptronFeatures = Record<string, number>;
declare class AveragedPerceptron {
    weights: PerceptronWeights;
    classes: Set<string>;
    private readonly totals;
    private readonly tstamps;
    i: number;
    constructor(weights?: PerceptronWeights);
    predict(features: PerceptronFeatures): [string | null, number | null];
    update(truth: string, guess: string | null, features: PerceptronFeatures): void;
    averageWeights(): void;
    encodeJsonObj(): PerceptronWeights;
}

declare const MAX_PARSE_TREES = 1000000;
type EdgeKey = string;
declare abstract class EdgeI {
    abstract span(): [number, number];
    start(): number;
    end(): number;
    length(): number;
    abstract lhs(): GrammarSymbol;
    abstract rhs(): readonly GrammarSymbol[];
    abstract dot(): number;
    abstract nextsym(): GrammarSymbol | null;
    abstract is_complete(): boolean;
    isComplete(): boolean;
    is_incomplete(): boolean;
    isIncomplete(): boolean;
    abstract key(): EdgeKey;
}
declare class TreeEdge extends EdgeI {
    private readonly _span;
    private readonly _lhs;
    private readonly _rhs;
    private readonly _dot;
    constructor(_span: [number, number], _lhs: GrammarSymbol, _rhs: readonly GrammarSymbol[], _dot?: number);
    static from_production(production: Production, index: number): TreeEdge;
    static fromProduction(production: Production, index: number): TreeEdge;
    move_dot_forward(newEnd: number): TreeEdge;
    moveDotForward(newEnd: number): TreeEdge;
    lhs(): GrammarSymbol;
    span(): [number, number];
    rhs(): readonly GrammarSymbol[];
    dot(): number;
    is_complete(): boolean;
    nextsym(): GrammarSymbol | null;
    key(): EdgeKey;
    toString(): string;
}
declare class LeafEdge extends EdgeI {
    private readonly leaf;
    private readonly index;
    constructor(leaf: string, index: number);
    lhs(): GrammarSymbol;
    span(): [number, number];
    rhs(): readonly GrammarSymbol[];
    dot(): number;
    is_complete(): boolean;
    nextsym(): GrammarSymbol | null;
    key(): EdgeKey;
    toString(): string;
}
type TreeFactory<T> = (label: string, children: Array<T | string>) => T;
declare class Chart {
    private _tokens;
    private _numLeaves;
    private _edges;
    private _edgeOrder;
    private _edgeToCpls;
    private _indexes;
    constructor(tokens: Iterable<string>);
    initialize(): void;
    num_leaves(): number;
    numLeaves(): number;
    leaf(index: number): string;
    leaves(): string[];
    edges(): EdgeI[];
    iteredges(): IterableIterator<EdgeI>;
    [Symbol.iterator](): IterableIterator<EdgeI>;
    num_edges(): number;
    numEdges(): number;
    select(restrictions?: Record<string, unknown>): EdgeI[];
    private _edgeAttr;
    private _addIndex;
    private _registerWithIndexes;
    insert_with_backpointer(newEdge: EdgeI, previousEdge: EdgeI, childEdge: EdgeI): boolean;
    insertWithBackpointer(newEdge: EdgeI, previousEdge: EdgeI, childEdge: EdgeI): boolean;
    insert(edge: EdgeI, ...childPointerLists: EdgeI[][]): boolean;
    child_pointer_lists(edge: EdgeI): EdgeI[][];
    childPointerLists(edge: EdgeI): EdgeI[][];
    parses<T = ParseTree>(root: Nonterminal, treeClass?: TreeFactory<T>): Generator<T>;
    trees<T = ParseTree>(edge: EdgeI, options?: {
        treeClass?: TreeFactory<T>;
        complete?: boolean;
    }): T[];
    private _spend;
    private _trees;
    pretty_format_edge(edge: EdgeI, width?: number): string;
    prettyFormatEdge(edge: EdgeI, width?: number): string;
    pretty_format_leaves(width?: number): string;
    prettyFormatLeaves(width?: number): string;
    pretty_format(width?: number): string;
    prettyFormat(width?: number): string;
}
declare abstract class AbstractChartRule {
    abstract readonly NUM_EDGES: number;
    abstract apply(chart: Chart, grammar: CFG, ...edges: EdgeI[]): Iterable<EdgeI>;
    apply_everywhere(chart: Chart, grammar: CFG): Generator<EdgeI>;
    applyEverywhere(chart: Chart, grammar: CFG): Generator<EdgeI>;
    toString(): string;
}
declare class FundamentalRule extends AbstractChartRule {
    readonly NUM_EDGES: number;
    apply(chart: Chart, _grammar: CFG, leftEdge: EdgeI, rightEdge: EdgeI): Generator<EdgeI>;
}
declare class SingleEdgeFundamentalRule extends FundamentalRule {
    readonly NUM_EDGES: number;
    apply(chart: Chart, grammar: CFG, edge: EdgeI): Generator<EdgeI>;
    protected _applyComplete(chart: Chart, _grammar: CFG, rightEdge: EdgeI): Generator<EdgeI>;
    protected _applyIncomplete(chart: Chart, _grammar: CFG, leftEdge: EdgeI): Generator<EdgeI>;
}
declare class LeafInitRule extends AbstractChartRule {
    readonly NUM_EDGES: number;
    apply(chart: Chart): Generator<EdgeI>;
}
declare class TopDownInitRule extends AbstractChartRule {
    readonly NUM_EDGES: number;
    apply(chart: Chart, grammar: CFG): Generator<EdgeI>;
}
declare class TopDownPredictRule extends AbstractChartRule {
    readonly NUM_EDGES: number;
    apply(chart: Chart, grammar: CFG, edge: EdgeI): Generator<EdgeI>;
}
declare class CachedTopDownPredictRule extends TopDownPredictRule {
    private done;
    apply(chart: Chart, grammar: CFG, edge: EdgeI): Generator<EdgeI>;
}
declare class BottomUpPredictRule extends AbstractChartRule {
    readonly NUM_EDGES: number;
    apply(chart: Chart, grammar: CFG, edge: EdgeI): Generator<EdgeI>;
}
declare class BottomUpPredictCombineRule extends BottomUpPredictRule {
    apply(chart: Chart, grammar: CFG, edge: EdgeI): Generator<EdgeI>;
}
declare class EmptyPredictRule extends AbstractChartRule {
    readonly NUM_EDGES: number;
    apply(chart: Chart, grammar: CFG): Generator<EdgeI>;
}
declare class FilteredSingleEdgeFundamentalRule extends SingleEdgeFundamentalRule {
    protected _applyComplete(chart: Chart, grammar: CFG, rightEdge: EdgeI): Generator<EdgeI>;
    protected _applyIncomplete(chart: Chart, grammar: CFG, leftEdge: EdgeI): Generator<EdgeI>;
}
declare class FilteredBottomUpPredictCombineRule extends BottomUpPredictCombineRule {
    apply(chart: Chart, grammar: CFG, edge: EdgeI): Generator<EdgeI>;
}
declare const TD_STRATEGY: (CachedTopDownPredictRule | LeafInitRule | SingleEdgeFundamentalRule | TopDownInitRule)[];
declare const BU_STRATEGY: (BottomUpPredictRule | EmptyPredictRule | LeafInitRule | SingleEdgeFundamentalRule)[];
declare const BU_LC_STRATEGY: (BottomUpPredictCombineRule | EmptyPredictRule | LeafInitRule | SingleEdgeFundamentalRule)[];
declare const LC_STRATEGY: (FilteredBottomUpPredictCombineRule | FilteredSingleEdgeFundamentalRule | LeafInitRule)[];
interface ChartParserOptions {
    strategy?: readonly AbstractChartRule[];
    trace?: number;
    traceChartWidth?: number;
    useAgenda?: boolean;
    chartClass?: new (tokens: Iterable<string>) => Chart;
}
declare class NltkChartParser {
    protected _grammar: CFG;
    protected _strategy: readonly AbstractChartRule[];
    protected _trace: number;
    private readonly _traceChartWidth;
    private _useAgenda;
    private readonly _chartClass;
    private readonly _axioms;
    private readonly _inferenceRules;
    constructor(grammar: CFG, options?: ChartParserOptions);
    grammar(): CFG;
    private _traceNewEdges;
    chart_parse(tokens: Iterable<string>, trace?: number): Chart;
    chartParse(tokens: Iterable<string>, trace?: number): Chart;
    iterParse<T = ParseTree>(tokens: Iterable<string>, treeClass?: TreeFactory<T>): Generator<T>;
    parse<T = ParseTree>(tokens: Iterable<string>, treeClass?: TreeFactory<T>): T[];
    parse_one<T = ParseTree>(tokens: Iterable<string>, treeClass?: TreeFactory<T>): T | null;
    parseOne<T = ParseTree>(tokens: Iterable<string>, treeClass?: TreeFactory<T>): T | null;
    parse_all<T = ParseTree>(tokens: Iterable<string>, treeClass?: TreeFactory<T>): T[];
    parseAll<T = ParseTree>(tokens: Iterable<string>, treeClass?: TreeFactory<T>): T[];
    parse_sents<T = ParseTree>(sents: Iterable<Iterable<string>>, treeClass?: TreeFactory<T>): Generator<T[]>;
    parseSents<T = ParseTree>(sents: Iterable<Iterable<string>>, treeClass?: TreeFactory<T>): T[][];
}
declare class TopDownChartParser extends NltkChartParser {
    constructor(grammar: CFG, options?: Omit<ChartParserOptions, "strategy">);
}
declare class BottomUpChartParser extends NltkChartParser {
    constructor(grammar: CFG, options?: Omit<ChartParserOptions, "strategy">);
}
declare class BottomUpLeftCornerChartParser extends NltkChartParser {
    constructor(grammar: CFG, options?: Omit<ChartParserOptions, "strategy">);
}
/** nltk.parse.chart.SteppingChartParser — step through parsing one edge at a time. */
declare class SteppingChartParser extends NltkChartParser {
    private _chart;
    private _current_chartrule;
    private _restart;
    constructor(grammar: CFG, options?: ChartParserOptions);
    initialize(tokens: Iterable<string>): void;
    step(): Generator<EdgeI | null>;
    private _parse;
    strategy(): readonly AbstractChartRule[];
    chart(): Chart | null;
    current_chartrule(): AbstractChartRule | null;
    parses<T = ParseTree>(treeClass?: TreeFactory<T>): Generator<T>;
    set_strategy(strategy: readonly AbstractChartRule[]): void;
    setStrategy(strategy: readonly AbstractChartRule[]): void;
    set_grammar(grammar: CFG): void;
    setGrammar(grammar: CFG): void;
    set_chart(chart: Chart): void;
    setChart(chart: Chart): void;
    parse<T = ParseTree>(tokens: Iterable<string>, treeClass?: TreeFactory<T>): T[];
}

declare class FeatureCFG {
    readonly grammar: FeatureCfgGrammar;
    constructor(grammar: FeatureCfgGrammar);
    static fromstring(grammarText: string, options?: {
        startSymbol?: string;
    }): FeatureCFG;
}
declare class ChartParser extends NltkChartParser {
    protected readonly cfgGrammar: CfgGrammar;
    constructor(grammar: CFG | CfgGrammar | string, options?: ChartParserOptions);
    parse<T = ParseTree>(tokens: Iterable<string>): T[];
}
declare class EarleyChartParser extends ChartParser {
    parse<T = ParseTree>(tokens: Iterable<string>): T[];
}
declare class RecursiveDescentParser extends ChartParser {
    parse<T = ParseTree>(tokens: Iterable<string>): T[];
}
declare class LeftCornerChartParser extends ChartParser {
    parse<T = ParseTree>(tokens: Iterable<string>): T[];
}
declare class ViterbiParser {
    private readonly grammar;
    constructor(grammar: PCFG | PcfgGrammar | string);
    parse(tokens: string[]): ProbabilisticParse[];
    parseOne(tokens: string[]): ProbabilisticParse | null;
}
declare class FeatureChartParser {
    protected readonly grammar: FeatureCfgGrammar;
    constructor(grammar: FeatureCFG | FeatureCfgGrammar | string);
    parse(tokens: string[]): ParseTree[];
    parseOne(tokens: string[]): ParseTree | null;
}
declare class FeatureEarleyChartParser extends FeatureChartParser {
    parse(tokens: string[]): ParseTree[];
}
interface PerceptronTaggerOptions {
    load?: boolean;
    lang?: string;
    loc?: string | null;
    model?: PerceptronTaggerModel;
}
declare class PerceptronTagger {
    readonly jsonTag = "nltk.tag.perceptron.PerceptronTagger";
    static readonly START: readonly ["-START-", "-START2-"];
    static readonly END: readonly ["-END-", "-END2-"];
    model: AveragedPerceptron;
    tagdict: Record<string, string>;
    classes: Set<string>;
    lang: string;
    saveDir: string;
    sentences: GoldSentence[] | null;
    private packed;
    constructor(load?: boolean, lang?: string, loc?: string | null);
    constructor(options?: PerceptronTaggerOptions);
    constructor(model?: PerceptronTaggerModel | string);
    paramFiles(lang?: string): string[];
    normalize(word: string): string;
    getFeatures(i: number, word: string, context: readonly string[], prev: string, prev2: string): Record<string, number>;
    makeTagdict(sentences: readonly GoldSentence[]): void;
    tag(tokens: string[], returnConf?: false, useTagdict?: boolean): Array<[string, string]>;
    tag(tokens: string[], returnConf: true, useTagdict?: boolean): Array<[string, string, number | null]>;
    tag_sents(sentences: string[][]): Array<Array<[string, string]>>;
    tagSents(sentences: string[][]): Array<Array<[string, string]>>;
    tagText(text: string): Array<[string, string]>;
    train(sentences: readonly GoldSentence[], saveLoc?: string | null, nrIter?: number): void;
    encodeJsonObj(): [Record<string, Record<string, number>>, Record<string, string>, string[]];
    decodeJsonParams(params: [Record<string, Record<string, number>>, Record<string, string>, string[]]): void;
    encodeJsonParams(): [Record<string, Record<string, number>>, Record<string, string>, string[]];
    saveToJson(lang?: string, loc?: string | null): Promise<void>;
    loadFromJson(lang?: string, loc?: string | null): void;
    accuracy(gold: readonly GoldSentence[]): number;
    evaluate(gold: readonly GoldSentence[]): number;
    confusion(gold: readonly GoldSentence[]): ConfusionMatrix;
    precision(gold: readonly GoldSentence[]): Map<string, number>;
    recall(gold: readonly GoldSentence[]): Map<string, number>;
    fMeasure(gold: readonly GoldSentence[], alpha?: number): Map<string, number>;
    f_measure(gold: readonly GoldSentence[], alpha?: number): Map<string, number>;
    evaluatePerTag(gold: readonly GoldSentence[], options?: {
        alpha?: number;
        truncate?: number | null;
        sortByCount?: boolean;
    }): string;
}
declare function posTag(tokens: string[], options?: {
    model?: PerceptronTaggerModel | string;
}): Array<[string, string]>;
declare function posTag(text: string, options?: {
    model?: PerceptronTaggerModel | string;
}): Array<[string, string]>;
declare const pos_tag: typeof posTag;

declare function treeLeaves(tree: ParseTree): string[];
declare function treeDepth(tree: ParseTree): number;
declare function treeToBracket(tree: ParseTree): string;
declare function bracketToTree(text: string): ParseTree;
declare function mapTreeLabels(tree: ParseTree, fn: (label: string) => string): ParseTree;
declare function collapseUnaryChains(tree: ParseTree): ParseTree;

type DependencyArc = {
    head: number;
    dep: number;
    relation: string;
};
type DependencyParse = {
    tokens: string[];
    posTags: string[];
    root: number;
    arcs: DependencyArc[];
};
declare function dependencyParse(tokens: string[], posTags?: string[]): DependencyParse;
declare function dependencyParseText(text: string, options?: {
    normalizeTokens?: boolean;
}): DependencyParse;

type Synset$1 = WordNetSynset;
declare function synsetDefinition(synset: Synset$1): string;
declare function lesk(contextSentence: string[], ambiguousWord: string, pos?: string | number, synsets?: Synset$1[]): Synset$1 | null;

/**
 * Port of `nltk.metrics.agreement` (NLTK 3.10.3): annotation-task agreement
 * coefficients computed from (coder, item, label) triples, optionally
 * parameterized by a distance metric between labels.
 *
 * Notation follows Artstein and Poesio (2007), as in the NLTK original.
 *
 * Supported coefficients:
 *  - observed agreement (`ao`, `avgAo`)
 *  - Bennett, Albert and Goldstein 1954 (`s`)
 *  - Scott 1955 multi-pi (`pi`)
 *  - Cohen 1960 kappa (`kappa`)
 *  - Davies and Fleiss 1982 multi-kappa (`multiKappa`)
 *  - Krippendorff 1980 alpha (`alpha`)
 *  - Cohen 1968 weighted kappa (`weightedKappa`, `doKw`)
 *
 * Additionally, the classic Fleiss (1971) kappa is provided as
 * {@link AnnotationTask.fleissKappa}; NLTK itself only exposes the
 * Davies-Fleiss variant under `multi_kappa`.
 */
/** A label assigned by a coder. Set-valued labels enable MASI-style distances. */
type AnnotationLabel = string | number | Set<string | number>;
/** One annotation result: `(coder, item, label)`, mirroring NLTK triples. */
type AnnotationTriple = readonly [coder: string, item: string, label: AnnotationLabel];
/**
 * Distance metric between two labels, returning a value in [0, 1].
 * Mirrors NLTK's `distance` argument (default `binary_distance`).
 */
type AgreementDistanceFn = (label1: AnnotationLabel, label2: AnnotationLabel) => number;
interface AnnotationRow {
    coder: string;
    item: string;
    label: AnnotationLabel;
    /** Canonical identity of the label (Python relies on label hashability here). */
    key: string;
}
/** Frequency map keyed by canonical label key, keeping one representative label. */
type LabelFreqs = Map<string, {
    label: AnnotationLabel;
    count: number;
}>;
/**
 * Represents an annotation task, i.e. people assign labels to items.
 *
 * Direct port of `nltk.metrics.agreement.AnnotationTask`. Coders and items are
 * strings (any hashable object in Python); labels may be scalars or sets (the
 * MASI metric requires set-valued labels, as in NLTK).
 *
 * GOTCHA: NLTK's `binary_distance` works on frozenset labels because Python
 * compares them by value; JS `Set` objects compare by identity, so pass a
 * value-equality distance (e.g. {@link masiDistance} from
 * `./distance_metrics`) when using set-valued labels.
 */
declare class AnnotationTask {
    private readonly distanceFn;
    private readonly rows;
    /** Unique items (NLTK `self.I`). */
    private readonly items;
    /** Unique coders (NLTK `self.C`). */
    private readonly coders;
    /** Unique labels (NLTK `self.K`). */
    private readonly labelKeys;
    private readonly labelByKey;
    constructor(data?: Iterable<AnnotationTriple>, distance?: AgreementDistanceFn);
    /**
     * Load a sequence of `(coder, item, label)` triples, appending to any data
     * already loaded. Port of `AnnotationTask.load_array`.
     */
    loadArray(array: Iterable<AnnotationTriple>): void;
    /**
     * Agreement between two coders on a given item.
     * Port of `AnnotationTask.agr`; throws when a coder has no annotation for
     * the item (NLTK raises `StopIteration`).
     */
    agr(cA: string, cB: string, item: string, rows?: readonly AnnotationRow[]): number;
    /** Count of annotations carrying label `key` (NLTK `Nk`). */
    Nk(key: string): number;
    /** Count of annotations of label `key` on item `i` (NLTK `Nik`). */
    Nik(i: string, key: string): number;
    /** Count of annotations of label `key` by coder `c` (NLTK `Nck`). */
    Nck(c: string, key: string): number;
    /**
     * Observed agreement between two coders on all items.
     * Port of `AnnotationTask.Ao`: the per-item agreements are summed and
     * divided by the TOTAL number of items in the task (`len(self.I)`), so items
     * missed by both coders silently lower the score — exactly as in NLTK.
     */
    ao(cA: string, cB: string): number;
    private pairwiseAverage;
    /** Average observed agreement across all coders and items (NLTK `avg_Ao`). */
    avgAo(): number;
    /**
     * The observed disagreement for the weighted kappa coefficient,
     * averaged over all coder pairs (NLTK `Do_Kw`).
     */
    doKw(maxDistance?: number): number;
    /** Observed disagreement between two coders (NLTK `Do_Kw_pairwise`). */
    doKwPairwise(cA: string, cB: string, maxDistance?: number): number;
    /** Bennett, Albert and Goldstein 1954 (NLTK `S`). */
    s(): number;
    /**
     * Scott 1955 multi-pi; equivalent to K from Siegel and Castellan (1988)
     * (NLTK `pi`).
     */
    pi(): number;
    /** Expected agreement for Cohen's kappa between two coders (NLTK `Ae_kappa`). */
    aeKappa(cA: string, cB: string): number;
    /** Cohen's kappa for one coder pair (NLTK `kappa_pairwise`). */
    kappaPairwise(cA: string, cB: string): number;
    /**
     * Cohen 1960 kappa; averages naively over kappas for each coder pair
     * (NLTK `kappa`).
     */
    kappa(): number;
    /**
     * Davies and Fleiss 1982 multi-kappa; averages over observed and expected
     * agreements for each coder pair (NLTK `multi_kappa`).
     */
    multiKappa(): number;
    /**
     * Expected disagreement for a label frequency distribution: the
     * distance-weighted average over all ordered label pairs, normalized by
     * `n * (n - 1)` (NLTK `Disagreement`).
     */
    disagreement(labelFreqs: LabelFreqs): number;
    /**
     * Krippendorff 1980 alpha (NLTK `alpha`).
     *
     * Items with fewer than two annotations are ignored. Degenerate cases mirror
     * NLTK: no labels or a single coder/item raise; a single distinct label
     * returns 1.
     */
    alpha(): number;
    /** Cohen 1968 weighted kappa for one coder pair (NLTK `weighted_kappa_pairwise`). */
    weightedKappaPairwise(cA: string, cB: string, maxDistance?: number): number;
    /** Cohen 1968 weighted kappa, averaged over coder pairs (NLTK `weighted_kappa`). */
    weightedKappa(maxDistance?: number): number;
    /**
     * Classic Fleiss (1971) kappa.
     *
     * NOT present in `nltk.metrics.agreement` (which offers the Davies-Fleiss
     * variant as `multi_kappa`); implemented from the standard definition:
     * each item must receive the same number of ratings `n >= 2`.
     */
    fleissKappa(): number;
}
/**
 * Convenience wrapper mirroring the common NLTK idiom
 * `AnnotationTask(data=[...]).avg_Ao()`.
 */
declare function averageObservedAgreement(data: Iterable<AnnotationTriple>): number;

type BrillToken = [word: string, tag: string];
type BrillSentence = BrillToken[];
type RuleEffect = -1 | 0 | 1;
interface InitialTaggerLike {
    tag(tokens: UntaggedSentence): Array<[string, string | null]>;
}
/**
 * Port of nltk.tbl.feature.Feature — a property-extraction method plus the
 * list of relative positions it applies to.
 */
declare abstract class TblFeature {
    readonly kind: string;
    readonly positions: readonly number[];
    constructor(kind: string, positions: readonly number[] | number, end?: number);
    /** PROPERTY_NAME: subclass-provided name used in rule output; defaults to kind. */
    propertyName(): string;
    className(): string;
    repr(): string;
    key(): string;
    encodeJsonObj(): readonly number[];
    /** nltk.tbl.feature.Feature.decode_json_obj — classmethod. */
    static decodeJsonObj<F extends TblFeature>(this: new (positions: readonly number[]) => F, obj: readonly number[]): F;
    /**
     * One Feature per (start, winlen) slice of `starts`; when excludezero is
     * set, features containing position 0 are dropped.
     */
    static expand<F extends TblFeature>(this: new (positions: readonly number[]) => F, starts: readonly number[], winlens: readonly number[], excludezero?: boolean): F[];
    abstract extractProperty(tokens: ReadonlyArray<readonly [string, string]>, index: number): string;
    /** nltk Feature.__eq__: same class and same positions tuple. */
    equals(other: TblFeature): boolean;
    nequals(other: TblFeature): boolean;
    /** True when this feature looks at all positions that `other` does (same class). */
    issuperset(other: TblFeature): boolean;
    /** True when the position sets intersect (same class). */
    intersects(other: TblFeature): boolean;
    /** nltk quirk: __lt__ is `name_a < name_b or positions_a < positions_b`. */
    lt(other: TblFeature): boolean;
    gt(other: TblFeature): boolean;
    ge(other: TblFeature): boolean;
    le(other: TblFeature): boolean;
}
declare class Word extends TblFeature {
    constructor(positions: readonly number[] | number, end?: number);
    extractProperty(tokens: ReadonlyArray<readonly [string, string]>, index: number): string;
}
declare class Pos extends TblFeature {
    constructor(positions: readonly number[] | number, end?: number);
    extractProperty(tokens: ReadonlyArray<readonly [string, string]>, index: number): string;
}
type Condition = readonly [feature: TblFeature, value: string];
/**
 * Port of nltk.tbl.rule.TagRule — the abstract rule that maps an original tag
 * to a replacement tag wherever `applies` holds.
 */
declare abstract class TagRule {
    readonly originalTag: string;
    readonly replacementTag: string;
    constructor(originalTag: string, replacementTag: string);
    /**
     * Apply this rule at every position in `positions` where it applies; the
     * tag change is computed in a separate step so the rule does not interact
     * with itself. Returns the indices whose tags were changed.
     */
    apply(tokens: Array<readonly [string, string]>, positions?: readonly number[]): number[];
    /** True if the rule would change the tag of tokens[index]. */
    abstract applies(tokens: ReadonlyArray<readonly [string, string]>, index: number): boolean;
    /** nltk quirk: TagRule.__eq__/__ne__/__hash__ unconditionally raise TypeError. */
    equals(_other: unknown): boolean;
    nequals(_other: unknown): boolean;
    hash(): number;
}
declare class TblRule extends TagRule {
    #private;
    readonly templateid: string;
    readonly conditions: readonly Condition[];
    constructor(templateid: string, originalTag: string, replacementTag: string, conditions: readonly Condition[]);
    encodeJsonObj(): {
        templateid: string;
        original: string;
        replacement: string;
        conditions: readonly Condition[];
    };
    static decodeJsonObj(obj: {
        templateid: string;
        original: string;
        replacement: string;
        conditions: readonly Condition[];
    }): TblRule;
    equals(other: unknown): boolean;
    repr(): string;
    key(): string;
    toString(): string;
    applies(tokens: ReadonlyArray<readonly [string, string]>, index: number): boolean;
    hash(): number;
    /** nltk.tbl.rule.Rule.format — "str" | "repr" | "verbose". */
    format(fmt: string): string;
    verboseFormat(): string;
}
/** nltk.tbl.template.BrillTemplateI — interface for rule-generating templates. */
declare abstract class BrillTemplateI {
    /**
     * Return the rules that would correct the index-th token's tag to
     * `correctTag`; empty when the token already has the correct tag.
     */
    abstract applicableRules(tokens: ReadonlyArray<readonly [string, string]>, index: number, correctTag: string): TblRule[];
    /** Indices on which applicable_rules may depend (used by the fast trainer). */
    abstract getNeighborhood(tokens: ReadonlyArray<unknown>, index: number): number[];
}
declare function clearTemplateRegistry(): void;
type FeatureConstructor = new (positions: readonly number[] | number, end?: number) => TblFeature;
declare class Template extends BrillTemplateI {
    readonly id: string;
    readonly features: readonly TblFeature[];
    constructor(...features: Array<TblFeature | FeatureConstructor | readonly [number, number]>);
    repr(): string;
    applicableRules(tokens: ReadonlyArray<readonly [string, string]>, index: number, correctTag: string): TblRule[];
    getNeighborhood(tokens: ReadonlyArray<unknown>, index: number): number[];
    /**
     * nltk.tbl.template.Template.expand — mass-generate Templates from lists of
     * Features. `combinations` selects how many feature lists are drawn per
     * Template: a single int k (exactly k) or [k1, k2] (k1..k2); default 1..n.
     * Superset and (by default) intersecting features are dropped; repr-equal
     * Templates are deduplicated and popped from the registry like nltk.
     */
    static expand(featurelists: ReadonlyArray<readonly TblFeature[]>, combinations?: number | readonly [number, number] | null, skipintersecting?: boolean): Template[];
}
interface BrillTrainingStats {
    min_acc: number | null;
    min_score: number;
    tokencount: number;
    sequencecount: number;
    templatecount: number;
    rulescores: number[];
    initialerrors: number;
    finalerrors: number;
    initialacc: number;
    finalacc: number;
}
declare class BrillTagger {
    #private;
    constructor(initialTagger: InitialTaggerLike, rules: readonly TblRule[], trainingStats?: BrillTrainingStats | null);
    get initialTagger(): InitialTaggerLike;
    rules(): readonly TblRule[];
    trainStats(): BrillTrainingStats | null;
    trainStats<K extends keyof BrillTrainingStats>(statistic: K): BrillTrainingStats[K] | null;
    tag(tokens: UntaggedSentence): BrillSentence;
    tagSents(sentences: ReadonlyArray<UntaggedSentence>): BrillSentence[];
    evaluate(gold: ReadonlyArray<GoldSentence>): number;
}
interface BrillTrainerOptions {
    trace?: number;
    deterministic?: boolean;
}
declare class BrillTaggerTrainer {
    #private;
    constructor(initialTagger: InitialTaggerLike, templates: readonly Template[], options?: BrillTrainerOptions);
    train(trainSents: ReadonlyArray<GoldSentence>, maxRules?: number, minScore?: number, minAcc?: number | null): BrillTagger;
}
interface FeatureSpec {
    kind: string;
    positions: readonly number[];
}
declare function buildTemplates(specs: ReadonlyArray<ReadonlyArray<FeatureSpec>>): Template[];
declare function standardTemplates(): Template[];

type Estimator = (freqdist: FreqDist<string>, bins: number) => ProbDistLike<string>;
declare function untag(taggedSentence: ReadonlyArray<TaggedToken$3>): string[];
declare function untagSents(taggedSentences: ReadonlyArray<GoldSentence>): string[][];
interface HiddenMarkovModelTrainerOptions {
    estimator?: Estimator;
    useNativeDecoding?: boolean;
}
declare class HiddenMarkovModelTrainer {
    states: string[];
    symbols: string[];
    constructor(states?: Iterable<string>, symbols?: Iterable<string>);
    trainSupervised(labeledSequences: ReadonlyArray<GoldSentence>, options?: HiddenMarkovModelTrainerOptions): HiddenMarkovModelTagger;
    /** NLTK `train_supervised` snake_case member. */
    train_supervised(labeledSequences: ReadonlyArray<GoldSentence>, options?: HiddenMarkovModelTrainerOptions): HiddenMarkovModelTagger;
    /** NLTK `train` — alias of `train_supervised` in this port. */
    train(labeledSequences: ReadonlyArray<GoldSentence>, options?: HiddenMarkovModelTrainerOptions): HiddenMarkovModelTagger;
    /** NLTK `train_unsupervised` (Baum-Welch) — not implemented. */
    train_unsupervised(_unlabeledSequences: unknown, _options?: unknown): never;
}
declare class HiddenMarkovModelTagger {
    #private;
    symbols: string[];
    states: string[];
    transitions: ConditionalProbDist<string, string>;
    outputs: ConditionalProbDist<string, string>;
    priors: ProbDistLike<string>;
    constructor(symbols: Iterable<string>, states: Iterable<string>, transitions: ConditionalProbDist<string, string>, outputs: ConditionalProbDist<string, string>, priors: ProbDistLike<string>, options?: {
        useNativeDecoding?: boolean;
    });
    static train(labeledSequence: ReadonlyArray<GoldSentence>, options?: HiddenMarkovModelTrainerOptions): HiddenMarkovModelTagger;
    priorProb(state: string): number;
    priorLogProb(state: string): number;
    transitionProb(fromState: string, toState: string): number;
    transitionLogProb(fromState: string, toState: string): number;
    emissionProb(state: string, symbol: string): number;
    emissionLogProb(state: string, symbol: string): number;
    tag(unlabeledSequence: UntaggedSentence): Array<[string, string]>;
    tagSents(sentences: ReadonlyArray<UntaggedSentence>): Array<Array<[string, string]>>;
    evaluate(gold: ReadonlyArray<GoldSentence>): number;
    bestPath(unlabeledSequence: UntaggedSentence): string[];
    logProbability(sequence: UntaggedSentence | GoldSentence): number;
    probability(sequence: UntaggedSentence | GoldSentence): number;
    forwardProbability(unlabeledSequence: UntaggedSentence): number[][];
    toString(): string;
    tag_sents(sentences: ReadonlyArray<UntaggedSentence>): Array<Array<[string, string]>>;
    best_path(unlabeledSequence: UntaggedSentence): string[];
    log_probability(sequence: UntaggedSentence | GoldSentence): number;
    /** Score accuracy against the gold standard (NLTK `TaggerI.accuracy`). */
    accuracy(gold: ReadonlyArray<GoldSentence>): number;
    /** ConfusionMatrix: gold tags as reference, predictions as test. */
    confusion(gold: ReadonlyArray<GoldSentence>): ConfusionMatrix;
    precision(gold: ReadonlyArray<GoldSentence>): Map<string, number>;
    recall(gold: ReadonlyArray<GoldSentence>): Map<string, number>;
    f_measure(gold: ReadonlyArray<GoldSentence>, alpha?: number): Map<string, number>;
    fMeasure(gold: ReadonlyArray<GoldSentence>, alpha?: number): Map<string, number>;
    evaluate_per_tag(gold: ReadonlyArray<GoldSentence>): string;
    evaluatePerTag(gold: ReadonlyArray<GoldSentence>): string;
}
/**
 * Port of nltk.tag.hmm.logsumexp2 — `log2(sum(2**arr))` computed
 * stably via the max-trick (`arr.max()` on an empty array raises in
 * NLTK/numpy; here it returns -inf like numpy's `max` would not — NLTK
 * always calls it on non-empty arrays).
 */
declare function logsumexp2(arr: readonly number[]): number;
/** nltk.tag.hmm.load_pos — corpus-bound helper; unsupported without nltk_data. */
declare function load_pos(_numSents?: number): never;
/** nltk.tag.hmm.demo — corpus-bound demo; unsupported without nltk_data. */
declare function demo$g(): never;
/** nltk.tag.hmm.demo_pos — corpus-bound demo; unsupported without nltk_data. */
declare function demo_pos(): never;
/** nltk.tag.hmm.demo_bw — corpus-bound Baum-Welch demo; unsupported without nltk_data. */
declare function demo_bw(): never;
/** nltk.tag.hmm.demo_pos_bw — corpus-bound demo; unsupported without nltk_data. */
declare function demo_pos_bw(): never;

declare const APP = "APP";
declare const Tokens: {
    LAMBDA: string;
    LAMBDA_LIST: string[];
    EXISTS: string;
    EXISTS_LIST: string[];
    ALL: string;
    ALL_LIST: string[];
    IOTA: string;
    IOTA_LIST: string[];
    DOT: string;
    OPEN: string;
    CLOSE: string;
    COMMA: string;
    NOT: string;
    NOT_LIST: string[];
    AND: string;
    AND_LIST: string[];
    OR: string;
    OR_LIST: string[];
    IMP: string;
    IMP_LIST: string[];
    IFF: string;
    IFF_LIST: string[];
    EQ: string;
    EQ_LIST: string[];
    NEQ: string;
    NEQ_LIST: string[];
};
declare class LogicalExpressionException extends Error {
    index: number | null;
    constructor(index: number | null, message: string);
}
declare class UnexpectedTokenException extends LogicalExpressionException {
    constructor(index: number | null, unexpected?: string, expected?: string, message?: string);
}
declare class ExpectedMoreTokensException extends LogicalExpressionException {
    constructor(index: number | null, message?: string);
}
declare class UndefinedError extends Error {
    constructor(message: string);
}
declare class Variable {
    readonly name: string;
    constructor(name: string);
    equals(other: Variable): boolean;
    /** NLTK Variable.substitute_bindings: return bound value, or self. */
    substituteBindings(bindings: Map<string, Variable | Expression$1>): Variable | Expression$1;
    toString(): string;
}
declare function is_indvar(expr: string): boolean;
declare function is_funcvar(expr: string): boolean;
declare function is_eventvar(expr: string): boolean;
/** Reset the unique-variable counter (mirrors nltk.internals.Counter state). */
declare function resetUniqueVariableCounter(): void;
/** Next value of the shared unique-variable counter (nltk.internals.Counter.get()). */
declare function nextUniqueCounterValue(): number;
declare function uniqueVariable(pattern?: Variable, ignore?: Set<string>): Variable;
declare const unique_variable: typeof uniqueVariable;
declare class Type {
    static fromstring(s: string): Type;
    equals(other: unknown): boolean;
    matches(_other: Type): boolean;
    resolve(_other: Type): Type | null;
    toString(): string;
    /** NLTK Type.str() — verbose form distinct from __str__. */
    str(): string;
}
declare class ComplexType extends Type {
    first: Type;
    second: Type;
    constructor(first: Type, second: Type);
    equals(other: unknown): boolean;
    matches(other: Type): boolean;
    resolve(other: Type): Type | null;
    toString(): string;
    str(): string;
}
declare class BasicType extends Type {
    equals(other: unknown): boolean;
    matches(other: Type): boolean;
    resolve(other: Type): Type | null;
}
declare class EntityType extends BasicType {
    toString(): string;
    str(): string;
}
declare class TruthValueType extends BasicType {
    toString(): string;
    str(): string;
}
declare class EventType extends BasicType {
    toString(): string;
    str(): string;
}
/** NLTK AnyType(BasicType, ComplexType) — TS single-inherits ComplexType; the
 * BasicType-side behaviors are special-cased via AnyType instanceof checks. */
declare class AnyType extends ComplexType {
    constructor();
    equals(other: unknown): boolean;
    matches(_other: Type): boolean;
    resolve(other: Type): Type | null;
    toString(): string;
    str(): string;
}
declare const TRUTH_TYPE: TruthValueType;
declare const ENTITY_TYPE: EntityType;
declare const EVENT_TYPE: EventType;
declare const ANY_TYPE: AnyType;
/** Port of nltk.sem.logic.read_type. Note: 'v' is NOT accepted by NLTK (only
 * e, t, ?, and <first,second> forms) — divergence preserved. */
declare function read_type(typeString: string): Type;
declare const readType: typeof read_type;
declare class TypeException extends Error {
    constructor(message: string);
}
declare class InconsistentTypeHierarchyException extends TypeException {
    constructor(variable: Expression$1, expression?: Expression$1);
}
declare class TypeResolutionException extends TypeException {
    constructor(expression: Expression$1, otherType: Type);
}
declare class IllegalTypeException extends TypeException {
    constructor(expression: Expression$1, otherType: Type, allowedType: Type);
}
/** A signature maps variable names to type-annotated variable expressions. */
type TypeSignature = Map<string, AbstractVariableExpression[]>;
/**
 * Port of nltk.sem.logic.typecheck: infer and check types across a collection
 * of Expression objects. Returns the (augmented) signature.
 */
declare function typecheck(expressions: Expression$1[], signature?: Record<string, Type | string>): Record<string, Type>;
declare abstract class Expression$1 {
    /** NLTK raises AttributeError when `.type` is read before typechecking or on
     * expressions that carry no stored type; subclasses override as needed. */
    get type(): Type;
    set type(_value: Type);
    abstract str(): string;
    toString(): string;
    /** NLTK __repr__: ``<ClassName str>``. */
    repr(): string;
    abstract equals(other: Expression$1): boolean;
    /** Free (non-bound) variables; includes individual and function variables, not constants. */
    abstract free(): Set<Variable>;
    abstract simplify(): Expression$1;
    abstract replace(variable: Variable, expression: Expression$1, replaceBound?: boolean, alphaConvert?: boolean): Expression$1;
    static fromstring(s: string, typeCheck?: boolean, signature?: Record<string, Type | string>): Expression$1;
    /** All free variables plus ?/@-prefixed predicates and constants (NLTK quirk). */
    variables(): Set<Variable>;
    /**
     * Return a set of individual constants (non-predicates).
     * NLTK implements this via ``visit`` so every composite expression gets it.
     */
    constants(): Set<Variable>;
    /** Return a set of predicates (constants, not variables). */
    predicates(): Set<Variable>;
    normalize(): Expression$1;
    substituteBindings(bindings: Map<string, Variable | Expression$1>): Expression$1;
    applyto(other: Expression$1): ApplicationExpression$1;
    /** Logical equivalence via a theorem prover. Without an explicit prover,
     * delegates to Prover9 — unavailable without the external binary. */
    equiv(other: Expression$1, prover?: {
        prove(e: Expression$1): boolean;
    }): boolean;
    negate(): Expression$1;
    make_VariableExpression(variable: Variable): AbstractVariableExpression;
    /**
     * Port of Expression.typecheck: infer/check types, returning the signature
     * plus any additional type mappings.
     */
    typecheck(signature?: Record<string, Type | string>): Record<string, Type>;
    /** Find the type of `variable` as used in this expression. */
    findtype(variable: Variable): Type;
    /**
     * Set the type of this expression to `otherType`, recording variable
     * expressions in `signature` (NLTK _set_type).
     */
    setType(otherType?: Type, signature?: TypeSignature): void;
    /** Recursively visit subexpressions; combinator aggregates the results. */
    visit<T, R>(fn: (e: Expression$1) => T, combinator: (parts: T[]) => R): R;
    /** Like visit, but the combinator takes the node's own constructor args. */
    visitStructured<T>(fn: (e: Expression$1) => T, combinator: (...parts: unknown[]) => Expression$1): Expression$1;
}
declare class AbstractVariableExpression extends Expression$1 {
    protected _type: Type | undefined;
    get type(): Type;
    set type(value: Type);
    variable: Variable;
    constructor(variable: Variable);
    simplify(): Expression$1;
    replace(variable: Variable, expression: Expression$1, _replaceBound?: boolean, _alphaConvert?: boolean): Expression$1;
    free(): Set<Variable>;
    constants(): Set<Variable>;
    predicates(): Set<Variable>;
    equals(other: Expression$1): boolean;
    /** NLTK _set_type: resolve `otherType` against every recorded use of this
     * variable name, then apply the result to all of them. */
    setType(otherType?: Type, signature?: TypeSignature): void;
    findtype(variable: Variable): Type;
    str(): string;
}
declare class IndividualVariableExpression extends AbstractVariableExpression {
    /** NLTK exposes `type` as a property: reading yields ENTITY_TYPE, assigning
     * runs _set_type (the entity-type check). */
    get type(): Type;
    set type(otherType: Type);
    setType(otherType?: Type, signature?: TypeSignature): void;
    free(): Set<Variable>;
}
declare class FunctionVariableExpression extends AbstractVariableExpression {
    protected _type: Type | undefined;
    free(): Set<Variable>;
}
declare class EventVariableExpression extends IndividualVariableExpression {
    protected _type: Type | undefined;
    /** NLTK stores type as a plain class attribute on EventVariableExpression —
     * reads/writes bypass the individual-variable property. */
    get type(): Type;
    set type(value: Type);
}
declare class ConstantExpression$1 extends AbstractVariableExpression {
    protected _type: Type | undefined;
    setType(otherType?: Type, signature?: TypeSignature): void;
    constants(): Set<Variable>;
}
/** Port of nltk.sem.logic.VariableExpression() — factory dispatching on the
 * variable's lexical class. */
declare function VariableExpression$1(variable: Variable): AbstractVariableExpression;
/** Name-based convenience wrapper around VariableExpression(). */
declare function makeVariableExpression(name: string): AbstractVariableExpression;
/** Upper bound on subexpressions a single beta-reduction may produce
 * (nltk.sem.logic.MAX_SIMPLIFY_SIZE, CWE-400). */
declare const MAX_SIMPLIFY_SIZE = 10000;
declare class ApplicationExpression$1 extends Expression$1 {
    function: Expression$1;
    argument: Expression$1;
    constructor(func: Expression$1, argument: Expression$1);
    /** NLTK property: the result type is the second half of the function's
     * complex type, or ANY_TYPE when the function type is not complex. */
    get type(): Type;
    setType(otherType?: Type, signature?: TypeSignature): void;
    findtype(variable: Variable): Type;
    visit<T, R>(fn: (e: Expression$1) => T, combinator: (parts: T[]) => R): R;
    simplify(): Expression$1;
    replace(variable: Variable, expression: Expression$1, replaceBound?: boolean, alphaConvert?: boolean): Expression$1;
    free(): Set<Variable>;
    constants(): Set<Variable>;
    predicates(): Set<Variable>;
    equals(other: Expression$1): boolean;
    /** Uncurry: returns [base-function, arg-list]. */
    uncurry(): [Expression$1, Expression$1[]];
    isAtom(): boolean;
    /** NLTK property: uncurried arg-list. */
    get args(): Expression$1[];
    /** NLTK snake_case alias. */
    is_atom(): boolean;
    str(): string;
}
declare abstract class VariableBinderExpression extends Expression$1 {
    variable: Variable;
    term: Expression$1;
    constructor(variable: Variable, term: Expression$1);
    protected abstract rebuild(variable: Variable, term: Expression$1): VariableBinderExpression;
    alphaConvert(newvar: Variable): VariableBinderExpression;
    replace(variable: Variable, expression: Expression$1, replaceBound?: boolean, alphaConvert?: boolean): Expression$1;
    free(): Set<Variable>;
    findtype(variable: Variable): Type;
    visit<T, R>(fn: (e: Expression$1) => T, combinator: (parts: T[]) => R): R;
    visitStructured<T>(fn: (e: Expression$1) => T, combinator: (...parts: unknown[]) => Expression$1): Expression$1;
    equals(other: Expression$1): boolean;
}
declare class LambdaExpression extends VariableBinderExpression {
    /** NLTK property: <type-of-variable, type-of-term>. */
    get type(): Type;
    setType(otherType?: Type, signature?: TypeSignature): void;
    protected rebuild(variable: Variable, term: Expression$1): VariableBinderExpression;
    simplify(): Expression$1;
    str(): string;
}
declare abstract class QuantifiedExpression extends VariableBinderExpression {
    /** NLTK property: quantified expressions are truth-valued. */
    get type(): Type;
    setType(otherType?: Type, signature?: TypeSignature): void;
    abstract getQuantifier(): string;
    str(): string;
}
declare class ExistsExpression extends QuantifiedExpression {
    getQuantifier(): string;
    protected rebuild(variable: Variable, term: Expression$1): VariableBinderExpression;
    simplify(): Expression$1;
}
declare class AllExpression extends QuantifiedExpression {
    getQuantifier(): string;
    protected rebuild(variable: Variable, term: Expression$1): VariableBinderExpression;
    simplify(): Expression$1;
}
declare class IotaExpression extends QuantifiedExpression {
    getQuantifier(): string;
    protected rebuild(variable: Variable, term: Expression$1): VariableBinderExpression;
    simplify(): Expression$1;
}
declare class NegatedExpression extends Expression$1 {
    term: Expression$1;
    constructor(term: Expression$1);
    /** NLTK property: negations are truth-valued. */
    get type(): Type;
    setType(otherType?: Type, signature?: TypeSignature): void;
    findtype(variable: Variable): Type;
    visit<T, R>(fn: (e: Expression$1) => T, combinator: (parts: T[]) => R): R;
    simplify(): Expression$1;
    replace(variable: Variable, expression: Expression$1, replaceBound?: boolean, alphaConvert?: boolean): Expression$1;
    free(): Set<Variable>;
    negate(): Expression$1;
    equals(other: Expression$1): boolean;
    str(): string;
}
declare abstract class BinaryExpression extends Expression$1 {
    first: Expression$1;
    second: Expression$1;
    constructor(first: Expression$1, second: Expression$1);
    /** NLTK property: binary connectives are truth-valued. */
    get type(): Type;
    findtype(variable: Variable): Type;
    visit<T, R>(fn: (e: Expression$1) => T, combinator: (parts: T[]) => R): R;
    abstract getOp(): string;
    protected subexStr(subex: Expression$1): string;
    simplify(): Expression$1;
    replace(variable: Variable, expression: Expression$1, replaceBound?: boolean, alphaConvert?: boolean): Expression$1;
    free(): Set<Variable>;
    constants(): Set<Variable>;
    predicates(): Set<Variable>;
    equals(other: Expression$1): boolean;
    str(): string;
}
declare abstract class BooleanExpression extends BinaryExpression {
    setType(otherType?: Type, signature?: TypeSignature): void;
}
declare class AndExpression extends BooleanExpression {
    getOp(): string;
    protected subexStr(subex: Expression$1): string;
}
declare class OrExpression extends BooleanExpression {
    getOp(): string;
    protected subexStr(subex: Expression$1): string;
}
declare class ImpExpression$1 extends BooleanExpression {
    getOp(): string;
}
declare class IffExpression extends BooleanExpression {
    getOp(): string;
}
declare class EqualityExpression extends BinaryExpression {
    setType(otherType?: Type, signature?: TypeSignature): void;
    getOp(): string;
}
type BooleanFactory = typeof AndExpression | typeof OrExpression | typeof ImpExpression$1 | typeof IffExpression;
type QuantifiedFactory = typeof ExistsExpression | typeof AllExpression | typeof IotaExpression;
declare class LogicParser {
    /** Maximum expression-nesting depth (nltk.sem.logic LogicParser.MAX_PARSE_DEPTH). */
    static MAX_PARSE_DEPTH: number;
    private currentIndex;
    private buffer;
    private parseDepth;
    private typeCheck;
    private symbolTrie;
    private quoteChars;
    constructor(typeCheck?: boolean);
    parse(data: string, signature?: Record<string, Type | string>): Expression$1;
    /** Split the data into tokens (trie-based longest symbol match, like NLTK).
     * Returns [tokens, mapping] where mapping indexes token positions to
     * character offsets in `data`. */
    process(data: string): [string[], Map<number, number>];
    /** Quote-char handling; the base parser defines no quote chars, so this
     * always returns no token (NLTK parity hook for subclasses). */
    processQuotedToken(dataIdx: number, data: string): [string, number];
    getAllSymbols(): string[];
    inRange(location: number): boolean;
    token(location?: number): string;
    isvariable(tok: string): boolean;
    processNextExpression(context: string | null): Expression$1;
    handle(tok: string, context: string | null): Expression$1 | undefined;
    attemptAdjuncts(expression: Expression$1, context: string | null): Expression$1;
    makeApplicationExpression(function_: Expression$1, argument: Expression$1): ApplicationExpression$1;
    makeVariableExpression(name: string): AbstractVariableExpression;
    makeLambdaExpression(variable: Variable, term: Expression$1): LambdaExpression;
    makeNegatedExpression(term: Expression$1): NegatedExpression;
    makeEqualityExpression(first: Expression$1, second: Expression$1): EqualityExpression;
    makeQuanifiedExpression(factory: QuantifiedFactory, variable: Variable, term: Expression$1): QuantifiedExpression;
    makeBooleanExpression(factory: BooleanFactory, first: Expression$1, second: Expression$1): BooleanExpression;
    handleNegation(_tok: string, _context: string | null): Expression$1;
    handleVariable(tok: string, _context: string | null): Expression$1;
    getNextTokenVariable(description: string): Variable;
    handleLambda(tok: string, _context: string | null): Expression$1;
    handleQuant(tok: string, _context: string | null): Expression$1;
    getQuantifiedExpressionFactory(tok: string): QuantifiedFactory;
    handleOpen(_tok: string, _context: string | null): Expression$1;
    attemptEqualityExpression(expression: Expression$1, context: string | null): Expression$1;
    attemptBooleanExpression(expression: Expression$1, context: string | null): Expression$1;
    getBooleanExpressionFactory(tok: string): BooleanFactory | null;
    attemptApplicationExpression(expression: Expression$1, context: string | null): Expression$1;
    hasPriority(operation: string, context: string | null): boolean;
    assertNextToken(expected: string): void;
    assertToken(tok: string, expected: string | string[]): void;
}
/** Convenience mirror of Expression.fromstring. */
declare function fromstring$1(s: string): Expression$1;
/** NLTK SubstituteBindingsI — interface for objects that can substitute
 * variables. Methods raise NotImplementedError, as in NLTK. */
declare class SubstituteBindingsI {
    substitute_bindings(_bindings: unknown): unknown;
    variables(): unknown;
}
/** Port of nltk.sem.logic.read_logic: parse a string containing one logical
 * formula per line ('#' comments and blank lines skipped). */
declare function read_logic(s: string | Uint8Array, logicParser?: LogicParser, encoding?: string): Expression$1[];
declare const readLogic: typeof read_logic;
/** Port of nltk.sem.logic.skolem_function: a fresh F-counter function variable
 * applied to each variable in `univScope`. */
declare function skolem_function(univScope?: Iterable<Variable>): Expression$1;
declare const skolemFunction: typeof skolem_function;
/** NLTK boolean_ops — print the boolean operator table. */
declare function boolean_ops(): void;
/** NLTK equality_preds — print the equality predicate table. */
declare function equality_preds(): void;
/** NLTK binding_ops — print the binding operator table. Quirk preserved: the
 * zip truncates to the 3 names, so the iota token is never printed. */
declare function binding_ops(): void;
/** NLTK printtype — broken in NLTK 3.10.3: it calls ``ex.str()``, which does
 * not exist on NLTK expressions, so it always raises AttributeError. The
 * py3-broken contract is preserved rather than silently fixed. */
declare function printtype(ex: Expression$1): void;
/** NLTK demoException — parse `s`, printing the exception class and message. */
declare function demoException(s: string): void;
/** NLTK nltk.sem.logic.demo() — deterministic parser demonstration. */
declare function semLogicDemo(): void;
/** NLTK nltk.sem.logic.demo_errors() — prints one line per parse failure. */
declare function semLogicDemoErrors(): void;
type SemanticValue = string | boolean | string[][];
type ValuationSpec = Record<string, string | boolean | string[] | string[][]>;
declare class Valuation {
    private values;
    constructor(spec: ValuationSpec);
    static normalizeValue(val: string | boolean | string[] | string[][]): SemanticValue;
    has(sym: string): boolean;
    get(sym: string): SemanticValue;
    get domain(): Set<string>;
    get symbols(): string[];
}
declare class Assignment {
    domain: Set<string>;
    private map;
    constructor(domain: Iterable<string>, assign?: Record<string, string>);
    has(key: string): boolean;
    get(key: string): string;
    add(v: string, val: string): Assignment;
    copy(): Assignment;
    purge(v?: string): void;
    entries(): [string, string][];
}
declare class Model {
    domain: Set<string>;
    valuation: Valuation;
    constructor(domain: Iterable<string>, valuation: Valuation);
    evaluate(expr: string | Expression$1, g: Assignment): boolean | "Undefined";
    satisfy(parsed: Expression$1, g: Assignment): unknown;
    i(parsed: AbstractVariableExpression, g: Assignment): SemanticValue;
    satisfiers(parsed: Expression$1, varex: Variable | string, g: Assignment): Set<string>;
}

declare const DrtTokens: {
    readonly LAMBDA: string;
    readonly LAMBDA_LIST: string[];
    readonly EXISTS: string;
    readonly EXISTS_LIST: string[];
    readonly ALL: string;
    readonly ALL_LIST: string[];
    readonly IOTA: string;
    readonly IOTA_LIST: string[];
    readonly DOT: string;
    readonly OPEN: string;
    readonly CLOSE: string;
    readonly COMMA: string;
    readonly NOT: string;
    readonly NOT_LIST: string[];
    readonly AND: string;
    readonly AND_LIST: string[];
    readonly OR: string;
    readonly OR_LIST: string[];
    readonly IMP: string;
    readonly IMP_LIST: string[];
    readonly IFF: string;
    readonly IFF_LIST: string[];
    readonly EQ: string;
    readonly EQ_LIST: string[];
    readonly NEQ: string;
    readonly NEQ_LIST: string[];
    readonly DRS: "DRS";
    readonly DRS_CONC: "+";
    readonly PRONOUN: "PRO";
    readonly OPEN_BRACKET: "[";
    readonly CLOSE_BRACKET: "]";
    readonly COLON: ":";
};
declare function DrtVariableExpression(variable: Variable): DrtAbstractVariableExpression;
declare class DrtAbstractVariableExpression extends AbstractVariableExpression {
    fol(): Expression$1;
    getRefs(_recursive?: boolean): Variable[];
    _pretty(): string[];
    eliminateEquality(): Expression$1;
}
declare class DrtIndividualVariableExpression extends DrtAbstractVariableExpression {
    free(): Set<Variable>;
}
declare class DrtFunctionVariableExpression extends DrtAbstractVariableExpression {
    free(): Set<Variable>;
}
declare class DrtEventVariableExpression extends DrtIndividualVariableExpression {
}
declare class DrtConstantExpression extends DrtAbstractVariableExpression {
}
declare abstract class DrtExpression extends Expression$1 {
    abstract getRefs(recursive?: boolean): Variable[];
    abstract fol(): Expression$1;
    prettyFormat(): string;
    _pretty(): string[];
    draw(): void;
    eliminateEquality(): Expression$1;
}
declare class DRS extends DrtExpression {
    refs: Variable[];
    conds: Expression$1[];
    consequent: Expression$1 | null;
    constructor(refs: Variable[], conds: Expression$1[], consequent: Expression$1 | null);
    str(): string;
    equals(other: Expression$1): boolean;
    free(): Set<Variable>;
    simplify(): Expression$1;
    replace(variable: Variable, expression: Expression$1, replaceBound?: boolean, alphaConvert?: boolean): Expression$1;
    getRefs(recursive?: boolean): Variable[];
    fol(): Expression$1;
    toFol(): Expression$1;
    _pretty(): string[];
    getConds(): Expression$1[];
}
declare class DrtLambdaExpression extends DrtExpression {
    variable: Variable;
    term: Expression$1;
    constructor(variable: Variable, term: Expression$1);
    str(): string;
    equals(other: Expression$1): boolean;
    free(): Set<Variable>;
    simplify(): Expression$1;
    replace(variable: Variable, expression: Expression$1, replaceBound?: boolean, alphaConvert?: boolean): Expression$1;
    getRefs(recursive?: boolean): Variable[];
    fol(): Expression$1;
    _pretty(): string[];
}
declare class DrtApplicationExpression extends DrtExpression {
    function: Expression$1;
    argument: Expression$1;
    constructor(func: Expression$1, arg: Expression$1);
    str(): string;
    equals(other: Expression$1): boolean;
    free(): Set<Variable>;
    simplify(): Expression$1;
    replace(variable: Variable, expression: Expression$1, replaceBound?: boolean, alphaConvert?: boolean): Expression$1;
    getRefs(recursive?: boolean): Variable[];
    fol(): Expression$1;
    _pretty(): string[];
    uncurry(): [Expression$1, Expression$1[]];
}
declare class DrtNegatedExpression extends DrtExpression {
    term: Expression$1;
    constructor(term: Expression$1);
    str(): string;
    equals(other: Expression$1): boolean;
    free(): Set<Variable>;
    simplify(): Expression$1;
    replace(variable: Variable, expression: Expression$1, replaceBound?: boolean, alphaConvert?: boolean): Expression$1;
    getRefs(recursive?: boolean): Variable[];
    fol(): Expression$1;
    _pretty(): string[];
}
declare class DrtEqualityExpression extends DrtExpression {
    first: Expression$1;
    second: Expression$1;
    constructor(first: Expression$1, second: Expression$1);
    str(): string;
    equals(other: Expression$1): boolean;
    free(): Set<Variable>;
    simplify(): Expression$1;
    replace(variable: Variable, expression: Expression$1, replaceBound?: boolean, alphaConvert?: boolean): Expression$1;
    getRefs(recursive?: boolean): Variable[];
    fol(): Expression$1;
}
declare abstract class DrtBinaryExpression extends DrtExpression {
    first: Expression$1;
    second: Expression$1;
    constructor(first: Expression$1, second: Expression$1);
    abstract getOp(): string;
    free(): Set<Variable>;
    replace(variable: Variable, expression: Expression$1, replaceBound?: boolean, alphaConvert?: boolean): Expression$1;
    getRefs(recursive?: boolean): Variable[];
    str(): string;
    static assemblePretty(firstLines: string[], op: string, secondLines: string[]): string[];
    _pretty(): string[];
}
declare class DrtOrExpression extends DrtBinaryExpression {
    getOp(): string;
    equals(other: Expression$1): boolean;
    simplify(): Expression$1;
    fol(): Expression$1;
}
declare class DrtConcatenation extends DrtBinaryExpression {
    consequent: Expression$1 | null;
    constructor(first: Expression$1, second: Expression$1, consequent: Expression$1 | null);
    getOp(): string;
    str(): string;
    equals(other: Expression$1): boolean;
    replace(variable: Variable, expression: Expression$1, replaceBound?: boolean, alphaConvert?: boolean): Expression$1;
    getRefs(recursive?: boolean): Variable[];
    simplify(): Expression$1;
    free(): Set<Variable>;
    fol(): Expression$1;
    toFol(): Expression$1;
    _pretty(): string[];
}
declare class DrtProposition extends DrtExpression {
    variable: Variable;
    drs: Expression$1;
    constructor(variable: Variable, drs: Expression$1);
    str(): string;
    equals(other: Expression$1): boolean;
    free(): Set<Variable>;
    simplify(): Expression$1;
    replace(variable: Variable, expression: Expression$1, replaceBound?: boolean, alphaConvert?: boolean): Expression$1;
    getRefs(recursive?: boolean): Variable[];
    fol(): Expression$1;
    _pretty(): string[];
}
type Drs = DRS;
declare class DrtParser {
    private currentIndex;
    private buffer;
    private trie;
    parse(data: string): DrtExpression;
    process(data: string): string[];
    inRange(loc: number): boolean;
    token(loc?: number): string;
    isvariable(tok: string): boolean;
    processNextExpression(context: string | null): DrtExpression;
    handle(tok: string, context: string | null): DrtExpression | undefined;
    handleNegation(_tok: string, _context: string | null): DrtExpression;
    handleVariable(tok: string, _context: string | null): DrtExpression;
    getNextTokenVariable(_desc: string): Variable;
    handleLambda(tok: string, _context: string | null): DrtExpression;
    handleOpen(_tok: string, _context: string | null): DrtExpression;
    handleDRS(_tok: string, context: string | null): DrtExpression;
    handleRefs(): Variable[];
    handleConds(context: string | null): Expression$1[];
    handleProp(tok: string, _context: string | null): DrtExpression;
    attemptAdjuncts(expr: DrtExpression, context: string | null): DrtExpression;
    attemptEqualityExpression(expr: DrtExpression, context: string | null): DrtExpression;
    attemptBooleanExpression(expr: DrtExpression, context: string | null): DrtExpression;
    getBooleanFactory(tok: string): ((a: DrtExpression, b: DrtExpression) => DrtExpression) | null;
    attemptApplicationExpression(expr: DrtExpression, context: string | null): DrtExpression;
    hasPriority(op: string, context: string | null): boolean;
    assertNextToken(expected: string): void;
}
declare function DrtParserFromString(s: string): DrtExpression;

declare function toCnf(first: Expression$1, second: Expression$1): Expression$1;
declare function skolemize(expression: Expression$1, univScope?: Set<Variable> | null, usedVariables?: Set<Variable> | null): Expression$1;

/**
 * Snowball (Porter2-family) stemmers — public barrel.
 *
 * Implementation lives in per-language modules under src/snowball/
 * (ported line-for-line from NLTK's nltk/stem/snowball.py, which itself is a
 * Python translation of the Snowball spec at http://snowball.tartarus.org/).
 *
 * Supported languages: arabic, danish, dutch, english, finnish, french,
 * german, hungarian, italian, norwegian, portuguese, romanian, russian,
 * spanish, swedish.
 *
 * Behavior notes:
 * - Each language stemmer lowercases its input first (exactly like NLTK;
 *   the Russian stemmer does NOT lowercase, matching NLTK).
 * - Unsupported languages throw an Error mirroring NLTK's ValueError:
 *   "The language '<language>' is not supported."
 */

declare const SNOWBALL_LANGUAGES: readonly ["arabic", "danish", "dutch", "english", "finnish", "french", "german", "hungarian", "italian", "norwegian", "portuguese", "romanian", "russian", "spanish", "swedish"];
/**
 * Stem `word` with the NLTK-compatible Snowball stemmer for `language`.
 *
 * Throws an Error (mirroring NLTK's ValueError) when the language is not
 * supported. Each language's algorithm lowercases internally (except
 * Russian, which does not lowercase — matching NLTK exactly).
 */
declare function snowballStem(word: string, language: string, stopwords?: ReadonlySet<string>): string;

/**
 * Common methods and classes for all IBM models (port of nltk.translate.ibm_model).
 *
 * See IBMModel1/IBMModel2/... for specific implementations. The IBM models are
 * generative models that learn lexical translation probabilities
 * p(target word | source word) from a sentence-aligned parallel corpus using EM.
 *
 * Conventions (mirroring NLTK):
 * - Words in a sentence are one-indexed; index 0 is reserved for NULL in the
 *   source sentence.
 * - Each target word aligns to exactly one source word or NULL.
 *
 * Reference: Koehn 2010, "Statistical Machine Translation"; Brown et al. 1993.
 */
/** Minimum probability to avoid division by zero / precision errors. */
declare const MIN_PROB = 1e-12;
/** A sentence in the target language paired with its translation (mots). */
type AlignedSentInput = {
    /** Target language words (the translation output). */
    words: string[];
    /** Source language words (the input). */
    mots: string[];
};
/** Zero-indexed alignment pair (j, i): target position j -> source position i,
 * where i is -0-based over mots with i = 0 meaning NULL... NLTK uses i as an
 * index into [None] + mots, so alignment stores i = 0 for NULL and i >= 1 for
 * mots[i - 1]. We keep NLTK's convention: Alignment entries are (j, i) with
 * j zero-indexed into words and i zero-indexed into [NULL, ...mots]. */
type AlignmentPair = readonly [j: number, i: number];
/** Counts data object accumulated during EM training. */
declare class Counts {
    t_given_s: Map<string, Map<string, number>>;
    any_t_given_s: Map<string, number>;
    p0: number;
    p1: number;
    fertility: Map<number, Map<string, number>>;
    fertility_for_any_phi: Map<string, number>;
    updateLexicalTranslation(count: number, alignment: readonly number[], trgSentence: readonly string[], srcSentence: readonly string[], j: number): void;
    updateNullGeneration(count: number, fertilityOfNull: number, m: number): void;
    updateFertility(count: number, srcSentence: readonly string[], fertilityOf: (i: number) => number): void;
    /** Number of times word i of the source occurs in the alignment. */
    static fertilityOfI(alignment: readonly number[], srcLen: number, i: number): number;
}
/** Longest target sentence length in the corpus. */
declare function longestTargetSentenceLength(corpus: readonly AlignedSentInput[]): number;
/** Abstract base state shared by all IBM model implementations. */
declare abstract class IBMModelBase {
    MIN_PROB: number;
    /** Probability(target | source): translation_table[t][s]. NULL key is "NULL". */
    translation_table: Map<string, Map<string, number>>;
    /** Probability(i | j, l, m): alignment_table[i][j][l][m]. Models 2+. */
    alignment_table: Map<number, Map<number, Map<number, Map<number, number>>>>;
    /** Probability(fertility | source word). Models 3+. */
    fertility_table: Map<number, Map<string, number>>;
    /** Probability that a generated word requires another target word aligned to NULL. */
    p1: number;
    src_vocab: Set<string>;
    trg_vocab: Set<string>;
    static readonly NULL = "NULL";
    constructor(corpus: readonly AlignedSentInput[]);
    protected initVocab(corpus: readonly AlignedSentInput[]): void;
    resetProbabilities(): void;
    get(t: string, s: string): number;
    setProb(t: string, s: string, value: number): void;
    maximizeLexicalTranslationProbabilities(counts: {
        t_given_s: Map<string, Map<string, number>>;
        any_t_given_s: Map<string, number>;
    }): void;
    maximizeFertilityProbabilities(counts: Counts): void;
    maximizeNullGenerationProbabilities(counts: Counts): void;
    abstract train(parallel_corpus: readonly AlignedSentInput[]): void;
    /**
     * Best word alignment for one sentence pair, stored zero-indexed:
     * alignment[j] = i where i indexes [NULL, ...mots].
     */
    bestAlignments(corpus: readonly AlignedSentInput[]): AlignmentPair[][];
}

declare function factorial(n: number): number;

/**
 * Lexical translation model that ignores word order
 * (port of nltk.translate.ibm1.IBMModel1).
 *
 * Translation direction is from `mots` (source) to `words` (target).
 *
 * Example (mirrors the NLTK doctest):
 * ```
 * const bitext = [
 *   { mots: ['klein', 'ist', 'das', 'haus'], words: ['the', 'house', 'is', 'small'] },
 *   ...
 * ];
 * const ibm1 = new IBMModel1(bitext, 5);
 * ibm1.translation_table.get('buch')?.get('book')  // ~0.889
 * ```
 */

declare class IBMModel1 extends IBMModelBase {
    constructor(corpus: readonly AlignedSentInput[], iterations: number, probabilityTables?: {
        translation_table: Map<string, Map<string, number>>;
    });
    private setUniformProbabilities;
    train(parallel_corpus: readonly AlignedSentInput[]): void;
    /** Marginal alignment probability contribution for each target word t. */
    private probAllAlignments;
    private probAlignmentPoint;
    /** Probability of the target sentence and an alignment given the source. */
    probTAGivenS(alignment: readonly number[], srcSentence: readonly string[], trgSentence: readonly string[]): number;
}

/**
 * Alignment-based lexical translation model
 * (port of nltk.translate.ibm2.IBMModel2).
 *
 * Extends Model 1 with an alignment model a(i | j, l, m). Translation
 * direction is from `mots` (source) to `words` (target). When no probability
 * tables are given, the translation table is seeded from IBM Model 1 trained
 * with 2x iterations (mirroring NLTK).
 */

declare class Model2Counts {
    t_given_s: Map<string, Map<string, number>>;
    any_t_given_s: Map<string, number>;
    /** alignment[i][j][l][m] */
    alignment: Map<number, Map<number, Map<number, Map<number, number>>>>;
    /** alignment_for_any_i[j][l][m] */
    alignment_for_any_i: Map<number, Map<number, Map<number, number>>>;
    updateLexicalTranslation(normalizedCount: number, s: string, t: string): void;
    private ensureAlignment;
    updateAlignment(normalizedCount: number, i: number, j: number, l: number, m: number): void;
}
type IBM2ProbabilityTables = {
    translation_table: Map<string, Map<string, number>>;
    alignment_table: Map<number, Map<number, Map<number, Map<number, number>>>>;
};
declare class IBMModel2 extends IBMModelBase {
    constructor(corpus: readonly AlignedSentInput[], iterations: number, probabilityTables?: IBM2ProbabilityTables);
    private setUniformProbabilities;
    train(parallel_corpus: readonly AlignedSentInput[]): void;
    private maximizeAlignmentProbabilities;
    private probAllAlignments;
    private probAlignmentPoint;
    /** Probability of target sentence and an alignment given the source. */
    probTAGivenS(alignment: readonly number[], srcSentence: readonly string[], trgSentence: readonly string[]): number;
}

/**
 * AlignmentInfo, sampling (hill climbing + pegging), and neighbor generation
 * shared by IBM Models 3, 4 and 5 (port of nltk.translate.ibm_model internals).
 *
 * Alignments inside AlignmentInfo are one-indexed: alignment[j] for j in
 * 1..m gives the source position i in 0..l aligned to target position j.
 * Position 0 of the source sentence is NULL.
 */

type AlignedSent$1 = {
    words: string[];
    mots: string[];
};
declare class AlignmentInfo {
    /** alignment[j] = source position aligned to target position j. */
    readonly alignment: readonly number[];
    /** Source sentence with NULL at index 0. */
    readonly src_sentence: readonly string[];
    /** Target sentence with dummy at index 0. */
    readonly trg_sentence: readonly string[];
    /** cepts[i] = ascending target positions aligned to source position i. */
    readonly cepts: ReadonlyArray<ReadonlyArray<number>>;
    score: number;
    constructor(alignment: readonly number[], srcSentence: readonly string[], trgSentence: readonly string[], cepts: ReadonlyArray<ReadonlyArray<number>>);
    fertilityOfI(i: number): number;
    isHeadWord(j: number): boolean;
    centerOfCept(i: number | null): number;
    previousCept(j: number): number | null;
    previousInTablet(j: number): number | null;
    zeroIndexedAlignment(): Array<[number, number]>;
    /** Canonical identity for set membership: alignment tuple only (matches NLTK,
     * where AlignmentInfo hash/eq is based on alignment + sentences). */
    key(): string;
}
/** Context passed to sampling/hillclimbing so models supply their own scorers. */
interface Scorer {
    probTAGivenS(alignment: AlignmentInfo): number;
}
declare abstract class SamplingModel extends IBMModelBase implements Scorer {
    abstract probTAGivenS(alignment: AlignmentInfo): number;
    bestModel2Alignment(sentencePair: AlignedSent$1, jPegged?: number, iPegged?: number): AlignmentInfo;
    hillclimb(alignmentInfo: AlignmentInfo, jPegged?: number): AlignmentInfo;
    neighboring(alignmentInfo: AlignmentInfo, jPegged?: number): Set<AlignmentInfo>;
    sample(sentencePair: AlignedSent$1): {
        sampled: Set<AlignmentInfo>;
        best: AlignmentInfo;
    };
}

/**
 * Translation model that considers how a word can be aligned to multiple
 * words in another language (port of nltk.translate.ibm3.IBMModel3).
 *
 * Adds fertility, distortion d(j | i,l,m), and NULL-generation probability
 * on top of Model 2. Seeded from IBM Model 2 when no tables are given.
 */

declare class Model3Counts extends Counts {
    /** distortion[j][i][l][m] */
    distortion: Map<number, Map<number, Map<number, Map<number, number>>>>;
    /** distortion_for_any_j[i][l][m] */
    distortion_for_any_j: Map<number, Map<number, Map<number, number>>>;
    updateDistortion(count: number, alignment: readonly number[], j: number, l: number, m: number): void;
}
declare class IBMModel3 extends SamplingModel {
    /** Probability(j | i,l,m): distortion_table[j][i][l][m]. */
    distortion_table: Map<number, Map<number, Map<number, Map<number, number>>>>;
    constructor(corpus: readonly AlignedSent$1[], iterations: number, probabilityTables?: {
        translation_table: IBMModelBase["translation_table"];
        alignment_table: IBMModelBase["alignment_table"];
        fertility_table: IBMModelBase["fertility_table"];
        p1: number;
        distortion_table: Map<number, Map<number, Map<number, Map<number, number>>>>;
    });
    resetProbabilities(): void;
    private setUniformProbabilities;
    train(parallel_corpus: readonly AlignedSent$1[]): void;
    private maximizeDistortionProbabilities;
    probTAGivenS(alignmentInfo: AlignmentInfo): number;
}

/**
 * port of nltk.translate.ibm4.IBMModel4 — distortion based on word classes
 * and the position of the previous cept's center, plus non-head displacement.
 */

declare class Model4Counts extends Counts {
    /** head_distortion[dj][src_class][trg_class] */
    head_distortion: Map<number, Map<number | null, Map<number, number>>>;
    head_distortion_for_any_dj: Map<number | null, Map<number, number>>;
    /** non_head_distortion[dj][trg_class] */
    non_head_distortion: Map<number, Map<number, number>>;
    non_head_distortion_for_any_dj: Map<number, number>;
    updateDistortion(count: number, alignmentInfo: AlignmentInfo, j: number, srcClasses: Record<string, number>, trgClasses: Record<string, number>): void;
}
type SrcTrgClasses = Record<string, number>;
declare class IBMModel4 extends SamplingModel {
    /** Probability(displacement of head word | src class of previous cept, trg class). */
    head_distortion_table: Map<number, Map<number | null, Map<number, number>>>;
    /** Probability(displacement of non-head word | target word class). */
    non_head_distortion_table: Map<number, Map<number, number>>;
    src_classes: SrcTrgClasses;
    trg_classes: SrcTrgClasses;
    constructor(corpus: readonly AlignedSent$1[], iterations: number, sourceWordClasses: SrcTrgClasses, targetWordClasses: SrcTrgClasses, probabilityTables?: {
        translation_table: IBMModelBase["translation_table"];
        alignment_table: IBMModelBase["alignment_table"];
        fertility_table: IBMModelBase["fertility_table"];
        p1: number;
        head_distortion_table: Map<number, Map<number | null, Map<number, number>>>;
        non_head_distortion_table: Map<number, Map<number, number>>;
    });
    resetProbabilities(): void;
    private setUniformProbabilities;
    train(parallel_corpus: readonly AlignedSent$1[]): void;
    private maximizeDistortionProbabilities;
    probTAGivenS(alignmentInfo: AlignmentInfo): number;
    /** Exposed for Model 5 to reuse. */
    static model4ProbTAGivenS(alignmentInfo: AlignmentInfo, model: IBMModel4): number;
    /** Model-4 scoring used by Model 5's hillclimb/prune. */
    static scoreWith(alignmentInfo: AlignmentInfo, modelLike: {
        p1: number;
    } & IBMModel4): number;
}

/**
 * Translation model that keeps track of vacant positions in the target
 * sentence to decide where to place translated words
 * (port of nltk.translate.ibm5.IBMModel5).
 *
 * Uses Model 4 scoring for hill climbing and pruning (as in NLTK), then
 * vacancy-based probabilities for its own EM steps.
 */

/** Tracks occupied positions in a target sentence (1-indexed with dummy at 0). */
declare class Slots {
    private readonly slots;
    constructor(targetSentenceLength: number);
    get length(): number;
    occupy(position: number): void;
    vacanciesAt(position: number): number;
}
declare class Model5Counts extends Counts {
    /** head_vacancy[dv][max_v][trg_class] */
    head_vacancy: Map<number, Map<number, Map<number, number>>>;
    head_vacancy_for_any_dv: Map<number, Map<number, number>>;
    /** non_head_vacancy[dv][max_v][trg_class] */
    non_head_vacancy: Map<number, Map<number, Map<number, number>>>;
    non_head_vacancy_for_any_dv: Map<number, Map<number, number>>;
    updateVacancy(count: number, alignmentInfo: AlignmentInfo, i: number, trgClasses: SrcTrgClasses, slots: Slots): void;
    private addTo;
    private addAny;
}
declare class IBMModel5 extends SamplingModel {
    /** Probability(vacancy difference | remaining valid positions, target word class). */
    head_vacancy_table: Map<number, Map<number, Map<number, number>>>;
    non_head_vacancy_table: Map<number, Map<number, Map<number, number>>>;
    head_distortion_table: Map<number, Map<number | null, Map<number, number>>>;
    non_head_distortion_table: Map<number, Map<number, number>>;
    src_classes: SrcTrgClasses;
    trg_classes: SrcTrgClasses;
    constructor(corpus: readonly AlignedSent$1[], iterations: number, sourceWordClasses: SrcTrgClasses, targetWordClasses: SrcTrgClasses, probabilityTables?: {
        translation_table: IBMModelBase["translation_table"];
        alignment_table: IBMModelBase["alignment_table"];
        fertility_table: IBMModelBase["fertility_table"];
        p1: number;
        head_distortion_table: Map<number, Map<number | null, Map<number, number>>>;
        non_head_distortion_table: Map<number, Map<number, number>>;
        head_vacancy_table: Map<number, Map<number, Map<number, number>>>;
        non_head_vacancy_table: Map<number, Map<number, Map<number, number>>>;
    });
    resetProbabilities(): void;
    private setUniformProbabilities;
    private ensureVacancy;
    train(parallel_corpus: readonly AlignedSent$1[]): void;
    /** NLTK Model 5 hill climbs with Model 4 scoring. */
    hillclimb(alignmentInfo: AlignmentInfo, jPegged?: number): AlignmentInfo;
    probTAGivenS(alignmentInfo: AlignmentInfo): number;
    private vacancyTerm;
    private maximizeVacancyProbabilities;
}

/**
 * CISTEM stemmer for German (port of nltk.stem.cistem.Cistem).
 *
 * Official Python implementation of the CISTEM stemmer, based on:
 * Weissweiler & Fraser (2017), "Developing a Stemmer for German Based on a
 * Comparative Analysis of Publicly Available Stemmers" (GSCL).
 */
declare class CistemStemmer {
    private readonly caseInsensitive;
    constructor(caseInsensitive?: boolean);
    /** Stem the input word. */
    stem(word: string): string;
    /**
     * Like stem(), but also returns the removed suffix so that
     * stem + rest === the original word.
     */
    segment(word: string): [stem: string, rest: string];
    private segmentInner;
}
/** Module-level convenience matching nltk usage. */
declare function cistemStem(word: string, caseInsensitive?: boolean): string;

/**
 * Dependency parse evaluation (port of nltk.parse.evaluate.DependencyEvaluator).
 *
 * Measures labelled (LAS) and unlabelled (UAS) attachment scores between
 * parsed and gold dependency structures. Punctuation is ignored.
 */
/** Minimal node shape shared by our DependencyParse arcs and gold inputs. */
type DependencyEvalNode = {
    word: string;
    /** Head position, 0 = root. */
    head: number;
    /** Dependency relation label. */
    rel: string;
};
/**
 * Evaluate parsed vs gold dependency structures.
 * Accepts pre-built node lists or our DependencyParse objects.
 * Returns [LAS, UAS].
 */
declare function dependencyEvaluate(parsedSents: ReadonlyArray<{
    nodes: readonly DependencyEvalNode[];
} | {
    tokens: readonly string[];
    arcs: ReadonlyArray<{
        from: number;
        to: number;
        label: string;
    }>;
    root: number;
}>, goldSents: ReadonlyArray<{
    nodes: readonly DependencyEvalNode[];
} | {
    tokens: readonly string[];
    arcs: ReadonlyArray<{
        from: number;
        to: number;
        label: string;
    }>;
    root: number;
}>): [las: number, uas: number];
/** Port of nltk.parse.evaluate.DependencyEvaluator: wraps dependencyEvaluate. */
type EvalInput = Parameters<typeof dependencyEvaluate>[0][number] | {
    nodelist: ReadonlyArray<{
        word: string | null;
        head: number | null;
        rel: string;
    }>;
};
declare class DependencyEvaluator {
    private parsedSents;
    private goldSents;
    constructor(parsedSents: readonly EvalInput[], goldSents: readonly EvalInput[]);
    eval(): [las: number, uas: number];
}

/**
 * S-Expression tokenizer (port of nltk.tokenize.sexpr / SExprTokenizer).
 *
 * Splits a string into parenthesized s-expressions (including nesting)
 * and whitespace-separated tokens, matching NLTK's strict/non-strict modes.
 */
declare class SExprTokenizer {
    private readonly open;
    private readonly close;
    private readonly strict;
    private readonly parenRe;
    constructor(parens?: string, strict?: boolean);
    tokenize(text: string): string[];
}
declare function sexprTokenize(text: string, parens?: string, strict?: boolean): string[];

/**
 * GDFA word-alignment symmetrization (port of nltk.translate.gdfa).
 *
 * Koehn (2005) grow-diag-final-and. Accepts Pharaoh-format alignment strings.
 */
type Point = [number, number];
declare function growDiagFinalAnd(srclen: number, trglen: number, e2f: string, f2e: string): Point[];

/**
 * GLEU score (port of nltk.translate.gleu_score).
 *
 * Wu et al. (2016) Google NMT — precision/recall over everygrams(1..4).
 */
declare function corpusGleu(listOfReferences: string[][][], hypotheses: string[][], minLen?: number, maxLen?: number): number;
declare function sentenceGleu(references: string[][], hypothesis: string[], minLen?: number, maxLen?: number): number;

declare class RSLPStemmer {
    private readonly model;
    constructor();
    private applyRule;
    stem(word: string): string;
}
declare function rslpStem(word: string): string;

/**
 * Legality-principle syllabifier (port of nltk.tokenize.legality_principle).
 *
 * Splits a word into syllables by onset-maximization over legal onsets/codas
 * derived from a corpus. Faithful to NLTK's Counter-based threshold.
 */
declare class LegalitySyllableTokenizer {
    private readonly vowels;
    private readonly legalOnsets;
    private readonly legalCodas;
    constructor(tokenizedSourceText: string[], vowels?: string, legalFrequencyThreshold?: number);
    tokenize(word: string): string[];
}
declare function legalityTokenize(word: string, corpus: string[], vowels?: string): string[];

/**
 * External classifier wrappers (ports of nltk.classify.svm/megam/tadm/weka/scikitlearn/senna/rte_classify).
 *
 * These classifiers delegate to external binaries (libsvm, megam, TADM, Weka, scikit-learn, SENNA)
 * which are unavailable in the JS runtime. The API surface is preserved for parity;
 * training/classification throws with a helpful message.
 */
declare class SvmClassifier {
    static train(_labeledFeaturesets: unknown[]): SvmClassifier;
    classify(_featureset: unknown): string;
    probClassify(_featureset: unknown): unknown;
}
declare class MegamMaxentClassifier {
    static train(_labeledFeaturesets: unknown[], _kwargs: unknown): MegamMaxentClassifier;
    classify(_featureset: unknown): string;
}
declare class TadmMaxentClassifier {
    static train(_labeledFeaturesets: unknown[], _kwargs: unknown): TadmMaxentClassifier;
    classify(_featureset: unknown): string;
}
declare class WekaClassifier {
    static train(_labeledFeaturesets: unknown[], _kwargs: unknown): WekaClassifier;
    classify(_featureset: unknown): string;
}
declare class SklearnClassifier {
    constructor(_clf: unknown);
    static train(_labeledFeaturesets: unknown[], _kwargs: unknown): SklearnClassifier;
    classify(_featureset: unknown): string;
}
declare class SennaClassifier {
    static train(_labeledFeaturesets: unknown[]): SennaClassifier;
    classify(_featureset: unknown): string;
}
declare class RteClassifier {
    static train(_labeledFeaturesets: unknown[]): RteClassifier;
    classify(_featureset: unknown): string;
}
declare function rteClassify(_text: string, _hypothesis: string): string;

/**
 * External POS tagger wrappers (ports of nltk.tag.stanford/hunpos/senna).
 */
/** Port of nltk.tag.stanford.StanfordTagger — base for the POS/NER taggers. */
declare class StanfordTagger {
    constructor(_pathToModel?: string, _pathToJar?: string);
    tag(_tokens: string[]): Array<[string, string]>;
}
declare class StanfordPOSTagger extends StanfordTagger {
}
declare class StanfordNERTagger extends StanfordTagger {
}
/** Port of nltk.tag.hunpos.HunposTagger (external hunpos-tag binary). */
declare class HunposTagger {
    constructor(_pathToModel?: string, _pathToBin?: string);
    tag(_tokens: string[]): Array<[string, string]>;
}
/** Backwards-compatible alias kept for the pre-rename export name. */
declare const HunPosTagger: typeof HunposTagger;
/** Port of nltk.tag.senna.Senna — base pipeline wrapper. */
declare class Senna {
    constructor(_pathToSenna?: string);
    tag(_tokens: string[]): Array<[string, string]>;
    tag_sents(_sents: Iterable<string[]>): Array<Array<[string, string]>>;
}
declare class SennaTagger extends Senna {
}
declare class SennaChunkTagger extends Senna {
}
declare class SennaNERTagger extends Senna {
}

/**
 * Given the string representation of a tagged token, return the
 * corresponding tuple representation.  The rightmost occurrence of
 * `sep` in `s` is used to divide `s` into a word string and a tag
 * string.  If `sep` does not occur in `s`, return `[s, null]`.
 *
 * NLTK upper-cases the tag: `str2tuple('fly/nn') -> ('fly','NN')`.
 */
declare function str2tuple(s: string, sep?: string): [string, string | null];
/**
 * Given the tuple representation of a tagged token, return the
 * corresponding string representation: `word + sep + tag`.  If the
 * tag is null, return the bare word string.
 */
declare function tuple2str(taggedToken: readonly [string, string | null], sep?: string): string;
/**
 * Use NLTK's currently recommended part of speech tagger to tag the
 * given list of sentences, each consisting of a list of tokens.
 *
 * The `tagset`/`lang` keyword arguments of the Python signature are
 * accepted but ignored (the bundled perceptron model is always used).
 */
declare function pos_tag_sents(sentences: Iterable<readonly string[]>, _options?: {
    tagset?: string;
    lang?: string;
}): Array<Array<[string, string]>>;
declare const posTagSents: typeof pos_tag_sents;

/**
 * Ports of the template-set factories in nltk.tag.brill:
 * nltkdemo18, nltkdemo18plus, fntbl37, brill24, describe_template_sets.
 */

/**
 * Return 18 templates, from the original nltk demo, in multi-feature syntax.
 */
declare function nltkdemo18(): Template[];
/**
 * Return 18 templates, from the original nltk demo, and additionally a few
 * multi-feature ones (the motivation is easy comparison with nltkdemo18).
 */
declare function nltkdemo18plus(): Template[];
/**
 * Return 37 templates taken from the postagging task of the
 * fntbl distribution https://www.cs.jhu.edu/~rflorian/fntbl/
 * (37 is after excluding a handful which do not condition on Pos[0];
 * fntbl can do that but the current nltk implementation cannot.)
 */
declare function fntbl37(): Template[];
/**
 * Return 24 templates of the seminal TBL paper, Brill (1995).
 */
declare function brill24(): Template[];
/**
 * Print the available template sets in this demo, with a short description.
 * NLTK enumerates the module functions via inspect (`print(name, obj.__doc__,
 * "\n")`); the port pins the same four entries in alphabetical order, each
 * emitted chunk ending in ` \n\n` exactly as print() produces.
 */
declare function describe_template_sets(out?: (chunk: string) => void): void;
declare const describeTemplateSets: typeof describe_template_sets;

/**
 * TnT — Trigrams'n'Tags statistical POS tagger (port of nltk.tag.tnt).
 *
 * Second-order HMM per Brants (2000): deleted-interpolation transition
 * smoothing over tag unigram/bigram/trigram tiers, suffix-model unknown
 * words with successive abstraction + Bayesian inversion, beam-pruned
 * Viterbi decoding over (prev1, current) state pairs.
 */

interface TntOptions {
    /** Beam threshold N (Brants default 1000). */
    N?: number;
    /** Include capitalization in the tag state. */
    C?: boolean;
    /** External unknown-word tagger; overrides the built-in suffix model. */
    unk?: {
        tag(tokens: string[]): Array<[string, string]>;
        train(data: unknown): void;
    };
}
declare class TnT {
    private readonly beamThreshold;
    private readonly useCap;
    private readonly unk?;
    private unkTrained;
    known: number;
    unknown: number;
    private tagUnigrams;
    private tagBigrams;
    private tagTrigrams;
    private wordTagFreqs;
    private lambda1;
    private lambda2;
    private lambda3;
    private numTagTokens;
    private transLogpUnigram;
    private transLogpBigram;
    private transLogpTrigram;
    private tagPriorProbs;
    private theta;
    private suffixTrieByCap;
    private candidateTagsCache;
    constructor(options?: TntOptions);
    /** Train on tagged sentences [[word, tag], ...]. Rebuilds the model from scratch. */
    train(data: Array<Array<[string, string]>>): void;
    private log2BeamThreshold;
    private computeLambda;
    private buildTransitionLogpCache;
    private buildSuffixModel;
    /** Brants's suffix-model scores for an unseen word (Bayes-inverted). */
    unknownTagScores(word: string): Map<string, number>;
    /**
     * Tag one tokenized sentence.
     */
    tag(tokens: string[]): Array<[string, string]>;
    /** Tag a list of sentences. */
    tagdata(data: string[][]): Array<Array<[string, string]>>;
    private tagWord;
    private expandStates;
    /** Apply `tag()` to each element of `sentences` (NLTK `TaggerI.tag_sents`). */
    tag_sents(sentences: Iterable<string[]>): Array<Array<[string, string]>>;
    tagSents(sentences: Iterable<string[]>): Array<Array<[string, string]>>;
    /** Deprecated alias of `accuracy` (NLTK `evaluate`). */
    evaluate(gold: ReadonlyArray<Array<[string, string]>>): number;
    /** Score accuracy against the gold standard. */
    accuracy(gold: ReadonlyArray<Array<[string, string]>>): number;
    /** ConfusionMatrix: gold tags as reference, predictions as test. */
    confusion(gold: ReadonlyArray<Array<[string, string]>>): ConfusionMatrix;
    precision(gold: ReadonlyArray<Array<[string, string]>>): Map<string, number>;
    recall(gold: ReadonlyArray<Array<[string, string]>>): Map<string, number>;
    f_measure(gold: ReadonlyArray<Array<[string, string]>>, alpha?: number): Map<string, number>;
    fMeasure(gold: ReadonlyArray<Array<[string, string]>>, alpha?: number): Map<string, number>;
    evaluate_per_tag(gold: ReadonlyArray<Array<[string, string]>>): string;
    evaluatePerTag(gold: ReadonlyArray<Array<[string, string]>>): string;
}
/**
 * Port of nltk.tag.tnt.basic_sent_chop — split a flat token sequence into
 * sentence-like segments, cutting after tokens in `sentMarks`. Works for
 * raw tokens (`raw=true`, compare the token itself) and tagged
 * `[word, tag]` pairs (`raw=false`, compare `word`).
 */
declare function basic_sent_chop<T extends string | readonly [string, string]>(data: readonly T[], raw?: boolean, sentMarks?: readonly string[]): T[][];
declare const basicSentChop: typeof basic_sent_chop;
/** nltk.tag.tnt.demo — corpus-bound demo; unsupported without nltk_data. */
declare function demo$f(_testSize?: number): never;
/** nltk.tag.tnt.demo_errors — corpus-bound demo; unsupported without nltk_data. */
declare function demo_errors(_limit?: number, _testSize?: number): never;

/** Build an Error carrying a Python exception class name for
 * NLTK-compatible error surfacing (e.g. KeyError, IndexError). */
declare function pyError(name: string, message: string): Error;
declare function configJava(..._a: unknown[]): never;
declare const config_java: typeof configJava;
declare function java(..._a: unknown[]): never;
declare class UntrustedJarError$1 extends Error {
}
declare class ReadError$1 extends Error {
}
declare function readStr(..._a: unknown[]): never;
declare const read_str$1: typeof readStr;
declare function readInt(..._a: unknown[]): never;
declare const read_int$1: typeof readInt;
declare function readNumber(..._a: unknown[]): never;
declare const read_number$1: typeof readNumber;
declare function overridden(_method: unknown): boolean;
declare function deprecated$1<F extends (...args: any[]) => any>(message: string): (func: F) => F;
declare class Deprecated$1 {
    message: string;
    constructor(message: string);
}
declare class Counter$1 {
    private value;
    constructor(initialValue?: number);
    get(): number;
}
declare function findFile(..._a: unknown[]): never;
declare const find_file: typeof findFile;
declare function findDir(..._a: unknown[]): never;
declare const find_dir$1: typeof findDir;
declare function findBinary(..._a: unknown[]): never;
declare const find_binary: typeof findBinary;
declare function findJar(..._a: unknown[]): never;
declare const find_jar: typeof findJar;
declare function sliceBounds(_seq: unknown, _slice: unknown): [number, number];
declare const slice_bounds$1: typeof sliceBounds;
declare function isWritable(_path: string): boolean;
declare const is_writable$1: typeof isWritable;

declare const internals_d_configJava: typeof configJava;
declare const internals_d_config_java: typeof config_java;
declare const internals_d_findBinary: typeof findBinary;
declare const internals_d_findDir: typeof findDir;
declare const internals_d_findFile: typeof findFile;
declare const internals_d_findJar: typeof findJar;
declare const internals_d_find_binary: typeof find_binary;
declare const internals_d_find_file: typeof find_file;
declare const internals_d_find_jar: typeof find_jar;
declare const internals_d_isWritable: typeof isWritable;
declare const internals_d_java: typeof java;
declare const internals_d_overridden: typeof overridden;
declare const internals_d_pyError: typeof pyError;
declare const internals_d_readInt: typeof readInt;
declare const internals_d_readNumber: typeof readNumber;
declare const internals_d_readStr: typeof readStr;
declare const internals_d_sliceBounds: typeof sliceBounds;
declare namespace internals_d {
  export {
    Counter$1 as Counter,
    Deprecated$1 as Deprecated,
    ReadError$1 as ReadError,
    UntrustedJarError$1 as UntrustedJarError,
    internals_d_configJava as configJava,
    internals_d_config_java as config_java,
    deprecated$1 as deprecated,
    internals_d_findBinary as findBinary,
    internals_d_findDir as findDir,
    internals_d_findFile as findFile,
    internals_d_findJar as findJar,
    internals_d_find_binary as find_binary,
    find_dir$1 as find_dir,
    internals_d_find_file as find_file,
    internals_d_find_jar as find_jar,
    internals_d_isWritable as isWritable,
    is_writable$1 as is_writable,
    internals_d_java as java,
    internals_d_overridden as overridden,
    internals_d_pyError as pyError,
    internals_d_readInt as readInt,
    internals_d_readNumber as readNumber,
    internals_d_readStr as readStr,
    read_int$1 as read_int,
    read_number$1 as read_number,
    read_str$1 as read_str,
    internals_d_sliceBounds as sliceBounds,
    slice_bounds$1 as slice_bounds,
  };
}

declare class SeekableUnicodeStreamReader {
    private text;
    private pos;
    private isClosed;
    readonly encoding: string | null;
    constructor(bytes: Uint8Array, encoding?: string | null, _errors?: string);
    /** Open a text stream directly from a decoded string (e.g. zip entry data). */
    static fromString(text: string, encoding?: string | null): SeekableUnicodeStreamReader;
    private checkOpen;
    get closed(): boolean;
    /** Total decoded length — the effective end-of-file position for tell()/seek(). */
    get charLength(): number;
    tell(): number;
    seek(offset: number, whence?: number): number;
    read(size?: number): string;
    readline(size?: number): string;
    readlines(sizehint?: number): string[];
    close(): void;
    /** nltk.data.SeekableUnicodeStreamReader.char_seek_forward — advance by chars. */
    char_seek_forward(offset: number): void;
    discard_line(): void;
    xreadlines(): string[];
    /** Iterate remaining lines (for..of support used by reader code). */
    [Symbol.iterator](): Generator<string>;
}

interface ZipInfo {
    filename: string;
    compress_type: number;
    file_size: number;
    compress_size: number;
    header_offset: number;
}
declare class OpenOnDemandZipFile {
    readonly filename: string;
    private entries;
    private loaded;
    constructor(filename: string);
    private ensureLoaded;
    namelist(): string[];
    getinfo(name: string): ZipInfo;
    infolist(): ZipInfo[];
    /** Read and decompress a member. Mirrors OpenOnDemandZipFile.read(). */
    read(name: string): Uint8Array;
    open(name: string): Uint8Array;
}

declare abstract class PathPointer {
    /** Return a readable stream for this pointer. encoding null -> latin-1 text view. */
    abstract open(encoding?: string | null): SeekableUnicodeStreamReader;
    /** Size of the pointed-to file in bytes. */
    abstract file_size(): number;
    /** Path pointer to a path relative to this one. */
    abstract join(fileid: string): PathPointer;
    fileSize(): number;
    toString(): string;
}
declare class FileSystemPathPointer extends PathPointer {
    readonly path: string;
    constructor(path: string);
    open(encoding?: string | null): SeekableUnicodeStreamReader;
    file_size(): number;
    join(fileid: string): FileSystemPathPointer;
    repr(): string;
    toString(): string;
}
declare class BufferedGzipFile$1 {
    constructor(..._a: unknown[]);
}
declare class GzipFileSystemPathPointer extends FileSystemPathPointer {
    open(encoding?: string | null): SeekableUnicodeStreamReader;
}
declare class ZipFilePathPointer$1 extends PathPointer {
    readonly entry: string;
    readonly zipfile: OpenOnDemandZipFile;
    constructor(zipfile: string | OpenOnDemandZipFile, entry?: string);
    open(encoding?: string | null): SeekableUnicodeStreamReader;
    file_size(): number;
    join(fileid: string): ZipFilePathPointer$1;
    repr(): string;
    toString(): string;
}

/** nltk.data.LazyLoader — defers a load until first access (adapted: thunk-based). */
declare class LazyLoader<T = unknown> {
    private readonly loader;
    private loaded;
    private didLoad;
    constructor(loader: () => T);
    load(): T;
}
/** Default NLTK data search path (mirrors nltk.data.path ordering). */
declare const dataPath: string[];
/** nltk.data.find — locate a resource under the data path, dir or zip variant. */
declare function find(resourceName: string, paths?: string[]): PathPointer;
declare function retrieve$1(..._a: unknown[]): never;
declare function load(..._a: unknown[]): never;
declare function showCfg$1(..._a: unknown[]): never;
declare function clearCache(): void;
declare const clear_cache: typeof clearCache;
/** nltk.data.open_datafile — path.join(file_name).open(encoding). */
declare function openDatafile(path: PathPointer, fileName?: string, encoding?: string | null): SeekableUnicodeStreamReader;
declare const open_datafile$1: typeof openDatafile;
/** nltk.data.split_resource_url — "<protocol>:<path>" splitter. */
declare function splitResourceUrl(resourceUrl: string): [string, string];
declare const split_resource_url: typeof splitResourceUrl;
/** nltk.data.normalize_resource_name. */
declare function normalizeResourceName(resourceName: string, allowRelative?: boolean, relativePath?: string): string;
declare const normalize_resource_name: typeof normalizeResourceName;
/** nltk.data.normalize_resource_url — nltk:/file:/external protocol normalization. */
declare function normalizeResourceUrl(resourceUrl: string): string;
declare const normalize_resource_url: typeof normalizeResourceUrl;
/** nltk.data.gzip_open_unicode — returns the decoded text (JS adaptation of the text stream). */
declare function gzipOpenUnicode(filename: string, _mode?: string, _compresslevel?: number, encoding?: string, fileobj?: Uint8Array, _errors?: string, _newline?: string): string;
declare const gzip_open_unicode: typeof gzipOpenUnicode;

type data_d_FileSystemPathPointer = FileSystemPathPointer;
declare const data_d_FileSystemPathPointer: typeof FileSystemPathPointer;
type data_d_GzipFileSystemPathPointer = GzipFileSystemPathPointer;
declare const data_d_GzipFileSystemPathPointer: typeof GzipFileSystemPathPointer;
type data_d_LazyLoader<T = unknown> = LazyLoader<T>;
declare const data_d_LazyLoader: typeof LazyLoader;
type data_d_OpenOnDemandZipFile = OpenOnDemandZipFile;
declare const data_d_OpenOnDemandZipFile: typeof OpenOnDemandZipFile;
type data_d_PathPointer = PathPointer;
declare const data_d_PathPointer: typeof PathPointer;
type data_d_SeekableUnicodeStreamReader = SeekableUnicodeStreamReader;
declare const data_d_SeekableUnicodeStreamReader: typeof SeekableUnicodeStreamReader;
declare const data_d_clearCache: typeof clearCache;
declare const data_d_clear_cache: typeof clear_cache;
declare const data_d_dataPath: typeof dataPath;
declare const data_d_find: typeof find;
declare const data_d_gzipOpenUnicode: typeof gzipOpenUnicode;
declare const data_d_gzip_open_unicode: typeof gzip_open_unicode;
declare const data_d_load: typeof load;
declare const data_d_normalizeResourceName: typeof normalizeResourceName;
declare const data_d_normalizeResourceUrl: typeof normalizeResourceUrl;
declare const data_d_normalize_resource_name: typeof normalize_resource_name;
declare const data_d_normalize_resource_url: typeof normalize_resource_url;
declare const data_d_openDatafile: typeof openDatafile;
declare const data_d_splitResourceUrl: typeof splitResourceUrl;
declare const data_d_split_resource_url: typeof split_resource_url;
declare namespace data_d {
  export {
    BufferedGzipFile$1 as BufferedGzipFile,
    data_d_FileSystemPathPointer as FileSystemPathPointer,
    data_d_GzipFileSystemPathPointer as GzipFileSystemPathPointer,
    data_d_LazyLoader as LazyLoader,
    data_d_OpenOnDemandZipFile as OpenOnDemandZipFile,
    data_d_PathPointer as PathPointer,
    data_d_SeekableUnicodeStreamReader as SeekableUnicodeStreamReader,
    ZipFilePathPointer$1 as ZipFilePathPointer,
    data_d_clearCache as clearCache,
    data_d_clear_cache as clear_cache,
    data_d_dataPath as dataPath,
    data_d_find as find,
    data_d_gzipOpenUnicode as gzipOpenUnicode,
    data_d_gzip_open_unicode as gzip_open_unicode,
    data_d_load as load,
    data_d_normalizeResourceName as normalizeResourceName,
    data_d_normalizeResourceUrl as normalizeResourceUrl,
    data_d_normalize_resource_name as normalize_resource_name,
    data_d_normalize_resource_url as normalize_resource_url,
    data_d_openDatafile as openDatafile,
    open_datafile$1 as open_datafile,
    retrieve$1 as retrieve,
    showCfg$1 as showCfg,
    data_d_splitResourceUrl as splitResourceUrl,
    data_d_split_resource_url as split_resource_url,
  };
}

/**
 * External tokenizer wrappers (ports of nltk.tokenize.stanford/repp/stanford_segmenter).
 */
declare class StanfordTokenizer {
    constructor(_pathToJar?: string, _options?: unknown);
    tokenize(_text: string): string[];
}
declare class StanfordSegmenter {
    constructor(_pathToJar?: string, _pathToSihanCorporaDict?: string, _pathToModel?: string);
    tokenize(_text: string): string[];
    segment(_text: string): string[];
}
declare class ReppTokenizer {
    constructor(_repp?: string);
    tokenize(_text: string): string[];
}

/**
 * External parser wrappers (ports of nltk.parse.bllip/corenlp/malt/stanford/transitionparser/shiftreduce).
 */
declare class BllipParser {
    constructor(..._args: unknown[]);
    parse(_tokens: string[]): unknown;
}
declare class CoreNLPParser {
    constructor(_url?: string, _encoding?: string, _tagtype?: string);
    parse(_tokens: string[]): unknown;
    rawParse(_sentence: string): unknown;
}
declare class MaltParser {
    constructor(_pathToMalt?: string, _pathToModel?: string, _additionalJarArgs?: unknown);
    parse(_tokens: string[]): unknown;
}
declare class StanfordParser {
    constructor(_pathToJar?: string, _pathToModel?: string);
    parse(_tokens: string[]): unknown;
    rawParse(_sentence: string): unknown;
}
declare class TransitionParser {
    static readonly ARC_STANDARD = "arc-standard";
    static readonly ARC_EAGER = "arc-eager";
    constructor(..._args: unknown[]);
    parse(_tokens: string[]): unknown;
}
declare class ShiftReduceParser {
    constructor(_grammar: unknown);
    parse(_tokens: string[]): unknown;
}

/**
 * External semantic wrappers (ports of nltk.sem.boxer/cooper_storage/lfg etc. that require external tools
 * or heavy Prolog glue). API surface preserved; calls throw helpfully.
 */
declare class Boxer {
    constructor(..._args: unknown[]);
    interpret(_sentence: string): unknown;
}
declare function cooperStore(_semrep: unknown, _store?: unknown): unknown;
declare function lfgParse(_sentence: string, _grammar?: unknown): unknown;
/** Honest stub: CooperStore requires the cooper-storage chart machinery (nltk.parse.featurechart.InstantiateVarsChart). */
declare class CooperStore {
    constructor(..._args: unknown[]);
}
/** Honest stub: FStructure LFG parsing depends on the MaltParser dependency pipeline. */
declare class FStructure {
    static read_depgraph(..._args: unknown[]): never;
    constructor(..._args: unknown[]);
}
/** Honest stub: parse_with_bindops requires a feature-grammar parser with binding ops. */
declare function parse_with_bindops(..._args: unknown[]): never;

declare function prettyPrint(tree: ParseTree): string;
declare class TreePrettyPrinter {
    private readonly tree;
    constructor(tree: ParseTree);
    text(): string;
    toString(): string;
}

/**
 * Paice stemming-performance statistics (port of nltk.metrics.paice).
 *
 * Counts Understemming Index (UI), Overstemming Index (OI),
 * Stemming Weight (SW) and Error-rate relative to truncation (ERRT)
 * for a stemming algorithm, given words grouped by real lemmas and by
 * algorithm stems.
 *
 * Reference: Chris D. Paice (1994). An evaluation method for stemming
 * algorithms. In Proceedings of SIGIR, 42–50.
 */
declare class Paice {
    readonly lemmas: Record<string, string[]>;
    stems: Record<string, string[]>;
    coords: Array<[number, number]>;
    gumt: number;
    gdmt: number;
    gwmt: number;
    gdnt: number;
    ui: number;
    oi: number;
    sw: number;
    errt: number;
    constructor(lemmas: Record<string, string[]>, stems: Record<string, string[]>);
    private truncationIndexes;
    private truncationCoordinates;
    private computeErrt;
    /** Recompute all statistics (call after mutating `stems`). */
    update(): void;
}

declare const MAX_ALIGN_INPUT_LEN = 512;
type Alignment$1 = Array<[string, string]>;
/** Score of an indel of P. (Kondrak 2002: 54) */
declare function sigmaSkip(_p: string): number;
/** Score of a substitution of P with Q. (Kondrak 2002: 54) */
declare function sigmaSub(p: string, q: string): number;
/** Score of an expansion/compression. (Kondrak 2002: 54) */
declare function sigmaExp(p: string, q: string): number;
/** Weighted sum of difference between P and Q. (Kondrak 2002: 54) */
declare function delta(p: string, q: string): number;
/** Difference between phonetic segments P and Q for feature F. (Kondrak 2002: 52, 54) */
declare function diff(p: string, q: string, f: string): number;
/**
 * Compute the alignment(s) of two phonetic strings.
 *
 * @param epsilon adjusts the threshold score for near-optimal alignments (0..1)
 * @returns alignments of str1 and str2 — each is a list of [segment1, segment2]
 */
declare function align(str1: string, str2: string, epsilon?: number): Alignment$1[];

/**
 * ARLSTem — light Arabic stemmer (port of nltk.stem.arlstem).
 *
 * Abainia, Ouamour & Sayoud (2017), "A Novel Robust Arabic Light Stemmer",
 * JETAI 29(3), 557-573. Dictionary-free prefix/suffix/infix stripping.
 */
declare class ARLSTem {
    /** Normalize: strip diacritics, unify alif forms, alif maqsura -> yaa. */
    norm(token: string): string;
    /** Strip common noun prefixes; null when none matched. */
    pref(token: string): string | null;
    /** Strip suffixes common to nouns and verbs. */
    suff(token: string): string;
    /** Feminine -> masculine; null when not applicable. */
    fem2masc(token: string): string | null;
    /** Plural -> singular; null when not applicable. */
    plur2sing(token: string): string | null;
    private verbT1;
    private verbT2;
    private verbT3;
    private verbT4;
    private verbT5;
    private verbT6;
    /** Stem verb prefixes/suffixes via the six transformation tables. */
    verb(token: string): string | null;
    /** Stem `token` per ARLSTem. Returns undefined for empty input (NLTK prints + returns None). */
    stem(token: string): string | undefined;
}

/**
 * ARLSTem2 Arabic stemmer (port of nltk.stem.arlstem2).
 *
 * Second-generation ARLSTem: two-round stemming with adjective-infix
 * handling and expanded feminine/plural transforms. Dictionary-free.
 */
declare class ARLSTem2 {
    private isVerb;
    norm(token: string): string;
    pref(token: string): string | null;
    /** Remove adjective infixes (^Alif, Alif, $Yaa); null when not applicable. */
    adjective(token: string): string | null;
    suff(token: string): string;
    fem2masc(token: string): string | null;
    plur2sing(token: string): string | null;
    private verbT1;
    private verbT2;
    private verbT3;
    private verbT4;
    private verbT5;
    private verbT6;
    verb(token: string): string | null;
    /** First round of stemming (NLTK stem1). */
    stem1(token: string): string | undefined;
    /** Full two-round stem. Returns undefined for empty input (NLTK returns None). */
    stem(token: string): string | undefined;
}

/**
 * ISRI Arabic stemmer (port of nltk.stem.isri.ISRIStemmer).
 *
 * A root-based stemmer implementing the ISRI algorithm with a few
 * enhancements (Taghva et al.). Includes the stop-word list and all
 * pattern tables from NLTK.
 */
declare const ISRI_STOP_WORDS: string[];
declare class ISRIStemmer {
    private readonly stopWords;
    /** @param stopWords optional custom stop-word list (default: bundled ISRI list) */
    constructor(stopWords?: string[]);
    /**
     * Normalization.
     * num=1 strip diacritics; num=2 normalize initial hamza; num=3 both.
     */
    norm(word: string, mode?: 1 | 2 | 3): string;
    /** Remove length-three then length-two prefixes. */
    pre32(word: string): string;
    /** Remove length-three then length-two suffixes. */
    suf32(word: string): string;
    /** Remove connective Waaw when it precedes a word beginning with Waaw. */
    waw(word: string): string;
    private suf1;
    private pre1;
    /** Length-4 patterns. */
    proW4(word: string): string;
    /** Length-5 patterns with trilateral roots. */
    proW53(word: string): string;
    /** Length-5 patterns with quadrilateral roots. */
    proW54(word: string): string;
    endW5(word: string): string;
    /** Length-6 patterns. */
    proW6(word: string): string;
    /** Length-6 patterns with quadrilateral roots. */
    proW64(word: string): string;
    endW6(word: string): string;
    /** Stem a word token using the ISRI stemmer. */
    stem(token: string): string;
}

/** Minimal stemmer interface matching NLTK's StemmerI. */
interface MeteorStemmer {
    stem(word: string): string;
}
type EnumPair = [index: number, word: string];
type MatchPair = [hypIdx: number, refIdx: number];
/**
 * Exact word match between hypothesis and reference.
 */
declare function exactMatch(hypothesis: string[], reference: string[]): [MatchPair[], EnumPair[], EnumPair[]];
/**
 * Stem-based match using the given stemmer (default Porter).
 */
declare function stemMatch(hypothesis: string[], reference: string[], stemmer?: MeteorStemmer): [MatchPair[], EnumPair[], EnumPair[]];
/**
 * WordNet-synonym match. Requires a loaded WordNet instance.
 */
declare function wordnetsynMatch(hypothesis: string[], reference: string[], wordnet: WordNet): [MatchPair[], EnumPair[], EnumPair[]];
/**
 * Align words via sequential exact → stem → WordNet-synonym matching.
 */
declare function alignWords(hypothesis: string[], reference: string[], options?: {
    stemmer?: MeteorStemmer;
    wordnet?: WordNet;
}): [MatchPair[], EnumPair[], EnumPair[]];
interface MeteorOptions {
    preprocess?: (w: string) => string;
    stemmer?: MeteorStemmer;
    wordnet?: WordNet;
    alpha?: number;
    beta?: number;
    gamma?: number;
}
/**
 * Sentence-level METEOR score for a single hypothesis/reference pair.
 * Returns 0.0 when there are no matches (NLTK's ZeroDivisionError path).
 */
declare function singleMeteorScore(reference: string[], hypothesis: string[], options?: MeteorOptions): number;
/**
 * METEOR score against multiple references — the best per-reference score wins.
 */
declare function meteorScore(references: string[][], hypothesis: string[], options?: MeteorOptions): number;

/**
 * Word rank alignment: word indices of the hypothesis w.r.t. reference order.
 *
 * Examples from Isozaki et al. 2010 (0-indexed):
 *   ref = "he was interested in world history because he read the book"
 *   hyp = "he read the book because he was interested in world history"
 *   -> [7, 8, 9, 10, 6, 0, 1, 2, 3, 4, 5]
 */
declare function wordRankAlignment(reference: string[], hypothesis: string[]): number[];
/** Group monotonic +1 sequences of length >= 2 out of `worder`. */
declare function findIncreasingSequences(worder: number[]): number[][];
/**
 * Kendall's Tau over the word alignment.
 * tau = 2*increasing_pairs/possible_pairs - 1; normalized to [0,1] by default.
 */
declare function kendallTau(worder: number[], normalize?: boolean): number;
/**
 * Spearman's Rho over the word alignment.
 * rho = 1 - sum(d²)/choose(len+1, 3); normalized to [0,1] by default.
 */
declare function spearmanRho(worder: number[], normalize?: boolean): number;
/**
 * Sentence-level RIBES — best score across references.
 */
declare function sentenceRibes(references: string[][], hypothesis: string[], alpha?: number, beta?: number): number;
/**
 * Corpus-level RIBES — macro-average of per-sentence best scores.
 */
/** `ribes_score.position_of_ngram` — index of the first `ngram` occurrence, or -1. */
declare function position_of_ngram(ngram: readonly string[], sentence: readonly string[]): number | null;
declare function corpusRibes(listOfReferences: string[][][], hypotheses: string[][], alpha?: number, beta?: number): number;

/**
 * TextTiling topic segmentation (port of nltk.tokenize.texttiling).
 *
 * Detects subtopic shifts via lexical co-occurrence: pseudosentences of
 * fixed size w, block-comparison (or vocabulary-introduction) similarity at
 * gaps, smoothing, depth scores, and boundary identification.
 *
 * Hearst (1997), "TextTiling: Segmenting Text into Multi-Paragraph
 * Subtopic Passages", Computational Linguistics 23(1).
 */
declare const BLOCK_COMPARISON = "block_comparison";
declare const VOCABULARY_INTRODUCTION = "vocabulary_introduction";
declare const LC = 0;
declare const HC = 1;
interface TextTilingOptions {
    /** Pseudosentence size. */
    w?: number;
    /** Block size (in pseudosentences) for the comparison method. */
    k?: number;
    /** BLOCK_COMPARISON (default) or VOCABULARY_INTRODUCTION. */
    similarityMethod?: typeof BLOCK_COMPARISON | typeof VOCABULARY_INTRODUCTION;
    /** Stopwords filtered out; defaults to an empty list (NLTK uses its corpus). */
    stopwords?: string[];
    smoothingWidth?: number;
    smoothingRounds?: number;
    /** HC (default) or LC cutoff policy. */
    cutoffPolicy?: typeof LC | typeof HC;
}
/** SciPy-Cookbook flat-window smoothing with reflected edges. */
declare function smooth(x: number[], windowLen?: number): number[];
declare class TextTilingTokenizer {
    private readonly w;
    private readonly k;
    private readonly similarityMethod;
    private readonly stopwords;
    private readonly smoothingWidth;
    private readonly smoothingRounds;
    private readonly cutoffPolicy;
    static readonly MAX_TEXT_LEN = 1000000;
    constructor(options?: TextTilingOptions);
    tokenize(text: string): string[];
    private smoothingMethodCheck;
    private markParagraphBreaks;
    private divideToTokenSequences;
    private createTokenTable;
    private blockComparison;
    /** Vocabulary-introduction scores per Section 3.2 of Hearst 1997. */
    private vocabularyIntroduction;
    private smoothScores;
    private depthScores;
    private identifyBoundaries;
    private normalizeBoundaries;
}

/**
 * Sonority-sequencing syllabifier (port of nltk.tokenize.sonority_sequencing.SyllableTokenizer).
 *
 * Splits a word into syllables via the Sonority Sequencing Principle.
 */
declare class SyllableTokenizer {
    static readonly MAX_TOKEN_LEN = 4096;
    private readonly vowels;
    private readonly phonemeMap;
    private vowelSet;
    constructor(lang?: string, sonorityHierarchy?: string[]);
    private assignValues;
    private validateSyllables;
    tokenize(token: string): string[];
}
declare function sonorityTokenize(token: string, lang?: string): string[];

/**
 * Gale-Church sentence alignment (port of nltk.translate.gale_church).
 *
 * Aligns two sequences of sentence lengths via dynamic programming.
 */
declare const MAX_ALIGN_BLOCKS = 4000;
declare const LanguageIndependent: {
    readonly PRIORS: Map<string, number>;
    readonly AVERAGE_CHARACTERS: 1;
    readonly VARIANCE_CHARACTERS: 6.8;
};
declare function erfcc(x: number): number;
declare function norm_cdf(x: number): number;
declare function norm_logsf(x: number): number;
/** `gale_church.split_at` — split a token stream on a delimiter value. */
declare function split_at<T>(it: Iterable<T>, splitValue: T): Generator<T[]>;
/** `gale_church.parse_token_stream` — token stream → per-block sentence-length lists. */
declare function parse_token_stream(stream: Iterable<string>, soft_delimiter: string, hard_delimiter: string): number[][];
declare function alignLogProb(i: number, j: number, sourceSentsLens: number[], targetSentsLens: number[], alignment: [number, number], params?: typeof LanguageIndependent): number;
declare function trace(backlinks: Map<string, [number, number] | null>, sourceSentsLens: number[], targetSentsLens: number[]): Array<[number, number]>;
declare function alignBlocks(sourceSentsLens: number[], targetSentsLens: number[], params?: typeof LanguageIndependent): Array<[number, number]>;
/** `gale_church.align_texts` — align block-segmented texts; per-block `align_blocks`. */
declare function align_texts(source_blocks: number[][], target_blocks: number[][], params?: typeof LanguageIndependent): Array<[number, number]>[];
declare const splitAt: typeof split_at;
declare const parseTokenStream: typeof parse_token_stream;
declare const alignTexts: typeof align_texts;
declare const align_blocks: typeof alignBlocks;
declare const align_log_prob: typeof alignLogProb;

/** `nltk.translate.api.Alignment` — a set of (i, j, ...) alignment tuples. */
declare class Alignment implements Iterable<number[]> {
    private readonly pairs;
    private _index;
    private readonly _len;
    constructor(pairs: Iterable<readonly number[]>);
    static fromstring(s: string): Alignment;
    /** `a[key]` — alignments originating from left index `key`. */
    get(key: number): number[][];
    invert(): Alignment;
    range(positions?: Iterable<number>): number[];
    get size(): number;
    issubset(other: Alignment): boolean;
    intersection(other: Alignment): Alignment;
    [Symbol.iterator](): Iterator<number[]>;
    repr(): string;
    toString(): string;
    private buildIndex;
}
/** `nltk.translate.api.AlignedSent` — two sentences plus their `Alignment`. */
declare class AlignedSent {
    private readonly _words;
    private readonly _mots;
    readonly alignment: Alignment;
    constructor(_words: readonly string[], _mots: readonly string[], alignment?: Alignment);
    words(): readonly string[];
    mots(): readonly string[];
    invert(): AlignedSent;
    repr(): string;
    toString(): string;
    /** Graphviz dot output; the SVG path requires the external `dot` binary. */
    toDot(): string;
    reprSvg(): string;
}

/** `nltk.translate.metrics.alignment_error_rate` — AER of `hypothesis` vs gold `reference`. */
declare function alignment_error_rate(reference: Alignment, hypothesis: Alignment, possible?: Alignment): number;

/**
 * LEPOR score (port of nltk.translate.lepor).
 *
 * Han et al. (2012) "LEPOR: A Robust Evaluation Metric for Machine Translation
 * with Augmented Factors"  https://aclanthology.org/C12-2044
 * All 6 functions are a verbatim port of the NLTK implementation.
 */
declare function lengthPenalty(reference: string[], hypothesis: string[]): number;
declare function alignment(refTokens: string[], hypTokens: string[]): number[];
declare function ngramPositionalPenalty(refTokens: string[], hypTokens: string[]): [number, number];
declare function harmonic(matchCount: number, referenceLength: number, hypothesisLength: number, alpha: number, beta: number): number;
type TokenizerFn = (s: string) => string[];
declare function sentenceLepor(references: Array<string | string[]>, hypothesis: string | string[], alpha?: number, beta?: number, tokenizer?: TokenizerFn | null): number[];
declare function corpusLepor(references: Array<Array<string | string[]>>, hypotheses: Array<string | string[]>, alpha?: number, beta?: number, tokenizer?: TokenizerFn | null): number[][];

/**
 * Phrase extraction from word alignments (port of nltk.translate.phrase_based).
 */
declare const MAX_PHRASE_EXTRACTION_DEFAULT_LEN = 100;
type PhrasePair = [[number, number], [number, number], string, string];
declare function phraseExtraction(srctext: string, trgtext: string, alignment: Array<[number, number]>, maxPhraseLength?: number): PhrasePair[];
declare function extract(srctext: string, trgtext: string, alignment: Array<[number, number]>, maxPhraseLength?: number): PhrasePair[];

/**
 * Stack decoder (port of nltk.translate.stack_decoder).
 *
 * Phrase-based stack decoder for machine translation — verbatim port of
 * NLTK's stack_decoder.py (515 LOC). Includes PhraseTable + helpers so
 * the decoder is self-contained without a separate api import.
 */
/** `nltk.translate.api.PhraseTableEntry` — namedtuple(trg_phrase, log_prob). */
declare class PhraseTableEntry {
    readonly trgPhrase: readonly string[];
    readonly logProb: number;
    constructor(trgPhrase: readonly string[], logProb: number);
    static _make(it: readonly [readonly string[], number]): PhraseTableEntry;
    _asdict(): {
        trgPhrase: readonly string[];
        logProb: number;
    };
    _replace(opts: {
        trgPhrase?: readonly string[];
        logProb?: number;
    }): PhraseTableEntry;
    get 0(): readonly string[];
    get 1(): number;
    count(): number;
    index(): number;
    toString(): string;
}
declare class PhraseTable {
    private readonly srcPhrases;
    private key;
    translationsFor(srcPhrase: readonly string[]): PhraseTableEntry[];
    translations_for: (srcPhrase: readonly string[]) => PhraseTableEntry[];
    add(srcPhrase: readonly string[], trgPhrase: readonly string[], logProb: number): void;
    has(srcPhrase: readonly string[]): boolean;
    contains: (srcPhrase: readonly string[]) => boolean;
}
interface StackDecoderLanguageModel {
    probability(phrase: readonly string[]): number;
    probabilityChange(hypothesis: Hypothesis, phrase: readonly string[]): number;
}
declare class Hypothesis {
    rawScore: number;
    srcPhraseSpan: readonly [number, number] | readonly [];
    trgPhrase: readonly string[];
    previous: Hypothesis | null;
    futureScore: number;
    constructor(opts?: {
        rawScore?: number;
        srcPhraseSpan?: readonly [number, number] | readonly [];
        trgPhrase?: readonly string[];
        previous?: Hypothesis | null;
        futureScore?: number;
    });
    score(): number;
    translatedPositions(): number[];
    totalTranslatedWords(): number;
    total_translated_words: () => number;
    translated_positions: () => number[];
    untranslatedSpans(sentenceLength: number): Array<[number, number]>;
    untranslated_spans: (sentenceLength: number) => Array<[number, number]>;
    translationSoFar(): string[];
    translation_so_far: () => string[];
    private buildTranslation;
    score_method: () => number;
}
declare class StackDecoder {
    phraseTable: PhraseTable;
    languageModel: StackDecoderLanguageModel;
    wordPenalty: number;
    beamThreshold: number;
    stackSize: number;
    private _distortionFactor;
    private _logDistortionFactor;
    constructor(phraseTable: PhraseTable, languageModel: StackDecoderLanguageModel);
    get distortionFactor(): number;
    set distortionFactor(d: number);
    get distortion_factor(): number;
    set distortion_factor(d: number);
    private computeLogDistortion;
    translate(srcSentence: string[]): string[];
    findAllSrcPhrases(srcSentence: readonly string[]): number[][];
    find_all_src_phrases: (srcSentence: readonly string[]) => number[][];
    computeFutureScores(srcSentence: readonly string[]): Map<number, Map<number, number>>;
    compute_future_scores: (srcSentence: readonly string[]) => Map<number, Map<number, number>>;
    futureScore(hypothesis: Hypothesis, futureScoreTable: Map<number, Map<number, number>>, sentenceLength: number): number;
    future_score: (hypothesis: Hypothesis, futureScoreTable: Map<number, Map<number, number>>, sentenceLength: number) => number;
    expansionScore(hypothesis: Hypothesis, translationOption: PhraseTableEntry, srcPhraseSpan: readonly [number, number]): number;
    expansion_score: (hypothesis: Hypothesis, translationOption: PhraseTableEntry, srcPhraseSpan: readonly [number, number]) => number;
    distortionScore(hypothesis: Hypothesis, nextSpan: readonly [number, number]): number;
    distortion_score: (hypothesis: Hypothesis, nextSpan: readonly [number, number]) => number;
    static validPhrases(allPhrasesFrom: number[][], hypothesis: Hypothesis): Array<[number, number]>;
    static valid_phrases: typeof StackDecoder.validPhrases;
}

declare class WordNetError extends Error {
    constructor(message: string);
}
/** `{n|v: {0: rootCount, offset: count}}` as returned by `WordNetICCorpusReader.ic`. */
type WordNetIcDict = Record<string, Record<number, number>>;
/** NLTK `Lemma` — a specific morphological sense of a word inside a synset. */
declare class Lemma {
    private readonly reader;
    private readonly _synset;
    private readonly _name;
    private readonly _senseKey;
    constructor(reader: WordNetReader, _synset: Synset, _name: string, _senseKey: string);
    name(): string;
    synset(): Synset;
    key(): string;
    lang(): string;
    count(): number;
    antonyms(): Lemma[];
    derivationally_related_forms(): Lemma[];
    pertainyms(): Lemma[];
    frame_ids(): number[];
    frame_strings(): string[];
    syntactic_marker(): null;
    hypernyms(): Synset[];
    instance_hypernyms(): Synset[];
    hyponyms(): Synset[];
    instance_hyponyms(): Synset[];
    member_holonyms(): Synset[];
    substance_holonyms(): Synset[];
    part_holonyms(): Synset[];
    member_meronyms(): Synset[];
    substance_meronyms(): Synset[];
    part_meronyms(): Synset[];
    topic_domains(): Synset[];
    usage_domains(): Synset[];
    region_domains(): Synset[];
    in_topic_domains(): Synset[];
    in_usage_domains(): Synset[];
    in_region_domains(): Synset[];
    similar_tos(): Synset[];
    also_sees(): Synset[];
    verb_groups(): Synset[];
    attributes(): Synset[];
    entailments(): Synset[];
    causes(): Synset[];
    equals(other: Lemma): boolean;
    toString(): string;
}
declare class Synset {
    private readonly reader;
    readonly row: WordNetSynset;
    protected _name: string | null;
    constructor(reader: WordNetReader, row: WordNetSynset);
    name(): string;
    pos(): string;
    offset(): number;
    lexname(): string;
    definition(): string;
    examples(): string[];
    lemma_names(): string[];
    lemmas(): Lemma[];
    private related;
    hypernyms(): Synset[];
    instance_hypernyms(): Synset[];
    hyponyms(): Synset[];
    instance_hyponyms(): Synset[];
    member_holonyms(): Synset[];
    substance_holonyms(): Synset[];
    part_holonyms(): Synset[];
    member_meronyms(): Synset[];
    substance_meronyms(): Synset[];
    part_meronyms(): Synset[];
    topic_domains(): Synset[];
    in_topic_domains(): Synset[];
    usage_domains(): Synset[];
    in_usage_domains(): Synset[];
    region_domains(): Synset[];
    in_region_domains(): Synset[];
    similar_tos(): Synset[];
    also_sees(): Synset[];
    verb_groups(): Synset[];
    attributes(): Synset[];
    entailments(): Synset[];
    causes(): Synset[];
    frame_ids(): number[];
    frame_strings(): string[];
    closure<T>(rel: (s: Synset) => Iterable<T>, depth?: number): T[];
    hypernym_paths(): Synset[][];
    root_hypernyms(): Synset[];
    common_hypernyms(other: Synset): Synset[];
    lowest_common_hypernyms(other: Synset, simulateRoot?: boolean, useMinDepth?: boolean): Synset[];
    hypernymDistances(distance?: number): Array<[Synset, number]>;
    hypernym_distances(distance?: number, simulateRoot?: boolean): Set<[Synset, number]>;
    max_depth(): number;
    min_depth(): number;
    shortest_path_distance(other: Synset, simulateRoot?: boolean): number | null;
    private _distanceMap;
    private _shortestHypernymPath;
    path_similarity(other: Synset, _verbose?: boolean, simulateRoot?: boolean): number | null;
    lch_similarity(other: Synset, _verbose?: boolean, simulateRoot?: boolean): number | null;
    wup_similarity(other: Synset, _verbose?: boolean, simulateRoot?: boolean): number | null;
    private needsRoot;
    res_similarity(other: Synset, ic: WordNetIcDict, verbose?: boolean): number;
    jcn_similarity(other: Synset, ic: WordNetIcDict, verbose?: boolean): number;
    lin_similarity(other: Synset, ic: WordNetIcDict, verbose?: boolean): number;
    tree(rel?: (s: Synset) => Synset[], cutmark?: number): unknown;
    equals(other: Synset): boolean;
    lt(other: Synset): boolean;
    toString(): string;
}
declare class WordNetReader {
    private readonly wn;
    private readonly synsetCache;
    private readonly senseNumbers;
    private readonly lexnames;
    private readonly depthCache;
    private _maxDepth;
    constructor(wn: WordNet);
    private computeSenseNumbers;
    senseNumber(synset: Synset): number;
    senseNumberFor(synset: Synset, lemma: string): number;
    lexname(synset: Synset): string;
    depthOf(synset: Synset, which: "max" | "min"): number;
    synset(idOrName: string): Synset | null;
    private rowByName;
    lemma(synset: Synset, name: string): Lemma;
    private lexfileId;
    lemmaFromKey(key: string): Lemma | null;
    synsetsByIds(ids: string[]): Synset[];
    synsets(lemma: string, pos?: WordNetPos): Synset[];
    all_synsets(pos?: WordNetPos): Synset[];
    lemmaFromName(lemmaName: string, synset: Synset): Lemma;
    lemmas(lemma: string, pos?: WordNetPos): Lemma[];
    all_lemma_names(pos?: WordNetPos): string[];
    maxDepth(pos: WordNetPos): number;
}
declare function wordnetReader(wn: WordNet): WordNetReader;
declare function information_content(synset: Synset, ic: WordNetIcDict): number;
/** `nltk.corpus.reader.wordnet` module-level similarity delegators. */
declare function jcn_similarity(synset1: Synset, synset2: Synset, ic: WordNetIcDict, verbose?: boolean): number;
declare function lin_similarity(synset1: Synset, synset2: Synset, ic: WordNetIcDict, verbose?: boolean): number;
declare function path_similarity(synset1: Synset, synset2: Synset, verbose?: boolean, simulateRoot?: boolean): number | null;
declare function lch_similarity(synset1: Synset, synset2: Synset, verbose?: boolean, simulateRoot?: boolean): number | null;
declare function wup_similarity(synset1: Synset, synset2: Synset, verbose?: boolean, simulateRoot?: boolean): number | null;
declare function res_similarity(synset1: Synset, synset2: Synset, ic: WordNetIcDict, verbose?: boolean): number;
/** `WordNetICCorpusReader` — loads `ic-*.dat` information-content files. */
declare class WordNetICCorpusReader {
    private readonly root;
    readonly fileids: string | readonly string[];
    constructor(root: string, fileids?: string | readonly string[]);
    ic(icfile: string): WordNetIcDict;
}

/**
 * POS tagset mapping (port of nltk.tag.mapping).
 *
 * Maps Penn Treebank / Brown / etc. tags to the Universal tagset (Petrov et al. 2011).
 * Unknown tags map to "X" for universal target, "UNK" otherwise — matching NLTK.
 * Built-in maps for the two tagsets NLTK documents most heavily (en-ptb, en-brown);
 * other tagsets fall back to identity + load stub.
 */
declare function tagsetMapping(source: string, target: string): Record<string, string>;
declare function mapTag(source: string, target: string, sourceTag: string): string;

/**
 * Semantic utilities (port of nltk.sem.util).
 *
 * Thin bridge between feature-grammar parses and semantic interpretation.
 * Full model evaluation lives in sem_logic / sem_evaluate; this module
 * just exposes parseSents() and rootSemrep() matching NLTK's API shape.
 */
type FeatureTreeLike = {
    label: unknown;
    children?: unknown[];
};
declare function parseSents(inputs: string[], grammar: unknown, _trace?: number): FeatureTreeLike[][];
declare function rootSemrep(tree: FeatureTreeLike, semkey?: string): unknown;
declare const parse_sents: typeof parseSents;
declare const root_semrep: typeof rootSemrep;
/** Port of nltk.sem.util.read_sents: read non-blank, non-comment lines from a file. */
declare function read_sents(filename: string, encoding?: string): string[];
declare const readSents: typeof read_sents;
/** Port of nltk.sem.util.interpret_sents (partial: depends on the stub parseSents). */
declare function interpret_sents(inputs: string[], grammar: unknown, semkey?: string, trace?: number): Array<Array<[FeatureTreeLike, unknown]>>;
declare const interpretSents: typeof interpret_sents;
/** Port of nltk.sem.util.evaluate_sents (partial: depends on the stub parseSents). */
declare function evaluate_sents(inputs: string[], grammar: unknown, model: Model, assignment: Assignment, trace?: number): Array<Array<[FeatureTreeLike, unknown, unknown]>>;
declare const evaluateSents: typeof evaluate_sents;
/** Port of nltk.sem.util.demo_model0: build NLTK's demo model + assignment. */
declare function demo_model0(): {
    m0: Model;
    g0: Assignment;
};
declare const demoModel0: typeof demo_model0;
/** Port of nltk.sem.util.demo_legacy_grammar (lowercase 'sem' feature check). */
declare function demo_legacy_grammar(): Array<[FeatureTreeLike, unknown]>;
declare const demoLegacyGrammar: typeof demo_legacy_grammar;

/**
 * TBL error analysis (port of nltk.tbl.erroranalysis).
 *
 * Returns a human-readable list of tagging errors comparing a gold corpus
 * to a tagger's output.
 */
type TaggedToken$1 = readonly [word: string, tag: string];
/**
 * Returns lines describing every tagging mismatch, plus a header line.
 * Port of nltk.tbl.erroranalysis.error_list.
 */
declare function errorList(trainSents: ReadonlyArray<readonly TaggedToken$1[]>, testSents: ReadonlyArray<readonly TaggedToken$1[]>): string[];

/**
 * TBL demo helpers (port of nltk.tbl.demo).
 *
 * `postag` is a faithful port of the demo driver: it prepares the data split,
 * trains a UnigramTagger baseline over a RegexpTagger backoff, runs
 * BrillTaggerTrainer and reports accuracy. Corpus-bound options (treebank
 * data, pickle caching/serialization, matplotlib learning curves, incremental
 * stats) throw an unsupported error rather than silently changing behavior.
 */

type DemoTaggedSentence = [string, string][];
/** nltk.tbl.demo.corpus_size — (num sequences, total tokens). */
declare function corpusSize(seqs: ReadonlyArray<readonly unknown[]>): [number, number];

interface PostagOptions {
    templates?: readonly Template[];
    taggedData?: readonly GoldSentence[];
    numSents?: number;
    maxRules?: number;
    minScore?: number;
    minAcc?: number | null;
    train?: number;
    trace?: number;
    randomize?: boolean;
    ruleformat?: string;
    incrementalStats?: boolean;
    templateStats?: boolean;
    errorOutput?: string | null;
    serializeOutput?: string | null;
    learningCurveOutput?: string | null;
    learningCurveTake?: number;
    baselineBackoffTagger?: SequentialBackoffTagger | null;
    separateBaselineData?: boolean;
    cacheBaselineTagger?: string | null;
}
interface PostagResult {
    tagger: BrillTagger;
    baselineAccuracy: number | null;
    brillAccuracy: number | null;
    taggedTest: DemoTaggedSentence[];
}
/** nltk.tbl.demo.postag — Brill tagger demonstration driver. */
declare function postag(options?: PostagOptions): PostagResult;
/** nltk.tbl.demo.demo* — each runs postag with a fixed option set. They
 * still require tagged_data/treebank, so the unconfigured call throws the
 * same unsupported error as postag. */
declare function demo$e(options?: PostagOptions): PostagResult;
declare function demoReprRuleFormat(options?: PostagOptions): PostagResult;
declare function demoStrRuleFormat(options?: PostagOptions): PostagResult;
declare function demoVerboseRuleFormat(options?: PostagOptions): PostagResult;
declare function demoMultipositionFeature(options?: PostagOptions): PostagResult;
declare function demoMultifeatureTemplate(options?: PostagOptions): PostagResult;
declare function demoGeneratedTemplates(options?: PostagOptions): PostagResult;
declare function demoTemplateStatistics(options?: PostagOptions): PostagResult;
declare function demoErrorAnalysis(options?: PostagOptions): PostagResult;
declare function demoSerializeTagger(options?: PostagOptions): PostagResult;
declare function demoHighAccuracyRules(options?: PostagOptions): PostagResult;
declare function demoLearningCurve(options?: PostagOptions): PostagResult;

/**
 * NIST tokenizer (port of nltk.tokenize.nist.NISTTokenizer).
 *
 * Sentence-based port of mteval-v14.pl tokenization. Uses the bundled
 * perluniprops character-class data for the international path.
 */
declare class NISTTokenizer {
    private static STRIP_SKIP;
    private static STRIP_EOL_HYPHEN;
    private static PUNCT;
    private static PERIOD_COMMA_PRECEED;
    private static PERIOD_COMMA_FOLLOW;
    private static DASH_PRECEED_DIGIT;
    private static LANG_DEPENDENT;
    private static NONASCII;
    private static PUNCT_1;
    private static PUNCT_2;
    private static SYMBOLS;
    private static INTERNATIONAL;
    private langIndependentSub;
    tokenize(text: string, opts?: {
        lowercase?: boolean;
        westernLang?: boolean;
        returnStr?: boolean;
    }): string[] | string;
    internationalTokenize(text: string, opts?: {
        lowercase?: boolean;
        splitNonAscii?: boolean;
        returnStr?: boolean;
    }): string[] | string;
}
declare function nistTokenize(text: string, lowercase?: boolean): string[];
declare function nistInternationalTokenize(text: string, lowercase?: boolean): string[];

/**
 * CFG sentence generation (port of nltk.parse.generate).
 *
 * Enumerates all sentences derivable from a CFG up to a given depth.
 * Matches NLTK's budget-limited generation (CWE-400 protection): caps total
 * expansion+emission steps; throws once the limit is hit.
 */

declare const MAX_GENERATE_OPERATIONS = 1000000;
/**
 * Generate sentences from a CFG.
 *
 * @param grammar  CFG to generate from
 * @param options  start symbol (default: grammar.startSymbol), depth & n limits
 */
declare function generate(grammar: CfgGrammar, options?: {
    start?: string;
    depth?: number;
    n?: number;
}): Generator<string[]>;
/** Convenience: collect up to n sentences into an array. */
declare function generateSentences(grammar: CfgGrammar, options?: {
    start?: string;
    depth?: number;
    n?: number;
}): string[][];

/**
 * CRF tagger shim (port of nltk.tag.crf).
 *
 * Thin wrapper around python-crfsuite (pycrfsuite) — an external binary
 * unavailable in the JS runtime. Preserves the full typed API surface so
 * imports and isinstance checks remain valid; runtime calls throw with a
 * helpful message (consistent with src/classify_wrappers.ts).
 */
type CrfFeatureFunc = (tokens: string[], idx: number) => string[];
type CrfTrainingOptions = Record<string, unknown>;
declare class CRFTagger {
    constructor(_featureFunc?: CrfFeatureFunc | null, _verbose?: boolean, _trainingOpt?: CrfTrainingOptions | null);
    setModelFile(_modelFile: string): void;
    set_model_file(_modelFile: string): void;
    tagSents(_sentences: string[][]): Array<Array<[string, string]>>;
    tag_sents(_sentences: string[][]): Array<Array<[string, string]>>;
    tag(_tokens: string[]): Array<[string, string]>;
    train(_trainData: Array<Array<[string, string]>>, _modelFile: string): void;
    clearFeatureCache(): void;
    clear_feature_cache(): void;
    accuracy(_goldSentences: Array<Array<[string, string]>>): number;
}

/**
 * Sentiment analyzer shim (port of nltk.sentiment.sentiment_analyzer).
 *
 * SentimentAnalyzer is a thin teaching/demo wrapper around NLTK
 * classifiers and collocation helpers. While its core logic is pure
 * Python, it is not a standalone metric — it requires a trained
 * classifier (NaiveBayes, Maxent, etc.) and NLTK's collocation/
 * probability machinery. The fully-native VADER analyzer lives in
 * src/sentiment.ts; this shim preserves the SentimentAnalyzer API
 * surface with typed stubs so imports stay valid in the JS runtime.
 *
 * Consistent with src/classify_wrappers.ts and src/tag_crf.ts: calling
 * any method throws a helpful error noting the external dependency.
 */
type LabeledDocument = [words: string[], label: string];
type FeatureDict = Record<string, unknown>;
type FeatureExtractor = (document: string[], ...args: unknown[]) => FeatureDict;
type ClassifierLike = {
    classify(feats: FeatureDict): string;
};
type TrainerFn = (trainingSet: Array<[FeatureDict, string]>, ...args: unknown[]) => ClassifierLike;
declare class SentimentAnalyzer {
    featExtractors: Map<FeatureExtractor, unknown[]>;
    classifier: ClassifierLike | null;
    constructor(_classifier?: ClassifierLike | null);
    allWords(_documents: Array<LabeledDocument | string[]>, _labeled?: boolean | null): string[];
    all_words(_documents: Array<LabeledDocument | string[]>, _labeled?: boolean | null): string[];
    applyFeatures(_documents: unknown, _labeled?: boolean | null): unknown;
    apply_features(_documents: unknown, _labeled?: boolean | null): unknown;
    unigramWordFeats(_words: string[], _topN?: number | null, _minFreq?: number): string[];
    unigram_word_feats(_words: string[], _topN?: number | null, _minFreq?: number): string[];
    bigramCollocationFeats(_documents: string[][], _topN?: number | null, _minFreq?: number, _assocMeasure?: unknown): Array<[string, string]>;
    bigram_collocation_feats(_documents: string[][], _topN?: number | null, _minFreq?: number, _assocMeasure?: unknown): Array<[string, string]>;
    classify(_instance: string[]): string;
    addFeatExtractor(_fn: FeatureExtractor, ..._kwargs: unknown[]): void;
    add_feat_extractor(_fn: FeatureExtractor, ..._kwargs: unknown[]): void;
    extractFeatures(_document: string[]): FeatureDict;
    extract_features(_document: string[]): FeatureDict;
    train(_trainer: TrainerFn, _trainingSet: unknown, _saveClassifier?: string | null, ..._kwargs: unknown[]): ClassifierLike;
    saveFile(_content: unknown, _filename: string): void;
    save_file(_content: unknown, _filename: string): void;
    evaluate(_testSet: Array<[FeatureDict, string]>, _classifier?: ClassifierLike | null, _accuracy?: boolean, _fMeasure?: boolean, _precision?: boolean, _recall?: boolean, _verbose?: boolean): Record<string, number>;
}

/**
 * Port of nltk.sem.relextract — Relation Extraction (539 LOC).
 * Pure algorithmic, no external corpora deps at runtime.
 * APIs are provided in both snake_case (faithful to NLTK) and camelCase.
 */
declare const NE_CLASSES: Record<string, string[]>;
declare const short2long: Record<string, string>;
declare const long2short: Record<string, string>;
declare function class_abbrev(type: string): string;
type TaggedWord = [string, string];
type JoinItem = string | TaggedWord;
declare function descape_entity(m: RegExpMatchArray): string;
declare function list2sym(lst: JoinItem[]): string;
interface NeTree {
    label(): string;
    leaves(): JoinItem[];
}
type ChunkTree$1 = Array<string | TaggedWord | NeTree>;
type SemiRel = [JoinItem[], NeTree | null];
type RelDict = Record<string, string>;
type IeDocument = {
    text: ChunkTree$1;
    headline: ChunkTree$1;
    docno?: string;
};
declare function tree2semi_rel(tree: ChunkTree$1): SemiRel[];
declare function semi_rel2reldict(pairs: SemiRel[], window?: number, trace?: boolean): RelDict[];
declare function extractRels(subjClass: string, objClass: string, doc: ChunkTree$1 | IeDocument, opts?: {
    corpus?: string;
    pattern?: RegExp;
    window?: number;
}): RelDict[];
declare function rtuple(reldict: RelDict, lcon?: boolean, rcon?: boolean): string;
declare function clause(reldict: RelDict, relsym: string): string;
declare function in_demo(_trace?: number, _sql?: boolean): void;
declare function roles_demo(_trace?: number): void;
declare function ieer_headlines(): void;
declare function conllned(_trace?: number): void;
declare function conllesp(): void;
declare function ne_chunked(): void;

/**
 * Port of nltk.sem.linearlogic — linear logic fragment used by glue semantics.
 *
 * Mirrors NLTK's sem/linearlogic.py: AtomicExpression (Constant/Variable),
 * ImpExpression, ApplicationExpression, BindingDict, and a simple parser.
 * Used internally by sem_glue; also re-exported for completeness.
 */
declare class VariableBindingException extends Error {
    constructor(msg: string);
}
declare class LinearLogicApplicationException extends Error {
    constructor(msg: string);
}
declare class BindingDict$1 {
    /** key: variable name, value: AtomicExpression */
    d: Map<string, AtomicExpression>;
    constructor(bindings?: Array<[VariableExpression, AtomicExpression]>);
    set(v: VariableExpression, b: AtomicExpression): void;
    get(v: VariableExpression): AtomicExpression;
    has(item: AtomicExpression): boolean;
    add(other: BindingDict$1): BindingDict$1;
    equals(other: BindingDict$1): boolean;
    toString(): string;
}
declare abstract class Expression {
    static fromstring(s: string): Expression;
    abstract simplify(bindings?: BindingDict$1): Expression;
    abstract toString(): string;
    abstract equals(other: Expression): boolean;
    applyto(other: Expression, otherIndices?: Set<number> | null): ApplicationExpression;
    compilePos(_c: CounterLike, _f: GlueFormulaFactory$1): [Expression, GlueFormulaLike[]];
    compileNeg(_c: CounterLike, _f: GlueFormulaFactory$1): [Expression, GlueFormulaLike[]];
}
type CounterLike = {
    get(): number;
};
type GlueFormulaFactory$1 = (meaning: string, glue: Expression, indices: Set<number>) => GlueFormulaLike;
interface GlueFormulaLike {
    glue: Expression;
    indices: Set<number>;
}
declare class AtomicExpression extends Expression {
    name: string;
    dependencies: number[];
    constructor(name: string, deps?: number[]);
    simplify(bindings?: BindingDict$1): Expression;
    compilePos(_c: CounterLike, _f: GlueFormulaFactory$1): [Expression, GlueFormulaLike[]];
    compileNeg(_c: CounterLike, _f: GlueFormulaFactory$1): [Expression, GlueFormulaLike[]];
    equals(other: Expression): boolean;
    toString(): string;
}
declare class ConstantExpression extends AtomicExpression {
    unify(other: Expression, bindings: BindingDict$1): BindingDict$1;
}
declare class VariableExpression extends AtomicExpression {
    unify(other: Expression, bindings: BindingDict$1): BindingDict$1;
}
declare class ImpExpression extends Expression {
    antecedent: Expression;
    consequent: Expression;
    constructor(antecedent: Expression, consequent: Expression);
    simplify(bindings?: BindingDict$1): Expression;
    unify(other: Expression, bindings: BindingDict$1): BindingDict$1;
    compilePos(counter: CounterLike, factory: GlueFormulaFactory$1): [Expression, GlueFormulaLike[]];
    compileNeg(counter: CounterLike, factory: GlueFormulaFactory$1): [Expression, GlueFormulaLike[]];
    equals(other: Expression): boolean;
    toString(): string;
}
declare class ApplicationExpression extends Expression {
    func: Expression;
    argument: Expression;
    bindings: BindingDict$1;
    constructor(func: Expression, argument: Expression, argumentIndices: Set<number> | null);
    simplify(bindings?: BindingDict$1): Expression;
    equals(other: Expression): boolean;
    toString(): string;
    compilePos(): [Expression, GlueFormulaLike[]];
    compileNeg(): [Expression, GlueFormulaLike[]];
}
declare class LinearLogicParser {
    parse(s: string): Expression;
    private tokenize;
}
declare class Atom extends ConstantExpression {
    constructor(name: string);
}
declare class ParExpression extends Expression {
    left: Expression;
    right: Expression;
    constructor(left: Expression, right: Expression);
    simplify(): Expression;
    equals(other: Expression): boolean;
    toString(): string;
    compilePos(): [Expression, GlueFormulaLike[]];
    compileNeg(): [Expression, GlueFormulaLike[]];
}
declare class GlueFormula$1 {
    meaning: string;
    glue: Expression | string;
    constructor(meaning: string, glue: Expression | string);
    toString(): string;
}

/**
 * Port of nltk.sem.hole — Hole Semantics (Blackburn & Bos, Representation and Inference for Natural Language)
 */

declare const Constants: {
    ALL: string;
    EXISTS: string;
    NOT: string;
    AND: string;
    OR: string;
    IMP: string;
    IFF: string;
    PRED: string;
    LEQ: string;
    HOLE: string;
    LABEL: string;
    MAP: Record<string, (a: unknown, b: unknown) => Expression$1>;
};
declare class Constraint {
    lhs: Expression$1;
    rhs: Expression$1;
    constructor(lhs: Expression$1, rhs: Expression$1);
    equals(other: unknown): boolean;
    toString(): string;
    hash(): string;
}
declare class HoleSemantics {
    holes: Expression$1[];
    labels: Expression$1[];
    fragments: Map<string, [Expression$1, Expression$1[]]>;
    constraints: Constraint[];
    top_most_labels: Expression$1[];
    top_hole: Expression$1 | null;
    constructor(usr: Expression$1);
    isNode(x: Expression$1): boolean;
    private _breakDown;
    private _findTopNodes;
    private _findTopMostLabels;
    private _findTopHole;
    pluggings(): Map<string, Expression$1>[];
    private _plugNodes;
    private _plugHole;
    private _violatesConstraints;
    private _sanityCheckPlugging;
    formulaTree(plugging: Map<string, Expression$1>): Expression$1;
    private _formulaTree;
}
declare function holeReadings(sentence: string, _grammarFilename?: string, _verbose?: boolean): Expression$1[];
/** Helper to run hole semantics pipeline from a pre-parsed USR expression */
declare function holeReadingsFromUsr(usr: Expression$1): Expression$1[];

/**
 * Port of nltk.sem.glue + nltk.sem.linearlogic — Glue Semantics framework.
 *
 * Main Glue Semantics framework (Dan Garrette). Depends on sem_logic for
 * meaning language (FOL) and sem_linearlogic for the linear-logic fragment.
 * Corpus-dependent parts (GlueDict file loading, dependency parsing) throw
 * helpful errors with a corpus-missing message.
 */

declare class Counter {
    private n;
    get(): number;
    peek(): number;
}
type GlueFormulaFactory = (meaning: string, glue: Expression, indices: Set<number>) => GlueFormula;
declare class GlueFormula {
    meaning: Expression$1;
    glue: Expression;
    indices: Set<number>;
    /** optional word label set by GlueDict */
    word?: string;
    constructor(meaning: string | Expression$1, glue: string | Expression, indices?: Set<number>);
    static fromExpressions(meaning: Expression$1, glue: Expression, indices?: Set<number>): GlueFormula;
    applyto(arg: GlueFormula): GlueFormula;
    makeVariableExpression(name: string): AbstractVariableExpression;
    makeLambdaExpression(variable: Variable, term: Expression$1): Expression$1;
    lambdaAbstract(other: GlueFormula): GlueFormula;
    compile(counter?: Counter): GlueFormula[];
    simplify(): GlueFormula;
    equals(other: GlueFormula): boolean;
    toString(): string;
}

interface DepNode {
    address: number;
    word: string;
    tag: string;
    rel: string;
    head: number;
    deps: Record<string, number[]>;
    [k: string]: unknown;
}
interface DepGraphLike {
    nodes: Record<number, DepNode>;
}
declare class GlueDict {
    filename: string;
    fileEncoding: string | null;
    private data;
    constructor(filename: string, encoding?: string | null);
    readFile(emptyFirst?: boolean): void;
    /** Load semtype entries from a string in NLTK glue.semtype format. */
    loadFromString(contents: string): void;
    hasSemtype(sem: string): boolean;
    getSemtype(sem: string): Map<string, string[][]> | undefined;
    toGlueFormulaList(depgraph: DepGraphLike, node?: DepNode | null, counter?: Counter | null, _verbose?: boolean): GlueFormula[];
    lookup(node: DepNode, depgraph: DepGraphLike, counter: Counter): GlueFormula[];
    addMissingDependencies(node: DepNode, depgraph: DepGraphLike): void;
    private lookupSemtypeOption;
    getSemtypes(node: DepNode): string[];
    getGlueFormulasFromSemtypeEntry(lookup: string[][], word: string, node: DepNode, depgraph: DepGraphLike, counter: Counter): GlueFormula[];
    getMeaningFormula(generic: string, word: string): string;
    initializeLabels(expr: Expression, node: DepNode, depgraph: DepGraphLike, uniqueIndex: number): Expression;
    findLabelName(name: string, node: DepNode, depgraph: DepGraphLike, uniqueIndex: number): string;
    getLabel(node: DepNode): string;
    lookupUnique(rel: string, node: DepNode, depgraph: DepGraphLike): DepNode;
    getGlueFormulaFactory(): GlueFormulaFactory;
    toString(): string;
}

declare class Glue {
    verbose: boolean;
    removeDuplicates: boolean;
    depparser: unknown;
    semtypeFile: string;
    constructor(opts?: {
        semtypeFile?: string;
        removeDuplicates?: boolean;
        depparser?: unknown;
        verbose?: boolean;
    });
    trainDepparser(depgraphs?: unknown): void;
    parseToMeaning(sentence: string[]): Expression$1[];
    getReadings(agenda: GlueFormula[]): Expression$1[];
    parseToCompiled(sentence: string[]): GlueFormula[][];
    depParse(sentence: string[]): DepGraphLike[];
    depgraphToGlue(depgraph: DepGraphLike): GlueFormula[];
    getGlueDict(): GlueDict;
    gflToCompiled(gfl: GlueFormula[]): GlueFormula[];
    getPosTagger(): unknown;
}
declare class DrtGlueFormula extends GlueFormula {
    constructor(meaning: string | Expression$1, glue: string | Expression, indices?: Set<number>);
    makeVariableExpression(name: string): AbstractVariableExpression;
    makeLambdaExpression(variable: Variable, term: Expression$1): Expression$1;
}
declare class DrtGlueDict extends GlueDict {
    getGlueFormulaFactory(): GlueFormulaFactory;
}
declare class DrtGlue extends Glue {
    constructor(opts?: {
        semtypeFile?: string;
        removeDuplicates?: boolean;
        depparser?: unknown;
        verbose?: boolean;
    });
    getGlueDict(): GlueDict;
}

interface RelationMeta {
    rel_name: string;
    closures: string[];
    schema: string[];
    filename: string;
}
declare const items: string[];
declare const rels: RelationMeta[];
declare class Concept {
    prefLabel: string;
    arity: number;
    altLabels: string[];
    closures: string[];
    private _extension;
    extension: Array<string | [string, string]>;
    constructor(prefLabel: string, arity: number, altLabels?: string[], closures?: string[], extension?: Set<string | [string, string]>);
    toString(): string;
    augment(data: string | [string, string]): Set<string | [string, string]>;
    private makeGraph;
    private transclose;
    private makePairs;
    close(): void;
    get innerExtension(): Set<string | [string, string]>;
}
declare function unaryConcept(label: string, subj: number, records: string[][]): Concept;
declare function binaryConcept(label: string, closures: string[], subj: number, obj: number, records: string[][]): Concept;
declare function clause2concepts(filename: string, relName: string, schema: string[], closures?: string[], records?: string[][]): Concept[];
declare function processBundle(bundles: RelationMeta[], preloaded?: Map<string, string[][]>): Record<string, Concept>;
declare function makeValuation(concepts: Concept[] | Record<string, Concept>, read?: boolean, lexicon?: boolean): Array<[string, Array<string | [string, string]>]> | Map<string, unknown>;
declare function labelIndivs(valuation: Map<string, unknown>, lexicon?: boolean): Map<string, unknown>;
declare function makeLex(symbols: Set<string> | string[]): string[];
declare function concepts(itemsParam?: string | string[]): Concept[];
declare function valDump(_rels: RelationMeta[], _db: string): never;
declare function valLoad(_db: string): never;
declare function cities2table(_filename: string, _relName: string, _dbname: string, _verbose?: boolean, _setup?: boolean): never;
declare function sqlQuery(_dbname: string, _query: string): never;
declare class Chat80CorpusReader {
    constructor(_root?: string, _files?: string[]);
    sqlQuery(_query: string): unknown[];
    query(_q: string): unknown[];
}
declare function sqlDemo(): void;
declare function main(): void;

/**
 * Port of nltk.sem.drt_glue_demo — GUI demo for Glue Semantics with DRT.
 *
 * Original is a tkinter GUI (DrtGlueDemo + DrsWidget + demo()). In bun_nltk
 * the GUI is not available (no tkinter/Canvas in JS). This port keeps the
 * data-flow and glue-parsing algorithms headless: example list, reading cache,
 * DrtGlue wiring, and navigation logic all work programmatically. Any method
 * that would open a Tk window throws a helpful error explaining the JS
 * alternative.
 */

declare class DrsWidget$1 {
    drs: unknown;
    canvas: unknown;
    bbox: [number, number, number, number];
    constructor(canvas: unknown, drs: unknown);
    draw(): void;
    clear(): void;
}
interface DrtGlueDemoOptions {
    glue?: DrtGlue;
}
declare class DrtGlueDemo {
    examples: string[];
    readingCache: Array<unknown[] | unknown | null>;
    curExample: number;
    readings: unknown[];
    drs: unknown;
    drsWidget: DrsWidget$1 | null;
    error: unknown;
    showGrammar: boolean;
    size: number;
    private glue;
    constructor(examples: string[], opts?: DrtGlueDemoOptions);
    /** Mirrors _init_glue — builds a RegexpTagger + MaltParser-backed DrtGlue in Python. */
    private initGlue;
    /** Parse an example string (space-separated) into DRS readings. Caches the result. */
    getReadingsForExample(example: string): unknown[];
    /** Select an example by index (mirrors _exampleList_store_selection). */
    selectExample(index: number): void;
    /** Select a reading by index (mirrors _readingList_store_selection). */
    selectReading(index: number): void;
    next(): void;
    prev(): void;
    private selectNextExample;
    private selectPreviousExample;
    destroy(..._args: unknown[]): void;
    mainloop(..._args: unknown[]): void;
    resize(..._args: unknown[]): void;
    postscript(..._args: unknown[]): void;
    about(..._args: unknown[]): void;
    _exampleList_select: () => never;
    _readingList_select: () => never;
}

/**
 * Cluster API — port of nltk/cluster/api.py
 *
 * Defines ClusterI interface and core vector helpers (euclidean/cosine/normalise).
 */
type Vector = number[];
declare function dotProduct(a: Vector, b: Vector): number;
declare function vectorNorm(v: Vector): number;
declare function vectorAdd(a: Vector, b: Vector): Vector;
declare function vectorSub(a: Vector, b: Vector): Vector;
declare function vectorScale(v: Vector, s: number): Vector;
declare function vectorDiv(v: Vector, s: number): Vector;
declare function zeroVector(dim: number): Vector;
declare function copyVector(v: Vector): Vector;
declare function normalizeVector(v: Vector): Vector;
declare function euclideanDistance(a: Vector, b: Vector): number;
declare function cosineDistance(a: Vector, b: Vector): number;
declare function sumVectors(vectors: Vector[]): Vector;
declare function meanVector(vectors: Vector[]): Vector;
type ProbDist = Map<number, number> | Record<number, number>;
declare abstract class ClusterI {
    abstract cluster(vectors: Vector[], assignClusters?: boolean): number[] | void;
    abstract classify(vector: Vector): number;
    abstract numClusters(): number;
    likelihood(_vector: Vector, label: number): number;
    classificationProbDist(vector: Vector): Map<number, number>;
    clusterNames(): number[];
    clusterName(index: number): number;
}

/**
 * Cluster utilities — port of nltk/cluster/util.py
 *
 * VectorSpaceClusterer, Dendrogram, memo helpers.
 */

declare class DendrogramNode {
    readonly value: unknown;
    readonly children: DendrogramNode[];
    constructor(value: unknown, ...children: DendrogramNode[]);
    leaves(values?: boolean): unknown[];
    groups(n: number): unknown[][];
}
declare class Dendrogram {
    private _items;
    private _originalItems;
    private _merge;
    constructor(items?: unknown[]);
    merge(...indices: number[]): void;
    groups(n: number): unknown[][];
    show(leafLabels?: string[]): string;
    toString(): string;
}
declare abstract class VectorSpaceClusterer extends ClusterI {
    protected _shouldNormalise: boolean;
    protected _svdDimensions: number | null | undefined;
    protected _Tt: number[][] | null;
    constructor(normalise?: boolean, svdDimensions?: number | null);
    cluster(vectors: Vector[], assignClusters?: boolean, trace?: boolean): number[] | void;
    abstract clusterVectorspace(vectors: Vector[], trace: boolean): void;
    abstract classifyVectorspace(vector: Vector): number;
    classify(vector: Vector): number;
    likelihood(vector: Vector, label: number): number;
    likelihoodVectorspace(vector: Vector, cluster: number): number;
    vector(vector: Vector): Vector;
    protected _normalise(v: Vector): Vector;
    private _project;
    private _applySVD;
}

declare function memoize$1<T extends (...args: unknown[]) => unknown>(fn: T): T;

/**
 * K-Means clusterer — port of nltk/cluster/kmeans.py
 *
 * Faithful to NLTK hill-climbing batch K-means with optional kmeans++ init,
 * euclidean/cosine iteration, convergence test, repeats + best-means selection.
 */

type DistanceFn = (a: Vector, b: Vector) => number;
interface KMeansOptions {
    distance?: DistanceFn;
    repeats?: number;
    convTest?: number;
    initialMeans?: Vector[] | null;
    normalise?: boolean;
    svdDimensions?: number | null;
    avoidEmptyClusters?: boolean;
    seed?: number;
    useKMeansPlusPlus?: boolean;
    useNative?: boolean;
}
declare class KMeansClusterer extends VectorSpaceClusterer {
    private _numMeans;
    private _distance;
    private _convTest;
    private _means;
    private _repeats;
    private _rng;
    private _avoidEmptyClusters;
    private _useKMeansPP;
    private _useNative;
    constructor(numMeans: number, distance?: DistanceFn | null, options?: KMeansOptions | number);
    setRng(rng: () => number): void;
    clusterVectorspace(vectors: Vector[], trace?: boolean): void;
    private _clusterOnce;
    classifyVectorspace(vector: Vector): number;
    numClusters(): number;
    means(): Vector[] | null;
    private _sumDistances;
    private _centroid;
    toString(): string;
}

/**
 * EM clusterer — port of nltk/cluster/em.py
 *
 * Gaussian mixture EM with E-step soft assignment and M-step re-estimation
 * (priors, means, covariances + bias). Faithful to NLTK but JS-idiomatic.
 */

interface EMOptions {
    priors?: number[] | null;
    covarianceMatrices?: number[][][] | null;
    convThreshold?: number;
    bias?: number;
    normalise?: boolean;
    svdDimensions?: number | null;
}
declare class EMClusterer extends VectorSpaceClusterer {
    private _means;
    private _numClusters;
    private _convThreshold;
    private _bias;
    private _priors;
    private _covariances;
    constructor(initialMeans: Vector[], options?: EMOptions);
    numClusters(): number;
    getMeans(): Vector[];
    getPriors(): number[] | null;
    getCovariances(): number[][][] | null;
    clusterVectorspace(vectors: Vector[], trace?: boolean): void;
    classifyVectorspace(vector: Vector): number;
    likelihoodVectorspace(vector: Vector, cluster: number): number;
    private _logLikelihood;
    toString(): string;
}

/**
 * Group Average Agglomerative clusterer — port of nltk/cluster/gaac.py
 *
 * Starts with N singletons, repeatedly merges the pair with minimal
 * cosine distance between centroids (group-average, weighted by cluster size).
 * Dendrogram tracks merge order; cutting it at numClusters yields partition.
 */

declare class GAAClusterer extends VectorSpaceClusterer {
    private _numClusters;
    private _dendrogram;
    private _centroids;
    constructor(numClusters?: number, normalise?: boolean, svdDimensions?: number | null);
    cluster(vectors: Vector[], assignClusters?: boolean, trace?: boolean): number[] | void;
    clusterVectorspace(vectors: Vector[], trace?: boolean): void;
    private _mergeSimilarities;
    updateClusters(numClusters: number): void;
    classifyVectorspace(vector: Vector): number;
    dendrogram(): Dendrogram | null;
    numClusters(): number;
    centroids(): Vector[];
    toString(): string;
}
declare const GAACClusterer: typeof GAAClusterer;
declare const GAACluster: typeof GAAClusterer;

/**
 * Port of nltk.misc.chomsky — Chomsky random text generator.
 * Faithful port of leadins/subjects/verbs/objects and generate_chomsky.
 * Uses Math.random shuffle; wrapping via simple greedy fill to lineLength.
 */
declare const leadins = "To characterize a linguistic level L,\n    On the other hand,\n    This suggests that\n    It appears that\n    Furthermore,\n    We will bring evidence in favor of the following thesis:\n    To provide a constituent structure for T(Z,K),\n    From C1, it follows that\n    For any transformation which is sufficiently diversified in application to be of any interest,\n    Analogously,\n    Clearly,\n    Note that\n    Of course,\n    Suppose, for instance, that\n    Thus\n    With this clarification,\n    Conversely,\n    We have already seen that\n    By combining adjunctions and certain deformations,\n    I suggested that these results would follow from the assumption that\n    If the position of the trace in (99c) were only relatively inaccessible to movement,\n    However, this assumption is not correct, since\n    Comparing these examples with their parasitic gap counterparts in (96) and (97), we see that\n    In the discussion of resumptive pronouns following (81),\n    So far,\n    Nevertheless,\n    For one thing,\n    Summarizing, then, we assume that\n    A consequence of the approach just outlined is that\n    Presumably,\n    On our assumptions,\n    It may be, then, that\n    It must be emphasized, once again, that\n    Let us continue to suppose that\n    Notice, incidentally, that";
declare const subjects = " the notion of level of grammaticalness\n    a case of semigrammaticalness of a different sort\n    most of the methodological work in modern linguistics\n    a subset of English sentences interesting on quite independent grounds\n    the natural general principle that will subsume this case\n    an important property of these three types of EC\n    any associated supporting element\n    the appearance of parasitic gaps in domains relatively inaccessible to ordinary extraction\n    the speaker-hearer's linguistic intuition\n    the descriptive power of the base component\n    the earlier discussion of deviance\n    this analysis of a formative as a pair of sets of features\n    this selectionally introduced contextual feature\n    a descriptively adequate grammar\n    the fundamental error of regarding functional notions as categorial\n    relational information\n    the systematic use of complex symbols\n    the theory of syntactic features developed earlier";
declare const verbs = "can be defined in such a way as to impose\n    delimits\n    suffices to account for\n    cannot be arbitrary in\n    is not subject to\n    does not readily tolerate\n    raises serious doubts about\n    is not quite equivalent to\n    does not affect the structure of\n    may remedy and, at the same time, eliminate\n    is not to be considered in determining\n    is to be regarded as\n    is unspecified with respect to\n    is, apparently, determined by\n    is necessary to impose an interpretation on\n    appears to correlate rather closely with\n    is rather different from";
declare const objects = " problems of phonemic and morphological analysis.\n    a corpus of utterance tokens upon which conformity has been defined by the paired utterance test.\n    the traditional practice of grammarians.\n    the levels of acceptability from fairly high (e.g. (99a)) to virtual gibberish (e.g. (98d)).\n    a stipulation to place the constructions into these various categories.\n    a descriptive fact.\n    a parasitic gap construction.\n    the extended c-command discussed in connection with (34).\n    the ultimate standard that determines the accuracy of any proposed grammar.\n    the system of base rules exclusive of the lexicon.\n    irrelevant intervening contexts in selectional rules.\n    nondistinctness in the sense of distinctive feature theory.\n    a general convention regarding the forms of the grammar.\n    an abstract underlying order.\n    an important distinction in language use.\n    the requirement that branching is not tolerated within the dominance scope of a complex symbol.\n    the strong generative capacity of the theory.";
declare function splitAndTrim(s: string): string[];
declare function parseList(s: string): string[];
declare function textwrapFill(text: string, width: number): string;
declare function generateChomsky(times?: number, lineLength?: number): string;
/** Alias matching Python name. */
declare const generate_chomsky: typeof generateChomsky;
declare const _internal: {
    splitAndTrim: typeof splitAndTrim;
    parseList: typeof parseList;
    textwrapFill: typeof textwrapFill;
};

/**
 * Port of nltk.misc.minimalset — MinimalSet for finding minimal pairs / contrastive contexts.
 */
declare class MinimalSet {
    private _targets;
    private _contexts;
    private _seen;
    private _displays;
    constructor(parameters?: Array<[string, string, string]>);
    private key;
    add(context: string, target: string, display: string): void;
    contexts(minimum?: number): string[];
    display(context: string, target: string, dflt?: string): string;
    displayAll(context: string): string[];
    /** Alias matching Python display_all */
    display_all(context: string): string[];
    targets(): Set<string>;
}

/**
 * Port of nltk.misc.sort — selection / bubble / merge / quick sort (instrumented, in-place).
 * Each function sorts the array in place and returns a comparison/operation count
 * matching the Python implementation's return value.
 */
declare function selection<T>(a: T[]): number;
declare function bubble<T>(a: T[]): number;
declare function merge<T>(a: T[]): number;
declare function quick<T>(a: T[]): number;

/**
 * Port of nltk.misc.wordfinder — word search grid generator.
 */
declare function revword(word: string): string;
/** nltk.misc.wordfinder.step — signature keeps the unused x,y params verbatim. */
declare function step(word: string, x: number, xf: (i: number) => number, y: number, yf: (i: number) => number, grid: string[][]): boolean;
/** nltk.misc.wordfinder.check — direction 1-4 placement test; returns undefined (not false) for unknown dirs like nltk returns None. */
declare function check(word: string, dir: number, x: number, y: number, grid: string[][], rows: number, cols: number): boolean | undefined;
interface WordFinderResult {
    grid: string[][];
    used: string[];
}
declare function wordfinder(words: string[], rows?: number, cols?: number, attempts?: number, alph?: string): WordFinderResult;
/** Corpus-dependent demo — throws helpful error (requires nltk.corpus.words). */
declare function word_finder(): never;

/**
 * Port of nltk.misc.babelfish — Babelfish online translation (service discontinued).
 * nltk's babelize_shell() only prints a notice; ported verbatim.
 */
declare function babelizeShell(): void;
/** Alias matching Python snake_case */
declare const babelize_shell: typeof babelizeShell;

/**
 * Shim for nltk.tgrep — TGrep2 search for NLTK trees (2437 LOC, pyparsing-based).
 *
 * Full TGrep requires pyparsing grammar + ParentedTree traversal. This shim
 * preserves the public API with typed signatures and throws a helpful error
 * pointing to the Python implementation. Tree-position helpers that are pure
 * (no pyparsing) are implemented so code that only needs positions can run.
 */
type TGrepPattern = string;
type TreePosition = number[];
type TGrepPredicate = (node: unknown, macroDict?: Record<string, unknown>, labelDict?: Record<string, unknown>) => boolean;
declare function tgrepTokenize(_tgrepString: string): string[];
declare function tgrepCompile(_tgrepString: string): TGrepPredicate;
declare function tgrep_tokenize(s: string): string[];
declare function tgrep_compile(s: string): TGrepPredicate;
declare function tgrepPositions(_pattern: string | TGrepPredicate, _trees: unknown[], _searchLeaves?: boolean): TreePosition[][];
declare function tgrepNodes(_pattern: string | TGrepPredicate, _trees: unknown[], _searchLeaves?: boolean): unknown[][];
declare const tgrep_positions: typeof tgrepPositions;
declare const tgrep_nodes: typeof tgrepNodes;
declare function treepositionsNoLeaves(tree: {
    treepositions(): TreePosition[];
}): TreePosition[];
declare const treepositions_no_leaves: typeof treepositionsNoLeaves;
declare function ancestors(_node: unknown): unknown[];
declare function uniqueAncestors(_node: unknown): unknown[];
declare const unique_ancestors: typeof uniqueAncestors;
declare function buildTgrepParser(_setParseActions?: boolean): never;
declare const _build_tgrep_parser: typeof buildTgrepParser;

/** Minimal xml.etree.ElementTree.Element substitute for toolbox trees. */
declare class ToolboxElement {
    tag: string;
    text: string | null;
    children: ToolboxElement[];
    constructor(tag: string, text?: string | null, children?: ToolboxElement[]);
    get length(): number;
    get(i: number): ToolboxElement | undefined;
    [Symbol.iterator](): Iterator<ToolboxElement>;
    find(path: string): ToolboxElement | null;
    findall(path: string): ToolboxElement[];
    append(child: ToolboxElement): void;
    getiterator(): ToolboxElement[];
    set childrenReplace(children: ToolboxElement[]);
}
/** nltk.toolbox.StandardFormat — sequential reader for SFM files/strings. */
declare class StandardFormat {
    protected _encoding: string | null;
    protected _file: Iterator<string> | null;
    line_num: number;
    constructor(filename?: string | PathPointer | null, encoding?: string | null);
    open(sfm_file: string | PathPointer): void;
    open_string(s: string): void;
    raw_fields(): Generator<[string | null, string]>;
    fields(options?: {
        strip?: boolean;
        unwrap?: boolean;
        encoding?: string | null;
        errors?: string;
        unicode_fields?: string[] | null;
    }): Generator<[string | null, string]>;
    close(): void;
}
/** nltk.toolbox.ToolboxData — records all markers at the same level. */
declare class ToolboxData extends StandardFormat {
    parse(options?: {
        grammar?: string | null;
        key?: string | null;
    } & Record<string, unknown>): ToolboxElement;
    private _record_parse;
    private _tree2etree;
    private _chunk_parse;
}
/** nltk.toolbox.to_sfm_string — tree → SFM text. */
declare function to_sfm_string(tree: ToolboxElement, options?: {
    encoding?: string | null;
    errors?: string;
    unicode_fields?: Set<string> | null;
}): string;
/** nltk.toolbox.ToolboxSettings — nested-block settings file. */
declare class ToolboxSettings extends StandardFormat {
    constructor();
    parse(kwargs?: Record<string, unknown>): ToolboxElement;
}
/** nltk.toolbox.to_settings_string — settings tree → text. */
declare function to_settings_string(tree: {
    getroot?: () => ToolboxElement;
} | ToolboxElement): string;
/** nltk.toolbox.remove_blanks — strip empty elements in place. */
declare function remove_blanks(elem: ToolboxElement): void;
/** nltk.toolbox.add_default_fields — add blank elements in place. */
declare function add_default_fields(elem: ToolboxElement, default_fields: Record<string, string[]>): void;
/** nltk.toolbox.sort_fields — sort children by field_orders in place. */
declare function sort_fields(elem: ToolboxElement, field_orders: Record<string, string[]>): void;
/** nltk.toolbox.add_blank_lines — append '\n' to last descendant of preceding element. */
declare function add_blank_lines(tree: ToolboxElement, blanks_before: Record<string, string[]>, blanks_between: Record<string, string[]>): void;
/** (marker, value) field tuple yielded by StandardFormat.fields(). */
type SFMField = [marker: string | null, value: string];
/** Parse a standard-format-marker string into a toolbox_data element tree. */
declare function parseSFMString(s: string, key?: string | null): ToolboxElement;
/** camelCase alias for to_sfm_string(). */
declare function toSFMString(tree: ToolboxElement, options?: {
    encoding?: string | null;
    errors?: string;
    unicode_fields?: Set<string> | null;
}): string;
/** camelCase alias for to_settings_string(). */
declare function toSettingsString(tree: ToolboxElement): string;
/** camelCase aliases for the tree helpers. */
declare const removeBlanks: typeof remove_blanks;
declare const addDefaultFields: typeof add_default_fields;
declare const sortFields: typeof sort_fields;
declare const addBlankLines: typeof add_blank_lines;

/**
 * CCG API — port of nltk/ccg/api.py
 * Interfaces for categories in combinatory grammars.
 */
type DirectionChar = "/" | "\\";
type Restriction = "." | "," | "_" | "";
declare abstract class AbstractCCGCategory {
    abstract isPrimitive(): boolean;
    abstract isFunction(): boolean;
    abstract isVar(): boolean;
    abstract substitute(subs: Array<[AbstractCCGCategory, AbstractCCGCategory]>): AbstractCCGCategory;
    /** null = cannot unify, [] = no subs needed */
    abstract canUnify(other: AbstractCCGCategory): Array<[AbstractCCGCategory, AbstractCCGCategory]> | null;
    abstract toString(): string;
    abstract equals(other: unknown): boolean;
    abstract comparisonKey(): unknown;
}
declare class CCGVar implements AbstractCCGCategory {
    private static _maxID;
    readonly id: number;
    private readonly _primOnly;
    constructor(primOnly?: boolean);
    static newId(): number;
    static resetId(): void;
    isPrimitive(): boolean;
    isFunction(): boolean;
    isVar(): boolean;
    substitute(subs: Array<[AbstractCCGCategory, AbstractCCGCategory]>): AbstractCCGCategory;
    canUnify(other: AbstractCCGCategory): Array<[AbstractCCGCategory, AbstractCCGCategory]> | null;
    comparisonKey(): number;
    equals(other: unknown): boolean;
    toString(): string;
}
declare class Direction {
    readonly dir: DirectionChar;
    readonly restrs: string;
    constructor(dir: DirectionChar, restrictions: string | string[]);
    isForward(): boolean;
    isBackward(): boolean;
    isVariable(): boolean;
    canUnify(other: Direction): Array<[string, string]> | null;
    substitute(subs: Array<[string, string]>): Direction;
    canCompose(): boolean;
    canCross(): boolean;
    neg(): Direction;
    equals(other: unknown): boolean;
    toString(): string;
}
declare class PrimitiveCategory implements AbstractCCGCategory {
    readonly categ: string;
    readonly restrs: string[];
    constructor(categ: string, restrictions?: string[]);
    isPrimitive(): boolean;
    isFunction(): boolean;
    isVar(): boolean;
    substitute(_subs: Array<[AbstractCCGCategory, AbstractCCGCategory]>): AbstractCCGCategory;
    canUnify(other: AbstractCCGCategory): Array<[AbstractCCGCategory, AbstractCCGCategory]> | null;
    comparisonKey(): unknown;
    equals(other: unknown): boolean;
    toString(): string;
}
declare class FunctionalCategory implements AbstractCCGCategory {
    readonly res: AbstractCCGCategory;
    readonly arg: AbstractCCGCategory;
    readonly dir: Direction;
    constructor(res: AbstractCCGCategory, arg: AbstractCCGCategory, dir: Direction);
    isPrimitive(): boolean;
    isFunction(): boolean;
    isVar(): boolean;
    substitute(subs: Array<[AbstractCCGCategory, AbstractCCGCategory]>): AbstractCCGCategory;
    canUnify(other: AbstractCCGCategory): Array<[AbstractCCGCategory, AbstractCCGCategory]> | null;
    comparisonKey(): unknown;
    equals(other: unknown): boolean;
    toString(): string;
}
type CCGCategory = PrimitiveCategory | FunctionalCategory | CCGVar;

/**
 * CCGCat — port of category parsing helpers (nltk/ccg/lexicon + api category parsing)
 * Provides slash-type helpers, feature parsing, and string→category parsing.
 */

declare function parseSubscripts(subscr: string | null | undefined): string[];
declare function parseApplication(app: string[]): Direction;
declare function matchBrackets(s: string): [string, string];
declare function nextCategory(s: string): [string, string];
declare function parsePrimitiveCategory(chunks: RegExpMatchArray | (string | null | undefined)[], primitives: Set<string>, families: Map<string, [AbstractCCGCategory, CCGVar | null]>, v: CCGVar | null): [AbstractCCGCategory, CCGVar | null];
declare function augParseCategory(line: string, primitives: Set<string>, families: Map<string, [AbstractCCGCategory, CCGVar | null]>, v?: CCGVar | null): [AbstractCCGCategory, CCGVar | null];
/** Parse a category string like "S\\NP/NP" given primitives/families. */
declare function parseCategory(catStr: string, primitives?: string[], families?: Map<string, [AbstractCCGCategory, CCGVar | null]>): AbstractCCGCategory;
declare class CCGCat {
    static parse(catStr: string, primitives?: string[]): AbstractCCGCategory;
    static isForward(dir: Direction): boolean;
    static isBackward(dir: Direction): boolean;
    static slashChar(dir: Direction): string;
}

/**
 * CCG Combinators — port of nltk/ccg/combinator.py
 * Forward/backward application, composition, type-raising, substitution.
 */

declare abstract class UndirectedBinaryCombinator {
    abstract canCombine(func: AbstractCCGCategory, arg: AbstractCCGCategory): boolean;
    abstract combine(func: AbstractCCGCategory, arg: AbstractCCGCategory): Iterable<AbstractCCGCategory>;
    abstract toString(): string;
}
declare abstract class DirectedBinaryCombinator {
    abstract canCombine(left: AbstractCCGCategory, right: AbstractCCGCategory): boolean;
    abstract combine(left: AbstractCCGCategory, right: AbstractCCGCategory): Iterable<AbstractCCGCategory>;
    abstract toString(): string;
}
declare class ForwardCombinator extends DirectedBinaryCombinator {
    readonly comb: UndirectedBinaryCombinator;
    private readonly pred;
    private readonly suffix;
    constructor(comb: UndirectedBinaryCombinator, pred: (l: AbstractCCGCategory, r: AbstractCCGCategory) => boolean, suffix?: string);
    canCombine(l: AbstractCCGCategory, r: AbstractCCGCategory): boolean;
    combine(l: AbstractCCGCategory, r: AbstractCCGCategory): Iterable<AbstractCCGCategory>;
    toString(): string;
}
declare class BackwardCombinator extends DirectedBinaryCombinator {
    readonly comb: UndirectedBinaryCombinator;
    private readonly pred;
    private readonly suffix;
    constructor(comb: UndirectedBinaryCombinator, pred: (l: AbstractCCGCategory, r: AbstractCCGCategory) => boolean, suffix?: string);
    canCombine(l: AbstractCCGCategory, r: AbstractCCGCategory): boolean;
    combine(l: AbstractCCGCategory, r: AbstractCCGCategory): Iterable<AbstractCCGCategory>;
    toString(): string;
}
declare class UndirectedFunctionApplication implements UndirectedBinaryCombinator {
    canCombine(func: AbstractCCGCategory, arg: AbstractCCGCategory): boolean;
    combine(func: AbstractCCGCategory, arg: AbstractCCGCategory): Iterable<AbstractCCGCategory>;
    toString(): string;
}
declare function forwardOnly(left: AbstractCCGCategory): boolean;
declare function backwardOnly(_left: AbstractCCGCategory, right: AbstractCCGCategory): boolean;
declare function bothForward(l: AbstractCCGCategory, r: AbstractCCGCategory): boolean;
declare function bothBackward(l: AbstractCCGCategory, r: AbstractCCGCategory): boolean;
declare function crossedDirs(l: AbstractCCGCategory, r: AbstractCCGCategory): boolean;
declare const ForwardApplication: ForwardCombinator;
declare const BackwardApplication: BackwardCombinator;
declare class UndirectedComposition implements UndirectedBinaryCombinator {
    canCombine(func: AbstractCCGCategory, arg: AbstractCCGCategory): boolean;
    combine(func: AbstractCCGCategory, arg: AbstractCCGCategory): Iterable<AbstractCCGCategory>;
    toString(): string;
}
declare function backwardBxConstraint(l: AbstractCCGCategory, r: AbstractCCGCategory): boolean;
declare const ForwardComposition: ForwardCombinator;
declare const BackwardComposition: BackwardCombinator;
declare const BackwardBx: BackwardCombinator;
declare class UndirectedSubstitution implements UndirectedBinaryCombinator {
    canCombine(func: AbstractCCGCategory, arg: AbstractCCGCategory): boolean;
    combine(func: AbstractCCGCategory, arg: AbstractCCGCategory): Iterable<AbstractCCGCategory>;
    toString(): string;
}
declare function forwardSConstraint(l: AbstractCCGCategory, r: AbstractCCGCategory): boolean;
declare function backwardSxConstraint(l: AbstractCCGCategory, r: AbstractCCGCategory): boolean;
declare const ForwardSubstitution: ForwardCombinator;
declare const BackwardSx: BackwardCombinator;
declare function innermostFunction(cat: AbstractCCGCategory): FunctionalCategory;
declare class UndirectedTypeRaise implements UndirectedBinaryCombinator {
    canCombine(func: AbstractCCGCategory, arg: AbstractCCGCategory): boolean;
    combine(func: AbstractCCGCategory, arg: AbstractCCGCategory): Iterable<AbstractCCGCategory>;
    toString(): string;
}
declare function forwardTConstraint(_l: AbstractCCGCategory, r: AbstractCCGCategory): boolean;
declare function backwardTConstraint(l: AbstractCCGCategory, _r: AbstractCCGCategory): boolean;
declare const ForwardT: ForwardCombinator;
declare const BackwardT: BackwardCombinator;

/**
 * CCG Lexicon — port of nltk/ccg/lexicon.py
 */

declare class Token {
    readonly token: string;
    readonly categ: AbstractCCGCategory;
    readonly semantics: Expression$1 | null;
    constructor(token: string, categ: AbstractCCGCategory, semantics?: Expression$1 | null);
    toString(): string;
}
declare class CCGLexicon {
    readonly start: AbstractCCGCategory;
    readonly primitives: string[];
    readonly families: Map<string, [AbstractCCGCategory, CCGVar | null]>;
    readonly entries: Map<string, Token[]>;
    constructor(start: string, primitives: string[], families: Map<string, [AbstractCCGCategory, CCGVar | null]>, entries: Map<string, Token[]>);
    categories(word: string): Token[];
    toString(): string;
}
declare function fromString(lexStr: string, includeSemantics?: boolean): CCGLexicon;
declare const fromstring: typeof fromString;
declare const parseLexicon: (...args: any[]) => any;
declare const openccgTinytiny: CCGLexicon;

/**
 * CCG Chart parser — port of nltk/ccg/chart.py
 */

declare class ParseTreeBudget {
    private remaining;
    constructor(limit: number);
    spend(): void;
}
declare class CCGEdge {
    readonly span: [number, number];
    readonly categ: AbstractCCGCategory;
    readonly rule: DirectedBinaryCombinator | string;
    constructor(span: [number, number], categ: AbstractCCGCategory, rule: DirectedBinaryCombinator | string);
    lhs(): AbstractCCGCategory;
    start(): number;
    end(): number;
    length(): number;
    rhs(): never[];
    dot(): number;
    is_complete(): boolean;
    isComplete(): boolean;
    is_incomplete(): boolean;
    isIncomplete(): boolean;
    nextsym(): null;
}
declare class CCGLeafEdge {
    readonly pos: number;
    readonly token: Token;
    readonly leaf: string;
    constructor(pos: number, token: Token, leaf: string);
    lhs(): AbstractCCGCategory;
    span(): [number, number];
    start(): number;
    end(): number;
    length(): number;
    rhs(): string;
    dot(): number;
    is_complete(): boolean;
    isComplete(): boolean;
    is_incomplete(): boolean;
    isIncomplete(): boolean;
    nextsym(): null;
    categ(): AbstractCCGCategory;
}
type AnyEdge = CCGEdge | CCGLeafEdge;
/**
 * Parse-tree node produced by CCGChart.parses. Mirrors the nltk.Tree structure
 * built by CCGChart._trees: internal labels are (Token, rule-string) tuples and
 * word labels are Token objects; leaves are word strings.
 */
declare class CCGTree {
    readonly label: [Token, string] | Token;
    readonly children: Array<CCGTree | string>;
    constructor(label: [Token, string] | Token, children: Array<CCGTree | string>);
    [Symbol.iterator](): IterableIterator<CCGTree | string>;
    get(index: number): CCGTree | string;
    pos(): Array<[string, [Token, string] | Token]>;
    leaves(): string[];
    toString(): string;
}
interface ChartRule {
    apply(chart: CCGChart, lexicon: CCGLexicon, left: AnyEdge, right: AnyEdge): Iterable<AnyEdge>;
    toString(): string;
}
declare class BinaryCombinatorRule implements ChartRule {
    private readonly combinator;
    static readonly NUMEDGES = 2;
    constructor(combinator: DirectedBinaryCombinator);
    apply(chart: CCGChart, _lex: CCGLexicon, left: AnyEdge, right: AnyEdge): Iterable<AnyEdge>;
    apply_everywhere(chart: CCGChart, lex: CCGLexicon): Iterable<AnyEdge>;
    applyEverywhere(chart: CCGChart, lex: CCGLexicon): Iterable<AnyEdge>;
    toString(): string;
}
declare class ForwardTypeRaiseRule implements ChartRule {
    static readonly NUMEDGES = 2;
    private readonly comb;
    apply(chart: CCGChart, _lex: CCGLexicon, left: AnyEdge, right: AnyEdge): Iterable<AnyEdge>;
    apply_everywhere(chart: CCGChart, lex: CCGLexicon): Iterable<AnyEdge>;
    applyEverywhere(chart: CCGChart, lex: CCGLexicon): Iterable<AnyEdge>;
    toString(): string;
}
declare class BackwardTypeRaiseRule implements ChartRule {
    static readonly NUMEDGES = 2;
    private readonly comb;
    apply(chart: CCGChart, _lex: CCGLexicon, left: AnyEdge, right: AnyEdge): Iterable<AnyEdge>;
    apply_everywhere(chart: CCGChart, lex: CCGLexicon): Iterable<AnyEdge>;
    applyEverywhere(chart: CCGChart, lex: CCGLexicon): Iterable<AnyEdge>;
    toString(): string;
}
declare const ApplicationRuleSet: ChartRule[];
declare const CompositionRuleSet: ChartRule[];
declare const SubstitutionRuleSet: ChartRule[];
declare const TypeRaiseRuleSet: ChartRule[];
declare const DefaultRuleSet: ChartRule[];
declare class CCGChart {
    readonly tokens: string[];
    private _edges;
    private cplMap;
    constructor(tokens: string[]);
    num_leaves(): number;
    numLeaves(): number;
    num_edges(): number;
    leaf(i: number): string;
    leaves(): string[];
    edges(): AnyEdge[];
    initialize(): void;
    iteredges(span?: [number, number]): Generator<AnyEdge>;
    private comparisonKey;
    insert(edge: AnyEdge, children: AnyEdge[]): boolean;
    insert_with_backpointer(edge: AnyEdge, _child: AnyEdge, backpointers: AnyEdge[]): boolean;
    select(span?: [number, number]): Generator<AnyEdge>;
    child_pointer_lists(edge: AnyEdge): AnyEdge[][];
    childPointerLists(edge: AnyEdge): AnyEdge[][];
    private _trees;
    trees(edge: AnyEdge, budget?: ParseTreeBudget): Generator<CCGTree>;
    parses(start: AbstractCCGCategory): Generator<CCGTree>;
}
declare class CCGChartParser {
    private readonly lexicon_;
    private readonly rules;
    private readonly trace;
    constructor(lexicon_: CCGLexicon, rules: ChartRule[], trace?: number);
    lexicon(): CCGLexicon;
    grammar(): never;
    parse(tokens: Iterable<string>): Generator<CCGTree>;
    parse_sents(sents: Iterable<Iterable<string>>): Generator<CCGTree[]>;
    parseSents(sents: Iterable<Iterable<string>>): Generator<CCGTree[]>;
    parse_all(tokens: Iterable<string>): CCGTree[];
    parseAll(tokens: Iterable<string>): CCGTree[];
    parse_one(tokens: Iterable<string>): CCGTree | null;
    parseOne(tokens: Iterable<string>): CCGTree | null;
}
declare function computeSemantics(children: CCGTree[], edge: CCGEdge): Expression$1 | null;
declare function printCCGDerivation(tree: CCGTree): void;
declare function printCCGTree(lwidth: number, tree: CCGTree | string): number;
declare const lex: CCGLexicon;
declare function demo$d(): void;

declare function barendregtNormalize(expr: Expression$1 | null, counters?: Map<string, number>): Expression$1 | null;
declare function computeFunctionSemantics(func: Expression$1 | null, arg: Expression$1 | null): Expression$1 | null;
declare function computeTypeRaisedSemantics(sem: Expression$1 | null): Expression$1 | null;
declare function computeCompositionSemantics(func: Expression$1 | null, arg: Expression$1 | null): Expression$1 | null;
declare function computeSubstitutionSemantics(func: Expression$1 | null, arg: Expression$1 | null): Expression$1 | null;

/**
 * Port of nltk.inference.api — Prover / ModelBuilder interfaces and command bases.
 */

declare abstract class Prover {
    prove(goal?: Expression$1 | null, assumptions?: Expression$1[] | null, verbose?: boolean): boolean;
    abstract _prove(goal: Expression$1 | null, assumptions: Expression$1[] | null, verbose?: boolean): [boolean, string | unknown];
}
declare abstract class ModelBuilder {
    buildModel(goal?: Expression$1 | null, assumptions?: Expression$1[] | null, verbose?: boolean): boolean;
    abstract _buildModel(goal: Expression$1 | null, assumptions: Expression$1[] | null, verbose?: boolean): [boolean, unknown];
}
declare abstract class TheoremToolCommand {
    abstract addAssumptions(newAssumptions: Expression$1[]): void;
    abstract retractAssumptions(retracted: Expression$1[], debug?: boolean): void;
    abstract assumptions(): Expression$1[];
    abstract goal(): Expression$1 | null;
    abstract printAssumptions(): void;
}
declare abstract class ProverCommand extends TheoremToolCommand {
    abstract prove(verbose?: boolean): boolean;
    abstract proof(simplify?: boolean): string;
    abstract getProver(): Prover;
}
declare abstract class ModelBuilderCommand extends TheoremToolCommand {
    abstract buildModel(verbose?: boolean): boolean;
    abstract model(format?: string | null): unknown;
    abstract getModelBuilder(): ModelBuilder;
}
declare class BaseTheoremToolCommand extends TheoremToolCommand {
    protected _goal: Expression$1 | null;
    protected _assumptions: Expression$1[];
    protected _result: boolean | null;
    constructor(goal?: Expression$1 | null, assumptions?: Expression$1[] | null);
    addAssumptions(newAssumptions: Expression$1[]): void;
    retractAssumptions(retracted: Expression$1[], debug?: boolean): void;
    assumptions(): Expression$1[];
    goal(): Expression$1 | null;
    printAssumptions(): void;
}
declare class BaseProverCommand extends BaseTheoremToolCommand implements ProverCommand {
    protected _prover: Prover;
    protected _proof: string | unknown;
    constructor(prover: Prover, goal?: Expression$1 | null, assumptions?: Expression$1[] | null);
    prove(verbose?: boolean): boolean;
    proof(_simplify?: boolean): string;
    decorateProof(proofString: string, _simplify?: boolean): string;
    getProver(): Prover;
}
declare class BaseModelBuilderCommand extends BaseTheoremToolCommand implements ModelBuilderCommand {
    protected _modelbuilder: ModelBuilder;
    protected _model: unknown;
    constructor(modelbuilder: ModelBuilder, goal?: Expression$1 | null, assumptions?: Expression$1[] | null);
    buildModel(verbose?: boolean): boolean;
    model(_format?: string | null): unknown;
    protected _decorateModel(valuationStr: string, _format?: string | null): unknown;
    getModelBuilder(): ModelBuilder;
}
declare class TheoremToolCommandDecorator extends TheoremToolCommand {
    protected _command: TheoremToolCommand;
    protected _result: boolean | null;
    constructor(command: TheoremToolCommand);
    assumptions(): Expression$1[];
    goal(): Expression$1 | null;
    addAssumptions(newAssumptions: Expression$1[]): void;
    retractAssumptions(retracted: Expression$1[], debug?: boolean): void;
    printAssumptions(): void;
}
declare class ProverCommandDecorator extends TheoremToolCommandDecorator implements ProverCommand {
    protected _proof: string | unknown;
    constructor(proverCommand: ProverCommand);
    prove(verbose?: boolean): boolean;
    proof(simplify?: boolean): string;
    decorateProof(proofString: string, simplify?: boolean): string;
    getProver(): Prover;
}
declare class ModelBuilderCommandDecorator extends TheoremToolCommandDecorator implements ModelBuilderCommand {
    protected _model: unknown;
    constructor(modelBuilderCommand: ModelBuilderCommand);
    buildModel(verbose?: boolean): boolean;
    model(format?: string | null): unknown;
    protected _decorateModel(valuationStr: string, format?: string | null): unknown;
    getModelBuilder(): ModelBuilder;
}
/** Port of nltk.inference.api.TheoremToolThread (threading.Thread subclass in
 * NLTK). JavaScript has no preemptive threads, so start() executes run()
 * synchronously; because theorem commands here are synchronous this preserves
 * NLTK's observable semantics: run() stores the command result or, on error,
 * prints the exception and leaves result null ("completed abnormally"). */
declare class TheoremToolThread {
    _command: () => boolean;
    _result: boolean | null;
    _verbose: boolean;
    _name: string | null;
    _alive: boolean;
    _daemon: boolean;
    constructor(command: () => boolean, verbose: boolean, name?: string | null);
    run(): void;
    start(): void;
    isAlive(): boolean;
    is_alive(): boolean;
    /** threading.Thread shims — no-ops/state in the synchronous JS port. */
    getName(): string | null;
    setName(name: string): void;
    isDaemon(): boolean;
    setDaemon(daemonic: boolean): void;
    join(_timeout?: number): void;
    get result(): boolean | null;
}
/** Port of nltk.inference.api.ParallelProverBuilder — runs prover and model
 * builder in parallel; whichever finishes first supplies the result. Here the
 * commands are synchronous so the prover thread always completes first; a
 * throwing prover yields result null and the model builder's (negated) result
 * is used, matching NLTK's thread-caught-exception path. */
declare class ParallelProverBuilder extends Prover {
    _prover: Prover;
    _modelbuilder: ModelBuilder;
    constructor(prover: Prover, modelbuilder: ModelBuilder);
    _prove(goal?: Expression$1 | null, assumptions?: Expression$1[] | null, verbose?: boolean): [boolean, string];
    _buildModel(goal?: Expression$1 | null, assumptions?: Expression$1[] | null, verbose?: boolean): [boolean, string];
    buildModel(goal?: Expression$1 | null, assumptions?: Expression$1[] | null, verbose?: boolean): boolean;
    _run(goal: Expression$1 | null, assumptions: Expression$1[] | null, verbose: boolean): boolean;
}
/** Port of nltk.inference.api.ParallelProverBuilderCommand — multiple
 * inheritance (BaseProverCommand, BaseModelBuilderCommand) flattened to a
 * BaseProverCommand subclass holding an extra _modelbuilder. */
declare class ParallelProverBuilderCommand extends BaseProverCommand {
    _modelbuilder: ModelBuilder;
    protected _model: unknown;
    constructor(prover: Prover, modelbuilder: ModelBuilder, goal?: Expression$1 | null, assumptions?: Expression$1[] | null);
    prove(verbose?: boolean): boolean;
    buildModel(verbose?: boolean): boolean;
    _run(verbose: boolean): boolean;
    getModelBuilder(): ModelBuilder;
    /** ``model()`` from NLTK's BaseModelBuilderCommand (PPBC multiply-inherits
     * it there; TS has single inheritance so the method is repeated). */
    model(format?: string | null): unknown;
    protected _decorateModel(valuationStr: string, _format?: string | null): unknown;
}

/**
 * Port of nltk.inference.resolution — first-order resolution theorem prover.
 * Faithful to nltk: clausify via skolemize, Clause unification, saturation.
 */

declare class ProverParseError$2 extends Error {
    constructor(msg?: string);
}
declare class BindingException extends Error {
    constructor(arg: unknown);
}
/** Port of nltk.inference.resolution.UnificationException (defined but never
 * raised in NLTK 3.10.3 — carried for parity). */
declare class UnificationException extends Error {
    constructor(a: Expression$1, b: Expression$1);
}
/** Port of nltk.inference.resolution.DebugObject — indented debug printer
 * supporting `debug + n` indent adjustment. */
declare class DebugObject {
    enabled: boolean;
    indent: number;
    constructor(enabled?: boolean, indent?: number);
    add(i: number): DebugObject;
    line(line: string): void;
}
declare class BindingDict {
    d: Map<string, Expression$1>;
    constructor(bindingList?: Array<[Variable, Expression$1]>);
    set(variable: Variable, binding: Expression$1): void;
    get(variable: Variable): Expression$1 | undefined;
    has(variable: Variable): boolean;
    add(other: BindingDict): BindingDict;
    get size(): number;
    toString(): string;
}
declare function mostGeneralUnification(a: Expression$1, b: Expression$1, bindings?: BindingDict): BindingDict;
declare class Clause extends Array<Expression$1> {
    _isTautology: boolean | null;
    _parents: [number, number] | null;
    constructor(data?: Expression$1[] | number);
    append(x: Expression$1): void;
    clear(): void;
    copy(): Expression$1[];
    count(x: Expression$1): number;
    extend(xs: Iterable<Expression$1>): void;
    index(x: Expression$1, start?: number, stop?: number): number;
    insert(i: number, x: Expression$1): void;
    remove(x: Expression$1): void;
    static from(data: Expression$1[]): Clause;
    unify(other: Clause, bindings?: BindingDict, used?: [Expression$1[], Expression$1[]], skipped?: [Expression$1[], Expression$1[]], debug?: boolean, deadline?: number | null): Clause[];
    isSubsetOf(other: Clause): boolean;
    subsumes(other: Clause): boolean;
    isTautology(): boolean;
    free(): Set<Variable>;
    replace(variable: Variable, expression: Expression$1): Clause;
    substituteBindings(bindings: BindingDict): Clause;
    minus(other: Clause): Clause;
    plus(other: Clause): Clause;
    toString(): string;
}
declare function clausify(expression: Expression$1): Clause[];
declare class ResolutionProver extends Prover {
    static ANSWER_KEY: string;
    TIMEOUT: number;
    _prove(goal: Expression$1 | null, assumptions: Expression$1[] | null, verbose?: boolean): [boolean, Clause[]];
    private attemptProof;
}
declare class ResolutionProverCommand extends BaseProverCommand {
    private _clauses;
    constructor(goal?: Expression$1 | null, assumptions?: Expression$1[] | null, prover?: ResolutionProver | null);
    prove(verbose?: boolean): boolean;
    findAnswers(_verbose?: boolean): Set<Expression$1>;
    static decorateClauses(clauses: Clause[]): string;
    decorateProof(proofString: string, _simplify?: boolean): string;
}
/** Port of nltk.inference.resolution.resolution_test. */
declare function resolution_test(e: string): void;
declare const resolutionTest: typeof resolution_test;
/** Port of nltk.inference.resolution.testResolutionProver. */
declare function testResolutionProver(): void;
/** Port of nltk.inference.resolution.test_clausify — prints clausify()
 * results for the pinned inputs (Python list reprs rendered with str()). */
declare function test_clausify(): void;
declare const testClausify: typeof test_clausify;
/** Port of nltk.inference.resolution.demo. */
declare function demo$c(): void;
declare const resolutionDemo: typeof demo$c;

/**
 * Port of nltk.inference.tableau — tableau-based FOL theorem prover.
 */

declare class ProverParseError$1 extends Error {
    constructor(msg?: string);
}
declare const Categories: {
    readonly ATOM: 0;
    readonly PROP: 1;
    readonly N_ATOM: 2;
    readonly N_PROP: 3;
    readonly APP: 4;
    readonly N_APP: 5;
    readonly N_EQ: 6;
    readonly D_NEG: 7;
    readonly N_ALL: 8;
    readonly N_EXISTS: 9;
    readonly AND: 10;
    readonly N_OR: 11;
    readonly N_IMP: 12;
    readonly OR: 13;
    readonly IMP: 14;
    readonly N_AND: 15;
    readonly IFF: 16;
    readonly N_IFF: 17;
    readonly EQ: 18;
    readonly EXISTS: 19;
    readonly ALL: 20;
};
declare class Debug {
    verbose: boolean;
    indent: number;
    lines: string[];
    constructor(verbose: boolean, indent?: number, lines?: string[] | null);
    add(n: number): Debug;
    line(data: unknown, indent?: number): void;
}
declare class Agenda {
    sets: Set<[Expression$1, Expression$1 | null]>[];
    constructor();
    clone(): Agenda;
    get(index: number): Set<[Expression$1, Expression$1 | null]>;
    put(expression: Expression$1, context?: Expression$1 | null): void;
    putAll(expressions: Expression$1[]): void;
    putAtoms(atoms: Set<[Expression$1, boolean]>): void;
    popFirst(): [[Expression$1 | null, Expression$1 | null], number | null];
    replaceAll(old: Expression$1, nw: Expression$1): void;
    markAllsFresh(): void;
    markNeqsFresh(): void;
    private categorize;
    private categorizeNeg;
}
declare class TableauProver extends Prover {
    TIMEOUT: number;
    MAX_TABLEAU_DEPTH: number;
    private _deadline;
    /** NLTK snake_case spelling of the static ``is_atom`` (see ``isAtom``). */
    static is_atom(e: Expression$1): boolean;
    _prove(goal: Expression$1 | null, assumptions: Expression$1[] | null, verbose?: boolean): [boolean, string];
    private attemptProof;
    private proofAtom;
    private proofNAtom;
    private proofProp;
    private proofNProp;
    private proofApp;
    private proofNApp;
    private proofNEq;
    private proofDNeg;
    private proofNAll;
    private proofNSome;
    private proofAnd;
    private proofNOr;
    private proofNImp;
    private proofOr;
    private proofImp;
    private proofNAnd;
    private proofIff;
    private proofNIff;
    private proofEq;
    private proofSome;
    private proofAll;
    static isAtom(e: Expression$1): boolean;
}
declare class TableauProverCommand extends BaseProverCommand {
    constructor(goal?: Expression$1 | null, assumptions?: Expression$1[] | null, prover?: TableauProver | null);
}
/** Port of nltk.inference.tableau.tableau_test. */
declare function tableau_test(c: string, ps?: string[] | null, verbose?: boolean): void;
declare const tableauTest: typeof tableau_test;
/** Port of nltk.inference.tableau.testTableauProver. */
declare function testTableauProver(): void;
/** Port of nltk.inference.tableau.testHigherOrderTableauProver. */
declare function testHigherOrderTableauProver(): void;
/** Port of nltk.inference.tableau.demo. */
declare function demo$b(): void;
declare const tableauDemo: typeof demo$b;

/**
 * Shim for nltk.inference.prover9 — requires external Prover9/prooftrans binaries.
 * Preserves full API; all proof attempts throw with a helpful message.
 */

declare const p9ReturnCodes: Record<number, string>;
declare class Prover9Exception extends Error {
    constructor(returncode: number, message?: string);
}
declare class Prover9FatalException extends Prover9Exception {
    constructor(rc: number, msg?: string);
}
declare class Prover9LimitExceededException extends Prover9Exception {
    constructor(rc: number, msg?: string);
}
declare class Prover9Parent {
    _binaryLocation: string | null;
    _prover9Bin: string | null;
    configProver9(_binaryLocation: string | null, _verbose?: boolean): void;
    prover9Input(_goal: Expression$1 | null, _assumptions: Expression$1[]): string;
    binaryLocations(): string[];
}
declare class Prover9CommandParent extends Prover9Parent {
    printAssumptions(_outputFormat?: string): void;
}
declare class Prover9 extends Prover9Parent implements Prover {
    _timeout: number;
    _prover9Bin: string | null;
    _prooftransBin: string | null;
    constructor(timeout?: number);
    prove(_goal?: Expression$1 | null, _assumptions?: Expression$1[] | null, _verbose?: boolean): boolean;
    _prove(_goal?: Expression$1 | null, _assumptions?: Expression$1[] | null, _verbose?: boolean): [boolean, string];
    prover9Input(_goal: Expression$1 | null, _assumptions: Expression$1[]): string;
}
declare class Prover9Command extends Prover9CommandParent {
    private _inner;
    constructor(goal?: Expression$1 | null, assumptions?: Expression$1[] | null, timeout?: number, prover?: Prover | null);
    addAssumptions(newAssumptions: Expression$1[]): void;
    retractAssumptions(retracted: Expression$1[], debug?: boolean): void;
    assumptions(): Expression$1[];
    goal(): Expression$1 | null;
    printAssumptions(outputFormat?: string): void;
    getProver(): Prover;
    prove(_verbose?: boolean): boolean;
    proof(_simplify?: boolean): string;
    decorateProof(_proofString: string, _simplify?: boolean): string;
}
/** Port of nltk.inference.prover9.convert_to_prover9 — pure string
 * transformation (no binary needed). Elements that fail conversion print the
 * diagnostic then re-raise, like NLTK. */
declare function convertToProver9(input: Expression$1 | Expression$1[]): string | string[];
/** Port of nltk.inference.prover9.spacer. */
declare function spacer$2(num?: number): void;
/** Port of nltk.inference.prover9.test_convert_to_prover9 (pure — no binary). */
declare function test_convert_to_prover9(expr: string[]): void;
declare const testConvertToProver9: typeof test_convert_to_prover9;
/** Port of nltk.inference.prover9.test_config — propagates the
 * external-binary error from prove() like NLTK without the binary. */
declare function test_config(): void;
declare const testConfig: typeof test_config;
/** Port of nltk.inference.prover9.test_prove — propagates the
 * external-binary error from prove() like NLTK without the binary. */
declare function test_prove(args: Array<[string, string[]]>): void;
declare const testProve: typeof test_prove;
/** Module-level demo argument lists (NLTK prover9.py module state).
 * NLTK names the second list ``arguments`` — a reserved word in JS modules,
 * so it is exported as ``arguments_``. */
declare const arguments_: Array<[string, string[]]>;
declare const expressions: string[];
/** Port of nltk.inference.prover9.demo — prints the section headers then hits
 * the external-binary wall in test_config, as NLTK does without prover9. */
declare function demo$a(): void;
declare const prover9Demo: typeof demo$a;

/**
 * Shim for nltk.inference.mace — requires external Mace4 / interpformat binaries.
 */

declare class MaceCommand extends BaseModelBuilderCommand {
    _interpformatBin: string | null;
    constructor(goal?: Expression$1 | null, assumptions?: Expression$1[] | null, maxModels?: number, modelBuilder?: ModelBuilder | null);
    get valuation(): unknown;
    /** Port of MaceCommand._make_relation_set — convert a Mace4-style relation
     * table into a set of tuples. */
    static _makeRelationSet(numEntities: number, values: number[]): Set<string[]>;
    static _make_relation_set(numEntities: number, values: number[]): Set<string[]>;
    static _makeRelationTuple(position: number, values: number[], numEntities: number): string[];
    static _makeModelVar(value: number): string;
    static _make_model_var(value: number): string;
    buildModel(_verbose?: boolean): boolean;
    model(_format?: string | null): unknown;
    printAssumptions(_outputFormat?: string): void;
}
declare class Mace extends ModelBuilder {
    _mace4Bin: string | null;
    _endSize: number;
    constructor(endSize?: number);
    _buildModel(_goal?: Expression$1 | null, _assumptions?: Expression$1[] | null, _verbose?: boolean): [boolean, string];
    configProver9(_binaryLocation: string | null, _verbose?: boolean): void;
    prover9Input(_goal: Expression$1 | null, _assumptions: Expression$1[]): string;
    binaryLocations(): string[];
}
/** Port of nltk.inference.mace.decode_result. */
declare function decode_result(found: boolean | null): string;
declare const decodeResult: typeof decode_result;
/** Port of nltk.inference.mace.spacer. */
declare function spacer$1(num?: number): void;
/** Port of nltk.inference.mace.test_make_relation_set (pure — no binary). */
declare function test_make_relation_set(): void;
declare const testMakeRelationSet: typeof test_make_relation_set;
/** Port of nltk.inference.mace.test_build_model — constructs a MaceCommand
 * and calls build_model(); without the Mace4 binary the build_model call
 * propagates the external-binary error, as NLTK does without the binary. */
declare function test_build_model(_arguments?: unknown): void;
declare const testBuildModel: typeof test_build_model;
/** Port of nltk.inference.mace.test_model_found — propagates the
 * external-binary error from build_model like NLTK does without Mace4. */
declare function test_model_found(args: Array<[string, string[]]>): void;
declare const testModelFound: typeof test_model_found;
/** Port of nltk.inference.mace.test_transform_output — propagates the
 * external-binary error from build_model/model like NLTK without Mace4. */
declare function test_transform_output(argumentPair: [string, string[]]): void;
declare const testTransformOutput: typeof test_transform_output;
/** NLTK demo driver — binary-bound end to end; kept as a real function that
 * propagates the external-binary error at its first model build. */
declare function demo$9(): void;

/**
 * Port of nltk.inference.discourse — discourse processing / consistency checking.
 * This module delegates to Mace/Prover9 for consistency/informativeness; since those
 * require external binaries, the reasoning methods are shimmed. The structural API
 * (ReadingCommand, CfgReadingCommand, DrtGlueReadingCommand, DiscourseTester) is preserved.
 */

declare abstract class ReadingCommand {
    abstract parseToReadings(sentence: string): Expression$1[];
    processThread(sentenceReadings: Expression$1[]): Expression$1[];
    abstract combineReadings(readings: Expression$1[]): Expression$1;
    abstract toFol(expression: Expression$1): Expression$1;
}
declare class CfgReadingCommand extends ReadingCommand {
    _gramfile: string;
    constructor(gramfile?: string);
    parseToReadings(_sentence: string): Expression$1[];
    combineReadings(readings: Expression$1[]): Expression$1;
    toFol(expression: Expression$1): Expression$1;
}
declare class DrtGlueReadingCommand extends ReadingCommand {
    _semtypeFile: string;
    constructor(semtypeFile?: string, _removeDuplicates?: boolean, _depparser?: unknown);
    parseToReadings(_sentence: string): Expression$1[];
    processThread(_sentenceReadings: Expression$1[]): Expression$1[];
    combineReadings(_readings: Expression$1[]): Expression$1;
    toFol(_expression: Expression$1): Expression$1;
}
interface DiscourseTesterOptions {
    readingCommand?: ReadingCommand;
    background?: Expression$1[];
}
declare class DiscourseTester {
    _input: string[];
    _sentences: Record<string, string>;
    _readings: Record<string, Record<string, Expression$1>>;
    _threads: Record<string, string[]>;
    _filteredThreads: Record<string, string[]>;
    _readingCommand: ReadingCommand;
    _background: Expression$1[];
    _models: unknown;
    constructor(input: string[], readingCommand?: ReadingCommand, background?: Expression$1[]);
    sentences(): void;
    addSentence(sentence: string, _informchk?: boolean, _consistchk?: boolean): void;
    retractSentence(sentence: string, verbose?: boolean): void;
    grammar(): void;
    readings(_sentence?: string, _threaded?: boolean, _verbose?: boolean, _filter?: boolean, _showThreadReadings?: boolean): void;
    expandThreads(threadId: string, threads?: Record<string, string[]>): Array<[string, Expression$1]>;
    models(_threadId?: string, _show?: boolean, _verbose?: boolean): void;
    addBackground(background: Expression$1[], _verbose?: boolean): void;
    background(): void;
    multiply(threadList: string[][], readings: string[]): string[][];
}
/** Port of nltk.inference.discourse.spacer. */
declare function spacer(num?: number): void;
/** Port of nltk.inference.discourse.load_fol (duplicated from nltk.sem.util):
 * convert a file of first-order formulas into a list of Expression objects.
 * Blank lines and '#'-prefixed comments are skipped; a bad line raises a
 * ValueError-shaped error naming the line number. */
declare function load_fol(s: string): Expression$1[];
declare const loadFol: typeof load_fol;
/** Grammar loading requires nltk.data.load + corpus resources — unsupported. */
declare function load_parser(_grammarUrl: string, _trace?: number, _parser?: unknown, _chartClass?: unknown, _beamSize?: number, _loadArgs?: unknown): never;
declare const loadParser: typeof load_parser;
/** Resource dumping requires nltk.data.load — unsupported. */
declare function show_cfg(_resourceUrl: string, _escape?: string): never;
declare const showCfg: typeof show_cfg;
declare class AnaphoraResolutionException extends Error {
    constructor(message: string);
}
/** Port of nltk.sem.drt.PossibleAntecedents — a list that is also a
 * DrtExpression/Expression so it can sit on either side of an equality. */
declare class PossibleAntecedents extends Array<Expression$1> {
    free(): Set<Variable>;
    replace(variable: Variable, expression: Expression$1, _replaceBound?: boolean, _alphaConvert?: boolean): PossibleAntecedents;
    toString(): string;
    str(): string;
}
declare const MAX_ANAPHORA_OPERATIONS = 1000000;
declare class AnaphoraBudget {
    remaining: number;
    limit: number;
    constructor(limit: number);
    spend(): void;
}
/** Port of nltk.sem.drt.resolve_anaphora (re-exported via
 * nltk.inference.discourse.resolve_anaphora). The class checks cover both the
 * FOL hierarchy and our flattened DRT hierarchy (Python multiple inheritance
 * collapses to separate Drt* classes here). */
declare function resolve_anaphora(expression: Expression$1, trail?: Expression$1[], budget?: AnaphoraBudget): Expression$1 | undefined;
declare const resolveAnaphora: typeof resolve_anaphora;
/** Port of nltk.inference.discourse.discourse_demo. */
declare function discourse_demo(readingCommand?: ReadingCommand): void;
declare const discourseDemo: typeof discourse_demo;
/** Port of nltk.inference.discourse.drt_discourse_demo. */
declare function drt_discourse_demo(readingCommand?: ReadingCommand): void;
declare const drtDiscourseDemo: typeof drt_discourse_demo;
/** Port of nltk.inference.discourse.demo. */
declare function demo$8(): void;

/** translate — package barrel (NLTK translate/__init__.py parity shim). Submodules hold the implementation. */
declare const TRANSLATE_PACKAGE = "translate";
declare const translate_package = "translate";

/** sem — package barrel (NLTK sem/__init__.py parity shim). Submodules hold the implementation. */
declare const SEM_PACKAGE = "sem";
declare const sem_package = "sem";

/** tag — package barrel (NLTK tag/__init__.py parity shim). Submodules hold the implementation. */
declare const TAG_PACKAGE = "tag";
declare const tag_package = "tag";

/** stem — package barrel (NLTK stem/__init__.py parity shim). Submodules hold the implementation. */
declare const STEM_PACKAGE = "stem";
declare const stem_package = "stem";

/** tbl — package barrel (NLTK tbl/__init__.py parity shim). Submodules hold the implementation. */
declare const TBL_PACKAGE = "tbl";
declare const tbl_package = "tbl";

declare const book = "demo corpus shim \u2014 requires NLTK book data (not available in JS)";

declare function invertDict<K extends string | number | symbol, V>(d: Record<K, V>): Record<string, K>;
declare function pairwise<T>(arr: T[]): [T, T][];

declare class FeatStruct extends Map<string, unknown> {
    constructor(init?: Record<string, unknown>);
    toString(): string;
}
declare function parseFeatStruct(s: string): FeatStruct;

declare function helpInfo(): string;

/** nltk.downloader.Package — index.xml package entry. */
declare class Package {
    id: string;
    name: string;
    subdir: string;
    url: string;
    size: number;
    unzipped_size: number;
    checksum: string | null;
    svn_revision: string | number | null;
    copyright: string;
    contact: string;
    license: string;
    author: string;
    unzip: boolean;
    filename: string;
    [key: string]: unknown;
    constructor(kw: Record<string, unknown> & {
        id: string;
        url: string;
        children?: unknown;
    });
    static fromxml(xml: string | {
        attrib: Record<string, string>;
    }): Package;
    toString(): string;
}
/** nltk.downloader.Collection — index.xml collection entry. */
declare class Collection {
    id: string;
    name: string;
    children: string[];
    packages: Package[] | null;
    [key: string]: unknown;
    constructor(kw: Record<string, unknown> & {
        id: string;
        children: string[];
    });
    static fromxml(xml: string | {
        attrib: Record<string, string>;
        itemRefs: string[];
    }): Collection;
    toString(): string;
}
/** nltk.downloader message-passing objects. */
declare class DownloaderMessage {
}
declare class StartCollectionMessage extends DownloaderMessage {
    collection: Collection;
    constructor(collection: Collection);
}
declare class FinishCollectionMessage extends DownloaderMessage {
    collection: Collection;
    constructor(collection: Collection);
}
declare abstract class PackageMessage extends DownloaderMessage {
    package: Package;
    constructor(pkg: Package);
}
declare class StartPackageMessage extends PackageMessage {
}
declare class FinishPackageMessage extends PackageMessage {
}
declare class StartDownloadMessage extends PackageMessage {
}
declare class FinishDownloadMessage extends PackageMessage {
}
declare class StartUnzipMessage extends PackageMessage {
}
declare class FinishUnzipMessage extends PackageMessage {
}
declare class UpToDateMessage extends PackageMessage {
}
declare class StaleMessage extends PackageMessage {
}
declare class ErrorMessage extends DownloaderMessage {
    package: Package;
    message: string;
    constructor(pkg: Package, message: unknown);
}
declare class ProgressMessage extends DownloaderMessage {
    progress: number;
    constructor(progress: number);
}
declare class SelectDownloadDirMessage extends DownloaderMessage {
    download_dir: string;
    constructor(download_dir: string);
}
/** nltk.downloader.md5_hexdigest / sha256_hexdigest. */
declare function md5_hexdigest(file: string | {
    path: string;
} | Uint8Array): string;
declare function sha256_hexdigest(file: string | {
    path: string;
} | Uint8Array): string;
/** nltk.downloader.unzip — extract a package zip into a directory. */
declare function unzip(filename: string, root: string, verbose?: boolean): void;
/** nltk.downloader.Downloader — network data-server client (unsupported). */
declare class Downloader {
    constructor(_server_index_url?: string | null, _download_dir?: string | null);
}
declare class DownloaderGUI {
    constructor();
}
declare class DownloaderShell {
    constructor();
}
declare function download(..._a: unknown[]): never;
declare function download_gui(..._a: unknown[]): never;
declare function download_shell(..._a: unknown[]): never;
declare function update(..._a: unknown[]): never;
declare function build_index(..._a: unknown[]): never;

/**
 * Port of nltk.inference.nonmonotonic — nonmonotonic reasoning decorators
 * (closed domain, closed world, unique names).
 *
 * The assumption/goal transformations are pure FOL and fully ported. The
 * final prove() call still delegates to the decorated ProverCommand (and
 * UniqueNamesProver.assumptions() itself calls Prover9), so binary-bound
 * paths propagate the external-binary error as NLTK does without the binary.
 */

/** Port of nltk.inference.nonmonotonic.ProverParseError — a third ProverParseError
 * class distinct from the ones in resolution.py and tableau.py (NLTK defines a
 * separate class in each module). */
declare class ProverParseError extends Error {
    constructor(message?: string);
}
/** Port of nltk.inference.nonmonotonic.get_domain. */
declare function get_domain(goal: Expression$1 | null, assumptions: Expression$1[]): Set<Variable>;
declare const getDomain: typeof get_domain;
/** Port of nltk.inference.nonmonotonic.ClosedDomainProver — adds domain
 * closure assumptions before proving. */
declare class ClosedDomainProver extends ProverCommandDecorator {
    assumptions(): Expression$1[];
    goal(): Expression$1 | null;
    /**
     * Apply the closed domain assumption to the expression
     *
     * - Domain = union([e.free()|e.constants() for e in all_expressions])
     * - translate "exists x.P" to "(z=d1 | z=d2 | ... ) & P.replace(x,z)" OR
     *             "P.replace(x, d1) | P.replace(x, d2) | ..."
     * - translate "all x.P" to "P.replace(x, d1) & P.replace(x, d2) & ..."
     */
    replace_quants(ex: Expression$1, domain: Set<Variable>): Expression$1;
    replaceQuants(ex: Expression$1, domain: Set<Variable>): Expression$1;
}
/** Port of nltk.inference.nonmonotonic.UniqueNamesProver — adds unique names
 * assumptions before proving. The inner Prover9 prove() call propagates the
 * external-binary error when the domain has 2+ elements, as NLTK does
 * without the binary. */
declare class UniqueNamesProver extends ProverCommandDecorator {
    /**
     * - Domain = union([e.free()|e.constants() for e in all_expressions])
     * - if "d1 = d2" cannot be proven from the premises, then add "d1 != d2"
     */
    assumptions(): Expression$1[];
}
/** Port of nltk.inference.nonmonotonic.SetHolder — a list of sets of
 * Variables where getitem returns the set containing the item, creating it
 * if absent. Python's ``holder[item]`` becomes ``holder.get(item)`` here. */
declare class SetHolder extends Array<Set<Variable>> {
    get(item: Variable): Set<Variable>;
    append(x: Set<Variable>): void;
    clear(): void;
    copy(): Set<Variable>[];
    count(x: Set<Variable>): number;
    extend(xs: Iterable<Set<Variable>>): void;
    index(x: Set<Variable>, start?: number, stop?: number): number;
    insert(i: number, x: Set<Variable>): void;
    remove(x: Set<Variable>): void;
}
/** Port of nltk.inference.nonmonotonic.PredHolder — dictionary payload for
 * ClosedWorldProver predicate completion. */
declare class PredHolder {
    signatures: Expression$1[][];
    properties: Array<[Variable[], Expression$1]>;
    signature_len: number | null;
    constructor();
    append_sig(newSig: Expression$1[]): void;
    appendSig(newSig: Expression$1[]): void;
    append_prop(newProp: [Variable[], Expression$1]): void;
    appendProp(newProp: [Variable[], Expression$1]): void;
    validate_sig_len(newSig: readonly unknown[]): void;
    validateSigLen(newSig: readonly unknown[]): void;
    toString(): string;
}
/** Port of nltk.inference.nonmonotonic.ClosedWorldProver — completes
 * predicates before proving (predicate completion). */
declare class ClosedWorldProver extends ProverCommandDecorator {
    assumptions(): Expression$1[];
    _make_unique_signature(predHolder: PredHolder): Variable[];
    _makeUniqueSignature(predHolder: PredHolder): Variable[];
    _make_antecedent(predicate: AbstractVariableExpression, signature: Variable[]): Expression$1;
    _makeAntecedent(predicate: AbstractVariableExpression, signature: Variable[]): Expression$1;
    _make_predicate_dict(assumptions: Expression$1[]): Map<AbstractVariableExpression, PredHolder>;
    _makePredicateDict(assumptions: Expression$1[]): Map<AbstractVariableExpression, PredHolder>;
    private _mapPredicates;
}
/** Port of nltk.inference.nonmonotonic.print_proof — runs Prover9 and the
 * combined UniqueNames+ClosedWorld prover; propagates the external-binary
 * error as NLTK does without the binary. */
declare function print_proof(goal: string, premises: Expression$1[]): void;
declare const printProof: typeof print_proof;
/** Port of nltk.inference.nonmonotonic.closed_domain_demo. */
declare function closed_domain_demo(): void;
declare const closedDomainDemo: typeof closed_domain_demo;
/** Port of nltk.inference.nonmonotonic.unique_names_demo. */
declare function unique_names_demo(): void;
declare const uniqueNamesDemo: typeof unique_names_demo;
/** Port of nltk.inference.nonmonotonic.closed_world_demo. */
declare function closed_world_demo(): void;
declare const closedWorldDemo: typeof closed_world_demo;
/** Port of nltk.inference.nonmonotonic.combination_prover_demo. */
declare function combination_prover_demo(): void;
declare const combinationProverDemo: typeof combination_prover_demo;
/** Port of nltk.inference.nonmonotonic.default_reasoning_demo. */
declare function default_reasoning_demo(): void;
declare const defaultReasoningDemo: typeof default_reasoning_demo;
/** Port of nltk.inference.nonmonotonic.demo. */
declare function demo$7(): void;
declare const nonmonotonicDemo: typeof demo$7;

declare function chartparser(..._args: unknown[]): never;
declare function chunkparser(..._args: unknown[]): never;
declare function collocations(..._args: unknown[]): never;
declare function concordance(..._args: unknown[]): never;
declare function nemo(..._args: unknown[]): never;
declare function rdparser(..._args: unknown[]): never;
declare function srparser(..._args: unknown[]): never;
declare function wordnet(..._args: unknown[]): never;
declare function wordfreq(..._args: unknown[]): never;

declare const app_d_chartparser: typeof chartparser;
declare const app_d_chunkparser: typeof chunkparser;
declare const app_d_collocations: typeof collocations;
declare const app_d_concordance: typeof concordance;
declare const app_d_nemo: typeof nemo;
declare const app_d_rdparser: typeof rdparser;
declare const app_d_srparser: typeof srparser;
declare const app_d_wordfreq: typeof wordfreq;
declare const app_d_wordnet: typeof wordnet;
declare namespace app_d {
  export {
    app_d_chartparser as chartparser,
    app_d_chunkparser as chunkparser,
    app_d_collocations as collocations,
    app_d_concordance as concordance,
    app_d_nemo as nemo,
    app_d_rdparser as rdparser,
    app_d_srparser as srparser,
    app_d_wordfreq as wordfreq,
    app_d_wordnet as wordnet,
  };
}

declare class EdgeList {
    constructor(..._a: unknown[]);
}
declare class ChartMatrixView {
    constructor(..._a: unknown[]);
}
declare class ChartResultsView {
    constructor(..._a: unknown[]);
}
declare class ChartComparer {
    constructor(..._a: unknown[]);
}
declare class ChartView {
    constructor(..._a: unknown[]);
}
declare class EdgeRule {
    constructor(..._a: unknown[]);
}
declare class TopDownPredictEdgeRule {
    constructor(..._a: unknown[]);
}
declare class BottomUpEdgeRule {
    constructor(..._a: unknown[]);
}
declare class BottomUpLeftCornerEdgeRule {
    constructor(..._a: unknown[]);
}
declare class FundamentalEdgeRule {
    constructor(..._a: unknown[]);
}
declare class ChartParserApp {
    constructor(..._a: unknown[]);
}
declare function app$8(..._a: unknown[]): never;

type app_chartparser_app_d_BottomUpEdgeRule = BottomUpEdgeRule;
declare const app_chartparser_app_d_BottomUpEdgeRule: typeof BottomUpEdgeRule;
type app_chartparser_app_d_BottomUpLeftCornerEdgeRule = BottomUpLeftCornerEdgeRule;
declare const app_chartparser_app_d_BottomUpLeftCornerEdgeRule: typeof BottomUpLeftCornerEdgeRule;
type app_chartparser_app_d_ChartComparer = ChartComparer;
declare const app_chartparser_app_d_ChartComparer: typeof ChartComparer;
type app_chartparser_app_d_ChartMatrixView = ChartMatrixView;
declare const app_chartparser_app_d_ChartMatrixView: typeof ChartMatrixView;
type app_chartparser_app_d_ChartParserApp = ChartParserApp;
declare const app_chartparser_app_d_ChartParserApp: typeof ChartParserApp;
type app_chartparser_app_d_ChartResultsView = ChartResultsView;
declare const app_chartparser_app_d_ChartResultsView: typeof ChartResultsView;
type app_chartparser_app_d_ChartView = ChartView;
declare const app_chartparser_app_d_ChartView: typeof ChartView;
type app_chartparser_app_d_EdgeList = EdgeList;
declare const app_chartparser_app_d_EdgeList: typeof EdgeList;
type app_chartparser_app_d_EdgeRule = EdgeRule;
declare const app_chartparser_app_d_EdgeRule: typeof EdgeRule;
type app_chartparser_app_d_FundamentalEdgeRule = FundamentalEdgeRule;
declare const app_chartparser_app_d_FundamentalEdgeRule: typeof FundamentalEdgeRule;
type app_chartparser_app_d_TopDownPredictEdgeRule = TopDownPredictEdgeRule;
declare const app_chartparser_app_d_TopDownPredictEdgeRule: typeof TopDownPredictEdgeRule;
declare namespace app_chartparser_app_d {
  export {
    app_chartparser_app_d_BottomUpEdgeRule as BottomUpEdgeRule,
    app_chartparser_app_d_BottomUpLeftCornerEdgeRule as BottomUpLeftCornerEdgeRule,
    app_chartparser_app_d_ChartComparer as ChartComparer,
    app_chartparser_app_d_ChartMatrixView as ChartMatrixView,
    app_chartparser_app_d_ChartParserApp as ChartParserApp,
    app_chartparser_app_d_ChartResultsView as ChartResultsView,
    app_chartparser_app_d_ChartView as ChartView,
    app_chartparser_app_d_EdgeList as EdgeList,
    app_chartparser_app_d_EdgeRule as EdgeRule,
    app_chartparser_app_d_FundamentalEdgeRule as FundamentalEdgeRule,
    app_chartparser_app_d_TopDownPredictEdgeRule as TopDownPredictEdgeRule,
    app$8 as app,
  };
}

declare class RegexpChunkApp {
    constructor(..._a: unknown[]);
}
declare function app$7(..._a: unknown[]): never;

type app_chunkparser_app_d_RegexpChunkApp = RegexpChunkApp;
declare const app_chunkparser_app_d_RegexpChunkApp: typeof RegexpChunkApp;
declare namespace app_chunkparser_app_d {
  export {
    app_chunkparser_app_d_RegexpChunkApp as RegexpChunkApp,
    app$7 as app,
  };
}

declare class CollocationsView {
    constructor(..._a: unknown[]);
}
declare class CollocationsModel {
    constructor(..._a: unknown[]);
}
declare function app$6(..._a: unknown[]): never;

type app_collocations_app_d_CollocationsModel = CollocationsModel;
declare const app_collocations_app_d_CollocationsModel: typeof CollocationsModel;
type app_collocations_app_d_CollocationsView = CollocationsView;
declare const app_collocations_app_d_CollocationsView: typeof CollocationsView;
declare namespace app_collocations_app_d {
  export {
    app_collocations_app_d_CollocationsModel as CollocationsModel,
    app_collocations_app_d_CollocationsView as CollocationsView,
    app$6 as app,
  };
}

declare class ConcordanceSearchView {
    constructor(..._a: unknown[]);
}
declare class ConcordanceSearchModel {
    constructor(..._a: unknown[]);
}
declare function app$5(..._a: unknown[]): never;

type app_concordance_app_d_ConcordanceSearchModel = ConcordanceSearchModel;
declare const app_concordance_app_d_ConcordanceSearchModel: typeof ConcordanceSearchModel;
type app_concordance_app_d_ConcordanceSearchView = ConcordanceSearchView;
declare const app_concordance_app_d_ConcordanceSearchView: typeof ConcordanceSearchView;
declare namespace app_concordance_app_d {
  export {
    app_concordance_app_d_ConcordanceSearchModel as ConcordanceSearchModel,
    app_concordance_app_d_ConcordanceSearchView as ConcordanceSearchView,
    app$5 as app,
  };
}

declare class Zone {
    constructor(..._a: unknown[]);
}
declare class FindZone {
    constructor(..._a: unknown[]);
}
declare class ReplaceZone {
    constructor(..._a: unknown[]);
}
declare function launchRefresh(..._a: unknown[]): never;
declare function app$4(..._a: unknown[]): never;

type app_nemo_app_d_FindZone = FindZone;
declare const app_nemo_app_d_FindZone: typeof FindZone;
type app_nemo_app_d_ReplaceZone = ReplaceZone;
declare const app_nemo_app_d_ReplaceZone: typeof ReplaceZone;
type app_nemo_app_d_Zone = Zone;
declare const app_nemo_app_d_Zone: typeof Zone;
declare const app_nemo_app_d_launchRefresh: typeof launchRefresh;
declare namespace app_nemo_app_d {
  export {
    app_nemo_app_d_FindZone as FindZone,
    app_nemo_app_d_ReplaceZone as ReplaceZone,
    app_nemo_app_d_Zone as Zone,
    app$4 as app,
    app_nemo_app_d_launchRefresh as launchRefresh,
  };
}

declare class RecursiveDescentApp {
    constructor(..._a: unknown[]);
}
declare function app$3(..._a: unknown[]): never;

type app_rdparser_app_d_RecursiveDescentApp = RecursiveDescentApp;
declare const app_rdparser_app_d_RecursiveDescentApp: typeof RecursiveDescentApp;
declare namespace app_rdparser_app_d {
  export {
    app_rdparser_app_d_RecursiveDescentApp as RecursiveDescentApp,
    app$3 as app,
  };
}

declare class ShiftReduceApp {
    constructor(..._a: unknown[]);
}
declare function app$2(..._a: unknown[]): never;

type app_srparser_app_d_ShiftReduceApp = ShiftReduceApp;
declare const app_srparser_app_d_ShiftReduceApp: typeof ShiftReduceApp;
declare namespace app_srparser_app_d {
  export {
    app_srparser_app_d_ShiftReduceApp as ShiftReduceApp,
    app$2 as app,
  };
}

declare function plot_word_freq_dist(..._a: unknown[]): never;
declare function app$1(..._a: unknown[]): never;

declare const app_wordfreq_app_d_plot_word_freq_dist: typeof plot_word_freq_dist;
declare namespace app_wordfreq_app_d {
  export {
    app$1 as app,
    app_wordfreq_app_d_plot_word_freq_dist as plot_word_freq_dist,
  };
}

declare class MyServerHandler {
    constructor(..._a: unknown[]);
}
declare function wnb(..._a: unknown[]): never;
declare function startBrowser(..._a: unknown[]): never;
declare function app(..._a: unknown[]): never;
declare function get_unique_counter_from_url(..._a: unknown[]): never;

type app_wordnet_app_d_MyServerHandler = MyServerHandler;
declare const app_wordnet_app_d_MyServerHandler: typeof MyServerHandler;
declare const app_wordnet_app_d_app: typeof app;
declare const app_wordnet_app_d_get_unique_counter_from_url: typeof get_unique_counter_from_url;
declare const app_wordnet_app_d_startBrowser: typeof startBrowser;
declare const app_wordnet_app_d_wnb: typeof wnb;
declare namespace app_wordnet_app_d {
  export {
    app_wordnet_app_d_MyServerHandler as MyServerHandler,
    app_wordnet_app_d_app as app,
    app_wordnet_app_d_get_unique_counter_from_url as get_unique_counter_from_url,
    app_wordnet_app_d_startBrowser as startBrowser,
    app_wordnet_app_d_wnb as wnb,
  };
}

type ChatPairs = [pattern: string, responses: string[]][];
type ChatReflections = Record<string, string>;
/** nltk.chat.util.reflections — first/second-person substitutions. */
declare const reflections$2: ChatReflections;
/** nltk.chat.eliza pair table. */
declare const eliza_pairs: ChatPairs;
/** nltk.chat.iesha pair table. */
declare const iesha_pairs: ChatPairs;
/** nltk.chat.rude pair table. */
declare const rude_pairs: ChatPairs;
/** nltk.chat.suntsu pair table. */
declare const suntsu_pairs: ChatPairs;
/** nltk.chat.zen pair table. */
declare const zen_pairs: ChatPairs;
/** nltk.chat.util.Chat — pattern-match chatbot. */
declare class Chat$1 {
    private _pairs;
    private _reflections;
    private _regex;
    private _rng;
    constructor(pairs: ChatPairs | Iterable<readonly [string, readonly string[]]>, refl?: ChatReflections, rng?: () => number);
    private _substitute;
    private _wildcards;
    /** Chat.respond — first matching pattern, random response, %N wildcard
     * substitution through reflections. */
    respond(str: string): string | undefined;
    /** Chat.converse — interactive loop. `input` supplies successive user lines;
     * return undefined/null to signal EOF (Python EOFError prints the quit word). */
    converse(quit?: string, input?: () => string | null | undefined, output?: (s: string) => void): void;
}
/** nltk.chat.eliza.eliza_chat — banner + converse; input injectable (adapted). */
declare function eliza_chat$1(input?: () => string | null | undefined, output?: (s: string) => void): void;
/** nltk.chat.iesha.iesha_chat */
declare function iesha_chat$1(input?: () => string | null | undefined, output?: (s: string) => void): void;
/** nltk.chat.rude.rude_chat */
declare function rude_chat$1(input?: () => string | null | undefined, output?: (s: string) => void): void;
/** nltk.chat.suntsu.suntsu_chat */
declare function suntsu_chat$1(input?: () => string | null | undefined, output?: (s: string) => void): void;
/** nltk.chat.zen.zen_chat */
declare function zen_chat$1(input?: () => string | null | undefined, output?: (s: string) => void): void;

type chat_d_ChatPairs = ChatPairs;
type chat_d_ChatReflections = ChatReflections;
declare const chat_d_eliza_pairs: typeof eliza_pairs;
declare const chat_d_iesha_pairs: typeof iesha_pairs;
declare const chat_d_rude_pairs: typeof rude_pairs;
declare const chat_d_suntsu_pairs: typeof suntsu_pairs;
declare const chat_d_zen_pairs: typeof zen_pairs;
declare namespace chat_d {
  export { Chat$1 as Chat, eliza_chat$1 as eliza_chat, chat_d_eliza_pairs as eliza_pairs, iesha_chat$1 as iesha_chat, chat_d_iesha_pairs as iesha_pairs, reflections$2 as reflections, rude_chat$1 as rude_chat, chat_d_rude_pairs as rude_pairs, suntsu_chat$1 as suntsu_chat, chat_d_suntsu_pairs as suntsu_pairs, zen_chat$1 as zen_chat, chat_d_zen_pairs as zen_pairs };
  export type { chat_d_ChatPairs as ChatPairs, chat_d_ChatReflections as ChatReflections };
}

/** NLTK chat.util — lightweight Chat shim (full logic requires NLTK corpora patterns). */
declare const reflections$1: Record<string, string>;
declare class Chat {
    private pairs;
    private reflections;
    constructor(pairs: unknown, reflections?: Record<string, string>);
    respond(_input: string): never;
    converse(..._a: unknown[]): never;
}

type chat_util_d_Chat = Chat;
declare const chat_util_d_Chat: typeof Chat;
declare namespace chat_util_d {
  export {
    chat_util_d_Chat as Chat,
    reflections$1 as reflections,
  };
}

/** NLTK chat.eliza — Eliza chatbot (interactive demo). */

declare const pairs$4: ReadonlyArray<readonly [string, ReadonlyArray<string>]>;
declare const eliza_chatbot: Chat;
declare function eliza_chat(..._a: unknown[]): never;
declare function demo$6(..._a: unknown[]): never;

declare const chat_eliza_d_eliza_chat: typeof eliza_chat;
declare const chat_eliza_d_eliza_chatbot: typeof eliza_chatbot;
declare namespace chat_eliza_d {
  export {
    demo$6 as demo,
    chat_eliza_d_eliza_chat as eliza_chat,
    chat_eliza_d_eliza_chatbot as eliza_chatbot,
    pairs$4 as pairs,
    reflections$1 as reflections,
  };
}

/** NLTK chat.iesha — Teen chatbot (interactive demo). */

declare const reflections: Record<string, string>;
declare const pairs$3: ReadonlyArray<readonly [string, ReadonlyArray<string>]>;
declare const iesha_chatbot: Chat;
declare function iesha_chat(..._a: unknown[]): never;
declare function demo$5(..._a: unknown[]): never;

declare const chat_iesha_d_iesha_chat: typeof iesha_chat;
declare const chat_iesha_d_iesha_chatbot: typeof iesha_chatbot;
declare const chat_iesha_d_reflections: typeof reflections;
declare namespace chat_iesha_d {
  export {
    demo$5 as demo,
    chat_iesha_d_iesha_chat as iesha_chat,
    chat_iesha_d_iesha_chatbot as iesha_chatbot,
    pairs$3 as pairs,
    chat_iesha_d_reflections as reflections,
  };
}

/** NLTK chat.rude — Rude chatbot (interactive demo). */

declare const pairs$2: ReadonlyArray<readonly [string, ReadonlyArray<string>]>;
declare const rude_chatbot: Chat;
declare function rude_chat(..._a: unknown[]): never;
declare function demo$4(..._a: unknown[]): never;

declare const chat_rude_d_rude_chat: typeof rude_chat;
declare const chat_rude_d_rude_chatbot: typeof rude_chatbot;
declare namespace chat_rude_d {
  export {
    demo$4 as demo,
    pairs$2 as pairs,
    reflections$1 as reflections,
    chat_rude_d_rude_chat as rude_chat,
    chat_rude_d_rude_chatbot as rude_chatbot,
  };
}

/** NLTK chat.suntsu — Sun Tsu chatbot (interactive demo). */

declare const pairs$1: ReadonlyArray<readonly [string, ReadonlyArray<string>]>;
declare const suntsu_chatbot: Chat;
declare function suntsu_chat(..._a: unknown[]): never;
declare function demo$3(..._a: unknown[]): never;

declare const chat_suntsu_d_suntsu_chat: typeof suntsu_chat;
declare const chat_suntsu_d_suntsu_chatbot: typeof suntsu_chatbot;
declare namespace chat_suntsu_d {
  export {
    demo$3 as demo,
    pairs$1 as pairs,
    reflections$1 as reflections,
    chat_suntsu_d_suntsu_chat as suntsu_chat,
    chat_suntsu_d_suntsu_chatbot as suntsu_chatbot,
  };
}

/** NLTK chat.zen — Zen chatbot (interactive demo). */

declare const responses: ReadonlyArray<readonly [string, ReadonlyArray<string>]>;
declare const pairs: readonly (readonly [string, readonly string[]])[];
declare const zen_chatbot: Chat;
declare function zen_chat(..._a: unknown[]): never;
declare function demo$2(..._a: unknown[]): never;

declare const chat_zen_d_pairs: typeof pairs;
declare const chat_zen_d_responses: typeof responses;
declare const chat_zen_d_zen_chat: typeof zen_chat;
declare const chat_zen_d_zen_chatbot: typeof zen_chatbot;
declare namespace chat_zen_d {
  export {
    demo$2 as demo,
    chat_zen_d_pairs as pairs,
    reflections$1 as reflections,
    chat_zen_d_responses as responses,
    chat_zen_d_zen_chat as zen_chat,
    chat_zen_d_zen_chatbot as zen_chatbot,
  };
}

declare class ProductionList$1 {
    constructor(..._a: unknown[]);
}
declare class CFGEditor$1 {
    constructor(..._a: unknown[]);
}
declare class CFGDemo$1 {
    constructor(..._a: unknown[]);
}
declare class TreeSegmentWidget$1 {
    constructor(..._a: unknown[]);
}
declare function treeToTreesegment$1(..._a: unknown[]): never;
declare class TreeWidget$1 {
    constructor(..._a: unknown[]);
}
declare class TreeView$1 {
    constructor(..._a: unknown[]);
}
declare function drawTrees$1(..._a: unknown[]): never;
declare class Table$1 {
    constructor(..._a: unknown[]);
}
declare class MultiListbox$1 {
    constructor(..._a: unknown[]);
}
declare function dispersionPlot$1(..._a: unknown[]): never;

declare namespace draw_d {
  export {
    CFGDemo$1 as CFGDemo,
    CFGEditor$1 as CFGEditor,
    MultiListbox$1 as MultiListbox,
    ProductionList$1 as ProductionList,
    Table$1 as Table,
    TreeSegmentWidget$1 as TreeSegmentWidget,
    TreeView$1 as TreeView,
    TreeWidget$1 as TreeWidget,
    dispersionPlot$1 as dispersionPlot,
    drawTrees$1 as drawTrees,
    treeToTreesegment$1 as treeToTreesegment,
  };
}

declare class ProductionList {
    constructor(..._a: unknown[]);
}
declare class CFGEditor {
    constructor(..._a: unknown[]);
}
declare class CFGDemo {
    constructor(..._a: unknown[]);
}

type draw_cfg_d_CFGDemo = CFGDemo;
declare const draw_cfg_d_CFGDemo: typeof CFGDemo;
type draw_cfg_d_CFGEditor = CFGEditor;
declare const draw_cfg_d_CFGEditor: typeof CFGEditor;
type draw_cfg_d_ProductionList = ProductionList;
declare const draw_cfg_d_ProductionList: typeof ProductionList;
declare namespace draw_cfg_d {
  export {
    draw_cfg_d_CFGDemo as CFGDemo,
    draw_cfg_d_CFGEditor as CFGEditor,
    draw_cfg_d_ProductionList as ProductionList,
  };
}

declare function dispersionPlot(_text?: unknown, _words?: unknown, _ignoreCase?: boolean, _title?: string): never;
declare const dispersion_plot: typeof dispersionPlot;

declare const draw_dispersion_d_dispersionPlot: typeof dispersionPlot;
declare const draw_dispersion_d_dispersion_plot: typeof dispersion_plot;
declare namespace draw_dispersion_d {
  export {
    draw_dispersion_d_dispersionPlot as dispersionPlot,
    draw_dispersion_d_dispersion_plot as dispersion_plot,
  };
}

declare class Table {
    constructor(..._a: unknown[]);
}
declare class MultiListbox {
    constructor(..._a: unknown[]);
}

type draw_table_d_MultiListbox = MultiListbox;
declare const draw_table_d_MultiListbox: typeof MultiListbox;
type draw_table_d_Table = Table;
declare const draw_table_d_Table: typeof Table;
declare namespace draw_table_d {
  export {
    draw_table_d_MultiListbox as MultiListbox,
    draw_table_d_Table as Table,
  };
}

declare class TreeSegmentWidget {
    constructor(..._a: unknown[]);
}
declare function treeToTreesegment(..._a: unknown[]): never;
declare const tree_to_treesegment: typeof treeToTreesegment;
declare class TreeWidget {
    constructor(..._a: unknown[]);
}
declare class TreeView {
    constructor(..._a: unknown[]);
}
declare function drawTrees(..._a: unknown[]): never;
declare const draw_trees: typeof drawTrees;

type draw_tree_d_TreeSegmentWidget = TreeSegmentWidget;
declare const draw_tree_d_TreeSegmentWidget: typeof TreeSegmentWidget;
type draw_tree_d_TreeView = TreeView;
declare const draw_tree_d_TreeView: typeof TreeView;
type draw_tree_d_TreeWidget = TreeWidget;
declare const draw_tree_d_TreeWidget: typeof TreeWidget;
declare const draw_tree_d_drawTrees: typeof drawTrees;
declare const draw_tree_d_draw_trees: typeof draw_trees;
declare const draw_tree_d_treeToTreesegment: typeof treeToTreesegment;
declare const draw_tree_d_tree_to_treesegment: typeof tree_to_treesegment;
declare namespace draw_tree_d {
  export {
    draw_tree_d_TreeSegmentWidget as TreeSegmentWidget,
    draw_tree_d_TreeView as TreeView,
    draw_tree_d_TreeWidget as TreeWidget,
    draw_tree_d_drawTrees as drawTrees,
    draw_tree_d_draw_trees as draw_trees,
    draw_tree_d_treeToTreesegment as treeToTreesegment,
    draw_tree_d_tree_to_treesegment as tree_to_treesegment,
  };
}

declare class CanvasWidget {
    constructor(..._a: unknown[]);
}
declare class TextWidget extends CanvasWidget {
}
declare class SymbolWidget extends TextWidget {
}
declare class AbstractContainerWidget extends CanvasWidget {
}
declare class BoxWidget extends AbstractContainerWidget {
}
declare class OvalWidget extends AbstractContainerWidget {
}
declare class ParenWidget extends AbstractContainerWidget {
}
declare class BracketWidget extends AbstractContainerWidget {
}
declare class SequenceWidget extends CanvasWidget {
}
declare class StackWidget extends CanvasWidget {
}
declare class SpaceWidget extends CanvasWidget {
}
declare class ScrollWatcherWidget extends CanvasWidget {
}
declare class CanvasFrame$1 {
    constructor(..._a: unknown[]);
}
declare class ShowText$1 {
    constructor(..._a: unknown[]);
}
declare class EntryDialog {
    constructor(..._a: unknown[]);
}
declare class ColorizedList {
    constructor(..._a: unknown[]);
}
declare class MutableOptionMenu {
    constructor(..._a: unknown[]);
}
declare function demo$1(): never;

type draw_util_d_AbstractContainerWidget = AbstractContainerWidget;
declare const draw_util_d_AbstractContainerWidget: typeof AbstractContainerWidget;
type draw_util_d_BoxWidget = BoxWidget;
declare const draw_util_d_BoxWidget: typeof BoxWidget;
type draw_util_d_BracketWidget = BracketWidget;
declare const draw_util_d_BracketWidget: typeof BracketWidget;
type draw_util_d_CanvasWidget = CanvasWidget;
declare const draw_util_d_CanvasWidget: typeof CanvasWidget;
type draw_util_d_ColorizedList = ColorizedList;
declare const draw_util_d_ColorizedList: typeof ColorizedList;
type draw_util_d_EntryDialog = EntryDialog;
declare const draw_util_d_EntryDialog: typeof EntryDialog;
type draw_util_d_MutableOptionMenu = MutableOptionMenu;
declare const draw_util_d_MutableOptionMenu: typeof MutableOptionMenu;
type draw_util_d_OvalWidget = OvalWidget;
declare const draw_util_d_OvalWidget: typeof OvalWidget;
type draw_util_d_ParenWidget = ParenWidget;
declare const draw_util_d_ParenWidget: typeof ParenWidget;
type draw_util_d_ScrollWatcherWidget = ScrollWatcherWidget;
declare const draw_util_d_ScrollWatcherWidget: typeof ScrollWatcherWidget;
type draw_util_d_SequenceWidget = SequenceWidget;
declare const draw_util_d_SequenceWidget: typeof SequenceWidget;
type draw_util_d_SpaceWidget = SpaceWidget;
declare const draw_util_d_SpaceWidget: typeof SpaceWidget;
type draw_util_d_StackWidget = StackWidget;
declare const draw_util_d_StackWidget: typeof StackWidget;
type draw_util_d_SymbolWidget = SymbolWidget;
declare const draw_util_d_SymbolWidget: typeof SymbolWidget;
type draw_util_d_TextWidget = TextWidget;
declare const draw_util_d_TextWidget: typeof TextWidget;
declare namespace draw_util_d {
  export {
    draw_util_d_AbstractContainerWidget as AbstractContainerWidget,
    draw_util_d_BoxWidget as BoxWidget,
    draw_util_d_BracketWidget as BracketWidget,
    CanvasFrame$1 as CanvasFrame,
    draw_util_d_CanvasWidget as CanvasWidget,
    draw_util_d_ColorizedList as ColorizedList,
    draw_util_d_EntryDialog as EntryDialog,
    draw_util_d_MutableOptionMenu as MutableOptionMenu,
    draw_util_d_OvalWidget as OvalWidget,
    draw_util_d_ParenWidget as ParenWidget,
    draw_util_d_ScrollWatcherWidget as ScrollWatcherWidget,
    draw_util_d_SequenceWidget as SequenceWidget,
    ShowText$1 as ShowText,
    draw_util_d_SpaceWidget as SpaceWidget,
    draw_util_d_StackWidget as StackWidget,
    draw_util_d_SymbolWidget as SymbolWidget,
    draw_util_d_TextWidget as TextWidget,
    demo$1 as demo,
  };
}

declare class Streamer$1 {
    constructor(..._a: unknown[]);
}
declare class Query$1 {
    constructor(..._a: unknown[]);
}
declare class Twitter$1 {
    constructor(..._a: unknown[]);
}
declare class TweetViewer$1 {
    constructor(..._a: unknown[]);
}
declare class TweetWriter$1 {
    constructor(..._a: unknown[]);
}
declare class Authenticate$1 {
    constructor(..._a: unknown[]);
}
declare function credsfromfile$1(..._a: unknown[]): never;
declare function json2csv$1(..._a: unknown[]): never;

declare namespace twitter_d {
  export {
    Authenticate$1 as Authenticate,
    Query$1 as Query,
    Streamer$1 as Streamer,
    TweetViewer$1 as TweetViewer,
    TweetWriter$1 as TweetWriter,
    Twitter$1 as Twitter,
    credsfromfile$1 as credsfromfile,
    json2csv$1 as json2csv,
  };
}

declare class LocalTimezoneOffsetWithUTC$1 {
    STDOFFSET: number;
    DSTOFFSET: number;
    utcoffset(_dt?: unknown): number;
    toString(): string;
}
declare const LOCAL: LocalTimezoneOffsetWithUTC$1;
declare class BasicTweetHandler$1 {
    limit: number;
    counter: number;
    constructor(limit?: number);
    handle(_tweet: unknown): void;
    onExit(): void;
}
declare class TweetHandlerI$1 extends BasicTweetHandler$1 {
}

declare const twitter_api_d_LOCAL: typeof LOCAL;
declare namespace twitter_api_d {
  export {
    BasicTweetHandler$1 as BasicTweetHandler,
    twitter_api_d_LOCAL as LOCAL,
    LocalTimezoneOffsetWithUTC$1 as LocalTimezoneOffsetWithUTC,
    TweetHandlerI$1 as TweetHandlerI,
  };
}

/** nltk.twitter.common.extract_fields — pull (possibly nested) field values. */
declare function extract_fields(tweet: Record<string, unknown>, fields: string[]): unknown[];
/** nltk.twitter.common.json2csv — line-separated tweet JSON → CSV rows. */
declare function json2csv(fp: Iterable<string> | string, outfile: string, fields: string[], encoding?: string, errors?: string, gzip_compress?: boolean): void;
/** nltk.twitter.common.get_header_field_list */
declare function get_header_field_list(main_fields: string[], entity_type: string, entity_fields: string[]): string[];
/** nltk.twitter.common.json2csv_entities — one CSV row per entity. */
declare function json2csv_entities(tweets_file: Iterable<string> | string, outfile: string, main_fields: string[], entity_type: string, entity_fields: string[], encoding?: string, errors?: string, gzip_compress?: boolean): void;

declare const twitter_common_d_extract_fields: typeof extract_fields;
declare const twitter_common_d_get_header_field_list: typeof get_header_field_list;
declare const twitter_common_d_json2csv: typeof json2csv;
declare const twitter_common_d_json2csv_entities: typeof json2csv_entities;
declare namespace twitter_common_d {
  export {
    twitter_common_d_extract_fields as extract_fields,
    twitter_common_d_get_header_field_list as get_header_field_list,
    twitter_common_d_json2csv as json2csv,
    twitter_common_d_json2csv_entities as json2csv_entities,
  };
}

declare function verbose(_fn: unknown): never;
declare function yesterday(): never;
declare function setup(): never;
declare function twitterclassDemo(): never;
declare function sampletoscreenDemo(_limit?: number): never;
declare function tracktoscreenDemo(_track?: string, _limit?: number): never;
declare function searchDemo(_keywords?: string): never;
declare function tweetsByUserDemo(_user?: string, _count?: number): never;
declare function lookupByUseridDemo(): never;
declare function followtoscreenDemo(_limit?: number): never;
declare function streamtofileDemo(_limit?: number): never;
declare function limitByTimeDemo(_keywords?: string): never;
declare function corpusreaderDemo(): never;
declare function expandTweetidsDemo(): never;

declare const twitter_twitter_demo_d_corpusreaderDemo: typeof corpusreaderDemo;
declare const twitter_twitter_demo_d_expandTweetidsDemo: typeof expandTweetidsDemo;
declare const twitter_twitter_demo_d_followtoscreenDemo: typeof followtoscreenDemo;
declare const twitter_twitter_demo_d_limitByTimeDemo: typeof limitByTimeDemo;
declare const twitter_twitter_demo_d_lookupByUseridDemo: typeof lookupByUseridDemo;
declare const twitter_twitter_demo_d_sampletoscreenDemo: typeof sampletoscreenDemo;
declare const twitter_twitter_demo_d_searchDemo: typeof searchDemo;
declare const twitter_twitter_demo_d_setup: typeof setup;
declare const twitter_twitter_demo_d_streamtofileDemo: typeof streamtofileDemo;
declare const twitter_twitter_demo_d_tracktoscreenDemo: typeof tracktoscreenDemo;
declare const twitter_twitter_demo_d_tweetsByUserDemo: typeof tweetsByUserDemo;
declare const twitter_twitter_demo_d_twitterclassDemo: typeof twitterclassDemo;
declare const twitter_twitter_demo_d_verbose: typeof verbose;
declare const twitter_twitter_demo_d_yesterday: typeof yesterday;
declare namespace twitter_twitter_demo_d {
  export {
    twitter_twitter_demo_d_corpusreaderDemo as corpusreaderDemo,
    twitter_twitter_demo_d_expandTweetidsDemo as expandTweetidsDemo,
    twitter_twitter_demo_d_followtoscreenDemo as followtoscreenDemo,
    twitter_twitter_demo_d_limitByTimeDemo as limitByTimeDemo,
    twitter_twitter_demo_d_lookupByUseridDemo as lookupByUseridDemo,
    twitter_twitter_demo_d_sampletoscreenDemo as sampletoscreenDemo,
    twitter_twitter_demo_d_searchDemo as searchDemo,
    twitter_twitter_demo_d_setup as setup,
    twitter_twitter_demo_d_streamtofileDemo as streamtofileDemo,
    twitter_twitter_demo_d_tracktoscreenDemo as tracktoscreenDemo,
    twitter_twitter_demo_d_tweetsByUserDemo as tweetsByUserDemo,
    twitter_twitter_demo_d_twitterclassDemo as twitterclassDemo,
    twitter_twitter_demo_d_verbose as verbose,
    twitter_twitter_demo_d_yesterday as yesterday,
  };
}

declare class Streamer {
    constructor(..._a: unknown[]);
}
declare class Query {
    constructor(..._a: unknown[]);
}
declare class Twitter {
    constructor(..._a: unknown[]);
}
declare class TweetViewer {
    constructor(..._a: unknown[]);
}
declare class TweetWriter {
    constructor(..._a: unknown[]);
}

type twitter_twitterclient_d_Query = Query;
declare const twitter_twitterclient_d_Query: typeof Query;
type twitter_twitterclient_d_Streamer = Streamer;
declare const twitter_twitterclient_d_Streamer: typeof Streamer;
type twitter_twitterclient_d_TweetViewer = TweetViewer;
declare const twitter_twitterclient_d_TweetViewer: typeof TweetViewer;
type twitter_twitterclient_d_TweetWriter = TweetWriter;
declare const twitter_twitterclient_d_TweetWriter: typeof TweetWriter;
type twitter_twitterclient_d_Twitter = Twitter;
declare const twitter_twitterclient_d_Twitter: typeof Twitter;
declare namespace twitter_twitterclient_d {
  export {
    twitter_twitterclient_d_Query as Query,
    twitter_twitterclient_d_Streamer as Streamer,
    twitter_twitterclient_d_TweetViewer as TweetViewer,
    twitter_twitterclient_d_TweetWriter as TweetWriter,
    twitter_twitterclient_d_Twitter as Twitter,
  };
}

declare function credsfromfile(..._a: unknown[]): never;
declare class Authenticate {
    credsFile: string;
    credsFullpath: string | null;
    oauth: Record<string, string>;
    twitterDir: string | null;
    credsSubdir: string | null;
    constructor(..._a: unknown[]);
    loadCreds(..._a: unknown[]): never;
    saveCreds(..._a: unknown[]): never;
}

type twitter_util_d_Authenticate = Authenticate;
declare const twitter_util_d_Authenticate: typeof Authenticate;
declare const twitter_util_d_credsfromfile: typeof credsfromfile;
declare namespace twitter_util_d {
  export {
    twitter_util_d_Authenticate as Authenticate,
    twitter_util_d_credsfromfile as credsfromfile,
  };
}

declare class OrderedDict<K, V> extends Map<K, V> {
    private _keys;
    constructor(entries?: Iterable<[K, V]> | null);
    set(key: K, value: V): this;
    delete(key: K): boolean;
    clear(): void;
    keys(): MapIterator<K>;
    orderedKeys(): K[];
}
declare abstract class AbstractLazySequence<T> {
    abstract get length(): number;
    abstract get(index: number): T;
    [Symbol.iterator](): Iterator<T>;
    toArray(): T[];
}
declare class LazySubsequence<T> extends AbstractLazySequence<T> {
    private seq;
    private start;
    private stop;
    constructor(seq: T[] | AbstractLazySequence<T>, start: number, stop: number);
    get length(): number;
    get(index: number): T;
}
declare class LazyConcatenation<T> extends AbstractLazySequence<T> {
    private seqs;
    constructor(seqs: (T[] | AbstractLazySequence<T>)[]);
    get length(): number;
    get(index: number): T;
}
declare class LazyMap<T, U> extends AbstractLazySequence<U> {
    private func;
    private seq;
    constructor(func: (x: T) => U, seq: T[] | AbstractLazySequence<T>);
    get length(): number;
    get(index: number): U;
}
declare class LazyZip<T> extends LazyMap<T[], T[]> {
    constructor(...seqs: unknown[][]);
}
declare class LazyEnumerate<T> extends LazyZip<[number, T]> {
}
declare class LazyIteratorList<T> extends AbstractLazySequence<T> {
    private iter;
    private cache;
    constructor(iter: Iterable<T>);
    get length(): number;
    get(index: number): T;
}
/** Port of nltk.collections.Trie — a dict-subclass trie where ``self[key]``
 * auto-vivifies a subtrie via ``__missing__`` and a complete string stores
 * ``{Trie.LEAF: None}`` at its node. dict methods are inherited in Python;
 * here they are explicit Map-compatible members. Preserves the
 * ``dict.copy() -> dict`` quirk: copy() returns a plain Map, not a Trie.
 */
declare class Trie extends Map<unknown, unknown> {
    static readonly LEAF = true;
    constructor(strings?: Iterable<string> | null);
    private missing;
    insert(string: string): void;
    get(key: unknown, defaultValue?: unknown): unknown;
    /** Quirk preserved: nltk's Trie.copy() resolves to dict.copy(), which
     * returns a plain dict (shallow), not a Trie. */
    copy(): Map<unknown, unknown>;
    static fromkeys(iterable: Iterable<unknown>, value?: unknown): Trie;
    pop(key: unknown, defaultValue?: unknown): unknown;
    popitem(): [unknown, unknown];
    setdefault(key: unknown, defaultValue?: unknown): unknown;
    update(other: Iterable<[unknown, unknown]> | Map<unknown, unknown> | Record<string, unknown>): void;
    items(): MapIterator<[unknown, unknown]>;
    hasWord(word: string): boolean;
}

type collections_d_AbstractLazySequence<T> = AbstractLazySequence<T>;
declare const collections_d_AbstractLazySequence: typeof AbstractLazySequence;
type collections_d_LazyConcatenation<T> = LazyConcatenation<T>;
declare const collections_d_LazyConcatenation: typeof LazyConcatenation;
type collections_d_LazyEnumerate<T> = LazyEnumerate<T>;
declare const collections_d_LazyEnumerate: typeof LazyEnumerate;
type collections_d_LazyIteratorList<T> = LazyIteratorList<T>;
declare const collections_d_LazyIteratorList: typeof LazyIteratorList;
type collections_d_LazyMap<T, U> = LazyMap<T, U>;
declare const collections_d_LazyMap: typeof LazyMap;
type collections_d_LazySubsequence<T> = LazySubsequence<T>;
declare const collections_d_LazySubsequence: typeof LazySubsequence;
type collections_d_LazyZip<T> = LazyZip<T>;
declare const collections_d_LazyZip: typeof LazyZip;
type collections_d_OrderedDict<K, V> = OrderedDict<K, V>;
declare const collections_d_OrderedDict: typeof OrderedDict;
type collections_d_Trie = Trie;
declare const collections_d_Trie: typeof Trie;
declare namespace collections_d {
  export {
    collections_d_AbstractLazySequence as AbstractLazySequence,
    collections_d_LazyConcatenation as LazyConcatenation,
    collections_d_LazyEnumerate as LazyEnumerate,
    collections_d_LazyIteratorList as LazyIteratorList,
    collections_d_LazyMap as LazyMap,
    collections_d_LazySubsequence as LazySubsequence,
    collections_d_LazyZip as LazyZip,
    collections_d_OrderedDict as OrderedDict,
    collections_d_Trie as Trie,
  };
}

declare function addPy3Data(_path: string): void;
declare const add_py3_data$1: typeof addPy3Data;
declare function py3Data<T extends (...args: unknown[]) => unknown>(initFunc: T): T;
declare const py3_data$1: typeof py3Data;

declare const compat_d_addPy3Data: typeof addPy3Data;
declare const compat_d_py3Data: typeof py3Data;
declare namespace compat_d {
  export {
    compat_d_addPy3Data as addPy3Data,
    add_py3_data$1 as add_py3_data,
    compat_d_py3Data as py3Data,
    py3_data$1 as py3_data,
  };
}

declare function decorator$1(caller: (fn: unknown, ...args: unknown[]) => unknown): (fn: (...args: unknown[]) => unknown) => (...args: unknown[]) => unknown;
declare function decoratorFactory<T>(_cls: new (...a: unknown[]) => T): (fn: unknown) => unknown;
declare function memoize<T extends (...args: unknown[]) => unknown>(fn: T): T;
declare const getattr_: (obj: Record<string, unknown>, name: string, defaultThunk: () => unknown) => unknown;

declare const decorators_d_decoratorFactory: typeof decoratorFactory;
declare const decorators_d_getattr_: typeof getattr_;
declare const decorators_d_memoize: typeof memoize;
declare namespace decorators_d {
  export {
    decorator$1 as decorator,
    decorators_d_decoratorFactory as decoratorFactory,
    decorators_d_getattr_ as getattr_,
    decorators_d_memoize as memoize,
  };
}

declare const TAG_PREFIX = "!";
declare const jsonTags: Record<string, unknown>;
declare function registerTag<T extends {
    jsonTag: string;
}>(cls: T): T;
declare const register_tag: typeof registerTag;
declare class JSONTaggedEncoder {
    encode(obj: unknown): string;
    static stringify(obj: unknown): string;
}
declare class JSONTaggedDecoder {
    static MAX_DECODE_DEPTH: number;
    decode(s: string): unknown;
    static decodeObj(obj: unknown, depth?: number): unknown;
}

type jsontags_d_JSONTaggedDecoder = JSONTaggedDecoder;
declare const jsontags_d_JSONTaggedDecoder: typeof JSONTaggedDecoder;
type jsontags_d_JSONTaggedEncoder = JSONTaggedEncoder;
declare const jsontags_d_JSONTaggedEncoder: typeof JSONTaggedEncoder;
declare const jsontags_d_TAG_PREFIX: typeof TAG_PREFIX;
declare const jsontags_d_jsonTags: typeof jsonTags;
declare const jsontags_d_registerTag: typeof registerTag;
declare const jsontags_d_register_tag: typeof register_tag;
declare namespace jsontags_d {
  export {
    jsontags_d_JSONTaggedDecoder as JSONTaggedDecoder,
    jsontags_d_JSONTaggedEncoder as JSONTaggedEncoder,
    jsontags_d_TAG_PREFIX as TAG_PREFIX,
    jsontags_d_jsonTags as jsonTags,
    jsontags_d_registerTag as registerTag,
    jsontags_d_register_tag as register_tag,
  };
}

declare class LazyModule {
    private name;
    private loader;
    private _loaded;
    private _mod;
    constructor(name: string, loader: () => Record<string, unknown>);
    private ensureLoaded;
    get(attr: string): unknown;
    has(attr: string): boolean;
}

type lazyimport_d_LazyModule = LazyModule;
declare const lazyimport_d_LazyModule: typeof LazyModule;
declare namespace lazyimport_d {
  export {
    lazyimport_d_LazyModule as LazyModule,
  };
}

declare function rmNl(s: string): string;
declare const rm_nl: typeof rmNl;
declare class TabEncoder {
    encode(..._a: unknown[]): never;
}
declare class TabDecoder {
    decode(..._a: unknown[]): never;
}
declare class MaxentEncoder extends TabEncoder {
}
declare class MaxentDecoder extends TabDecoder {
}
declare class PunktDecoder extends TabDecoder {
}

type tabdata_d_MaxentDecoder = MaxentDecoder;
declare const tabdata_d_MaxentDecoder: typeof MaxentDecoder;
type tabdata_d_MaxentEncoder = MaxentEncoder;
declare const tabdata_d_MaxentEncoder: typeof MaxentEncoder;
type tabdata_d_PunktDecoder = PunktDecoder;
declare const tabdata_d_PunktDecoder: typeof PunktDecoder;
type tabdata_d_TabDecoder = TabDecoder;
declare const tabdata_d_TabDecoder: typeof TabDecoder;
type tabdata_d_TabEncoder = TabEncoder;
declare const tabdata_d_TabEncoder: typeof TabEncoder;
declare const tabdata_d_rm_nl: typeof rm_nl;
declare namespace tabdata_d {
  export {
    tabdata_d_MaxentDecoder as MaxentDecoder,
    tabdata_d_MaxentEncoder as MaxentEncoder,
    tabdata_d_PunktDecoder as PunktDecoder,
    tabdata_d_TabDecoder as TabDecoder,
    tabdata_d_TabEncoder as TabEncoder,
    tabdata_d_rm_nl as rm_nl,
  };
}

declare const iso639short: Record<string, string>;
declare const iso639retired: Record<string, string>;
declare function langname(tag: string | null, typ?: string, strict?: boolean): string | null;
declare function langcode(name: string, _typ?: number, strict?: boolean): string | null;
declare function tag2q(tag: string, strict?: boolean): string | null;
declare function q2tag(qcode: string, strict?: boolean): string | null;
declare function q2name(qcode: string, typ?: string, strict?: boolean): string | null;
declare function lang2q(name: string, strict?: boolean): string | null;
declare function inverseDict<T extends Record<string, string>>(d: T): Record<string, string>;
declare const inverse_dict: typeof inverseDict;

declare const langnames_d_inverseDict: typeof inverseDict;
declare const langnames_d_inverse_dict: typeof inverse_dict;
declare const langnames_d_iso639retired: typeof iso639retired;
declare const langnames_d_iso639short: typeof iso639short;
declare const langnames_d_lang2q: typeof lang2q;
declare const langnames_d_langcode: typeof langcode;
declare const langnames_d_langname: typeof langname;
declare const langnames_d_q2name: typeof q2name;
declare const langnames_d_q2tag: typeof q2tag;
declare const langnames_d_tag2q: typeof tag2q;
declare namespace langnames_d {
  export {
    langnames_d_inverseDict as inverseDict,
    langnames_d_inverse_dict as inverse_dict,
    langnames_d_iso639retired as iso639retired,
    langnames_d_iso639short as iso639short,
    langnames_d_lang2q as lang2q,
    langnames_d_langcode as langcode,
    langnames_d_langname as langname,
    langnames_d_q2name as q2name,
    langnames_d_q2tag as q2tag,
    langnames_d_tag2q as tag2q,
  };
}

/** cli — shim (requires click/tqdm — not available in JS). */
declare function cli(): never;
declare const CONTEXT_SETTINGS: {
    help_option_names: string[];
};

declare const cli_d_CONTEXT_SETTINGS: typeof CONTEXT_SETTINGS;
declare const cli_d_cli: typeof cli;
declare namespace cli_d {
  export {
    cli_d_CONTEXT_SETTINGS as CONTEXT_SETTINGS,
    cli_d_cli as cli,
  };
}

/** corpus.europarl_raw — shim (requires Europarl corpus data). */
declare class EuroparlCorpusReader$1 {
    constructor(..._a: unknown[]);
}

declare namespace corpus_europarl_raw_d {
  export {
    EuroparlCorpusReader$1 as EuroparlCorpusReader,
  };
}

type PorterMode = "NLTK_EXTENSIONS" | "MARTIN_EXTENSIONS" | "ORIGINAL_ALGORITHM";
/** NLTK-compatible PorterStemmer facade backed by Rust. */
declare class PorterStemmer {
    static readonly NLTK_EXTENSIONS = "NLTK_EXTENSIONS";
    static readonly MARTIN_EXTENSIONS = "MARTIN_EXTENSIONS";
    static readonly ORIGINAL_ALGORITHM = "ORIGINAL_ALGORITHM";
    readonly mode: PorterMode;
    readonly algorithm: string;
    private readonly modeId;
    constructor(mode?: string, algorithm?: string);
    stem(token: string, to_lowercase?: boolean): string;
}

type TaggedToken = {
    token: string;
    tag: string;
};
type ChunkTree = {
    label: string;
    children: Array<ChunkTree | TaggedToken>;
};
type Piece = ChunkTree | TaggedToken;
declare function tagPattern2rePattern(tagPattern: string): string;
declare const tag_pattern2re_pattern: typeof tagPattern2rePattern;
declare class ChunkString {
    private readonly rootLabel;
    private readonly pieces;
    private readonly debug;
    static readonly IN_CHUNK_PATTERN = "(?=[^{]*\\})";
    static readonly IN_STRIP_PATTERN = "(?=[^}]*(\\{|$))";
    private _str;
    constructor(rootLabel: string, pieces: Piece[], debug?: number);
    get str(): string;
    private _verify;
    to_chunkstruct(chunkLabel?: string): ChunkTree;
    toChunkstruct(chunkLabel?: string): ChunkTree;
    xform(regexp: RegExp | string, repl: string): void;
    toString(): string;
}
declare class RegexpChunkRule {
    readonly regexp: RegExp;
    readonly repl: string;
    private readonly _descr;
    constructor(regexp: RegExp, repl: string, _descr: string);
    apply(chunkstr: ChunkString): void;
    descr(): string;
    static fromstring(s: string): RegexpChunkRule;
    toString(): string;
}
declare class ChunkRule extends RegexpChunkRule {
    readonly pattern: string;
    constructor(pattern: string, descr: string);
    toString(): string;
}
declare class StripRule extends RegexpChunkRule {
    readonly pattern: string;
    constructor(pattern: string, descr: string);
}
declare class UnChunkRule extends RegexpChunkRule {
    readonly pattern: string;
    constructor(pattern: string, descr: string);
}
declare class MergeRule extends RegexpChunkRule {
    readonly leftTagPattern: string;
    readonly rightTagPattern: string;
    constructor(leftTagPattern: string, rightTagPattern: string, descr: string);
}
declare class SplitRule extends RegexpChunkRule {
    readonly leftTagPattern: string;
    readonly rightTagPattern: string;
    constructor(leftTagPattern: string, rightTagPattern: string, descr: string);
}
declare class ExpandLeftRule extends RegexpChunkRule {
    readonly leftTagPattern: string;
    readonly rightTagPattern: string;
    constructor(leftTagPattern: string, rightTagPattern: string, descr: string);
}
declare class ExpandRightRule extends RegexpChunkRule {
    readonly leftTagPattern: string;
    readonly rightTagPattern: string;
    constructor(leftTagPattern: string, rightTagPattern: string, descr: string);
}
declare class ChunkRuleWithContext extends RegexpChunkRule {
    readonly leftTagPattern: string;
    readonly tagPattern: string;
    readonly rightTagPattern: string;
    constructor(leftTagPattern: string, tagPattern: string, rightTagPattern: string, descr: string);
}
type IobRow = {
    token: string;
    tag: string;
    iob: string;
};
declare function tree2conlltags(tree: ChunkTree): IobRow[];
declare function conlltags2tree(rows: IobRow[], chunkLabel?: string, rootLabel?: string): ChunkTree;
declare class ChunkScore {
    private readonly chunkLabel;
    private _correct;
    private _guessed;
    private _tp;
    private _fp;
    private _fn;
    private _tagsCorrect;
    private _tagsTotal;
    private _measuresNeedUpdate;
    constructor(chunkLabel?: string);
    private _chunksets;
    score(correct: ChunkTree, guessed: ChunkTree): void;
    private _count;
    private _updateMeasures;
    accuracy(): number;
    precision(): number;
    recall(): number;
    f_measure(alpha?: number): number;
    fMeasure(alpha?: number): number;
    missed(): Piece[];
    incorrect(): Piece[];
    correct(): Piece[];
    guessed(): Piece[];
    chunked(): Piece[];
    get length(): number;
    repr(): string;
    toString(): string;
}
declare class RegexpChunkParser {
    private readonly _rules;
    private readonly chunkLabel;
    private readonly rootLabel;
    protected readonly _trace: number;
    constructor(_rules: RegexpChunkRule[], chunkLabel?: string, rootLabel?: string, trace?: number);
    rules(): RegexpChunkRule[];
    private _apply;
    parse(chunkStruct: ChunkTree | TaggedToken[], trace?: number): ChunkTree;
    parse_one(chunkStruct: ChunkTree | TaggedToken[]): ChunkTree;
    parseOne(chunkStruct: ChunkTree | TaggedToken[]): ChunkTree;
    parse_all(chunkStruct: ChunkTree | TaggedToken[]): ChunkTree[];
    parseAll(chunkStruct: ChunkTree | TaggedToken[]): ChunkTree[];
    parse_sents(sents: Iterable<ChunkTree | TaggedToken[]>): ChunkTree[];
    parseSents(sents: Iterable<ChunkTree | TaggedToken[]>): ChunkTree[];
    evaluate(gold: ChunkTree[]): ChunkScore;
    accuracy(gold: ChunkTree[]): ChunkScore;
}
declare class RegexpParser {
    private readonly _trace;
    private readonly _grammar;
    private readonly _loop;
    private readonly _stages;
    constructor(grammar: string | RegexpChunkParser[], rootLabel?: string, loop?: number, trace?: number);
    private _readGrammar;
    private _addStage;
    grammar(): string;
    parse(chunkStruct: ChunkTree | TaggedToken[], trace?: number): ChunkTree;
    parse_one(chunkStruct: ChunkTree | TaggedToken[]): ChunkTree;
    parseOne(chunkStruct: ChunkTree | TaggedToken[]): ChunkTree;
    parse_all(chunkStruct: ChunkTree | TaggedToken[]): ChunkTree[];
    parseAll(chunkStruct: ChunkTree | TaggedToken[]): ChunkTree[];
    parse_sents(sents: Iterable<ChunkTree | TaggedToken[]>): ChunkTree[];
    parseSents(sents: Iterable<ChunkTree | TaggedToken[]>): ChunkTree[];
    evaluate(gold: ChunkTree[]): ChunkScore;
    accuracy(gold: ChunkTree[]): ChunkScore;
}

/** CPython `random.Random(seed)` - MT19937 with init_by_array keying for int seeds. */
declare class PythonRandom {
    private mt;
    private index;
    constructor(seed?: number | PythonRandom);
    private gen;
    /** CPython `random()`: 53-bit float from two 32-bit draws. */
    random(): number;
}
declare class Vocabulary {
    readonly counts: FreqDist<string>;
    readonly unkLabel: string;
    private readonly _cutoff;
    private _len;
    constructor(counts?: Iterable<string> | FreqDist<string> | Record<string, number>, unkCutoff?: number, unkLabel?: string);
    get unk_label(): string;
    get cutoff(): number;
    get length(): number;
    update(items?: Iterable<string> | FreqDist<string> | Record<string, number>): void;
    private lookupOne;
    lookup(words: unknown): unknown;
    lookupStr(words: string | Iterable<unknown>): string | unknown[];
    get(item: string): number;
    contains(item: string): boolean;
    [Symbol.iterator](): Generator<string>;
    equals(other: Vocabulary): boolean;
    toString(): string;
}
declare class NgramCounter {
    private readonly _counts;
    readonly unigrams: FreqDist<string>;
    private _distinct;
    constructor(ngramText?: Iterable<Iterable<string[]>>);
    private orderCounts;
    update(ngramText: Iterable<Iterable<string[]>>): void;
    private noteNew;
    N(): number;
    /** `counter[n]` -> ConditionalFreqDist (n>=2) or unigram FreqDist (n=1); `counter['w']` -> unigram count; `counter[[ctx...]]` -> context FreqDist. */
    get(item: number): ConditionalFreqDist<string[], string> | FreqDist<string>;
    get(item: string): number;
    get(item: string[]): FreqDist<string>;
    contextDist(context: string[]): FreqDist<string>;
    get ngramOrderCount(): number;
    toString(): string;
}
declare abstract class Smoothing {
    protected readonly vocab: Vocabulary;
    protected readonly counts: NgramCounter;
    constructor(vocab: Vocabulary, counts: NgramCounter);
    protected ctxDist(context: string[]): FreqDist<string>;
    abstract unigram_score(word: string): number;
    abstract alpha_gamma(word: string, context: string[]): [number, number];
}
declare class WittenBell extends Smoothing {
    alpha_gamma(word: string, context: string[]): [number, number];
    private gammaOf;
    unigram_score(word: string): number;
}
declare class AbsoluteDiscounting extends Smoothing {
    readonly discount: number;
    constructor(vocab: Vocabulary, counts: NgramCounter, discount?: number);
    alpha_gamma(word: string, context: string[]): [number, number];
    private gammaOf;
    unigram_score(word: string): number;
}
declare class KneserNey extends Smoothing {
    private readonly _order;
    readonly discount: number;
    constructor(vocab: Vocabulary, counts: NgramCounter, _order: number, discount?: number);
    unigram_score(word: string): number;
    alpha_gamma(word: string, context: string[]): [number, number];
    private continuationCounts;
}
declare abstract class LanguageModel {
    readonly order: number;
    readonly vocab: Vocabulary;
    readonly counts: NgramCounter;
    constructor(order: number, vocabulary?: Vocabulary, counter?: NgramCounter);
    fit(text: Iterable<Iterable<string[]>>, vocabularyText?: Iterable<string>): void;
    score(word: string, context?: string[] | null): number;
    abstract unmasked_score(word: string, context: string[] | null): number;
    logscore(word: string, context?: string[] | null): number;
    context_counts(context: string[] | null): FreqDist<string>;
    contextCounts(context: string[] | null): FreqDist<string>;
    entropy(textNgrams: Iterable<string[]>): number;
    perplexity(textNgrams: Iterable<string[]>): number;
    generate(num_words?: number, text_seed?: Iterable<string>, random_seed?: number | PythonRandom): string | string[];
}
declare class MLE extends LanguageModel {
    unmasked_score(word: string, context: string[] | null): number;
}
declare class Lidstone extends LanguageModel {
    readonly gamma: number;
    constructor(gamma: number, order: number, vocabulary?: Vocabulary, counter?: NgramCounter);
    unmasked_score(word: string, context: string[] | null): number;
}
declare class Laplace extends Lidstone {
    constructor(order: number, vocabulary?: Vocabulary, counter?: NgramCounter);
}
declare class StupidBackoff extends LanguageModel {
    readonly alpha: number;
    constructor(alpha: number | undefined, order: number, vocabulary?: Vocabulary, counter?: NgramCounter);
    unmasked_score(word: string, context: string[] | null): number;
}
declare class InterpolatedLanguageModel extends LanguageModel {
    protected readonly estimator: Smoothing;
    constructor(smoothingCls: new (vocab: Vocabulary, counts: NgramCounter, ...args: never[]) => Smoothing, order: number, vocabulary?: Vocabulary, counter?: NgramCounter, buildEstimator?: (vocab: Vocabulary, counts: NgramCounter) => Smoothing);
    unmasked_score(word: string, context: string[] | null): number;
}
declare class WittenBellInterpolated extends InterpolatedLanguageModel {
    constructor(order: number, vocabulary?: Vocabulary, counter?: NgramCounter);
}
declare class AbsoluteDiscountingInterpolated extends InterpolatedLanguageModel {
    readonly discount: number;
    constructor(order: number, discount?: number, vocabulary?: Vocabulary, counter?: NgramCounter);
}
declare class KneserNeyInterpolated extends InterpolatedLanguageModel {
    readonly discount: number;
    constructor(order: number, discount?: number, vocabulary?: Vocabulary, counter?: NgramCounter);
}

/**
 * Real Snowball (Porter2-family) stemmers, ported line-for-line from
 * NLTK's nltk/stem/snowball.py (the upstream NLTK 3.10.3 source), which itself
 * is a Python translation of the Snowball spec at http://snowball.tartarus.org/.
 *
 * Supported languages: danish, dutch, english, french, german, italian,
 * norwegian, portuguese, romanian, russian, spanish, swedish.
 *
 * Behavior notes:
 * - Each language stemmer lowercases its input first (exactly like NLTK;
 *   the Russian stemmer does NOT lowercase, matching NLTK).
 * - Unsupported languages throw an Error mirroring NLTK's ValueError:
 *   "The language '<language>' is not supported."
 */
declare function suffixReplace(original: string, old: string, neu: string): string;
declare function prefix_replace(original: string, old: string, neu: string): string;

type Iter<T> = Iterable<T>;
/** nltk.util.usage — print the public methods of an object/class. */
declare function usage(obj: unknown): void;
/** nltk.util.in_idle — false outside CPython IDLE. */
declare function in_idle(): boolean;
/** nltk.util.pr — pretty print a slice of a data sequence. */
declare function pr<T>(data: Iter<T>, start?: number, end?: number): void;
/** nltk.util.print_string — print a string wrapped on whitespace. */
declare function print_string(s: string, width?: number): void;
/** nltk.util.tokenwrap — join tokens and wrap on whitespace. */
declare function tokenwrap(tokens: readonly string[], separator?: string, width?: number): string;
/** nltk.util.cut_string — width-bounded cut aware of combining marks. */
declare function cut_string(s: string, width?: number): string;
/** nltk.util.Index — defaultdict(list) built from pairs. */
declare class Index<K, V> extends Map<K, V[]> {
    constructor(pairs: Iterable<readonly [K, V]>);
}
/** nltk.util.re_show — print string with matched substrings marked. */
declare function re_show(regexp: string, string: string, left?: string, right?: string): void;
/** nltk.util.filestring — read a path or file-like into a string. */
declare function filestring(f: string | {
    read(): string;
}, allowedDir?: string): string;
/** nltk.util.breadth_first — BFS generator (no cycle check). */
declare function breadth_first<T>(tree: T, children?: (node: T) => Iterable<T>, maxdepth?: number): Generator<T>;
/** nltk.util.edge_closure — BFS edge generator discarding cycles. */
declare function edge_closure<T>(tree: T, children?: (node: T) => Iterable<T>, maxdepth?: number, verbose?: boolean): Generator<readonly [T, T]>;
/** nltk.util.edges2dot — render edges in DOT language. */
declare function edges2dot<T>(edges: Iterable<readonly [T, T]>, shapes?: Record<string, string>, attr?: Record<string, string>): string;
/** nltk.util.unweighted_minimum_spanning_dict — BFS MST as adjacency map. */
declare function unweighted_minimum_spanning_dict<T>(tree: T, children?: (node: T) => Iterable<T>): Map<T, T[]>;
/** nltk.util.unweighted_minimum_spanning_digraph — MST rendered in DOT. */
declare function unweighted_minimum_spanning_digraph<T>(tree: T, children?: (node: T) => Iterable<T>, shapes?: Record<string, string>, attr?: Record<string, string>): string;
/** nltk.util.acyclic_breadth_first — BFS discarding cycles. */
declare function acyclic_breadth_first<T>(tree: T, children?: (node: T) => Iterable<T>, maxdepth?: number, verbose?: boolean): Generator<T>;
type Nested<T> = T | Nested<T>[];
/** nltk.util.acyclic_depth_first — nested-list DFS discarding all cycles. */
declare function acyclic_depth_first<T>(tree: T, children?: (node: T) => Iterable<T>, depth?: number, cutMark?: string, traversed?: Set<T>, verbose?: boolean): Nested<T | string>[];
/** nltk.util.acyclic_branches_depth_first — DFS discarding within-branch cycles only. */
declare function acyclic_branches_depth_first<T>(tree: T, children?: (node: T) => Iterable<T>, depth?: number, cutMark?: string, traversed?: Set<T>, verbose?: boolean): Nested<T | string>[];
/** nltk.util.acyclic_dic2tree — adjacency dict to nested list tree. */
declare function acyclic_dic2tree<T>(node: T, dic: Map<T, T[]> | Record<string, T[]>): Nested<T>[];
/** nltk.util.unweighted_minimum_spanning_tree — BFS MST as nested lists. */
declare function unweighted_minimum_spanning_tree<T>(tree: T, children?: (node: T) => Iterable<T>): Nested<T>[];
/** nltk.util.guess_encoding — decode bytes trying utf-8 then latin-1. */
declare function guess_encoding(data: Uint8Array): [string, string];
/** nltk.util.unique_list — dedupe preserving order. */
declare function unique_list<T>(xs: Iterable<T>): T[];
/** nltk.util.invert_dict — invert dict, collecting iterable values into lists. */
declare function invert_dict<K, V>(d: Map<K, V | Iterable<V>> | Record<string, V | Iterable<V>>): Map<unknown, unknown>;
/** nltk.util.clean_html — raises in NLTK; mirrored. */
declare function clean_html(_html: string): never;
/** nltk.util.clean_url — raises in NLTK; mirrored. */
declare function clean_url(_url: string): never;
/** nltk.util.flatten — flatten mixed nested arrays. */
declare function flatten<T>(...args: unknown[]): T[];
/** nltk.util.pad_sequence — pad a sequence for ngram extraction. */
declare function pad_sequence<T>(sequence: Iterable<T>, n: number, options?: {
    pad_left?: boolean;
    pad_right?: boolean;
    left_pad_symbol?: T;
    right_pad_symbol?: T;
}): Generator<T>;
declare const MAX_EVERYGRAMS_DEFAULT_LEN = 256;
/** nltk.util.everygrams — all ngrams from min_len to max_len. */
declare function everygrams<T>(sequence: Iterable<T>, minLen?: number, maxLen?: number, kwargs?: {
    pad_left?: boolean;
    pad_right?: boolean;
    left_pad_symbol?: T;
    right_pad_symbol?: T;
}): Generator<T[]>;
declare const SKIPGRAM_SENTINEL: unique symbol;
/** nltk.util.skipgrams — ngrams allowing up to k skipped tokens. */
declare function skipgrams<T>(sequence: Iterable<T>, n: number, k: number, kwargs?: {
    pad_left?: boolean;
    pad_right?: boolean;
    left_pad_symbol?: T;
    right_pad_symbol?: T;
}): Generator<(T | typeof SKIPGRAM_SENTINEL)[]>;
/** nltk.util.binary_search_file — find the line whose first word is key in a sorted file. */
declare function binary_search_file(path: string, key: string, cache?: Map<number, [number, string]>, cacheDepth?: number): string | null;
declare function set_proxy(proxy: string | null, user?: string | null, _password?: string): void;
/** nltk.util.elementtree_indent — indent an {text, tail, children} element tree. */
declare function elementtree_indent(elem: {
    text?: string | null;
    tail?: string | null;
    children?: {
        text?: string | null;
        tail?: string | null;
        children?: unknown[];
    }[];
}, level?: number): void;
/** nltk.util.choose — binomial coefficient nCk. */
declare function choose(n: number, k: number): number;
/** nltk.internals.raise_unorderable_types — ordering guard used by chart rules. */
declare function raise_unorderable_types(ordering: string, a: unknown, b: unknown): never;
/** nltk.util.deprecated — decorator marking a callable deprecated (JS adaptation: wraps with a console.warn). */
declare function deprecated<T extends (...args: never[]) => unknown>(message: string, fn: T): T;
/** nltk.util.parallelize_preprocess — sequential fallback when processes <= 1 (JS runs single-process). */
declare function parallelize_preprocess<T, U>(func: (x: T) => U, iterator: Iterable<T>, _processes?: number, _progressBar?: boolean): Generator<U>;
type SliceLike = {
    start?: number | null;
    stop?: number | null;
    step?: number | null;
};
type Indexable = {
    length: number;
    [index: number]: unknown;
} | readonly unknown[];
/** nltk.internals.slice_bounds — resolve a slice to (start, stop[, step]) bounds. */
declare function slice_bounds(sequence: Indexable, sliceObj: SliceLike, allowStep?: boolean): [number, number] | [number, number, number];

/** Shared interactive-demo stub — NLTK demos are interactive scripts. */
declare function demo(): never;

/** nltk.tag.perceptron.open_datafile — opens a file inside an nltk_data resource. */
declare function open_datafile(path: PathPointer, fileName?: string, encoding?: string | null): SeekableUnicodeStreamReader;
/** nltk.classify.maxent.call_megam — requires the external megam binary. */
declare function call_megam(_args: string[]): never;
/** nltk.classify.maxent.call_tadm — requires the external tadm binary. */
declare function call_tadm(_args: string[]): never;
/** nltk.classify.maxent.train_maxent_classifier_with_megam — external binary path. */
declare function train_maxent_classifier_with_megam(): never;

/** nltk.tokenize.punkt.allowlisted_pickle_load — JSON-adapted params loader lands with the punkt object model. */
declare function allowlisted_pickle_load(_path: string): never;
/** nltk.tokenize.punkt.punkt_pickle_load — pickle entry point. */
declare function punkt_pickle_load(_path: string): never;
/** nltk.picklesec.pickle_load — CPython pickle deserialization entry point. */
declare function pickle_load(_file: unknown): never;
/** nltk.parse.chart.demo_grammar — lands with the chart demo batch. */
declare function demo_grammar(): never;
/** nltk.chunk.regexp.demo_eval — interactive demo. */
declare function demo_eval(): never;

declare class Fraction {
    readonly numerator: bigint;
    readonly denominator: bigint;
    constructor(numerator?: number | bigint | Fraction | string, denominator?: number | bigint);
    private static _fromString;
    private static _fromFloat;
    static from_float(f: number): Fraction;
    static from_decimal(dec: number | bigint): Fraction;
    static from_number(num: number | bigint | Fraction): Fraction;
    private _binop;
    add(other: Fraction | number | bigint): Fraction;
    sub(other: Fraction | number | bigint): Fraction;
    mul(other: Fraction | number | bigint): Fraction;
    truediv(other: Fraction | number | bigint): Fraction;
    neg(): Fraction;
    abs(): Fraction;
    eq(other: Fraction | number | bigint): boolean;
    compare(other: Fraction | number | bigint): number;
    is_integer(): boolean;
    as_integer_ratio(): [bigint, bigint];
    conjugate(): Fraction;
    limit_denominator(maxDenominator?: number | bigint): Fraction;
    toNumber(): number;
    valueOf(): number;
    toString(): string;
}

type Subst = [RegExp, string];
declare class NLTKWordTokenizer {
    static readonly STARTING_QUOTES: Subst[];
    static readonly ENDING_QUOTES: Subst[];
    static readonly PUNCTUATION: Subst[];
    static readonly PARENS_BRACKETS: Subst;
    static readonly CONVERT_PARENTHESES: Subst[];
    static readonly DOUBLE_DASHES: Subst;
    static readonly CONTRACTIONS2: RegExp[];
    static readonly CONTRACTIONS3: RegExp[];
    static readonly CONTRACTIONS4: RegExp[];
    tokenize(text: string, convertParentheses?: boolean, returnStr?: boolean): string[] | string;
    tokenize(text: string, convert_parentheses?: boolean, return_str?: boolean): string[] | string;
    span_tokenize(text: string): Generator<[number, number]>;
    spanTokenize(text: string): Generator<[number, number]>;
    tokenize_sents(strings: readonly string[]): string[][];
    span_tokenize_sents(strings: readonly string[]): Generator<[number, number][]>;
}

declare class SemError extends Error {
    constructor(message: string);
}
declare class Undefined extends SemError {
    constructor(message: string);
}
/** Port of nltk.sem.evaluate.trace: print "Calling <fn> with <args>" then return f(*args). */
declare function sem_trace<A extends unknown[], R>(f: (...args: A) => R, ...args: A): R;
/** Port of nltk.sem.evaluate.is_rel. */
declare function is_rel(s: Set<unknown>): boolean;
/** Port of nltk.sem.evaluate.set2rel. */
declare function set2rel(s: Set<unknown>): Set<unknown[]>;
/** Port of nltk.sem.evaluate.arity. */
declare function arity(rel: Set<unknown[]>): number;
/** Port of nltk.sem.evaluate.read_valuation. */
declare function read_valuation(s: string, encoding?: string): Valuation;
declare const readValuation: typeof read_valuation;

declare class UnparseableInputException extends Error {
    constructor(message: string);
}
declare class AbstractBoxerDrs {
    constructor();
}
declare class BoxerCard {
    constructor();
}
declare class BoxerDrs {
    constructor();
}
declare class BoxerDrsParser {
    constructor();
}
declare class BoxerEq {
    constructor();
}
declare class BoxerIndexed {
    constructor();
}
declare class BoxerNamed {
    constructor();
}
declare class BoxerNot {
    constructor();
}
declare class BoxerOr {
    constructor();
}
declare class BoxerOutputDrsParser {
    constructor();
}
declare class BoxerPred {
    constructor();
}
declare class BoxerProp {
    constructor();
}
declare class BoxerRel {
    constructor();
}
declare class BoxerWhq {
    constructor();
}
declare class NltkDrtBoxerDrsInterpreter {
    constructor();
}
declare class PassthroughBoxerDrsInterpreter {
    constructor();
}
declare function find_binary_iter(_name: string): never;
declare class DrsDrawer {
    constructor();
}
declare class CanvasFrame {
    constructor();
}
declare class DrsWidget {
    constructor();
}
declare class ShowText {
    constructor();
}
declare function test_draw(): never;
declare function decorator(): never;
declare function foldemo(): never;
declare function folmodel(): never;
declare function propdemo(): never;
declare function satdemo(): never;
declare function demo_read_depgraph(): never;

declare class DependencyGraphError extends Error {
    constructor(message: string);
}
interface DependencyNode {
    address: number;
    word: string | null;
    lemma: string | null;
    ctag: string | null;
    tag: string | null;
    feats: string | null;
    head: number | null;
    rel: string;
    deps: Record<string, number[]>;
}
type CellExtractor = (cells: string[]) => {
    number: number;
    word: string;
    lemma?: string;
    ctag?: string;
    tag?: string;
    feats?: string;
    head: number | null;
    rel: string;
};
declare class DependencyGraph {
    nodes: DependencyNode[];
    root: DependencyNode | null;
    stream: string[];
    cellSeparator: string;
    topRelationLabel: string;
    constructor(treeStr?: string, options?: {
        cellExtractor?: CellExtractor;
        zeroBased?: boolean;
        cellSeparator?: string;
        topRelationLabel?: string;
    });
    /** Port of DependencyGraph.load. */
    load(data: string | string[], options?: {
        cellExtractor?: CellExtractor;
        cellSeparator?: string;
        zeroBased?: boolean;
    }): void;
    private makeRootNode;
    get nodelist(): DependencyNode[];
    /** Port of DependencyGraph.to_conll: styles 3, 4 and 10. */
    to_conll(style?: 3 | 4 | 10): string;
    /** Port of DependencyGraph.triples: ((head word, ctag), rel, [(dep word, ctag)]). */
    triples(node?: DependencyNode | number): Generator<[[string | null, string | null], string, Array<[string | null, string | null]>]>;
    /** Port of DependencyGraph.add_arc. */
    add_arc(headAddress: number, modAddress: number): void;
    /** Port of DependencyGraph.remove_by_address. */
    remove_by_address(address: number): void;
    /**
     * Port of DependencyGraph.contains_cycle. NLTK quirk: for conll-loaded
     * graphs ``deps`` is a rel->addresses mapping, and the DFS iterates the
     * mapping (yielding rel names, not addresses); rel names are filtered by
     * the node-membership guard, so no cycle is ever reported. Only graphs
     * built with list-style deps can yield a cycle path. Returns the path
     * (possibly empty) like NLTK's list/None truthiness contract.
     */
    contains_cycle(): number[] | false;
    /** DFS over deps keys; see contains_cycle note for the dict-iteration quirk. */
    getCyclePath(): number[] | false;
    /** Port of DependencyGraph.connect_graph (attach cycle roots to node 0). */
    connect_graph(): void;
}

/** Ports of nltk.parse.util CONLL conversion helpers. */
/** Port of nltk.parse.util.taggedsent_to_conll: yields CONLL lines for one tagged sentence. */
declare function taggedsent_to_conll(sentence: Iterable<[string, string]>): Generator<string>;
declare const taggedSentToConll: typeof taggedsent_to_conll;
/** Port of nltk.parse.util.taggedsents_to_conll: emits a blank line after each sentence. */
declare function taggedsents_to_conll(sentences: Iterable<Iterable<[string, string]>>): Generator<string>;
declare const taggedSentsToConll: typeof taggedsents_to_conll;

declare const ARC_STANDARD = "arc-standard";
declare const ARC_EAGER = "arc-eager";
/** nltk.parse.transitionparser.Configuration — stack/buffer/arcs triple. */
declare class Configuration {
    stack: number[];
    buffer: number[];
    arcs: Array<[number, string, number]>;
    private readonly tokens;
    private readonly maxAddress;
    constructor(depGraph: DependencyGraph);
    get max_address(): number;
    private checkInformative;
    private arcDeps;
    /** Port of Configuration.extract_features (Kubler/McDonald/Nivre table 3.2). */
    extract_features(): string[];
    extractFeatures(): string[];
    toString(): string;
}
/** nltk.parse.transitionparser.Transition — arc-standard / arc-eager operators. */
declare class Transition {
    static readonly LEFT_ARC = "LEFTARC";
    static readonly RIGHT_ARC = "RIGHTARC";
    static readonly SHIFT = "SHIFT";
    static readonly REDUCE = "REDUCE";
    static readonly ARC_STANDARD = "arc-standard";
    static readonly ARC_EAGER = "arc-eager";
    private readonly algo;
    constructor(algOption: string);
    /** Mutates conf; returns -1 when the precondition fails (NLTK returns -1/None). */
    left_arc(conf: Configuration, relation: string): -1 | undefined;
    leftArc(conf: Configuration, relation: string): -1 | undefined;
    right_arc(conf: Configuration, relation: string): -1 | undefined;
    rightArc(conf: Configuration, relation: string): -1 | undefined;
    reduce(conf: Configuration): -1 | undefined;
    shift(conf: Configuration): -1 | undefined;
}
/** nltk.parse.projectivedependencyparser.DependencySpan. */
declare class DependencySpan {
    private readonly startIndex;
    private readonly endIndex;
    private readonly headIndex;
    private readonly arcs;
    private readonly tags;
    constructor(startIndex: number, endIndex: number, headIndex: number, arcs: readonly number[], tags: readonly string[]);
    head_index(): number;
    get start_index(): number;
    get end_index(): number;
    get span_arcs(): readonly number[];
    get span_tags(): readonly string[];
    /** The (start, end, head, tuple(arcs)) comparison key Python orders on. */
    comparisonTuple(): readonly [number, number, number, readonly number[]];
    /** Python __eq__ on the comparison key. */
    equals(other: unknown): boolean;
    /** Python __lt__ on the comparison key. */
    lessThan(other: DependencySpan): boolean;
    /** Deterministic identity used by ChartCell's Python set semantics. */
    comparisonKey(): string;
    repr(): string;
    toString(): string;
}
/** nltk.parse.projectivedependencyparser.ChartCell — dedups by span key like a Python set. */
declare class ChartCell {
    private readonly x;
    private readonly y;
    private readonly entries;
    constructor(x: number, y: number);
    add(span: DependencySpan): void;
    get size(): number;
    values(): DependencySpan[];
    toString(): string;
}
/** nltk.parse.nonprojectivedependencyparser.DependencyScorerI — abstract interface. */
declare class DependencyScorerI {
    constructor();
    train(_graphs: Iterable<DependencyGraph>): void;
    score(_graph: DependencyGraph): number[][][];
}
/** nltk.parse.nonprojectivedependencyparser.DemoScorer — fixed Keith Hall matrix. */
declare class DemoScorer extends DependencyScorerI {
    train(_graphs: Iterable<DependencyGraph>): void;
    score(_graph: DependencyGraph): number[][][];
}
/** nltk.parse.nonprojectivedependencyparser.NaiveBayesDependencyScorer. */
declare class NaiveBayesDependencyScorer extends DependencyScorerI {
    private classifier;
    train(graphs: Iterable<DependencyGraph>): void;
    score(graph: DependencyGraph): number[][][];
}
/** nltk.parse.pchart.ProbabilisticTreeEdge — TreeEdge carrying an edge probability. */
declare class ProbabilisticTreeEdge extends TreeEdge {
    private readonly probValue;
    constructor(prob: number, span: [number, number], lhs: GrammarSymbol, rhs: readonly GrammarSymbol[], dot?: number);
    prob(): number;
    key(): string;
    static from_production(production: Production, index: number, p?: number): ProbabilisticTreeEdge;
    static fromProduction(production: Production, index: number, p?: number): ProbabilisticTreeEdge;
    move_dot_forward(newEnd: number): ProbabilisticTreeEdge;
}
/** nltk.parse.pchart.ProbabilisticLeafEdge — prob() is always 1.0. */
declare class ProbabilisticLeafEdge extends LeafEdge {
    prob(): number;
}
/**
 * nltk.parse.pchart.ProbabilisticTree / nltk.parse.viterbi.ProbabilisticTree —
 * Tree + ProbabilisticMixIn; constructor follows the runtime-first Tree
 * adaptation (runtime, node, children, then {prob|logprob}).
 */
declare class ProbabilisticTree<L = string> extends Tree<L> {
    private probSlot;
    private logprobSlot;
    constructor(runtime: ParsingRuntime, node: string, children?: Iterable<Tree<L> | L>, probKwargs?: {
        prob?: number;
        logprob?: number;
    });
    set_prob(prob: number): void;
    setProb(prob: number): void;
    set_logprob(logprob: number): void;
    setLogprob(logprob: number): void;
    prob(): number | null;
    logprob(): number | null;
    static convert<L>(runtime: ParsingRuntime, value: Tree<L> | L): ProbabilisticTree<L> | L;
}
/** nltk.parse.util.extract_test_sentences — pure string parser. */
declare function extract_test_sentences(input: string | Uint8Array, commentChars?: string, encoding?: string): Array<[string[], boolean | number | null]>;
declare function extractTestSentences(input: string | Uint8Array, commentChars?: string, encoding?: string): Array<[string[], boolean | number | null]>;

declare class CoreNLPServerError extends Error {
    constructor(message: string);
}
declare class FeatStructNonterminal {
    constructor();
}
declare class FeatureChart {
    constructor();
}
declare class FeatureIncrementalChart {
    constructor();
}
declare class FeatureTreeEdge {
    constructor();
}
declare class InstantiateVarsChart {
    constructor();
}
declare class FeatureFundamentalRule {
    constructor();
}
declare class FeatureSingleEdgeFundamentalRule {
    constructor();
}
declare class FeatureBottomUpPredictRule {
    constructor();
}
declare class FeatureBottomUpPredictCombineRule {
    constructor();
}
declare class FeatureTopDownInitRule {
    constructor();
}
declare class FeatureTopDownPredictRule {
    constructor();
}
declare class FeatureEmptyPredictRule {
    constructor();
}
declare class FeatureScannerRule {
    constructor();
}
declare class FeaturePredictorRule {
    constructor();
}
declare class FeatureCompleterRule {
    constructor();
}
declare class FeatureCompleteFundamentalRule {
    constructor();
}
declare class FeatureBottomUpChartParser {
    constructor();
}
declare class FeatureBottomUpLeftCornerChartParser {
    constructor();
}
declare class FeatureTopDownChartParser {
    constructor();
}
declare class FeatureIncrementalChartParser {
    constructor();
}
declare class FeatureIncrementalBottomUpChartParser {
    constructor();
}
declare class FeatureIncrementalBottomUpLeftCornerChartParser {
    constructor();
}
declare class FeatureIncrementalTopDownChartParser {
    constructor();
}
declare class FeatureGrammar {
    constructor();
}
declare function find_variables(): never;
declare function unify(): never;
declare class IncrementalChart {
    constructor();
}
declare class IncrementalChartParser {
    constructor();
}
declare class IncrementalBottomUpChartParser {
    constructor();
}
declare class IncrementalBottomUpLeftCornerChartParser {
    constructor();
}
declare class IncrementalLeftCornerChartParser {
    constructor();
}
declare class IncrementalTopDownChartParser {
    constructor();
}
declare class PredictorRule {
    constructor();
}
declare class ScannerRule {
    constructor();
}
declare class CompleterRule {
    constructor();
}
declare class CompleteFundamentalRule {
    constructor();
}
declare class FilteredCompleteFundamentalRule {
    constructor();
}
declare class ProbabilisticFundamentalRule {
    constructor();
}
declare class SingleEdgeProbabilisticFundamentalRule {
    constructor();
}
declare class ProbabilisticBottomUpInitRule {
    constructor();
}
declare class ProbabilisticBottomUpPredictRule {
    constructor();
}
declare class BottomUpProbabilisticChartParser {
    constructor();
}
declare class InsideChartParser {
    constructor();
}
declare class LongestChartParser {
    constructor();
}
declare class RandomChartParser {
    constructor();
}
declare class UnsortedChartParser {
    constructor();
}
declare class ProjectiveDependencyParser {
    constructor();
}
declare class ProbabilisticProjectiveDependencyParser {
    constructor();
}
declare class NonprojectiveDependencyParser {
    constructor();
}
declare class ProbabilisticNonprojectiveParser {
    constructor();
}
declare class TestGrammar {
    constructor();
}

declare class SteppingRecursiveDescentParser {
    constructor();
}
declare class SteppingShiftReduceParser {
    constructor();
}
declare class CoreNLPServer {
    constructor();
}
declare class CoreNLPDependencyParser {
    constructor();
}
declare class GenericCoreNLPParser {
    constructor();
}

/** Real nltk.data.ZipFilePathPointer (re-exported to keep reviewed provenance). */
declare class ZipFilePathPointer extends ZipFilePathPointer$1 {
}
declare function find_jar_iter(): never;
declare function try_port(): never;
declare function transform(): never;
declare function find_dir(): never;
declare function find_jars_within_path(): never;
declare function find_malt_model(): never;
declare function find_maltparser(): never;
declare function malt_regex_tagger(): never;
declare function run_profile(): never;
declare function conll_demo(): never;
declare function conll_file_demo(): never;
declare function cycle_finding_demo(): never;
declare function dot2img(): never;
declare function malt_demo(): never;
declare function hall_demo(): never;
declare function nonprojective_conll_parse_demo(): never;
declare function rule_based_demo(): never;
declare function arity_parse_demo(): never;
declare function projective_prob_parse_demo(): never;
declare function projective_rule_parse_demo(): never;

type EncodingSpec = string | null | Record<string, string> | Array<[string, string]>;
declare class CorpusReader {
    protected _fileids: string[];
    protected _root: PathPointer;
    protected _readme: string;
    protected _license: string;
    protected _citation: string;
    protected _encoding: EncodingSpec;
    protected _tagset: string | null;
    constructor(root: string | PathPointer, fileids: string | string[], encoding?: EncodingSpec, tagset?: string | null);
    repr(): string;
    toString(): string;
    ensure_loaded(): void;
    ensureLoaded(): void;
    readme(): string;
    license(): string;
    citation(): string;
    fileids(): string[];
    abspath(fileid: string): PathPointer;
    abspaths(fileids?: string | string[] | null, includeEncoding?: boolean, includeFileid?: boolean): PathPointer[] | Array<[PathPointer, string | null]> | Array<[PathPointer, string | null, string]>;
    raw(fileids?: string | string[] | null): string;
    open(file: string): SeekableUnicodeStreamReader;
    encoding(file: string): string | null;
    get root(): PathPointer;
}
interface CategorizedInit {
    cat_pattern?: string;
    cat_map?: Record<string, string[]>;
    cat_file?: string;
    cat_delimiter?: string;
}
declare class CategorizedCorpusReaderBase extends CorpusReader {
    _catPattern: string | null;
    _catMap: Record<string, string[]> | null;
    _catFile: string | null;
    _catDelimiter: string | null;
    private _f2c;
    private _c2f;
    protected _initCategories(): void;
    categories(fileids?: string | string[] | null): string[];
    fileids(categories?: string | string[] | null): string[];
    _resolve(fileids: string | string[] | null | undefined, categories: string | string[] | null | undefined): string | string[] | null | undefined;
    rawWithCategories(fileids?: string | string[] | null, categories?: string | string[] | null): string;
}
declare class CategorizedCorpusReader extends CategorizedCorpusReaderBase {
    constructor(root: string | PathPointer, fileids: string | string[], encoding?: EncodingSpec, tagset?: string | null, catInit?: CategorizedInit);
}
declare class SyntaxCorpusReader extends CorpusReader {
    protected _parse(_s: string): unknown;
    protected _word(_s: string): unknown;
    protected _tag(_s: string, _tagset?: string | null): unknown;
    protected _read_block(_stream: SeekableUnicodeStreamReader): unknown[];
    protected _read_parsed_sent_block(stream: SeekableUnicodeStreamReader): unknown[];
    protected _read_tagged_sent_block(stream: SeekableUnicodeStreamReader, tagset?: string | null): unknown[];
    protected _read_sent_block(stream: SeekableUnicodeStreamReader): unknown[];
    protected _read_word_block(stream: SeekableUnicodeStreamReader): unknown[];
    protected _read_tagged_word_block(stream: SeekableUnicodeStreamReader, tagset?: string | null): unknown[];
    parsed_sents(fileids?: string | string[] | null): unknown;
    parsedSents(fileids?: string | string[] | null): unknown;
    tagged_sents(fileids?: string | string[] | null, tagset?: string | null): unknown;
    taggedSents(fileids?: string | string[] | null, tagset?: string | null): unknown;
    sents(fileids?: string | string[] | null): unknown;
    tagged_words(fileids?: string | string[] | null, tagset?: string | null): unknown;
    taggedWords(fileids?: string | string[] | null, tagset?: string | null): unknown;
    words(fileids?: string | string[] | null): unknown;
}
/** nltk.corpus.util.LazyCorpusLoader — defers corpus construction to first use. */
declare class LazyCorpusLoader {
    private readonly name;
    private readonly readerCls;
    private readonly kwargs;
    private loaded;
    private readonly subdir;
    constructor(name: string, readerCls: new (root: PathPointer, ...args: unknown[]) => CorpusReader, args?: unknown[], kwargs?: Record<string, unknown>);
    private _args;
    private load;
    /** Forwarded calls: materialize on first use, then delegate to the reader. */
    ensure_loaded(): void;
    ensureLoaded(): void;
    fileids(...args: unknown[]): unknown;
    raw(...args: unknown[]): unknown;
    words(...args: unknown[]): unknown;
    sents(...args: unknown[]): unknown;
    paras(...args: unknown[]): unknown;
    call(method: string, args?: unknown[]): unknown;
    get(): CorpusReader;
    repr(): string;
}

type BlockReader<T> = (stream: SeekableUnicodeStreamReader) => T[];
/** nltk.corpus.reader.util.StreamBackedCorpusView — lazily read token blocks. */
declare class StreamBackedCorpusView<T = unknown> extends AbstractLazySequence<T> {
    protected _fileid: string | PathPointer;
    protected _encoding: string | null;
    protected _stream: SeekableUnicodeStreamReader | null;
    protected _toknum: number[];
    protected _filepos: number[];
    protected _len: number | null;
    protected _eofpos: number;
    protected _cache: [number, number, T[] | null];
    _current_toknum: number | null;
    _current_blocknum: number | null;
    read_block: (stream: SeekableUnicodeStreamReader) => T[];
    constructor(fileid: string | PathPointer, blockReader?: BlockReader<T>, startpos?: number, encoding?: string | null);
    get fileid(): string | PathPointer;
    protected _open(): void;
    close(): void;
    get length(): number;
    get(index: number): T;
    /** Slice access (adaptation of __getitem__ slice -> LazySubsequence). */
    slice(start?: number, stop?: number): T[] | LazySubsequence<T>;
    iterate_from(startTok: number): Generator<T>;
    /** Concatenation helpers (adaptation of __add__/__mul__). */
    add(other: unknown): unknown;
    mul(count: number): unknown;
}
/** nltk.corpus.reader.util.concat — pick the right concatenation for doc types. */
declare function concat(docs: unknown[]): unknown;
/** 20 lines at a time, whitespace split. */
declare function read_whitespace_block(stream: SeekableUnicodeStreamReader): string[];
/** 20 lines at a time, wordpunct_tokenize. */
declare function read_wordpunct_block(stream: SeekableUnicodeStreamReader): string[];
/** 20 lines at a time, one token per line. */
declare function read_line_block(stream: SeekableUnicodeStreamReader): string[];
/** One paragraph (blank-line-separated) per block. */
declare function read_blankline_block(stream: SeekableUnicodeStreamReader): string[];
/** Aligned-corpus block: skips '=' lines and comment/blank lines, ends at \d+-\d+. */
declare function read_alignedsent_block(stream: SeekableUnicodeStreamReader): string[];
/** Tokens bounded by start_re / end_re line patterns. */
declare function read_regexp_block(stream: SeekableUnicodeStreamReader, startRe: string | RegExp, endRe?: string | RegExp): string[];
/** Read s-expressions one per block, doubling the read size as needed. */
declare function read_sexpr_block(stream: SeekableUnicodeStreamReader, blockSize?: number, commentChar?: string): string[];
/** nltk.corpus.reader.util.find_corpus_fileids — expand a regexp over a corpus root. */
declare function find_corpus_fileids(root: PathPointer, regexp: string): string[];

interface TextTokenizerLike {
    tokenize(text: string): string[];
}
declare class PlaintextCorpusReader extends CorpusReader {
    static CorpusView: typeof StreamBackedCorpusView;
    protected _word_tokenizer: TextTokenizerLike;
    protected _sent_tokenizer: TextTokenizerLike | null;
    protected _para_block_reader: BlockReader<string>;
    constructor(root: string | PathPointer, fileids: string | string[], wordTokenizer?: TextTokenizerLike, sentTokenizer?: TextTokenizerLike | null, paraBlockReader?: BlockReader<string>, encoding?: EncodingSpec);
    protected sentTokenizer(): TextTokenizerLike;
    protected _read_word_block(stream: SeekableUnicodeStreamReader): string[];
    protected _read_sent_block(stream: SeekableUnicodeStreamReader): string[][];
    protected _read_para_block(stream: SeekableUnicodeStreamReader): string[][][];
    words(fileids?: string | string[] | null): unknown;
    sents(fileids?: string | string[] | null): unknown;
    paras(fileids?: string | string[] | null): unknown;
}
declare class CategorizedPlaintextCorpusReader extends CategorizedCorpusReaderBase {
    private readonly _plain;
    constructor(root: string | PathPointer, fileids: string | string[], wordTokenizer?: TextTokenizerLike, sentTokenizer?: TextTokenizerLike | null, paraBlockReader?: BlockReader<string>, encoding?: EncodingSpec, catInit?: CategorizedInit);
    words(fileids?: string | string[] | null, categories?: string | string[] | null): unknown;
    sents(fileids?: string | string[] | null, categories?: string | string[] | null): unknown;
    paras(fileids?: string | string[] | null, categories?: string | string[] | null): unknown;
}
declare class PortugueseCategorizedPlaintextCorpusReader extends CategorizedPlaintextCorpusReader {
    constructor(root: string | PathPointer, fileids: string | string[], catInit?: CategorizedInit, encoding?: EncodingSpec);
}
declare class EuroparlCorpusReader extends PlaintextCorpusReader {
    protected _read_word_block(stream: SeekableUnicodeStreamReader): string[];
    protected _read_sent_block(stream: SeekableUnicodeStreamReader): string[][];
    protected _read_para_block(stream: SeekableUnicodeStreamReader): string[][][];
    chapters(fileids?: string | string[] | null): unknown;
    paras(_fileids?: string | string[] | null): unknown;
}
declare class WordListCorpusReader extends CorpusReader {
    words(fileids?: string | string[] | null, ignoreLinesStartswith?: string): string[];
}
declare class SwadeshCorpusReader extends WordListCorpusReader {
    entries(fileids?: string[] | null): string[][];
}
declare class NonbreakingPrefixesCorpusReader extends WordListCorpusReader {
    static readonly available_langs: Record<string, string>;
    readonly available_langs: Record<string, string>;
    words(lang?: string | null, fileids?: string | string[] | null, ignoreLinesStartswith?: string): string[];
}
declare class UnicharsCorpusReader extends WordListCorpusReader {
    static readonly available_categories: string[];
    readonly available_categories: string[];
    chars(category?: string | null, fileids?: string | string[] | null): string[];
}
declare class MWAPPDBCorpusReader extends WordListCorpusReader {
    static readonly mwa_ppdb_xxxl_file = "ppdb-1.0-xxxl-lexical.extended.synonyms.uniquepairs";
    entries(fileids?: string | string[] | null): string[][];
}
declare function read_cmudict_block(stream: SeekableUnicodeStreamReader): Array<[string, string[]]>;
declare class CMUDictCorpusReader extends CorpusReader {
    entries(): unknown;
    words(): string[];
    dict(): Map<string, string[][]>;
}
declare class TaggedCorpusView extends StreamBackedCorpusView<unknown> {
    private _tagged;
    private _group_by_sent;
    private _group_by_para;
    private _sep;
    private _word_tokenizer;
    private _sent_tokenizer;
    private _para_block_reader;
    private _tag_mapping_function;
    constructor(corpusFile: string | PathPointer, encoding: string | null, tagged: boolean, groupBySent: boolean, groupByPara: boolean, sep: string, wordTokenizer: TextTokenizerLike, sentTokenizer: TextTokenizerLike, paraBlockReader: BlockReader<string>, tagMappingFunction?: ((t: string) => string) | null);
    private readBlockImpl;
}
declare class TaggedCorpusReader extends CorpusReader {
    protected _sep: string;
    protected _word_tokenizer: TextTokenizerLike;
    protected _sent_tokenizer: TextTokenizerLike;
    protected _para_block_reader: BlockReader<string>;
    constructor(root: string | PathPointer, fileids: string | string[], sep?: string, wordTokenizer?: TextTokenizerLike, sentTokenizer?: TextTokenizerLike, paraBlockReader?: BlockReader<string>, encoding?: EncodingSpec, tagset?: string | null);
    private tagMapping;
    private view;
    words(fileids?: string | string[] | null): unknown;
    sents(fileids?: string | string[] | null): unknown;
    paras(fileids?: string | string[] | null): unknown;
    tagged_words(fileids?: string | string[] | null, tagset?: string | null): unknown;
    taggedWords(fileids?: string | string[] | null, tagset?: string | null): unknown;
    tagged_sents(fileids?: string | string[] | null, tagset?: string | null): unknown;
    taggedSents(fileids?: string | string[] | null, tagset?: string | null): unknown;
    tagged_paras(fileids?: string | string[] | null, tagset?: string | null): unknown;
    taggedParas(fileids?: string | string[] | null, tagset?: string | null): unknown;
}
declare class CategorizedTaggedCorpusReader extends TaggedCorpusReader {
    constructor(root: string | PathPointer, fileids: string | string[], sep?: string, wordTokenizer?: TextTokenizerLike, sentTokenizer?: TextTokenizerLike, paraBlockReader?: BlockReader<string>, encoding?: EncodingSpec, tagset?: string | null, catInit?: CategorizedInit);
    private _cat;
    categories(fileids?: string | string[] | null): string[];
    fileids(categories?: string | string[] | null): string[];
    protected resolve(fileids: string | string[] | null | undefined, categories: string | string[] | null | undefined): string | string[] | null | undefined;
    tagged_words_cats(fileids?: string | string[] | null, categories?: string | string[] | null, tagset?: string | null): unknown;
    tagged_sents_cats(fileids?: string | string[] | null, categories?: string | string[] | null, tagset?: string | null): unknown;
    tagged_paras_cats(fileids?: string | string[] | null, categories?: string | string[] | null, tagset?: string | null): unknown;
}
declare class MacMorphoCorpusReader extends TaggedCorpusReader {
    constructor(root: string | PathPointer, fileids: string | string[], encoding?: EncodingSpec, tagset?: string | null);
}
declare class TimitTaggedCorpusReader extends TaggedCorpusReader {
    constructor(root: string | PathPointer, fileids: string | string[], encoding?: EncodingSpec, tagset?: string | null);
    paras(): unknown;
    tagged_paras(): unknown;
}
/** nltk.corpus.reader.timit.read_timit_block — one sentence per block. */
declare function read_timit_block(stream: SeekableUnicodeStreamReader): string[];
declare class DependencyCorpusView extends StreamBackedCorpusView<unknown> {
    static readonly _DOCSTART = "-DOCSTART- -DOCSTART- O\n";
    private _tagged;
    private _dependencies;
    private _group_by_sent;
    constructor(corpusFile: string | PathPointer, tagged: boolean, groupBySent: boolean, dependencies: boolean, _chunkTypes?: unknown, encoding?: string | null);
    private readBlockImpl;
}
declare class DependencyCorpusReader extends SyntaxCorpusReader {
    private views;
    words(fileids?: string | string[] | null): unknown;
    tagged_words(fileids?: string | string[] | null): unknown;
    sents(fileids?: string | string[] | null): unknown;
    tagged_sents(fileids?: string | string[] | null): unknown;
    parsed_sents(fileids?: string | string[] | null): unknown;
}
declare class AlignedSentCorpusView extends StreamBackedCorpusView<unknown> {
    private _aligned;
    private _group_by_sent;
    private _word_tokenizer;
    private _sent_tokenizer;
    private _alignedsent_block_reader;
    constructor(corpusFile: string | PathPointer, encoding: string | null, aligned: boolean, groupBySent: boolean, wordTokenizer: TextTokenizerLike, sentTokenizer: TextTokenizerLike, alignedsentBlockReader: BlockReader<string>);
    private readBlockImpl;
}
declare class AlignedCorpusReader extends CorpusReader {
    constructor(root: string | PathPointer, fileids: string | string[], sep?: string, wordTokenizer?: TextTokenizerLike, sentTokenizer?: TextTokenizerLike, alignedsentBlockReader?: BlockReader<string> | null, encoding?: EncodingSpec);
    protected _sep: string;
    protected _word_tokenizer: TextTokenizerLike;
    protected _sent_tokenizer: TextTokenizerLike;
    protected _alignedsent_block_reader: BlockReader<string> | null;
    words(fileids?: string | string[] | null): unknown;
    sents(fileids?: string | string[] | null): unknown;
    aligned_sents(fileids?: string | string[] | null): unknown;
    alignedSents(fileids?: string | string[] | null): unknown;
}

type SimpleTreeChild = SimpleTree | string | [string, string | null];
declare class SimpleTree {
    label: string;
    children: SimpleTreeChild[];
    constructor(label: string, children?: Iterable<SimpleTreeChild>);
    /** nltk.tree.Tree.fromstring — parse a bracketed tree string. */
    static fromstring(s: string, options?: {
        remove_empty_top_bracketing?: boolean;
        brackets?: string;
    }): SimpleTree;
    get length(): number;
    get(i: number): SimpleTreeChild;
    [Symbol.iterator](): Iterator<SimpleTreeChild>;
    leaves(): Array<string | [string, string | null]>;
    /** NLTK Tree.pos(): (leaf, preterminal-label) pairs. */
    pos(): Array<[string, string | null]>;
    height(): number;
    flatten(): SimpleTree;
    repr(): string;
    toString(): string;
}
/** nltk.chunk.tagstr2tree — bracketed tagged text → Tree. */
declare function tagstr2tree(s: string, chunkLabel?: string, rootLabel?: string, sep?: string | null, sourceTagset?: string | null, targetTagset?: string | null): SimpleTree;

declare class BracketParseCorpusReader extends SyntaxCorpusReader {
    protected _comment_char: string | null;
    protected _detect_blocks: string;
    constructor(root: string | PathPointer, fileids: string | string[], commentChar?: string | null, detectBlocks?: string, encoding?: EncodingSpec, tagset?: string | null);
    protected _read_block(stream: SeekableUnicodeStreamReader): string[];
    protected _normalize(t: string): string;
    protected _parse(t: string): SimpleTree;
    protected _word(t: string): Array<string | [string, string | null]>;
    protected _tag(t: string, tagset?: string | null): Array<[string, string | null]>;
    protected _read_word_block(stream: SeekableUnicodeStreamReader): unknown[];
    parsed_words(fileids?: string | string[] | null): unknown;
    parsed_sents(fileids?: string | string[] | null): unknown;
    parsed_paras(fileids?: string | string[] | null): unknown;
    parsedWords(fileids?: string | string[] | null): unknown;
    parsedSents(fileids?: string | string[] | null): unknown;
    parsedParas(fileids?: string | string[] | null): unknown;
    protected _read_parsed_word_block(stream: SeekableUnicodeStreamReader): unknown[];
    corpus_sents(fileids?: string | string[] | null): unknown;
    corpusSents(fileids?: string | string[] | null): unknown;
}
declare class CategorizedBracketParseCorpusReader extends CategorizedCorpusReader {
    private _br;
    categories(fileids?: string | string[] | null): string[];
    private bracket;
    tagged_sents(fileids?: string | string[] | null, categories?: string | string[] | null, tagset?: string | null): unknown;
    parsed_sents(fileids?: string | string[] | null, categories?: string | string[] | null): unknown;
}
declare class ChunkedCorpusView extends StreamBackedCorpusView<unknown> {
    private _words;
    private _sents;
    private _paras;
    private _etag;
    private _str2chunktree;
    private _sent_tokenizer;
    private _para_block_reader;
    private _tagset;
    constructor(corpusFile: string | PathPointer, encoding: string | null, _words: boolean, _sents: boolean, _paras: boolean, _etag: boolean, _str2chunktree: (s: string) => SimpleTree, _sent_tokenizer: TextTokenizerLike, _para_block_reader: BlockReader<string>, _tagset?: string | null);
    private readBlockImpl;
}
declare class ChunkedCorpusReader extends CorpusReader {
    protected extension: string;
    protected _cv_args: [(s: string) => SimpleTree, TextTokenizerLike, BlockReader<string>, string | null];
    constructor(root: string | PathPointer, fileids: string | string[], extension?: string, str2chunktree?: (s: string) => SimpleTree, sentTokenizer?: TextTokenizerLike, paraBlockReader?: BlockReader<string>, encoding?: EncodingSpec, tagset?: string | null);
    private view;
    words(fileids?: string | string[] | null): unknown;
    sents(fileids?: string | string[] | null): unknown;
    paras(fileids?: string | string[] | null): unknown;
    tagged_words(fileids?: string | string[] | null, _tagset?: string | null): unknown;
    tagged_sents(fileids?: string | string[] | null, _tagset?: string | null): unknown;
    tagged_paras(fileids?: string | string[] | null, _tagset?: string | null): unknown;
    chunked_words(fileids?: string | string[] | null): unknown;
    chunked_sents(fileids?: string | string[] | null, _tagset?: string | null): unknown;
    chunked_paras(fileids?: string | string[] | null, _tagset?: string | null): unknown;
    chunkedSents(fileids?: string | string[] | null, tagset?: string | null): unknown;
    taggedSents(fileids?: string | string[] | null, tagset?: string | null): unknown;
    taggedWords(fileids?: string | string[] | null, tagset?: string | null): unknown;
    raw(fileids?: string | string[] | null): string;
}
declare class ConllChunkCorpusReader extends CorpusReader {
    private chunkTypes;
    private rootLabel;
    private tagset;
    private separator;
    constructor(root: string | PathPointer, fileids: string | string[], chunkTypes?: string[], rootLabel?: string, tagset?: string | null, encoding?: EncodingSpec, separator?: string | null);
    chunked_sents(fileids?: string | string[] | null, chunkTypes?: string[]): unknown;
    private readChunkedBlock;
    iob_words(fileids?: string | string[] | null): unknown;
    private readIobBlock;
}
/** nltk.chunk.conllstr2tree — CoNLL IOB grid → chunk tree. */
declare function conllstr2tree(s: string, chunkTypes?: string[], rootLabel?: string, separator?: string | null): SimpleTree;
declare class CategorizedSentencesCorpusReader extends CategorizedCorpusReader {
    private _tok;
    private _sentTokenizer;
    constructor(root: string | PathPointer, fileids: string | string[], wordTokenizer?: RegexpTokenizer | null, sentTokenizer?: TextTokenizerLike | null, encoding?: EncodingSpec, catInit?: CategorizedInit);
    words(fileids?: string | string[] | null, categories?: string | string[] | null): unknown;
    sents(fileids?: string | string[] | null, categories?: string | string[] | null): unknown;
    private readWordBlock;
    private readSentBlock;
}
declare class IgnoreReadmeCorpusView extends StreamBackedCorpusView<string> {
    constructor(corpusFile: string | PathPointer, encoding: string | null);
}
declare class OpinionLexiconCorpusReader extends CorpusReader {
    words(fileids?: string | string[] | null): unknown;
    positive(): string;
    negative(): string;
}
declare class SentiSynset {
    readonly synset_name: string;
    readonly pos: string;
    readonly id: number;
    readonly terms: string[];
    readonly gloss: string;
    readonly pos_score: number;
    readonly neg_score: number;
    readonly obj_score: number;
    constructor(synset_name: string, pos: string, id: number, posScore: number, negScore: number, terms: string[], gloss: string);
    get posScore(): number;
    get negScore(): number;
    get objScore(): number;
    get synsetName(): string;
    repr(): string;
}
declare class SentiWordNetCorpusReader extends CorpusReader {
    private _db;
    senti_synset(synsetOrName: {
        name?: () => string;
    } | string, _lang?: string): SentiSynset | null;
    senti_synsets(): SentiSynset[];
    private getSentiSynset;
    private parseFile;
    all_senti_synsets(): SentiSynset[];
}
declare class UdhrCorpusReader extends CorpusReader {
    private static readonly SKIP;
    raw(fileids?: string | string[] | null): string;
    words(fileids?: string | string[] | null): string[];
    langs(): string[];
}
declare class StringCategoryCorpusReader extends CorpusReader {
    private _delimiter;
    constructor(root: string | PathPointer, fileids: string | string[], encoding?: EncodingSpec, _delimiter?: string);
    tuples(fileids?: string | string[] | null): unknown;
    rawTuples(fileids?: string | string[] | null): unknown;
    private readTupleBlock;
    strings(fileids?: string | string[] | null): unknown;
}

declare const ENFORCE = true;
/** nltk.pathsec.is_private_dir — dir is safe to trust as a data root. */
declare function is_private_dir(path: string): boolean;
/**
 * nltk.pathsec.validate_path — ensure file access is restricted to allowed
 * data directories.  Throws PermissionError in ENFORCE mode.
 */
declare function validate_path(pathInput: string | number | {
    path: string;
} | null | undefined, context?: string, requiredRoot?: string | null): void;
/** nltk.pathsec.open — secure wrapper for file opens. Returns raw bytes. */
declare function pathsec_open(file: string | {
    path: string;
}, mode?: string, context?: string, requiredRoot?: string | null): Uint8Array;
/** nltk.pathsec.validate_zip_archive — reject unsafe zip members. */
declare function validate_zip_archive(names: string[], context?: string): void;
declare const zip_member_is_unsafe: (name: string) => boolean;

declare class AlpinoCorpusReader {
    constructor(..._a: unknown[]);
}
declare class AttrDict {
    constructor(..._a: unknown[]);
}
declare class BCP47CorpusReader {
    constructor(..._a: unknown[]);
}
declare class BNCCorpusReader {
    constructor(..._a: unknown[]);
}
declare class BNCSentence {
    constructor(..._a: unknown[]);
}
declare class BNCWordView {
    constructor(..._a: unknown[]);
}
declare class BufferedGzipFile {
    constructor(..._a: unknown[]);
}
declare class CHILDESCorpusReader {
    constructor(..._a: unknown[]);
}
declare class CategorizedMarkdownCorpusReader {
    constructor(..._a: unknown[]);
}
declare class ChasenCorpusReader {
    constructor(..._a: unknown[]);
}
declare class ChasenCorpusView {
    constructor(..._a: unknown[]);
}
declare class CodeBlock {
    constructor(..._a: unknown[]);
}
declare class ComparativeSentencesCorpusReader {
    constructor(..._a: unknown[]);
}
declare class Comparison {
    constructor(..._a: unknown[]);
}
declare class ConcatenatedCorpusView {
    constructor(..._a: unknown[]);
}
declare class ConllCorpusReader {
    constructor(..._a: unknown[]);
}
declare class ConllSRLInstance {
    constructor(..._a: unknown[]);
}
declare class ConllSRLInstanceList {
    constructor(..._a: unknown[]);
}
declare class CrubadanCorpusReader {
    constructor(..._a: unknown[]);
}
declare class Deprecated {
    constructor(..._a: unknown[]);
}
declare class ElementWrapper {
    constructor(..._a: unknown[]);
}
declare class FramenetCorpusReader {
    constructor(..._a: unknown[]);
}
declare class FramenetError {
    constructor(..._a: unknown[]);
}
declare class Future {
    constructor(..._a: unknown[]);
}
declare class IEERCorpusReader {
    constructor(..._a: unknown[]);
}
declare class IEERDocument {
    constructor(..._a: unknown[]);
}
declare class IPIPANCorpusReader {
    constructor(..._a: unknown[]);
}
declare class IPIPANCorpusView {
    constructor(..._a: unknown[]);
}
declare class Image {
    constructor(..._a: unknown[]);
}
declare class IndianCorpusReader {
    constructor(..._a: unknown[]);
}
declare class IndianCorpusView {
    constructor(..._a: unknown[]);
}
declare class KNBCorpusReader {
    constructor(..._a: unknown[]);
}
declare class LinThesaurusCorpusReader {
    constructor(..._a: unknown[]);
}
declare class Link {
    constructor(..._a: unknown[]);
}
declare class List {
    constructor(..._a: unknown[]);
}
declare class MTECorpusReader {
    constructor(..._a: unknown[]);
}
declare class MTECorpusView {
    constructor(..._a: unknown[]);
}
declare class MTEFileReader {
    constructor(..._a: unknown[]);
}
declare class MTETagConverter {
    constructor(..._a: unknown[]);
}
declare class MarkdownBlock {
    constructor(..._a: unknown[]);
}
declare class MarkdownCorpusReader {
    constructor(..._a: unknown[]);
}
declare class MarkdownSection {
    constructor(..._a: unknown[]);
}
declare class Meaning {
    constructor(..._a: unknown[]);
}
declare class NKJPCorpusReader {
    constructor(..._a: unknown[]);
}
declare class NKJPCorpus_Header_View {
    constructor(..._a: unknown[]);
}
declare class NKJPCorpus_Morph_View {
    constructor(..._a: unknown[]);
}
declare class NKJPCorpus_Segmentation_View {
    constructor(..._a: unknown[]);
}
declare class NKJPCorpus_Text_View {
    constructor(..._a: unknown[]);
}
declare class NPSChatCorpusReader {
    constructor(..._a: unknown[]);
}
declare class NombankChainTreePointer {
    constructor(..._a: unknown[]);
}
declare class NombankCorpusReader {
    constructor(..._a: unknown[]);
}
declare class NombankInstance {
    constructor(..._a: unknown[]);
}
declare class NombankPointer {
    constructor(..._a: unknown[]);
}
declare class NombankSplitTreePointer {
    constructor(..._a: unknown[]);
}
declare class NombankTreePointer {
    constructor(..._a: unknown[]);
}
declare class PPAttachment {
    constructor(..._a: unknown[]);
}
declare class PPAttachmentCorpusReader {
    constructor(..._a: unknown[]);
}
declare class PanLexLiteCorpusReader {
    constructor(..._a: unknown[]);
}
declare class PanlexLanguage {
    constructor(..._a: unknown[]);
}
declare class PanlexSwadeshCorpusReader {
    constructor(..._a: unknown[]);
}
declare class Pl196xCorpusReader {
    constructor(..._a: unknown[]);
}
declare class PrettyDict {
    constructor(..._a: unknown[]);
}
declare class PrettyLazyConcatenation {
    constructor(..._a: unknown[]);
}
declare class PrettyLazyIteratorList {
    constructor(..._a: unknown[]);
}
declare class PrettyLazyMap {
    constructor(..._a: unknown[]);
}
declare class PrettyList {
    constructor(..._a: unknown[]);
}
declare class PropbankChainTreePointer {
    constructor(..._a: unknown[]);
}
declare class PropbankCorpusReader {
    constructor(..._a: unknown[]);
}
declare class PropbankInflection {
    constructor(..._a: unknown[]);
}
declare class PropbankInstance {
    constructor(..._a: unknown[]);
}
declare class PropbankPointer {
    constructor(..._a: unknown[]);
}
declare class PropbankSplitTreePointer {
    constructor(..._a: unknown[]);
}
declare class PropbankTreePointer {
    constructor(..._a: unknown[]);
}
declare class ProsConsCorpusReader {
    constructor(..._a: unknown[]);
}
declare class RTECorpusReader {
    constructor(..._a: unknown[]);
}
declare class RTEPair {
    constructor(..._a: unknown[]);
}
declare class ReadError {
    constructor(..._a: unknown[]);
}
declare class Review {
    constructor(..._a: unknown[]);
}
declare class ReviewLine {
    constructor(..._a: unknown[]);
}
declare class ReviewsCorpusReader {
    constructor(..._a: unknown[]);
}
declare class SemcorCorpusReader {
    constructor(..._a: unknown[]);
}
declare class SemcorSentence {
    constructor(..._a: unknown[]);
}
declare class SemcorWordView {
    constructor(..._a: unknown[]);
}
declare class SensevalCorpusReader {
    constructor(..._a: unknown[]);
}
declare class SensevalCorpusView {
    constructor(..._a: unknown[]);
}
declare class SensevalInstance {
    constructor(..._a: unknown[]);
}
declare class SinicaTreebankCorpusReader {
    constructor(..._a: unknown[]);
}
declare class SpeakerInfo {
    constructor(..._a: unknown[]);
}
declare class SpecialList {
    constructor(..._a: unknown[]);
}
declare class SwitchboardCorpusReader {
    constructor(..._a: unknown[]);
}
declare class SwitchboardTurn {
    constructor(..._a: unknown[]);
}
declare class TEICorpusView {
    constructor(..._a: unknown[]);
}
declare class TimitCorpusReader {
    constructor(..._a: unknown[]);
}
declare class ToolboxCorpusReader {
    constructor(..._a: unknown[]);
}
declare class TwitterCorpusReader {
    constructor(..._a: unknown[]);
}
declare class UntrustedJarError {
    constructor(..._a: unknown[]);
}
declare class VerbnetCorpusReader {
    constructor(..._a: unknown[]);
}
declare class XMLCorpusReader {
    constructor(..._a: unknown[]);
}
declare class XMLCorpusView {
    constructor(..._a: unknown[]);
}
declare class XML_Tool {
    constructor(..._a: unknown[]);
}
declare class YCOECorpusReader {
    constructor(..._a: unknown[]);
}
declare class YCOEParseCorpusReader {
    constructor(..._a: unknown[]);
}
declare class YCOETaggedCorpusReader {
    constructor(..._a: unknown[]);
}
declare class ZipFile {
    constructor(..._a: unknown[]);
}
declare class comma_separated_string_args {
    constructor(..._a: unknown[]);
}
declare class error {
    constructor(..._a: unknown[]);
}
declare class find_file_iter {
    constructor(..._a: unknown[]);
}
declare class import_from_stdlib {
    constructor(..._a: unknown[]);
}
declare class is_writable {
    constructor(..._a: unknown[]);
}
declare class mimic_wrap {
    constructor(..._a: unknown[]);
}
declare class norm {
    constructor(..._a: unknown[]);
}
declare class read_int {
    constructor(..._a: unknown[]);
}
declare class read_number {
    constructor(..._a: unknown[]);
}
declare class read_parse_blankline_block {
    constructor(..._a: unknown[]);
}
declare class read_str {
    constructor(..._a: unknown[]);
}
declare class restricted_pickle_load {
    constructor(..._a: unknown[]);
}
declare class retrieve {
    constructor(..._a: unknown[]);
}
declare class safe_parse {
    constructor(..._a: unknown[]);
}
declare class sinica_parse {
    constructor(..._a: unknown[]);
}
declare class switch_chunker {
    constructor(..._a: unknown[]);
}
declare class switch_p_tagger {
    constructor(..._a: unknown[]);
}
declare class switch_punkt {
    constructor(..._a: unknown[]);
}
declare class switch_t_tagger {
    constructor(..._a: unknown[]);
}
declare class tagged_treebank_para_block_reader {
    constructor(..._a: unknown[]);
}
declare class test {
    constructor(..._a: unknown[]);
}
declare class urlopen {
    constructor(..._a: unknown[]);
}
declare class validate_network_url {
    constructor(..._a: unknown[]);
}
declare class xpath {
    constructor(..._a: unknown[]);
}

declare function getinfo(..._a: unknown[]): never;
declare function new_wrapper(..._a: unknown[]): never;
declare class HFDatasetPathPointer {
    constructor(..._a: unknown[]);
}
declare function hf_download(..._a: unknown[]): never;
declare function hf_load_data(..._a: unknown[]): never;
declare function toolbox_demo(..._a: unknown[]): never;
declare function chatbots(..._a: unknown[]): never;
declare function chat_demo(..._a: unknown[]): never;
declare function outf_writer_compat(..._a: unknown[]): never;
declare class TweetHandlerI {
    constructor(..._a: unknown[]);
}
declare class BasicTweetHandler {
    constructor(..._a: unknown[]);
}
declare class LocalTimezoneOffsetWithUTC {
    constructor(..._a: unknown[]);
}

/** nltk.compat.add_py3_data — insert '/PY3' after a known legacy path segment. */
declare function add_py3_data(path: string): string;
/** nltk.compat.py3_data — decorator rewriting the second arg through add_py3_data. */
declare function py3_data<F extends (...args: never[]) => unknown>(init_func: F): F;

export { MAX_ALIGN_INPUT_LEN as ALINE_MAX_INPUT_LEN, ANY_TYPE, APP, ARC_EAGER, ARC_STANDARD, ARLSTem, ARLSTem2, AbsoluteDiscounting, AbsoluteDiscountingInterpolated, AbstractBoxerDrs, AbstractCCGCategory, AbstractChartRule, AbstractLazySequence, AbstractVariableExpression, AffixTagger, Agenda, AlignedCorpusReader, AlignedSent, AlignedSentCorpusView, Alignment, AlignmentInfo, AllExpression, AlpinoCorpusReader, AnaphoraBudget, AnaphoraResolutionException, AndExpression, AnnotationTask, AnyType, ApplicationExpression$1 as ApplicationExpression, ApplicationRuleSet, ArabicStemmer, Assignment, AttrDict, AveragedPerceptron, BCP47CorpusReader, BLOCK_COMPARISON, BNCCorpusReader, BNCSentence, BNCWordView, BU_LC_STRATEGY, BU_STRATEGY, BackwardApplication, BackwardBx, BackwardCombinator, BackwardComposition, BackwardSx, BackwardT, BackwardTypeRaiseRule, BaseModelBuilderCommand, BaseProverCommand, BaseTheoremToolCommand, BasicTweetHandler, BasicType, BigramAssocMeasures, BigramCollocationFinder, BigramTagger, BinaryCombinatorRule, BinaryExpression, BinaryMaxentFeatureEncoding, BindingDict, BindingException, BllipParser, BooleanExpression, BottomUpChartParser, BottomUpLeftCornerChartParser, BottomUpPredictCombineRule, BottomUpPredictRule, BottomUpProbabilisticChartParser, Boxer, BoxerCard, BoxerDrs, BoxerDrsParser, BoxerEq, BoxerIndexed, BoxerNamed, BoxerNot, BoxerOr, BoxerOutputDrsParser, BoxerPred, BoxerProp, BoxerRel, BoxerWhq, BracketParseCorpusReader, BrillTagger, BrillTaggerTrainer, BrillTemplateI, BufferedGzipFile, CCGCat, CCGChart, CCGChartParser, CCGEdge, CCGLeafEdge, CCGLexicon, CCGTree, CCGVar, CFG, CHILDESCorpusReader, CMUDictCorpusReader, CRFTagger, CachedTopDownPredictRule, CanvasFrame, Categories, CategorizedBracketParseCorpusReader, CategorizedCorpusReader, CategorizedCorpusReaderBase, CategorizedMarkdownCorpusReader, CategorizedPlaintextCorpusReader, CategorizedSentencesCorpusReader, CategorizedTaggedCorpusReader, type CfgGrammar, CfgReadingCommand, Chart, ChartCell, ChartParser, AbstractChartRule as ChartRuleI, ChasenCorpusReader, ChasenCorpusView, Chat$1 as Chat, Chat80CorpusReader, ChunkRule, ChunkRuleWithContext, ChunkScore, ChunkString, ChunkedCorpusReader, ChunkedCorpusView, CistemStemmer as Cistem, CistemStemmer, ClassifierBasedPOSTagger, ClassifierBasedTagger, ClassifierI, Clause, ClosedDomainProver, ClosedWorldProver, ClusterI, CodeBlock, Collection, ComparativeSentencesCorpusReader, Comparison, CompleteFundamentalRule, CompleterRule, ComplexType, CompositionRuleSet, ConcatenatedCorpusView, Concept, ConcordanceIndex, ConditionalExponentialClassifier, ConditionalExponentialTextClassifier, ConditionalFreqDist, ConditionalProbDist, Configuration, ConfusionMatrix, ConllChunkCorpusReader, ConllCorpusReader, ConllSRLInstance, ConllSRLInstanceList, ConstantExpression$1 as ConstantExpression, Constants, Constraint, ContextIndex, ContextTagger, CooperStore, CoreNLPDependencyParser, CoreNLPParser, CoreNLPServer, CoreNLPServerError, CorpusReader$1 as CorpusReader, Counter$1 as Counter, Counts, CrossValidationProbDist, CrubadanCorpusReader, CutoffChecker, DEFAULT_NE_GRAMMAR, DRS, DanishStemmer, DebugObject, DecisionTreeClassifier, DecisionTreeTextClassifier, DefaultRuleSet, DefaultTagger, DemoScorer, Dendrogram, DendrogramNode, DependencyCorpusReader, DependencyCorpusView, DependencyEvaluator, DependencyGraph, DependencyGraphError, DependencyScorerI, DependencySpan, Deprecated, DictionaryProbDist, DirectedBinaryCombinator, Direction, DiscourseTester, Downloader, ErrorMessage as DownloaderErrorMessage, DownloaderGUI, DownloaderMessage, ProgressMessage as DownloaderProgressMessage, DownloaderShell, DrsDrawer, DrsWidget, DrtAbstractVariableExpression, DrtApplicationExpression, DrtBinaryExpression, DrtConcatenation, DrtConstantExpression, DrtEqualityExpression, DrtEventVariableExpression, DrtExpression, DrtFunctionVariableExpression, DrtGlue, DrtGlueDemo, DrtGlueDict, DrtGlueFormula, DrtGlueReadingCommand, DrtIndividualVariableExpression, DrtLambdaExpression, DrtNegatedExpression, DrtOrExpression, DrtParser, DrtParserFromString, DrtProposition, DrtTokens, DrtVariableExpression, DutchStemmer, EMClusterer, ENFORCE, ENTITY_TYPE, EVENT_TYPE, EarleyChartParser, EdgeI, ElementWrapper, EmptyPredictRule, EnglishStemmer, EntityType, EqualityExpression, ErrorMessage, EuroparlCorpusReader, EventType, EventVariableExpression, ExistsExpression, ExpandLeftRule, ExpandRightRule, ExpectedMoreTokensException, Expression$1 as Expression, FStructure, FeatStruct, FeatStructNonterminal, TblFeature as Feature, FeatureBottomUpChartParser, FeatureBottomUpLeftCornerChartParser, FeatureBottomUpPredictCombineRule, FeatureBottomUpPredictRule, FeatureCFG, FeatureChart, FeatureChartParser, FeatureCompleteFundamentalRule, FeatureCompleterRule, FeatureEarleyChartParser, FeatureEmptyPredictRule, FeatureFundamentalRule, FeatureGrammar, FeatureIncrementalBottomUpChartParser, FeatureIncrementalBottomUpLeftCornerChartParser, FeatureIncrementalChart, FeatureIncrementalChartParser, FeatureIncrementalTopDownChartParser, type FeatureMaxentOptions, FeaturePredictorRule, FeatureScannerRule, type FeatureSet, FeatureSingleEdgeFundamentalRule, FeatureTopDownChartParser, FeatureTopDownInitRule, FeatureTopDownPredictRule, FeatureTreeEdge, type FeatureTreeOptions, FeaturesetTaggerI, FileSystemPathPointer, FilteredBottomUpPredictCombineRule, FilteredCompleteFundamentalRule, FilteredSingleEdgeFundamentalRule, FinishCollectionMessage, FinishDownloadMessage, FinishPackageMessage, FinishUnzipMessage, FinnishStemmer, ForwardApplication, ForwardCombinator, ForwardComposition, ForwardSubstitution, ForwardT, ForwardTypeRaiseRule, Fraction, FramenetCorpusReader, FramenetError, FrenchStemmer, FreqDist, FunctionBackedMaxentFeatureEncoding, FunctionVariableExpression, FunctionalCategory, FundamentalRule, Future, GAACClusterer, GAACluster, GAAClusterer, GISEncoding, LanguageIndependent as GaleChurchLanguageIndependent, GenericCoreNLPParser, GermanStemmer, Glue, GlueDict, GlueFormula, type GrammarSymbol, GzipFileSystemPathPointer, HFDatasetPathPointer, HeldoutProbDist, HiddenMarkovModelTagger, HiddenMarkovModelTrainer, HoleSemantics, HoleSemantics as HoleSemanticsClass, HunPosTagger, HungarianStemmer, HunposTagger, Counts as IBMCounts, IBMModelBase as IBMModel, IBMModel1, IBMModel2, IBMModel3, IBMModel4, IBMModel5, MIN_PROB as IBM_MIN_PROB, IEERCorpusReader, IEERDocument, IPIPANCorpusReader, IPIPANCorpusView, ISRIStemmer, ISRI_STOP_WORDS, IffExpression, IgnoreReadmeCorpusView, IllegalTypeException, Image, ImmutableProbabilisticMixIn, ImmutableTree, ImpExpression, InconsistentTypeHierarchyException, IncrementalBottomUpChartParser, IncrementalBottomUpLeftCornerChartParser, IncrementalChart, IncrementalChartParser, IncrementalLeftCornerChartParser, IncrementalTopDownChartParser, Index, IndianCorpusReader, IndianCorpusView, IndividualVariableExpression, InsideChartParser, InstantiateVarsChart, InterpolatedLanguageModel, IotaExpression, ItalianStemmer, KMeansClusterer, KNBCorpusReader, KneserNey, KneserNeyInterpolated, KneserNeyProbDist, LC_STRATEGY, type LabeledFeatureset, LambdaExpression, LancasterStemmer, LanguageIndependent, LanguageModel, Laplace, LazyConcatenation, LazyCorpusLoader, LazyEnumerate, LazyIteratorList, LazyLoader, LazyMap, LazySubsequence, LazyZip, LeafEdge, LeafInitRule, LeftCornerChartParser, LegalitySyllableTokenizer, Lemma, Lidstone, LinThesaurusCorpusReader, Atom as LinearAtom, AtomicExpression as LinearAtomicExpression, GlueFormula$1 as LinearGlueFormula, LinearLogicApplicationException, LinearLogicParser, LinearSvmTextClassifier, Link, List, LocalTimezoneOffsetWithUTC, ImpExpression$1 as LogicImpExpression, LogicParser, LogicalExpressionException, LogisticTextClassifier, LongestChartParser, MAX_ALIGN_BLOCKS, MAX_ANAPHORA_OPERATIONS, MAX_EVERYGRAMS_DEFAULT_LEN, MAX_GENERATE_OPERATIONS, MAX_PARSE_TREES, MAX_PHRASE_EXTRACTION_DEFAULT_LEN, MAX_SIMPLIFY_SIZE, MLE, MTECorpusReader, MTECorpusView, MTEFileReader, MTETagConverter, MWAPPDBCorpusReader, MacMorphoCorpusReader, Mace, MaceCommand, MaltParser, MarkdownBlock, MarkdownCorpusReader, MarkdownSection, MaxEntTextClassifier, MaxentClassifier, type MaxentEncodingOptions, MaxentFeatureEncodingI, type MaxentFeatureMapping, type MaxentMappingValue, Meaning, MegamMaxentClassifier, MergeRule, MinimalSet, Model, Model2Counts, Model3Counts, Model4Counts, Model5Counts, ModelBuilder, ModelBuilderCommand, ModelBuilderCommandDecorator, NE_CLASSES, NISTTokenizer, NKJPCorpusReader, NKJPCorpus_Header_View, NKJPCorpus_Morph_View, NKJPCorpus_Segmentation_View, NKJPCorpus_Text_View, CorpusReader as NLTKCorpusReader, NLTKWordTokenizer, NPSChatCorpusReader, NaiveBayesClassifier, NaiveBayesDependencyScorer, NaiveBayesTextClassifier, NativeFreqDistStream, NegatedExpression, NgramCounter, NgramTagger, NltkDrtBoxerDrsInterpreter, NombankChainTreePointer, NombankCorpusReader, NombankInstance, NombankPointer, NombankSplitTreePointer, NombankTreePointer, NonbreakingPrefixesCorpusReader, ProverParseError as NonmonotonicProverParseError, NonprojectiveDependencyParser, Nonterminal, NorwegianStemmer, OpenOnDemandZipFile, OpinionLexiconCorpusReader, OrExpression, OrderedDict, PCFG, PPAttachment, PPAttachmentCorpusReader, Package, Paice, PanLexLiteCorpusReader, PanlexLanguage, PanlexSwadeshCorpusReader, ParExpression, ParallelProverBuilder, ParallelProverBuilderCommand, ParentedTree, type ParseTree, ParserI, ParsingRuntime, PassthroughBoxerDrsInterpreter, PathPointer, type PcfgGrammar, PerceptronTagger, PerceptronTextClassifier, PhraseTable, PhraseTableEntry, Pl196xCorpusReader, PlaintextCorpusReader, PorterStemmer, PortugueseCategorizedPlaintextCorpusReader, PortugueseStemmer, Pos, type PositiveFeatureOptions, PositiveNaiveBayesClassifier, PositiveNaiveBayesTextClassifier, PossibleAntecedents, PredHolder, PredictorRule, PrettyDict, PrettyLazyConcatenation, PrettyLazyIteratorList, PrettyLazyMap, PrettyList, PrimitiveCategory, type ProbDistLike, ProbabilisticBottomUpInitRule, ProbabilisticBottomUpPredictRule, ProbabilisticFundamentalRule, ProbabilisticLeafEdge, ProbabilisticMixIn, ProbabilisticNonprojectiveParser, type ProbabilisticParse, ProbabilisticProjectiveDependencyParser, ProbabilisticTree, ProbabilisticTreeEdge, Production, ProgressMessage, ProjectiveDependencyParser, PropbankChainTreePointer, PropbankCorpusReader, PropbankInflection, PropbankInstance, PropbankPointer, PropbankSplitTreePointer, PropbankTreePointer, ProsConsCorpusReader, Prover, Prover9, Prover9Command, Prover9CommandParent, Prover9Exception, Prover9FatalException, Prover9LimitExceededException, Prover9Parent, ProverCommand, ProverCommandDecorator, PunktBaseClass, PunktLanguageVars, PunktParameters, PunktSentenceTokenizer, PunktToken, PunktTokenizer, PunktTrainer, PythonRandom, QuadgramAssocMeasures, QuadgramCollocationFinder, QuantifiedExpression, RSLPStemmer, RTECorpusReader, RTEPair, RandomChartParser, ReadError, ReadingCommand, RecursiveDescentParser, RegexpChunkParser, RegexpChunkRule, RegexpParser, RegexpStemmer, RegexpTagger, RegexpTokenizer, ReppTokenizer, ResolutionProver, ResolutionProverCommand, ProverParseError$2 as ResolutionProverParseError, Review, ReviewLine, ReviewsCorpusReader, RomanianStemmer, RteClassifier, TblRule as Rule, RussianStemmer, RustDecisionTreeClassifier, RustMaxentClassifier, RustNaiveBayesClassifier, SEM_PACKAGE, SExprTokenizer, SNOWBALL_LANGUAGES, STEM_PACKAGE, ScannerRule, SeekableUnicodeStreamReader, SelectDownloadDirMessage, SemError, LogicParser as SemLogicParser, SemcorCorpusReader, SemcorSentence, SemcorWordView, Senna, SennaChunkTagger, SennaClassifier, SennaNERTagger, SennaTagger, SensevalCorpusReader, SensevalCorpusView, SensevalInstance, SentiSynset, SentiText, SentiWordNetCorpusReader, SentimentAnalyzer, SentimentIntensityAnalyzer, SequentialBackoffTagger, SetHolder, ShiftReduceParser, ShowText, SimpleTree, SingleEdgeFundamentalRule, SingleEdgeProbabilisticFundamentalRule, SinicaTreebankCorpusReader, SklearnClassifier, Slots, Smoothing, type SNOWBALL_LANGUAGES as SnowballLanguages, SnowballStemmer, SpanishStemmer, SpeakerInfo, SpecialList, SplitRule, StackDecoder, StaleMessage, StandardFormat, StanfordNERTagger, StanfordPOSTagger, StanfordParser, StanfordSegmenter, StanfordTagger, StanfordTokenizer, StartCollectionMessage, StartDownloadMessage, StartPackageMessage, StartUnzipMessage, StemmerI, SteppingChartParser, SteppingRecursiveDescentParser, SteppingShiftReduceParser, StreamBackedCorpusView, StringCategoryCorpusReader, StripRule, StupidBackoff, SubstituteBindingsI, SubstitutionRuleSet, SvmClassifier, SwadeshCorpusReader, SwedishStemmer, SwitchboardCorpusReader, SwitchboardTurn, SyllableTokenizer, Synset, SyntaxCorpusReader, TAG_PACKAGE, TBL_PACKAGE, TD_STRATEGY, TEICorpusView, TRANSLATE_PACKAGE, TRUTH_TYPE, HC as TT_HC, LC as TT_LC, Debug as TableauDebug, TableauProver, TableauProverCommand, ProverParseError$1 as TableauProverParseError, TadmEventMaxentFeatureEncoding, TadmMaxentClassifier, TagRule, TaggedCorpusReader, TaggedCorpusView, TaggerI, TblFeature, TblRule, Template, TestGrammar, Text, TextCat, TextCollection, TextFeatureVectorizer, TextTilingTokenizer, TheoremToolCommand, TheoremToolCommandDecorator, TheoremToolThread, TimitCorpusReader, TimitTaggedCorpusReader, TnT, Token, TokenSearcher, TokenizerI, Tokens, ToolboxCorpusReader, ToolboxData, ToolboxElement, ToolboxSettings, TopDownChartParser, TopDownInitRule, TopDownPredictRule, Transition, TransitionParser, Tree, TreeEdge, TreePrettyPrinter, Trie, TrigramAssocMeasures, TrigramCollocationFinder, TrigramTagger, TruthValueType, TweetHandlerI, TwitterCorpusReader, Type, TypeException, TypeRaiseRuleSet, TypeResolutionException, UdhrCorpusReader, UnChunkRule, Undefined, UndefinedError, UndirectedBinaryCombinator, UndirectedComposition, UndirectedFunctionApplication, UndirectedSubstitution, UndirectedTypeRaise, UnexpectedTokenException, UnicharsCorpusReader, UnificationException, UnigramTagger, UniqueNamesProver, UnparseableInputException, UnsortedChartParser, UntrustedJarError, UpToDateMessage, VOCABULARY_INTRODUCTION, VaderConstants, Valuation, Variable, VariableBinderExpression, VariableBindingException, VariableExpression$1 as VariableExpression, VectorSpaceClusterer, VerbnetCorpusReader, ViterbiParser, Vocabulary, WasmNltk, WekaClassifier, WittenBell, WittenBellInterpolated, Word, WordListCorpusReader, WordNet, WordNetReader as WordNetCorpusReader, WordNetError, WordNetICCorpusReader, WordNetLemmatizer, WordNetReader, XMLCorpusReader, XMLCorpusView, XML_Tool, YCOECorpusReader, YCOEParseCorpusReader, YCOETaggedCorpusReader, ZipFile, ZipFilePathPointer, OpenOnDemandZipFile as ZipFileReader, _build_tgrep_parser, _internal, acyclic_branches_depth_first, acyclic_breadth_first, acyclic_depth_first, acyclic_dic2tree, addBlankLines, addDefaultFields, add_blank_lines, add_default_fields, add_py3_data, alignBlocks, alignLogProb, alignTexts, alignWords, align_blocks, align_log_prob, align_texts, alignWords as align_words, alignment, alignment_error_rate, align as alineAlign, delta as alineDelta, diff as alineDiff, align as aline_align, delta as aline_delta, diff as aline_diff, allowlisted_pickle_load, ancestors, app_chartparser_app_d as app_chartparser_app_ns, app_chunkparser_app_d as app_chunkparser_app_ns, app_collocations_app_d as app_collocations_app_ns, app_concordance_app_d as app_concordance_app_ns, app_nemo_app_d as app_nemo_app_ns, app_d as app_ns, app_rdparser_app_d as app_rdparser_app_ns, app_srparser_app_d as app_srparser_app_ns, app_wordfreq_app_d as app_wordfreq_app_ns, app_wordnet_app_d as app_wordnet_app_ns, arguments_, arity, arity_parse_demo, augParseCategory, augParseCategory as aug_parse_category, averageObservedAgreement, averageObservedAgreement as average_observed_agreement, babelizeShell, babelize_shell, backwardBxConstraint, backwardOnly, backwardSxConstraint, backwardTConstraint, backwardBxConstraint as backward_bx_constraint, backwardOnly as backward_only, backwardSxConstraint as backward_sx_constraint, backwardTConstraint as backward_t_constraint, barendregtNormalize, barendregtNormalize as barendregt_normalize, basicSentChop, basic_sent_chop, bigramWindowStatsAscii, bigramWindowStatsAsciiIds, bigramWindowStatsAscii as bigram_window_stats_ascii, bigramWindowStatsAsciiIds as bigram_window_stats_ascii_ids, binaryConcept, binaryConcept as binary_concept, binary_search_file, binding_ops, book, boolean_ops, bothBackward, bothForward, bothBackward as both_backward, bothForward as both_forward, bracketToTree, bracketToTree as bracket_to_tree, breadth_first, brill24, bubble, buildTemplates, buildTgrepParser, build_index, buildTemplates as build_templates, buildTgrepParser as build_tgrep_parser, calculate_deltas, calculate_empirical_fcount, calculate_estimated_fcount, calculate_nfmap, call_megam, call_tadm, demo$d as ccgDemo, fromString as ccgFromstring, demo$d as ccg_demo, fromstring as ccg_fromstring, items as chat80_items, main as chat80_main, rels as chat80_rels, chat_demo, chat_eliza_d as chat_eliza_ns, chat_iesha_d as chat_iesha_ns, chat_d as chat_ns, chat_rude_d as chat_rude_ns, chat_suntsu_d as chat_suntsu_ns, chat_util_d as chat_util_ns, chat_zen_d as chat_zen_ns, chatbots, check, choose, chunkIobIdsNative, chunkTreeToIob, chunkIobIdsNative as chunk_iob_ids_native, chunkTreeToIob as chunk_tree_to_iob, cistemStem, cistemStem as cistem_stem, cities2table, class_abbrev, classify_accuracy, classify_log_likelihood, clause, clause2concepts, clausify, clean_html, clean_url, clearTemplateRegistry, clear_cache, clearTemplateRegistry as clear_template_registry, cli_d as cli_ns, closedDomainDemo, closedWorldDemo, closed_domain_demo, closed_world_demo, collapseUnaryChains, collapseUnaryChains as collapse_unary_chains, collections_d as collections_ns, combinationProverDemo, combination_prover_demo, comma_separated_string_args, compat_d as compat_ns, computeAsciiMetrics, computeCompositionSemantics, computeFunctionSemantics, computeSemantics, computeSubstitutionSemantics, computeTypeRaisedSemantics, computeAsciiMetrics as compute_ascii_metrics, computeCompositionSemantics as compute_composition_semantics, computeFunctionSemantics as compute_function_semantics, computeSemantics as compute_semantics, computeSubstitutionSemantics as compute_substitution_semantics, computeTypeRaisedSemantics as compute_type_raised_semantics, concepts, config_java, conll_demo, conll_file_demo, conllesp, conllned, conllstr2tree, conlltags2tree, convertToProver9, convertToProver9 as convert_to_prover9, cooperStore, cooperStore as cooper_store, copyVector, copyVector as copy_vector, corpusGleu, corpusLepor, corpusRibes, corpusSize, concat as corpus_concat, corpus_europarl_raw_d as corpus_europarl_raw_ns, corpusGleu as corpus_gleu, corpusLepor as corpus_lepor, corpusRibes as corpus_ribes, corpusSize as corpus_size, cosineDistance, cosineDistance as cosine_distance, countNgramsAscii, countNormalizedTokensAscii, countNormalizedTokensAsciiScalar, countTokensAscii, countTokensAsciiScalar, countUniqueNgramsAscii, countUniqueTokensAscii, countNgramsAscii as count_ngrams_ascii, countNormalizedTokensAscii as count_normalized_tokens_ascii, countNormalizedTokensAsciiScalar as count_normalized_tokens_ascii_scalar, countTokensAscii as count_tokens_ascii, countTokensAsciiScalar as count_tokens_ascii_scalar, countUniqueNgramsAscii as count_unique_ngrams_ascii, countUniqueTokensAscii as count_unique_tokens_ascii, crossedDirs, crossedDirs as crossed_dirs, cut_string, cycle_finding_demo, cykRecognizeIdsNative, cykRecognizeIdsNative as cyk_recognize_ids_native, data_d as data_ns, decodeResult, decode_result, decorator, decorators_d as decorators_ns, defaultReasoningDemo, default_reasoning_demo, demo, demoErrorAnalysis, demoException, demoGeneratedTemplates, demoHighAccuracyRules, demoLearningCurve, demoLegacyGrammar, demoModel0, demoMultifeatureTemplate, demoMultipositionFeature, demoReprRuleFormat, demoSerializeTagger, demoStrRuleFormat, demoTemplateStatistics, demoVerboseRuleFormat, demo_bw, demoErrorAnalysis as demo_error_analysis, demo_errors, demo_eval, demoException as demo_exception, demoGeneratedTemplates as demo_generated_templates, demo_grammar, demoHighAccuracyRules as demo_high_accuracy_rules, demoLearningCurve as demo_learning_curve, demo_legacy_grammar, demo_model0, demoMultifeatureTemplate as demo_multifeature_template, demoMultipositionFeature as demo_multiposition_feature, demo_pos, demo_pos_bw, demo_read_depgraph, demoReprRuleFormat as demo_repr_rule_format, demoSerializeTagger as demo_serialize_tagger, demoStrRuleFormat as demo_str_rule_format, demoTemplateStatistics as demo_template_statistics, demoVerboseRuleFormat as demo_verbose_rule_format, dependencyEvaluate, dependencyParse, dependencyParseText, dependencyEvaluate as dependency_evaluate, dependencyParse as dependency_parse, dependencyParseText as dependency_parse_text, deprecated, descape_entity, describeTemplateSets, describe_template_sets, discourseDemo, demo$8 as discourseModuleDemo, discourse_demo, demo$8 as discourse_module_demo, dot2img, dotProduct, dotProduct as dot_product, download, downloadCorpusRegistry, downloadCorpusRegistry as download_corpus_registry, download_gui, download_shell, download as downloader_download, unzip as downloader_unzip, update as downloader_update, draw_cfg_d as draw_cfg_ns, draw_dispersion_d as draw_dispersion_ns, draw_d as draw_ns, draw_table_d as draw_table_ns, draw_tree_d as draw_tree_ns, draw_util_d as draw_util_ns, drtDiscourseDemo, drt_discourse_demo, edge_closure, edges2dot, elementtree_indent, eliza_chat$1 as eliza_chat, eliza_pairs, equality_preds, erfcc, error, errorList, errorList as error_list, euclideanDistance, euclideanDistance as euclidean_distance, evaluateLanguageModelIdsNative, evaluateSents, evaluateLanguageModelIdsNative as evaluate_language_model_ids_native, evaluate_sents, everygrams, everygramsAsciiNative, everygramsAsciiNative as everygrams_ascii_native, exactMatch, exactMatch as exact_match, expressions, extract, extractRels, extractTestSentences, extract_fields, extractRels as extract_rels, extract_test_sentences, f, factorial, featureChartParse, featureEarleyParse, featureChartParse as feature_chart_parse, featureEarleyParse as feature_earley_parse, filestring, find, findIncreasingSequences, findBinary as find_binary, find_binary_iter, find_corpus_fileids, find_dir, find_file, find_file_iter, findIncreasingSequences as find_increasing_sequences, find_jar, find_jar_iter, find_jars_within_path, find_malt_model, find_maltparser, find_variables, flatten, flattenSparseBatch, flattenSparseBatch as flatten_sparse_batch, fntbl37, foldemo, folmodel, format_debug_decision, forwardOnly, forwardSConstraint, forwardTConstraint, forwardOnly as forward_only, forwardSConstraint as forward_s_constraint, forwardTConstraint as forward_t_constraint, fromString, fromString as from_string, fromstring$1 as fromstring, trace as galeChurchTrace, trace as gale_church_trace, generate, generateChomsky, generateSentences, generate_chomsky, generateSentences as generate_sentences, getDomain, get_domain, get_header_field_list, getinfo, growDiagFinalAnd, growDiagFinalAnd as grow_diag_final_and, guess_encoding, gzipOpenUnicode as gzip_open_unicode, hall_demo, harmonic, helpInfo, helpInfo as help_info, hf_download, hf_load_data, demo$g as hmmDemo, hmmViterbiIdsNative, hmmViterbiIdsNative as hmm_viterbi_ids_native, holeReadings, holeReadingsFromUsr, holeReadings as hole_readings, factorial as ibmFactorial, factorial as ibm_factorial, ieer_headlines, iesha_chat$1 as iesha_chat, iesha_pairs, import_from_stdlib, in_demo, in_idle, information_content, innermostFunction, innermostFunction as innermost_function, internals_d as internals_ns, interpretSents, interpret_sents, invertDict, invert_dict, is_eventvar, is_funcvar, is_indvar, is_private_dir, is_rel, is_writable, java, jcn_similarity, json2csv, json2csv_entities, jsontags_d as jsontags_ns, kendallTau, kendallTau as kendall_tau, kmeansFitEuclideanNative, kmeansFitEuclideanNative as kmeans_fit_euclidean_native, labelIndivs, labelIndivs as label_indivs, langnames_d as langnames_ns, lazyimport_d as lazyimport_ns, lch_similarity, leadins, legalityTokenize, legalityTokenize as legality_tokenize, lengthPenalty, lengthPenalty as length_penalty, alignment as leporAlignment, alignment as lepor_alignment, lesk, lex, lfgParse, lfgParse as lfg_parse, lin_similarity, linearScoresSparseIdsNative, linearTextTrainNative, linearTrainSparseIdsNative, linearScoresSparseIdsNative as linear_scores_sparse_ids_native, linearTextTrainNative as linear_text_train_native, linearTrainSparseIdsNative as linear_train_sparse_ids_native, list2sym, load, loadBundledMiniCorpus, loadConditionalExponentialTextClassifier, loadCorpusBundleFromIndex, loadCorpusRegistryManifest, loadDecisionTreeTextClassifier, loadFol, loadLinearSvmTextClassifier, loadLogisticTextClassifier, loadMaxEntTextClassifier, loadNaiveBayesTextClassifier, loadParser, loadPerceptronTaggerModel, loadPerceptronTextClassifier, loadPositiveNaiveBayesTextClassifier, loadPunktParams, loadWordNet, loadWordNetExtended, loadWordNetMini, loadWordNetPacked, loadBundledMiniCorpus as load_bundled_mini_corpus, loadConditionalExponentialTextClassifier as load_conditional_exponential_text_classifier, loadCorpusBundleFromIndex as load_corpus_bundle_from_index, loadCorpusRegistryManifest as load_corpus_registry_manifest, loadDecisionTreeTextClassifier as load_decision_tree_text_classifier, load_fol, loadLinearSvmTextClassifier as load_linear_svm_text_classifier, loadLogisticTextClassifier as load_logistic_text_classifier, loadMaxEntTextClassifier as load_max_ent_text_classifier, load_maxent_params, loadNaiveBayesTextClassifier as load_naive_bayes_text_classifier, load_parser, loadPerceptronTaggerModel as load_perceptron_tagger_model, loadPerceptronTextClassifier as load_perceptron_text_classifier, load_pos, loadPositiveNaiveBayesTextClassifier as load_positive_naive_bayes_text_classifier, load_punkt_params, loadWordNet as load_word_net, loadWordNetExtended as load_word_net_extended, loadWordNetMini as load_word_net_mini, loadWordNetPacked as load_word_net_packed, logsumexp2, long2short, longestTargetSentenceLength as longest_target_sentence_length, demo$9 as maceDemo, spacer$1 as maceSpacer, demo$9 as mace_demo, spacer$1 as mace_spacer, makeLex, makeValuation, makeVariableExpression, makeLex as make_lex, makeValuation as make_valuation, makeVariableExpression as make_variable_expression, malt_demo, malt_regex_tagger, mapTag, mapTreeLabels, mapTag as map_tag, mapTreeLabels as map_tree_labels, matchBrackets, matchBrackets as match_brackets, maxent_pos_tagger, md5_hexdigest, meanVector, meanVector as mean_vector, memoize$1 as memoize, merge, meteorScore, meteorScore as meteor_score, mimic_wrap, mostGeneralUnification, mostGeneralUnification as most_general_unification, naiveBayesLogScoresIdsNative, naiveBayesLogScoresIdsNative as naive_bayes_log_scores_ids_native, nativeLibraryPath, nativeTokenizerAvailable, nativeLibraryPath as native_library_path, nativeTokenizerAvailable as native_tokenizer_available, neChunk, neChunkIob, neChunk as ne_chunk, neChunkIob as ne_chunk_iob, ne_chunked, new_wrapper, nextCategory, nextUniqueCounterValue, nextCategory as next_category, nextUniqueCounterValue as next_unique_counter_value, ngramFreqDistHashAscii, ngramPositionalPenalty, ngramFreqDistHashAscii as ngram_freq_dist_hash_ascii, ngramPositionalPenalty as ngram_positional_penalty, ngramsAsciiNative, ngramsAsciiNative as ngrams_ascii_native, nistInternationalTokenize, nistTokenize, nistInternationalTokenize as nist_international_tokenize, nistTokenize as nist_tokenize, nltkdemo18, nltkdemo18plus, nonmonotonicDemo, nonmonotonicDemo as nonmonotonic_demo, nonprojective_conll_parse_demo, norm, norm_cdf, norm_logsf, normalizeTokens, normalizeTokensAsciiNative, normalizeVector, normalize_resource_name, normalizeResourceUrl as normalize_resource_url, normalizeTokens as normalize_tokens, normalizeTokensAsciiNative as normalize_tokens_ascii_native, normalizeVector as normalize_vector, objects, open_datafile, openccgTinytiny, openccgTinytiny as openccg_tinytiny, outf_writer_compat, overridden, p9ReturnCodes, p9ReturnCodes as p9_return_codes, pad_sequence, pairwise, parallelize_preprocess, parseApplication, parseBrownTagged, parseCategory, parseConllChunked, parseConllTagged, parseFeatStruct, parseFeatureCfgGrammar, parseLexicon, parsePrimitiveCategory, parseSFMString, parseSents, parseSubscripts, parseTextWithFeatureCfg, parseTextWithFeatureEarley, parseTokenStream, parseApplication as parse_application, parseBrownTagged as parse_brown_tagged, parseCategory as parse_category, parseConllChunked as parse_conll_chunked, parseConllTagged as parse_conll_tagged, parseFeatStruct as parse_feat_struct, parseFeatureCfgGrammar as parse_feature_cfg_grammar, parseLexicon as parse_lexicon, parse_megam_weights, parsePrimitiveCategory as parse_primitive_category, parse_sents, parseSFMString as parse_sfm_string, parseSubscripts as parse_subscripts, parse_tadm_weights, parseTextWithFeatureCfg as parse_text_with_feature_cfg, parseTextWithFeatureEarley as parse_text_with_feature_earley, parse_token_stream, parse_with_bindops, path_similarity, pathsec_open, perceptronPredictBatchNative, perceptronPredictBatchNative as perceptron_predict_batch_native, extract as phraseExtract, phraseExtraction, extract as phrase_extract, phraseExtraction as phrase_extraction, pickle_load, porterStemAscii, porterStemAsciiTokens, porterStemAscii as porter_stem_ascii, porterStemAsciiTokens as porter_stem_ascii_tokens, posTag, posTagAsciiNative, posTagPerceptronAscii, posTagSents, pos_tag, posTagAsciiNative as pos_tag_ascii_native, posTagPerceptronAscii as pos_tag_perceptron_ascii, pos_tag_sents, position_of_ngram, postag, pr, prefix_replace, preparePerceptronTaggerModel, preparePerceptronTaggerModel as prepare_perceptron_tagger_model, prettyPrint, prettyPrint as pretty_print, printCCGDerivation, printCCGTree, printProof, printCCGDerivation as print_ccg_derivation, printCCGTree as print_ccg_tree, print_proof, print_string, printtype, processBundle, processBundle as process_bundle, projective_prob_parse_demo, projective_rule_parse_demo, propdemo, prover9Demo, spacer$2 as prover9Spacer, prover9Demo as prover9_demo, spacer$2 as prover9_spacer, punkt_pickle_load, py3_data, quick, raise_unorderable_types, re_show, readLogic, readSents, readType, readValuation, read_alignedsent_block, read_blankline_block, read_cmudict_block, read_int, read_line_block, read_logic, read_number, read_parse_blankline_block, read_regexp_block, read_sents, read_sexpr_block, read_str, read_timit_block, read_type, read_valuation, read_whitespace_block, read_wordpunct_block, reflections$2 as reflections, regexpChunkParse, regexpChunkParse as regexp_chunk_parse, clause as relextractClause, clause as relextract_clause, removeBlanks, remove_blanks, res_similarity, resetUniqueVariableCounter, resetUniqueVariableCounter as reset_unique_variable_counter, resolutionDemo, resolutionTest, resolutionDemo as resolution_demo, resolution_test, resolveAnaphora, resolve_anaphora, restricted_pickle_load, retrieve, revword, roles_demo, rootSemrep, root_semrep, rslpStem, rslpStem as rslp_stem, rteClassify, rteClassify as rte_classify, rtuple, rude_chat$1 as rude_chat, rude_pairs, rule_based_demo, run_profile, safe_parse, satdemo, savePunktParams, save_maxent_params, save_punkt_params, selection, semLogicDemo, semLogicDemoErrors, semLogicDemo as sem_logic_demo, semLogicDemoErrors as sem_logic_demo_errors, sem_package, sem_trace, semi_rel2reldict, sentenceGleu, sentenceLepor, sentenceRibes, sentenceTokenizePunktAsciiNative, sentenceGleu as sentence_gleu, sentenceLepor as sentence_lepor, sentenceRibes as sentence_ribes, sentenceTokenizePunktAsciiNative as sentence_tokenize_punkt_ascii_native, set2rel, set_proxy, sexprTokenize, sexprTokenize as sexpr_tokenize, sha256_hexdigest, short2long, showCfg, show_cfg, sigmaExp, sigmaSkip, sigmaSub, sigmaExp as sigma_exp, sigmaSkip as sigma_skip, sigmaSub as sigma_sub, singleMeteorScore, singleMeteorScore as single_meteor_score, sinica_parse, skipgrams, skipgramsAsciiNative, skipgramsAsciiNative as skipgrams_ascii_native, skolemFunction, skolem_function, skolemize, slice_bounds, snowballStem, snowballStem as snowball_stem, socialTokenizerNative, socialTokenizerNative as social_tokenizer_native, sonorityTokenize, sonorityTokenize as sonority_tokenize, sortFields, sort_fields, spacer, spearmanRho, spearmanRho as spearman_rho, splitAt, split_at, split_resource_url, sqlDemo, sqlQuery, sqlDemo as sql_demo, sqlQuery as sql_query, standardTemplates, standardTemplates as standard_templates, stemMatch, stemMatch as stem_match, stem_package, step, str2tuple, subjects, suffixReplace as suffix_replace, sumVectors, sumVectors as sum_vectors, suntsu_chat$1 as suntsu_chat, suntsu_pairs, switch_chunker, switch_p_tagger, switch_punkt, switch_t_tagger, synsetDefinition, synsetDefinition as synset_definition, tabdata_d as tabdata_ns, tableauDemo, tableauTest, tableauDemo as tableau_demo, tableau_test, tagPattern2rePattern, tag_package, tag_pattern2re_pattern, taggedSentToConll, taggedSentsToConll, tagged_treebank_para_block_reader, taggedsent_to_conll, taggedsents_to_conll, tagsetMapping, tagsetMapping as tagset_mapping, tagstr2tree, demo$e as tblDemo, demo$e as tbl_demo, tbl_package, test, testBuildModel, testClausify, testConfig, testConvertToProver9, testHigherOrderTableauProver, testMakeRelationSet, testModelFound, testProve, testResolutionProver, testTableauProver, testTransformOutput, test_build_model, test_clausify, test_config, test_convert_to_prover9, test_draw, testHigherOrderTableauProver as test_higher_order_tableau_prover, test_make_relation_set, test_model_found, test_prove, testResolutionProver as test_resolution_prover, testTableauProver as test_tableau_prover, test_transform_output, tgrepCompile, tgrepNodes, tgrepPositions, tgrepTokenize, tgrep_compile, tgrep_nodes, tgrep_positions, tgrep_tokenize, demo$f as tntDemo, toCnf, toCnf as toCnfInternal, toSFMString, toSettingsString, toCnf as to_cnf, to_settings_string, to_sfm_string, tokenFreqDistHashAscii, tokenFreqDistIdsAscii, tokenFreqDistHashAscii as token_freq_dist_hash_ascii, tokenFreqDistIdsAscii as token_freq_dist_ids_ascii, tokenizeAsciiNative, tokenizeAsciiNative as tokenize_ascii_native, tokenizerRequestNative, tokenizerRequestNative as tokenizer_request_native, tokenwrap, toolbox_demo, topPmiBigramsAscii, topPmiBigramsAscii as top_pmi_bigrams_ascii, trace, trainConditionalExponentialTextClassifier, trainDecisionTreeTextClassifier, trainLinearSvmTextClassifier, trainLogisticTextClassifier, trainMaxEntTextClassifier, trainNaiveBayesTextClassifier, trainPerceptronTextClassifier, trainPositiveNaiveBayesTextClassifier, trainConditionalExponentialTextClassifier as train_conditional_exponential_text_classifier, trainDecisionTreeTextClassifier as train_decision_tree_text_classifier, trainLinearSvmTextClassifier as train_linear_svm_text_classifier, trainLogisticTextClassifier as train_logistic_text_classifier, trainMaxEntTextClassifier as train_max_ent_text_classifier, train_maxent_classifier_with_gis, train_maxent_classifier_with_iis, train_maxent_classifier_with_megam, trainNaiveBayesTextClassifier as train_naive_bayes_text_classifier, trainPerceptronTextClassifier as train_perceptron_text_classifier, trainPositiveNaiveBayesTextClassifier as train_positive_naive_bayes_text_classifier, transform, translate_package, tree2conlltags, tree2semi_rel, treeDepth, treeLeaves, treeToBracket, treeDepth as tree_depth, treeLeaves as tree_leaves, treeToBracket as tree_to_bracket, treepositionsNoLeaves, treepositions_no_leaves, try_port, smooth as ttSmooth, smooth as tt_smooth, tuple2str, twitter_api_d as twitter_api_ns, twitter_common_d as twitter_common_ns, twitter_d as twitter_ns, twitter_twitter_demo_d as twitter_twitter_demo_ns, twitter_twitterclient_d as twitter_twitterclient_ns, twitter_util_d as twitter_util_ns, typecheck, unaryConcept, unaryConcept as unary_concept, unify, uniqueAncestors, uniqueNamesDemo, uniqueVariable, unique_ancestors, unique_list, unique_names_demo, unique_variable, untag, untagSents, untagSents as untag_sents, unweighted_minimum_spanning_dict, unweighted_minimum_spanning_digraph, unweighted_minimum_spanning_tree, unzip, update, urlopen, usage, valDump, valLoad, valDump as val_dump, valLoad as val_load, validate_network_url, validate_path, validate_zip_archive, vectorAdd, vectorDiv, vectorNorm, vectorScale, vectorSub, vectorAdd as vector_add, vectorDiv as vector_div, vectorNorm as vector_norm, vectorScale as vector_scale, vectorSub as vector_sub, verbs, wordRankAlignment, word_finder, wordRankAlignment as word_rank_alignment, wordfinder, wordnetMorphyAsciiNative, wordnetReader, wordnetMorphyAsciiNative as wordnet_morphy_ascii_native, wordnetReader as wordnet_reader, wordnetsynMatch, wordnetsynMatch as wordnetsyn_match, write_megam_file, write_tadm_file, wup_similarity, xpath, zen_chat$1 as zen_chat, zen_pairs, zeroVector, zeroVector as zero_vector, zip_member_is_unsafe };
export type { AgreementDistanceFn, AlignedSentInput, AlignmentPair, AnnotationLabel, AnnotationTriple, AnyEdge, BigramScoreFn, BlockReader, BrillSentence, BrillToken, BrillTrainerOptions, BrillTrainingStats, CCGCategory, CategorizedInit, ChartParserOptions, ChartRule, ChunkElement, ChunkNode, ChunkTree, ChunkedSentence, ChunkedToken, ConcordanceLine, Condition, ConditionalExponentialExample, ConditionalExponentialSerialized, CorpusFile, CorpusMiniIndex, CorpusRegistryEntry, CorpusRegistryManifest, TaggedSentence as CorpusTaggedSentence, TaggedToken$2 as CorpusTaggedToken, DecisionTreeExample, DecisionTreeSerialized, DependencyArc, DependencyEvalNode, DependencyParse, DirectionChar, DiscourseTesterOptions, DistanceFn, Drs, EMOptions, EncodingSpec, FeatureCfgGrammar, FeatureMap, FeatureProduction, FeatureSpec, FeatureSymbol, GoldSentence, HiddenMarkovModelTrainerOptions, Estimator as HmmEstimator, Scorer as IBMScore, InitialTaggerLike, IobRow$1 as IobRow, KMeansOptions, LanguageDistance, LinearModelExample, LinearSvmSerialized, LogisticSerialized, MaxEntExample, MaxEntPrediction, MaxEntSerialized, MaxentEncodedVector, MaxentEncodingLike, MaxentParams, MaxentStreamLike, MaxentTrainOptions, MeteorOptions, MeteorStemmer, NaiveBayesExample, NaiveBayesPrediction, NaiveBayesSerialized, NativeLinearTextModel, NativeLinearTrainingAlgorithm, NativeLmModelType, NeChunkOptions, NeIobTuple, NgramTaggerOptions, PerceptronExample, PerceptronSerialized, PositiveNaiveBayesSerialized, ProbDist, QuadgramScoreFn, Restriction, RuleEffect, SFMField, TaggedToken$3 as SeqTaggedToken, SparseVector, StreamBigramFreq, StreamConditionalFreq, TGrepPattern, TGrepPredicate, TadmMapping, TagContext, TaggedToken$5 as TaggedToken, TaggerModel, TextCatOptions, TextTokenizerLike, TreePosition$1 as TreePosition, TreePositionsOrder, TrigramScoreFn, UntaggedSentence, VaderOptions, VaderPolarity, Vector, VectorizerOptions, VectorizerSerialized, WordFinderResult, WordNetIcDict, WordNetLookupQuery, WordNetLookupResult, WordNetMiniPayload, WordNetPos, WordNetSynset, Synset$1 as WsdSynset };
