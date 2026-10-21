import { WasmNltk } from './wasm.js';
import { LabeledFeatureset, FeatureSet } from './feature_types.js';

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
    /** NLTK keyword aliases. */
    max_iter?: number;
    min_ll?: number;
    min_lldelta?: number;
    max_acc?: number;
    min_accdelta?: number;
    count_cutoff?: number;
};
type FeatureMaxentSerialized = {
    version: 1;
    algorithm: "iis" | "gis";
    labels: string[];
    names: string[];
    values: string[];
    features: [number, number, number][];
    weights: number[];
    correction?: number;
};
/** Lossless Rust feature-dictionary MaxEnt matching NLTK's MaxentClassifier. */
declare class RustMaxentClassifier {
    private disposed;
    private readonly runtime;
    private readonly handle;
    private readonly labelNames;
    private readonly encoding;
    private readonly algorithm;
    private readonly correction?;
    private constructor();
    static train(runtime: WasmNltk, examples: Iterable<LabeledFeatureset>, options?: FeatureMaxentOptions): RustMaxentClassifier;
    /** Rows follow NLTK's label order; probabilities are already normalized. */
    predict(features: FeatureSet): Array<{
        label: string;
        logProb: number;
        probability: number;
    }>;
    classify(features: FeatureSet): string;
    classifyMany(features: Iterable<FeatureSet>): string[];
    labels(): string[];
    /** Return the most heavily weighted joint features, as NLTK exposes them. */
    mostInformativeFeatures(limit?: number): Array<{
        weight: number;
        feature: string;
        value: string;
        label: string;
    }>;
    toJSON(): FeatureMaxentSerialized;
    static fromJSON(runtime: WasmNltk, payload: FeatureMaxentSerialized): RustMaxentClassifier;
    dispose(): void;
}

export { RustMaxentClassifier };
export type { FeatureMaxentOptions, FeatureMaxentSerialized };
