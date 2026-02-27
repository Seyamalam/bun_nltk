import { dlopen, ptr } from "bun:ffi";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

function toNumber(value: number | bigint): number {
  return typeof value === "bigint" ? Number(value) : value;
}

const ext = process.platform === "win32" ? "dll" : process.platform === "darwin" ? "dylib" : "so";
const prebuiltLibPath = resolve(
  import.meta.dir,
  "..",
  "native",
  "prebuilt",
  `${process.platform}-${process.arch}`,
  `bun_nltk.${ext}`,
);
const nativeLibPath = process.env.BUN_NLTK_NATIVE_LIB ?? prebuiltLibPath;

if (!existsSync(nativeLibPath)) {
  throw new Error(
    `native library not found for platform=${process.platform} arch=${process.arch}: ${nativeLibPath}.` +
      `\nSupported prebuilt targets: linux-x64, win32-x64.` +
      `\nNo install-time native fallback is available.` +
      `\nFor local development overrides, set BUN_NLTK_NATIVE_LIB to a compiled binary path.`,
  );
}

const lib = dlopen(nativeLibPath, {
  bunnltk_last_error_code: {
    args: [],
    returns: "u32",
  },
  bunnltk_count_tokens_ascii: {
    args: ["ptr", "usize"],
    returns: "u64",
  },
  bunnltk_count_tokens_ascii_scalar: {
    args: ["ptr", "usize"],
    returns: "u64",
  },
  bunnltk_count_unique_tokens_ascii: {
    args: ["ptr", "usize"],
    returns: "u64",
  },
  bunnltk_count_ngrams_ascii: {
    args: ["ptr", "usize", "u32"],
    returns: "u64",
  },
  bunnltk_compute_ascii_metrics: {
    args: ["ptr", "usize", "u32", "ptr", "usize"],
    returns: "void",
  },
  bunnltk_count_unique_ngrams_ascii: {
    args: ["ptr", "usize", "u32"],
    returns: "u64",
  },
  bunnltk_fill_token_freqdist_ascii: {
    args: ["ptr", "usize", "ptr", "ptr", "usize"],
    returns: "u64",
  },
  bunnltk_fill_ngram_freqdist_ascii: {
    args: ["ptr", "usize", "u32", "ptr", "ptr", "usize"],
    returns: "u64",
  },
  bunnltk_fill_token_offsets_ascii: {
    args: ["ptr", "usize", "ptr", "ptr", "usize"],
    returns: "u64",
  },
  bunnltk_count_sentences_punkt_ascii: {
    args: ["ptr", "usize"],
    returns: "u64",
  },
  bunnltk_fill_sentence_offsets_punkt_ascii: {
    args: ["ptr", "usize", "ptr", "ptr", "usize"],
    returns: "u64",
  },
  bunnltk_count_normalized_tokens_ascii: {
    args: ["ptr", "usize", "u32"],
    returns: "u64",
  },
  bunnltk_count_normalized_tokens_ascii_scalar: {
    args: ["ptr", "usize", "u32"],
    returns: "u64",
  },
  bunnltk_fill_normalized_token_offsets_ascii: {
    args: ["ptr", "usize", "u32", "ptr", "ptr", "usize"],
    returns: "u64",
  },
  bunnltk_fill_top_pmi_bigrams_ascii: {
    args: ["ptr", "usize", "u32", "ptr", "ptr", "ptr", "usize"],
    returns: "u64",
  },
  bunnltk_fill_top_pmi_bigrams_window_ascii: {
    args: ["ptr", "usize", "u32", "u32", "ptr", "ptr", "ptr", "usize"],
    returns: "u64",
  },
  bunnltk_count_token_blob_bytes_ascii: {
    args: ["ptr", "usize"],
    returns: "u64",
  },
  bunnltk_fill_token_freqdist_ids_ascii: {
    args: ["ptr", "usize", "ptr", "usize", "ptr", "ptr", "ptr", "usize"],
    returns: "u64",
  },
  bunnltk_count_unique_bigrams_window_ascii_ids: {
    args: ["ptr", "usize", "u32"],
    returns: "u64",
  },
  bunnltk_fill_bigram_window_stats_ascii_ids: {
    args: ["ptr", "usize", "u32", "ptr", "ptr", "ptr", "ptr", "usize"],
    returns: "u64",
  },
  bunnltk_count_ngrams_ascii_ids: {
    args: ["ptr", "usize", "u32"],
    returns: "u64",
  },
  bunnltk_fill_ngrams_ascii_ids: {
    args: ["ptr", "usize", "u32", "ptr", "usize"],
    returns: "u64",
  },
  bunnltk_count_everygrams_ascii_ids: {
    args: ["ptr", "usize", "u32", "u32"],
    returns: "u64",
  },
  bunnltk_count_everygram_id_values_ascii: {
    args: ["ptr", "usize", "u32", "u32"],
    returns: "u64",
  },
  bunnltk_fill_everygrams_ascii_ids: {
    args: ["ptr", "usize", "u32", "u32", "ptr", "usize", "ptr", "usize"],
    returns: "u64",
  },
  bunnltk_count_skipgrams_ascii_ids: {
    args: ["ptr", "usize", "u32", "u32"],
    returns: "u64",
  },
  bunnltk_fill_skipgrams_ascii_ids: {
    args: ["ptr", "usize", "u32", "u32", "ptr", "usize"],
    returns: "u64",
  },
  bunnltk_count_pos_tags_ascii: {
    args: ["ptr", "usize"],
    returns: "u64",
  },
  bunnltk_fill_pos_tags_ascii: {
    args: ["ptr", "usize", "ptr", "ptr", "ptr", "usize"],
    returns: "u64",
  },
  bunnltk_perceptron_predict_batch: {
    args: ["ptr", "usize", "ptr", "usize", "ptr", "usize", "u32", "u32", "ptr", "usize"],
    returns: "void",
  },
  bunnltk_porter_stem_ascii: {
    args: ["ptr", "usize", "ptr", "usize"],
    returns: "u32",
  },
  bunnltk_wordnet_morphy_ascii: {
    args: ["ptr", "usize", "u32", "ptr", "usize"],
    returns: "u32",
  },
  bunnltk_lm_eval_ids: {
    args: [
      "ptr",
      "usize",
      "ptr",
      "usize",
      "u32",
      "u32",
      "f64",
      "f64",
      "u32",
      "ptr",
      "usize",
      "ptr",
      "ptr",
      "usize",
      "ptr",
      "usize",
      "ptr",
      "usize",
      "ptr",
      "usize",
    ],
    returns: "f64",
  },
  bunnltk_chunk_iob_ids: {
    args: [
      "ptr",
      "usize",
      "ptr",
      "ptr",
      "ptr",
      "usize",
      "ptr",
      "ptr",
      "usize",
      "ptr",
      "ptr",
      "ptr",
      "usize",
      "ptr",
      "ptr",
      "usize",
    ],
    returns: "u64",
  },
  bunnltk_cyk_recognize_ids: {
    args: ["ptr", "usize", "ptr", "ptr", "ptr", "usize", "ptr", "ptr", "usize", "u16"],
    returns: "u32",
  },
  bunnltk_naive_bayes_log_scores_ids: {
    args: ["ptr", "usize", "u32", "ptr", "usize", "ptr", "ptr", "usize", "u32", "f64", "ptr", "usize"],
    returns: "void",
  },
  bunnltk_freqdist_stream_new: {
    args: [],
    returns: "u64",
  },
  bunnltk_freqdist_stream_free: {
    args: ["u64"],
    returns: "void",
  },
  bunnltk_freqdist_stream_update_ascii: {
    args: ["u64", "ptr", "usize"],
    returns: "void",
  },
  bunnltk_freqdist_stream_flush: {
    args: ["u64"],
    returns: "void",
  },
  bunnltk_freqdist_stream_token_unique: {
    args: ["u64"],
    returns: "u64",
  },
  bunnltk_freqdist_stream_bigram_unique: {
    args: ["u64"],
    returns: "u64",
  },
  bunnltk_freqdist_stream_conditional_unique: {
    args: ["u64"],
    returns: "u64",
  },
  bunnltk_freqdist_stream_fill_token: {
    args: ["u64", "ptr", "ptr", "usize"],
    returns: "u64",
  },
  bunnltk_freqdist_stream_fill_bigram: {
    args: ["u64", "ptr", "ptr", "ptr", "usize"],
    returns: "u64",
  },
  bunnltk_freqdist_stream_fill_conditional: {
    args: ["u64", "ptr", "ptr", "ptr", "usize"],
    returns: "u64",
  },
  bunnltk_freqdist_stream_count_json_bytes: {
    args: ["u64"],
    returns: "u64",
  },
  bunnltk_freqdist_stream_fill_json: {
    args: ["u64", "ptr", "usize"],
    returns: "u64",
  },
});

function toBuffer(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function ensureValidN(n: number): void {
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error("n must be a positive integer");
  }
}

function lastError(): number {
  return lib.symbols.bunnltk_last_error_code();
}

function assertNoNativeError(context: string): void {
  const code = lastError();
  if (code !== 0) {
    throw new Error(`native error code ${code} in ${context}`);
  }
}

export function countTokensAscii(text: string): number {
  const bytes = toBuffer(text);
  if (bytes.length === 0) return 0;
  const value = lib.symbols.bunnltk_count_tokens_ascii(ptr(bytes), bytes.length);
  return toNumber(value);
}

export function countTokensAsciiScalar(text: string): number {
  const bytes = toBuffer(text);
  if (bytes.length === 0) return 0;
  const value = lib.symbols.bunnltk_count_tokens_ascii_scalar(ptr(bytes), bytes.length);
  return toNumber(value);
}

export function countUniqueTokensAscii(text: string): number {
  const bytes = toBuffer(text);
  if (bytes.length === 0) return 0;
  const value = lib.symbols.bunnltk_count_unique_tokens_ascii(ptr(bytes), bytes.length);
  const out = toNumber(value);
  assertNoNativeError("countUniqueTokensAscii");
  return out;
}

export function countNgramsAscii(text: string, n: number): number {
  ensureValidN(n);
  const bytes = toBuffer(text);
  if (bytes.length === 0) return 0;
  const value = lib.symbols.bunnltk_count_ngrams_ascii(ptr(bytes), bytes.length, n);
  const out = toNumber(value);
  assertNoNativeError("countNgramsAscii");
  return out;
}

export type AsciiMetrics = {
  tokens: number;
  uniqueTokens: number;
  ngrams: number;
  uniqueNgrams: number;
};

export function computeAsciiMetrics(text: string, n: number): AsciiMetrics {
  ensureValidN(n);
  const bytes = toBuffer(text);
  if (bytes.length === 0) {
    return { tokens: 0, uniqueTokens: 0, ngrams: 0, uniqueNgrams: 0 };
  }

  const metrics = new BigUint64Array(4);
  lib.symbols.bunnltk_compute_ascii_metrics(ptr(bytes), bytes.length, n, ptr(metrics), metrics.length);
  assertNoNativeError("computeAsciiMetrics");

  return {
    tokens: Number(metrics[0]!),
    uniqueTokens: Number(metrics[1]!),
    ngrams: Number(metrics[2]!),
    uniqueNgrams: Number(metrics[3]!),
  };
}

export function countUniqueNgramsAscii(text: string, n: number): number {
  ensureValidN(n);
  const bytes = toBuffer(text);
  if (bytes.length === 0) return 0;
  const value = lib.symbols.bunnltk_count_unique_ngrams_ascii(ptr(bytes), bytes.length, n);
  const out = toNumber(value);
  assertNoNativeError("countUniqueNgramsAscii");
  return out;
}

export function tokenFreqDistHashAscii(text: string): Map<bigint, number> {
  const bytes = toBuffer(text);
  if (bytes.length === 0) return new Map();

  const capacity = Math.max(1, countTokensAscii(text));
  const hashes = new BigUint64Array(capacity);
  const counts = new BigUint64Array(capacity);

  const unique = toNumber(
    lib.symbols.bunnltk_fill_token_freqdist_ascii(
      ptr(bytes),
      bytes.length,
      ptr(hashes),
      ptr(counts),
      capacity,
    ),
  );
  assertNoNativeError("tokenFreqDistHashAscii");

  const out = new Map<bigint, number>();
  for (let i = 0; i < unique; i += 1) {
    out.set(hashes[i]!, Number(counts[i]!));
  }
  return out;
}

export function ngramFreqDistHashAscii(text: string, n: number): Map<bigint, number> {
  ensureValidN(n);
  const bytes = toBuffer(text);
  if (bytes.length === 0) return new Map();

  const capacity = Math.max(1, countNgramsAscii(text, n));
  const hashes = new BigUint64Array(capacity);
  const counts = new BigUint64Array(capacity);

  const unique = toNumber(
    lib.symbols.bunnltk_fill_ngram_freqdist_ascii(
      ptr(bytes),
      bytes.length,
      n,
      ptr(hashes),
      ptr(counts),
      capacity,
    ),
  );
  assertNoNativeError("ngramFreqDistHashAscii");

  const out = new Map<bigint, number>();
  for (let i = 0; i < unique; i += 1) {
    out.set(hashes[i]!, Number(counts[i]!));
  }
  return out;
}

export function tokenizeAsciiNative(text: string): string[] {
  const bytes = toBuffer(text);
  if (bytes.length === 0) return [];

  const capacity = Math.max(1, countTokensAscii(text));
  const offsets = new Uint32Array(capacity);
  const lengths = new Uint32Array(capacity);

  const total = toNumber(
    lib.symbols.bunnltk_fill_token_offsets_ascii(
      ptr(bytes),
      bytes.length,
      ptr(offsets),
      ptr(lengths),
      capacity,
    ),
  );
  assertNoNativeError("tokenizeAsciiNative");

  const decoder = new TextDecoder();
  const out = new Array<string>(total);
  for (let i = 0; i < total; i += 1) {
    const start = offsets[i]!;
    const len = lengths[i]!;
    out[i] = decoder.decode(bytes.subarray(start, start + len)).toLowerCase();
  }
  return out;
}

export function sentenceTokenizePunktAsciiNative(text: string): string[] {
  const bytes = toBuffer(text);
  if (bytes.length === 0) return [];

  const capacity = Math.max(1, toNumber(lib.symbols.bunnltk_count_sentences_punkt_ascii(ptr(bytes), bytes.length)));
  assertNoNativeError("sentenceTokenizePunktAsciiNative.count");

  const offsets = new Uint32Array(capacity);
  const lengths = new Uint32Array(capacity);
  const total = toNumber(
    lib.symbols.bunnltk_fill_sentence_offsets_punkt_ascii(
      ptr(bytes),
      bytes.length,
      ptr(offsets),
      ptr(lengths),
      capacity,
    ),
  );
  assertNoNativeError("sentenceTokenizePunktAsciiNative.fill");

  const decoder = new TextDecoder();
  const out = new Array<string>(total);
  for (let i = 0; i < total; i += 1) {
    const start = offsets[i]!;
    const len = lengths[i]!;
    out[i] = decoder.decode(bytes.subarray(start, start + len));
  }
  return out;
}

export function countNormalizedTokensAscii(text: string, removeStopwords = true): number {
  const bytes = toBuffer(text);
  if (bytes.length === 0) return 0;
  const value = lib.symbols.bunnltk_count_normalized_tokens_ascii(ptr(bytes), bytes.length, removeStopwords ? 1 : 0);
  const out = toNumber(value);
  assertNoNativeError("countNormalizedTokensAscii");
  return out;
}

export function countNormalizedTokensAsciiScalar(text: string, removeStopwords = true): number {
  const bytes = toBuffer(text);
  if (bytes.length === 0) return 0;
  const value = lib.symbols.bunnltk_count_normalized_tokens_ascii_scalar(ptr(bytes), bytes.length, removeStopwords ? 1 : 0);
  const out = toNumber(value);
  assertNoNativeError("countNormalizedTokensAsciiScalar");
  return out;
}

export function normalizeTokensAsciiNative(text: string, removeStopwords = true): string[] {
  const bytes = toBuffer(text);
  if (bytes.length === 0) return [];

  const capacity = Math.max(1, countNormalizedTokensAscii(text, removeStopwords));
  const offsets = new Uint32Array(capacity);
  const lengths = new Uint32Array(capacity);

  const total = toNumber(
    lib.symbols.bunnltk_fill_normalized_token_offsets_ascii(
      ptr(bytes),
      bytes.length,
      removeStopwords ? 1 : 0,
      ptr(offsets),
      ptr(lengths),
      capacity,
    ),
  );
  assertNoNativeError("normalizeTokensAsciiNative");

  const decoder = new TextDecoder();
  const out = new Array<string>(total);
  for (let i = 0; i < total; i += 1) {
    const start = offsets[i]!;
    const len = lengths[i]!;
    out[i] = decoder.decode(bytes.subarray(start, start + len)).toLowerCase();
  }
  return out;
}

export function ngramsAsciiNative(text: string, n: number): string[][] {
  ensureValidN(n);
  const bytes = toBuffer(text);
  if (bytes.length === 0) return [];

  const vocab = tokenFreqDistIdsAscii(text);
  const gramCount = toNumber(lib.symbols.bunnltk_count_ngrams_ascii_ids(ptr(bytes), bytes.length, n));
  assertNoNativeError("ngramsAsciiNative.count");
  if (gramCount === 0) return [];

  const flat = new Uint32Array(gramCount * n);
  const written = toNumber(
    lib.symbols.bunnltk_fill_ngrams_ascii_ids(ptr(bytes), bytes.length, n, ptr(flat), flat.length),
  );
  assertNoNativeError("ngramsAsciiNative.fill");

  const out: string[][] = [];
  let idx = 0;
  for (let i = 0; i < written; i += 1) {
    const gram: string[] = [];
    for (let j = 0; j < n; j += 1) {
      gram.push(vocab.tokens[flat[idx + j]!]!);
    }
    idx += n;
    out.push(gram);
  }
  return out;
}

export function everygramsAsciiNative(text: string, minLen = 1, maxLen = Number.MAX_SAFE_INTEGER): string[][] {
  if (!Number.isInteger(minLen) || minLen <= 0) throw new Error("minLen must be a positive integer");
  if (!Number.isInteger(maxLen) || maxLen <= 0) throw new Error("maxLen must be a positive integer");

  const bytes = toBuffer(text);
  if (bytes.length === 0) return [];

  const vocab = tokenFreqDistIdsAscii(text);
  const gramCount = toNumber(
    lib.symbols.bunnltk_count_everygrams_ascii_ids(ptr(bytes), bytes.length, minLen, maxLen),
  );
  assertNoNativeError("everygramsAsciiNative.count");
  if (gramCount === 0) return [];

  const idValues = toNumber(
    lib.symbols.bunnltk_count_everygram_id_values_ascii(ptr(bytes), bytes.length, minLen, maxLen),
  );
  assertNoNativeError("everygramsAsciiNative.count_values");

  const lens = new Uint32Array(gramCount);
  const flat = new Uint32Array(idValues);
  const written = toNumber(
    lib.symbols.bunnltk_fill_everygrams_ascii_ids(
      ptr(bytes),
      bytes.length,
      minLen,
      maxLen,
      ptr(lens),
      lens.length,
      ptr(flat),
      flat.length,
    ),
  );
  assertNoNativeError("everygramsAsciiNative.fill");

  const out: string[][] = [];
  let idx = 0;
  for (let i = 0; i < written; i += 1) {
    const len = lens[i]!;
    const gram: string[] = [];
    for (let j = 0; j < len; j += 1) {
      gram.push(vocab.tokens[flat[idx + j]!]!);
    }
    idx += len;
    out.push(gram);
  }
  return out;
}

export function skipgramsAsciiNative(text: string, n: number, k: number): string[][] {
  ensureValidN(n);
  if (!Number.isInteger(k) || k < 0) throw new Error("k must be an integer >= 0");

  const bytes = toBuffer(text);
  if (bytes.length === 0) return [];

  const vocab = tokenFreqDistIdsAscii(text);
  const gramCount = toNumber(
    lib.symbols.bunnltk_count_skipgrams_ascii_ids(ptr(bytes), bytes.length, n, k),
  );
  assertNoNativeError("skipgramsAsciiNative.count");
  if (gramCount === 0) return [];

  const flat = new Uint32Array(gramCount * n);
  const written = toNumber(
    lib.symbols.bunnltk_fill_skipgrams_ascii_ids(ptr(bytes), bytes.length, n, k, ptr(flat), flat.length),
  );
  assertNoNativeError("skipgramsAsciiNative.fill");

  const out: string[][] = [];
  let idx = 0;
  for (let i = 0; i < written; i += 1) {
    const gram: string[] = [];
    for (let j = 0; j < n; j += 1) {
      gram.push(vocab.tokens[flat[idx + j]!]!);
    }
    idx += n;
    out.push(gram);
  }
  return out;
}

const POS_TAG_NAMES = ["NN", "NNP", "CD", "VBG", "VBD", "RB", "DT", "CC", "PRP", "VB"] as const;
export type PosTagName = (typeof POS_TAG_NAMES)[number];

export type PosTag = {
  token: string;
  tag: PosTagName;
  tagId: number;
  start: number;
  length: number;
};

export function posTagAsciiNative(text: string): PosTag[] {
  const bytes = toBuffer(text);
  if (bytes.length === 0) return [];

  const capacity = Math.max(1, toNumber(lib.symbols.bunnltk_count_pos_tags_ascii(ptr(bytes), bytes.length)));
  assertNoNativeError("posTagAsciiNative.count");

  const offsets = new Uint32Array(capacity);
  const lengths = new Uint32Array(capacity);
  const tagIds = new Uint16Array(capacity);

  const total = toNumber(
    lib.symbols.bunnltk_fill_pos_tags_ascii(ptr(bytes), bytes.length, ptr(offsets), ptr(lengths), ptr(tagIds), capacity),
  );
  assertNoNativeError("posTagAsciiNative.fill");

  const decoder = new TextDecoder();
  const out: PosTag[] = [];
  for (let i = 0; i < total; i += 1) {
    const start = offsets[i]!;
    const length = lengths[i]!;
    const tagId = tagIds[i]!;
    out.push({
      token: decoder.decode(bytes.subarray(start, start + length)),
      tag: POS_TAG_NAMES[tagId] ?? "NN",
      tagId,
      start,
      length,
    });
  }
  return out;
}

export function perceptronPredictBatchNative(
  featureIds: Uint32Array,
  tokenOffsets: Uint32Array,
  weights: Float32Array,
  modelFeatureCount: number,
  tagCount: number,
): Uint16Array {
  if (tokenOffsets.length === 0) return new Uint16Array(0);
  if (!Number.isInteger(modelFeatureCount) || modelFeatureCount <= 0) {
    throw new Error("modelFeatureCount must be a positive integer");
  }
  if (!Number.isInteger(tagCount) || tagCount <= 0) {
    throw new Error("tagCount must be a positive integer");
  }

  const tokenCount = tokenOffsets.length - 1;
  const out = new Uint16Array(tokenCount);
  lib.symbols.bunnltk_perceptron_predict_batch(
    ptr(featureIds),
    featureIds.length,
    ptr(tokenOffsets),
    tokenOffsets.length,
    ptr(weights),
    weights.length,
    modelFeatureCount,
    tagCount,
    ptr(out),
    out.length,
  );
  assertNoNativeError("perceptronPredictBatchNative");
  return out;
}

export type PmiBigram = {
  leftHash: bigint;
  rightHash: bigint;
  score: number;
};

export function topPmiBigramsAscii(text: string, topK: number, windowSize = 2): PmiBigram[] {
  if (!Number.isInteger(topK) || topK <= 0) {
    throw new Error("topK must be a positive integer");
  }
  if (!Number.isInteger(windowSize) || windowSize < 2) {
    throw new Error("windowSize must be an integer >= 2");
  }

  const bytes = toBuffer(text);
  if (bytes.length === 0) return [];

  const capacity = topK;
  const left = new BigUint64Array(capacity);
  const right = new BigUint64Array(capacity);
  const scores = new Float64Array(capacity);

  const written = toNumber(
    lib.symbols.bunnltk_fill_top_pmi_bigrams_window_ascii(
      ptr(bytes),
      bytes.length,
      windowSize,
      topK,
      ptr(left),
      ptr(right),
      ptr(scores),
      capacity,
    ),
  );
  assertNoNativeError("topPmiBigramsAscii");

  const out: PmiBigram[] = [];
  for (let i = 0; i < written; i += 1) {
    out.push({
      leftHash: left[i]!,
      rightHash: right[i]!,
      score: scores[i]!,
    });
  }
  return out;
}

export type TokenFreqDistIds = {
  tokens: string[];
  counts: number[];
  tokenToId: Map<string, number>;
  totalTokens: number;
};

export function tokenFreqDistIdsAscii(text: string): TokenFreqDistIds {
  const bytes = toBuffer(text);
  if (bytes.length === 0) {
    return { tokens: [], counts: [], tokenToId: new Map(), totalTokens: 0 };
  }

  const unique = countUniqueTokensAscii(text);
  const blobBytes = toNumber(lib.symbols.bunnltk_count_token_blob_bytes_ascii(ptr(bytes), bytes.length));
  assertNoNativeError("tokenFreqDistIdsAscii.count_blob_bytes");

  const blob = new Uint8Array(Math.max(1, blobBytes));
  const offsets = new Uint32Array(Math.max(1, unique));
  const lengths = new Uint32Array(Math.max(1, unique));
  const counts = new BigUint64Array(Math.max(1, unique));

  const written = toNumber(
    lib.symbols.bunnltk_fill_token_freqdist_ids_ascii(
      ptr(bytes),
      bytes.length,
      ptr(blob),
      blob.length,
      ptr(offsets),
      ptr(lengths),
      ptr(counts),
      offsets.length,
    ),
  );
  assertNoNativeError("tokenFreqDistIdsAscii.fill");

  const decoder = new TextDecoder();
  const outTokens: string[] = [];
  const outCounts: number[] = [];
  const tokenToId = new Map<string, number>();

  for (let i = 0; i < written; i += 1) {
    const start = offsets[i]!;
    const len = lengths[i]!;
    const token = decoder.decode(blob.subarray(start, start + len));
    outTokens.push(token);
    outCounts.push(Number(counts[i]!));
    tokenToId.set(token, i);
  }

  return {
    tokens: outTokens,
    counts: outCounts,
    tokenToId,
    totalTokens: countTokensAscii(text),
  };
}

export type BigramWindowStatId = {
  leftId: number;
  rightId: number;
  count: number;
  pmi: number;
};

export type BigramWindowStatToken = {
  left: string;
  right: string;
  leftId: number;
  rightId: number;
  count: number;
  pmi: number;
};

export function bigramWindowStatsAsciiIds(text: string, windowSize = 2): BigramWindowStatId[] {
  if (!Number.isInteger(windowSize) || windowSize < 2) {
    throw new Error("windowSize must be an integer >= 2");
  }

  const bytes = toBuffer(text);
  if (bytes.length === 0) return [];

  const unique = toNumber(
    lib.symbols.bunnltk_count_unique_bigrams_window_ascii_ids(ptr(bytes), bytes.length, windowSize),
  );
  assertNoNativeError("bigramWindowStatsAsciiIds.count");
  if (unique === 0) return [];

  const left = new Uint32Array(unique);
  const right = new Uint32Array(unique);
  const counts = new BigUint64Array(unique);
  const pmis = new Float64Array(unique);

  const written = toNumber(
    lib.symbols.bunnltk_fill_bigram_window_stats_ascii_ids(
      ptr(bytes),
      bytes.length,
      windowSize,
      ptr(left),
      ptr(right),
      ptr(counts),
      ptr(pmis),
      unique,
    ),
  );
  assertNoNativeError("bigramWindowStatsAsciiIds.fill");

  const out: BigramWindowStatId[] = [];
  for (let i = 0; i < written; i += 1) {
    out.push({
      leftId: left[i]!,
      rightId: right[i]!,
      count: Number(counts[i]!),
      pmi: pmis[i]!,
    });
  }
  return out;
}

export function bigramWindowStatsAscii(text: string, windowSize = 2): BigramWindowStatToken[] {
  const vocab = tokenFreqDistIdsAscii(text);
  const stats = bigramWindowStatsAsciiIds(text, windowSize);

  return stats.map((row) => ({
    left: vocab.tokens[row.leftId]!,
    right: vocab.tokens[row.rightId]!,
    leftId: row.leftId,
    rightId: row.rightId,
    count: row.count,
    pmi: row.pmi,
  }));
}

export function porterStemAscii(token: string): string {
  const bytes = toBuffer(token);
  if (bytes.length === 0) return "";

  const out = new Uint8Array(bytes.length);
  const stemLen = lib.symbols.bunnltk_porter_stem_ascii(ptr(bytes), bytes.length, ptr(out), out.length);
  assertNoNativeError("porterStemAscii");

  return new TextDecoder().decode(out.subarray(0, stemLen));
}

function wordnetPosToCode(pos?: "n" | "v" | "a" | "r"): number {
  if (pos === "n") return 1;
  if (pos === "v") return 2;
  if (pos === "a") return 3;
  if (pos === "r") return 4;
  return 0;
}

export function wordnetMorphyAsciiNative(word: string, pos?: "n" | "v" | "a" | "r"): string {
  const input = toBuffer(word);
  if (input.length === 0) return "";
  const out = new Uint8Array(Math.max(64, input.length + 8));
  const written = lib.symbols.bunnltk_wordnet_morphy_ascii(
    ptr(input),
    input.length,
    wordnetPosToCode(pos),
    ptr(out),
    out.length,
  );
  assertNoNativeError("wordnetMorphyAsciiNative");
  if (written <= 0) return "";
  return new TextDecoder().decode(out.subarray(0, written));
}

export type NativeLmModelType = "mle" | "lidstone" | "kneser_ney_interpolated";

function nativeLmTypeCode(model: NativeLmModelType): number {
  if (model === "mle") return 0;
  if (model === "lidstone") return 1;
  return 2;
}

export function evaluateLanguageModelIdsNative(input: {
  tokenIds: Uint32Array;
  sentenceOffsets: Uint32Array;
  order: number;
  model: NativeLmModelType;
  gamma: number;
  discount: number;
  vocabSize: number;
  probeContextFlat: Uint32Array;
  probeContextLens: Uint32Array;
  probeWordIds: Uint32Array;
  perplexityTokenIds: Uint32Array;
  prefixTokenIds: Uint32Array;
}): { scores: Float64Array; perplexity: number } {
  const scores = new Float64Array(input.probeWordIds.length);
  const perplexity = lib.symbols.bunnltk_lm_eval_ids(
    ptr(input.tokenIds),
    input.tokenIds.length,
    ptr(input.sentenceOffsets),
    input.sentenceOffsets.length,
    input.order,
    nativeLmTypeCode(input.model),
    input.gamma,
    input.discount,
    input.vocabSize,
    ptr(input.probeContextFlat),
    input.probeContextFlat.length,
    ptr(input.probeContextLens),
    ptr(input.probeWordIds),
    input.probeWordIds.length,
    ptr(scores),
    scores.length,
    ptr(input.perplexityTokenIds),
    input.perplexityTokenIds.length,
    ptr(input.prefixTokenIds),
    input.prefixTokenIds.length,
  );
  assertNoNativeError("evaluateLanguageModelIdsNative");
  return {
    scores,
    perplexity,
  };
}

export function chunkIobIdsNative(input: {
  tokenTagIds: Uint16Array;
  atomAllowedOffsets: Uint32Array;
  atomAllowedLengths: Uint32Array;
  atomAllowedFlat: Uint16Array;
  atomMins: Uint8Array;
  atomMaxs: Uint8Array;
  ruleAtomOffsets: Uint32Array;
  ruleAtomCounts: Uint32Array;
  ruleLabelIds: Uint16Array;
}): { labelIds: Uint16Array; begins: Uint8Array } {
  const labelIds = new Uint16Array(input.tokenTagIds.length);
  const begins = new Uint8Array(input.tokenTagIds.length);

  lib.symbols.bunnltk_chunk_iob_ids(
    ptr(input.tokenTagIds),
    input.tokenTagIds.length,
    ptr(input.atomAllowedOffsets),
    ptr(input.atomAllowedLengths),
    ptr(input.atomAllowedFlat),
    input.atomAllowedFlat.length,
    ptr(input.atomMins),
    ptr(input.atomMaxs),
    input.atomMins.length,
    ptr(input.ruleAtomOffsets),
    ptr(input.ruleAtomCounts),
    ptr(input.ruleLabelIds),
    input.ruleLabelIds.length,
    ptr(labelIds),
    ptr(begins),
    labelIds.length,
  );
  assertNoNativeError("chunkIobIdsNative");

  return { labelIds, begins };
}

export function cykRecognizeIdsNative(input: {
  tokenBits: BigUint64Array;
  binaryLeft: Uint16Array;
  binaryRight: Uint16Array;
  binaryParent: Uint16Array;
  unaryChild: Uint16Array;
  unaryParent: Uint16Array;
  startSymbol: number;
}): boolean {
  const out = lib.symbols.bunnltk_cyk_recognize_ids(
    ptr(input.tokenBits),
    input.tokenBits.length,
    ptr(input.binaryLeft),
    ptr(input.binaryRight),
    ptr(input.binaryParent),
    input.binaryLeft.length,
    ptr(input.unaryChild),
    ptr(input.unaryParent),
    input.unaryChild.length,
    input.startSymbol,
  );
  assertNoNativeError("cykRecognizeIdsNative");
  return Number(out) === 1;
}

export function naiveBayesLogScoresIdsNative(input: {
  docTokenIds: Uint32Array;
  vocabSize: number;
  tokenCountsMatrix: Uint32Array;
  labelDocCounts: Uint32Array;
  labelTokenTotals: Uint32Array;
  totalDocs: number;
  smoothing: number;
}): Float64Array {
  const labelCount = input.labelDocCounts.length;
  const out = new Float64Array(labelCount);
  lib.symbols.bunnltk_naive_bayes_log_scores_ids(
    ptr(input.docTokenIds),
    input.docTokenIds.length,
    input.vocabSize,
    ptr(input.tokenCountsMatrix),
    input.tokenCountsMatrix.length,
    ptr(input.labelDocCounts),
    ptr(input.labelTokenTotals),
    labelCount,
    input.totalDocs,
    input.smoothing,
    ptr(out),
    out.length,
  );
  assertNoNativeError("naiveBayesLogScoresIdsNative");
  return out;
}

export function porterStemAsciiTokens(tokens: string[]): string[] {
  return tokens.map((token) => porterStemAscii(token));
}

export type StreamBigramFreq = {
  leftHash: bigint;
  rightHash: bigint;
  count: number;
};

export type StreamConditionalFreq = {
  tagId: number;
  tokenHash: bigint;
  count: number;
};

export class NativeFreqDistStream {
  private handle: bigint;
  private disposed = false;

  constructor() {
    const rawHandle = lib.symbols.bunnltk_freqdist_stream_new();
    this.handle = BigInt(rawHandle);
    assertNoNativeError("NativeFreqDistStream.constructor");
    if (this.handle === 0n) {
      throw new Error("failed to allocate native freqdist stream");
    }
  }

  private ensureOpen(): void {
    if (this.disposed || this.handle === 0n) {
      throw new Error("NativeFreqDistStream is already disposed");
    }
  }

  update(text: string): void {
    this.ensureOpen();
    const bytes = toBuffer(text);
    if (bytes.length === 0) return;
    lib.symbols.bunnltk_freqdist_stream_update_ascii(this.handle, ptr(bytes), bytes.length);
    assertNoNativeError("NativeFreqDistStream.update");
  }

  flush(): void {
    this.ensureOpen();
    lib.symbols.bunnltk_freqdist_stream_flush(this.handle);
    assertNoNativeError("NativeFreqDistStream.flush");
  }

  tokenUniqueCount(): number {
    this.ensureOpen();
    const out = toNumber(lib.symbols.bunnltk_freqdist_stream_token_unique(this.handle));
    assertNoNativeError("NativeFreqDistStream.tokenUniqueCount");
    return out;
  }

  bigramUniqueCount(): number {
    this.ensureOpen();
    const out = toNumber(lib.symbols.bunnltk_freqdist_stream_bigram_unique(this.handle));
    assertNoNativeError("NativeFreqDistStream.bigramUniqueCount");
    return out;
  }

  conditionalUniqueCount(): number {
    this.ensureOpen();
    const out = toNumber(lib.symbols.bunnltk_freqdist_stream_conditional_unique(this.handle));
    assertNoNativeError("NativeFreqDistStream.conditionalUniqueCount");
    return out;
  }

  tokenFreqDistHash(): Map<bigint, number> {
    this.ensureOpen();
    const capacity = Math.max(1, this.tokenUniqueCount());
    const hashes = new BigUint64Array(capacity);
    const counts = new BigUint64Array(capacity);
    const written = toNumber(
      lib.symbols.bunnltk_freqdist_stream_fill_token(this.handle, ptr(hashes), ptr(counts), capacity),
    );
    assertNoNativeError("NativeFreqDistStream.tokenFreqDistHash");

    const out = new Map<bigint, number>();
    for (let i = 0; i < written; i += 1) {
      out.set(hashes[i]!, Number(counts[i]!));
    }
    return out;
  }

  bigramFreqDistHash(): StreamBigramFreq[] {
    this.ensureOpen();
    const capacity = Math.max(1, this.bigramUniqueCount());
    const left = new BigUint64Array(capacity);
    const right = new BigUint64Array(capacity);
    const counts = new BigUint64Array(capacity);
    const written = toNumber(
      lib.symbols.bunnltk_freqdist_stream_fill_bigram(this.handle, ptr(left), ptr(right), ptr(counts), capacity),
    );
    assertNoNativeError("NativeFreqDistStream.bigramFreqDistHash");

    const out: StreamBigramFreq[] = [];
    for (let i = 0; i < written; i += 1) {
      out.push({
        leftHash: left[i]!,
        rightHash: right[i]!,
        count: Number(counts[i]!),
      });
    }
    return out;
  }

  conditionalFreqDistHash(): StreamConditionalFreq[] {
    this.ensureOpen();
    const capacity = Math.max(1, this.conditionalUniqueCount());
    const tagIds = new Uint16Array(capacity);
    const hashes = new BigUint64Array(capacity);
    const counts = new BigUint64Array(capacity);
    const written = toNumber(
      lib.symbols.bunnltk_freqdist_stream_fill_conditional(
        this.handle,
        ptr(tagIds),
        ptr(hashes),
        ptr(counts),
        capacity,
      ),
    );
    assertNoNativeError("NativeFreqDistStream.conditionalFreqDistHash");

    const out: StreamConditionalFreq[] = [];
    for (let i = 0; i < written; i += 1) {
      out.push({
        tagId: tagIds[i]!,
        tokenHash: hashes[i]!,
        count: Number(counts[i]!),
      });
    }
    return out;
  }

  toJson(): string {
    this.ensureOpen();
    const byteCount = toNumber(lib.symbols.bunnltk_freqdist_stream_count_json_bytes(this.handle));
    assertNoNativeError("NativeFreqDistStream.toJson.count");
    if (byteCount === 0) return '{"tokens":[],"bigrams":[],"conditional_tags":[]}';

    const out = new Uint8Array(byteCount);
    const written = toNumber(lib.symbols.bunnltk_freqdist_stream_fill_json(this.handle, ptr(out), out.length));
    assertNoNativeError("NativeFreqDistStream.toJson.fill");
    return new TextDecoder().decode(out.subarray(0, written));
  }

  dispose(): void {
    if (this.disposed || this.handle === 0n) return;
    lib.symbols.bunnltk_freqdist_stream_free(this.handle);
    assertNoNativeError("NativeFreqDistStream.dispose");
    this.disposed = true;
    this.handle = 0n;
  }
}

export function nativeLibraryPath(): string {
  return nativeLibPath;
}
