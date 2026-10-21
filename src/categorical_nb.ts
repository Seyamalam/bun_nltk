import { textNB } from "./text_nb_transport.ts";
import type { NaiveBayesExample, NaiveBayesPrediction } from "./classify.ts";
export type CategoricalNBSerialized = {
  version: 2;
  model: "categorical";
  smoothing: number;
  totalDocs: number;
  labels: string[];
  labelDocCounts: number[];
  features: Array<[string, Array<Array<[number, number]>>]>;
};

/** NLTK categorical count-value text contract, trained and scored by Rust/WASM. */
export class CategoricalNaiveBayes {
  private state: CategoricalNBSerialized;
  constructor(smoothing = 0.5) {
    if (!Number.isFinite(smoothing) || smoothing <= 0) throw new Error("smoothing must be positive and finite");
    this.state = { version: 2, model: "categorical", smoothing, totalDocs: 0, labels: [], labelDocCounts: [], features: [] };
  }
  train(examples: NaiveBayesExample[]): this {
    this.state = textNB({ action: "trainCategorical", model: this.state, examples });
    return this;
  }
  labels(): string[] { return [...this.state.labels]; }
  predict(text: string): NaiveBayesPrediction[] {
    return textNB({ action: "predictCategorical", model: this.state, text });
  }
  classify(text: string): string {
    const result = this.predict(text);
    if (!result.length) throw new Error("classifier has no labels");
    return result[0]!.label;
  }
  toJSON(): CategoricalNBSerialized { return structuredClone(this.state); }
  static fromSerialized(data: CategoricalNBSerialized): CategoricalNaiveBayes {
    const model = new CategoricalNaiveBayes(data.smoothing);
    model.state = textNB({ action: "loadCategorical", model: data });
    return model;
  }
}
