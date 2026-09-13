import { textCountFeatures, descendingLabel } from "./classifier_features";
import type { MaxEntExample, MaxEntPrediction } from "./maxent_sgd";
export type IisSerialized = {
  version: 2;
  algorithm: "iis";
  labels: string[];
  features: [string, number, string][];
  weights: number[];
  epochs: number;
};
/** NLTK BinaryMaxentFeatureEncoding and improved iterative scaling (base-2 weights). */
export class IisMaxEnt {
  private labels: string[] = [];
  private features: [string, number, string][] = [];
  private mapping = new Map<string, number>();
  private weights: number[] = [];
  constructor(private epochs = 25) {}
  private key(word: string, count: number, label: string): string {
    return JSON.stringify([word, count, label]);
  }
  private encode(features: Map<string, number>, label: string): number[] {
    const ids: number[] = [];
    for (const [word, count] of features) {
      const id = this.mapping.get(this.key(word, count, label));
      if (id !== undefined) ids.push(id);
    }
    return ids;
  }
  private probabilities(encoded: number[][]): { logits: number[]; probs: number[] } {
    const logits = encoded.map((ids) => ids.reduce((sum, id) => sum + this.weights[id]!, 0));
    const max = Math.max(...logits);
    const probs = logits.map((value) => 2 ** (value - max));
    const sum = probs.reduce((a, b) => a + b, 0);
    return { logits, probs: probs.map((value) => value / sum) };
  }
  train(rows: MaxEntExample[]): this {
    if (!rows.length) throw new Error("MaxEnt training requires at least one example");
    this.labels = [...new Set(rows.map((row) => row.label))].sort();
    this.mapping.clear();
    this.features = [];
    const data = rows.map((row) => ({ features: textCountFeatures(row.text), label: row.label }));
    const empirical: number[] = [];
    for (const row of data)
      for (const [word, count] of row.features) {
        const key = this.key(word, count, row.label);
        let id = this.mapping.get(key);
        if (id === undefined) {
          id = this.features.length;
          this.mapping.set(key, id);
          this.features.push([word, count, row.label]);
          empirical.push(0);
        }
        empirical[id]!++;
      }
    for (let i = 0; i < empirical.length; i++) empirical[i]! /= rows.length;
    this.weights = empirical.map(() => 0);
    const encoded = data.map((row) => this.labels.map((label) => this.encode(row.features, label)));
    for (let iteration = 0; iteration < Math.max(1, this.epochs - 1); iteration++) {
      const a = empirical.map(() => new Map<number, number>());
      for (const doc of encoded) {
        const { probs } = this.probabilities(doc);
        for (let l = 0; l < doc.length; l++)
          for (const id of doc[l]!) {
            const nf = doc[l]!.length;
            const bucket = a[id]!;
            bucket.set(nf, (bucket.get(nf) ?? 0) + probs[l]!);
          }
      }
      const terms = a.map((bucket) =>
        [...bucket].sort((a, b) => a[0] - b[0]).map(([nf, p]) => [nf, p / rows.length] as const),
      );
      // Preserve NLTK's starting point for ordinary documents. For long ones,
      // start with nf * delta <= 1 so the first exponential cannot overflow.
      const deltas = terms.map((featureTerms) => {
        const maxFeatures = featureTerms.at(-1)?.[0] ?? 1;
        return maxFeatures > 900 ? 1 / maxFeatures : 1;
      });
      for (let step = 0; step < 300; step++) {
        let error = 0,
          magnitude = 0;
        for (let id = 0; id < deltas.length; id++) {
          let sum1 = 0,
            sum2 = 0;
          for (const [nf, p] of terms[id]!) {
            const exp = 2 ** (nf * deltas[id]!);
            sum1 += exp * p;
            sum2 += nf * exp * p;
          }
          const delta = deltas[id]! + (empirical[id]! - sum1) / sum2;
          if (!Number.isFinite(delta))
            throw new Error("IIS training failed to produce a finite feature update");
          deltas[id] = delta;
          error += Math.abs(empirical[id]! - sum1);
          magnitude += Math.abs(deltas[id]!);
        }
        if (error / magnitude < 1e-12) break;
      }
      for (let id = 0; id < this.weights.length; id++) {
        const weight = this.weights[id]! + deltas[id]!;
        if (!Number.isFinite(weight)) throw new Error("IIS training produced a nonfinite weight");
        this.weights[id] = weight;
      }
    }
    return this;
  }
  labelsList(): string[] {
    return [...this.labels];
  }
  predict(text: string): MaxEntPrediction[] {
    if (!this.labels.length) return [];
    const features = textCountFeatures(text);
    const { logits, probs } = this.probabilities(this.labels.map((label) => this.encode(features, label)));
    return this.labels
      .map((label, i) => ({ label, probability: probs[i]!, logit: logits[i]! }))
      .sort((a, b) => b.probability - a.probability || descendingLabel(a.label, b.label));
  }
  classify(text: string): string {
    const top = this.predict(text)[0];
    if (!top) throw new Error("classifier has no labels");
    return top.label;
  }
  toJSON(): IisSerialized {
    return {
      version: 2,
      algorithm: "iis",
      labels: [...this.labels],
      features: this.features.map((row) => [...row]),
      weights: [...this.weights],
      epochs: this.epochs,
    };
  }
  static fromSerialized(payload: IisSerialized): IisMaxEnt {
    if (
      payload.version !== 2 ||
      payload.features.length !== payload.weights.length ||
      !payload.labels.length ||
      payload.weights.some((x) => !Number.isFinite(x))
    )
      throw new Error("invalid IIS serialized payload");
    const model = new IisMaxEnt(payload.epochs);
    model.labels = [...payload.labels];
    model.weights = [...payload.weights];
    model.features = payload.features.map((row) => [...row]);
    model.features.forEach(([word, count, label], id) => {
      if (!model.labels.includes(label) || count < 1) throw new Error("invalid IIS feature");
      model.mapping.set(model.key(word, count, label), id);
    });
    return model;
  }
}
