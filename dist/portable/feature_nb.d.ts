import { WasmNltk } from './wasm.js';
import { LabeledFeatureset, FeatureSet } from './feature_types.js';
export { type FeatureValue } from './feature_types.js';

/** Rust categorical classifier shared by Bun, Node and browsers. Owns one model, not its runtime. */
declare class RustNaiveBayesClassifier {
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
type PositiveFeatureOptions = {
    smoothing?: number;
    positivePrior?: number;
    positiveLabel?: string;
    negativeLabel?: string;
    maxFeatures?: number;
};
/** Portable factory returning a disposable Rust model with the same prediction API. */
declare const RustPositiveNaiveBayesClassifier: {
    train: typeof RustNaiveBayesClassifier.trainPositive;
};

export { type FeatureSet, type LabeledFeatureset, RustNaiveBayesClassifier, RustPositiveNaiveBayesClassifier };
export type { PositiveFeatureOptions };
