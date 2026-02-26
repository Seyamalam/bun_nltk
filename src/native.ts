import { dlopen, ptr } from "bun:ffi";
import { resolve } from "node:path";

function toNumber(value: number | bigint): number {
  return typeof value === "bigint" ? Number(value) : value;
}

const ext = process.platform === "win32" ? "dll" : process.platform === "darwin" ? "dylib" : "so";
const defaultLibPath = resolve(import.meta.dir, "..", "native", `bun_nltk.${ext}`);
const nativeLibPath = process.env.BUN_NLTK_NATIVE_LIB ?? defaultLibPath;

const lib = dlopen(nativeLibPath, {
  bunnltk_last_error_code: {
    args: [],
    returns: "u32",
  },
  bunnltk_count_tokens_ascii: {
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
  bunnltk_porter_stem_ascii: {
    args: ["ptr", "usize", "ptr", "usize"],
    returns: "u32",
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

export function porterStemAsciiTokens(tokens: string[]): string[] {
  return tokens.map((token) => porterStemAscii(token));
}

export function nativeLibraryPath(): string {
  return nativeLibPath;
}
