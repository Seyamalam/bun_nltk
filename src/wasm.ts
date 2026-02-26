import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type WasmExports = {
  memory: WebAssembly.Memory;
  bunnltk_wasm_last_error_code: () => number;
  bunnltk_wasm_input_ptr: () => number;
  bunnltk_wasm_input_capacity: () => number;
  bunnltk_wasm_alloc: (size: number) => number;
  bunnltk_wasm_free: (ptr: number, size: number) => void;
  bunnltk_wasm_count_tokens_ascii: (inputLen: number) => bigint;
  bunnltk_wasm_count_ngrams_ascii: (inputLen: number, n: number) => bigint;
  bunnltk_wasm_compute_ascii_metrics: (
    inputLen: number,
    n: number,
    outMetricsPtr: number,
    outMetricsLen: number,
  ) => void;
  bunnltk_wasm_fill_token_offsets_ascii: (
    inputLen: number,
    outOffsetsPtr: number,
    outLengthsPtr: number,
    capacity: number,
  ) => bigint;
  bunnltk_wasm_count_normalized_tokens_ascii: (inputLen: number, removeStopwords: number) => bigint;
  bunnltk_wasm_fill_normalized_token_offsets_ascii: (
    inputLen: number,
    removeStopwords: number,
    outOffsetsPtr: number,
    outLengthsPtr: number,
    capacity: number,
  ) => bigint;
};

export type AsciiMetrics = {
  tokens: number;
  uniqueTokens: number;
  ngrams: number;
  uniqueNgrams: number;
};

type PoolBlock = {
  ptr: number;
  bytes: number;
};

function toNumber(v: number | bigint): number {
  return typeof v === "bigint" ? Number(v) : v;
}

export type WasmNltkInit = {
  wasmBytes?: Uint8Array;
  wasmPath?: string;
};

export class WasmNltk {
  private readonly exports: WasmExports;
  private readonly inputPtr: number;
  private readonly inputCapacity: number;
  private readonly encoder = new TextEncoder();
  private readonly decoder = new TextDecoder();
  private readonly blocks = new Map<string, PoolBlock>();

  private constructor(exports: WasmExports) {
    this.exports = exports;
    this.inputPtr = exports.bunnltk_wasm_input_ptr();
    this.inputCapacity = exports.bunnltk_wasm_input_capacity();
  }

  static async init(init: WasmNltkInit = {}): Promise<WasmNltk> {
    const wasmPath = init.wasmPath ?? resolve(import.meta.dir, "..", "native", "bun_nltk.wasm");
    const bytes = init.wasmBytes ?? readFileSync(wasmPath);
    const { instance } = await WebAssembly.instantiate(bytes, {});
    return new WasmNltk(instance.exports as unknown as WasmExports);
  }

  dispose(): void {
    for (const block of this.blocks.values()) {
      this.exports.bunnltk_wasm_free(block.ptr, block.bytes);
    }
    this.blocks.clear();
  }

  private assertNoError(context: string): void {
    const code = this.exports.bunnltk_wasm_last_error_code();
    if (code !== 0) {
      throw new Error(`wasm error code ${code} in ${context}`);
    }
  }

  private ensureBlock(key: string, bytes: number): PoolBlock {
    const existing = this.blocks.get(key);
    if (existing && existing.bytes >= bytes) return existing;
    if (existing) {
      this.exports.bunnltk_wasm_free(existing.ptr, existing.bytes);
      this.blocks.delete(key);
    }

    const ptr = this.exports.bunnltk_wasm_alloc(bytes);
    this.assertNoError(`alloc:${key}`);
    if (!ptr) throw new Error(`failed to allocate wasm block for ${key}`);

    const block = { ptr, bytes };
    this.blocks.set(key, block);
    return block;
  }

  private writeInput(text: string): number {
    const encoded = this.encoder.encode(text);
    if (encoded.length > this.inputCapacity) {
      throw new Error(`input too large for wasm input buffer: ${encoded.length} > ${this.inputCapacity}`);
    }
    const mem = new Uint8Array(this.exports.memory.buffer);
    mem.set(encoded, this.inputPtr);
    return encoded.length;
  }

  countTokensAscii(text: string): number {
    const inputLen = this.writeInput(text);
    return toNumber(this.exports.bunnltk_wasm_count_tokens_ascii(inputLen));
  }

  countNgramsAscii(text: string, n: number): number {
    const inputLen = this.writeInput(text);
    const out = toNumber(this.exports.bunnltk_wasm_count_ngrams_ascii(inputLen, n));
    this.assertNoError("countNgramsAscii");
    return out;
  }

  computeAsciiMetrics(text: string, n: number): AsciiMetrics {
    const inputLen = this.writeInput(text);
    const block = this.ensureBlock("metrics", 4 * BigUint64Array.BYTES_PER_ELEMENT);
    this.exports.bunnltk_wasm_compute_ascii_metrics(inputLen, n, block.ptr, 4);
    this.assertNoError("computeAsciiMetrics");

    const values = new BigUint64Array(this.exports.memory.buffer, block.ptr, 4);
    return {
      tokens: Number(values[0]!),
      uniqueTokens: Number(values[1]!),
      ngrams: Number(values[2]!),
      uniqueNgrams: Number(values[3]!),
    };
  }

  tokenOffsetsAscii(text: string): { total: number; offsets: Uint32Array; lengths: Uint32Array; input: Uint8Array } {
    const inputLen = this.writeInput(text);
    const total = toNumber(this.exports.bunnltk_wasm_count_tokens_ascii(inputLen));
    if (total === 0) {
      return {
        total: 0,
        offsets: new Uint32Array(0),
        lengths: new Uint32Array(0),
        input: new Uint8Array(0),
      };
    }

    const offsetsBlock = this.ensureBlock("offsets", total * Uint32Array.BYTES_PER_ELEMENT);
    const lengthsBlock = this.ensureBlock("lengths", total * Uint32Array.BYTES_PER_ELEMENT);
    const written = toNumber(
      this.exports.bunnltk_wasm_fill_token_offsets_ascii(inputLen, offsetsBlock.ptr, lengthsBlock.ptr, total),
    );
    this.assertNoError("tokenOffsetsAscii");

    return {
      total: written,
      offsets: new Uint32Array(this.exports.memory.buffer, offsetsBlock.ptr, written),
      lengths: new Uint32Array(this.exports.memory.buffer, lengthsBlock.ptr, written),
      input: new Uint8Array(this.exports.memory.buffer, this.inputPtr, inputLen),
    };
  }

  normalizedTokenOffsetsAscii(
    text: string,
    removeStopwords = true,
  ): { total: number; offsets: Uint32Array; lengths: Uint32Array; input: Uint8Array } {
    const inputLen = this.writeInput(text);
    const total = toNumber(
      this.exports.bunnltk_wasm_count_normalized_tokens_ascii(inputLen, removeStopwords ? 1 : 0),
    );
    this.assertNoError("normalizedTokenOffsetsAscii.count");

    if (total === 0) {
      return {
        total: 0,
        offsets: new Uint32Array(0),
        lengths: new Uint32Array(0),
        input: new Uint8Array(0),
      };
    }

    const offsetsBlock = this.ensureBlock("norm_offsets", total * Uint32Array.BYTES_PER_ELEMENT);
    const lengthsBlock = this.ensureBlock("norm_lengths", total * Uint32Array.BYTES_PER_ELEMENT);
    const written = toNumber(
      this.exports.bunnltk_wasm_fill_normalized_token_offsets_ascii(
        inputLen,
        removeStopwords ? 1 : 0,
        offsetsBlock.ptr,
        lengthsBlock.ptr,
        total,
      ),
    );
    this.assertNoError("normalizedTokenOffsetsAscii.fill");

    return {
      total: written,
      offsets: new Uint32Array(this.exports.memory.buffer, offsetsBlock.ptr, written),
      lengths: new Uint32Array(this.exports.memory.buffer, lengthsBlock.ptr, written),
      input: new Uint8Array(this.exports.memory.buffer, this.inputPtr, inputLen),
    };
  }

  tokenizeAscii(text: string): string[] {
    const { total, offsets, lengths, input } = this.tokenOffsetsAscii(text);
    const out = new Array<string>(total);
    for (let i = 0; i < total; i += 1) {
      const start = offsets[i]!;
      const len = lengths[i]!;
      out[i] = this.decoder.decode(input.subarray(start, start + len)).toLowerCase();
    }
    return out;
  }

  normalizeTokensAscii(text: string, removeStopwords = true): string[] {
    const { total, offsets, lengths, input } = this.normalizedTokenOffsetsAscii(text, removeStopwords);
    const out = new Array<string>(total);
    for (let i = 0; i < total; i += 1) {
      const start = offsets[i]!;
      const len = lengths[i]!;
      out[i] = this.decoder.decode(input.subarray(start, start + len)).toLowerCase();
    }
    return out;
  }
}
