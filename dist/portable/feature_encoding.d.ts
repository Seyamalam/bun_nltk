import { FeatureSet, FeatureValue } from './feature_types.js';

declare function valueKey(value: FeatureValue): string;
declare function intern(map: Map<string, number>, key: string): number;
/** Lossless typed marshaling only; the Rust model owns all statistics. */
declare class FeatureEncoding {
    readonly names: Map<string, number>;
    readonly values: Map<string, number>;
    /** Restore intern tables from a serialized model without changing ids. */
    static fromMaps(names: string[], values: string[]): FeatureEncoding;
    trainingPairs(features: FeatureSet): number[];
    trainingGroup(features: Iterable<FeatureSet>): {
        pairs: Uint32Array;
        offsets: Uint32Array;
    };
    predictionPairs(features: FeatureSet): Uint32Array;
}

export { FeatureEncoding, intern, valueKey };
