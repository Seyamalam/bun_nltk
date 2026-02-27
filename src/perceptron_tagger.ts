import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { WasmNltk } from "./wasm";

const ASCII_TOKEN_RE = /[A-Za-z0-9']+/g;

export type PerceptronTaggerModelSerialized = {
  version: number;
  type: string;
  tags: string[];
  feature_count: number;
  tag_count: number;
  feature_index: Record<string, number>;
  weights: number[];
  metadata?: Record<string, unknown>;
};

export type PerceptronTaggerModel = {
  version: number;
  tags: string[];
  featureCount: number;
  tagCount: number;
  featureIndex: Record<string, number>;
  weights: Float32Array;
  metadata?: Record<string, unknown>;
};

export type PerceptronTaggedToken = {
  token: string;
  tag: string;
  tagId: number;
  start: number;
  length: number;
};

type TokenOffset = {
  token: string;
  lower: string;
  start: number;
  length: number;
};

function tokenizeAsciiOffsets(text: string): TokenOffset[] {
  const out: TokenOffset[] = [];
  for (const match of text.matchAll(ASCII_TOKEN_RE)) {
    const token = match[0]!;
    const start = match.index ?? 0;
    out.push({
      token,
      lower: token.toLowerCase(),
      start,
      length: token.length,
    });
  }
  return out;
}

function hasDigit(token: string): boolean {
  for (let i = 0; i < token.length; i += 1) {
    const ch = token.charCodeAt(i)!;
    if (ch >= 48 && ch <= 57) return true;
  }
  return false;
}

function isTitle(token: string): boolean {
  return token.length > 0 && token[0]!.toUpperCase() === token[0] && token[0]!.toLowerCase() !== token[0];
}

function pyBool(value: boolean): "True" | "False" {
  return value ? "True" : "False";
}

function featureKeys(tokens: TokenOffset[], i: number): string[] {
  const t = tokens[i]!;
  const prev = i > 0 ? tokens[i - 1]!.lower : "<BOS>";
  const next = i + 1 < tokens.length ? tokens[i + 1]!.lower : "<EOS>";

  return [
    "bias",
    `w=${t.lower}`,
    `p1=${t.lower.slice(0, 1)}`,
    `p2=${t.lower.slice(0, 2)}`,
    `p3=${t.lower.slice(0, 3)}`,
    `s1=${t.lower.slice(-1)}`,
    `s2=${t.lower.slice(-2)}`,
    `s3=${t.lower.slice(-3)}`,
    `prev=${prev}`,
    `next=${next}`,
    `is_upper=${pyBool(t.token.toUpperCase() === t.token)}`,
    `is_title=${pyBool(isTitle(t.token))}`,
    `has_digit=${pyBool(hasDigit(t.token))}`,
    `has_hyphen=${pyBool(t.token.includes("-"))}`,
  ];
}

function featureIds(tokens: TokenOffset[], i: number, featureIndex: Record<string, number>): number[] {
  const ids: number[] = [];
  for (const f of featureKeys(tokens, i)) {
    const id = featureIndex[f];
    if (id !== undefined) ids.push(id);
  }
  return ids;
}

function argmax(scores: Float32Array): number {
  let bestIdx = 0;
  let bestScore = scores[0] ?? Number.NEGATIVE_INFINITY;
  for (let i = 1; i < scores.length; i += 1) {
    const s = scores[i]!;
    if (s > bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function predictTagIdJs(model: PerceptronTaggerModel, fids: number[], scratch: Float32Array): number {
  scratch.fill(0);
  const tc = model.tagCount;
  for (const fid of fids) {
    if (fid < 0 || fid >= model.featureCount) continue;
    const base = fid * tc;
    for (let j = 0; j < tc; j += 1) {
      scratch[j]! += model.weights[base + j]!;
    }
  }
  return argmax(scratch);
}

export function preparePerceptronTaggerModel(payload: PerceptronTaggerModelSerialized): PerceptronTaggerModel {
  if (payload.feature_count <= 0 || payload.tag_count <= 0) {
    throw new Error("invalid perceptron model dimensions");
  }
  const expectedWeights = payload.feature_count * payload.tag_count;
  if (payload.weights.length !== expectedWeights) {
    throw new Error(`invalid perceptron model weight length: expected ${expectedWeights}, got ${payload.weights.length}`);
  }

  return {
    version: payload.version,
    tags: payload.tags,
    featureCount: payload.feature_count,
    tagCount: payload.tag_count,
    featureIndex: payload.feature_index,
    weights: Float32Array.from(payload.weights),
    metadata: payload.metadata,
  };
}

export function loadPerceptronTaggerModel(path?: string): PerceptronTaggerModel {
  const modelPath = path ?? resolve(import.meta.dir, "..", "models", "perceptron_tagger_ascii.json");
  const raw = JSON.parse(readFileSync(modelPath, "utf8")) as PerceptronTaggerModelSerialized;
  return preparePerceptronTaggerModel(raw);
}

export type PerceptronTaggerOptions = {
  model?: PerceptronTaggerModel;
  wasm?: WasmNltk;
  useWasm?: boolean;
};

function buildBatchFeatureBuffers(
  tokens: TokenOffset[],
  featureIndex: Record<string, number>,
): { featureIds: Uint32Array; tokenOffsets: Uint32Array } {
  const featureIdList: number[] = [];
  const tokenOffsets = new Uint32Array(tokens.length + 1);
  let cursor = 0;

  for (let i = 0; i < tokens.length; i += 1) {
    tokenOffsets[i] = cursor;
    const ids = featureIds(tokens, i, featureIndex);
    cursor += ids.length;
    for (const id of ids) featureIdList.push(id);
  }
  tokenOffsets[tokens.length] = cursor;

  return {
    featureIds: Uint32Array.from(featureIdList),
    tokenOffsets,
  };
}

export function posTagPerceptronAscii(text: string, options: PerceptronTaggerOptions = {}): PerceptronTaggedToken[] {
  const model = options.model ?? loadPerceptronTaggerModel();
  const tokens = tokenizeAsciiOffsets(text);
  if (tokens.length === 0) return [];

  let tagIds: Uint16Array | null = null;
  if (options.useWasm && options.wasm) {
    const batch = buildBatchFeatureBuffers(tokens, model.featureIndex);
    tagIds = options.wasm.perceptronPredictBatch(
      batch.featureIds,
      batch.tokenOffsets,
      model.weights,
      model.featureCount,
      model.tagCount,
    );
  }

  const out: PerceptronTaggedToken[] = [];
  const scratch = new Float32Array(model.tagCount);
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    const tagId =
      tagIds?.[i] ??
      predictTagIdJs(
        model,
        featureIds(tokens, i, model.featureIndex),
        scratch,
      );
    out.push({
      token: token.token,
      tag: model.tags[tagId] ?? model.tags[0] ?? "NN",
      tagId,
      start: token.start,
      length: token.length,
    });
  }

  return out;
}
