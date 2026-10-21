/** Punkt inference: TypeScript only loads/marshals; Rust/WASM finds boundaries. */
import type { PunktModelSerialized } from "./punkt";
import { RustPunktTokenizer, type PunktSpan } from "./punkt_wasm";
import { punktRuntime } from "./punkt_runtime";

export function punktSpans(text: string, model: PunktModelSerialized, realignBoundaries = true): PunktSpan[] {
  const tokenizer = new RustPunktTokenizer(punktRuntime(), model);
  try { return tokenizer.spanTokenize(text, realignBoundaries); }
  finally { tokenizer.dispose(); }
}

export function punktSentences(text: string, model: PunktModelSerialized, realignBoundaries = true): string[] {
  return punktSpans(text, model, realignBoundaries).map(([start, end]) => text.slice(start, end));
}
