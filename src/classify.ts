import { CategoricalNaiveBayes, type CategoricalNBSerialized } from "./categorical_nb";
import {
  MultinomialNaiveBayesTextClassifier,
  type NaiveBayesSerialized as MultinomialSerialized,
} from "./multinomial_nb";
export type NaiveBayesExample = { label: string; text: string };
/** Categorical models return normalized base-2 log probabilities; v1 retains legacy scores. */
export type NaiveBayesPrediction = { label: string; logProb: number };
export type NaiveBayesSerialized = CategoricalNBSerialized | MultinomialSerialized;
export type NaiveBayesOptions = { smoothing?: number; model?: "categorical" | "multinomial" };
export class NaiveBayesTextClassifier {
  private engine: CategoricalNaiveBayes | MultinomialNaiveBayesTextClassifier;
  constructor(options: NaiveBayesOptions = {}) {
    this.engine =
      options.model === "multinomial"
        ? new MultinomialNaiveBayesTextClassifier(options)
        : new CategoricalNaiveBayes(options.smoothing ?? 0.5);
  }
  get logBase(): number {
    return this.engine instanceof CategoricalNaiveBayes ? 2 : Math.E;
  }
  train(examples: NaiveBayesExample[]): this {
    this.engine.train(examples);
    return this;
  }
  labels(): string[] {
    return this.engine.labels();
  }
  predict(text: string): NaiveBayesPrediction[] {
    return this.engine.predict(text);
  }
  classify(text: string): string {
    return this.engine.classify(text);
  }
  evaluate(examples: NaiveBayesExample[]): { accuracy: number; total: number; correct: number } {
    const correct = examples.filter((row) => this.classify(row.text) === row.label).length;
    return { accuracy: examples.length ? correct / examples.length : 0, total: examples.length, correct };
  }
  toJSON(): NaiveBayesSerialized {
    return this.engine.toJSON();
  }
  static fromSerialized(payload: NaiveBayesSerialized): NaiveBayesTextClassifier {
    const model = new NaiveBayesTextClassifier();
    model.engine =
      "features" in payload
        ? CategoricalNaiveBayes.fromSerialized(payload)
        : MultinomialNaiveBayesTextClassifier.fromSerialized(payload);
    return model;
  }
}
export function trainNaiveBayesTextClassifier(
  examples: NaiveBayesExample[],
  options?: NaiveBayesOptions,
): NaiveBayesTextClassifier {
  return new NaiveBayesTextClassifier(options).train(examples);
}
export function loadNaiveBayesTextClassifier(payload: NaiveBayesSerialized): NaiveBayesTextClassifier {
  return NaiveBayesTextClassifier.fromSerialized(payload);
}
