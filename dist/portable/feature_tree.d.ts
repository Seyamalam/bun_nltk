import type { WasmNltk } from "./wasm.js";
import type { FeatureSet, LabeledFeatureset } from "./feature_types.js";
export type FeatureTreeOptions = {
    entropyCutoff?: number;
    depthCutoff?: number;
    supportCutoff?: number;
    binary?: boolean;
    /** Legacy depth/support aliases; feature truncation is never applied. */
    maxDepth?: number;
    minSamples?: number;
    maxCandidateFeatures?: number;
    maxFeatures?: number;
};
/** Rust NLTK-style categorical tree; split ties use first-seen names/values. */
export declare class RustDecisionTreeClassifier {
    private disposed;
    private readonly runtime;
    private readonly handle;
    private readonly labelNames;
    private readonly encoding;
    private constructor();
    static train(runtime: WasmNltk, examples: Iterable<LabeledFeatureset>, options?: FeatureTreeOptions): RustDecisionTreeClassifier;
    classify(features: FeatureSet): string;
    classifyMany(features: Iterable<FeatureSet>): string[];
    labels(): string[];
    dispose(): void;
}
