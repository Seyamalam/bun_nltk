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

export class MacIntyreContractions {
  static readonly CONTRACTIONS2 = [
    "(i)\\b(can)(not)\\b",
    "(i)\\b(d)('ye)\\b",
    "(i)\\b(gim)(me)\\b",
    "(i)\\b(gon)(na)\\b",
    "(i)\\b(got)(ta)\\b",
    "(i)\\b(lem)(me)\\b",
    "(i)\\b(more)('n)\\b",
    "(i)\\b(wan)(na)(?=\\s)",
  ];
  static readonly CONTRACTIONS3 = ["(i) ('t)(is)\\b", "(i) ('t)(was)\\b"];
  static readonly CONTRACTIONS4 = ["(i)\\b(whad)(dd)(ya)\\b", "(i)\\b(wha)(t)(cha)\\b"];
}

export function* align_tokens(tokens: readonly string[], sentence: string): Generator<TokenSpan> {
  let point = 0;
  for (const token of tokens) {
    const start = sentence.indexOf(token, point);
    if (start === -1) throw new Error(`substring "${token}" not found in "${sentence}"`);
    point = start + token.length;
    yield [start, point];
  }
}
