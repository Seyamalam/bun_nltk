import { textClassifier } from "./text_classifier_transport.ts";

export type SparseVector = {
  indices: Uint32Array;
  values: Float64Array;
};

export type VectorizerSerialized = {
  version: number;
  ngramMin: number;
  ngramMax: number;
  binary: boolean;
  maxFeatures: number;
  vocabulary: string[];
};

export type VectorizerOptions = {
  ngramMin?: number;
  ngramMax?: number;
  binary?: boolean;
  maxFeatures?: number;
};

export class TextFeatureVectorizer {
  readonly ngramMin: number;
  readonly ngramMax: number;
  readonly binary: boolean;
  readonly maxFeatures: number;
  private features: string[] = [];

  constructor(options: VectorizerOptions = {}) {
    this.ngramMin = Math.max(1, Math.floor(options.ngramMin ?? 1));
    this.ngramMax = Math.max(this.ngramMin, Math.floor(options.ngramMax ?? 1));
    this.binary = options.binary ?? false;
    this.maxFeatures = Math.max(64, Math.floor(options.maxFeatures ?? 12000));
  }

  static fromJSON(payload: VectorizerSerialized): TextFeatureVectorizer {
    if (payload.version !== 1) throw new Error(`unsupported vectorizer version: ${payload.version}`);
    const vec = new TextFeatureVectorizer({
      ngramMin: payload.ngramMin,
      ngramMax: payload.ngramMax,
      binary: payload.binary,
      maxFeatures: payload.maxFeatures,
    });
    vec.features = textClassifier({ action: "loadVectorizer", model: { ...vec.toJSON(), vocabulary: payload.vocabulary } }).vocabulary;
    return vec;
  }

  get featureCount(): number {
    return this.features.length;
  }

  vocabulary(): string[] {
    return [...this.features];
  }

  fit(texts: string[]): this {
    this.features = textClassifier({ action: "fitVectorizer", model: this.toJSON(), texts }).vocabulary;
    return this;
  }

  transform(text: string): SparseVector {
    return this.transformMany([text])[0]!;
  }

  transformMany(texts: string[]): SparseVector[] {
    return textClassifier({ action: "transformVectorizer", model: this.toJSON(), texts })
      .map((row) => ({ indices: Uint32Array.from(row.indices), values: Float64Array.from(row.values) }));
  }

  toJSON(): VectorizerSerialized {
    return {
      version: 1,
      ngramMin: this.ngramMin,
      ngramMax: this.ngramMax,
      binary: this.binary,
      maxFeatures: this.maxFeatures,
      vocabulary: this.vocabulary(),
    };
  }
}

export function flattenSparseBatch(rows: SparseVector[]): {
  docOffsets: Uint32Array;
  featureIds: Uint32Array;
  featureValues: Float64Array;
} {
  const offsets = new Uint32Array(rows.length + 1);
  let total = 0;
  for (let i = 0; i < rows.length; i += 1) {
    total += rows[i]!.indices.length;
    offsets[i + 1] = total;
  }

  const ids = new Uint32Array(total);
  const values = new Float64Array(total);
  let cursor = 0;
  for (const row of rows) {
    ids.set(row.indices, cursor);
    values.set(row.values, cursor);
    cursor += row.indices.length;
  }

  return { docOffsets: offsets, featureIds: ids, featureValues: values };
}
