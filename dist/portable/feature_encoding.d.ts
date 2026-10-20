import type { FeatureSet } from "./feature_types.js";
export declare function intern(map: Map<string, number>, key: string): number;
/** Lossless typed marshaling only; the Rust model owns all statistics. */
export declare class FeatureEncoding {
    readonly names: Map<string, number>;
    private readonly values;
    trainingPairs(features: FeatureSet): number[];
    trainingGroup(features: Iterable<FeatureSet>): {
        pairs: Uint32Array;
        offsets: Uint32Array;
    };
    predictionPairs(features: FeatureSet): Uint32Array;
}
