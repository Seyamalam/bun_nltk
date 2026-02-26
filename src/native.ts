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

export function nativeLibraryPath(): string {
  return nativeLibPath;
}
