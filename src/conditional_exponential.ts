import { MaxEntTextClassifier, type MaxEntExample, type MaxEntPrediction, type MaxEntSerialized } from "./maxent";

export type ConditionalExponentialExample = MaxEntExample;

export type ConditionalExponentialSerialized = {
  version: number;
  kind: "conditional_exponential";
  maxent: MaxEntSerialized;
};

export class ConditionalExponentialTextClassifier {
  private model: MaxEntTextClassifier;

  constructor(options?: { epochs?: number; learningRate?: number; l2?: number; maxFeatures?: number }) {
    this.model = new MaxEntTextClassifier(options);
  }

  static fromJSON(payload: ConditionalExponentialSerialized): ConditionalExponentialTextClassifier {
    if (payload.version !== 1 || payload.kind !== "conditional_exponential") {
      throw new Error("invalid ConditionalExponential serialized payload");
    }
    const out = new ConditionalExponentialTextClassifier(payload.maxent.options);
    (out as { model: MaxEntTextClassifier }).model = MaxEntTextClassifier.fromSerialized(payload.maxent);
    return out;
  }

  train(examples: ConditionalExponentialExample[]): this {
    this.model.train(examples);
    return this;
  }

  labelsList(): string[] {
    return this.model.labelsList();
  }

  predict(text: string): MaxEntPrediction[] {
    return this.model.predict(text);
  }

  classify(text: string): string {
    return this.model.classify(text);
  }

  evaluate(examples: ConditionalExponentialExample[]): { accuracy: number; total: number; correct: number } {
    return this.model.evaluate(examples);
  }

  toJSON(): ConditionalExponentialSerialized {
    return {
      version: 1,
      kind: "conditional_exponential",
      maxent: this.model.toJSON(),
    };
  }
}

export function trainConditionalExponentialTextClassifier(
  examples: ConditionalExponentialExample[],
  options?: { epochs?: number; learningRate?: number; l2?: number; maxFeatures?: number },
): ConditionalExponentialTextClassifier {
  return new ConditionalExponentialTextClassifier(options).train(examples);
}

export function loadConditionalExponentialTextClassifier(
  payload: ConditionalExponentialSerialized,
): ConditionalExponentialTextClassifier {
  return ConditionalExponentialTextClassifier.fromJSON(payload);
}
