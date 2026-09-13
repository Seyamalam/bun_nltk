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
    if (count > bestCount) {
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

  constructor(
    options: {
      maxDepth?: number;
      minSamples?: number;
      maxCandidateFeatures?: number;
      maxFeatures?: number;
    } = {},
  ) {
    this.options = {
      maxDepth: Math.max(1, Math.floor(options.maxDepth ?? 100)),
      minSamples: Math.max(1, Math.floor(options.minSamples ?? 10)),
      maxCandidateFeatures: Math.max(4, Math.floor(options.maxCandidateFeatures ?? Number.MAX_SAFE_INTEGER)),
    };
    this.vectorizer = new TextFeatureVectorizer({
      ngramMin: 1,
      ngramMax: 1,
      binary: true,
      maxFeatures: Math.max(128, Math.floor(options.maxFeatures ?? Number.MAX_SAFE_INTEGER)),
    });
  }

  static fromJSON(payload: DecisionTreeSerialized): DecisionTreeTextClassifier {
    if (payload.version !== 1) throw new Error(`unsupported DecisionTree version: ${payload.version}`);
    const model = new DecisionTreeTextClassifier(payload.options);
    model.labels = [...payload.labels];
    (model as unknown as { vectorizer: TextFeatureVectorizer }).vectorizer = TextFeatureVectorizer.fromJSON(
      payload.vectorizer,
    );
    model.tree = payload.tree as DecisionTreeNode;
    return model;
  }

  private buildNode(rows: Array<{ label: string; features: SparseVector }>, depth: number): DecisionTreeNode {
    const counts = labelCounts(rows);
    const majority = majorityLabel(counts);
    const leaf = (subset: Array<{ label: string; features: SparseVector }>): DecisionTreeNode => {
      const counts = labelCounts(subset);
      return { kind: "leaf", label: majorityLabel(counts), counts: Object.fromEntries(counts) };
    };
    let best: DecisionTreeNode = leaf(rows);
    let bestError = rows.filter((row) => row.label !== majority).length;
    const vocabulary = this.vectorizer.vocabulary();
    const candidates = [...new Set(rows.flatMap((row) => [...row.features.indices]))]
      .sort((a, b) => (vocabulary[a]! < vocabulary[b]! ? -1 : vocabulary[a]! > vocabulary[b]! ? 1 : 0))
      .slice(0, this.options.maxCandidateFeatures);
    let bestAbsent: typeof rows = [],
      bestPresent: typeof rows = [];
    for (const featureId of candidates) {
      const absent = rows.filter((row) => !containsFeature(row.features, featureId));
      const present = rows.filter((row) => containsFeature(row.features, featureId));
      if (!absent.length || !present.length) continue;
      const absentLabel = majorityLabel(labelCounts(absent)),
        presentLabel = majorityLabel(labelCounts(present));
      const error =
        absent.filter((row) => row.label !== absentLabel).length +
        present.filter((row) => row.label !== presentLabel).length;
      if (error < bestError) {
        bestError = error;
        bestAbsent = absent;
        bestPresent = present;
        best = {
          kind: "split",
          featureId,
          feature: vocabulary[featureId]!,
          absent: leaf(absent),
          present: leaf(present),
        };
      }
    }
    // NLTK always chooses a stump before applying support/depth cutoffs to refinement.
    if (best.kind === "split" && rows.length > this.options.minSamples && depth + 1 < this.options.maxDepth) {
      if (entropyFromCounts(labelCounts(bestAbsent)) > 0.05)
        best.absent = this.buildNode(bestAbsent, depth + 1);
      if (entropyFromCounts(labelCounts(bestPresent)) > 0.05)
        best.present = this.buildNode(bestPresent, depth + 1);
    }
    return best;
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
  options: {
    maxDepth?: number;
    minSamples?: number;
    maxCandidateFeatures?: number;
    maxFeatures?: number;
  } = {},
): DecisionTreeTextClassifier {
  return new DecisionTreeTextClassifier(options).train(examples);
}

export function loadDecisionTreeTextClassifier(payload: DecisionTreeSerialized): DecisionTreeTextClassifier {
  return DecisionTreeTextClassifier.fromJSON(payload);
}
