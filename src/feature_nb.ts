import type { WasmNltk } from "./wasm";
import type { FeatureSet, LabeledFeatureset } from "./feature_types";
import { FeatureEncoding, intern } from "./feature_encoding.ts";
export type { FeatureSet, FeatureValue, LabeledFeatureset } from "./feature_types";

/** Rust categorical classifier shared by Bun, Node and browsers. Owns one model, not its runtime. */
export class RustNaiveBayesClassifier {
  private disposed = false;
  private readonly runtime: WasmNltk;
  private readonly handle: number;
  private readonly labelNames: string[];
  private readonly encoding: FeatureEncoding;
  private readonly positiveTie: boolean;
  private constructor(
    runtime: WasmNltk, handle: number, labelNames: string[],
    encoding: FeatureEncoding, positiveTie = false,
  ) {
    this.runtime = runtime;
    this.handle = handle;
    this.labelNames = labelNames;
    this.encoding = encoding;
    this.positiveTie = positiveTie;
  }

  static train(runtime: WasmNltk, examples: Iterable<LabeledFeatureset>, options: { smoothing?: number } = {}): RustNaiveBayesClassifier {
    const encoding = new FeatureEncoding();
    const labels = new Map<string, number>();
    const pairs: number[] = [], offsets = [0], labelIds: number[] = [];
    for (const [features, label] of examples) {
      if (typeof label !== "string") throw new TypeError("labels must be strings");
      labelIds.push(intern(labels, label));
      for (const value of encoding.trainingPairs(features)) pairs.push(value);
      if (pairs.length > 0xffffffff) throw new RangeError("too many classifier feature pairs");
      offsets.push(pairs.length / 2);
    }
    if (!labelIds.length) throw new RangeError("Naive Bayes training requires at least one example");
    const handle = runtime.categoricalNaiveBayesTrain({
      pairs: Uint32Array.from(pairs), offsets: Uint32Array.from(offsets),
      labels: Uint32Array.from(labelIds), labelCount: labels.size, smoothing: options.smoothing ?? 0.5,
    });
    return new RustNaiveBayesClassifier(runtime, handle, [...labels.keys()], encoding);
  }

  /** NLTK positive/unlabeled variant; ties follow Python True > False. */
  static trainPositive(runtime: WasmNltk, positive: Iterable<FeatureSet>, unlabeled: Iterable<FeatureSet>, options: PositiveFeatureOptions = {}): RustNaiveBayesClassifier {
    const positiveLabel = options.positiveLabel ?? "pos", negativeLabel = options.negativeLabel ?? "neg";
    if (typeof positiveLabel !== "string" || typeof negativeLabel !== "string" || positiveLabel === negativeLabel) throw new TypeError("positive and negative labels must be distinct strings");
    const encoding = new FeatureEncoding();
    const pos = encoding.trainingGroup(positive), global = encoding.trainingGroup(unlabeled);
    if (options.maxFeatures !== undefined && (!Number.isSafeInteger(options.maxFeatures) || options.maxFeatures < 1 || options.maxFeatures < encoding.names.size)) {
      throw new RangeError("maxFeatures must be a positive integer covering every feature; lossy feature truncation is unsupported");
    }
    const handle = runtime.positiveCategoricalNaiveBayesTrain({
      positivePairs: pos.pairs, positiveOffsets: pos.offsets,
      unlabeledPairs: global.pairs, unlabeledOffsets: global.offsets,
      positivePrior: options.positivePrior ?? 0.5, smoothing: options.smoothing ?? 0.5,
    });
    return new RustNaiveBayesClassifier(runtime, handle, [positiveLabel, negativeLabel], encoding, true);
  }

  labels(): string[] { return [...this.labelNames]; }

  predict(features: FeatureSet): Array<{ label: string; logProb: number; probability: number }> {
    if (this.disposed) throw new Error("classifier has been disposed");
    const scores = this.runtime.categoricalNaiveBayesPredict(this.handle, this.encoding.predictionPairs(features), this.labelNames.length);
    return this.labelNames.map((label, i) => ({ label, logProb: scores[i]!, probability: 2 ** scores[i]! }));
  }

  classify(features: FeatureSet): string {
    const rows = this.predict(features);
    return rows.reduce((best, row) => row.logProb > best.logProb ||
      (!this.positiveTie && row.logProb === best.logProb && row.label > best.label) ? row : best).label;
  }

  classifyMany(features: Iterable<FeatureSet>): string[] { return [...features].map((row) => this.classify(row)); }

  dispose(): void {
    if (this.disposed) return;
    this.runtime.categoricalNaiveBayesFree(this.handle);
    this.disposed = true;
  }
}

export type PositiveFeatureOptions = {
  smoothing?: number; positivePrior?: number; positiveLabel?: string; negativeLabel?: string; maxFeatures?: number;
};

/** Portable factory returning a disposable Rust model with the same prediction API. */
export const RustPositiveNaiveBayesClassifier = { train: RustNaiveBayesClassifier.trainPositive };
