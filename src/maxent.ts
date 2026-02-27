import { tokenizeAsciiNative } from "./native";

export type MaxEntExample = {
  label: string;
  text: string;
};

export type MaxEntPrediction = {
  label: string;
  probability: number;
  logit: number;
};

export type MaxEntSerialized = {
  version: number;
  labels: string[];
  vocabulary: string[];
  weights: number[][];
  bias: number[];
  options: {
    epochs: number;
    learningRate: number;
    l2: number;
    maxFeatures: number;
  };
};

type MaxEntOptions = {
  epochs?: number;
  learningRate?: number;
  l2?: number;
  maxFeatures?: number;
};

type EncodedDoc = {
  indices: Uint32Array;
  counts: Float64Array;
  labelIndex: number;
};

function tokenize(text: string): string[] {
  return tokenizeAsciiNative(text);
}

function softmax(logits: Float64Array): Float64Array {
  let max = -Infinity;
  for (const value of logits) {
    if (value > max) max = value;
  }
  let sum = 0;
  const out = new Float64Array(logits.length);
  for (let i = 0; i < logits.length; i += 1) {
    const e = Math.exp(logits[i]! - max);
    out[i] = e;
    sum += e;
  }
  if (!Number.isFinite(sum) || sum <= 0) {
    const uniform = 1 / Math.max(1, logits.length);
    out.fill(uniform);
    return out;
  }
  for (let i = 0; i < out.length; i += 1) out[i] /= sum;
  return out;
}

function dotSparse(weights: Float64Array, indices: Uint32Array, values: Float64Array): number {
  let out = 0;
  for (let i = 0; i < indices.length; i += 1) {
    out += weights[indices[i]!]! * values[i]!;
  }
  return out;
}

export class MaxEntTextClassifier {
  private labels: string[] = [];
  private vocabulary: string[] = [];
  private tokenToId = new Map<string, number>();
  private weights: Float64Array[] = [];
  private bias = new Float64Array(0);
  private options: Required<MaxEntOptions> = {
    epochs: 25,
    learningRate: 0.15,
    l2: 1e-4,
    maxFeatures: 12000,
  };

  constructor(options?: MaxEntOptions) {
    this.options = {
      epochs: Math.max(1, Math.floor(options?.epochs ?? 25)),
      learningRate: Math.max(1e-6, options?.learningRate ?? 0.15),
      l2: Math.max(0, options?.l2 ?? 1e-4),
      maxFeatures: Math.max(100, Math.floor(options?.maxFeatures ?? 12000)),
    };
  }

  static fromSerialized(payload: MaxEntSerialized): MaxEntTextClassifier {
    if (payload.version !== 1) throw new Error(`unsupported MaxEnt serialized version: ${payload.version}`);
    if (payload.labels.length === 0 || payload.vocabulary.length === 0) {
      throw new Error("invalid MaxEnt serialized payload");
    }
    if (payload.weights.length !== payload.labels.length || payload.bias.length !== payload.labels.length) {
      throw new Error("invalid MaxEnt weight/bias lengths");
    }
    const classifier = new MaxEntTextClassifier(payload.options);
    classifier.labels = [...payload.labels];
    classifier.vocabulary = [...payload.vocabulary];
    classifier.tokenToId = new Map(classifier.vocabulary.map((tok, idx) => [tok, idx]));
    classifier.weights = payload.weights.map((row) => Float64Array.from(row));
    classifier.bias = Float64Array.from(payload.bias);
    return classifier;
  }

  private buildVocabulary(examples: MaxEntExample[]): void {
    const counts = new Map<string, number>();
    for (const row of examples) {
      for (const token of tokenize(row.text)) {
        counts.set(token, (counts.get(token) ?? 0) + 1);
      }
    }
    this.vocabulary = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, this.options.maxFeatures)
      .map(([token]) => token);
    this.tokenToId = new Map(this.vocabulary.map((token, idx) => [token, idx]));
  }

  private encode(text: string): { indices: Uint32Array; counts: Float64Array } {
    const map = new Map<number, number>();
    for (const token of tokenize(text)) {
      const idx = this.tokenToId.get(token);
      if (idx === undefined) continue;
      map.set(idx, (map.get(idx) ?? 0) + 1);
    }
    const entries = [...map.entries()].sort((a, b) => a[0] - b[0]);
    return {
      indices: Uint32Array.from(entries.map(([idx]) => idx)),
      counts: Float64Array.from(entries.map(([, count]) => count)),
    };
  }

  private encodeDataset(examples: MaxEntExample[]): EncodedDoc[] {
    const labelToId = new Map(this.labels.map((label, idx) => [label, idx]));
    return examples.map((row) => {
      const labelIndex = labelToId.get(row.label);
      if (labelIndex === undefined) throw new Error(`unknown label: ${row.label}`);
      const encoded = this.encode(row.text);
      return {
        indices: encoded.indices,
        counts: encoded.counts,
        labelIndex,
      };
    });
  }

  train(examples: MaxEntExample[]): this {
    if (examples.length === 0) throw new Error("MaxEnt training requires at least one example");
    this.labels = [...new Set(examples.map((row) => row.label))].sort((a, b) => a.localeCompare(b));
    if (this.labels.length < 2) throw new Error("MaxEnt training requires at least 2 labels");
    this.buildVocabulary(examples);
    if (this.vocabulary.length === 0) throw new Error("MaxEnt training produced an empty vocabulary");

    this.weights = this.labels.map(() => new Float64Array(this.vocabulary.length));
    this.bias = new Float64Array(this.labels.length);
    const data = this.encodeDataset(examples);
    const lr = this.options.learningRate;
    const l2 = this.options.l2;

    for (let epoch = 0; epoch < this.options.epochs; epoch += 1) {
      for (const doc of data) {
        const logits = new Float64Array(this.labels.length);
        for (let l = 0; l < this.labels.length; l += 1) {
          logits[l] = this.bias[l]! + dotSparse(this.weights[l]!, doc.indices, doc.counts);
        }
        const probs = softmax(logits);
        for (let l = 0; l < this.labels.length; l += 1) {
          const y = l === doc.labelIndex ? 1 : 0;
          const error = y - probs[l]!;
          this.bias[l] += lr * error;
          const w = this.weights[l]!;
          for (let i = 0; i < doc.indices.length; i += 1) {
            const idx = doc.indices[i]!;
            w[idx] += lr * (error * doc.counts[i]! - l2 * w[idx]!);
          }
        }
      }
    }

    return this;
  }

  labelsList(): string[] {
    return [...this.labels];
  }

  predict(text: string): MaxEntPrediction[] {
    if (this.labels.length === 0 || this.vocabulary.length === 0) return [];
    const { indices, counts } = this.encode(text);
    const logits = new Float64Array(this.labels.length);
    for (let l = 0; l < this.labels.length; l += 1) {
      logits[l] = this.bias[l]! + dotSparse(this.weights[l]!, indices, counts);
    }
    const probs = softmax(logits);
    const out: MaxEntPrediction[] = this.labels.map((label, idx) => ({
      label,
      probability: probs[idx]!,
      logit: logits[idx]!,
    }));
    return out.sort((a, b) => b.probability - a.probability);
  }

  classify(text: string): string {
    const scores = this.predict(text);
    if (scores.length === 0) throw new Error("classifier has no labels");
    return scores[0]!.label;
  }

  evaluate(examples: MaxEntExample[]): { accuracy: number; total: number; correct: number } {
    let correct = 0;
    for (const row of examples) {
      if (this.classify(row.text) === row.label) correct += 1;
    }
    return {
      accuracy: examples.length === 0 ? 0 : correct / examples.length,
      total: examples.length,
      correct,
    };
  }

  toJSON(): MaxEntSerialized {
    return {
      version: 1,
      labels: [...this.labels],
      vocabulary: [...this.vocabulary],
      weights: this.weights.map((row) => [...row]),
      bias: [...this.bias],
      options: { ...this.options },
    };
  }
}

export function trainMaxEntTextClassifier(examples: MaxEntExample[], options?: MaxEntOptions): MaxEntTextClassifier {
  return new MaxEntTextClassifier(options).train(examples);
}

export function loadMaxEntTextClassifier(payload: MaxEntSerialized): MaxEntTextClassifier {
  return MaxEntTextClassifier.fromSerialized(payload);
}

