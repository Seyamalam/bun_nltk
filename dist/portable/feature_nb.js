import { FeatureEncoding, intern } from "./feature_encoding.js";

export class RustNaiveBayesClassifier {
  disposed = false;
  runtime;
  handle;
  labelNames;
  encoding;
  positiveTie;
  constructor(runtime, handle, labelNames, encoding, positiveTie = false) {
    this.runtime = runtime;
    this.handle = handle;
    this.labelNames = labelNames;
    this.encoding = encoding;
    this.positiveTie = positiveTie;
  }
  static train(runtime, examples, options = {}) {
    const encoding = new FeatureEncoding;
    const labels = new Map;
    const pairs = [], offsets = [0], labelIds = [];
    for (const [features, label] of examples) {
      if (typeof label !== "string")
        throw new TypeError("labels must be strings");
      labelIds.push(intern(labels, label));
      for (const value of encoding.trainingPairs(features))
        pairs.push(value);
      if (pairs.length > 4294967295)
        throw new RangeError("too many classifier feature pairs");
      offsets.push(pairs.length / 2);
    }
    if (!labelIds.length)
      throw new RangeError("Naive Bayes training requires at least one example");
    const handle = runtime.categoricalNaiveBayesTrain({
      pairs: Uint32Array.from(pairs),
      offsets: Uint32Array.from(offsets),
      labels: Uint32Array.from(labelIds),
      labelCount: labels.size,
      smoothing: options.smoothing ?? 0.5
    });
    return new RustNaiveBayesClassifier(runtime, handle, [...labels.keys()], encoding);
  }
  static trainPositive(runtime, positive, unlabeled, options = {}) {
    const positiveLabel = options.positiveLabel ?? "pos", negativeLabel = options.negativeLabel ?? "neg";
    if (typeof positiveLabel !== "string" || typeof negativeLabel !== "string" || positiveLabel === negativeLabel)
      throw new TypeError("positive and negative labels must be distinct strings");
    const encoding = new FeatureEncoding;
    const pos = encoding.trainingGroup(positive), global = encoding.trainingGroup(unlabeled);
    if (options.maxFeatures !== undefined && (!Number.isSafeInteger(options.maxFeatures) || options.maxFeatures < 1 || options.maxFeatures < encoding.names.size)) {
      throw new RangeError("maxFeatures must be a positive integer covering every feature; lossy feature truncation is unsupported");
    }
    const handle = runtime.positiveCategoricalNaiveBayesTrain({
      positivePairs: pos.pairs,
      positiveOffsets: pos.offsets,
      unlabeledPairs: global.pairs,
      unlabeledOffsets: global.offsets,
      positivePrior: options.positivePrior ?? 0.5,
      smoothing: options.smoothing ?? 0.5
    });
    return new RustNaiveBayesClassifier(runtime, handle, [positiveLabel, negativeLabel], encoding, true);
  }
  labels() {
    return [...this.labelNames];
  }
  predict(features) {
    if (this.disposed)
      throw new Error("classifier has been disposed");
    const scores = this.runtime.categoricalNaiveBayesPredict(this.handle, this.encoding.predictionPairs(features), this.labelNames.length);
    return this.labelNames.map((label, i) => ({ label, logProb: scores[i], probability: 2 ** scores[i] }));
  }
  classify(features) {
    const rows = this.predict(features);
    return rows.reduce((best, row) => row.logProb > best.logProb || !this.positiveTie && row.logProb === best.logProb && row.label > best.label ? row : best).label;
  }
  classifyMany(features) {
    return [...features].map((row) => this.classify(row));
  }
  dispose() {
    if (this.disposed)
      return;
    this.runtime.categoricalNaiveBayesFree(this.handle);
    this.disposed = true;
  }
}
export const RustPositiveNaiveBayesClassifier = { train: RustNaiveBayesClassifier.trainPositive };
