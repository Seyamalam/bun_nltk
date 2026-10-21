import { tokenizerRuntime } from "./tokenizer_runtime.ts";
import type { WasmNltk } from "./wasm.ts";
import type { TokenSpan } from "./tokenizer_types.ts";

export class TreebankWordTokenizer {
  constructor(private readonly runtime?: WasmNltk) {}
  tokenize(text: string, convertParentheses = false, _returnStr = false): string[] {
    return (this.runtime ?? tokenizerRuntime()).tokenize(text, "treebank", { convertParentheses });
  }
  spanTokenize(text: string): TokenSpan[] { return (this.runtime ?? tokenizerRuntime()).tokenizerSpans(text, "treebank"); }
  span_tokenize(text: string): TokenSpan[] { return this.spanTokenize(text); }
  tokenizeSents(texts: readonly string[]): string[][] { return texts.map((text) => this.tokenize(text)); }
  tokenize_sents(texts: readonly string[]): string[][] { return this.tokenizeSents(texts); }
  spanTokenizeSents(texts: readonly string[]): TokenSpan[][] { return texts.map((text) => this.spanTokenize(text)); }
  span_tokenize_sents(texts: readonly string[]): TokenSpan[][] { return this.spanTokenizeSents(texts); }
}

export class WordPunctTokenizer {
  constructor(private readonly runtime?: WasmNltk) {}
  tokenize(text: string): string[] { return (this.runtime ?? tokenizerRuntime()).tokenize(text, "wordpunct"); }
  spanTokenize(text: string): TokenSpan[] { return (this.runtime ?? tokenizerRuntime()).tokenizerSpans(text, "wordpunct"); }
  span_tokenize(text: string): TokenSpan[] { return this.spanTokenize(text); }
  tokenizeSents(texts: readonly string[]): string[][] { return texts.map((text) => this.tokenize(text)); }
  tokenize_sents(texts: readonly string[]): string[][] { return this.tokenizeSents(texts); }
  spanTokenizeSents(texts: readonly string[]): TokenSpan[][] { return texts.map((text) => this.spanTokenize(text)); }
  span_tokenize_sents(texts: readonly string[]): TokenSpan[][] { return this.spanTokenizeSents(texts); }
}

export class TreebankWordDetokenizer {
  constructor(private readonly runtime?: WasmNltk) {}
  detokenize(tokens: readonly string[], convertParentheses = false): string {
    return (this.runtime ?? tokenizerRuntime()).treebankDetokenize(tokens, convertParentheses);
  }
  tokenize(tokens: readonly string[], convertParentheses = false): string { return this.detokenize(tokens, convertParentheses); }
  tokenizeSents(texts: readonly (readonly string[])[]): string[] { return texts.map((tokens) => this.tokenize(tokens)); }
  tokenize_sents(texts: readonly (readonly string[])[]): string[] { return this.tokenizeSents(texts); }
}

export function treebankWordTokenize(text: string): string[] { return new TreebankWordTokenizer().tokenize(text); }
export function wordPunctTokenize(text: string): string[] { return new WordPunctTokenizer().tokenize(text); }
