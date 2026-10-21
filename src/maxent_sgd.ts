import { textClassifier } from "./text_classifier_transport.ts";

export type MaxEntExample = { label: string; text: string };
export type MaxEntPrediction = { label: string; probability: number; logit: number };
export type MaxEntSerialized = {
  version: number;
  labels: string[];
  vocabulary: string[];
  weights: number[][];
  bias: number[];
  options: { epochs: number; learningRate: number; l2: number; maxFeatures: number };
};
export type MaxEntOptions = { epochs?: number; learningRate?: number; l2?: number; maxFeatures?: number };

/** Per-document multiclass softmax SGD in Rust, not native batch text_linear. */
export class SgdMaxEntTextClassifier {
  private model: MaxEntSerialized;
  constructor(options?: MaxEntOptions) {
    this.model = {
      version: 1, labels: [], vocabulary: [], weights: [], bias: [],
      options: {
        epochs: Math.max(1, Math.floor(options?.epochs ?? 25)),
        learningRate: Math.max(1e-6, options?.learningRate ?? 0.15),
        l2: Math.max(0, options?.l2 ?? 1e-4),
        maxFeatures: Math.max(100, Math.floor(options?.maxFeatures ?? 12000)),
      },
    };
  }

  static fromSerialized(payload: MaxEntSerialized): SgdMaxEntTextClassifier {
    if (payload.version !== 1) throw new Error(`unsupported MaxEnt serialized version: ${payload.version}`);
    const classifier = new SgdMaxEntTextClassifier(payload.options);
    classifier.model = textClassifier({ action: "loadSgd", model: { ...payload, options: classifier.model.options } });
    return classifier;
  }

  train(examples: MaxEntExample[]): this {
    if (!examples.length) throw new Error("MaxEnt training requires at least one example");
    const labels = [...new Set(examples.map((row) => row.label))].sort((a, b) => a.localeCompare(b));
    if (labels.length < 2) throw new Error("MaxEnt training requires at least 2 labels");
    // Rust counts/tokenizes; only ICU-dependent tie ordering stays in JS glue.
    const vocabulary = textClassifier({ action: "sgdVocabulary", texts: examples.map((row) => row.text) })
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, this.model.options.maxFeatures).map(([word]) => word);
    if (!vocabulary.length) throw new Error("MaxEnt training produced an empty vocabulary");
    this.model = textClassifier({ action: "trainSgd", model: { ...this.model, labels, vocabulary }, examples });
    return this;
  }

  labelsList(): string[] { return [...this.model.labels]; }
  predict(text: string): MaxEntPrediction[] {
    if (!this.model.labels.length || !this.model.vocabulary.length) return [];
    return textClassifier({ action: "predictSgd", model: this.model, text });
  }
  classify(text: string): string {
    const top = this.predict(text)[0];
    if (!top) throw new Error("classifier has no labels");
    return top.label;
  }
  evaluate(examples: MaxEntExample[]): { accuracy: number; total: number; correct: number } {
    const correct = examples.filter((row) => this.classify(row.text) === row.label).length;
    return { accuracy: examples.length === 0 ? 0 : correct / examples.length, total: examples.length, correct };
  }
  toJSON(): MaxEntSerialized { return structuredClone(this.model); }
}
export function trainSgdMaxEntTextClassifier(examples: MaxEntExample[], options?: MaxEntOptions): SgdMaxEntTextClassifier {
  return new SgdMaxEntTextClassifier(options).train(examples);
}
export function loadSgdMaxEntTextClassifier(payload: MaxEntSerialized): SgdMaxEntTextClassifier {
  return SgdMaxEntTextClassifier.fromSerialized(payload);
}
