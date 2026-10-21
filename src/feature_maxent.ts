import type { WasmNltk } from "./wasm.ts";
import { FeatureEncoding, intern } from "./feature_encoding.ts";
import { BinaryMaxentFeatureEncoding, type MaxentFeatureset, type MaxentEncodingExample,
  type MaxentEncodingSerialized } from "./maxent_feature_encoding.ts";
import { probabilityRuntime } from "./probability_abi.ts";
import { DictionaryProbDist } from "./probability.ts";
export type { MaxentEncodingExample, MaxentFeatureset, MaxentEncodingSerialized } from "./maxent_feature_encoding.ts";

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
  /** Explicit NLTK joint encoding. GIS requires its C property. */
  encoding?: BinaryMaxentFeatureEncoding & { readonly C?: number };
  /** NLTK keyword aliases. */
  max_iter?: number;
  min_ll?: number;
  min_lldelta?: number;
  max_acc?: number;
  min_accdelta?: number;
  count_cutoff?: number;
};

export type DefaultFeatureMaxentSerialized = {
  version: 1;
  algorithm: "iis" | "gis";
  labels: string[];
  names: string[];
  values: string[];
  features: [number, number, number][];
  weights: number[];
  correction?: number;
};
export type CustomFeatureMaxentSerialized = {
  version: 2;
  algorithm: "iis" | "gis";
  encoding: MaxentEncodingSerialized;
  weights: Array<number | "-Infinity">;
  constant?: number;
};
export type FeatureMaxentSerialized = DefaultFeatureMaxentSerialized | CustomFeatureMaxentSerialized;

function vectors(encoding: BinaryMaxentFeatureEncoding, labels: string[], features: MaxentFeatureset): number[] {
  const input: number[] = [];
  for (const label of labels) {
    const vector = encoding.encode(features, label);
    input.push(vector.length);
    for (const [id, value] of vector) input.push(id, value);
  }
  return input;
}

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
  private readonly customEncoding?: BinaryMaxentFeatureEncoding;
  private readonly ownsEncoding: boolean;

  private constructor(
    runtime: WasmNltk, handle: number, labelNames: string[], encoding: FeatureEncoding,
    algorithm: "iis" | "gis", correction?: number, customEncoding?: BinaryMaxentFeatureEncoding, ownsEncoding = false,
  ) {
    this.runtime = runtime;
    this.handle = handle;
    this.labelNames = labelNames;
    this.encoding = encoding;
    this.algorithm = algorithm;
    this.correction = correction;
    this.customEncoding = customEncoding;
    this.ownsEncoding = ownsEncoding;
  }

  static train(
    runtime: WasmNltk,
    examples: Iterable<MaxentEncodingExample>,
    options: FeatureMaxentOptions = {},
  ): RustMaxentClassifier {
    const algorithm = options.algorithm ?? "iis";
    if (algorithm !== "iis" && algorithm !== "gis") throw new TypeError("algorithm must be iis or gis");
    const maxIter = nonnegativeInteger(pick(options.maxIter, options.max_iter, "maxIter/max_iter"), "maxIter", 100);
    const countCutoff = nonnegativeInteger(pick(options.countCutoff, options.count_cutoff, "countCutoff/count_cutoff"), "countCutoff", 0);
    const minLl = finite(pick(options.minLl, options.min_ll, "minLl/min_ll"), "minLl");
    const minLldelta = finite(pick(options.minLldelta, options.min_lldelta, "minLldelta/min_lldelta"), "minLldelta");
    const maxAcc = finite(pick(options.maxAcc, options.max_acc, "maxAcc/max_acc"), "maxAcc");
    const minAccdelta = finite(pick(options.minAccdelta, options.min_accdelta, "minAccdelta/min_accdelta"), "minAccdelta");

    if (options.encoding !== undefined) {
      const custom = options.encoding;
      if (!(custom instanceof BinaryMaxentFeatureEncoding)) throw new TypeError("encoding must be a Binary/TypedMaxentFeatureEncoding");
      if (custom.encode !== BinaryMaxentFeatureEncoding.prototype.encode)
        throw new TypeError("overridden encode methods are not supported by the serialized Binary/Typed contract");
      const names = custom.labels();
      if (names.length === 0 || new Set(names).size !== names.length) throw new TypeError("encoding labels must be nonempty and unique");
      const constant = custom.C;
      if (algorithm === "gis" && constant === undefined)
        throw new TypeError("The GIS algorithm requires an encoding that defines C (e.g., GISEncoding).");
      if (constant !== undefined && (!Number.isFinite(constant) || constant === 0)) throw new RangeError("encoding C must be finite and nonzero");
      const rows = [...examples];
      if (rows.length === 0) throw new RangeError("MaxEnt training requires at least one example");
      const input = [Number(algorithm === "gis"), maxIter, minLl ?? NaN, minLldelta ?? NaN,
        maxAcc ?? NaN, minAccdelta ?? NaN, constant ?? NaN, names.length, custom.length(), rows.length];
      for (const [features, label] of rows) {
        const id = names.indexOf(label);
        if (id < 0) throw new TypeError(`Unexpected label ${label}`);
        input.push(id, ...vectors(custom, names, features));
      }
      const handle = probabilityRuntime().call(20, input, 1)[0]!;
      return new RustMaxentClassifier(runtime, handle, names, new FeatureEncoding(), algorithm, constant, custom);
    }

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
      // Default encoding remains the validated categorical API; tagged Python
      // floats are accepted only with an explicit Binary/Typed encoding.
      for (const value of encoding.trainingPairs(features as Parameters<FeatureEncoding["trainingPairs"]>[0])) pairs.push(value);
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
  predict(features: MaxentFeatureset): Array<{ label: string; logProb: number; probability: number }> {
    if (this.disposed) throw new Error("classifier has been disposed");
    const scores = this.customEncoding
      ? probabilityRuntime().call(21, [this.handle, ...vectors(this.customEncoding, this.labelNames, features)], this.labelNames.length * 2)
      : this.runtime.categoricalMaxentPredict(this.handle,
        this.encoding.predictionPairs(features as Parameters<FeatureEncoding["predictionPairs"]>[0]), this.labelNames.length);
    const offset = this.labelNames.length;
    return this.labelNames.map((label, index) => ({
      label,
      logProb: scores[index]!,
      probability: scores[offset + index]!,
    }));
  }

  classify(features: MaxentFeatureset): string {
    const rows = this.predict(features);
    const best = rows.reduce((left, right) => right.probability > left.probability ||
      (right.probability === left.probability && right.label > left.label) ? right : left);
    return best.label;
  }

  classifyMany(features: Iterable<MaxentFeatureset>): string[] {
    return [...features].map((row) => this.classify(row));
  }

  labels(): string[] {
    return [...this.labelNames];
  }
  classify_many(features: Iterable<MaxentFeatureset>): string[] { return this.classifyMany(features); }
  probClassify(features: MaxentFeatureset): DictionaryProbDist<string> {
    return new DictionaryProbDist(new Map(this.predict(features).map(row => [row.label, row.logProb])), true);
  }
  prob_classify(features: MaxentFeatureset): DictionaryProbDist<string> { return this.probClassify(features); }
  probClassifyMany(features: Iterable<MaxentFeatureset>): DictionaryProbDist<string>[] {
    return [...features].map(row => this.probClassify(row));
  }
  prob_classify_many(features: Iterable<MaxentFeatureset>): DictionaryProbDist<string>[] { return this.probClassifyMany(features); }
  weights(): number[] {
    if (this.disposed) throw new Error("classifier has been disposed");
    return this.customEncoding ? probabilityRuntime().call(22, [this.handle], this.customEncoding.length())
      : [...this.runtime.categoricalMaxentWeights(this.handle)];
  }

  /** Return the most heavily weighted joint features, as NLTK exposes them. */
  mostInformativeFeatures(limit = 10): Array<{ weight: number; feature: string; value: string; label: string }> {
    if (this.disposed) throw new Error("classifier has been disposed");
    if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 0)) throw new RangeError("limit must be a nonnegative integer");
    if (this.customEncoding) {
      throw new TypeError("custom encoding informative-feature records are not integrated; use weights() and encoding.describe(id)");
    }
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
  most_informative_features(limit = 10): ReturnType<RustMaxentClassifier["mostInformativeFeatures"]> {
    return this.mostInformativeFeatures(limit);
  }

  toJSON(): FeatureMaxentSerialized {
    if (this.disposed) throw new Error("classifier has been disposed");
    if (this.customEncoding) {
      const weights = this.weights();
      if (weights.some(value => Number.isNaN(value) || value === Infinity)) throw new Error("cannot serialize invalid MaxEnt weights");
      return {
        version: 2, algorithm: this.algorithm, encoding: this.customEncoding.toJSON(),
        weights: weights.map(value => value === -Infinity ? "-Infinity" : value),
        ...(this.correction === undefined ? {} : { constant: this.correction }),
      };
    }
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
    if (payload?.version === 2) {
      if (payload.algorithm !== "iis" && payload.algorithm !== "gis") throw new TypeError("invalid MaxEnt algorithm");
      if (!Array.isArray(payload.weights) || payload.weights.some(value => value !== "-Infinity" &&
        (typeof value !== "number" || !Number.isFinite(value)))) throw new TypeError("invalid MaxEnt weights");
      if (payload.constant !== undefined && (!Number.isFinite(payload.constant) || payload.constant === 0))
        throw new TypeError("invalid MaxEnt constant");
      if (payload.algorithm === "gis" && payload.constant === undefined) throw new TypeError("GIS requires C");
      const encoding = BinaryMaxentFeatureEncoding.fromJSON(payload.encoding);
      try {
        const labels = encoding.labels();
        if (labels.length === 0 || new Set(labels).size !== labels.length) throw new TypeError("invalid MaxEnt labels");
        if (payload.weights.length !== encoding.length()) throw new RangeError("invalid MaxEnt weights length");
        const weights = payload.weights.map(value => value === "-Infinity" ? -Infinity : value);
        const handle = probabilityRuntime().call(23, [labels.length, weights.length, ...weights], 1)[0]!;
        return new RustMaxentClassifier(runtime, handle, labels, new FeatureEncoding(), payload.algorithm,
          payload.constant, encoding, true);
      } catch (error) { encoding.dispose(); throw error; }
    }
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
    if (this.customEncoding) {
      probabilityRuntime().call(10, [this.handle], 0);
      if (this.ownsEncoding) this.customEncoding.dispose();
    } else this.runtime.categoricalMaxentFree(this.handle);
    this.disposed = true;
  }
}
