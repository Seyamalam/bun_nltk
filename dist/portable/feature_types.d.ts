type FeatureValue = string | number | boolean | null | undefined;
type FeatureSet = Record<string, FeatureValue>;
type LabeledFeatureset = readonly [FeatureSet, string];

export type { FeatureSet, FeatureValue, LabeledFeatureset };
