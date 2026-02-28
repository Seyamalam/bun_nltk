import { flattenSparseBatch, TextFeatureVectorizer, type SparseVector, type VectorizerSerialized } from "./features";
import { linearScoresSparseIdsNative } from "./native";

export type LinearModelExample = { label: string; text: string };

export type LogisticSerialized = {
  version: number;
  labels: string[];
  vectorizer: VectorizerSerialized;
  weights: number[];
  bias: number[];
  options: { epochs: number; learningRate: number; l2: number; maxFeatures: number; useNativeScoring?: boolean };
};

export type LinearSvmSerialized = {
  version: number;
  labels: string[];
  vectorizer: VectorizerSerialized;
  weights: number[];
  bias: number[];
  options: { epochs: number; learningRate: number; l2: number; margin: number; maxFeatures: number; useNativeScoring?: boolean };
};

function sigmoid(x: number): number {
  if (x >= 0) {
    const z = Math.exp(-x);
    return 1 / (1 + z);
  }
  const z = Math.exp(x);
  return z / (1 + z);
}

function argmax(values: Float64Array): number {
  let best = 0;
  let bestVal = -Infinity;
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i]!;
    if (v > bestVal) {
      bestVal = v;
      best = i;
    }
  }
  return best;
}

function scoreRowJs(
  vector: SparseVector,
  classCount: number,
  featureCount: number,
  weights: Float64Array,
  bias: Float64Array,
): Float64Array {
  const out = new Float64Array(classCount);
  for (let c = 0; c < classCount; c += 1) {
    let score = bias[c]!;
    const rowBase = c * featureCount;
    for (let i = 0; i < vector.indices.length; i += 1) {
      const f = vector.indices[i]!;
      score += weights[rowBase + f]! * vector.values[i]!;
    }
    out[c] = score;
  }
  return out;
}

function scoreBatchNativeOrJs(
  rows: SparseVector[],
  classCount: number,
  featureCount: number,
  weights: Float64Array,
  bias: Float64Array,
  preferNative = true,
): Float64Array {
  const batch = flattenSparseBatch(rows);
  return scoreBatchFlatNativeOrJs(rows, batch, classCount, featureCount, weights, bias, preferNative);
}

function scoreBatchFlatNativeOrJs(
  rows: SparseVector[],
  batch: { docOffsets: Uint32Array; featureIds: Uint32Array; featureValues: Float64Array },
  classCount: number,
  featureCount: number,
  weights: Float64Array,
  bias: Float64Array,
  preferNative = true,
): Float64Array {
  if (!preferNative) {
    const out = new Float64Array(rows.length * classCount);
    for (let d = 0; d < rows.length; d += 1) {
      const local = scoreRowJs(rows[d]!, classCount, featureCount, weights, bias);
      out.set(local, d * classCount);
    }
    return out;
  }
  try {
    return linearScoresSparseIdsNative({
      docOffsets: batch.docOffsets,
      featureIds: batch.featureIds,
      featureValues: batch.featureValues,
      classCount,
      featureCount,
      weights,
      bias,
    });
  } catch {
    const out = new Float64Array(rows.length * classCount);
    for (let d = 0; d < rows.length; d += 1) {
      const local = scoreRowJs(rows[d]!, classCount, featureCount, weights, bias);
      out.set(local, d * classCount);
    }
    return out;
  }
}

export class LogisticTextClassifier {
  private readonly options: { epochs: number; learningRate: number; l2: number; maxFeatures: number; useNativeScoring: boolean };
  private readonly vectorizer: TextFeatureVectorizer;
  private labels: string[] = [];
  private weights = new Float64Array(0);
  private bias = new Float64Array(0);

  constructor(options: { epochs?: number; learningRate?: number; l2?: number; maxFeatures?: number; useNativeScoring?: boolean } = {}) {
    this.options = {
      epochs: Math.max(1, Math.floor(options.epochs ?? 20)),
      learningRate: Math.max(1e-6, options.learningRate ?? 0.1),
      l2: Math.max(0, options.l2 ?? 1e-4),
      maxFeatures: Math.max(256, Math.floor(options.maxFeatures ?? 16000)),
      useNativeScoring: options.useNativeScoring ?? true,
    };
    this.vectorizer = new TextFeatureVectorizer({ ngramMin: 1, ngramMax: 2, binary: false, maxFeatures: this.options.maxFeatures });
  }

  static fromJSON(payload: LogisticSerialized): LogisticTextClassifier {
    if (payload.version !== 1) throw new Error(`unsupported Logistic model version: ${payload.version}`);
    const model = new LogisticTextClassifier(payload.options);
    model.labels = [...payload.labels];
    (model as { vectorizer: TextFeatureVectorizer }).vectorizer = TextFeatureVectorizer.fromJSON(payload.vectorizer);
    model.weights = Float64Array.from(payload.weights);
    model.bias = Float64Array.from(payload.bias);
    return model;
  }

  train(examples: LinearModelExample[]): this {
    if (examples.length === 0) throw new Error("Logistic training requires examples");
    this.labels = [...new Set(examples.map((x) => x.label))].sort((a, b) => a.localeCompare(b));
    this.vectorizer.fit(examples.map((x) => x.text));
    const rows = this.vectorizer.transformMany(examples.map((x) => x.text));
    const labelToId = new Map(this.labels.map((label, idx) => [label, idx]));

    const classCount = this.labels.length;
    const featureCount = this.vectorizer.featureCount;
    this.weights = new Float64Array(classCount * featureCount);
    this.bias = new Float64Array(classCount);

    const gradW = new Float64Array(classCount * featureCount);
    const gradB = new Float64Array(classCount);
    const invN = 1 / Math.max(1, rows.length);
    const batch = flattenSparseBatch(rows);
    for (let epoch = 0; epoch < this.options.epochs; epoch += 1) {
      gradW.fill(0);
      gradB.fill(0);
      const scores = scoreBatchFlatNativeOrJs(
        rows,
        batch,
        classCount,
        featureCount,
        this.weights,
        this.bias,
        this.options.useNativeScoring,
      );
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i]!;
        const gold = labelToId.get(examples[i]!.label)!;
        const rowBase = i * classCount;
        for (let c = 0; c < classCount; c += 1) {
          const y = c === gold ? 1 : 0;
          const p = sigmoid(scores[rowBase + c]!);
          const err = y - p;
          gradB[c] += err;
          const base = c * featureCount;
          for (let j = 0; j < row.indices.length; j += 1) {
            const f = row.indices[j]!;
            gradW[base + f] += err * row.values[j]!;
          }
        }
      }
      for (let c = 0; c < classCount; c += 1) {
        this.bias[c] += this.options.learningRate * gradB[c]! * invN;
      }
      for (let idx = 0; idx < this.weights.length; idx += 1) {
        const w = this.weights[idx]!;
        this.weights[idx] += this.options.learningRate * (gradW[idx]! * invN - this.options.l2 * w);
      }
    }
    return this;
  }

  predict(text: string): Array<{ label: string; probability: number; score: number }> {
    const row = this.vectorizer.transform(text);
    const classCount = this.labels.length;
    const featureCount = this.vectorizer.featureCount;
    if (classCount === 0 || featureCount === 0) return [];
    const scores = scoreRowJs(row, classCount, featureCount, this.weights, this.bias);
    const probs = Float64Array.from(scores, (s) => sigmoid(s));
    const out = this.labels.map((label, idx) => ({ label, probability: probs[idx]!, score: scores[idx]! }));
    return out.sort((a, b) => b.probability - a.probability);
  }

  classify(text: string): string {
    const out = this.predict(text);
    if (out.length === 0) throw new Error("Logistic classifier has no labels");
    return out[0]!.label;
  }

  classifyBatch(texts: string[]): string[] {
    if (texts.length === 0) return [];
    const rows = this.vectorizer.transformMany(texts);
    const classCount = this.labels.length;
    const featureCount = this.vectorizer.featureCount;
    const scores = scoreBatchNativeOrJs(rows, classCount, featureCount, this.weights, this.bias, this.options.useNativeScoring);
    const out: string[] = [];
    for (let d = 0; d < rows.length; d += 1) {
      const slice = scores.subarray(d * classCount, (d + 1) * classCount);
      out.push(this.labels[argmax(slice)]!);
    }
    return out;
  }

  evaluate(examples: LinearModelExample[]): { accuracy: number; total: number; correct: number } {
    const preds = this.classifyBatch(examples.map((x) => x.text));
    let correct = 0;
    for (let i = 0; i < preds.length; i += 1) if (preds[i] === examples[i]!.label) correct += 1;
    return { accuracy: preds.length === 0 ? 0 : correct / preds.length, total: preds.length, correct };
  }

  toJSON(): LogisticSerialized {
    return {
      version: 1,
      labels: [...this.labels],
      vectorizer: this.vectorizer.toJSON(),
      weights: [...this.weights],
      bias: [...this.bias],
      options: { ...this.options },
    };
  }
}

export class LinearSvmTextClassifier {
  private readonly options: { epochs: number; learningRate: number; l2: number; margin: number; maxFeatures: number; useNativeScoring: boolean };
  private readonly vectorizer: TextFeatureVectorizer;
  private labels: string[] = [];
  private weights = new Float64Array(0);
  private bias = new Float64Array(0);

  constructor(options: { epochs?: number; learningRate?: number; l2?: number; margin?: number; maxFeatures?: number; useNativeScoring?: boolean } = {}) {
    this.options = {
      epochs: Math.max(1, Math.floor(options.epochs ?? 20)),
      learningRate: Math.max(1e-6, options.learningRate ?? 0.05),
      l2: Math.max(0, options.l2 ?? 5e-4),
      margin: Math.max(0.1, options.margin ?? 1),
      maxFeatures: Math.max(256, Math.floor(options.maxFeatures ?? 16000)),
      useNativeScoring: options.useNativeScoring ?? true,
    };
    this.vectorizer = new TextFeatureVectorizer({ ngramMin: 1, ngramMax: 2, binary: false, maxFeatures: this.options.maxFeatures });
  }

  static fromJSON(payload: LinearSvmSerialized): LinearSvmTextClassifier {
    if (payload.version !== 1) throw new Error(`unsupported LinearSVM model version: ${payload.version}`);
    const model = new LinearSvmTextClassifier(payload.options);
    model.labels = [...payload.labels];
    (model as { vectorizer: TextFeatureVectorizer }).vectorizer = TextFeatureVectorizer.fromJSON(payload.vectorizer);
    model.weights = Float64Array.from(payload.weights);
    model.bias = Float64Array.from(payload.bias);
    return model;
  }

  train(examples: LinearModelExample[]): this {
    if (examples.length === 0) throw new Error("LinearSVM training requires examples");
    this.labels = [...new Set(examples.map((x) => x.label))].sort((a, b) => a.localeCompare(b));
    this.vectorizer.fit(examples.map((x) => x.text));
    const rows = this.vectorizer.transformMany(examples.map((x) => x.text));
    const labelToId = new Map(this.labels.map((label, idx) => [label, idx]));

    const classCount = this.labels.length;
    const featureCount = this.vectorizer.featureCount;
    this.weights = new Float64Array(classCount * featureCount);
    this.bias = new Float64Array(classCount);

    const gradW = new Float64Array(classCount * featureCount);
    const gradB = new Float64Array(classCount);
    const invN = 1 / Math.max(1, rows.length);
    const batch = flattenSparseBatch(rows);
    for (let epoch = 0; epoch < this.options.epochs; epoch += 1) {
      gradW.fill(0);
      gradB.fill(0);
      const scores = scoreBatchFlatNativeOrJs(
        rows,
        batch,
        classCount,
        featureCount,
        this.weights,
        this.bias,
        this.options.useNativeScoring,
      );
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i]!;
        const gold = labelToId.get(examples[i]!.label)!;
        const rowBase = i * classCount;
        for (let c = 0; c < classCount; c += 1) {
          const y = c === gold ? 1 : -1;
          const score = scores[rowBase + c]!;
          const lossGrad = y * score < this.options.margin ? -y : 0;
          gradB[c] += lossGrad;
          const base = c * featureCount;
          for (let j = 0; j < row.indices.length; j += 1) {
            const f = row.indices[j]!;
            gradW[base + f] += lossGrad * row.values[j]!;
          }
        }
      }
      for (let c = 0; c < classCount; c += 1) {
        this.bias[c] -= this.options.learningRate * gradB[c]! * invN;
      }
      for (let idx = 0; idx < this.weights.length; idx += 1) {
        const w = this.weights[idx]!;
        this.weights[idx] -= this.options.learningRate * (gradW[idx]! * invN + this.options.l2 * w);
      }
    }

    return this;
  }

  predict(text: string): Array<{ label: string; score: number }> {
    const row = this.vectorizer.transform(text);
    const classCount = this.labels.length;
    const featureCount = this.vectorizer.featureCount;
    if (classCount === 0 || featureCount === 0) return [];
    const scores = scoreRowJs(row, classCount, featureCount, this.weights, this.bias);
    return this.labels
      .map((label, idx) => ({ label, score: scores[idx]! }))
      .sort((a, b) => b.score - a.score);
  }

  classify(text: string): string {
    const out = this.predict(text);
    if (out.length === 0) throw new Error("LinearSVM classifier has no labels");
    return out[0]!.label;
  }

  classifyBatch(texts: string[]): string[] {
    if (texts.length === 0) return [];
    const rows = this.vectorizer.transformMany(texts);
    const classCount = this.labels.length;
    const featureCount = this.vectorizer.featureCount;
    const scores = scoreBatchNativeOrJs(rows, classCount, featureCount, this.weights, this.bias, this.options.useNativeScoring);
    const out: string[] = [];
    for (let d = 0; d < rows.length; d += 1) {
      const slice = scores.subarray(d * classCount, (d + 1) * classCount);
      out.push(this.labels[argmax(slice)]!);
    }
    return out;
  }

  evaluate(examples: LinearModelExample[]): { accuracy: number; total: number; correct: number } {
    const preds = this.classifyBatch(examples.map((x) => x.text));
    let correct = 0;
    for (let i = 0; i < preds.length; i += 1) if (preds[i] === examples[i]!.label) correct += 1;
    return { accuracy: preds.length === 0 ? 0 : correct / preds.length, total: preds.length, correct };
  }

  toJSON(): LinearSvmSerialized {
    return {
      version: 1,
      labels: [...this.labels],
      vectorizer: this.vectorizer.toJSON(),
      weights: [...this.weights],
      bias: [...this.bias],
      options: { ...this.options },
    };
  }
}

export function trainLogisticTextClassifier(
  examples: LinearModelExample[],
  options: { epochs?: number; learningRate?: number; l2?: number; maxFeatures?: number; useNativeScoring?: boolean } = {},
): LogisticTextClassifier {
  return new LogisticTextClassifier(options).train(examples);
}

export function trainLinearSvmTextClassifier(
  examples: LinearModelExample[],
  options: { epochs?: number; learningRate?: number; l2?: number; margin?: number; maxFeatures?: number; useNativeScoring?: boolean } = {},
): LinearSvmTextClassifier {
  return new LinearSvmTextClassifier(options).train(examples);
}

export function loadLogisticTextClassifier(payload: LogisticSerialized): LogisticTextClassifier {
  return LogisticTextClassifier.fromJSON(payload);
}

export function loadLinearSvmTextClassifier(payload: LinearSvmSerialized): LinearSvmTextClassifier {
  return LinearSvmTextClassifier.fromJSON(payload);
}
