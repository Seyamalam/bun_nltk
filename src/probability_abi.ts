import { syncWasm } from "./sync_wasm.ts";

export type ContractExports = {
  memory: WebAssembly.Memory;
  bunnltk_wasm_alloc(size: number): number;
  bunnltk_wasm_free(ptr: number, size: number): void;
  bunnltk_wasm_probability_contract(op: number, input: number, inputLength: number, output: number, outputLength: number): number;
};

/** Dedicated marshaling ABI; no probability or encoding algorithms in JS. */
export class ProbabilityContractRuntime {
  private readonly exports: ContractExports;

  constructor(input: Uint8Array | ContractExports) {
    const exports = input instanceof Uint8Array
      ? new WebAssembly.Instance(new WebAssembly.Module(input), {}).exports as unknown as ContractExports
      : input;
    if (typeof exports.bunnltk_wasm_probability_contract !== "function") {
      throw new Error("probability contract ABI is missing; rebuild the Rust WASM artifact");
    }
    this.exports = exports;
  }

  call(op: number, input: readonly number[], capacity: number): number[] {
    if (!Number.isSafeInteger(capacity) || capacity < 0 || capacity > 0x1ffffffe || input.length > 0x1ffffffe) {
      throw new RangeError("probability ABI buffer is too large");
    }
    const inputBytes = Math.max(8, input.length * 8), outputBytes = (capacity + 1) * 8;
    const ip = this.exports.bunnltk_wasm_alloc(inputBytes);
    if (ip === 0) throw new Error("unable to allocate probability input buffer");
    let optr = 0;
    try {
      optr = this.exports.bunnltk_wasm_alloc(outputBytes);
      if (optr === 0) throw new Error("unable to allocate probability output buffer");
      new Float64Array(this.exports.memory.buffer, ip, input.length).set(input);
      const length = this.exports.bunnltk_wasm_probability_contract(op, ip, input.length, optr, capacity + 1);
      if (length === 0 || length > capacity + 1) throw new RangeError("probability ABI output capacity exceeded");
      const output = new Float64Array(this.exports.memory.buffer, optr, length);
      switch (output[0]) {
        case 0: return Array.from(output.subarray(1));
        case 2: throw new RangeError("A FreqDist must have at least one sample before max is defined.");
        case 3: throw new RangeError("division by zero");
        case 4: throw new TypeError("probability is None");
        case 5: throw new RangeError("Bad feature id");
        case 6: throw new Error("model has been disposed or handle is invalid");
        default: throw new TypeError("invalid probability or feature encoding input");
      }
    } finally {
      if (optr !== 0) this.exports.bunnltk_wasm_free(optr, outputBytes);
      this.exports.bunnltk_wasm_free(ip, inputBytes);
    }
  }
}

let runtime: ProbabilityContractRuntime | undefined;
export function probabilityRuntime(): ProbabilityContractRuntime {
  return runtime ??= new ProbabilityContractRuntime(syncWasm().probabilityContractExports());
}

/** Python equality for marshaling dictionary keys (including tuples). */
export function probabilityKey(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return `number:${Number(value)}`;
  if (typeof value === "number") {
    if (Number.isNaN(value)) throw new TypeError("NaN samples are not supported by this lossless ABI");
    return `number:${value}`;
  }
  if (typeof value === "string") return `string:${JSON.stringify(value)}`;
  if (typeof value === "bigint") {
    if (value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER)) return `number:${value}`;
    return `bigint:${value}`;
  }
  if (Array.isArray(value)) return `tuple:${JSON.stringify(value.map(probabilityKey))}`;
  throw new TypeError("samples must be Python-compatible scalar values or tuples");
}
