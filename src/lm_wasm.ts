import type { WasmNltk } from "./wasm.ts";
import { assertOffsets, assertU32 } from "./numeric_validation.ts";

export type LmExports = {
  memory: WebAssembly.Memory;
  bunnltk_wasm_alloc(size: number): number;
  bunnltk_wasm_free(ptr: number, size: number): void;
  bunnltk_wasm_last_error_code(): number;
  bunnltk_wasm_lm_train(tokens: number, tokenCount: number, offsets: number, offsetCount: number, config: number, params: number): number;
  bunnltk_wasm_lm_vocabulary(handle: number, out: number, capacity: number): number;
  bunnltk_wasm_lm_evaluate(handle: number, flat: number, flatLen: number, lens: number, words: number, count: number, scores: number, tokens: number, tokenCount: number, perplexity: number): number;
  bunnltk_wasm_lm_free(handle: number): void;
  bunnltk_wasm_lm_clear(): void;
};

type Buffer = Uint32Array | Float64Array;

/** One compact numeric allocation per request; models/counts remain in Rust. */
export class LmWasm {
  private readonly runtime: WasmNltk;
  constructor(runtime: WasmNltk) { this.runtime = runtime; }
  private get exports(): LmExports { return this.runtime.languageModelExports(); }
  private check(wasm: LmExports): void {
    const code = wasm.bunnltk_wasm_last_error_code();
    if (code !== 0) throw new RangeError(`Rust language model rejected input (error ${code})`);
  }
  private buffers<T>(values: Buffer[], request: (wasm: LmExports, pointers: number[]) => T): T {
    const wasm = this.exports;
    const sizes = values.map((value) => Math.max(8, Math.ceil(value.byteLength / 8) * 8));
    const bytes = sizes.reduce((sum, size) => sum + size, 0);
    assertU32(bytes, "LM transport bytes", 1, 64 * 1024 * 1024);
    const ptr = wasm.bunnltk_wasm_alloc(bytes);
    if (!ptr) throw new Error("LM WASM allocation failed");
    const pointers: number[] = [];
    try {
      let cursor = ptr;
      for (const [i, value] of values.entries()) {
        pointers.push(cursor);
        new Uint8Array(wasm.memory.buffer, cursor, value.byteLength).set(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
        cursor += sizes[i]!;
      }
      return request(wasm, pointers);
    } finally { wasm.bunnltk_wasm_free(ptr, bytes); }
  }
  train(tokens: Uint32Array, offsets: Uint32Array, config: Uint32Array, params: Float64Array): number {
    assertOffsets(offsets, tokens.length, "sentence offsets");
    assertU32(tokens.length, "training tokens", 0, 1_000_000);
    if (config.length !== 7 || params.length !== 3) throw new RangeError("invalid LM configuration buffers");
    return this.buffers([tokens, offsets, config, params], (wasm, p) => {
      const handle = wasm.bunnltk_wasm_lm_train(p[0]!, tokens.length, p[1]!, offsets.length, p[2]!, p[3]!);
      this.check(wasm);
      return handle;
    });
  }
  vocabulary(handle: number): Uint32Array {
    const wasm = this.exports;
    const length = wasm.bunnltk_wasm_lm_vocabulary(handle, 0, 0);
    this.check(wasm);
    return this.buffers([new Uint32Array(length)], (wasm, p) => {
      wasm.bunnltk_wasm_lm_vocabulary(handle, p[0]!, length);
      this.check(wasm);
      return Uint32Array.from(new Uint32Array(wasm.memory.buffer, p[0]!, length));
    });
  }
  evaluate(handle: number, flat: Uint32Array, lens: Uint32Array, words: Uint32Array, tokens: Uint32Array, perplexity: boolean, logScores = false): { scores: number[]; perplexity: number } {
    assertU32(flat.length, "probe context IDs", 0, 8_000_000);
    assertU32(words.length, "probes", 0, 1_000_000);
    assertU32(tokens.length, "evaluation tokens", 0, 1_000_000);
    if (lens.length !== words.length) throw new RangeError("probe buffer length mismatch");
    return this.buffers([flat, lens, words, new Float64Array(words.length), tokens], (wasm, p) => {
      const value = wasm.bunnltk_wasm_lm_evaluate(handle, p[0]!, flat.length, p[1]!, p[2]!, words.length, p[3]!, p[4]!, tokens.length, Number(perplexity) | (Number(logScores) << 1));
      this.check(wasm);
      return { scores: Array.from(new Float64Array(wasm.memory.buffer, p[3]!, words.length)), perplexity: value };
    });
  }
  free(handle: number): void { this.exports.bunnltk_wasm_lm_free(handle); }
}
