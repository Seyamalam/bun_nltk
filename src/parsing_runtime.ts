type ParsingExports = {
  memory: WebAssembly.Memory;
  bunnltk_wasm_alloc: (size: number) => number;
  bunnltk_wasm_free: (ptr: number, size: number) => void;
  bunnltk_parsing_request: (ptr: number, size: number) => number;
  bunnltk_parsing_result_ptr: () => number;
  bunnltk_parsing_result_len: () => number;
  bunnltk_parsing_release: () => void;
};

/** Portable, independently loaded parsing ABI. No Bun FFI or JS algorithm fallback. */
export class ParsingRuntime {
  private disposed = false;
  private constructor(private readonly exports: ParsingExports) {}

  static async load(options: { wasmBytes?: Uint8Array; wasmPath?: string; wasmUrl?: string } = {}): Promise<ParsingRuntime> {
    let bytes = options.wasmBytes;
    if (!bytes) {
      const relative = import.meta.url.includes("/dist/portable/") ? "../../native/bun_nltk.wasm" : "../native/bun_nltk.wasm";
      const url = new URL(options.wasmUrl ?? relative, import.meta.url);
      if (options.wasmPath !== undefined || url.protocol === "file:") {
        const { readFile } = await import("node:fs/promises");
        bytes = await readFile(options.wasmPath ?? url);
      } else {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`failed to fetch parsing WASM: ${response.status}`);
        bytes = new Uint8Array(await response.arrayBuffer());
      }
    }
    const { instance } = await WebAssembly.instantiate(Uint8Array.from(bytes), {});
    for (const name of ["bunnltk_wasm_alloc", "bunnltk_wasm_free", "bunnltk_parsing_request", "bunnltk_parsing_result_ptr", "bunnltk_parsing_result_len", "bunnltk_parsing_release"]) {
      if (typeof instance.exports[name] !== "function") throw new Error("incompatible parsing WASM artifact: rebuild from rust/Cargo.toml");
    }
    if (!(instance.exports.memory instanceof WebAssembly.Memory)) throw new Error("parsing WASM has no memory export");
    return new ParsingRuntime(instance.exports as unknown as ParsingExports);
  }

  /** Internal typed marshaling boundary; only dedicated parsing classes issue requests. */
  request<T>(request: object): T {
    if (this.disposed) throw new Error("parsing runtime has been disposed");
    const bytes = new TextEncoder().encode(JSON.stringify(request));
    if (bytes.length > 16 * 1024 * 1024) throw new RangeError("parsing request exceeds 16 MiB");
    const ptr = this.exports.bunnltk_wasm_alloc(bytes.length);
    if (!ptr) throw new Error("parsing WASM allocation failed");
    try {
      new Uint8Array(this.exports.memory.buffer, ptr, bytes.length).set(bytes);
      const status = this.exports.bunnltk_parsing_request(ptr, bytes.length);
      const output = new Uint8Array(this.exports.memory.buffer, this.exports.bunnltk_parsing_result_ptr(), this.exports.bunnltk_parsing_result_len());
      const envelope = JSON.parse(new TextDecoder().decode(output)) as { value: T; error?: string };
      if (status !== 0) throw new Error(envelope.error ?? "Rust parsing request failed");
      return envelope.value;
    } finally {
      this.exports.bunnltk_wasm_free(ptr, bytes.length);
      this.exports.bunnltk_parsing_release();
    }
  }

  dispose(): void {
    if (!this.disposed) this.exports.bunnltk_parsing_release();
    this.disposed = true;
  }
}
