import { textNB } from "./text_nb_transport.ts";

export type NaiveBayesExample = { label: string; text: string };
export type NaiveBayesPrediction = { label: string; logProb: number };
export type NaiveBayesSerialized = {
  version: number;
  smoothing: number;
  totalDocs: number;
  labels: string[];
  labelDocCounts: number[];
  labelTokenTotals: number[];
  vocabulary: string[];
  tokenCountsByLabel: Array<Array<string | number>>;
};

/** Version-1 text extension. Incremental counting and scoring run in Rust/WASM. */
export class MultinomialNaiveBayesTextClassifier {
  private state: NaiveBayesSerialized;
  constructor(options?: { smoothing?: number }) {
    this.state = {
      version: 1, smoothing: Math.max(1e-9, options?.smoothing ?? 1), totalDocs: 0,
      labels: [], labelDocCounts: [], labelTokenTotals: [], vocabulary: [], tokenCountsByLabel: [],
    };
  }
  static fromSerialized(payload: NaiveBayesSerialized): MultinomialNaiveBayesTextClassifier {
    const model = new MultinomialNaiveBayesTextClassifier({ smoothing: payload.smoothing });
    model.state = textNB({ action: "loadMultinomial", model: {
      ...payload, smoothing: model.state.smoothing, vocabulary: [...new Set(payload.vocabulary)],
    } });
    return model;
  }
  train(examples: NaiveBayesExample[]): this {
    this.state = textNB({ action: "trainMultinomial", model: this.state, examples });
    return this;
  }
  labels(): string[] { return [...this.state.labels]; }
  predict(text: string): NaiveBayesPrediction[] {
    return textNB({ action: "predictMultinomial", model: this.state, text });
  }
  classify(text: string): string {
    const result = this.predict(text);
    if (!result.length) throw new Error("classifier has no labels");
    return result[0]!.label;
  }
  evaluate(examples: NaiveBayesExample[]): { accuracy: number; total: number; correct: number } {
    const correct = examples.filter((row) => this.classify(row.text) === row.label).length;
    return { accuracy: examples.length ? correct / examples.length : 0, total: examples.length, correct };
  }
  toJSON(): NaiveBayesSerialized {
    const payload = structuredClone(this.state);
    payload.vocabulary = [...new Set(payload.vocabulary)].sort();
    payload.tokenCountsByLabel = payload.tokenCountsByLabel.map((row) => {
      const pairs: Array<[string, number]> = [];
      for (let i = 0; i < row.length; i += 2) pairs.push([String(row[i]), Number(row[i + 1])]);
      return pairs.sort((a, b) => a[0].localeCompare(b[0])).flatMap(([token, count]) => [token, count]);
    });
    return payload;
  }
}

export function trainMultinomialNaiveBayesTextClassifier(examples: NaiveBayesExample[], options?: { smoothing?: number }): MultinomialNaiveBayesTextClassifier {
  return new MultinomialNaiveBayesTextClassifier(options).train(examples);
}
export function loadMultinomialNaiveBayesTextClassifier(payload: NaiveBayesSerialized): MultinomialNaiveBayesTextClassifier {
  return MultinomialNaiveBayesTextClassifier.fromSerialized(payload);
}
