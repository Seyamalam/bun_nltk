import { textClassifier } from "./text_classifier_transport.ts";
import type { MaxEntExample, MaxEntPrediction } from "./maxent_sgd";
export type IisSerialized = {
  version: 2;
  algorithm: "iis";
  labels: string[];
  features: [string, number, string][];
  weights: number[];
  epochs: number;
};

/** Legacy text binary count encoding, base-2 IIS weights/logits, and OOV in Rust. */
export class IisMaxEnt {
  private model: IisSerialized;
  constructor(epochs = 25) {
    this.model = { version: 2, algorithm: "iis", labels: [], features: [], weights: [], epochs };
  }
  train(rows: MaxEntExample[]): this {
    this.model = textClassifier({ action: "trainIis", model: this.model, examples: rows });
    return this;
  }
  labelsList(): string[] { return [...this.model.labels]; }
  predict(text: string): MaxEntPrediction[] {
    if (!this.model.labels.length) return [];
    return textClassifier({ action: "predictIis", model: this.model, text });
  }
  classify(text: string): string {
    const top = this.predict(text)[0];
    if (!top) throw new Error("classifier has no labels");
    return top.label;
  }
  toJSON(): IisSerialized { return structuredClone(this.model); }
  static fromSerialized(payload: IisSerialized): IisMaxEnt {
    const model = new IisMaxEnt(payload.epochs);
    model.model = textClassifier({ action: "loadIis", model: payload });
    return model;
  }
}
