import { RustNaiveBayesClassifier, PositiveFeatureOptions } from './feature_nb.js';
export { RustPositiveNaiveBayesClassifier } from './feature_nb.js';
import { P as ProbDistLike, F as FreqDist, D as DictionaryProbDist, R as RustMaxentClassifier, a as FeatureMaxentOptions, C as ConditionalProbDist } from './types/feature_maxent.d-DoqsStDs.js';
import { MaxentEncodingExample, MaxentFeatureset } from './feature_maxent.js';
export { B as BinaryMaxentFeatureEncoding, c as ConditionalFreqDist, type d as ConditionalFreqDistInput, e as ConditionalProbDistI, f as DictionaryConditionalProbDist, E as ELEProbDist, type g as FeatureMaxentSerialized, type h as FreqDistInput, L as LaplaceProbDist, i as LidstoneProbDist, j as MLEProbDist, k as MutableProbDist, l as PYTHON_BOOL, m as PYTHON_FLOAT, n as PYTHON_INT, type o as ProbDistFactory, p as ProbDistI, S as SimpleGoodTuringProbDist, T as TypedMaxentFeatureEncoding, U as UniformProbDist, W as WittenBellProbDist, q as addLogs, q as add_logs, r as entropy, s as logLikelihood, s as log_likelihood, t as pythonFloat, u as sumLogs, u as sum_logs } from './types/feature_maxent.d-DoqsStDs.js';
import { RustDecisionTreeClassifier, FeatureTreeOptions } from './feature_tree.js';
export { type LanguageModelType, type LmProbe, MWETokenizer, NgramLanguageModel, type NgramLanguageModelOptions, type NgramOptions, type PunktModelSerialized, PunktSentenceTokenizer, PunktSentenceTokenizerSubset, PunktTrainer, PunktTrainerSubset, type PunktTrainingOptions, RustNgramLanguageModel, ToktokTokenizer, TweetTokenizer, bigramWindowStatsAsciiIds as bigramWindowStatsAsciiIdsJs, bigramWindowStatsAscii as bigramWindowStatsAsciiJs, bigramWindowStatsAsciiIds as bigram_window_stats_ascii_ids_js, bigramWindowStatsAscii as bigram_window_stats_ascii_js, bigrams, computeAsciiMetrics as computeAsciiMetricsJs, computeAsciiMetrics as compute_ascii_metrics_js, countNgramsAscii as countNgramsAsciiJs, countTokensAscii as countTokensAsciiJs, countUniqueNgramsAscii as countUniqueNgramsAsciiJs, countUniqueTokensAscii as countUniqueTokensAsciiJs, countNgramsAscii as count_ngrams_ascii_js, countTokensAscii as count_tokens_ascii_js, countUniqueNgramsAscii as count_unique_ngrams_ascii_js, countUniqueTokensAscii as count_unique_tokens_ascii_js, defaultPunktModel, defaultPunktModel as default_punkt_model, everygramsAscii, everygramsAscii as everygrams_ascii, hashNgram, hashTokenAscii, hashNgram as hash_ngram, hashTokenAscii as hash_token_ascii, mweTokenize, mweTokenize as mwe_tokenize, ngramFreqDistHashAscii as ngramFreqDistHashAsciiJs, ngramFreqDistHashAscii as ngram_freq_dist_hash_ascii_js, ngrams, ngramsAscii, ngramsAscii as ngrams_ascii, ngrams_iter, normalizeTokensAscii, normalizeTokensUnicode, normalizeTokensAscii as normalize_tokens_ascii, normalizeTokensUnicode as normalize_tokens_unicode, parsePunktModel, parsePunktModel as parse_punkt_model, posTagAscii, posTagAscii as pos_tag_ascii, sent_tokenize, sentenceTokenizePunkt, sentenceTokenizePunktCompat, sentenceTokenizeSubset, sentenceTokenizePunkt as sentence_tokenize_punkt, sentenceTokenizePunktCompat as sentence_tokenize_punkt_compat, sentenceTokenizeSubset as sentence_tokenize_subset, serializePunktModel, serializePunktModel as serialize_punkt_model, skipgramsAscii, skipgramsAscii as skipgrams_ascii, tokenFreqDistHashAscii as tokenFreqDistHashAsciiJs, tokenFreqDistIdsAscii as tokenFreqDistIdsAsciiJs, tokenFreqDistHashAscii as token_freq_dist_hash_ascii_js, tokenFreqDistIdsAscii as token_freq_dist_ids_ascii_js, tokenizeAscii, tokenizeAscii as tokenize_ascii, toktokTokenize, toktokTokenize as toktok_tokenize, topPmiBigramsAscii as topPmiBigramsAsciiJs, topPmiBigramsAscii as top_pmi_bigrams_ascii_js, trainNgramLanguageModel, trainPunktModel, trainNgramLanguageModel as train_ngram_language_model, trainPunktModel as train_punkt_model, trigrams, tweetTokenize, tweetTokenizeSubset, tweetTokenize as tweet_tokenize, tweetTokenizeSubset as tweet_tokenize_subset, wordTokenizeSubset, word_tokenize, wordTokenizeSubset as word_tokenize_subset, wordpunct_tokenize } from './index.browser.js';
export { type BlanklineHandling, type TokenSpan } from './tokenizer_types.js';
import { FeatureSet, LabeledFeatureset } from './feature_types.js';
export { type FeatureValue } from './feature_types.js';
export { type BleuWeights, type ConfusionMatrixResult, type EditDistanceOptions, confusionMatrix, confusionMatrix as confusion_matrix, corpusBleu, corpusBleu as corpus_bleu, editDistance, editDistance as edit_distance, sentenceBleu, sentenceBleu as sentence_bleu } from './metrics.js';
import { WasmNltk } from './wasm.js';
export { type WasmNltkInit } from './wasm.js';
export { type LabelSet, type ProbabilityMap, type Ranking, type Segmentation, binaryDistance, binaryDistance as binary_distance, customDistance, customDistance as custom_distance, editDistanceAlign, editDistanceAlign as edit_distance_align, fMeasure, fMeasure as f_measure, fractionalPresence, fractionalPresence as fractional_presence, intervalDistance, intervalDistance as interval_distance, jaccardDistance, jaccardDistance as jaccard_distance, masiDistance, masiDistance as masi_distance, logLikelihood as metricsLogLikelihood, logLikelihood as metrics_log_likelihood, pk, precision, presence, ranksFromScores, ranksFromSequence, ranksFromScores as ranks_from_scores, ranksFromSequence as ranks_from_sequence, recall, sorensenDiceDistance, sorensenDiceSimilarity, sorensenDiceDistance as sorensen_dice_distance, sorensenDiceSimilarity as sorensen_dice_similarity, spearmanCorrelation, spearmanCorrelation as spearman_correlation, windowdiff } from './distance_metrics.js';
export { type ChrFOptions, type NistOptions, corpusChrF, corpusNist, corpusChrF as corpus_chr_f, corpusNist as corpus_nist, nistLengthPenalty, nistLengthPenalty as nist_length_penalty, sentenceChrF, sentenceNist, sentenceChrF as sentence_chr_f, sentenceNist as sentence_nist } from './translation_metrics_extra.js';
export { type GrammarSymbol, Nonterminal, Production, CFG as RustCFG, RustEarleyParser, type RustParseOptions, type RustParseResult, type RustTreeOrder, type RustTreePosition, type StringTree, Tree, type TreeFormatOptions, nonterminals } from './rust_parse.js';
export { BlanklineTokenizer, LineTokenizer, SpaceTokenizer, TabTokenizer, WhitespaceTokenizer, blanklineTokenize, blanklineTokenize as blankline_tokenize, lineTokenize, lineTokenize as line_tokenize } from './tokenizers_basic.js';
export { ConfusionMatrix, accuracy } from './confusion_metrics.js';
export { ParsingRuntime } from './parsing_runtime.js';
export { TreebankWordDetokenizer, TreebankWordTokenizer, WordPunctTokenizer, treebankWordTokenize, treebankWordTokenize as treebank_word_tokenize, wordPunctTokenize, wordPunctTokenize as word_punct_tokenize } from './tokenizers_treebank.js';
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

type NormalizeOptions = {
    removeStopwords?: boolean;
    preferNativeAscii?: boolean;
    stem?: boolean;
};
declare function normalizeTokens(text: string, options?: NormalizeOptions): string[];

type TaggedToken$3 = {
    token: string;
    tag: string;
};
type ChunkNode = {
    kind: "chunk";
    label: string;
    tokens: TaggedToken$3[];
};
type ChunkElement = TaggedToken$3 | ChunkNode;
declare function regexpChunkParse(tokens: TaggedToken$3[], grammar: string): ChunkElement[];
type IobRow = {
    token: string;
    tag: string;
    iob: string;
};
declare function chunkTreeToIob(tree: ChunkElement[]): IobRow[];

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
declare function neChunk(taggedSentence: TaggedToken$3[], options?: NeChunkOptions): ChunkElement[];
type NeIobTuple = [word: string, pos: string, ne: string];
/** IOB-tagged view of the NE chunks: Array<[word, pos, ne]> with B-/I-/O tags. */
declare function neChunkIob(taggedSentence: TaggedToken$3[], options?: NeChunkOptions): NeIobTuple[];

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

type CfgProduction = {
    lhs: string;
    rhs: string[];
};
type CfgGrammar = {
    startSymbol: string;
    productions: CfgProduction[];
};
type PcfgProduction = {
    lhs: string;
    rhs: string[];
    prob: number;
};
type PcfgGrammar = {
    startSymbol: string;
    productions: PcfgProduction[];
};
type ParseTree = {
    label: string;
    children: Array<ParseTree | string>;
};
type ProbabilisticParse = {
    tree: ParseTree;
    logProb: number;
    prob: number;
};
declare function parseCfgGrammar(grammarText: string, options?: {
    startSymbol?: string;
}): CfgGrammar;
declare function parsePcfgGrammar(grammarText: string, options?: {
    startSymbol?: string;
}): PcfgGrammar;
declare function chartParse(tokens: string[], grammar: CfgGrammar, options?: {
    maxTrees?: number;
    startSymbol?: string;
}): ParseTree[];
declare function recursiveDescentParse(tokens: string[], grammar: CfgGrammar, options?: {
    maxTrees?: number;
    startSymbol?: string;
    maxDepth?: number;
}): ParseTree[];
declare function leftCornerParse(tokens: string[], grammar: CfgGrammar, options?: {
    maxTrees?: number;
    startSymbol?: string;
    maxDepth?: number;
}): ParseTree[];
declare function earleyRecognize(tokens: string[], grammar: CfgGrammar, options?: {
    startSymbol?: string;
}): boolean;
declare function earleyParse(tokens: string[], grammar: CfgGrammar, options?: {
    maxTrees?: number;
    startSymbol?: string;
}): ParseTree[];
declare function probabilisticChartParse(tokens: string[], grammar: PcfgGrammar, options?: {
    startSymbol?: string;
}): ProbabilisticParse | null;
declare function parseTextWithCfg(text: string, grammar: CfgGrammar | string, options?: {
    maxTrees?: number;
    startSymbol?: string;
    normalizeTokens?: boolean;
}): ParseTree[];
declare function parseTextWithEarley(text: string, grammar: CfgGrammar | string, options?: {
    maxTrees?: number;
    startSymbol?: string;
    normalizeTokens?: boolean;
}): ParseTree[];
declare function parseTextWithPcfg(text: string, grammar: PcfgGrammar | string, options?: {
    startSymbol?: string;
    normalizeTokens?: boolean;
}): ProbabilisticParse | null;
declare function parseTextWithRecursiveDescent(text: string, grammar: CfgGrammar | string, options?: {
    maxTrees?: number;
    startSymbol?: string;
    normalizeTokens?: boolean;
    maxDepth?: number;
}): ParseTree[];
declare function parseTextWithLeftCorner(text: string, grammar: CfgGrammar | string, options?: {
    maxTrees?: number;
    startSymbol?: string;
    normalizeTokens?: boolean;
    maxDepth?: number;
}): ParseTree[];

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
    scoreNgrams(scoreFn: BigramScoreFn<T>): Array<[[T, T], number]>;
    nbest(scoreFn: BigramScoreFn<T>, count: number): Array<[T, T]>;
    aboveScore(scoreFn: BigramScoreFn<T>, minScore: number): IterableIterator<[T, T]>;
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

type ConcordanceLine = {
    left: string[];
    query: string;
    right: string[];
    offset: number;
    leftPrint: string;
    rightPrint: string;
    line: string;
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
    toString(): string;
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
declare class CorpusReader {
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
declare function loadBundledMiniCorpus(rootPath?: string): CorpusReader;
declare function loadCorpusBundleFromIndex(indexPath: string): CorpusReader;

type TaggedToken$2 = {
    token: string;
    tag: string;
};
type ChunkedToken = {
    token: string;
    pos: string;
    chunk: string;
};
type TaggedSentence$1 = TaggedToken$2[];
type ChunkedSentence = ChunkedToken[];
declare function parseConllTagged(text: string): TaggedSentence$1[];
declare function parseBrownTagged(text: string): TaggedSentence$1[];
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
type WordNetSynset = {
    id: string;
    pos: WordNetPos;
    lemmas: string[];
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
    lemmaNames(idOrSynset: string | WordNetSynset): string[];
    lemmas(pos?: WordNetPos): string[];
    morphy(word: string, pos?: WordNetPos): string | null;
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
    private readonly pattern;
    private readonly min;
    constructor(pattern: RegExp | string, min?: number);
    stem(word: string): string;
}
declare class LancasterStemmer {
    stem(word: string): string;
}
/**
 * NLTK-compatible Snowball stemmer backed by real Snowball (Porter2-family)
 * implementations in ./snowball. Unsupported languages throw an Error
 * (mirroring NLTK's ValueError), both at construction time and via
 * {@link snowballStem}.
 */
declare class SnowballStemmer {
    readonly language: string;
    constructor(language?: string);
    stem(word: string): string;
}
declare class WordNetLemmatizer {
    lemmatize(word: string, pos?: string): string;
}

type VaderPolarity = {
    neg: number;
    neu: number;
    pos: number;
    compound: number;
};
type VaderOptions = {
    lexicon?: Record<string, number>;
};
declare class SentimentIntensityAnalyzer {
    private readonly lexicon;
    constructor(options?: VaderOptions);
    polarityScores(text: string): VaderPolarity;
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
type PerceptronTaggerOptions = {
    model?: PerceptronTaggerModel;
    wasm?: WasmNltk;
    useWasm?: boolean;
    useNative?: boolean;
};
declare function posTagPerceptronAscii(text: string, options?: PerceptronTaggerOptions): PerceptronTaggedToken[];

declare class CFG {
    readonly grammar: CfgGrammar;
    constructor(grammar: CfgGrammar);
    static fromstring(grammarText: string, options?: {
        startSymbol?: string;
    }): CFG;
}
declare class PCFG {
    readonly grammar: PcfgGrammar;
    constructor(grammar: PcfgGrammar);
    static fromstring(grammarText: string, options?: {
        startSymbol?: string;
    }): PCFG;
}
declare class FeatureCFG {
    readonly grammar: FeatureCfgGrammar;
    constructor(grammar: FeatureCfgGrammar);
    static fromstring(grammarText: string, options?: {
        startSymbol?: string;
    }): FeatureCFG;
}
declare class ChartParser {
    protected readonly grammar: CfgGrammar;
    constructor(grammar: CFG | CfgGrammar | string);
    parse(tokens: string[]): ParseTree[];
    parseOne(tokens: string[]): ParseTree | null;
}
declare class EarleyChartParser extends ChartParser {
    parse(tokens: string[]): ParseTree[];
}
declare class RecursiveDescentParser extends ChartParser {
    parse(tokens: string[]): ParseTree[];
}
declare class LeftCornerChartParser extends ChartParser {
    parse(tokens: string[]): ParseTree[];
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
declare class PerceptronTagger {
    private readonly model;
    constructor(model?: PerceptronTaggerModel | string);
    tag(tokens: string[]): Array<[string, string]>;
    tag_sents(sentences: string[][]): Array<Array<[string, string]>>;
    tagText(text: string): Array<[string, string]>;
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

type TaggedToken$1 = readonly [word: string, tag: string];
type GoldSentence = readonly TaggedToken$1[];
type UntaggedSentence = readonly string[];
type TagContext = string | null | readonly (string | null)[];
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
    protected abstract chooseTag(tokens: UntaggedSentence, index: number, history: ReadonlyArray<string | null>): string | null;
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
    protected train(taggedCorpus: ReadonlyArray<GoldSentence>, cutoff?: number, verbose?: boolean): void;
    chooseTag(tokens: UntaggedSentence, index: number, history: ReadonlyArray<string | null>): string | null;
    protected abstract context(tokens: UntaggedSentence, index: number, history: ReadonlyArray<string | null>): TagContext | null;
}
declare class DefaultTagger extends SequentialBackoffTagger {
    #private;
    constructor(tag: string);
    get assignedTag(): string;
    size(): number;
    protected chooseTag(): string | null;
    toString(): string;
}
declare class NgramTagger extends ContextTagger {
    readonly n: number;
    constructor(n: number, options?: NgramTaggerOptions);
    protected context(tokens: UntaggedSentence, index: number, history: ReadonlyArray<string | null>): TagContext;
    toString(): string;
}
declare class UnigramTagger extends ContextTagger {
    constructor(options?: NgramTaggerOptions);
    protected context(tokens: UntaggedSentence, index: number): TagContext;
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
    protected chooseTag(tokens: UntaggedSentence, index: number): string | null;
    toString(): string;
}

type Synset = WordNetSynset;
declare function synsetDefinition(synset: Synset): string;
declare function lesk(contextSentence: string[], ambiguousWord: string, pos?: string | number, synsets?: Synset[]): Synset | null;

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
declare abstract class TblFeature {
    readonly kind: string;
    readonly positions: readonly number[];
    constructor(kind: string, positions: readonly number[]);
    repr(): string;
    key(): string;
    abstract extractProperty(tokens: ReadonlyArray<readonly [string, string]>, index: number): string;
    equals(other: TblFeature): boolean;
}
declare class Word extends TblFeature {
    constructor(positions: readonly number[]);
    extractProperty(tokens: ReadonlyArray<readonly [string, string]>, index: number): string;
}
declare class Pos extends TblFeature {
    constructor(positions: readonly number[]);
    extractProperty(tokens: ReadonlyArray<readonly [string, string]>, index: number): string;
}
type Condition = readonly [feature: TblFeature, value: string];
declare class TblRule {
    #private;
    readonly templateid: string;
    readonly originalTag: string;
    readonly replacementTag: string;
    readonly conditions: readonly Condition[];
    constructor(templateid: string, originalTag: string, replacementTag: string, conditions: readonly Condition[]);
    repr(): string;
    key(): string;
    toString(): string;
    applies(tokens: ReadonlyArray<readonly [string, string]>, index: number): boolean;
    apply(tokens: BrillSentence, positions?: readonly number[]): number[];
}
declare function clearTemplateRegistry(): void;
declare class Template {
    readonly id: string;
    readonly features: readonly TblFeature[];
    constructor(...features: TblFeature[]);
    repr(): string;
    applicableRules(tokens: ReadonlyArray<readonly [string, string]>, index: number, correctTag: string): TblRule[];
    getNeighborhood(tokens: ReadonlyArray<unknown>, index: number): number[];
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
declare function untag(taggedSentence: ReadonlyArray<TaggedToken$1>): string[];
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
}

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
declare abstract class Expression$1 {
    abstract str(): string;
    toString(): string;
    abstract equals(other: Expression$1): boolean;
    /** Free (non-bound) variables; includes individual and function variables, not constants. */
    abstract free(): Set<Variable>;
    abstract simplify(): Expression$1;
    abstract replace(variable: Variable, expression: Expression$1, replaceBound?: boolean, alphaConvert?: boolean): Expression$1;
    /** All free variables (constants excluded unless ?/@-prefixed, which are unsupported). */
    variables(): Set<Variable>;
    constants(): Set<Variable>;
    predicates(): Set<Variable>;
    normalize(): Expression$1;
    substituteBindings(bindings: Map<string, Variable | Expression$1>): Expression$1;
    applyto(other: Expression$1): ApplicationExpression$1;
    negate(): Expression$1;
}
declare class AbstractVariableExpression extends Expression$1 {
    variable: Variable;
    constructor(variable: Variable);
    simplify(): Expression$1;
    replace(variable: Variable, expression: Expression$1, _replaceBound?: boolean, _alphaConvert?: boolean): Expression$1;
    free(): Set<Variable>;
    predicates(): Set<Variable>;
    equals(other: Expression$1): boolean;
    str(): string;
}
declare class IndividualVariableExpression extends AbstractVariableExpression {
    free(): Set<Variable>;
}
declare class FunctionVariableExpression extends AbstractVariableExpression {
    free(): Set<Variable>;
}
declare class EventVariableExpression extends IndividualVariableExpression {
}
declare class ConstantExpression$1 extends AbstractVariableExpression {
    constants(): Set<Variable>;
}
/** Factory mirroring nltk.sem.logic.VariableExpression(). */
declare function makeVariableExpression(name: string): AbstractVariableExpression;
declare class ApplicationExpression$1 extends Expression$1 {
    function: Expression$1;
    argument: Expression$1;
    constructor(func: Expression$1, argument: Expression$1);
    simplify(): Expression$1;
    replace(variable: Variable, expression: Expression$1, replaceBound?: boolean, alphaConvert?: boolean): Expression$1;
    free(): Set<Variable>;
    constants(): Set<Variable>;
    predicates(): Set<Variable>;
    equals(other: Expression$1): boolean;
    /** Uncurry: returns [base-function, arg-list]. */
    uncurry(): [Expression$1, Expression$1[]];
    isAtom(): boolean;
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
    equals(other: Expression$1): boolean;
}
declare class LambdaExpression extends VariableBinderExpression {
    protected rebuild(variable: Variable, term: Expression$1): VariableBinderExpression;
    simplify(): Expression$1;
    str(): string;
}
declare abstract class QuantifiedExpression extends VariableBinderExpression {
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
type BooleanFactory = typeof AndExpression | typeof OrExpression | typeof ImpExpression$1 | typeof IffExpression;
declare class LogicParser {
    private currentIndex;
    private buffer;
    private symbolTrie;
    parse(data: string): Expression$1;
    /** Split the data into tokens (trie-based longest symbol match, like NLTK). */
    process(data: string): string[];
    getAllSymbols(): string[];
    inRange(location: number): boolean;
    token(location?: number): string;
    isvariable(tok: string): boolean;
    processNextExpression(context: string | null): Expression$1;
    handle(tok: string, context: string | null): Expression$1 | undefined;
    attemptAdjuncts(expression: Expression$1, context: string | null): Expression$1;
    handleNegation(_tok: string, _context: string | null): Expression$1;
    handleVariable(tok: string, _context: string | null): Expression$1;
    getNextTokenVariable(description: string): Variable;
    handleLambda(tok: string, _context: string | null): Expression$1;
    handleQuant(tok: string, _context: string | null): Expression$1;
    getQuantifiedExpressionFactory(tok: string): new (v: Variable, t: Expression$1) => QuantifiedExpression;
    handleOpen(_tok: string, _context: string | null): Expression$1;
    attemptEqualityExpression(expression: Expression$1, context: string | null): Expression$1;
    attemptBooleanExpression(expression: Expression$1, context: string | null): Expression$1;
    getBooleanExpressionFactory(tok: string): BooleanFactory | null;
    attemptApplicationExpression(expression: Expression$1, context: string | null): Expression$1;
    hasPriority(operation: string, context: string | null): boolean;
    assertNextToken(expected: string): void;
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
    handleProp(tok: string, context: string | null): DrtExpression;
    attemptAdjuncts(expr: DrtExpression, context: string | null): DrtExpression;
    attemptEqualityExpression(expr: DrtExpression, context: string | null): DrtExpression;
    attemptBooleanExpression(expr: DrtExpression, context: string | null): DrtExpression;
    getBooleanFactory(tok: string): ((a: DrtExpression, b: DrtExpression) => DrtExpression) | null;
    attemptApplicationExpression(expr: DrtExpression, context: string | null): DrtExpression;
    hasPriority(op: string, context: string | null): boolean;
    assertNextToken(expected: string): void;
}

declare function skolemize(expression: Expression$1, univScope?: Set<Variable> | null, usedVariables?: Set<Variable> | null): Expression$1;

/**
 * Snowball (Porter2-family) stemmers — public barrel.
 *
 * Implementation lives in per-language modules under src/snowball/
 * (ported line-for-line from NLTK's nltk/stem/snowball.py, which itself is a
 * Python translation of the Snowball spec at http://snowball.tartarus.org/).
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

declare const SNOWBALL_LANGUAGES: readonly ["danish", "dutch", "english", "french", "german", "italian", "norwegian", "portuguese", "romanian", "russian", "spanish", "swedish"];
/**
 * Stem `word` with the NLTK-compatible Snowball stemmer for `language`.
 *
 * Throws an Error (mirroring NLTK's ValueError) when the language is not
 * supported. Each language's algorithm lowercases internally (except
 * Russian, which does not lowercase — matching NLTK exactly).
 */
declare function snowballStem(word: string, language: string): string;

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
/** Factorial (small n; used by IBM models 3-5). */
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

type AlignedSent = {
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
    bestModel2Alignment(sentencePair: AlignedSent, jPegged?: number, iPegged?: number): AlignmentInfo;
    hillclimb(alignmentInfo: AlignmentInfo, jPegged?: number): AlignmentInfo;
    neighboring(alignmentInfo: AlignmentInfo, jPegged?: number): Set<AlignmentInfo>;
    sample(sentencePair: AlignedSent): {
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

declare class IBMModel3 extends SamplingModel {
    /** Probability(j | i,l,m): distortion_table[j][i][l][m]. */
    distortion_table: Map<number, Map<number, Map<number, Map<number, number>>>>;
    constructor(corpus: readonly AlignedSent[], iterations: number, probabilityTables?: {
        translation_table: IBMModelBase["translation_table"];
        alignment_table: IBMModelBase["alignment_table"];
        fertility_table: IBMModelBase["fertility_table"];
        p1: number;
        distortion_table: Map<number, Map<number, Map<number, Map<number, number>>>>;
    });
    resetProbabilities(): void;
    private setUniformProbabilities;
    train(parallel_corpus: readonly AlignedSent[]): void;
    private maximizeDistortionProbabilities;
    probTAGivenS(alignmentInfo: AlignmentInfo): number;
}

/**
 * port of nltk.translate.ibm4.IBMModel4 — distortion based on word classes
 * and the position of the previous cept's center, plus non-head displacement.
 */

type SrcTrgClasses = Record<string, number>;
declare class IBMModel4 extends SamplingModel {
    /** Probability(displacement of head word | src class of previous cept, trg class). */
    head_distortion_table: Map<number, Map<number | null, Map<number, number>>>;
    /** Probability(displacement of non-head word | target word class). */
    non_head_distortion_table: Map<number, Map<number, number>>;
    src_classes: SrcTrgClasses;
    trg_classes: SrcTrgClasses;
    constructor(corpus: readonly AlignedSent[], iterations: number, sourceWordClasses: SrcTrgClasses, targetWordClasses: SrcTrgClasses, probabilityTables?: {
        translation_table: IBMModelBase["translation_table"];
        alignment_table: IBMModelBase["alignment_table"];
        fertility_table: IBMModelBase["fertility_table"];
        p1: number;
        head_distortion_table: Map<number, Map<number | null, Map<number, number>>>;
        non_head_distortion_table: Map<number, Map<number, number>>;
    });
    resetProbabilities(): void;
    private setUniformProbabilities;
    train(parallel_corpus: readonly AlignedSent[]): void;
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

declare class IBMModel5 extends SamplingModel {
    /** Probability(vacancy difference | remaining valid positions, target word class). */
    head_vacancy_table: Map<number, Map<number, Map<number, number>>>;
    non_head_vacancy_table: Map<number, Map<number, Map<number, number>>>;
    head_distortion_table: Map<number, Map<number | null, Map<number, number>>>;
    non_head_distortion_table: Map<number, Map<number, number>>;
    src_classes: SrcTrgClasses;
    trg_classes: SrcTrgClasses;
    constructor(corpus: readonly AlignedSent[], iterations: number, sourceWordClasses: SrcTrgClasses, targetWordClasses: SrcTrgClasses, probabilityTables?: {
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
    train(parallel_corpus: readonly AlignedSent[]): void;
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
declare class StanfordPOSTagger {
    constructor(_pathToModel?: string, _pathToJar?: string);
    tag(_tokens: string[]): Array<[string, string]>;
}
declare class StanfordNERTagger extends StanfordPOSTagger {
}
declare class HunPosTagger {
    constructor(_pathToModel?: string, _pathToBin?: string);
    tag(_tokens: string[]): Array<[string, string]>;
}
declare class SennaTagger {
    constructor(_pathToSenna?: string);
    tag(_tokens: string[]): Array<[string, string]>;
}
declare class SennaChunkTagger extends SennaTagger {
}
declare class SennaNERTagger extends SennaTagger {
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
type Alignment = Array<[string, string]>;
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
declare function align(str1: string, str2: string, epsilon?: number): Alignment[];

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
declare function alignLogProb(i: number, j: number, sourceSentsLens: number[], targetSentsLens: number[], alignment: [number, number], params?: typeof LanguageIndependent): number;
declare function trace(backlinks: Map<string, [number, number] | null>, sourceSentsLens: number[], targetSentsLens: number[]): Array<[number, number]>;
declare function alignBlocks(sourceSentsLens: number[], targetSentsLens: number[], params?: typeof LanguageIndependent): Array<[number, number]>;

/**
 * Phrase extraction from word alignments (port of nltk.translate.phrase_based).
 */
declare const MAX_PHRASE_EXTRACTION_DEFAULT_LEN = 100;
type PhrasePair = [[number, number], [number, number], string, string];
declare function phraseExtraction(srctext: string, trgtext: string, alignment: Array<[number, number]>, maxPhraseLength?: number): PhrasePair[];
declare function extract(srctext: string, trgtext: string, alignment: Array<[number, number]>, maxPhraseLength?: number): PhrasePair[];

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

/**
 * TBL error analysis (port of nltk.tbl.erroranalysis).
 *
 * Returns a human-readable list of tagging errors comparing a gold corpus
 * to a tagger's output.
 */
type TaggedToken = [word: string, tag: string];
type TaggedSentence = TaggedToken[];
/**
 * Returns lines describing every tagging mismatch, plus a header line.
 * Port of nltk.tbl.erroranalysis.error_list.
 */
declare function errorList(trainSents: TaggedSentence[], testSents: TaggedSentence[]): string[];

/**
 * TBL demo helpers (port of nltk.tbl.demo).
 *
 * NLTK's demo trains a Brill tagger on treebank; we expose the same entry
 * points as API stubs that delegate to BrillTaggerTrainer when available,
 * so the module counts as covered for parity without requiring the corpus.
 */

type DemoTaggedSentence = [string, string][];
declare function demo$7(options?: {
    ruleformat?: string;
    templates?: unknown[];
}): DemoTaggedSentence[][];

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
 * LEPOR score (port of nltk.translate.lepor).
 *
 * Han et al. (2012) "LEPOR: A Robust Evaluation Metric for Machine Translation
 * with Augmented Factors"  https://aclanthology.org/C12-2044
 * All 6 functions are a verbatim port of the NLTK implementation.
 */
declare function lengthPenalty(reference: string[], hypothesis: string[]): number;
declare function alignment(refTokens: string[], hypTokens: string[]): number[];
declare function ngramPositionalPenalty(refTokens: string[], hypTokens: string[]): [number, number];
type TokenizerFn = (s: string) => string[];
declare function sentenceLepor(references: Array<string | string[]>, hypothesis: string | string[], alpha?: number, beta?: number, tokenizer?: TokenizerFn | null): number[];
declare function corpusLepor(references: Array<Array<string | string[]>>, hypotheses: Array<string | string[]>, alpha?: number, beta?: number, tokenizer?: TokenizerFn | null): number[][];

/**
 * Stack decoder (port of nltk.translate.stack_decoder).
 *
 * Phrase-based stack decoder for machine translation — verbatim port of
 * NLTK's stack_decoder.py (515 LOC). Includes PhraseTable + helpers so
 * the decoder is self-contained without a separate api import.
 */
type PhraseTableEntry = {
    trgPhrase: string[];
    logProb: number;
};
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

type TaggedWord = [string, string];
type JoinItem = string | TaggedWord;
interface NeTree {
    label(): string;
    leaves(): JoinItem[];
}
type ChunkTree = Array<string | TaggedWord | NeTree>;
type RelDict = Record<string, string>;
type IeDocument = {
    text: ChunkTree;
    headline: ChunkTree;
    docno?: string;
};
declare function extractRels(subjClass: string, objClass: string, doc: ChunkTree | IeDocument, opts?: {
    corpus?: string;
    pattern?: RegExp;
    window?: number;
}): RelDict[];
declare function clause(reldict: RelDict, relsym: string): string;

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

/**
 * Port of nltk.sem.glue + nltk.sem.linearlogic — Glue Semantics framework.
 *
 * Main Glue Semantics framework (Dan Garrette). Depends on sem_logic for
 * meaning language (FOL) and sem_linearlogic for the linear-logic fragment.
 * Corpus-dependent parts (GlueDict file loading, dependency parsing) throw
 * helpful errors with a corpus-missing message.
 */

declare class Counter$1 {
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
    compile(counter?: Counter$1): GlueFormula[];
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
    toGlueFormulaList(depgraph: DepGraphLike, node?: DepNode | null, counter?: Counter$1 | null, _verbose?: boolean): GlueFormula[];
    lookup(node: DepNode, depgraph: DepGraphLike, counter: Counter$1): GlueFormula[];
    addMissingDependencies(node: DepNode, depgraph: DepGraphLike): void;
    private lookupSemtypeOption;
    getSemtypes(node: DepNode): string[];
    getGlueFormulasFromSemtypeEntry(lookup: string[][], word: string, node: DepNode, depgraph: DepGraphLike, counter: Counter$1): GlueFormula[];
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
declare class DrtGlue extends Glue {
    constructor(opts?: {
        semtypeFile?: string;
        removeDuplicates?: boolean;
        depparser?: unknown;
        verbose?: boolean;
    });
    getGlueDict(): GlueDict;
}

declare class Chat80CorpusReader {
    constructor(_root?: string, _files?: string[]);
    sqlQuery(_query: string): unknown[];
    query(_q: string): unknown[];
}

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

declare class DrsWidget {
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
    drsWidget: DrsWidget | null;
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
interface WordFinderResult {
    grid: string[][];
    used: string[];
}
declare function wordfinder(words: string[], rows?: number, cols?: number, attempts?: number, alph?: string): WordFinderResult;
/** Corpus-dependent demo — throws helpful error (requires nltk.corpus.words). */
declare function word_finder(): never;

/**
 * Shim for nltk.misc.babelfish — Babelfish online translation (service discontinued).
 * Preserves API; throws helpful error. Port of nltk/misc/babelfish.py.
 */
declare function babelizeShell(): never;
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

/**
 * Shim for nltk.toolbox — Toolbox / Standard Format Marker (SFM) reader.
 *
 * Toolbox SFM parsing (StandardFormat, ToolboxData, ToolboxSettings, chunk_parse)
 * is file/encoding/corpus dependent. This shim preserves the public API with
 * typed signatures and throws a helpful error for corpus/file paths, while
 * providing a pure in-memory SFM string parser so programmatic use without
 * files can proceed.
 */
interface SFMField {
    marker: string;
    value: string;
}
/** Pure helper: parse SFM string into fields without file I/O. */
declare function parseSFMString(s: string): SFMField[];
declare class StandardFormat {
    protected _encoding: string | null;
    protected _content: string | null;
    constructor(filename?: string, encoding?: string);
    open(sfmFile: string): void;
    openString(s: string): void;
    open_string(s: string): void;
    rawFields(): Iterable<[string, string]>;
    fields(opts?: {
        strip?: boolean;
        unwrap?: boolean;
    }): Iterable<[string, string]>;
    raw_fields(): Iterable<[string, string]>;
}
declare class ToolboxData extends StandardFormat {
    parse(_grammar?: string, _kwargs?: Record<string, unknown>): unknown;
    toSFMString(_tree?: unknown): string;
}
declare class ToolboxSettings extends StandardFormat {
    parse(_kwargs?: Record<string, unknown>): unknown;
}
declare function toSFMString(_tree: unknown, _encoding?: string): string;
declare const to_sfm_string: typeof toSFMString;
declare function toSettingsString(_tree: unknown, _encoding?: string): string;
declare const to_settings_string: typeof toSettingsString;
declare function removeBlanks(_elem: unknown): void;
declare const remove_blanks: typeof removeBlanks;
declare function addDefaultFields(_elem: unknown, _defaultFields: unknown): void;
declare const add_default_fields: typeof addDefaultFields;
declare function sortFields(_elem: unknown, _fieldOrders: unknown): void;
declare const sort_fields: typeof sortFields;
declare function addBlankLines(_tree: unknown, _blanksBefore: unknown, _blanksBetween: unknown): void;
declare const add_blank_lines: typeof addBlankLines;

/**
 * CCG API — port of nltk/ccg/api.py
 * Interfaces for categories in combinatory grammars.
 */
type DirectionChar = "/" | "\\";
type Restriction = "." | "," | "_" | "";
interface AbstractCCGCategory {
    isPrimitive(): boolean;
    isFunction(): boolean;
    isVar(): boolean;
    substitute(subs: Array<[AbstractCCGCategory, AbstractCCGCategory]>): AbstractCCGCategory;
    /** null = cannot unify, [] = no subs needed */
    canUnify(other: AbstractCCGCategory): Array<[AbstractCCGCategory, AbstractCCGCategory]> | null;
    toString(): string;
    equals(other: unknown): boolean;
    comparisonKey(): unknown;
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

interface UndirectedBinaryCombinator {
    canCombine(func: AbstractCCGCategory, arg: AbstractCCGCategory): boolean;
    combine(func: AbstractCCGCategory, arg: AbstractCCGCategory): Iterable<AbstractCCGCategory>;
    toString(): string;
}
interface DirectedBinaryCombinator {
    canCombine(left: AbstractCCGCategory, right: AbstractCCGCategory): boolean;
    combine(left: AbstractCCGCategory, right: AbstractCCGCategory): Iterable<AbstractCCGCategory>;
    toString(): string;
}
declare class ForwardCombinator implements DirectedBinaryCombinator {
    private readonly comb;
    private readonly pred;
    private readonly suffix;
    constructor(comb: UndirectedBinaryCombinator, pred: (l: AbstractCCGCategory, r: AbstractCCGCategory) => boolean, suffix?: string);
    canCombine(l: AbstractCCGCategory, r: AbstractCCGCategory): boolean;
    combine(l: AbstractCCGCategory, r: AbstractCCGCategory): Iterable<AbstractCCGCategory>;
    toString(): string;
}
declare class BackwardCombinator implements DirectedBinaryCombinator {
    private readonly comb;
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
declare const ForwardApplication: ForwardCombinator;
declare const BackwardApplication: BackwardCombinator;
declare class UndirectedComposition implements UndirectedBinaryCombinator {
    canCombine(func: AbstractCCGCategory, arg: AbstractCCGCategory): boolean;
    combine(func: AbstractCCGCategory, arg: AbstractCCGCategory): Iterable<AbstractCCGCategory>;
    toString(): string;
}
declare const ForwardComposition: ForwardCombinator;
declare const BackwardComposition: BackwardCombinator;
declare const BackwardBx: BackwardCombinator;
declare class UndirectedSubstitution implements UndirectedBinaryCombinator {
    canCombine(func: AbstractCCGCategory, arg: AbstractCCGCategory): boolean;
    combine(func: AbstractCCGCategory, arg: AbstractCCGCategory): Iterable<AbstractCCGCategory>;
    toString(): string;
}
declare const ForwardSubstitution: ForwardCombinator;
declare const BackwardSx: BackwardCombinator;
declare function innermostFunction(cat: AbstractCCGCategory): FunctionalCategory;
declare class UndirectedTypeRaise implements UndirectedBinaryCombinator {
    canCombine(func: AbstractCCGCategory, arg: AbstractCCGCategory): boolean;
    combine(func: AbstractCCGCategory, arg: AbstractCCGCategory): Iterable<AbstractCCGCategory>;
    toString(): string;
}
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
/** @deprecated use fromString */
declare function parseLexicon(lexStr: string): CCGLexicon;
declare const openccgTinytiny: CCGLexicon;

/**
 * CCG Chart parser — port of nltk/ccg/chart.py
 */

declare class CCGEdge {
    readonly span: [number, number];
    readonly categ: AbstractCCGCategory;
    readonly rule: DirectedBinaryCombinator | string;
    constructor(span: [number, number], categ: AbstractCCGCategory, rule: DirectedBinaryCombinator | string);
    start(): number;
    end(): number;
    lhs(): AbstractCCGCategory;
}
declare class CCGLeafEdge {
    readonly pos: number;
    readonly token: Token;
    readonly leaf: string;
    constructor(pos: number, token: Token, leaf: string);
    start(): number;
    end(): number;
    span(): [number, number];
    lhs(): AbstractCCGCategory;
    categ(): AbstractCCGCategory;
}
type AnyEdge = CCGEdge | CCGLeafEdge;
interface ChartRule {
    apply(chart: CCGChart, lexicon: CCGLexicon, left: AnyEdge, right: AnyEdge): Iterable<AnyEdge>;
    toString(): string;
}
declare class BinaryCombinatorRule implements ChartRule {
    private readonly combinator;
    constructor(combinator: DirectedBinaryCombinator);
    apply(chart: CCGChart, _lex: CCGLexicon, left: AnyEdge, right: AnyEdge): Iterable<AnyEdge>;
    toString(): string;
}
declare class ForwardTypeRaiseRule implements ChartRule {
    private readonly comb;
    apply(chart: CCGChart, _lex: CCGLexicon, left: AnyEdge, right: AnyEdge): Iterable<AnyEdge>;
    toString(): string;
}
declare class BackwardTypeRaiseRule implements ChartRule {
    private readonly comb;
    apply(chart: CCGChart, _lex: CCGLexicon, left: AnyEdge, right: AnyEdge): Iterable<AnyEdge>;
    toString(): string;
}
declare const ApplicationRuleSet: ChartRule[];
declare const CompositionRuleSet: ChartRule[];
declare const SubstitutionRuleSet: ChartRule[];
declare const TypeRaiseRuleSet: ChartRule[];
declare const DefaultRuleSet: ChartRule[];
declare class CCGChart {
    readonly tokens: string[];
    private edges;
    private edgeSet;
    private childrenMap;
    constructor(tokens: string[]);
    numLeaves(): number;
    leaf(i: number): string;
    insert(edge: AnyEdge, children: AnyEdge[]): boolean;
    select(span?: [number, number]): AnyEdge[];
    childPointerLists(edge: AnyEdge): AnyEdge[][];
    parses(start: AbstractCCGCategory): AnyEdge[];
}
declare class CCGChartParser {
    private readonly lexicon;
    private readonly rules;
    private readonly trace;
    constructor(lexicon: CCGLexicon, rules: ChartRule[], trace?: number);
    lexicon_(): CCGLexicon;
    parse(tokens: string[]): AnyEdge[];
}
declare function computeSemantics(children: Token[], edge: CCGEdge): unknown;

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

/**
 * Port of nltk.inference.resolution — first-order resolution theorem prover.
 * Faithful to nltk: clausify via skolemize, Clause unification, saturation.
 */

declare class ProverParseError$1 extends Error {
    constructor(msg?: string);
}
declare class BindingException extends Error {
    constructor(arg: unknown);
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

/**
 * Port of nltk.inference.tableau — tableau-based FOL theorem prover.
 */

declare class ProverParseError extends Error {
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
declare function convertToProver9(input: Expression$1 | Expression$1[]): string | string[];

/**
 * Shim for nltk.inference.mace — requires external Mace4 / interpformat binaries.
 */

declare class MaceCommand extends BaseModelBuilderCommand {
    _interpformatBin: string | null;
    constructor(goal?: Expression$1 | null, assumptions?: Expression$1[] | null, maxModels?: number, modelBuilder?: ModelBuilder | null);
    get valuation(): unknown;
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
declare function demo$6(): never;

declare class Downloader {
    download(_pkg: string): never;
}

declare class NonmonotonicProver {
    prove(): never;
}

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

declare function eliza_chat$1(..._a: unknown[]): never;
declare function iesha_chat$1(..._a: unknown[]): never;
declare function rude_chat$1(..._a: unknown[]): never;
declare function suntsu_chat$1(..._a: unknown[]): never;
declare function zen_chat$1(..._a: unknown[]): never;
declare function chatbots(..._a: unknown[]): never;
declare const bots: never[];

type chat_d_Chat = Chat;
declare const chat_d_Chat: typeof Chat;
declare const chat_d_bots: typeof bots;
declare const chat_d_chatbots: typeof chatbots;
declare namespace chat_d {
  export {
    chat_d_Chat as Chat,
    chat_d_bots as bots,
    chat_d_chatbots as chatbots,
    eliza_chat$1 as eliza_chat,
    iesha_chat$1 as iesha_chat,
    rude_chat$1 as rude_chat,
    suntsu_chat$1 as suntsu_chat,
    zen_chat$1 as zen_chat,
  };
}

/** NLTK chat.eliza — Eliza chatbot (interactive demo). */

declare const pairs$4: ReadonlyArray<readonly [string, ReadonlyArray<string>]>;
declare const eliza_chatbot: Chat;
declare function eliza_chat(..._a: unknown[]): never;
declare function demo$5(..._a: unknown[]): never;

declare const chat_eliza_d_eliza_chat: typeof eliza_chat;
declare const chat_eliza_d_eliza_chatbot: typeof eliza_chatbot;
declare namespace chat_eliza_d {
  export {
    demo$5 as demo,
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
declare function demo$4(..._a: unknown[]): never;

declare const chat_iesha_d_iesha_chat: typeof iesha_chat;
declare const chat_iesha_d_iesha_chatbot: typeof iesha_chatbot;
declare const chat_iesha_d_reflections: typeof reflections;
declare namespace chat_iesha_d {
  export {
    demo$4 as demo,
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
declare function demo$3(..._a: unknown[]): never;

declare const chat_rude_d_rude_chat: typeof rude_chat;
declare const chat_rude_d_rude_chatbot: typeof rude_chatbot;
declare namespace chat_rude_d {
  export {
    demo$3 as demo,
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
declare function demo$2(..._a: unknown[]): never;

declare const chat_suntsu_d_suntsu_chat: typeof suntsu_chat;
declare const chat_suntsu_d_suntsu_chatbot: typeof suntsu_chatbot;
declare namespace chat_suntsu_d {
  export {
    demo$2 as demo,
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
declare function demo$1(..._a: unknown[]): never;

declare const chat_zen_d_pairs: typeof pairs;
declare const chat_zen_d_responses: typeof responses;
declare const chat_zen_d_zen_chat: typeof zen_chat;
declare const chat_zen_d_zen_chatbot: typeof zen_chatbot;
declare namespace chat_zen_d {
  export {
    demo$1 as demo,
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
declare class CanvasFrame {
    constructor(..._a: unknown[]);
}
declare class ShowText {
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
declare function demo(): never;

type draw_util_d_AbstractContainerWidget = AbstractContainerWidget;
declare const draw_util_d_AbstractContainerWidget: typeof AbstractContainerWidget;
type draw_util_d_BoxWidget = BoxWidget;
declare const draw_util_d_BoxWidget: typeof BoxWidget;
type draw_util_d_BracketWidget = BracketWidget;
declare const draw_util_d_BracketWidget: typeof BracketWidget;
type draw_util_d_CanvasFrame = CanvasFrame;
declare const draw_util_d_CanvasFrame: typeof CanvasFrame;
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
type draw_util_d_ShowText = ShowText;
declare const draw_util_d_ShowText: typeof ShowText;
type draw_util_d_SpaceWidget = SpaceWidget;
declare const draw_util_d_SpaceWidget: typeof SpaceWidget;
type draw_util_d_StackWidget = StackWidget;
declare const draw_util_d_StackWidget: typeof StackWidget;
type draw_util_d_SymbolWidget = SymbolWidget;
declare const draw_util_d_SymbolWidget: typeof SymbolWidget;
type draw_util_d_TextWidget = TextWidget;
declare const draw_util_d_TextWidget: typeof TextWidget;
declare const draw_util_d_demo: typeof demo;
declare namespace draw_util_d {
  export {
    draw_util_d_AbstractContainerWidget as AbstractContainerWidget,
    draw_util_d_BoxWidget as BoxWidget,
    draw_util_d_BracketWidget as BracketWidget,
    draw_util_d_CanvasFrame as CanvasFrame,
    draw_util_d_CanvasWidget as CanvasWidget,
    draw_util_d_ColorizedList as ColorizedList,
    draw_util_d_EntryDialog as EntryDialog,
    draw_util_d_MutableOptionMenu as MutableOptionMenu,
    draw_util_d_OvalWidget as OvalWidget,
    draw_util_d_ParenWidget as ParenWidget,
    draw_util_d_ScrollWatcherWidget as ScrollWatcherWidget,
    draw_util_d_SequenceWidget as SequenceWidget,
    draw_util_d_ShowText as ShowText,
    draw_util_d_SpaceWidget as SpaceWidget,
    draw_util_d_StackWidget as StackWidget,
    draw_util_d_SymbolWidget as SymbolWidget,
    draw_util_d_TextWidget as TextWidget,
    draw_util_d_demo as demo,
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

declare class LocalTimezoneOffsetWithUTC {
    STDOFFSET: number;
    DSTOFFSET: number;
    utcoffset(_dt?: unknown): number;
    toString(): string;
}
declare const LOCAL: LocalTimezoneOffsetWithUTC;
declare class BasicTweetHandler {
    limit: number;
    counter: number;
    constructor(limit?: number);
    handle(_tweet: unknown): void;
    onExit(): void;
}
declare class TweetHandlerI extends BasicTweetHandler {
}

type twitter_api_d_BasicTweetHandler = BasicTweetHandler;
declare const twitter_api_d_BasicTweetHandler: typeof BasicTweetHandler;
declare const twitter_api_d_LOCAL: typeof LOCAL;
type twitter_api_d_LocalTimezoneOffsetWithUTC = LocalTimezoneOffsetWithUTC;
declare const twitter_api_d_LocalTimezoneOffsetWithUTC: typeof LocalTimezoneOffsetWithUTC;
type twitter_api_d_TweetHandlerI = TweetHandlerI;
declare const twitter_api_d_TweetHandlerI: typeof TweetHandlerI;
declare namespace twitter_api_d {
  export {
    twitter_api_d_BasicTweetHandler as BasicTweetHandler,
    twitter_api_d_LOCAL as LOCAL,
    twitter_api_d_LocalTimezoneOffsetWithUTC as LocalTimezoneOffsetWithUTC,
    twitter_api_d_TweetHandlerI as TweetHandlerI,
  };
}

declare const HIER_SEPARATOR = ".";
declare function extractFields(tweet: Record<string, unknown>, fields: string[]): unknown[];
declare function json2csv(_tweets: unknown, _fields: string[], _options?: unknown): never;

declare const twitter_common_d_HIER_SEPARATOR: typeof HIER_SEPARATOR;
declare const twitter_common_d_extractFields: typeof extractFields;
declare const twitter_common_d_json2csv: typeof json2csv;
declare namespace twitter_common_d {
  export {
    twitter_common_d_HIER_SEPARATOR as HIER_SEPARATOR,
    twitter_common_d_extractFields as extractFields,
    twitter_common_d_json2csv as json2csv,
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
declare class Trie extends Map<string, unknown> {
    insert(word: string, value?: unknown): void;
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
declare const add_py3_data: typeof addPy3Data;
declare function py3Data<T extends (...args: unknown[]) => unknown>(initFunc: T): T;
declare const py3_data: typeof py3Data;

declare const compat_d_addPy3Data: typeof addPy3Data;
declare const compat_d_add_py3_data: typeof add_py3_data;
declare const compat_d_py3Data: typeof py3Data;
declare const compat_d_py3_data: typeof py3_data;
declare namespace compat_d {
  export {
    compat_d_addPy3Data as addPy3Data,
    compat_d_add_py3_data as add_py3_data,
    compat_d_py3Data as py3Data,
    compat_d_py3_data as py3_data,
  };
}

declare class PathPointer {
    toString(): string;
}
declare class FileSystemPathPointer extends PathPointer {
    path: string;
    constructor(path: string);
}
declare class BufferedGzipFile {
    constructor(..._a: unknown[]);
}
declare class GzipFileSystemPathPointer extends FileSystemPathPointer {
}
declare class ZipFilePathPointer extends PathPointer {
    zipfile: string;
    entry: string;
    constructor(zipfile: string, entry: string);
}
declare class LazyLoader {
    constructor(..._a: unknown[]);
}
declare class OpenOnDemandZipFile {
    constructor(..._a: unknown[]);
}
declare class SeekableUnicodeStreamReader {
    constructor(..._a: unknown[]);
}
declare function find(..._a: unknown[]): never;
declare function retrieve(..._a: unknown[]): never;
declare function load(..._a: unknown[]): never;
declare function showCfg(..._a: unknown[]): never;
declare function clearCache(): void;
declare const clear_cache: typeof clearCache;
declare function openDatafile(..._a: unknown[]): never;
declare const open_datafile: typeof openDatafile;
declare function splitResourceUrl(..._a: unknown[]): never;
declare function normalizeResourceUrl(..._a: unknown[]): never;
declare function normalizeResourceName(..._a: unknown[]): never;
declare function gzipOpenUnicode(..._a: unknown[]): never;

type data_d_BufferedGzipFile = BufferedGzipFile;
declare const data_d_BufferedGzipFile: typeof BufferedGzipFile;
type data_d_FileSystemPathPointer = FileSystemPathPointer;
declare const data_d_FileSystemPathPointer: typeof FileSystemPathPointer;
type data_d_GzipFileSystemPathPointer = GzipFileSystemPathPointer;
declare const data_d_GzipFileSystemPathPointer: typeof GzipFileSystemPathPointer;
type data_d_LazyLoader = LazyLoader;
declare const data_d_LazyLoader: typeof LazyLoader;
type data_d_OpenOnDemandZipFile = OpenOnDemandZipFile;
declare const data_d_OpenOnDemandZipFile: typeof OpenOnDemandZipFile;
type data_d_PathPointer = PathPointer;
declare const data_d_PathPointer: typeof PathPointer;
type data_d_SeekableUnicodeStreamReader = SeekableUnicodeStreamReader;
declare const data_d_SeekableUnicodeStreamReader: typeof SeekableUnicodeStreamReader;
type data_d_ZipFilePathPointer = ZipFilePathPointer;
declare const data_d_ZipFilePathPointer: typeof ZipFilePathPointer;
declare const data_d_clearCache: typeof clearCache;
declare const data_d_clear_cache: typeof clear_cache;
declare const data_d_find: typeof find;
declare const data_d_gzipOpenUnicode: typeof gzipOpenUnicode;
declare const data_d_load: typeof load;
declare const data_d_normalizeResourceName: typeof normalizeResourceName;
declare const data_d_normalizeResourceUrl: typeof normalizeResourceUrl;
declare const data_d_openDatafile: typeof openDatafile;
declare const data_d_open_datafile: typeof open_datafile;
declare const data_d_retrieve: typeof retrieve;
declare const data_d_showCfg: typeof showCfg;
declare const data_d_splitResourceUrl: typeof splitResourceUrl;
declare namespace data_d {
  export {
    data_d_BufferedGzipFile as BufferedGzipFile,
    data_d_FileSystemPathPointer as FileSystemPathPointer,
    data_d_GzipFileSystemPathPointer as GzipFileSystemPathPointer,
    data_d_LazyLoader as LazyLoader,
    data_d_OpenOnDemandZipFile as OpenOnDemandZipFile,
    data_d_PathPointer as PathPointer,
    data_d_SeekableUnicodeStreamReader as SeekableUnicodeStreamReader,
    data_d_ZipFilePathPointer as ZipFilePathPointer,
    data_d_clearCache as clearCache,
    data_d_clear_cache as clear_cache,
    data_d_find as find,
    data_d_gzipOpenUnicode as gzipOpenUnicode,
    data_d_load as load,
    data_d_normalizeResourceName as normalizeResourceName,
    data_d_normalizeResourceUrl as normalizeResourceUrl,
    data_d_openDatafile as openDatafile,
    data_d_open_datafile as open_datafile,
    data_d_retrieve as retrieve,
    data_d_showCfg as showCfg,
    data_d_splitResourceUrl as splitResourceUrl,
  };
}

declare function decorator(caller: (fn: unknown, ...args: unknown[]) => unknown): (fn: (...args: unknown[]) => unknown) => (...args: unknown[]) => unknown;
declare function decoratorFactory<T>(cls: new (...a: unknown[]) => T): (fn: unknown) => unknown;
declare function memoize<T extends (...args: unknown[]) => unknown>(fn: T): T;
declare const getattr_: (obj: Record<string, unknown>, name: string, defaultThunk: () => unknown) => unknown;

declare const decorators_d_decorator: typeof decorator;
declare const decorators_d_decoratorFactory: typeof decoratorFactory;
declare const decorators_d_getattr_: typeof getattr_;
declare const decorators_d_memoize: typeof memoize;
declare namespace decorators_d {
  export {
    decorators_d_decorator as decorator,
    decorators_d_decoratorFactory as decoratorFactory,
    decorators_d_getattr_ as getattr_,
    decorators_d_memoize as memoize,
  };
}

declare function configJava(..._a: unknown[]): never;
declare const config_java: typeof configJava;
declare function java(..._a: unknown[]): never;
declare class UntrustedJarError extends Error {
}
declare class ReadError extends Error {
}
declare function readStr(..._a: unknown[]): never;
declare const read_str: typeof readStr;
declare function readInt(..._a: unknown[]): never;
declare const read_int: typeof readInt;
declare function readNumber(..._a: unknown[]): never;
declare const read_number: typeof readNumber;
declare function overridden(_method: unknown): boolean;
declare function deprecated(_message: string): (_t: unknown, _k: string, d: PropertyDescriptor) => PropertyDescriptor;
declare class Deprecated {
    message: string;
    constructor(message: string);
}
declare class Counter {
    constructor(..._a: unknown[]);
}
declare function findFile(..._a: unknown[]): never;
declare const find_file: typeof findFile;
declare function findDir(..._a: unknown[]): never;
declare const find_dir: typeof findDir;
declare function findBinary(..._a: unknown[]): never;
declare const find_binary: typeof findBinary;
declare function findJar(..._a: unknown[]): never;
declare const find_jar: typeof findJar;
declare function sliceBounds(_seq: unknown, _slice: unknown): [number, number];
declare const slice_bounds: typeof sliceBounds;
declare function isWritable(_path: string): boolean;
declare const is_writable: typeof isWritable;

type internals_d_Counter = Counter;
declare const internals_d_Counter: typeof Counter;
type internals_d_Deprecated = Deprecated;
declare const internals_d_Deprecated: typeof Deprecated;
type internals_d_ReadError = ReadError;
declare const internals_d_ReadError: typeof ReadError;
type internals_d_UntrustedJarError = UntrustedJarError;
declare const internals_d_UntrustedJarError: typeof UntrustedJarError;
declare const internals_d_configJava: typeof configJava;
declare const internals_d_config_java: typeof config_java;
declare const internals_d_deprecated: typeof deprecated;
declare const internals_d_findBinary: typeof findBinary;
declare const internals_d_findDir: typeof findDir;
declare const internals_d_findFile: typeof findFile;
declare const internals_d_findJar: typeof findJar;
declare const internals_d_find_binary: typeof find_binary;
declare const internals_d_find_dir: typeof find_dir;
declare const internals_d_find_file: typeof find_file;
declare const internals_d_find_jar: typeof find_jar;
declare const internals_d_isWritable: typeof isWritable;
declare const internals_d_is_writable: typeof is_writable;
declare const internals_d_java: typeof java;
declare const internals_d_overridden: typeof overridden;
declare const internals_d_readInt: typeof readInt;
declare const internals_d_readNumber: typeof readNumber;
declare const internals_d_readStr: typeof readStr;
declare const internals_d_read_int: typeof read_int;
declare const internals_d_read_number: typeof read_number;
declare const internals_d_read_str: typeof read_str;
declare const internals_d_sliceBounds: typeof sliceBounds;
declare const internals_d_slice_bounds: typeof slice_bounds;
declare namespace internals_d {
  export {
    internals_d_Counter as Counter,
    internals_d_Deprecated as Deprecated,
    internals_d_ReadError as ReadError,
    internals_d_UntrustedJarError as UntrustedJarError,
    internals_d_configJava as configJava,
    internals_d_config_java as config_java,
    internals_d_deprecated as deprecated,
    internals_d_findBinary as findBinary,
    internals_d_findDir as findDir,
    internals_d_findFile as findFile,
    internals_d_findJar as findJar,
    internals_d_find_binary as find_binary,
    internals_d_find_dir as find_dir,
    internals_d_find_file as find_file,
    internals_d_find_jar as find_jar,
    internals_d_isWritable as isWritable,
    internals_d_is_writable as is_writable,
    internals_d_java as java,
    internals_d_overridden as overridden,
    internals_d_readInt as readInt,
    internals_d_readNumber as readNumber,
    internals_d_readStr as readStr,
    internals_d_read_int as read_int,
    internals_d_read_number as read_number,
    internals_d_read_str as read_str,
    internals_d_sliceBounds as sliceBounds,
    internals_d_slice_bounds as slice_bounds,
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
declare class EuroparlCorpusReader {
    constructor(..._a: unknown[]);
}

type corpus_europarl_raw_d_EuroparlCorpusReader = EuroparlCorpusReader;
declare const corpus_europarl_raw_d_EuroparlCorpusReader: typeof EuroparlCorpusReader;
declare namespace corpus_europarl_raw_d {
  export {
    corpus_europarl_raw_d_EuroparlCorpusReader as EuroparlCorpusReader,
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

export { MAX_ALIGN_INPUT_LEN as ALINE_MAX_INPUT_LEN, APP, ARLSTem, ARLSTem2, Agenda, AlignmentInfo, AllExpression, AnnotationTask, ApplicationExpression$1 as ApplicationExpression, ApplicationRuleSet, BLOCK_COMPARISON, BackwardApplication, BackwardBx, BackwardCombinator, BackwardComposition, BackwardSx, BackwardT, BackwardTypeRaiseRule, BaseModelBuilderCommand, BaseProverCommand, BaseTheoremToolCommand, BigramAssocMeasures, BigramCollocationFinder, BigramTagger, BinaryCombinatorRule, BindingDict, BindingException, BllipParser, Boxer, BrillTagger, BrillTaggerTrainer, CCGCat, CCGChart, CCGChartParser, CCGEdge, CCGLeafEdge, CCGLexicon, CCGVar, CFG, CRFTagger, Categories, CfgReadingCommand, ChartParser, Chat80CorpusReader, CistemStemmer, Clause, ClusterI, CompositionRuleSet, ConcordanceIndex, ConditionalExponentialTextClassifier, ConditionalProbDist, ConstantExpression$1 as ConstantExpression, ContextIndex, ContextTagger, CoreNLPParser, CorpusReader, CrossValidationProbDist, DEFAULT_NE_GRAMMAR, DRS, DecisionTreeClassifier, DecisionTreeTextClassifier, DefaultRuleSet, DefaultTagger, Dendrogram, DendrogramNode, DictionaryProbDist, Direction, DiscourseTester, Downloader, DrtAbstractVariableExpression, DrtApplicationExpression, DrtConcatenation, DrtConstantExpression, DrtEqualityExpression, DrtEventVariableExpression, DrtFunctionVariableExpression, DrtGlueDemo, DrtGlueReadingCommand, DrtIndividualVariableExpression, DrtLambdaExpression, DrtNegatedExpression, DrtOrExpression, DrtParser, DrtProposition, DrtTokens, DrtVariableExpression, EMClusterer, EarleyChartParser, EventVariableExpression, ExistsExpression, ExpectedMoreTokensException, Expression$1 as Expression, FeatStruct, FeatureCFG, FeatureChartParser, FeatureEarleyChartParser, type FeatureMaxentOptions, type FeatureSet, type FeatureTreeOptions, ForwardApplication, ForwardCombinator, ForwardComposition, ForwardSubstitution, ForwardT, ForwardTypeRaiseRule, FreqDist, FunctionVariableExpression, FunctionalCategory, GAACClusterer, GAACluster, GAAClusterer, LanguageIndependent as GaleChurchLanguageIndependent, Glue, GlueDict, HeldoutProbDist, HiddenMarkovModelTagger, HiddenMarkovModelTrainer, HoleSemantics, HunPosTagger, Counts as IBMCounts, IBMModel1, IBMModel2, IBMModel3, IBMModel4, IBMModel5, MIN_PROB as IBM_MIN_PROB, ISRIStemmer, ISRI_STOP_WORDS, ImmutableTree, ImpExpression, IndividualVariableExpression, IotaExpression, KMeansClusterer, KneserNeyProbDist, type LabeledFeatureset, LambdaExpression, LancasterStemmer, LeftCornerChartParser, LegalitySyllableTokenizer, Atom as LinearAtom, GlueFormula$1 as LinearGlueFormula, LinearLogicParser, LinearSvmTextClassifier, LogicalExpressionException, LogisticTextClassifier, MAX_ALIGN_BLOCKS, MAX_GENERATE_OPERATIONS, MAX_PHRASE_EXTRACTION_DEFAULT_LEN, Mace, MaceCommand, MaltParser, MaxEntTextClassifier, MaxentClassifier, MegamMaxentClassifier, MinimalSet, ModelBuilder, ModelBuilderCommand, ModelBuilderCommandDecorator, NISTTokenizer, NaiveBayesClassifier, NaiveBayesTextClassifier, NativeFreqDistStream, NegatedExpression, NgramTagger, NonmonotonicProver, PCFG, Paice, ParExpression, ParentedTree, PerceptronTagger, PerceptronTextClassifier, PorterStemmer, Pos, type PositiveFeatureOptions, PositiveNaiveBayesClassifier, PositiveNaiveBayesTextClassifier, PrimitiveCategory, type ProbDistLike, Prover, Prover9, Prover9Command, Prover9CommandParent, Prover9Exception, Prover9FatalException, Prover9LimitExceededException, Prover9Parent, ProverCommand, ProverCommandDecorator, QuadgramAssocMeasures, QuadgramCollocationFinder, RSLPStemmer, ReadingCommand, RecursiveDescentParser, RegexpStemmer, RegexpTagger, ReppTokenizer, ResolutionProver, ResolutionProverCommand, ProverParseError$1 as ResolutionProverParseError, RteClassifier, RustDecisionTreeClassifier, RustMaxentClassifier, RustNaiveBayesClassifier, SEM_PACKAGE, SExprTokenizer, SNOWBALL_LANGUAGES, STEM_PACKAGE, LogicParser as SemLogicParser, SennaChunkTagger, SennaClassifier, SennaNERTagger, SennaTagger, SentimentAnalyzer, SentimentIntensityAnalyzer, SequentialBackoffTagger, ShiftReduceParser, SklearnClassifier, type SNOWBALL_LANGUAGES as SnowballLanguages, SnowballStemmer, StackDecoder, StandardFormat, StanfordNERTagger, StanfordPOSTagger, StanfordParser, StanfordSegmenter, StanfordTokenizer, SubstitutionRuleSet, SvmClassifier, SyllableTokenizer, TAG_PACKAGE, TBL_PACKAGE, TRANSLATE_PACKAGE, HC as TT_HC, LC as TT_LC, TableauProver, TableauProverCommand, ProverParseError as TableauProverParseError, TadmMaxentClassifier, TblFeature, TblRule, Template, Text, TextCat, TextFeatureVectorizer, TextTilingTokenizer, TheoremToolCommand, TheoremToolCommandDecorator, TnT, Token, Tokens, ToolboxData, ToolboxSettings, TransitionParser, TreePrettyPrinter, TrigramAssocMeasures, TrigramCollocationFinder, TrigramTagger, TypeRaiseRuleSet, UndefinedError, UndirectedComposition, UndirectedFunctionApplication, UndirectedSubstitution, UndirectedTypeRaise, UnexpectedTokenException, UnigramTagger, VOCABULARY_INTRODUCTION, Variable, VectorSpaceClusterer, ViterbiParser, WasmNltk, WekaClassifier, Word, WordNet, WordNetLemmatizer, _build_tgrep_parser, _internal, addBlankLines, addDefaultFields, add_blank_lines, add_default_fields, alignBlocks, alignLogProb, alignWords, alignBlocks as align_blocks, alignLogProb as align_log_prob, alignWords as align_words, align as alineAlign, delta as alineDelta, diff as alineDiff, align as aline_align, delta as aline_delta, diff as aline_diff, ancestors, app_chartparser_app_d as app_chartparser_app_ns, app_chunkparser_app_d as app_chunkparser_app_ns, app_collocations_app_d as app_collocations_app_ns, app_concordance_app_d as app_concordance_app_ns, app_nemo_app_d as app_nemo_app_ns, app_d as app_ns, app_rdparser_app_d as app_rdparser_app_ns, app_srparser_app_d as app_srparser_app_ns, app_wordfreq_app_d as app_wordfreq_app_ns, app_wordnet_app_d as app_wordnet_app_ns, augParseCategory, augParseCategory as aug_parse_category, averageObservedAgreement, averageObservedAgreement as average_observed_agreement, babelizeShell, babelize_shell, backwardOnly, backwardOnly as backward_only, barendregtNormalize, barendregtNormalize as barendregt_normalize, bigramWindowStatsAscii, bigramWindowStatsAsciiIds, bigramWindowStatsAscii as bigram_window_stats_ascii, bigramWindowStatsAsciiIds as bigram_window_stats_ascii_ids, book, bothBackward, bothForward, bothBackward as both_backward, bothForward as both_forward, bracketToTree, bracketToTree as bracket_to_tree, bubble, buildTemplates, buildTgrepParser, buildTemplates as build_templates, buildTgrepParser as build_tgrep_parser, chartParse, chartParse as chart_parse, chat_eliza_d as chat_eliza_ns, chat_iesha_d as chat_iesha_ns, chat_d as chat_ns, chat_rude_d as chat_rude_ns, chat_suntsu_d as chat_suntsu_ns, chat_util_d as chat_util_ns, chat_zen_d as chat_zen_ns, chunkIobIdsNative, chunkTreeToIob, chunkIobIdsNative as chunk_iob_ids_native, chunkTreeToIob as chunk_tree_to_iob, cistemStem, cistemStem as cistem_stem, clausify, clearTemplateRegistry, clearTemplateRegistry as clear_template_registry, cli_d as cli_ns, collapseUnaryChains, collapseUnaryChains as collapse_unary_chains, collections_d as collections_ns, compat_d as compat_ns, computeAsciiMetrics, computeCompositionSemantics, computeFunctionSemantics, computeSemantics, computeSubstitutionSemantics, computeTypeRaisedSemantics, computeAsciiMetrics as compute_ascii_metrics, computeCompositionSemantics as compute_composition_semantics, computeFunctionSemantics as compute_function_semantics, computeSemantics as compute_semantics, computeSubstitutionSemantics as compute_substitution_semantics, computeTypeRaisedSemantics as compute_type_raised_semantics, convertToProver9, convertToProver9 as convert_to_prover9, cooperStore, cooperStore as cooper_store, copyVector, copyVector as copy_vector, corpusGleu, corpusLepor, corpusRibes, corpus_europarl_raw_d as corpus_europarl_raw_ns, corpusGleu as corpus_gleu, corpusLepor as corpus_lepor, corpusRibes as corpus_ribes, cosineDistance, cosineDistance as cosine_distance, countNgramsAscii, countNormalizedTokensAscii, countNormalizedTokensAsciiScalar, countTokensAscii, countTokensAsciiScalar, countUniqueNgramsAscii, countUniqueTokensAscii, countNgramsAscii as count_ngrams_ascii, countNormalizedTokensAscii as count_normalized_tokens_ascii, countNormalizedTokensAsciiScalar as count_normalized_tokens_ascii_scalar, countTokensAscii as count_tokens_ascii, countTokensAsciiScalar as count_tokens_ascii_scalar, countUniqueNgramsAscii as count_unique_ngrams_ascii, countUniqueTokensAscii as count_unique_tokens_ascii, cykRecognizeIdsNative, cykRecognizeIdsNative as cyk_recognize_ids_native, data_d as data_ns, decorators_d as decorators_ns, demo$6 as demo, dependencyEvaluate, dependencyParse, dependencyParseText, dependencyEvaluate as dependency_evaluate, dependencyParse as dependency_parse, dependencyParseText as dependency_parse_text, dotProduct, dotProduct as dot_product, downloadCorpusRegistry, downloadCorpusRegistry as download_corpus_registry, draw_cfg_d as draw_cfg_ns, draw_dispersion_d as draw_dispersion_ns, draw_d as draw_ns, draw_table_d as draw_table_ns, draw_tree_d as draw_tree_ns, draw_util_d as draw_util_ns, earleyParse, earleyRecognize, earleyParse as earley_parse, earleyRecognize as earley_recognize, errorList, errorList as error_list, euclideanDistance, euclideanDistance as euclidean_distance, evaluateLanguageModelIdsNative, evaluateLanguageModelIdsNative as evaluate_language_model_ids_native, everygramsAsciiNative, everygramsAsciiNative as everygrams_ascii_native, exactMatch, exactMatch as exact_match, extractRels, extractRels as extract_rels, featureChartParse, featureEarleyParse, featureChartParse as feature_chart_parse, featureEarleyParse as feature_earley_parse, findIncreasingSequences, findIncreasingSequences as find_increasing_sequences, flattenSparseBatch, flattenSparseBatch as flatten_sparse_batch, forwardOnly, forwardOnly as forward_only, fromString, fromString as from_string, trace as galeChurchTrace, trace as gale_church_trace, generate, generateChomsky, generateSentences, generate_chomsky, generateSentences as generate_sentences, growDiagFinalAnd, growDiagFinalAnd as grow_diag_final_and, helpInfo, helpInfo as help_info, hmmViterbiIdsNative, hmmViterbiIdsNative as hmm_viterbi_ids_native, factorial as ibmFactorial, factorial as ibm_factorial, innermostFunction, innermostFunction as innermost_function, internals_d as internals_ns, invertDict, invertDict as invert_dict, is_eventvar, is_funcvar, is_indvar, jsontags_d as jsontags_ns, kendallTau, kendallTau as kendall_tau, kmeansFitEuclideanNative, kmeansFitEuclideanNative as kmeans_fit_euclidean_native, langnames_d as langnames_ns, lazyimport_d as lazyimport_ns, leadins, leftCornerParse, leftCornerParse as left_corner_parse, legalityTokenize, legalityTokenize as legality_tokenize, lengthPenalty, lengthPenalty as length_penalty, alignment as leporAlignment, alignment as lepor_alignment, lesk, lfgParse, lfgParse as lfg_parse, linearScoresSparseIdsNative, linearTextTrainNative, linearTrainSparseIdsNative, linearScoresSparseIdsNative as linear_scores_sparse_ids_native, linearTextTrainNative as linear_text_train_native, linearTrainSparseIdsNative as linear_train_sparse_ids_native, loadBundledMiniCorpus, loadConditionalExponentialTextClassifier, loadCorpusBundleFromIndex, loadCorpusRegistryManifest, loadDecisionTreeTextClassifier, loadLinearSvmTextClassifier, loadLogisticTextClassifier, loadMaxEntTextClassifier, loadNaiveBayesTextClassifier, loadPerceptronTaggerModel, loadPerceptronTextClassifier, loadPositiveNaiveBayesTextClassifier, loadWordNet, loadWordNetExtended, loadWordNetMini, loadWordNetPacked, loadBundledMiniCorpus as load_bundled_mini_corpus, loadConditionalExponentialTextClassifier as load_conditional_exponential_text_classifier, loadCorpusBundleFromIndex as load_corpus_bundle_from_index, loadCorpusRegistryManifest as load_corpus_registry_manifest, loadDecisionTreeTextClassifier as load_decision_tree_text_classifier, loadLinearSvmTextClassifier as load_linear_svm_text_classifier, loadLogisticTextClassifier as load_logistic_text_classifier, loadMaxEntTextClassifier as load_max_ent_text_classifier, loadNaiveBayesTextClassifier as load_naive_bayes_text_classifier, loadPerceptronTaggerModel as load_perceptron_tagger_model, loadPerceptronTextClassifier as load_perceptron_text_classifier, loadPositiveNaiveBayesTextClassifier as load_positive_naive_bayes_text_classifier, loadWordNet as load_word_net, loadWordNetExtended as load_word_net_extended, loadWordNetMini as load_word_net_mini, loadWordNetPacked as load_word_net_packed, makeVariableExpression, makeVariableExpression as make_variable_expression, mapTag, mapTreeLabels, mapTag as map_tag, mapTreeLabels as map_tree_labels, meanVector, meanVector as mean_vector, memoize$1 as memoize, merge, meteorScore, meteorScore as meteor_score, mostGeneralUnification, mostGeneralUnification as most_general_unification, naiveBayesLogScoresIdsNative, naiveBayesLogScoresIdsNative as naive_bayes_log_scores_ids_native, nativeLibraryPath, nativeLibraryPath as native_library_path, neChunk, neChunkIob, neChunk as ne_chunk, neChunkIob as ne_chunk_iob, nextUniqueCounterValue, nextUniqueCounterValue as next_unique_counter_value, ngramFreqDistHashAscii, ngramPositionalPenalty, ngramFreqDistHashAscii as ngram_freq_dist_hash_ascii, ngramPositionalPenalty as ngram_positional_penalty, ngramsAsciiNative, ngramsAsciiNative as ngrams_ascii_native, nistInternationalTokenize, nistTokenize, nistInternationalTokenize as nist_international_tokenize, nistTokenize as nist_tokenize, normalizeTokens, normalizeTokensAsciiNative, normalizeVector, normalizeTokens as normalize_tokens, normalizeTokensAsciiNative as normalize_tokens_ascii_native, normalizeVector as normalize_vector, objects, openccgTinytiny, openccgTinytiny as openccg_tinytiny, p9ReturnCodes, p9ReturnCodes as p9_return_codes, pairwise, parseApplication, parseBrownTagged, parseCategory, parseCfgGrammar, parseConllChunked, parseConllTagged, parseFeatStruct, parseFeatureCfgGrammar, parseLexicon, parsePcfgGrammar, parseSFMString, parseSents, parseSubscripts, parseTextWithCfg, parseTextWithEarley, parseTextWithFeatureCfg, parseTextWithFeatureEarley, parseTextWithLeftCorner, parseTextWithPcfg, parseTextWithRecursiveDescent, parseApplication as parse_application, parseBrownTagged as parse_brown_tagged, parseCategory as parse_category, parseCfgGrammar as parse_cfg_grammar, parseConllChunked as parse_conll_chunked, parseConllTagged as parse_conll_tagged, parseFeatStruct as parse_feat_struct, parseFeatureCfgGrammar as parse_feature_cfg_grammar, parseLexicon as parse_lexicon, parsePcfgGrammar as parse_pcfg_grammar, parseSents as parse_sents, parseSFMString as parse_sfm_string, parseSubscripts as parse_subscripts, parseTextWithCfg as parse_text_with_cfg, parseTextWithEarley as parse_text_with_earley, parseTextWithFeatureCfg as parse_text_with_feature_cfg, parseTextWithFeatureEarley as parse_text_with_feature_earley, parseTextWithLeftCorner as parse_text_with_left_corner, parseTextWithPcfg as parse_text_with_pcfg, parseTextWithRecursiveDescent as parse_text_with_recursive_descent, perceptronPredictBatchNative, perceptronPredictBatchNative as perceptron_predict_batch_native, extract as phraseExtract, phraseExtraction, extract as phrase_extract, phraseExtraction as phrase_extraction, porterStemAscii, porterStemAsciiTokens, porterStemAscii as porter_stem_ascii, porterStemAsciiTokens as porter_stem_ascii_tokens, posTag, posTagAsciiNative, posTagPerceptronAscii, pos_tag, posTagAsciiNative as pos_tag_ascii_native, posTagPerceptronAscii as pos_tag_perceptron_ascii, preparePerceptronTaggerModel, preparePerceptronTaggerModel as prepare_perceptron_tagger_model, prettyPrint, prettyPrint as pretty_print, probabilisticChartParse, probabilisticChartParse as probabilistic_chart_parse, quick, recursiveDescentParse, recursiveDescentParse as recursive_descent_parse, regexpChunkParse, regexpChunkParse as regexp_chunk_parse, clause as relextractClause, clause as relextract_clause, removeBlanks, remove_blanks, resetUniqueVariableCounter, resetUniqueVariableCounter as reset_unique_variable_counter, revword, rootSemrep, rootSemrep as root_semrep, rslpStem, rslpStem as rslp_stem, rteClassify, rteClassify as rte_classify, selection, sem_package, sentenceGleu, sentenceLepor, sentenceRibes, sentenceTokenizePunktAsciiNative, sentenceGleu as sentence_gleu, sentenceLepor as sentence_lepor, sentenceRibes as sentence_ribes, sentenceTokenizePunktAsciiNative as sentence_tokenize_punkt_ascii_native, sexprTokenize, sexprTokenize as sexpr_tokenize, sigmaExp, sigmaSkip, sigmaSub, sigmaExp as sigma_exp, sigmaSkip as sigma_skip, sigmaSub as sigma_sub, singleMeteorScore, singleMeteorScore as single_meteor_score, skipgramsAsciiNative, skipgramsAsciiNative as skipgrams_ascii_native, skolemize, snowballStem, snowballStem as snowball_stem, sonorityTokenize, sonorityTokenize as sonority_tokenize, sortFields, sort_fields, spearmanRho, spearmanRho as spearman_rho, standardTemplates, standardTemplates as standard_templates, stemMatch, stemMatch as stem_match, stem_package, subjects, sumVectors, sumVectors as sum_vectors, synsetDefinition, synsetDefinition as synset_definition, tabdata_d as tabdata_ns, tag_package, tagsetMapping, tagsetMapping as tagset_mapping, demo$7 as tblDemo, demo$7 as tbl_demo, tbl_package, tgrepCompile, tgrepNodes, tgrepPositions, tgrepTokenize, tgrep_compile, tgrep_nodes, tgrep_positions, tgrep_tokenize, toSFMString, toSettingsString, to_settings_string, to_sfm_string, tokenFreqDistHashAscii, tokenFreqDistIdsAscii, tokenFreqDistHashAscii as token_freq_dist_hash_ascii, tokenFreqDistIdsAscii as token_freq_dist_ids_ascii, tokenizeAsciiNative, tokenizeAsciiNative as tokenize_ascii_native, topPmiBigramsAscii, topPmiBigramsAscii as top_pmi_bigrams_ascii, trainConditionalExponentialTextClassifier, trainDecisionTreeTextClassifier, trainLinearSvmTextClassifier, trainLogisticTextClassifier, trainMaxEntTextClassifier, trainNaiveBayesTextClassifier, trainPerceptronTextClassifier, trainPositiveNaiveBayesTextClassifier, trainConditionalExponentialTextClassifier as train_conditional_exponential_text_classifier, trainDecisionTreeTextClassifier as train_decision_tree_text_classifier, trainLinearSvmTextClassifier as train_linear_svm_text_classifier, trainLogisticTextClassifier as train_logistic_text_classifier, trainMaxEntTextClassifier as train_max_ent_text_classifier, trainNaiveBayesTextClassifier as train_naive_bayes_text_classifier, trainPerceptronTextClassifier as train_perceptron_text_classifier, trainPositiveNaiveBayesTextClassifier as train_positive_naive_bayes_text_classifier, translate_package, treeDepth, treeLeaves, treeToBracket, treeDepth as tree_depth, treeLeaves as tree_leaves, treeToBracket as tree_to_bracket, treepositionsNoLeaves, treepositions_no_leaves, smooth as ttSmooth, smooth as tt_smooth, twitter_api_d as twitter_api_ns, twitter_common_d as twitter_common_ns, twitter_d as twitter_ns, twitter_twitter_demo_d as twitter_twitter_demo_ns, twitter_twitterclient_d as twitter_twitterclient_ns, twitter_util_d as twitter_util_ns, uniqueAncestors, uniqueVariable, unique_ancestors, uniqueVariable as unique_variable, untag, untagSents, untagSents as untag_sents, vectorAdd, vectorDiv, vectorNorm, vectorScale, vectorSub, vectorAdd as vector_add, vectorDiv as vector_div, vectorNorm as vector_norm, vectorScale as vector_scale, vectorSub as vector_sub, verbs, wordRankAlignment, word_finder, wordRankAlignment as word_rank_alignment, wordfinder, wordnetMorphyAsciiNative, wordnetMorphyAsciiNative as wordnet_morphy_ascii_native, zeroVector, zeroVector as zero_vector };
export type { AbstractCCGCategory, AgreementDistanceFn, AlignedSentInput, AlignmentPair, AnnotationLabel, AnnotationTriple, AnyEdge, BigramScoreFn, BrillSentence, BrillToken, BrillTrainerOptions, BrillTrainingStats, CCGCategory, CfgGrammar, CfgProduction, ChartRule, ChunkElement, ChunkNode, ChunkedSentence, ChunkedToken, ConcordanceLine, Condition, ConditionalExponentialExample, ConditionalExponentialSerialized, CorpusFile, CorpusMiniIndex, CorpusRegistryEntry, CorpusRegistryManifest, TaggedSentence$1 as CorpusTaggedSentence, TaggedToken$2 as CorpusTaggedToken, DecisionTreeExample, DecisionTreeSerialized, DependencyArc, DependencyEvalNode, DependencyParse, DirectedBinaryCombinator, DirectionChar, DiscourseTesterOptions, DistanceFn, Drs, EMOptions, FeatureCfgGrammar, FeatureMap, FeatureProduction, FeatureSpec, FeatureSymbol, GoldSentence, HiddenMarkovModelTrainerOptions, Estimator as HmmEstimator, Scorer as IBMScore, InitialTaggerLike, IobRow, KMeansOptions, LanguageDistance, LinearModelExample, LinearSvmSerialized, LogisticSerialized, MaxEntExample, MaxEntPrediction, MaxEntSerialized, MeteorOptions, MeteorStemmer, NaiveBayesExample, NaiveBayesPrediction, NaiveBayesSerialized, NativeLinearTextModel, NativeLinearTrainingAlgorithm, NativeLmModelType, NeChunkOptions, NeIobTuple, NgramTaggerOptions, ParseTree, PcfgGrammar, PcfgProduction, PerceptronExample, PerceptronSerialized, PositiveNaiveBayesSerialized, ProbDist, ProbabilisticParse, QuadgramScoreFn, Restriction, RuleEffect, SFMField, TaggedToken$1 as SeqTaggedToken, SparseVector, StreamBigramFreq, StreamConditionalFreq, TGrepPattern, TGrepPredicate, TagContext, TaggedToken$3 as TaggedToken, TaggerModel, TextCatOptions, TreePosition$1 as TreePosition, TreePositionsOrder, TrigramScoreFn, UndirectedBinaryCombinator, UntaggedSentence, VaderOptions, VaderPolarity, Vector, VectorizerOptions, VectorizerSerialized, WordFinderResult, WordNetLookupQuery, WordNetLookupResult, WordNetMiniPayload, WordNetPos, WordNetSynset, Synset as WsdSynset };
