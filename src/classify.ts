import { tokenizeAsciiNative } from "./native";

export type NaiveBayesExample = {
  label: string;
  text: string;
};

export type NaiveBayesPrediction = {
  label: string;
  logProb: number;
};

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

type InternalState = {
  smoothing: number;
  totalDocs: number;
  labelDocCounts: Map<string, number>;
  labelTokenTotals: Map<string, number>;
  tokenCountsByLabel: Map<string, Map<string, number>>;
  vocabulary: Set<string>;
};

function ensureLabel(state: InternalState, label: string): void {
  if (!state.labelDocCounts.has(label)) {
    state.labelDocCounts.set(label, 0);
    state.labelTokenTotals.set(label, 0);
    state.tokenCountsByLabel.set(label, new Map<string, number>());
  }
}

function tokenize(text: string): string[] {
  return tokenizeAsciiNative(text);
}

export class NaiveBayesTextClassifier {
  private state: InternalState;

  constructor(options?: { smoothing?: number }) {
    this.state = {
      smoothing: Math.max(1e-9, options?.smoothing ?? 1.0),
      totalDocs: 0,
      labelDocCounts: new Map<string, number>(),
      labelTokenTotals: new Map<string, number>(),
      tokenCountsByLabel: new Map<string, Map<string, number>>(),
      vocabulary: new Set<string>(),
    };
  }

  static fromSerialized(payload: NaiveBayesSerialized): NaiveBayesTextClassifier {
    if (payload.version !== 1) {
      throw new Error(`unsupported NaiveBayes serialized version: ${payload.version}`);
    }
    if (
      payload.labels.length !== payload.labelDocCounts.length ||
      payload.labels.length !== payload.labelTokenTotals.length ||
      payload.labels.length !== payload.tokenCountsByLabel.length
    ) {
      throw new Error("invalid NaiveBayes serialized payload lengths");
    }

    const classifier = new NaiveBayesTextClassifier({ smoothing: payload.smoothing });
    classifier.state.totalDocs = payload.totalDocs;
    classifier.state.vocabulary = new Set(payload.vocabulary);

    for (let i = 0; i < payload.labels.length; i += 1) {
      const label = payload.labels[i]!;
      const tokenCounts = payload.tokenCountsByLabel[i]!;
      ensureLabel(classifier.state, label);
      classifier.state.labelDocCounts.set(label, payload.labelDocCounts[i]!);
      classifier.state.labelTokenTotals.set(label, payload.labelTokenTotals[i]!);
      const local = classifier.state.tokenCountsByLabel.get(label)!;
      for (let j = 0; j + 1 < tokenCounts.length; j += 2) {
        local.set(String(tokenCounts[j]), Number(tokenCounts[j + 1]));
      }
    }
    return classifier;
  }

  train(examples: NaiveBayesExample[]): this {
    for (const row of examples) {
      const label = row.label;
      ensureLabel(this.state, label);
      this.state.totalDocs += 1;
      this.state.labelDocCounts.set(label, (this.state.labelDocCounts.get(label) ?? 0) + 1);

      const labelCounts = this.state.tokenCountsByLabel.get(label)!;
      const tokens = tokenize(row.text);
      for (const token of tokens) {
        this.state.vocabulary.add(token);
        labelCounts.set(token, (labelCounts.get(token) ?? 0) + 1);
        this.state.labelTokenTotals.set(label, (this.state.labelTokenTotals.get(label) ?? 0) + 1);
      }
    }
    return this;
  }

  labels(): string[] {
    return [...this.state.labelDocCounts.keys()];
  }

  classify(text: string): string {
    const ranked = this.predict(text);
    if (ranked.length === 0) throw new Error("classifier has no labels");
    return ranked[0]!.label;
  }

  predict(text: string): NaiveBayesPrediction[] {
    const labels = this.labels();
    if (labels.length === 0) return [];

    const smoothing = this.state.smoothing;
    const vocabSize = Math.max(1, this.state.vocabulary.size);
    const totalDocs = Math.max(1, this.state.totalDocs);
    const tokens = tokenize(text);

    const scores: NaiveBayesPrediction[] = [];
    for (const label of labels) {
      const docCount = this.state.labelDocCounts.get(label) ?? 0;
      const labelPrior = Math.log((docCount + smoothing) / (totalDocs + smoothing * labels.length));
      const tokenCounts = this.state.tokenCountsByLabel.get(label)!;
      const tokenTotal = this.state.labelTokenTotals.get(label) ?? 0;
      const denom = tokenTotal + smoothing * vocabSize;

      let logProb = labelPrior;
      for (const token of tokens) {
        const count = tokenCounts.get(token) ?? 0;
        logProb += Math.log((count + smoothing) / denom);
      }
      scores.push({ label, logProb });
    }

    return scores.sort((a, b) => b.logProb - a.logProb);
  }

  evaluate(examples: NaiveBayesExample[]): { accuracy: number; total: number; correct: number } {
    let correct = 0;
    for (const row of examples) {
      if (this.classify(row.text) === row.label) correct += 1;
    }
    const total = examples.length;
    return {
      accuracy: total === 0 ? 0 : correct / total,
      total,
      correct,
    };
  }

  toJSON(): NaiveBayesSerialized {
    const labels = this.labels();
    const vocabulary = [...this.state.vocabulary].sort();
    const labelDocCounts = labels.map((label) => this.state.labelDocCounts.get(label) ?? 0);
    const labelTokenTotals = labels.map((label) => this.state.labelTokenTotals.get(label) ?? 0);
    const tokenCountsByLabel = labels.map((label) => {
      const row = this.state.tokenCountsByLabel.get(label)!;
      return [...row.entries()].sort((a, b) => a[0].localeCompare(b[0])).flatMap(([tok, count]) => [tok, count]);
    });

    return {
      version: 1,
      smoothing: this.state.smoothing,
      totalDocs: this.state.totalDocs,
      labels,
      labelDocCounts,
      labelTokenTotals,
      vocabulary,
      tokenCountsByLabel,
    };
  }
}

export function trainNaiveBayesTextClassifier(
  examples: NaiveBayesExample[],
  options?: { smoothing?: number },
): NaiveBayesTextClassifier {
  return new NaiveBayesTextClassifier(options).train(examples);
}

export function loadNaiveBayesTextClassifier(payload: NaiveBayesSerialized): NaiveBayesTextClassifier {
  return NaiveBayesTextClassifier.fromSerialized(payload);
}
