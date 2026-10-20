import type { WasmNltk } from "./wasm";
import type { FeatureSet, FeatureValue, LabeledFeatureset } from "./feature_types";
export type { FeatureSet, FeatureValue, LabeledFeatureset } from "./feature_types";

// Python hashes bool and equal numbers together; None also represents missing
// training values. Strings remain distinct, with no case-folding or tokenization.
function valueKey(value: FeatureValue): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return `string:${value}`;
  if (typeof value === "boolean") return `number:${Number(value)}`;
  if (typeof value === "number" && !Number.isNaN(value)) return `number:${value}`;
  throw new TypeError("feature values must be strings, numbers other than NaN, booleans, null or undefined");
}

function entries(features: FeatureSet): [string, FeatureValue][] {
  if (!features || typeof features !== "object" || Array.isArray(features)) throw new TypeError("features must be a dictionary");
  return Object.entries(features);
}

/** Rust categorical classifier shared by Bun, Node and browsers. Owns one model, not its runtime. */
export class RustNaiveBayesClassifier {
  private disposed = false;
  private readonly runtime: WasmNltk;
  private readonly handle: number;
  private readonly labelNames: string[];
  private readonly names: Map<string, number>;
  private readonly values: Map<string, number>;
  private constructor(
    runtime: WasmNltk, handle: number, labelNames: string[],
    names: Map<string, number>, values: Map<string, number>,
  ) {
    this.runtime = runtime;
    this.handle = handle;
    this.labelNames = labelNames;
    this.names = names;
    this.values = values;
  }

  static train(runtime: WasmNltk, examples: Iterable<LabeledFeatureset>, options: { smoothing?: number } = {}): RustNaiveBayesClassifier {
    const names = new Map<string, number>();
    const values = new Map<string, number>([["null", 0]]);
    const labels = new Map<string, number>();
    const pairs: number[] = [], offsets = [0], labelIds: number[] = [];
    function intern(map: Map<string, number>, key: string): number {
      const existing = map.get(key);
      if (existing !== undefined) return existing;
      if (map.size >= 0xffffffff) throw new RangeError("too many classifier symbols");
      const id = map.size;
      map.set(key, id);
      return id;
    }
    for (const [features, label] of examples) {
      if (typeof label !== "string") throw new TypeError("labels must be strings");
      labelIds.push(intern(labels, label));
      for (const [name, value] of entries(features)) pairs.push(intern(names, name), intern(values, valueKey(value)));
      offsets.push(pairs.length / 2);
    }
    if (!labelIds.length) throw new RangeError("Naive Bayes training requires at least one example");
    const handle = runtime.categoricalNaiveBayesTrain({
      pairs: Uint32Array.from(pairs), offsets: Uint32Array.from(offsets),
      labels: Uint32Array.from(labelIds), labelCount: labels.size, smoothing: options.smoothing ?? 0.5,
    });
    return new RustNaiveBayesClassifier(runtime, handle, [...labels.keys()], names, values);
  }

  labels(): string[] { return [...this.labelNames]; }

  predict(features: FeatureSet): Array<{ label: string; logProb: number; probability: number }> {
    if (this.disposed) throw new Error("classifier has been disposed");
    const pairs: number[] = [];
    for (const [name, value] of entries(features)) {
      const key = valueKey(value);
      const id = this.names.get(name);
      if (id !== undefined) pairs.push(id, this.values.get(key) ?? 0xffffffff);
    }
    const scores = this.runtime.categoricalNaiveBayesPredict(this.handle, Uint32Array.from(pairs), this.labelNames.length);
    return this.labelNames.map((label, i) => ({ label, logProb: scores[i]!, probability: 2 ** scores[i]! }));
  }

  classify(features: FeatureSet): string {
    const rows = this.predict(features);
    return rows.reduce((best, row) => row.logProb > best.logProb ||
      (row.logProb === best.logProb && row.label > best.label) ? row : best).label;
  }

  classifyMany(features: Iterable<FeatureSet>): string[] { return [...features].map((row) => this.classify(row)); }

  dispose(): void {
    if (this.disposed) return;
    this.runtime.categoricalNaiveBayesFree(this.handle);
    this.disposed = true;
  }
}
