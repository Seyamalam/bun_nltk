import { IisMaxEnt, type IisSerialized } from "./maxent_iis";
import {
  SgdMaxEntTextClassifier,
  type MaxEntSerialized as SgdSerialized,
  type MaxEntOptions as SgdOptions,
} from "./maxent_sgd";
export type { MaxEntExample, MaxEntPrediction } from "./maxent_sgd";
import type { MaxEntExample, MaxEntPrediction } from "./maxent_sgd";
export type MaxEntSerialized = IisSerialized | SgdSerialized;
export type MaxEntOptions = SgdOptions & { algorithm?: "iis" | "sgd" };
export class MaxEntTextClassifier {
  private engine: IisMaxEnt | SgdMaxEntTextClassifier;
  constructor(options: MaxEntOptions = {}) {
    this.engine =
      options.algorithm === "sgd"
        ? new SgdMaxEntTextClassifier(options)
        : new IisMaxEnt(Math.max(1, Math.floor(options.epochs ?? 25)));
  }
  train(examples: MaxEntExample[]): this {
    this.engine.train(examples);
    return this;
  }
  labelsList(): string[] {
    return this.engine.labelsList();
  }
  predict(text: string): MaxEntPrediction[] {
    return this.engine.predict(text);
  }
  classify(text: string): string {
    return this.engine.classify(text);
  }
  evaluate(examples: MaxEntExample[]): { accuracy: number; total: number; correct: number } {
    const correct = examples.filter((row) => this.classify(row.text) === row.label).length;
    return { accuracy: examples.length ? correct / examples.length : 0, total: examples.length, correct };
  }
  toJSON(): MaxEntSerialized {
    return this.engine.toJSON();
  }
  static fromSerialized(payload: MaxEntSerialized): MaxEntTextClassifier {
    const model = new MaxEntTextClassifier();
    model.engine =
      "algorithm" in payload
        ? IisMaxEnt.fromSerialized(payload)
        : SgdMaxEntTextClassifier.fromSerialized(payload);
    return model;
  }
}
export function trainMaxEntTextClassifier(
  examples: MaxEntExample[],
  options?: MaxEntOptions,
): MaxEntTextClassifier {
  return new MaxEntTextClassifier(options).train(examples);
}
export function loadMaxEntTextClassifier(payload: MaxEntSerialized): MaxEntTextClassifier {
  return MaxEntTextClassifier.fromSerialized(payload);
}
