/** NLTK NaiveBayesClassifier's categorical feature-value model (Apache-2.0). */
import { descendingLabel, textCountFeatures } from "./classifier_features";
import type { NaiveBayesExample, NaiveBayesPrediction } from "./classify";
export type CategoricalNBSerialized = {
  version: 2;
  model: "categorical";
  smoothing: number;
  totalDocs: number;
  labels: string[];
  labelDocCounts: number[];
  features: Array<[string, Array<Array<[number, number]>>]>;
};
type FeatureCounts = { values: Set<number>; seen: number; byLabel: Map<string, Map<number, number>> };
export class CategoricalNaiveBayes {
  private docs = new Map<string, number>();
  private totalDocs = 0;
  private features = new Map<string, FeatureCounts>();
  constructor(private smoothing = 0.5) {
    if (!Number.isFinite(smoothing) || smoothing <= 0)
      throw new Error("smoothing must be positive and finite");
  }
  train(examples: NaiveBayesExample[]): this {
    for (const { label, text } of examples) {
      this.docs.set(label, (this.docs.get(label) ?? 0) + 1);
      this.totalDocs++;
      for (const [word, value] of textCountFeatures(text)) {
        let feature = this.features.get(word);
        if (!feature) {
          feature = { values: new Set(), seen: 0, byLabel: new Map() };
          this.features.set(word, feature);
        }
        feature.values.add(value);
        feature.seen++;
        let dist = feature.byLabel.get(label);
        if (!dist) {
          dist = new Map();
          feature.byLabel.set(label, dist);
        }
        dist.set(value, (dist.get(value) ?? 0) + 1);
      }
    }
    return this;
  }
  labels(): string[] {
    return [...this.docs.keys()];
  }
  predict(text: string): NaiveBayesPrediction[] {
    const labels = this.labels();
    if (!labels.length) return [];
    const features = textCountFeatures(text),
      gamma = this.smoothing;
    const scores = labels.map((label) => {
      const docs = this.docs.get(label)!;
      let logProb = Math.log2((docs + gamma) / (this.totalDocs + gamma * labels.length));
      for (const [word, value] of features) {
        const feature = this.features.get(word);
        if (!feature) continue;
        const bins = feature.values.size + (feature.seen < this.totalDocs ? 1 : 0);
        const count = feature.byLabel.get(label)?.get(value) ?? 0;
        logProb += Math.log2((count + gamma) / (docs + gamma * bins));
      }
      return { label, logProb };
    });
    const max = Math.max(...scores.map((row) => row.logProb));
    const normalizer = max + Math.log2(scores.reduce((sum, row) => sum + 2 ** (row.logProb - max), 0));
    return scores
      .map((row) => ({ label: row.label, logProb: row.logProb - normalizer }))
      .sort((a, b) => b.logProb - a.logProb || descendingLabel(a.label, b.label));
  }
  classify(text: string): string {
    const result = this.predict(text);
    if (!result.length) throw new Error("classifier has no labels");
    return result[0]!.label;
  }
  toJSON(): CategoricalNBSerialized {
    const labels = this.labels();
    return {
      version: 2,
      model: "categorical",
      smoothing: this.smoothing,
      totalDocs: this.totalDocs,
      labels,
      labelDocCounts: labels.map((label) => this.docs.get(label)!),
      features: [...this.features].map(([word, feature]) => [
        word,
        labels.map((label) => [...(feature.byLabel.get(label) ?? new Map())]),
      ]),
    };
  }
  static fromSerialized(data: CategoricalNBSerialized): CategoricalNaiveBayes {
    if (
      data.version !== 2 ||
      data.model !== "categorical" ||
      data.labels.length !== data.labelDocCounts.length
    )
      throw new Error("invalid categorical NaiveBayes payload");
    if (
      new Set(data.labels).size !== data.labels.length ||
      data.labelDocCounts.some((n) => !Number.isSafeInteger(n) || n < 0) ||
      data.labelDocCounts.reduce((a, b) => a + b, 0) !== data.totalDocs
    )
      throw new Error("invalid categorical NaiveBayes document counts");
    const model = new CategoricalNaiveBayes(data.smoothing);
    model.totalDocs = data.totalDocs;
    model.docs = new Map(data.labels.map((label, i) => [label, data.labelDocCounts[i]!]));
    for (const [word, rows] of data.features) {
      if (rows.length !== data.labels.length || model.features.has(word))
        throw new Error("invalid categorical feature rows");
      const feature: FeatureCounts = { values: new Set(), seen: 0, byLabel: new Map() };
      rows.forEach((row, i) => {
        if (
          row.some(
            ([value, count]) =>
              !Number.isSafeInteger(value) || value <= 0 || !Number.isSafeInteger(count) || count <= 0,
          ) ||
          new Set(row.map(([value]) => value)).size !== row.length ||
          row.reduce((sum, [, count]) => sum + count, 0) > data.labelDocCounts[i]!
        )
          throw new Error("invalid categorical feature counts");
        feature.byLabel.set(data.labels[i]!, new Map(row));
        for (const [value, count] of row) {
          feature.values.add(value);
          feature.seen += count;
        }
      });
      model.features.set(word, feature);
    }
    return model;
  }
}
