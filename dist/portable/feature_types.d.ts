export type FeatureValue = string | number | boolean | null | undefined;
export type FeatureSet = Record<string, FeatureValue>;
export type LabeledFeatureset = readonly [FeatureSet, string];
