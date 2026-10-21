import { TextFeatureVectorizer, type VectorizerSerialized } from "./features";
import { textClassifier } from "./text_classifier_transport.ts";

export type DecisionTreeExample = { label: string; text: string };
export type DecisionTreeSerialized = {
  version: number;
  labels: string[];
  options: { maxDepth: number; minSamples: number; maxCandidateFeatures: number };
  vectorizer: VectorizerSerialized;
  tree: DecisionTreeNodeSerialized;
};
type DecisionTreeNodeSerialized =
  | { kind: "leaf"; label: string; counts: Record<string, number> }
  | { kind: "split"; featureId: number; feature: string; absent: DecisionTreeNodeSerialized; present: DecisionTreeNodeSerialized };
type DecisionTreeOptions = { maxDepth?: number; minSamples?: number; maxCandidateFeatures?: number; maxFeatures?: number };

/** Rust owns legacy text stump/refinement training and tree traversal. */
export class DecisionTreeTextClassifier {
  private readonly options: DecisionTreeSerialized["options"];
  private vectorizer: TextFeatureVectorizer;
  private model: DecisionTreeSerialized | null = null;

  constructor(options: DecisionTreeOptions = {}) {
    this.options = {
      maxDepth: Math.max(1, Math.floor(options.maxDepth ?? 100)),
      minSamples: Math.max(1, Math.floor(options.minSamples ?? 10)),
      maxCandidateFeatures: Math.max(4, Math.floor(options.maxCandidateFeatures ?? Number.MAX_SAFE_INTEGER)),
    };
    this.vectorizer = new TextFeatureVectorizer({
      ngramMin: 1, ngramMax: 1, binary: true,
      maxFeatures: Math.max(128, Math.floor(options.maxFeatures ?? Number.MAX_SAFE_INTEGER)),
    });
  }

  static fromJSON(payload: DecisionTreeSerialized): DecisionTreeTextClassifier {
    if (payload.version !== 1) throw new Error(`unsupported DecisionTree version: ${payload.version}`);
    const model = new DecisionTreeTextClassifier(payload.options);
    model.vectorizer = TextFeatureVectorizer.fromJSON(payload.vectorizer);
    model.model = textClassifier({ action: "loadTree", model: { ...payload, options: model.options, vectorizer: model.vectorizer.toJSON() } });
    return model;
  }

  train(examples: DecisionTreeExample[]): this {
    if (!examples.length) throw new Error("DecisionTree training requires examples");
    // localeCompare is JS runtime/ICU-dependent. Keep only this ordering policy
    // in glue; feature selection, counting, splitting and refinement are Rust.
    const labels = [...new Set(examples.map((x) => x.label))].sort((a, b) => a.localeCompare(b));
    this.model = textClassifier({ action: "trainTree", labels, options: this.options, vectorizer: this.vectorizer.toJSON(), examples });
    this.vectorizer = TextFeatureVectorizer.fromJSON(this.model.vectorizer);
    return this;
  }

  private ensureModel(): DecisionTreeSerialized {
    if (!this.model) throw new Error("DecisionTree classifier is not trained");
    return this.model;
  }

  classify(text: string): string {
    return textClassifier({ action: "predictTree", model: this.ensureModel(), text });
  }

  predict(text: string): Array<{ label: string; score: number }> {
    const label = this.classify(text);
    return this.ensureModel().labels.map((item) => ({ label: item, score: item === label ? 1 : 0 }));
  }

  evaluate(examples: DecisionTreeExample[]): { accuracy: number; total: number; correct: number } {
    const correct = examples.filter((row) => this.classify(row.text) === row.label).length;
    return { accuracy: examples.length === 0 ? 0 : correct / examples.length, total: examples.length, correct };
  }

  toJSON(): DecisionTreeSerialized {
    return structuredClone(this.ensureModel());
  }
}

export function trainDecisionTreeTextClassifier(examples: DecisionTreeExample[], options: DecisionTreeOptions = {}): DecisionTreeTextClassifier {
  return new DecisionTreeTextClassifier(options).train(examples);
}
export function loadDecisionTreeTextClassifier(payload: DecisionTreeSerialized): DecisionTreeTextClassifier {
  return DecisionTreeTextClassifier.fromJSON(payload);
}
