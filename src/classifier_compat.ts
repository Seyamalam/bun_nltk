import { NaiveBayesTextClassifier } from "./classify";
import { DecisionTreeTextClassifier } from "./decision_tree";
import { DictionaryProbDist } from "./probability";
import { MaxEntTextClassifier, type MaxEntOptions } from "./maxent";
import { PositiveNaiveBayesTextClassifier } from "./positive_naive_bayes";
import { syncWasm } from "./sync_wasm.ts";
import { RustNaiveBayesClassifier, type PositiveFeatureOptions } from "./feature_nb";
import { RustDecisionTreeClassifier, type FeatureTreeOptions } from "./feature_tree.ts";
import { RustMaxentClassifier, type FeatureMaxentOptions } from "./feature_maxent.ts";
import type { MaxentEncodingExample, MaxentFeatureset } from "./maxent_feature_encoding.ts";
export type { MaxentEncodingExample, MaxentFeatureset } from "./maxent_feature_encoding.ts";
import type { FeatureSet, LabeledFeatureset } from "./feature_types";

export type { FeatureValue, FeatureSet, LabeledFeatureset } from "./feature_types";

function normalizeToken(value: string): string {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9']+/g, " ");
  return cleaned.trim();
}

function featureText(featureset: FeatureSet): string {
  const tokens: string[] = [];
  for (const [key, rawValue] of Object.entries(featureset).sort(([left], [right]) => left.localeCompare(right))) {
    const normalizedKey = normalizeToken(key);
    if (!normalizedKey) continue;

    let value: string;
    if (rawValue === undefined || rawValue === null) value = "null";
    else if (typeof rawValue === "boolean") value = rawValue ? "true" : "false";
    else value = String(rawValue);

    const normalizedValue = normalizeToken(value);
    if (!normalizedValue) continue;
    tokens.push("feature", normalizedKey, "value", normalizedValue);
  }
  return tokens.join(" ");
}

function fromLogScores(rows: Array<{ label: string; logProb: number }>, base: number): DictionaryProbDist<string> {
  if (rows.length === 0) return new DictionaryProbDist<string>();
  const max = Math.max(...rows.map((row) => row.logProb));
  const weights = rows.map((row) => base ** (row.logProb - max));
  const total = weights.reduce((sum, value) => sum + value, 0);
  const payload = new Map<string, number>();
  for (let i = 0; i < rows.length; i += 1) {
    payload.set(rows[i]!.label, total > 0 ? weights[i]! / total : 1 / rows.length);
  }
  return new DictionaryProbDist(payload);
}

function fromProbabilities(rows: Array<{ label: string; probability: number }>): DictionaryProbDist<string> {
  return new DictionaryProbDist(new Map(rows.map((row) => [row.label, row.probability])), false, true);
}

abstract class FeatureClassifierBase {
  protected abstract classifyText(text: string): string;
  protected abstract probClassifyText(text: string): DictionaryProbDist<string>;
  abstract labels(): string[];

  classify(featureset: FeatureSet): string {
    return this.classifyText(featureText(featureset));
  }

  probClassify(featureset: FeatureSet): DictionaryProbDist<string> {
    return this.probClassifyText(featureText(featureset));
  }

  classifyMany(featuresets: Iterable<FeatureSet>): string[] {
    return [...featuresets].map((featureset) => this.classify(featureset));
  }

  probClassifyMany(featuresets: Iterable<FeatureSet>): DictionaryProbDist<string>[] {
    return [...featuresets].map((featureset) => this.probClassify(featureset));
  }

  // NLTK snake_case aliases; the camelCase names remain available.
  prob_classify(featureset: FeatureSet): DictionaryProbDist<string> { return this.probClassify(featureset); }
  classify_many(featuresets: Iterable<FeatureSet>): string[] { return this.classifyMany(featuresets); }
  prob_classify_many(featuresets: Iterable<FeatureSet>): DictionaryProbDist<string>[] { return this.probClassifyMany(featuresets); }
}

export class NaiveBayesClassifier extends FeatureClassifierBase {
  constructor(private readonly model: NaiveBayesTextClassifier | RustNaiveBayesClassifier) {
    super();
  }

  static train(labeledFeaturesets: Iterable<LabeledFeatureset>, options?: { smoothing?: number }): NaiveBayesClassifier {
    return new NaiveBayesClassifier(RustNaiveBayesClassifier.train(syncWasm(), labeledFeaturesets, options));
  }

  override classify(featureset: FeatureSet): string {
    return this.model instanceof RustNaiveBayesClassifier ? this.model.classify(featureset) : super.classify(featureset);
  }

  override probClassify(featureset: FeatureSet): DictionaryProbDist<string> {
    return this.model instanceof RustNaiveBayesClassifier
      ? fromProbabilities(this.model.predict(featureset).sort((a, b) => b.logProb - a.logProb || (a.label < b.label ? 1 : a.label > b.label ? -1 : 0)))
      : super.probClassify(featureset);
  }

  dispose(): void {
    if (this.model instanceof RustNaiveBayesClassifier) this.model.dispose();
  }

  protected classifyText(text: string): string {
    if (this.model instanceof RustNaiveBayesClassifier) throw new TypeError("feature dictionary required");
    return this.model.classify(text);
  }

  protected probClassifyText(text: string): DictionaryProbDist<string> {
    if (this.model instanceof RustNaiveBayesClassifier) throw new TypeError("feature dictionary required");
    return fromLogScores(this.model.predict(text), this.model.logBase);
  }

  labels(): string[] {
    return this.model.labels();
  }
}

export class DecisionTreeClassifier extends FeatureClassifierBase {
  constructor(private readonly model: DecisionTreeTextClassifier | RustDecisionTreeClassifier) {
    super();
  }

  static train(
    labeledFeaturesets: Iterable<LabeledFeatureset>,
    options?: FeatureTreeOptions,
  ): DecisionTreeClassifier {
    return new DecisionTreeClassifier(RustDecisionTreeClassifier.train(syncWasm(), labeledFeaturesets, options));
  }

  override classify(featureset: FeatureSet): string {
    return this.model instanceof RustDecisionTreeClassifier ? this.model.classify(featureset) : super.classify(featureset);
  }

  override probClassify(featureset: FeatureSet): DictionaryProbDist<string> {
    if (!(this.model instanceof RustDecisionTreeClassifier)) return super.probClassify(featureset);
    // NLTK trees do not implement prob_classify; retain our extension as one-hot.
    const label = this.model.classify(featureset);
    return fromProbabilities(this.model.labels().map((candidate) => ({ label: candidate, probability: Number(candidate === label) })));
  }

  dispose(): void { if (this.model instanceof RustDecisionTreeClassifier) this.model.dispose(); }

  protected classifyText(text: string): string {
    if (this.model instanceof RustDecisionTreeClassifier) throw new TypeError("feature dictionary required");
    return this.model.classify(text);
  }

  protected probClassifyText(text: string): DictionaryProbDist<string> {
    if (this.model instanceof RustDecisionTreeClassifier) throw new TypeError("feature dictionary required");
    return fromProbabilities(this.model.predict(text).map((row) => ({ label: row.label, probability: row.score })));
  }

  labels(): string[] {
    if (this.model instanceof RustDecisionTreeClassifier) return this.model.labels();
    return this.model.toJSON().labels;
  }
}

export type MaxentCompatOptions = Omit<FeatureMaxentOptions, "algorithm"> & {
  algorithm?: "iis" | "gis" | "sgd";
  /** Legacy text-model options; using any of them keeps the old adapter. */
  epochs?: number;
  learningRate?: number;
  l2?: number;
  maxFeatures?: number;
};

export class MaxentClassifier extends FeatureClassifierBase {
  constructor(private readonly model: RustMaxentClassifier | MaxEntTextClassifier) {
    super();
  }

  static train(
    labeledFeaturesets: Iterable<MaxentEncodingExample>,
    options: MaxentCompatOptions = {},
  ): MaxentClassifier {
    const legacy = options.algorithm === "sgd" || options.epochs !== undefined ||
      options.learningRate !== undefined || options.l2 !== undefined || options.maxFeatures !== undefined;
    if (legacy) {
      if (options.encoding !== undefined) throw new TypeError("custom encodings require the Rust IIS/GIS model");
      const rows = [...labeledFeaturesets].map(([features, label]) => ({ label, text: featureText(features as FeatureSet) }));
      return new MaxentClassifier(new MaxEntTextClassifier(options as MaxEntOptions).train(rows));
    }
    const algorithm = options.algorithm === "gis" ? "gis" : "iis";
    return new MaxentClassifier(RustMaxentClassifier.train(syncWasm(), labeledFeaturesets, {
      ...options, algorithm,
    }));
  }

  override classify(featureset: MaxentFeatureset): string {
    return this.model instanceof RustMaxentClassifier ? this.model.classify(featureset) : super.classify(featureset as FeatureSet);
  }

  override probClassify(featureset: MaxentFeatureset): DictionaryProbDist<string> {
    return this.model instanceof RustMaxentClassifier
      ? this.model.probClassify(featureset)
      : super.probClassify(featureset as FeatureSet);
  }

  override classifyMany(featuresets: Iterable<MaxentFeatureset>): string[] {
    return [...featuresets].map(row => this.classify(row));
  }
  override probClassifyMany(featuresets: Iterable<MaxentFeatureset>): DictionaryProbDist<string>[] {
    return [...featuresets].map(row => this.probClassify(row));
  }
  override prob_classify(featureset: MaxentFeatureset): DictionaryProbDist<string> { return this.probClassify(featureset); }
  override classify_many(featuresets: Iterable<MaxentFeatureset>): string[] { return this.classifyMany(featuresets); }
  override prob_classify_many(featuresets: Iterable<MaxentFeatureset>): DictionaryProbDist<string>[] { return this.probClassifyMany(featuresets); }

  dispose(): void {
    if (this.model instanceof RustMaxentClassifier) this.model.dispose();
  }

  protected classifyText(text: string): string {
    if (this.model instanceof RustMaxentClassifier) throw new TypeError("feature dictionary required");
    return this.model.classify(text);
  }

  protected probClassifyText(text: string): DictionaryProbDist<string> {
    if (this.model instanceof RustMaxentClassifier) throw new TypeError("feature dictionary required");
    return fromProbabilities(this.model.predict(text));
  }

  labels(): string[] {
    return this.model instanceof RustMaxentClassifier ? this.model.labels() : this.model.labelsList();
  }

  mostInformativeFeatures(limit = 10): Array<{ weight: number; feature: string; value: string; label: string }> {
    if (!(this.model instanceof RustMaxentClassifier)) throw new Error("most_informative_features requires the Rust feature model");
    return this.model.mostInformativeFeatures(limit);
  }

  most_informative_features(limit = 10): Array<{ weight: number; feature: string; value: string; label: string }> {
    return this.mostInformativeFeatures(limit);
  }
}

export class PositiveNaiveBayesClassifier extends FeatureClassifierBase {
  constructor(private readonly model: PositiveNaiveBayesTextClassifier | RustNaiveBayesClassifier) {
    super();
  }

  static train(
    positiveFeaturesets: Iterable<FeatureSet>,
    unlabeledFeaturesets: Iterable<FeatureSet>,
    options?: PositiveFeatureOptions,
  ): PositiveNaiveBayesClassifier {
    return new PositiveNaiveBayesClassifier(RustNaiveBayesClassifier.trainPositive(syncWasm(), positiveFeaturesets, unlabeledFeaturesets, options));
  }

  override classify(featureset: FeatureSet): string {
    return this.model instanceof RustNaiveBayesClassifier ? this.model.classify(featureset) : super.classify(featureset);
  }

  override probClassify(featureset: FeatureSet): DictionaryProbDist<string> {
    return this.model instanceof RustNaiveBayesClassifier
      ? fromProbabilities(this.model.predict(featureset).sort((a, b) => b.logProb - a.logProb))
      : super.probClassify(featureset);
  }

  dispose(): void {
    if (this.model instanceof RustNaiveBayesClassifier) this.model.dispose();
  }

  protected classifyText(text: string): string {
    if (this.model instanceof RustNaiveBayesClassifier) throw new TypeError("feature dictionary required");
    return this.model.classify(text);
  }

  protected probClassifyText(text: string): DictionaryProbDist<string> {
    if (this.model instanceof RustNaiveBayesClassifier) throw new TypeError("feature dictionary required");
    return fromProbabilities(this.model.predict(text));
  }

  labels(): string[] {
    if (this.model instanceof RustNaiveBayesClassifier) return this.model.labels();
    const payload = this.model.toJSON();
    return [payload.positiveLabel, payload.negativeLabel];
  }
}
