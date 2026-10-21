import { textNB, type PositivePrediction } from "./text_nb_transport.ts";

export type PositiveNaiveBayesSerialized = {
  version: number;
  positiveLabel: string;
  negativeLabel: string;
  positivePrior: number;
  vocabulary: string[];
  presentLogPos: number[];
  absentLogPos: number[];
  presentLogNeg: number[];
  absentLogNeg: number[];
  absentLogPosSum: number;
  absentLogNegSum: number;
  options: { maxFeatures: number };
};
type Options = { maxFeatures?: number; positivePrior?: number; positiveLabel?: string; negativeLabel?: string };
type TextRows = string[] | Array<{ text: string }>;

function sanitizePrior(prior: number): number {
  return Number.isFinite(prior) ? Math.min(0.999, Math.max(0.001, prior)) : 0.5;
}
function toTexts(rows: TextRows): string[] {
  return rows.map((row) => typeof row === "string" ? row : row.text);
}

/** Legacy Bernoulli positive/unlabeled text extension, not NLTK's categorical variant. */
export class PositiveNaiveBayesTextClassifier {
  private state: PositiveNaiveBayesSerialized;
  constructor(options: Options = {}) {
    this.state = {
      version: 1, positiveLabel: options.positiveLabel ?? "pos", negativeLabel: options.negativeLabel ?? "neg",
      positivePrior: sanitizePrior(options.positivePrior ?? 0.5),
      vocabulary: [], presentLogPos: [], absentLogPos: [], presentLogNeg: [], absentLogNeg: [],
      absentLogPosSum: 0, absentLogNegSum: 0,
      options: { maxFeatures: Math.max(128, Math.floor(options.maxFeatures ?? 12000)) },
    };
  }
  static fromJSON(payload: PositiveNaiveBayesSerialized): PositiveNaiveBayesTextClassifier {
    const model = new PositiveNaiveBayesTextClassifier({
      ...payload.options, positivePrior: payload.positivePrior,
      positiveLabel: payload.positiveLabel, negativeLabel: payload.negativeLabel,
    });
    model.state = textNB({ action: "loadPositive", model: {
      ...payload, options: model.state.options, positivePrior: model.state.positivePrior,
    } });
    return model;
  }
  train(positiveRows: TextRows, unlabeledRows: TextRows, options: { positivePrior?: number } = {}): this {
    this.state = textNB({ action: "trainPositive", model: this.state,
      positive: toTexts(positiveRows), unlabeled: toTexts(unlabeledRows),
      prior: sanitizePrior(options.positivePrior ?? this.state.positivePrior),
    });
    return this;
  }
  predict(text: string): PositivePrediction[] {
    return textNB({ action: "predictPositive", model: this.state, text });
  }
  classify(text: string): string { return this.predict(text)[0]!.label; }
  evaluate(examples: Array<{ label: string; text: string }>): { accuracy: number; total: number; correct: number } {
    const correct = examples.filter((row) => this.classify(row.text) === row.label).length;
    return { accuracy: examples.length ? correct / examples.length : 0, total: examples.length, correct };
  }
  toJSON(): PositiveNaiveBayesSerialized { return structuredClone(this.state); }
}
export function trainPositiveNaiveBayesTextClassifier(positiveRows: TextRows, unlabeledRows: TextRows, options: Options = {}): PositiveNaiveBayesTextClassifier {
  return new PositiveNaiveBayesTextClassifier(options).train(positiveRows, unlabeledRows, { positivePrior: options.positivePrior });
}
export function loadPositiveNaiveBayesTextClassifier(payload: PositiveNaiveBayesSerialized): PositiveNaiveBayesTextClassifier {
  return PositiveNaiveBayesTextClassifier.fromJSON(payload);
}
