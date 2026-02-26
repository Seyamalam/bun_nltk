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
  if (lastError() !== 0) {
    throw new Error(`native error code ${lastError()} in countUniqueTokensAscii`);
  }
  return out;
}

export function countNgramsAscii(text: string, n: number): number {
  ensureValidN(n);
  const bytes = toBuffer(text);
  if (bytes.length === 0) return 0;
  const value = lib.symbols.bunnltk_count_ngrams_ascii(ptr(bytes), bytes.length, n);
  const out = toNumber(value);
  if (lastError() !== 0) {
    throw new Error(`native error code ${lastError()} in countNgramsAscii`);
  }
  return out;
}

export function countUniqueNgramsAscii(text: string, n: number): number {
  ensureValidN(n);
  const bytes = toBuffer(text);
  if (bytes.length === 0) return 0;
  const value = lib.symbols.bunnltk_count_unique_ngrams_ascii(ptr(bytes), bytes.length, n);
  const out = toNumber(value);
  if (lastError() !== 0) {
    throw new Error(`native error code ${lastError()} in countUniqueNgramsAscii`);
  }
  return out;
}

export function nativeLibraryPath(): string {
  return nativeLibPath;
}
