import { tokenizeAsciiNative } from "./native";

export type PositiveNaiveBayesSerialized = {
  version: number;
  positiveLabel: string;
  negativeLabel: string;
  positivePrior: number;
  vocabulary: string[];
  presentLogPos: number[];
  absentLogPos: number[];
  presentLogNeg: number[];
  absentLogNeg: number[];
  absentLogPosSum: number;
  absentLogNegSum: number;
  options: { maxFeatures: number };
};

type Prediction = { label: string; probability: number; logProb: number };

function sigmoid(x: number): number {
  if (x >= 0) {
    const z = Math.exp(-x);
    return 1 / (1 + z);
  }
  const z = Math.exp(x);
  return z / (1 + z);
}

function sanitizePrior(prior: number): number {
  if (!Number.isFinite(prior)) return 0.5;
  return Math.min(0.999, Math.max(0.001, prior));
}

function toTexts(rows: string[] | Array<{ text: string }>): string[] {
  if (rows.length === 0) return [];
  if (typeof rows[0] === "string") return rows as string[];
  return (rows as Array<{ text: string }>).map((row) => row.text);
}

function uniqueTokenIds(text: string, tokenToId: Map<string, number>): Uint32Array {
  const seen = new Set<number>();
  for (const token of tokenizeAsciiNative(text)) {
    const id = tokenToId.get(token);
    if (id !== undefined) seen.add(id);
  }
  return Uint32Array.from([...seen].sort((a, b) => a - b));
}

export class PositiveNaiveBayesTextClassifier {
  private readonly options: { maxFeatures: number };
  private positiveLabel: string;
  private negativeLabel: string;
  private positivePrior: number;
  private vocabulary: string[] = [];
  private tokenToId = new Map<string, number>();
  private presentLogPos = new Float64Array(0);
  private absentLogPos = new Float64Array(0);
  private presentLogNeg = new Float64Array(0);
  private absentLogNeg = new Float64Array(0);
  private absentLogPosSum = 0;
  private absentLogNegSum = 0;

  constructor(options: { maxFeatures?: number; positivePrior?: number; positiveLabel?: string; negativeLabel?: string } = {}) {
    this.options = {
      maxFeatures: Math.max(128, Math.floor(options.maxFeatures ?? 12000)),
    };
    this.positivePrior = sanitizePrior(options.positivePrior ?? 0.5);
    this.positiveLabel = options.positiveLabel ?? "pos";
    this.negativeLabel = options.negativeLabel ?? "neg";
  }

  static fromJSON(payload: PositiveNaiveBayesSerialized): PositiveNaiveBayesTextClassifier {
    if (payload.version !== 1) {
      throw new Error(`unsupported PositiveNaiveBayes version: ${payload.version}`);
    }
    const model = new PositiveNaiveBayesTextClassifier({
      maxFeatures: payload.options.maxFeatures,
      positivePrior: payload.positivePrior,
      positiveLabel: payload.positiveLabel,
      negativeLabel: payload.negativeLabel,
    });
    model.vocabulary = [...payload.vocabulary];
    model.tokenToId = new Map(model.vocabulary.map((token, idx) => [token, idx]));
    model.presentLogPos = Float64Array.from(payload.presentLogPos);
    model.absentLogPos = Float64Array.from(payload.absentLogPos);
    model.presentLogNeg = Float64Array.from(payload.presentLogNeg);
    model.absentLogNeg = Float64Array.from(payload.absentLogNeg);
    model.absentLogPosSum = payload.absentLogPosSum;
    model.absentLogNegSum = payload.absentLogNegSum;
    return model;
  }

  train(
    positiveRows: string[] | Array<{ text: string }>,
    unlabeledRows: string[] | Array<{ text: string }>,
    options: { positivePrior?: number } = {},
  ): this {
    const positiveTexts = toTexts(positiveRows);
    const unlabeledTexts = toTexts(unlabeledRows);
    if (positiveTexts.length === 0) throw new Error("PositiveNaiveBayes requires positive examples");
    if (unlabeledTexts.length === 0) throw new Error("PositiveNaiveBayes requires unlabeled examples");

    this.positivePrior = sanitizePrior(options.positivePrior ?? this.positivePrior);

    const tokenFreq = new Map<string, number>();
    const positiveTokenSets: string[][] = [];
    const unlabeledTokenSets: string[][] = [];

    for (const text of positiveTexts) {
      const uniq = [...new Set(tokenizeAsciiNative(text))];
      positiveTokenSets.push(uniq);
      for (const token of uniq) tokenFreq.set(token, (tokenFreq.get(token) ?? 0) + 1);
    }
    for (const text of unlabeledTexts) {
      const uniq = [...new Set(tokenizeAsciiNative(text))];
      unlabeledTokenSets.push(uniq);
      for (const token of uniq) tokenFreq.set(token, (tokenFreq.get(token) ?? 0) + 1);
    }

    this.vocabulary = [...tokenFreq.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, this.options.maxFeatures)
      .map(([token]) => token);
    this.tokenToId = new Map(this.vocabulary.map((token, idx) => [token, idx]));

    const featureCount = this.vocabulary.length;
    const posCounts = new Uint32Array(featureCount);
    const unlCounts = new Uint32Array(featureCount);
    for (const uniq of positiveTokenSets) {
      for (const token of uniq) {
        const id = this.tokenToId.get(token);
        if (id !== undefined) posCounts[id] += 1;
      }
    }
    for (const uniq of unlabeledTokenSets) {
      for (const token of uniq) {
        const id = this.tokenToId.get(token);
        if (id !== undefined) unlCounts[id] += 1;
      }
    }

    const posN = positiveTexts.length;
    const unlN = unlabeledTexts.length;
    const negPrior = 1 - this.positivePrior;
    this.presentLogPos = new Float64Array(featureCount);
    this.absentLogPos = new Float64Array(featureCount);
    this.presentLogNeg = new Float64Array(featureCount);
    this.absentLogNeg = new Float64Array(featureCount);
    this.absentLogPosSum = 0;
    this.absentLogNegSum = 0;

    for (let f = 0; f < featureCount; f += 1) {
      const pPos = (posCounts[f]! + 1) / (posN + 2);
      const pGlobal = (unlCounts[f]! + 1) / (unlN + 2);
      const rawNeg = (pGlobal - this.positivePrior * pPos) / Math.max(1e-9, negPrior);
      const pNeg = Math.min(1 - 1e-6, Math.max(1e-6, rawNeg));

      this.presentLogPos[f] = Math.log(Math.max(1e-12, pPos));
      this.absentLogPos[f] = Math.log(Math.max(1e-12, 1 - pPos));
      this.presentLogNeg[f] = Math.log(Math.max(1e-12, pNeg));
      this.absentLogNeg[f] = Math.log(Math.max(1e-12, 1 - pNeg));
      this.absentLogPosSum += this.absentLogPos[f]!;
      this.absentLogNegSum += this.absentLogNeg[f]!;
    }
    return this;
  }

  private score(text: string): { pos: number; neg: number } {
    if (this.presentLogPos.length === 0) {
      throw new Error("PositiveNaiveBayes classifier is not trained");
    }
    const presentIds = uniqueTokenIds(text, this.tokenToId);
    let pos = Math.log(this.positivePrior) + this.absentLogPosSum;
    let neg = Math.log(1 - this.positivePrior) + this.absentLogNegSum;
    for (const featureId of presentIds) {
      pos += this.presentLogPos[featureId]! - this.absentLogPos[featureId]!;
      neg += this.presentLogNeg[featureId]! - this.absentLogNeg[featureId]!;
    }
    return { pos, neg };
  }

  predict(text: string): Prediction[] {
    const scores = this.score(text);
    const probPos = sigmoid(scores.pos - scores.neg);
    return [
      { label: this.positiveLabel, probability: probPos, logProb: scores.pos },
      { label: this.negativeLabel, probability: 1 - probPos, logProb: scores.neg },
    ].sort((a, b) => b.probability - a.probability);
  }

  classify(text: string): string {
    return this.predict(text)[0]!.label;
  }

  evaluate(examples: Array<{ label: string; text: string }>): { accuracy: number; total: number; correct: number } {
    let correct = 0;
    for (const row of examples) if (this.classify(row.text) === row.label) correct += 1;
    return {
      accuracy: examples.length === 0 ? 0 : correct / examples.length,
      total: examples.length,
      correct,
    };
  }

  toJSON(): PositiveNaiveBayesSerialized {
    return {
      version: 1,
      positiveLabel: this.positiveLabel,
      negativeLabel: this.negativeLabel,
      positivePrior: this.positivePrior,
      vocabulary: [...this.vocabulary],
      presentLogPos: [...this.presentLogPos],
      absentLogPos: [...this.absentLogPos],
      presentLogNeg: [...this.presentLogNeg],
      absentLogNeg: [...this.absentLogNeg],
      absentLogPosSum: this.absentLogPosSum,
      absentLogNegSum: this.absentLogNegSum,
      options: { ...this.options },
    };
  }
}

export function trainPositiveNaiveBayesTextClassifier(
  positiveRows: string[] | Array<{ text: string }>,
  unlabeledRows: string[] | Array<{ text: string }>,
  options: { maxFeatures?: number; positivePrior?: number; positiveLabel?: string; negativeLabel?: string } = {},
): PositiveNaiveBayesTextClassifier {
  const model = new PositiveNaiveBayesTextClassifier(options);
  return model.train(positiveRows, unlabeledRows, { positivePrior: options.positivePrior });
}

export function loadPositiveNaiveBayesTextClassifier(payload: PositiveNaiveBayesSerialized): PositiveNaiveBayesTextClassifier {
  return PositiveNaiveBayesTextClassifier.fromJSON(payload);
}
