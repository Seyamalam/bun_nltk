import { FeatureEncoding, intern } from "./feature_encoding.js";

export class RustDecisionTreeClassifier {
  disposed = false;
  runtime;
  handle;
  labelNames;
  encoding;
  constructor(runtime, handle, labelNames, encoding) {
    this.runtime = runtime;
    this.handle = handle;
    this.labelNames = labelNames;
    this.encoding = encoding;
  }
  static train(runtime, examples, options = {}) {
    const encoding = new FeatureEncoding, labels = new Map;
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
    if (options.depthCutoff !== undefined && options.maxDepth !== undefined && options.depthCutoff !== options.maxDepth)
      throw new RangeError("conflicting depthCutoff and maxDepth");
    if (options.supportCutoff !== undefined && options.minSamples !== undefined && options.supportCutoff !== options.minSamples)
      throw new RangeError("conflicting supportCutoff and minSamples");
    for (const limit of [options.maxFeatures, options.maxCandidateFeatures]) {
      if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1 || limit < encoding.names.size)) {
        throw new RangeError("feature limits must cover every feature; lossy truncation is unsupported");
      }
    }
    if (options.binary !== undefined && typeof options.binary !== "boolean")
      throw new TypeError("binary must be a boolean");
    const handle = runtime.decisionTreeTrain({
      pairs: Uint32Array.from(pairs),
      offsets: Uint32Array.from(offsets),
      labels: Uint32Array.from(labelIds),
      labelCount: labels.size,
      entropyCutoff: options.entropyCutoff ?? 0.05,
      depthCutoff: options.depthCutoff ?? options.maxDepth ?? 100,
      supportCutoff: options.supportCutoff ?? options.minSamples ?? 10,
      binary: options.binary ?? false
    });
    return new RustDecisionTreeClassifier(runtime, handle, [...labels.keys()], encoding);
  }
  classify(features) {
    if (this.disposed)
      throw new Error("classifier has been disposed");
    const id = this.runtime.decisionTreeClassify(this.handle, this.encoding.predictionPairs(features));
    return this.labelNames[id];
  }
  classifyMany(features) {
    return [...features].map((row) => this.classify(row));
  }
  labels() {
    if (this.disposed)
      throw new Error("classifier has been disposed");
    return [...this.runtime.decisionTreeLabels(this.handle, this.labelNames.length)].map((id) => this.labelNames[id]);
  }
  dispose() {
    if (this.disposed)
      return;
    this.runtime.decisionTreeFree(this.handle);
    this.disposed = true;
  }
}
