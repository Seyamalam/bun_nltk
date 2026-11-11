import { W as WasmNltk } from './wasm.d-vEZU3EsV.js';
import { FeatureValue } from '../feature_types.js';

/** Preserve Python float-vs-int identity, including integral floats (1.0). */
type PythonFloatFeature = {
    readonly pythonType: "float";
    readonly value: number;
};
declare function pythonFloat(value: number): PythonFloatFeature;
declare const PYTHON_INT: unique symbol;
declare const PYTHON_FLOAT: unique symbol;
declare const PYTHON_BOOL: unique symbol;
type MaxentFeatureValue = FeatureValue | PythonFloatFeature;
type MaxentFeatureset = Record<string, MaxentFeatureValue>;
type MaxentEncodingExample = readonly [MaxentFeatureset, string];
type MaxentMappingValue = MaxentFeatureValue | typeof PYTHON_INT | typeof PYTHON_FLOAT | typeof PYTHON_BOOL;
type MaxentFeatureMapping = Iterable<readonly [readonly [string, MaxentMappingValue, string], number]>;
type MaxentEncodingOptions = {
    unseen_features?: boolean;
    alwayson_features?: boolean;
};
type SerializedValue = {
    type: "int" | "float" | "bool" | "none" | "pythonFloat";
    value?: number;
} | {
    type: "value";
    value: string | number | boolean;
};
type MaxentEncodingSerialized = {
    version: 1;
    typed: boolean;
    labels: string[];
    mapping: Array<[[string, SerializedValue, string], number]>;
    alwaysOn: boolean;
    unseen: boolean;
};
/** Rust-owned NLTK joint encoding, usable standalone or for MaxEnt training. */
declare class BinaryMaxentFeatureEncoding {
    protected typed: boolean;
    private readonly names;
    private readonly values;
    private readonly valueObjects;
    private readonly displayIds;
    private readonly labelIds;
    private labelNames;
    private handle;
    private descriptors;
    private disposed;
    constructor(labels: Iterable<string>, mapping: MaxentFeatureMapping, unseen_features?: boolean, alwayson_features?: boolean);
    private label;
    private value;
    private display;
    private inputs;
    private readDescriptors;
    static train(train_toks: Iterable<MaxentEncodingExample>, count_cutoff?: number, labels?: Iterable<string> | null, options?: MaxentEncodingOptions): BinaryMaxentFeatureEncoding;
    encode(featureset: MaxentFeatureset, label: string): Array<[number, number]>;
    labels(): string[];
    length(): number;
    toJSON(): MaxentEncodingSerialized;
    static fromJSON(payload: MaxentEncodingSerialized): BinaryMaxentFeatureEncoding;
    describe(f_id: number): string;
    dispose(): void;
}
declare class TypedMaxentFeatureEncoding extends BinaryMaxentFeatureEncoding {
    static train(train_toks: Iterable<MaxentEncodingExample>, count_cutoff?: number, labels?: Iterable<string> | null, options?: MaxentEncodingOptions): TypedMaxentFeatureEncoding;
}

type FreqDistInput<S> = FreqDist<S> | ReadonlyMap<S, number> | Iterable<S> | Record<string, number>;
type ConditionalFreqDistInput<C, S> = ConditionalFreqDist<C, S> | ReadonlyMap<C, FreqDist<S>> | Iterable<readonly [C, S]>;
declare class FreqDist<S> implements Iterable<S> {
    #private;
    constructor(samples?: FreqDistInput<S>);
    static fromTextAscii(text: string, options?: {
        native?: boolean;
    }): FreqDist<string>;
    get(sample: S): number;
    count(sample: S): number;
    has(sample: S): boolean;
    set(sample: S, count: number): this;
    inc(sample: S, count?: number): this;
    delete(sample: S): boolean;
    clear(): void;
    update(samples?: FreqDistInput<S>): this;
    N(): number;
    B(): number;
    freq(sample: S): number;
    max(): S;
    hapaxes(): S[];
    r_Nr(bins?: number): Record<number, number>;
    Nr(r: number, bins?: number): number;
    mostCommon(count?: number): Array<[S, number]>;
    samples(): S[];
    copy(): FreqDist<S>;
    add(other: FreqDist<S>): FreqDist<S>;
    subtract(other: FreqDist<S>): FreqDist<S>;
    union(other: FreqDist<S>): FreqDist<S>;
    intersection(other: FreqDist<S>): FreqDist<S>;
    setdefault(sample: S, count: number): void;
    pop(sample: S, defaultValue?: number): number | undefined;
    popitem(): [S, number] | undefined;
    elements(): IterableIterator<S>;
    isSubsetOf(other: FreqDist<S>): boolean;
    isSupersetOf(other: FreqDist<S>): boolean;
    lt(other: FreqDist<S>): boolean;
    gt(other: FreqDist<S>): boolean;
    cumulativeFrequencies(samples: Iterable<S>): Generator<number>;
    tabulate(count?: number, options?: {
        samples?: S[];
        cumulative?: boolean;
        writer?: (line: string) => void;
    }): void;
    equals(other: FreqDist<S>): boolean;
    pformat(maxlen?: number): string;
    pprint(maxlen?: number, writer?: (line: string) => void): void;
    keys(): IterableIterator<S>;
    values(): IterableIterator<number>;
    entries(): IterableIterator<[S, number]>;
    [Symbol.iterator](): IterableIterator<S>;
    toString(): string;
}
declare class ConditionalFreqDist<C, S> implements Iterable<C> {
    #private;
    constructor(condSamples?: ConditionalFreqDistInput<C, S>);
    static fromTaggedTextAscii(text: string, options?: {
        native?: boolean;
    }): ConditionalFreqDist<string, string>;
    get(condition: C): FreqDist<S>;
    peek(condition: C): FreqDist<S> | undefined;
    has(condition: C): boolean;
    set(condition: C, dist: FreqDist<S>): this;
    delete(condition: C): boolean;
    clear(): void;
    update(condSamples?: ConditionalFreqDistInput<C, S>): this;
    conditions(): C[];
    N(): number;
    copy(): ConditionalFreqDist<C, S>;
    add(other: ConditionalFreqDist<C, S>): ConditionalFreqDist<C, S>;
    subtract(other: ConditionalFreqDist<C, S>): ConditionalFreqDist<C, S>;
    union(other: ConditionalFreqDist<C, S>): ConditionalFreqDist<C, S>;
    intersection(other: ConditionalFreqDist<C, S>): ConditionalFreqDist<C, S>;
    isSubsetOf(other: ConditionalFreqDist<C, S>): boolean;
    isSupersetOf(other: ConditionalFreqDist<C, S>): boolean;
    equals(other: ConditionalFreqDist<C, S>): boolean;
    keys(): IterableIterator<C>;
    values(): IterableIterator<FreqDist<S>>;
    entries(): IterableIterator<[C, FreqDist<S>]>;
    [Symbol.iterator](): IterableIterator<C>;
    toString(): string;
}

interface ProbDistLike<T> {
    prob(sample: T): number;
    logprob(sample: T): number;
    logProb?(sample: T): number;
    max(): T;
    samples(): Iterable<T>;
}
declare function addLogs(logx: number, logy: number): number;
declare function sumLogs(logs: number[]): number;
declare function logLikelihood<T>(testPdist: ProbDistLike<T>, actualPdist: ProbDistLike<T>): number;
declare function entropy<T>(pdist: ProbDistLike<T>): number;
declare abstract class ProbDistI<T> implements ProbDistLike<T> {
    /** NLTK ``SUM_TO_ONE`` — overridden by distributions that don't. */
    static readonly SUM_TO_ONE: boolean;
    abstract prob(sample: T): number;
    abstract max(): T;
    abstract samples(): Iterable<T>;
    logprob(sample: T): number;
    logProb(sample: T): number;
    /** NLTK ``ProbDistI.discount``: base distributions don't discount. */
    discount(): number;
    /**
     * NLTK ``generate``: weighted reservoir — draw p ~ U(0,1), walk samples
     * subtracting prob until p <= 0; trailing rounding slack (< 0.0001)
     * returns the last sample; otherwise warn (SUM_TO_ONE) and draw uniformly.
     */
    generate(random?: () => number): T;
}
declare class DictionaryProbDist<T> extends ProbDistI<T> {
    #private;
    constructor(probDict?: ReadonlyMap<T, number> | Record<string, number>, log?: boolean, normalize?: boolean);
    prob(sample: T): number;
    logprob(sample: T): number;
    max(): T;
    samples(): IterableIterator<T>;
    toString(): string;
}
declare class MLEProbDist<T> extends ProbDistI<T> {
    #private;
    constructor(freqDistValue: FreqDist<T>);
    freqdist(): FreqDist<T>;
    prob(sample: T): number;
    max(): T;
    samples(): Iterable<T>;
    toString(): string;
}
declare class LidstoneProbDist<T> extends ProbDistI<T> {
    /** NLTK: Lidstone only sums to one when bins cover every possible sample. */
    static readonly SUM_TO_ONE = false;
    protected readonly freqDistValue: FreqDist<T>;
    protected gammaValue: number;
    protected readonly totalCount: number;
    protected readonly binsValue: number;
    protected divisor: number;
    constructor(freqdist: FreqDist<T>, gamma: number, bins?: number);
    freqdist(): FreqDist<T>;
    prob(sample: T): number;
    max(): T;
    samples(): Iterable<T>;
    discount(): number;
    toString(): string;
}
declare class LaplaceProbDist<T> extends LidstoneProbDist<T> {
    constructor(freqdist: FreqDist<T>, bins?: number);
    toString(): string;
}
declare class ELEProbDist<T> extends LidstoneProbDist<T> {
    constructor(freqdist: FreqDist<T>, bins?: number);
    toString(): string;
}
type ProbDistFactory<T, Args extends unknown[] = []> = (new (freqdist: FreqDist<T>, ...args: Args) => ProbDistLike<T>) | ((freqdist: FreqDist<T>, ...args: Args) => ProbDistLike<T>);
declare class WittenBellProbDist<T> extends ProbDistI<T> {
    #private;
    constructor(freqdist: FreqDist<T>, bins?: number);
    prob(sample: T): number;
    max(): T;
    samples(): Iterable<T>;
    freqdist(): FreqDist<T>;
    discount(): never;
    toString(): string;
}
declare class SimpleGoodTuringProbDist<T> extends ProbDistI<T> {
    #private;
    /** NLTK: smoothed mass does not sum to one. */
    static readonly SUM_TO_ONE = false;
    constructor(freqdist: FreqDist<T>, bins?: number);
    smoothedNr(r: number): number;
    smoothed_nr(r: number): number;
    prob(sample: T): number;
    discount(): number;
    max(): T;
    samples(): Iterable<T>;
    freqdist(): FreqDist<T>;
    toString(): string;
}
declare class UniformProbDist<T> extends ProbDistI<T> {
    #private;
    constructor(samples: Iterable<T>);
    prob(sample: T): number;
    max(): T;
    samples(): Iterable<T>;
}
declare class MutableProbDist<T> extends ProbDistI<T> {
    #private;
    constructor(probDist: ProbDistLike<T>, samples: Iterable<T>, storeLogs?: boolean);
    update(sample: T, value: number, log?: boolean): void;
    prob(sample: T): number;
    logprob(sample: T): number;
    max(): T;
    samples(): IterableIterator<T>;
}
declare class RandomProbDist<T> extends ProbDistI<T> {
    #private;
    /**
     * Generates a random probability distribution whereby each sample
     * will be between 0 and 1 with equal probability (uniform random
     * distribution — also called a continuous uniform distribution).
     * `random` is an injectable U(0,1) source (NLTK uses `random.random()`).
     */
    constructor(samples: Iterable<T>, random?: () => number);
    /**
     * The key function that creates a randomized initial distribution
     * that still sums to 1.  Returned as a Map so it can be passed to
     * MutableProbDist with identical syntax to UniformProbDist.
     * NLTK quirk: `samples` is de-duplicated via `set()` before drawing.
     */
    static unirand<T>(samples: Iterable<T>, random?: () => number): Map<string, {
        sample: T;
        value: number;
    }>;
    max(): T;
    prob(sample: T): number;
    samples(): Iterable<T>;
}
declare abstract class ConditionalProbDistI<C, T> {
    abstract get(condition: C): ProbDistLike<T>;
    abstract conditions(): C[];
}

declare class ConditionalProbDist<C, T, Args extends unknown[] = unknown[]> extends ConditionalProbDistI<C, T> {
    #private;
    constructor(cfdist: ConditionalFreqDist<C, T>, probdistFactory: ProbDistFactory<T, Args>, ...factoryArgs: Args);
    get(condition: C): ProbDistLike<T>;
    peek(condition: C): ProbDistLike<T> | undefined;
    conditions(): C[];
    prob(condition: C, sample: T): number;
    logprob(condition: C, sample: T): number;
    logProb(condition: C, sample: T): number;
    entries(): IterableIterator<[C, ProbDistLike<T>]>;
}
declare class DictionaryConditionalProbDist<C, T> extends ConditionalProbDistI<C, T> {
    private readonly distributions;
    constructor(probdists: ReadonlyMap<C, ProbDistLike<T>> | Iterable<readonly [C, ProbDistLike<T>]>);
    update(probdists: Iterable<readonly [C, ProbDistLike<T>]>): void;
    get(condition: C): ProbDistLike<T>;
    peek(condition: C): ProbDistLike<T> | undefined;
    conditions(): C[];
    entries(): IterableIterator<[C, ProbDistLike<T>]>;
}

type FeatureMaxentOptions = {
    algorithm?: "iis" | "gis";
    maxIter?: number;
    minLl?: number;
    minLldelta?: number;
    maxAcc?: number;
    minAccdelta?: number;
    countCutoff?: number;
    /** Restrict and order labels exactly as NLTK's `labels=` argument. */
    labels?: string[];
    /** Explicit NLTK joint encoding. GIS requires its C property. */
    encoding?: BinaryMaxentFeatureEncoding & {
        readonly C?: number;
    };
    /** NLTK keyword aliases. */
    max_iter?: number;
    min_ll?: number;
    min_lldelta?: number;
    max_acc?: number;
    min_accdelta?: number;
    count_cutoff?: number;
};
type DefaultFeatureMaxentSerialized = {
    version: 1;
    algorithm: "iis" | "gis";
    labels: string[];
    names: string[];
    values: string[];
    features: [number, number, number][];
    weights: number[];
    correction?: number;
};
type CustomFeatureMaxentSerialized = {
    version: 2;
    algorithm: "iis" | "gis";
    encoding: MaxentEncodingSerialized;
    weights: Array<number | "-Infinity">;
    constant?: number;
};
type FeatureMaxentSerialized = DefaultFeatureMaxentSerialized | CustomFeatureMaxentSerialized;
/** Lossless Rust feature-dictionary MaxEnt matching NLTK's MaxentClassifier. */
declare class RustMaxentClassifier {
    private disposed;
    private readonly runtime;
    private readonly handle;
    private readonly labelNames;
    private readonly encoding;
    private readonly algorithm;
    private readonly correction?;
    private readonly customEncoding?;
    private readonly ownsEncoding;
    private constructor();
    static train(runtime: WasmNltk, examples: Iterable<MaxentEncodingExample>, options?: FeatureMaxentOptions): RustMaxentClassifier;
    /** Rows follow NLTK's label order; probabilities are already normalized. */
    predict(features: MaxentFeatureset): Array<{
        label: string;
        logProb: number;
        probability: number;
    }>;
    classify(features: MaxentFeatureset): string;
    classifyMany(features: Iterable<MaxentFeatureset>): string[];
    labels(): string[];
    classify_many(features: Iterable<MaxentFeatureset>): string[];
    probClassify(features: MaxentFeatureset): DictionaryProbDist<string>;
    prob_classify(features: MaxentFeatureset): DictionaryProbDist<string>;
    probClassifyMany(features: Iterable<MaxentFeatureset>): DictionaryProbDist<string>[];
    prob_classify_many(features: Iterable<MaxentFeatureset>): DictionaryProbDist<string>[];
    weights(): number[];
    /** Return the most heavily weighted joint features, as NLTK exposes them. */
    mostInformativeFeatures(limit?: number): Array<{
        weight: number;
        feature: string;
        value: string;
        label: string;
    }>;
    most_informative_features(limit?: number): ReturnType<RustMaxentClassifier["mostInformativeFeatures"]>;
    toJSON(): FeatureMaxentSerialized;
    static fromJSON(runtime: WasmNltk, payload: FeatureMaxentSerialized): RustMaxentClassifier;
    dispose(): void;
}

export { BinaryMaxentFeatureEncoding as B, ConditionalProbDist as C, DictionaryProbDist as D, ELEProbDist as E, FreqDist as F, LaplaceProbDist as L, RustMaxentClassifier as R, SimpleGoodTuringProbDist as S, TypedMaxentFeatureEncoding as T, UniformProbDist as U, WittenBellProbDist as W, ConditionalFreqDist as f, ConditionalProbDistI as h, DictionaryConditionalProbDist as i, LidstoneProbDist as l, MLEProbDist as m, MutableProbDist as n, PYTHON_BOOL as o, PYTHON_FLOAT as p, PYTHON_INT as q, ProbDistI as s, RandomProbDist as t, addLogs as u, entropy as v, logLikelihood as w, pythonFloat as x, sumLogs as y };
export type { DefaultFeatureMaxentSerialized as A, MaxentEncodingSerialized as G, MaxentFeatureset as M, ProbDistLike as P, MaxentEncodingExample as a, MaxentFeatureMapping as b, MaxentEncodingOptions as c, MaxentMappingValue as d, FeatureMaxentOptions as e, ConditionalFreqDistInput as g, FeatureMaxentSerialized as j, FreqDistInput as k, ProbDistFactory as r, CustomFeatureMaxentSerialized as z };
