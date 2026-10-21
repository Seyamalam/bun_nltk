import { nltkCompatWasm } from "./data/nltk-compat-wasm.ts";

type CompatExports = {
  memory: WebAssembly.Memory;
  compat_input(length: number): number;
  compat_output(): number;
  compat_porter(mode: number, lowercase: number): number;
  compat_wordpunct(): number;
  compat_word_tokenize(): number;
  compat_ngram_new(n: number, left: number, right: number): number;
  compat_ngram_next(id: number, value: number, end: number): number;
  compat_ngram_free(id: number): void;
};
let instance: CompatExports | undefined;
function runtime(): CompatExports {
  if (!instance) {
    const bytes = Uint8Array.from(atob(nltkCompatWasm), (c) => c.charCodeAt(0));
    instance = new WebAssembly.Instance(new WebAssembly.Module(bytes), {}).exports as CompatExports;
  }
  return instance;
}
function input(values: readonly number[]): CompatExports {
  const wasm = runtime();
  const ptr = wasm.compat_input(values.length);
  new Uint32Array(wasm.memory.buffer, ptr, values.length).set(values);
  return wasm;
}
function output(wasm: CompatExports, length: number): number[] {
  return Array.from(new Uint32Array(wasm.memory.buffer, wasm.compat_output(), length));
}
function codepoints(text: string): number[] {
  if (typeof text !== "string") throw new TypeError("text must be a string");
  // Preserve lone surrogates just as Python str does; UTF-8 would replace them.
  return Array.from(text, (c) => c.codePointAt(0)!);
}
export function porterNltk(token: string, mode: number, lowercase: boolean): string {
  const wasm = input(codepoints(token));
  return output(wasm, wasm.compat_porter(mode, Number(lowercase))).map((c) => String.fromCodePoint(c)).join("");
}
export function wordpunctNltk(text: string): string[] {
  const points = codepoints(text);
  const wasm = input(points);
  const spans = output(wasm, wasm.compat_wordpunct());
  const tokens: string[] = [];
  for (let i = 0; i < spans.length; i += 2) {
    tokens.push(points.slice(spans[i], spans[i + 1]).map((c) => String.fromCodePoint(c)).join(""));
  }
  return tokens;
}

export function wordTokenizeNltk(text: string): string[] {
  const wasm = input(codepoints(text));
  const data = output(wasm, wasm.compat_word_tokenize());
  const tokens: string[] = [];
  for (let i = 0; i < data.length;) {
    const size = data[i++]!;
    tokens.push(data.slice(i, i + size).map((c) => String.fromCodePoint(c)).join(""));
    i += size;
  }
  return tokens;
}

export type NgramOptions<P = null> = {
  pad_left?: boolean;
  pad_right?: boolean;
  left_pad_symbol?: P;
  right_pad_symbol?: P;
};

/** Lazy NLTK iterator semantics, with Rust-owned windows and JS object marshaling. */
export function* ngramsIterator<T, P = null>(sequence: Iterable<T>, n: number, options: NgramOptions<P> = {}): Generator<Array<T | P | null>, void, unknown> {
  // NLTK validates on first iteration; zero yields one empty tuple per boundary.
  if (!Number.isSafeInteger(n) || n < 0 || n > 0x7fffffff) throw new RangeError("n must be a nonnegative integer no larger than 2147483647");
  const iterator = sequence[Symbol.iterator]();
  const wasm = runtime();
  const handle = wasm.compat_ngram_new(n, Number(Boolean(options.pad_left)), Number(Boolean(options.pad_right)));
  if (!handle) throw new RangeError("ngram handle capacity exceeded");
  const values = new Map<number, T>();
  let id = 0;
  const decode = (): Array<T | P | null> => output(wasm, n).map((i) => {
    if (i === 0xffffffff) return options.left_pad_symbol === undefined ? null : options.left_pad_symbol;
    if (i === 0xfffffffe) return options.right_pad_symbol === undefined ? null : options.right_pad_symbol;
    return values.get(i)!;
  });
  try {
    if (wasm.compat_ngram_next(handle, 0, 2) === 1) yield decode();
    while (true) {
      const next = iterator.next();
      if (next.done) break;
      if (id >= 0xfffffffe) throw new RangeError("ngram iterator exceeds 4294967294 items");
      values.set(id, next.value);
      values.delete(id - n);
      const ready = wasm.compat_ngram_next(handle, id++, 0);
      if (ready === 1) yield decode();
    }
    while (true) {
      const state = wasm.compat_ngram_next(handle, 0, 1);
      if (state === 2) break;
      if (state === 1) yield decode();
    }
  } finally { wasm.compat_ngram_free(handle); }
}
