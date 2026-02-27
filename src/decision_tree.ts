import { TextFeatureVectorizer, type SparseVector, type VectorizerSerialized } from "./features";

export type DecisionTreeExample = { label: string; text: string };

export type DecisionTreeSerialized = {
  version: number;
  labels: string[];
  options: { maxDepth: number; minSamples: number; maxCandidateFeatures: number };
  vectorizer: VectorizerSerialized;
  tree: DecisionTreeNodeSerialized;
};

type DecisionTreeNode =
  | {
      kind: "leaf";
      label: string;
      counts: Record<string, number>;
    }
  | {
      kind: "split";
      featureId: number;
      feature: string;
      absent: DecisionTreeNode;
      present: DecisionTreeNode;
    };

type DecisionTreeNodeSerialized =
  | {
      kind: "leaf";
      label: string;
      counts: Record<string, number>;
    }
  | {
      kind: "split";
      featureId: number;
      feature: string;
      absent: DecisionTreeNodeSerialized;
      present: DecisionTreeNodeSerialized;
    };

function labelCounts(rows: Array<{ label: string }>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.label, (counts.get(row.label) ?? 0) + 1);
  return counts;
}

function entropyFromCounts(counts: Map<string, number>): number {
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  let h = 0;
  for (const value of counts.values()) {
    if (value <= 0) continue;
    const p = value / total;
    h -= p * Math.log2(p);
  }
  return h;
}

function majorityLabel(counts: Map<string, number>): string {
  let bestLabel = "";
  let bestCount = -1;
  for (const [label, count] of counts) {
    if (count > bestCount || (count === bestCount && label.localeCompare(bestLabel) < 0)) {
      bestCount = count;
      bestLabel = label;
    }
  }
  return bestLabel;
}

function containsFeature(vector: SparseVector, featureId: number): boolean {
  // vectors are sorted by feature id
  let lo = 0;
  let hi = vector.indices.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = vector.indices[mid]!;
    if (v === featureId) return true;
    if (v < featureId) lo = mid + 1;
    else hi = mid - 1;
  }
  return false;
}

export class DecisionTreeTextClassifier {
  private readonly options: { maxDepth: number; minSamples: number; maxCandidateFeatures: number };
  private readonly vectorizer: TextFeatureVectorizer;
  private labels: string[] = [];
  private tree: DecisionTreeNode | null = null;

  constructor(options: { maxDepth?: number; minSamples?: number; maxCandidateFeatures?: number; maxFeatures?: number } = {}) {
    this.options = {
      maxDepth: Math.max(1, Math.floor(options.maxDepth ?? 8)),
      minSamples: Math.max(1, Math.floor(options.minSamples ?? 2)),
      maxCandidateFeatures: Math.max(4, Math.floor(options.maxCandidateFeatures ?? 256)),
    };
    this.vectorizer = new TextFeatureVectorizer({
      ngramMin: 1,
      ngramMax: 2,
      binary: true,
      maxFeatures: Math.max(128, Math.floor(options.maxFeatures ?? 10000)),
    });
  }

  static fromJSON(payload: DecisionTreeSerialized): DecisionTreeTextClassifier {
    if (payload.version !== 1) throw new Error(`unsupported DecisionTree version: ${payload.version}`);
    const model = new DecisionTreeTextClassifier(payload.options);
    model.labels = [...payload.labels];
    (model as { vectorizer: TextFeatureVectorizer }).vectorizer = TextFeatureVectorizer.fromJSON(payload.vectorizer);
    model.tree = payload.tree as DecisionTreeNode;
    return model;
  }

  private buildNode(rows: Array<{ label: string; features: SparseVector }>, depth: number): DecisionTreeNode {
    const counts = labelCounts(rows);
    const majority = majorityLabel(counts);
    if (counts.size <= 1 || depth >= this.options.maxDepth || rows.length < this.options.minSamples) {
      return {
        kind: "leaf",
        label: majority,
        counts: Object.fromEntries(counts.entries()),
      };
    }

    const featureFreq = new Map<number, number>();
    for (const row of rows) {
      for (const id of row.features.indices) {
        featureFreq.set(id, (featureFreq.get(id) ?? 0) + 1);
      }
    }

    const candidates = [...featureFreq.entries()]
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, this.options.maxCandidateFeatures)
      .map(([id]) => id);

    const baseEntropy = entropyFromCounts(counts);
    let bestFeature = -1;
    let bestGain = -Infinity;
    let bestAbsent: Array<{ label: string; features: SparseVector }> = [];
    let bestPresent: Array<{ label: string; features: SparseVector }> = [];

    for (const featureId of candidates) {
      const absent: Array<{ label: string; features: SparseVector }> = [];
      const present: Array<{ label: string; features: SparseVector }> = [];

      for (const row of rows) {
        if (containsFeature(row.features, featureId)) present.push(row);
        else absent.push(row);
      }
      if (absent.length === 0 || present.length === 0) continue;

      const absentEntropy = entropyFromCounts(labelCounts(absent));
      const presentEntropy = entropyFromCounts(labelCounts(present));
      const weighted = (absent.length / rows.length) * absentEntropy + (present.length / rows.length) * presentEntropy;
      const gain = baseEntropy - weighted;
      if (gain > bestGain) {
        bestGain = gain;
        bestFeature = featureId;
        bestAbsent = absent;
        bestPresent = present;
      }
    }

    if (bestFeature < 0 || !Number.isFinite(bestGain) || bestGain <= 1e-9) {
      return {
        kind: "leaf",
        label: majority,
        counts: Object.fromEntries(counts.entries()),
      };
    }

    const feature = this.vectorizer.vocabulary()[bestFeature] ?? `f${bestFeature}`;
    return {
      kind: "split",
      featureId: bestFeature,
      feature,
      absent: this.buildNode(bestAbsent, depth + 1),
      present: this.buildNode(bestPresent, depth + 1),
    };
  }

  train(examples: DecisionTreeExample[]): this {
    if (examples.length === 0) throw new Error("DecisionTree training requires examples");
    this.labels = [...new Set(examples.map((x) => x.label))].sort((a, b) => a.localeCompare(b));
    this.vectorizer.fit(examples.map((x) => x.text));
    const rows = examples.map((x) => ({ label: x.label, features: this.vectorizer.transform(x.text) }));
    this.tree = this.buildNode(rows, 0);
    return this;
  }

  private ensureTree(): DecisionTreeNode {
    if (!this.tree) throw new Error("DecisionTree classifier is not trained");
    return this.tree;
  }

  classify(text: string): string {
    let node = this.ensureTree();
    const vec = this.vectorizer.transform(text);
    while (node.kind === "split") {
      node = containsFeature(vec, node.featureId) ? node.present : node.absent;
    }
    return node.label;
  }

  predict(text: string): Array<{ label: string; score: number }> {
    const label = this.classify(text);
    return this.labels.map((item) => ({ label: item, score: item === label ? 1 : 0 }));
  }

  evaluate(examples: DecisionTreeExample[]): { accuracy: number; total: number; correct: number } {
    let correct = 0;
    for (const row of examples) if (this.classify(row.text) === row.label) correct += 1;
    return {
      accuracy: examples.length === 0 ? 0 : correct / examples.length,
      total: examples.length,
      correct,
    };
  }

  toJSON(): DecisionTreeSerialized {
    const tree = this.ensureTree();
    return {
      version: 1,
      labels: [...this.labels],
      options: { ...this.options },
      vectorizer: this.vectorizer.toJSON(),
      tree: tree as DecisionTreeNodeSerialized,
    };
  }
}

export function trainDecisionTreeTextClassifier(
  examples: DecisionTreeExample[],
  options: { maxDepth?: number; minSamples?: number; maxCandidateFeatures?: number; maxFeatures?: number } = {},
): DecisionTreeTextClassifier {
  return new DecisionTreeTextClassifier(options).train(examples);
}

export function loadDecisionTreeTextClassifier(payload: DecisionTreeSerialized): DecisionTreeTextClassifier {
  return DecisionTreeTextClassifier.fromJSON(payload);
}
