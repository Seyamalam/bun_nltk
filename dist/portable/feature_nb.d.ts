import type { WasmNltk } from "./wasm.js";
import type { FeatureSet, LabeledFeatureset } from "./feature_types.js";
export type { FeatureSet, FeatureValue, LabeledFeatureset } from "./feature_types.js";
/** Rust categorical classifier shared by Bun, Node and browsers. Owns one model, not its runtime. */
export declare class RustNaiveBayesClassifier {
    private disposed;
    private readonly runtime;
    private readonly handle;
    private readonly labelNames;
    private readonly encoding;
    private readonly positiveTie;
    private constructor();
    static train(runtime: WasmNltk, examples: Iterable<LabeledFeatureset>, options?: {
        smoothing?: number;
    }): RustNaiveBayesClassifier;
    /** NLTK positive/unlabeled variant; ties follow Python True > False. */
    static trainPositive(runtime: WasmNltk, positive: Iterable<FeatureSet>, unlabeled: Iterable<FeatureSet>, options?: PositiveFeatureOptions): RustNaiveBayesClassifier;
    labels(): string[];
    predict(features: FeatureSet): Array<{
        label: string;
        logProb: number;
        probability: number;
    }>;
    classify(features: FeatureSet): string;
    classifyMany(features: Iterable<FeatureSet>): string[];
    dispose(): void;
}
export type PositiveFeatureOptions = {
    smoothing?: number;
    positivePrior?: number;
    positiveLabel?: string;
    negativeLabel?: string;
    maxFeatures?: number;
};
/** Portable factory returning a disposable Rust model with the same prediction API. */
export declare const RustPositiveNaiveBayesClassifier: {
    train: typeof RustNaiveBayesClassifier.trainPositive;
};
