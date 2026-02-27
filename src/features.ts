export type SparseVector = {
  indices: Uint32Array;
  values: Float64Array;
};

export type VectorizerSerialized = {
  version: number;
  ngramMin: number;
  ngramMax: number;
  binary: boolean;
  maxFeatures: number;
  vocabulary: string[];
};

export type VectorizerOptions = {
  ngramMin?: number;
  ngramMax?: number;
  binary?: boolean;
  maxFeatures?: number;
};

const TOKEN_RE = /[A-Za-z0-9']+/g;

function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(TOKEN_RE)) out.push((m[0] ?? "").toLowerCase());
  return out;
}

function pushNgrams(tokens: string[], minN: number, maxN: number, out: string[]): void {
  if (tokens.length === 0) return;
  const hi = Math.max(minN, maxN);
  for (let n = minN; n <= hi; n += 1) {
    if (n <= 0 || tokens.length < n) continue;
    for (let i = 0; i <= tokens.length - n; i += 1) {
      out.push(tokens.slice(i, i + n).join("\u0001"));
    }
  }
}

export class TextFeatureVectorizer {
  readonly ngramMin: number;
  readonly ngramMax: number;
  readonly binary: boolean;
  readonly maxFeatures: number;
  private readonly featureToId = new Map<string, number>();

  constructor(options: VectorizerOptions = {}) {
    this.ngramMin = Math.max(1, Math.floor(options.ngramMin ?? 1));
    this.ngramMax = Math.max(this.ngramMin, Math.floor(options.ngramMax ?? 1));
    this.binary = options.binary ?? false;
    this.maxFeatures = Math.max(64, Math.floor(options.maxFeatures ?? 12000));
  }

  static fromJSON(payload: VectorizerSerialized): TextFeatureVectorizer {
    if (payload.version !== 1) throw new Error(`unsupported vectorizer version: ${payload.version}`);
    const vec = new TextFeatureVectorizer({
      ngramMin: payload.ngramMin,
      ngramMax: payload.ngramMax,
      binary: payload.binary,
      maxFeatures: payload.maxFeatures,
    });
    for (const feature of payload.vocabulary) vec.featureToId.set(feature, vec.featureToId.size);
    return vec;
  }

  get featureCount(): number {
    return this.featureToId.size;
  }

  vocabulary(): string[] {
    return [...this.featureToId.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([feature]) => feature);
  }

  fit(texts: string[]): this {
    const counts = new Map<string, number>();
    for (const text of texts) {
      const tokens = tokenize(text);
      const feats: string[] = [];
      pushNgrams(tokens, this.ngramMin, this.ngramMax, feats);
      for (const feat of feats) counts.set(feat, (counts.get(feat) ?? 0) + 1);
    }

    const ranked = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, this.maxFeatures);

    this.featureToId.clear();
    for (const [feature] of ranked) this.featureToId.set(feature, this.featureToId.size);
    return this;
  }

  transform(text: string): SparseVector {
    const tokens = tokenize(text);
    const feats: string[] = [];
    pushNgrams(tokens, this.ngramMin, this.ngramMax, feats);

    const map = new Map<number, number>();
    for (const feat of feats) {
      const id = this.featureToId.get(feat);
      if (id === undefined) continue;
      if (this.binary) map.set(id, 1);
      else map.set(id, (map.get(id) ?? 0) + 1);
    }

    const entries = [...map.entries()].sort((a, b) => a[0] - b[0]);
    return {
      indices: Uint32Array.from(entries.map(([id]) => id)),
      values: Float64Array.from(entries.map(([, value]) => value)),
    };
  }

  transformMany(texts: string[]): SparseVector[] {
    return texts.map((text) => this.transform(text));
  }

  toJSON(): VectorizerSerialized {
    return {
      version: 1,
      ngramMin: this.ngramMin,
      ngramMax: this.ngramMax,
      binary: this.binary,
      maxFeatures: this.maxFeatures,
      vocabulary: this.vocabulary(),
    };
  }
}

export function flattenSparseBatch(rows: SparseVector[]): {
  docOffsets: Uint32Array;
  featureIds: Uint32Array;
  featureValues: Float64Array;
} {
  const offsets = new Uint32Array(rows.length + 1);
  let total = 0;
  for (let i = 0; i < rows.length; i += 1) {
    total += rows[i]!.indices.length;
    offsets[i + 1] = total;
  }

  const ids = new Uint32Array(total);
  const values = new Float64Array(total);
  let cursor = 0;
  for (const row of rows) {
    ids.set(row.indices, cursor);
    values.set(row.values, cursor);
    cursor += row.indices.length;
  }

  return { docOffsets: offsets, featureIds: ids, featureValues: values };
}
