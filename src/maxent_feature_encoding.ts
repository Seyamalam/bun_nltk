import { probabilityRuntime } from "./probability_abi.ts";
import { valueKey } from "./feature_encoding.ts";
import type { FeatureValue } from "./feature_types.ts";

/** Preserve Python float-vs-int identity, including integral floats (1.0). */
export type PythonFloatFeature = { readonly pythonType: "float"; readonly value: number };
export function pythonFloat(value: number): PythonFloatFeature {
  if (!Number.isFinite(value)) throw new TypeError("float features must be finite");
  return { pythonType: "float", value };
}
export const PYTHON_INT = Symbol("<class 'int'>");
export const PYTHON_FLOAT = Symbol("<class 'float'>");
export const PYTHON_BOOL = Symbol("<class 'bool'>");
export type MaxentFeatureValue = FeatureValue | PythonFloatFeature;
export type MaxentFeatureset = Record<string, MaxentFeatureValue>;
export type MaxentEncodingExample = readonly [MaxentFeatureset, string];
export type MaxentMappingValue = MaxentFeatureValue | typeof PYTHON_INT | typeof PYTHON_FLOAT | typeof PYTHON_BOOL;
export type MaxentFeatureMapping = Iterable<readonly [readonly [string, MaxentMappingValue, string], number]>;
export type MaxentEncodingOptions = { unseen_features?: boolean; alwayson_features?: boolean };
type Descriptor = { kind: number; name?: string; value?: MaxentMappingValue; label?: string };

function rawValue(value: MaxentFeatureValue): FeatureValue {
  if (value !== null && typeof value === "object") {
    if (value.pythonType !== "float" || !Number.isFinite(value.value)) throw new TypeError("invalid Python float feature");
    return value.value;
  }
  return value;
}

function repr(value: MaxentMappingValue): string {
  if (value === PYTHON_INT) return "<class 'int'>";
  if (value === PYTHON_FLOAT) return "<class 'float'>";
  if (value === PYTHON_BOOL) return "<class 'bool'>";
  if (value === null || value === undefined) return "None";
  if (value === true) return "True";
  if (value === false) return "False";
  if (typeof value === "string") {
    const quote = value.includes("'") && !value.includes('"') ? '"' : "'";
    const escaped = value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")
      .split("").map(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? `\\x${char.charCodeAt(0).toString(16).padStart(2, "0")}` : char).join("")
      .replaceAll(quote, `\\${quote}`);
    return quote + escaped + quote;
  }
  if (typeof value === "object") return Number.isInteger(value.value) ? `${value.value}.0` : String(value.value);
  return String(value);
}

function intern(map: Map<string, number>, key: string): number {
  if (!map.has(key)) map.set(key, map.size);
  return map.get(key)!;
}

/** Rust-owned NLTK joint encoding, independent of classifier training. */
export class BinaryMaxentFeatureEncoding {
  protected typed = false;
  private readonly names = new Map<string, number>();
  private readonly values = new Map<string, number>();
  private readonly valueObjects: MaxentMappingValue[] = [];
  private readonly displayIds = new Map<string, number>();
  private readonly labelIds = new Map<string, number>();
  private labelNames: string[];
  private handle = 0;
  private descriptors: Descriptor[] = [];
  private disposed = false;

  constructor(labels: Iterable<string>, mapping: MaxentFeatureMapping, unseen_features = false, alwayson_features = false) {
    this.typed = new.target === TypedMaxentFeatureEncoding;
    this.labelNames = [...labels];
    for (const label of this.labelNames) this.label(label);
    const entries = [...mapping];
    const ids = new Set(entries.map(entry => entry[1]));
    if (ids.size !== entries.length || entries.some(([, id]) => !Number.isInteger(id) || id < 0 || id >= entries.length)) {
      throw new RangeError("Mapping values must be exactly the set of integers from 0...len(mapping)");
    }
    const input = [Number(this.typed), Number(alwayson_features), Number(unseen_features), 0, this.labelNames.length,
      ...this.labelNames.map(label => this.label(label)), entries.length];
    for (const [[name, value, label]] of entries.sort((a, b) => a[1] - b[1])) {
      if (typeof name !== "string") throw new TypeError("feature names must be strings");
      let kind = 0, id = 0;
      if (value === PYTHON_INT) kind = 1;
      else if (value === PYTHON_FLOAT) kind = 2;
      else if (value === PYTHON_BOOL) kind = 3;
      else id = this.value(value);
      input.push(intern(this.names, name), kind, id, this.label(label), this.display(value));
    }
    this.handle = probabilityRuntime().call(7, input, 1)[0]!;
    this.readDescriptors(entries.length);
  }

  private label(label: string): number {
    if (typeof label !== "string") throw new TypeError("labels must be strings");
    return intern(this.labelIds, label);
  }
  private value(value: MaxentFeatureValue): number {
    const key = valueKey(rawValue(value));
    if (!this.values.has(key)) {
      this.values.set(key, this.values.size);
    }
    return this.values.get(key)!;
  }
  private display(value: MaxentMappingValue): number {
    const key = repr(value);
    if (!this.displayIds.has(key)) {
      this.displayIds.set(key, this.valueObjects.length);
      this.valueObjects.push(value);
    }
    return this.displayIds.get(key)!;
  }
  private inputs(features: MaxentFeatureset): number[] {
    if (!features || typeof features !== "object" || Array.isArray(features)) throw new TypeError("features must be a dictionary");
    const entries = Object.entries(features), result = [entries.length];
    for (const [name, value] of entries) {
      const raw = rawValue(value);
      if (typeof raw === "number" && !Number.isFinite(raw)) throw new TypeError("numeric features must be finite");
      const kind = typeof raw === "boolean" ? 3 : typeof raw === "number" ?
        (typeof value === "object" || !Number.isInteger(raw) ? 2 : 1) : 0;
      result.push(intern(this.names, name), this.value(value), this.display(value), kind, kind === 0 ? 0 : Number(raw));
    }
    return result;
  }

  private readDescriptors(featureCount: number): void {
    const out = probabilityRuntime().call(9, [this.handle], 4 + this.labelNames.length + featureCount * 5 + this.labelNames.length * 2 + this.names.size * 2);
    const labels = [...this.labelIds.keys()], names = [...this.names.keys()];
    const nlabels = out[0]!, nfeatures = out[1]!, nalways = out[2]!, nunseen = out[3]!;
    this.labelNames = out.slice(4, 4 + nlabels).map(id => labels[id]!);
    let offset = 4 + nlabels;
    this.descriptors = [];
    for (let i = 0; i < nfeatures; i++, offset += 5) {
      const kind = out[offset + 1]!;
      this.descriptors.push({ kind: 0, name: names[out[offset]!]!, label: labels[out[offset + 3]!]!,
        value: kind === 1 ? PYTHON_INT : kind === 2 ? PYTHON_FLOAT : kind === 3 ? PYTHON_BOOL : this.valueObjects[out[offset + 4]!]! });
    }
    for (let i = 0; i < nalways; i++, offset += 2) this.descriptors[out[offset + 1]!] = { kind: 1, label: labels[out[offset]!]! };
    for (let i = 0; i < nunseen; i++, offset += 2) this.descriptors[out[offset + 1]!] = { kind: 2, name: names[out[offset]!]! };
  }

  static train(
    train_toks: Iterable<MaxentEncodingExample>, count_cutoff = 0, labels: Iterable<string> | null = null,
    options: MaxentEncodingOptions = {},
  ): BinaryMaxentFeatureEncoding {
    const rows = [...train_toks];
    const supplied = labels === null ? null : [...labels];
    const known = supplied ?? [...new Set(rows.map(row => row[1]))];
    const model = new this(known, [], false, false);
    const oldHandle = model.handle;
    try {
      const input = [Number(model.typed), Number(options.alwayson_features ?? false), Number(options.unseen_features ?? false),
        count_cutoff, known.length, ...known.map(label => model.label(label)), rows.length];
      let featureCount = 0;
      for (const [features, label] of rows) {
        if (supplied && supplied.length > 0 && !supplied.includes(label)) throw new RangeError(`Unexpected label ${label}`);
        const encoded = model.inputs(features);
        featureCount += encoded[0]!;
        input.push(model.label(label), ...encoded);
      }
      model.handle = probabilityRuntime().call(6, input, 1)[0]!;
      model.readDescriptors(featureCount);
      return model;
    } catch (error) {
      if (model.handle !== oldHandle) model.dispose();
      throw error;
    } finally { probabilityRuntime().call(10, [oldHandle], 0); }
  }

  encode(featureset: MaxentFeatureset, label: string): Array<[number, number]> {
    if (this.disposed) throw new Error("encoding has been disposed");
    const inputs = this.inputs(featureset);
    const out = probabilityRuntime().call(8, [this.handle, this.label(label), ...inputs], (inputs[0]! + 1) * 2);
    const result: Array<[number, number]> = [];
    for (let i = 0; i < out.length; i += 2) result.push([out[i]!, out[i + 1]!]);
    return result;
  }
  labels(): string[] { return [...this.labelNames]; }
  length(): number { return this.descriptors.length; }
  describe(f_id: number): string {
    if (!Number.isInteger(f_id)) throw new TypeError("describe() expected an int");
    // Python permits negative indexing into the inverse base mapping.
    const baseLength = this.descriptors.filter(row => row.kind === 0).length;
    const index = f_id < 0 ? baseLength + f_id : f_id;
    const row = this.descriptors[index];
    if (!row || (f_id < 0 && row.kind !== 0)) throw new RangeError("Bad feature id");
    if (row.kind === 1) return `label is ${repr(row.label!)}`;
    if (row.kind === 2) return `${row.name} is unseen`;
    return `${row.name}==${repr(row.value)} and label is ${repr(row.label!)}`;
  }
  dispose(): void {
    if (!this.disposed && this.handle !== 0) probabilityRuntime().call(10, [this.handle], 0);
    this.disposed = true;
  }
}

export class TypedMaxentFeatureEncoding extends BinaryMaxentFeatureEncoding {
  static override train(
    train_toks: Iterable<MaxentEncodingExample>, count_cutoff = 0, labels: Iterable<string> | null = null,
    options: MaxentEncodingOptions = {},
  ): TypedMaxentFeatureEncoding {
    return super.train(train_toks, count_cutoff, labels, options) as TypedMaxentFeatureEncoding;
  }
}
