type AsciiMetrics = {
    tokens: number;
    uniqueTokens: number;
    ngrams: number;
    uniqueNgrams: number;
};
type WasmNltkInit = {
    wasmBytes?: Uint8Array;
    wasmPath?: string;
    wasmUrl?: string | URL;
    maxInputBytes?: number;
};
type WasmLmModelType = "mle" | "lidstone" | "kneser_ney_interpolated";
type AsciiMetricsStreamOptions = {
    maxTokenBytes?: number;
    maxUniqueTokens?: number;
    maxUniqueNgrams?: number;
};
type AsciiMetricsStream = {
    update(chunk: Uint8Array): void;
    finish(): AsciiMetrics;
    dispose(): void;
};
declare class WasmNltk {
    private readonly exports;
    private inputPtr;
    private readonly maxInputBytes;
    private disposed;
    private readonly encoder;
    private readonly decoder;
    private readonly blocks;
    private constructor();
    static initSync(wasmBytes: Uint8Array, maxInputBytes?: number): WasmNltk;
    private static fromInstance;
    static init(init?: WasmNltkInit): Promise<WasmNltk>;
    get memoryBytes(): number;
    dispose(): void;
    private assertActive;
    private assertOrder;
    categoricalNaiveBayesTrain(input: {
        pairs: Uint32Array;
        offsets: Uint32Array;
        labels: Uint32Array;
        labelCount: number;
        smoothing: number;
    }): number;
    categoricalNaiveBayesPredict(handle: number, pairs: Uint32Array, labelCount: number): Float64Array;
    positiveCategoricalNaiveBayesTrain(input: {
        positivePairs: Uint32Array;
        positiveOffsets: Uint32Array;
        unlabeledPairs: Uint32Array;
        unlabeledOffsets: Uint32Array;
        positivePrior: number;
        smoothing: number;
    }): number;
    categoricalNaiveBayesFree(handle: number): void;
    categoricalMaxentTrain(input: {
        pairs: Uint32Array;
        offsets: Uint32Array;
        labels: Uint32Array;
        labelCount: number;
        algorithm: "iis" | "gis";
        maxIter: number;
        countCutoff: number;
        minLl?: number;
        minLldelta?: number;
        maxAcc?: number;
        minAccdelta?: number;
    }): number;
    categoricalMaxentLoad(input: {
        features: Uint32Array;
        weights: Float64Array;
        labelCount: number;
        algorithm: "iis" | "gis";
        correction?: number;
    }): number;
    categoricalMaxentPredict(handle: number, pairs: Uint32Array, labelCount: number): Float64Array;
    categoricalMaxentFeatureCount(handle: number): number;
    categoricalMaxentWeightCount(handle: number): number;
    categoricalMaxentCorrection(handle: number): number;
    categoricalMaxentFeatures(handle: number): Uint32Array;
    categoricalMaxentWeights(handle: number): Float64Array;
    categoricalMaxentFree(handle: number): void;
    private copyU32;
    private copyF64;
    decisionTreeTrain(input: {
        pairs: Uint32Array;
        offsets: Uint32Array;
        labels: Uint32Array;
        labelCount: number;
        entropyCutoff: number;
        depthCutoff: number;
        supportCutoff: number;
        binary: boolean;
    }): number;
    decisionTreeClassify(handle: number, pairs: Uint32Array): number;
    decisionTreeLabels(handle: number, labelCount: number): Uint32Array;
    decisionTreeFree(handle: number): void;
    private distanceInputs;
    editDistance(left: string, right: string, options?: {
        substitutionCost?: number;
        transpositions?: boolean;
    }): number;
    editDistanceAlign(left: string, right: string, substitutionCost?: number): Array<[number, number]>;
    private assertNoError;
    private ensureBlock;
    private writeInput;
    private writeBytes;
    /** Exact streaming aggregates; memory scales with distinct keys, not input size. */
    createAsciiMetricsStream(n: number, options?: AsciiMetricsStreamOptions): AsciiMetricsStream;
    countTokensAscii(text: string): number;
    countNgramsAscii(text: string, n: number): number;
    computeAsciiMetrics(text: string, n: number): AsciiMetrics;
    tokenOffsetsAscii(text: string): {
        total: number;
        offsets: Uint32Array;
        lengths: Uint32Array;
        input: Uint8Array;
    };
    normalizedTokenOffsetsAscii(text: string, removeStopwords?: boolean): {
        total: number;
        offsets: Uint32Array;
        lengths: Uint32Array;
        input: Uint8Array;
    };
    tokenizeAscii(text: string): string[];
    sentenceTokenizePunktAscii(text: string): string[];
    normalizeTokensAscii(text: string, removeStopwords?: boolean): string[];
    perceptronPredictBatch(featureIds: Uint32Array, tokenOffsets: Uint32Array, weights: Float32Array, modelFeatureCount: number, tagCount: number): Uint16Array;
    wordnetMorphyAscii(word: string, pos?: "n" | "v" | "a" | "r"): string;
    evaluateLanguageModelIds(input: {
        tokenIds: Uint32Array;
        sentenceOffsets: Uint32Array;
        order: number;
        model: WasmLmModelType;
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
    chunkIobIds(input: {
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
    cykRecognizeIds(input: {
        tokenBits: BigUint64Array;
        binaryLeft: Uint16Array;
        binaryRight: Uint16Array;
        binaryParent: Uint16Array;
        unaryChild: Uint16Array;
        unaryParent: Uint16Array;
        startSymbol: number;
    }): boolean;
    naiveBayesLogScoresIds(input: {
        docTokenIds: Uint32Array;
        vocabSize: number;
        tokenCountsMatrix: Uint32Array;
        labelDocCounts: Uint32Array;
        labelTokenTotals: Uint32Array;
        totalDocs: number;
        smoothing: number;
    }): Float64Array;
    /**
     * Batched BLEU sufficient statistics over token-ID streams.
     *
     * Input mirrors the corpus shape of `nltk.translate.bleu_score.corpus_bleu`:
     * one hypothesis per group of 1+ references. Returns per-order
     * [clipped_1..5, total_1..5, refLen, hypLen] so the JS caller can apply any
     * NLTK smoothing/brevity-penalty variant exactly.
     */
    bleuStatsIds(input: {
        refsFlat: Uint32Array;
        refsOffsets: Uint32Array;
        hypRefGroupStarts: Uint32Array;
        hypRefCounts: Uint32Array;
        hypsFlat: Uint32Array;
        hypsOffsets: Uint32Array;
        maxOrder: number;
    }): {
        clipped: BigUint64Array;
        totals: BigUint64Array;
        refLen: bigint;
        hypLen: bigint;
    };
    /**
     * Batched NIST sufficient statistics over token-ID streams.
     * Returns flat [numerator_1..5, denominator_1..5, lRef, lSys]; JS combines
     * them with `nistLengthPenalty` to reproduce `nltk.translate.nist_score`.
     */
    nistStatsIds(input: {
        refsFlat: Uint32Array;
        refsOffsets: Uint32Array;
        hypRefGroupStarts: Uint32Array;
        hypRefCounts: Uint32Array;
        hypsFlat: Uint32Array;
        hypsOffsets: Uint32Array;
        n: number;
    }): {
        numerators: Float64Array;
        denominators: Float64Array;
        lRef: number;
        lSys: number;
    };
}

export { WasmNltk };
export type { AsciiMetrics, AsciiMetricsStream, AsciiMetricsStreamOptions, WasmLmModelType, WasmNltkInit };
