import { tokenizerRuntime } from "./tokenizer_runtime.ts";
import type { WasmNltk } from "./wasm.ts";
import type { TokenSpan } from "./tokenizer_types.ts";

/** NLTK 3.10.3 redos forwards numeric flags to regex, not stdlib re. */
export const RegexpTokenizerFlags = {
  IGNORECASE: 2, MULTILINE: 8, DOTALL: 16, UNICODE: 32, VERBOSE: 64, ASCII: 128,
} as const;
export type RegexpTokenizerOptions = {
  gaps?: boolean;
  discardEmpty?: boolean;
  discard_empty?: boolean;
  flags?: number;
};
/** Captures preserve Python findall tuples (arrays) and split's unmatched None (null). */
export type RegexpToken = string | string[] | null;
export type RegexpTokenizerRequest = {
  kind: "regexp";
  pattern: string;
  text: string;
  gaps: boolean;
  discard_empty: boolean;
  flags: number;
  spans: boolean;
};

export class RegexpTokenizer {
  private readonly pattern: string;
  private readonly gaps: boolean;
  private readonly discardEmpty: boolean;
  private readonly flags: number;

  constructor(pattern: string | { pattern: string }, gaps?: boolean | RegexpTokenizerOptions, discardEmpty?: boolean, flags?: number, runtime?: WasmNltk);
  constructor(pattern: string | { pattern: string }, options?: RegexpTokenizerOptions, runtime?: WasmNltk);
  constructor(pattern: string | { pattern: string }, gaps: boolean | RegexpTokenizerOptions = false, discardEmpty: boolean | WasmNltk = true, flags = 56, private readonly runtime?: WasmNltk) {
    this.pattern = typeof pattern === "string" ? pattern : pattern?.pattern;
    if (typeof this.pattern !== "string") throw new TypeError("pattern must be a string or an object with a string pattern");
    const options = typeof gaps === "boolean" ? { gaps, discardEmpty: typeof discardEmpty === "boolean" ? discardEmpty : true, flags } : gaps;
    this.gaps = options.gaps ?? false;
    this.discardEmpty = options.discardEmpty ?? options.discard_empty ?? true;
    this.flags = options.flags ?? 56;
    if (typeof discardEmpty !== "boolean") this.runtime = discardEmpty;
    if (typeof this.gaps !== "boolean" || typeof this.discardEmpty !== "boolean") throw new TypeError("gaps and discardEmpty must be booleans");
    if (!Number.isSafeInteger(this.flags) || this.flags < 0 || this.flags > 0xffffffff) throw new RangeError("flags must be a uint32 integer");
    // Compilation stays lazy, like NLTK: syntax errors surface on tokenize/spans.
  }

  private request(text: string, spans: boolean): unknown {
    if (typeof text !== "string") throw new TypeError("text must be a string");
    return (this.runtime ?? tokenizerRuntime()).regexpTokenizer({
      kind: "regexp", pattern: this.pattern, text, gaps: this.gaps,
      discard_empty: this.discardEmpty, flags: this.flags, spans,
    });
  }
  tokenize(text: string): RegexpToken[] { return this.request(text, false) as RegexpToken[]; }
  spanTokenize(text: string): TokenSpan[] { return this.request(text, true) as TokenSpan[]; }
  span_tokenize(text: string): TokenSpan[] { return this.spanTokenize(text); }
  tokenizeSents(texts: readonly string[]): RegexpToken[][] { return texts.map((text) => this.tokenize(text)); }
  tokenize_sents(texts: readonly string[]): RegexpToken[][] { return this.tokenizeSents(texts); }
  spanTokenizeSents(texts: readonly string[]): TokenSpan[][] { return texts.map((text) => this.spanTokenize(text)); }
  span_tokenize_sents(texts: readonly string[]): TokenSpan[][] { return this.spanTokenizeSents(texts); }
}

export function regexpTokenize(text: string, pattern: string | { pattern: string }, gaps: boolean | RegexpTokenizerOptions = false, discardEmpty = true, flags = 56): RegexpToken[] {
  return new RegexpTokenizer(pattern, gaps, discardEmpty, flags).tokenize(text);
}
export { regexpTokenize as regexp_tokenize };
