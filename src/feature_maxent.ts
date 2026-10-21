import type { WasmNltk } from "./wasm.ts";
import type { FeatureSet, LabeledFeatureset } from "./feature_types.ts";
import { FeatureEncoding, intern } from "./feature_encoding.ts";

export type FeatureMaxentOptions = {
  algorithm?: "iis" | "gis";
  maxIter?: number;
  minLl?: number;
  minLldelta?: number;
  maxAcc?: number;
  minAccdelta?: number;
  countCutoff?: number;
  /** Restrict and order labels exactly as NLTK's `labels=` argument. */
  labels?: string[];
  /** NLTK keyword aliases. */
  max_iter?: number;
  min_ll?: number;
  min_lldelta?: number;
  max_acc?: number;
  min_accdelta?: number;
  count_cutoff?: number;
};

export type FeatureMaxentSerialized = {
  version: 1;
  algorithm: "iis" | "gis";
  labels: string[];
  names: string[];
  values: string[];
  features: [number, number, number][];
  weights: number[];
  correction?: number;
};

function pick(left: number | undefined, right: number | undefined, name: string): number | undefined {
  if (left !== undefined && right !== undefined && left !== right) throw new TypeError(`conflicting ${name} options`);
  return left ?? right;
}

function finite(value: number | undefined, name: string): number | undefined {
  if (value !== undefined && !Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
  return value;
}

function nonnegativeInteger(value: number | undefined, name: string, fallback: number): number {
  const result = value ?? fallback;
  if (!Number.isSafeInteger(result) || result < 0 || result > 0xffffffff) {
    throw new RangeError(`${name} must be a nonnegative uint32 integer`);
  }
  return result;
}

/** Lossless Rust feature-dictionary MaxEnt matching NLTK's MaxentClassifier. */
export class RustMaxentClassifier {
  private disposed = false;
  private readonly runtime: WasmNltk;
  private readonly handle: number;
  private readonly labelNames: string[];
  private readonly encoding: FeatureEncoding;
  private readonly algorithm: "iis" | "gis";
  private readonly correction?: number;

  private constructor(
    runtime: WasmNltk, handle: number, labelNames: string[], encoding: FeatureEncoding,
    algorithm: "iis" | "gis", correction?: number,
  ) {
    this.runtime = runtime;
    this.handle = handle;
    this.labelNames = labelNames;
    this.encoding = encoding;
    this.algorithm = algorithm;
    this.correction = correction;
  }

  static train(
    runtime: WasmNltk,
    examples: Iterable<LabeledFeatureset>,
    options: FeatureMaxentOptions = {},
  ): RustMaxentClassifier {
    if ("encoding" in options) {
      throw new TypeError("custom MaxEnt encoding training is not integrated; standalone encodings are available separately");
    }
    const algorithm = options.algorithm ?? "iis";
    if (algorithm !== "iis" && algorithm !== "gis") throw new TypeError("algorithm must be iis or gis");
    const maxIter = nonnegativeInteger(pick(options.maxIter, options.max_iter, "maxIter/max_iter"), "maxIter", 100);
    const countCutoff = nonnegativeInteger(pick(options.countCutoff, options.count_cutoff, "countCutoff/count_cutoff"), "countCutoff", 0);
    const minLl = finite(pick(options.minLl, options.min_ll, "minLl/min_ll"), "minLl");
    const minLldelta = finite(pick(options.minLldelta, options.min_lldelta, "minLldelta/min_lldelta"), "minLldelta");
    const maxAcc = finite(pick(options.maxAcc, options.max_acc, "maxAcc/max_acc"), "maxAcc");
    const minAccdelta = finite(pick(options.minAccdelta, options.min_accdelta, "minAccdelta/min_accdelta"), "minAccdelta");

    const encoding = new FeatureEncoding();
    const labels = new Map<string, number>();
    const allowed = options.labels === undefined ? undefined : new Set<string>();
    if (options.labels !== undefined) {
      if (!Array.isArray(options.labels) || options.labels.length === 0) throw new TypeError("labels must be a nonempty array");
      for (const label of options.labels) {
        if (typeof label !== "string") throw new TypeError("labels must be strings");
        if (allowed!.has(label)) throw new TypeError(`duplicate label ${JSON.stringify(label)}`);
        allowed!.add(label);
        intern(labels, label);
      }
    }

    const pairs: number[] = [], offsets = [0], labelIds: number[] = [];
    for (const [features, label] of examples) {
      if (typeof label !== "string") throw new TypeError("labels must be strings");
      if (allowed && !allowed.has(label)) throw new TypeError(`Unexpected label ${label}`);
      labelIds.push(intern(labels, label));
      for (const value of encoding.trainingPairs(features)) pairs.push(value);
      if (pairs.length > 0xffffffff) throw new RangeError("too many classifier feature pairs");
      offsets.push(pairs.length / 2);
    }
    if (labelIds.length === 0) throw new RangeError("MaxEnt training requires at least one example");

    const handle = runtime.categoricalMaxentTrain({
      pairs: Uint32Array.from(pairs), offsets: Uint32Array.from(offsets),
      labels: Uint32Array.from(labelIds), labelCount: labels.size,
      algorithm, maxIter, countCutoff, minLl, minLldelta, maxAcc, minAccdelta,
    });
    return new RustMaxentClassifier(runtime, handle, [...labels.keys()], encoding, algorithm);
  }

  /** Rows follow NLTK's label order; probabilities are already normalized. */
  predict(features: FeatureSet): Array<{ label: string; logProb: number; probability: number }> {
    if (this.disposed) throw new Error("classifier has been disposed");
    const scores = this.runtime.categoricalMaxentPredict(this.handle, this.encoding.predictionPairs(features), this.labelNames.length);
    const offset = this.labelNames.length;
    return this.labelNames.map((label, index) => ({
      label,
      logProb: scores[index]!,
      probability: scores[offset + index]!,
    }));
  }

  classify(features: FeatureSet): string {
    const rows = this.predict(features);
    const best = rows.reduce((left, right) => right.probability > left.probability ||
      (right.probability === left.probability && right.label > left.label) ? right : left);
    return best.label;
  }

  classifyMany(features: Iterable<FeatureSet>): string[] {
    return [...features].map((row) => this.classify(row));
  }

  labels(): string[] {
    return [...this.labelNames];
  }

  /** Return the most heavily weighted joint features, as NLTK exposes them. */
  mostInformativeFeatures(limit = 10): Array<{ weight: number; feature: string; value: string; label: string }> {
    if (this.disposed) throw new Error("classifier has been disposed");
    if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 0)) throw new RangeError("limit must be a nonnegative integer");
    const features = this.runtime.categoricalMaxentFeatures(this.handle);
    const weights = this.runtime.categoricalMaxentWeights(this.handle);
    const names = [...this.encoding.names.keys()];
    const values = [...this.encoding.values.keys()];
    const rows = [];
    for (let id = 0; id < features.length / 3; id++) {
      rows.push({
        weight: weights[id]!,
        feature: names[features[id * 3]!]!,
        value: values[features[id * 3 + 1]!]!,
        label: this.labelNames[features[id * 3 + 2]!]!,
      });
    }
    return rows.sort((left, right) => Math.abs(right.weight) - Math.abs(left.weight)).slice(0, limit);
  }

  toJSON(): FeatureMaxentSerialized {
    if (this.disposed) throw new Error("classifier has been disposed");
    const features = this.runtime.categoricalMaxentFeatures(this.handle);
    const weights = this.runtime.categoricalMaxentWeights(this.handle);
    if ([...weights].some((value) => !Number.isFinite(value))) {
      throw new Error("cannot serialize non-finite MaxEnt weights");
    }
    const rows: [number, number, number][] = [];
    for (let index = 0; index < features.length; index += 3) {
      rows.push([features[index]!, features[index + 1]!, features[index + 2]!]);
    }
    const correction = this.runtime.categoricalMaxentCorrection(this.handle);
    return {
      version: 1,
      algorithm: this.algorithm,
      labels: [...this.labelNames],
      names: [...this.encoding.names.keys()],
      values: [...this.encoding.values.keys()],
      features: rows,
      weights: [...weights],
      ...(this.algorithm === "gis" ? { correction } : {}),
    };
  }

  static fromJSON(runtime: WasmNltk, payload: FeatureMaxentSerialized): RustMaxentClassifier {
    if (!payload || payload.version !== 1) throw new TypeError("unsupported MaxEnt serialized version");
    if (payload.algorithm !== "iis" && payload.algorithm !== "gis") throw new TypeError("invalid MaxEnt algorithm");
    if (!Array.isArray(payload.labels) || payload.labels.length === 0 || payload.labels.some((label) => typeof label !== "string")) {
      throw new TypeError("invalid MaxEnt labels");
    }
    const encoding = FeatureEncoding.fromMaps(payload.names, payload.values);
    const expected = payload.features.length + (payload.algorithm === "gis" ? 1 : 0);
    if (payload.weights.length !== expected) throw new RangeError(`weights length must be ${expected}`);
    const features = new Uint32Array(payload.features.length * 3);
    for (const [index, triple] of payload.features.entries()) {
      if (!Array.isArray(triple) || triple.length !== 3 ||
        !Number.isSafeInteger(triple[0]) || triple[0] < 0 || triple[0] >= payload.names.length ||
        !Number.isSafeInteger(triple[1]) || triple[1] < 0 || triple[1] >= payload.values.length ||
        !Number.isSafeInteger(triple[2]) || triple[2] < 0 || triple[2] >= payload.labels.length) {
        throw new TypeError("invalid MaxEnt feature encoding");
      }
      features[index * 3] = triple[0];
      features[index * 3 + 1] = triple[1];
      features[index * 3 + 2] = triple[2];
    }
    const handle = runtime.categoricalMaxentLoad({
      features, weights: Float64Array.from(payload.weights), labelCount: payload.labels.length,
      algorithm: payload.algorithm, correction: payload.correction,
    });
    return new RustMaxentClassifier(runtime, handle, [...payload.labels], encoding, payload.algorithm, payload.correction);
  }

  dispose(): void {
    if (this.disposed) return;
    this.runtime.categoricalMaxentFree(this.handle);
    this.disposed = true;
  }
}
