/** Model marshaling and UTF-8/UTF-16 offset conversion; inference runs in Rust. */
import type { PunktModelSerialized } from "./punkt";
import type { WasmNltk } from "./wasm";

export function encodePunktModel(model: PunktModelSerialized): Uint8Array {
  if (model.version < 2) throw new RangeError("Rust Punkt requires a version 2 model");
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  let length = 0;
  const integer = (value: number) => {
    if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) throw new RangeError("invalid Punkt model integer");
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, value, true);
    parts.push(bytes);
    length += 4;
  };
  const string = (value: string) => {
    if (typeof value !== "string") throw new TypeError("Punkt model keys must be strings");
    const bytes = encoder.encode(value);
    integer(bytes.length);
    parts.push(bytes);
    length += bytes.length;
  };
  integer(1);
  integer(model.abbreviations.length);
  for (const value of model.abbreviations) string(value);
  integer(model.collocations.length);
  for (const [left, right] of model.collocations) { string(left); string(right); }
  integer(model.sentenceStarters.length);
  for (const value of model.sentenceStarters) string(value);
  const ortho = Object.entries(model.orthoContext ?? {});
  integer(ortho.length);
  for (const [key, value] of ortho) { string(key); integer(value); }
  if (length > 0xffffffff) throw new RangeError("Punkt model exceeds uint32 size");
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

export type PunktSpan = [start: number, end: number];

/** Owns a snapshot of caller-supplied NLTK parameters in a WASM instance. */
export class RustPunktTokenizer {
  private readonly handle: number;
  private disposed = false;
  constructor(private readonly runtime: WasmNltk, model: PunktModelSerialized) {
    this.handle = runtime.punktLoad(encodePunktModel(model));
  }

  /** UTF-8 byte spans, suitable for slicing the encoded input. */
  byteSpans(text: string, realignBoundaries = true): PunktSpan[] {
    if (this.disposed) throw new Error("Punkt tokenizer has been disposed");
    const flat = this.runtime.punktSpans(this.handle, text, realignBoundaries);
    const result: PunktSpan[] = [];
    for (let i = 0; i < flat.length; i += 2) result.push([flat[i]!, flat[i + 1]!]);
    return result;
  }

  /** JavaScript UTF-16 spans (not Python code-point or UTF-8 offsets). */
  spanTokenize(text: string, realignBoundaries = true): PunktSpan[] {
    const spans = this.byteSpans(text, realignBoundaries);
    const boundaries = new Set(spans.flat());
    const offsets = new Map<number, number>([[0, 0]]);
    let byte = 0, utf16 = 0;
    for (const char of text) {
      const cp = char.codePointAt(0)!;
      byte += cp <= 0x7f ? 1 : cp <= 0x7ff ? 2 : cp <= 0xffff ? 3 : 4;
      utf16 += char.length;
      if (boundaries.has(byte)) offsets.set(byte, utf16);
    }
    return spans.map(([start, end]) => [offsets.get(start)!, offsets.get(end)!]);
  }

  tokenize(text: string, realignBoundaries = true): string[] {
    return this.spanTokenize(text, realignBoundaries).map(([start, end]) => text.slice(start, end));
  }

  dispose(): void {
    if (this.disposed) return;
    this.runtime.punktFree(this.handle);
    this.disposed = true;
  }
}
