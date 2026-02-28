import { TextFeatureVectorizer, type VectorizerSerialized } from "./features";

export type PerceptronExample = {
  label: string;
  text: string;
};

export type PerceptronSerialized = {
  version: number;
  labels: string[];
  vectorizer: VectorizerSerialized;
  weights: number[];
  bias: number[];
  options: {
    epochs: number;
    learningRate: number;
    maxFeatures: number;
    averaged: boolean;
  };
};

function argmax(values: Float64Array): number {
  let best = 0;
  let bestVal = -Infinity;
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i]!;
    if (value > bestVal) {
      bestVal = value;
      best = i;
    }
  }
  return best;
}

export class PerceptronTextClassifier {
  private readonly options: { epochs: number; learningRate: number; maxFeatures: number; averaged: boolean };
  private readonly vectorizer: TextFeatureVectorizer;
  private labels: string[] = [];
  private weights = new Float64Array(0);
  private bias = new Float64Array(0);

  constructor(options: { epochs?: number; learningRate?: number; maxFeatures?: number; averaged?: boolean } = {}) {
    this.options = {
      epochs: Math.max(1, Math.floor(options.epochs ?? 18)),
      learningRate: Math.max(1e-6, options.learningRate ?? 1),
      maxFeatures: Math.max(256, Math.floor(options.maxFeatures ?? 14000)),
      averaged: options.averaged ?? true,
    };
    this.vectorizer = new TextFeatureVectorizer({
      ngramMin: 1,
      ngramMax: 2,
      binary: true,
      maxFeatures: this.options.maxFeatures,
    });
  }

  static fromJSON(payload: PerceptronSerialized): PerceptronTextClassifier {
    if (payload.version !== 1) throw new Error(`unsupported Perceptron model version: ${payload.version}`);
    const model = new PerceptronTextClassifier(payload.options);
    model.labels = [...payload.labels];
    (model as { vectorizer: TextFeatureVectorizer }).vectorizer = TextFeatureVectorizer.fromJSON(payload.vectorizer);
    model.weights = Float64Array.from(payload.weights);
    model.bias = Float64Array.from(payload.bias);
    return model;
  }

  train(examples: PerceptronExample[]): this {
    if (examples.length === 0) throw new Error("Perceptron training requires examples");
    this.labels = [...new Set(examples.map((row) => row.label))].sort((a, b) => a.localeCompare(b));
    if (this.labels.length < 2) throw new Error("Perceptron training requires at least 2 labels");

    this.vectorizer.fit(examples.map((row) => row.text));
    const rows = this.vectorizer.transformMany(examples.map((row) => row.text));
    const labelToId = new Map(this.labels.map((label, idx) => [label, idx]));

    const classCount = this.labels.length;
    const featureCount = this.vectorizer.featureCount;
    this.weights = new Float64Array(classCount * featureCount);
    this.bias = new Float64Array(classCount);

    const averagedWeights = this.options.averaged ? new Float64Array(this.weights.length) : null;
    const averagedBias = this.options.averaged ? new Float64Array(this.bias.length) : null;
    let averagedSteps = 0;

    for (let epoch = 0; epoch < this.options.epochs; epoch += 1) {
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i]!;
        const gold = labelToId.get(examples[i]!.label);
        if (gold === undefined) continue;

        const scores = new Float64Array(classCount);
        for (let c = 0; c < classCount; c += 1) {
          let score = this.bias[c]!;
          const base = c * featureCount;
          for (let j = 0; j < row.indices.length; j += 1) {
            const featureId = row.indices[j]!;
            score += this.weights[base + featureId]!;
          }
          scores[c] = score;
        }

        const predicted = argmax(scores);
        if (predicted !== gold) {
          this.bias[gold] += this.options.learningRate;
          this.bias[predicted] -= this.options.learningRate;
          const goldBase = gold * featureCount;
          const predictedBase = predicted * featureCount;
          for (const featureId of row.indices) {
            this.weights[goldBase + featureId] += this.options.learningRate;
            this.weights[predictedBase + featureId] -= this.options.learningRate;
          }
        }

        if (averagedWeights && averagedBias) {
          for (let k = 0; k < this.weights.length; k += 1) averagedWeights[k] += this.weights[k]!;
          for (let k = 0; k < this.bias.length; k += 1) averagedBias[k] += this.bias[k]!;
          averagedSteps += 1;
        }
      }
    }

    if (averagedWeights && averagedBias && averagedSteps > 0) {
      const inv = 1 / averagedSteps;
      for (let i = 0; i < this.weights.length; i += 1) this.weights[i] = averagedWeights[i]! * inv;
      for (let i = 0; i < this.bias.length; i += 1) this.bias[i] = averagedBias[i]! * inv;
    }

    return this;
  }

  predict(text: string): Array<{ label: string; score: number }> {
    if (this.labels.length === 0 || this.vectorizer.featureCount === 0) return [];
    const row = this.vectorizer.transform(text);
    const classCount = this.labels.length;
    const featureCount = this.vectorizer.featureCount;
    const scores = new Float64Array(classCount);
    for (let c = 0; c < classCount; c += 1) {
      let score = this.bias[c]!;
      const base = c * featureCount;
      for (const featureId of row.indices) {
        score += this.weights[base + featureId]!;
      }
      scores[c] = score;
    }
    return this.labels
      .map((label, idx) => ({ label, score: scores[idx]! }))
      .sort((a, b) => b.score - a.score);
  }

  classify(text: string): string {
    const ranked = this.predict(text);
    if (ranked.length === 0) throw new Error("Perceptron classifier has no labels");
    return ranked[0]!.label;
  }

  evaluate(examples: PerceptronExample[]): { accuracy: number; total: number; correct: number } {
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

  toJSON(): PerceptronSerialized {
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

export function trainPerceptronTextClassifier(
  examples: PerceptronExample[],
  options: { epochs?: number; learningRate?: number; maxFeatures?: number; averaged?: boolean } = {},
): PerceptronTextClassifier {
  return new PerceptronTextClassifier(options).train(examples);
}

export function loadPerceptronTextClassifier(payload: PerceptronSerialized): PerceptronTextClassifier {
  return PerceptronTextClassifier.fromJSON(payload);
}
