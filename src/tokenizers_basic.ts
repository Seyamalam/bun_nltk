import { tokenizerRuntime } from "./tokenizer_runtime.ts";
import type { WasmNltk } from "./wasm.ts";
import type { BlanklineHandling, TokenizerKind, TokenSpan } from "./tokenizer_types.ts";
export type { BlanklineHandling, TokenSpan } from "./tokenizer_types.ts";

class RustTokenizer {
  constructor(private readonly kind: TokenizerKind, private readonly runtime?: WasmNltk) {}
  protected blanklines: BlanklineHandling = "discard";
  tokenize(text: string): string[] {
    return (this.runtime ?? tokenizerRuntime()).tokenize(text, this.kind, { blanklines: this.blanklines });
  }
  spanTokenize(text: string): TokenSpan[] {
    return (this.runtime ?? tokenizerRuntime()).tokenizerSpans(text, this.kind, { blanklines: this.blanklines });
  }
  span_tokenize(text: string): TokenSpan[] { return this.spanTokenize(text); }
  tokenizeSents(texts: readonly string[]): string[][] { return texts.map((text) => this.tokenize(text)); }
  tokenize_sents(texts: readonly string[]): string[][] { return this.tokenizeSents(texts); }
  spanTokenizeSents(texts: readonly string[]): TokenSpan[][] { return texts.map((text) => this.spanTokenize(text)); }
  span_tokenize_sents(texts: readonly string[]): TokenSpan[][] { return this.spanTokenizeSents(texts); }
}

export class WhitespaceTokenizer extends RustTokenizer {
  constructor(runtime?: WasmNltk) { super("whitespace", runtime); }
}
export class BlanklineTokenizer extends RustTokenizer {
  constructor(runtime?: WasmNltk) { super("blankline", runtime); }
}
export class SpaceTokenizer extends RustTokenizer {
  constructor(runtime?: WasmNltk) { super("space", runtime); }
}
export class TabTokenizer extends RustTokenizer {
  constructor(runtime?: WasmNltk) { super("tab", runtime); }
}
export class LineTokenizer extends RustTokenizer {
  constructor(blanklines: BlanklineHandling = "discard", runtime?: WasmNltk) {
    super("line", runtime);
    if (!["discard", "keep", "discard-eof"].includes(blanklines)) throw new RangeError("blanklines must be discard, keep, or discard-eof");
    this.blanklines = blanklines;
  }
}

export function lineTokenize(text: string, blanklines: BlanklineHandling = "discard"): string[] {
  return new LineTokenizer(blanklines).tokenize(text);
}
export function blanklineTokenize(text: string): string[] { return new BlanklineTokenizer().tokenize(text); }
export { lineTokenize as line_tokenize, blanklineTokenize as blankline_tokenize };
