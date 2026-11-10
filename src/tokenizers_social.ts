import { socialTokenizerRuntime } from "./tokenizer_runtime.ts";
import type { WasmNltk } from "./wasm.ts";
import type { TokenSpan } from "./tokenizer_types.ts";

export type TweetTokenizerOptions = {
  preserveCase?: boolean; stripHandles?: boolean; reduceLen?: boolean; matchPhoneNumbers?: boolean;
  preserve_case?: boolean; strip_handles?: boolean; reduce_len?: boolean; match_phone_numbers?: boolean;
};
export type SocialTokenizerRequest = {
  kind: "tweet" | "toktok" | "mwe";
  text?: string; tokens?: readonly string[]; mwes?: readonly (readonly string[])[]; separator?: string;
  mwe_updates?: readonly { tokens: readonly string[]; remove?: boolean }[];
  preserve_case?: boolean; strip_handles?: boolean; reduce_len?: boolean; match_phone_numbers?: boolean;
  return_str?: boolean; spans?: boolean;
};
function strings(tokens: readonly string[]): void {
  if (!Array.isArray(tokens) || tokens.some((token) => typeof token !== "string")) throw new TypeError("tokens must be an array of strings");
}

export class TweetTokenizer {
  preserveCase: boolean; stripHandles: boolean; reduceLen: boolean; matchPhoneNumbers: boolean;
  constructor(opts: TweetTokenizerOptions = {}, private readonly runtime?: WasmNltk) {
    this.preserveCase = opts.preserveCase ?? opts.preserve_case ?? true;
    this.stripHandles = opts.stripHandles ?? opts.strip_handles ?? false;
    this.reduceLen = opts.reduceLen ?? opts.reduce_len ?? false;
    this.matchPhoneNumbers = opts.matchPhoneNumbers ?? opts.match_phone_numbers ?? true;
  }
  get preserve_case(): boolean { return this.preserveCase; }
  set preserve_case(value: boolean) { this.preserveCase = value; }
  get strip_handles(): boolean { return this.stripHandles; }
  set strip_handles(value: boolean) { this.stripHandles = value; }
  get reduce_len(): boolean { return this.reduceLen; }
  set reduce_len(value: boolean) { this.reduceLen = value; }
  get match_phone_numbers(): boolean { return this.matchPhoneNumbers; }
  set match_phone_numbers(value: boolean) { this.matchPhoneNumbers = value; }
  tokenize(text: string): string[] {
    return (this.runtime ?? socialTokenizerRuntime()).socialTokenizer({ kind: "tweet", text,
      preserve_case: this.preserveCase, strip_handles: this.stripHandles, reduce_len: this.reduceLen,
      match_phone_numbers: this.matchPhoneNumbers }) as string[];
  }
  tokenizeSents(texts: readonly string[]): string[][] { return texts.map((text) => this.tokenize(text)); }
  tokenize_sents(texts: readonly string[]): string[][] { return this.tokenizeSents(texts); }
  spanTokenize(text: string): TokenSpan[] {
    (this.runtime ?? socialTokenizerRuntime()).socialTokenizer({ kind: "tweet", text, spans: true });
    throw new Error("TweetTokenizer does not implement span_tokenize");
  }
  span_tokenize(text: string): TokenSpan[] { return this.spanTokenize(text); }
  spanTokenizeSents(texts: readonly string[]): TokenSpan[][] { return texts.map((text) => this.spanTokenize(text)); }
  span_tokenize_sents(texts: readonly string[]): TokenSpan[][] { return this.spanTokenizeSents(texts); }
}

export class ToktokTokenizer {
  constructor(private readonly runtime?: WasmNltk) {}
  tokenize(text: string, returnStr?: false): string[];
  tokenize(text: string, returnStr: true): string;
  tokenize(text: string, returnStr: boolean): string[] | string;
  tokenize(text: string, returnStr = false): string[] | string {
    return (this.runtime ?? socialTokenizerRuntime()).socialTokenizer({ kind: "toktok", text, return_str: returnStr });
  }
  tokenizeSents(texts: readonly string[]): string[][] { return texts.map((text) => this.tokenize(text)); }
  tokenize_sents(texts: readonly string[]): string[][] { return this.tokenizeSents(texts); }
  spanTokenize(text: string): TokenSpan[] {
    (this.runtime ?? socialTokenizerRuntime()).socialTokenizer({ kind: "toktok", text, spans: true });
    throw new Error("ToktokTokenizer does not implement span_tokenize");
  }
  span_tokenize(text: string): TokenSpan[] { return this.spanTokenize(text); }
  spanTokenizeSents(texts: readonly string[]): TokenSpan[][] { return texts.map((text) => this.spanTokenize(text)); }
  span_tokenize_sents(texts: readonly string[]): TokenSpan[][] { return this.spanTokenizeSents(texts); }
}

export class MWETokenizer {
  private readonly updates: { tokens: string[]; remove?: boolean }[] = [];
  constructor(mwes: readonly (readonly string[])[] = [], private readonly separator = "_", private readonly runtime?: WasmNltk) {
    if (typeof separator !== "string") throw new TypeError("separator must be a string");
    for (const phrase of mwes) this.addMwe(phrase);
  }
  addMwe(tokens: readonly string[]): void { strings(tokens); this.updates.push({ tokens: [...tokens] }); }
  add_mwe(tokens: readonly string[]): void { this.addMwe(tokens); }
  /** Extension: remove exact token sequences (NLTK 3.10.3 has no remove_mwe). */
  removeMwe(tokens: readonly string[]): void {
    strings(tokens);
    this.updates.push({ tokens: [...tokens], remove: true });
  }
  remove_mwe(tokens: readonly string[]): void { this.removeMwe(tokens); }
  tokenize(tokens: readonly string[]): string[] {
    strings(tokens);
    return (this.runtime ?? socialTokenizerRuntime()).socialTokenizer({ kind: "mwe", tokens, mwe_updates: this.updates, separator: this.separator }) as string[];
  }
  tokenizeSents(texts: readonly (readonly string[])[]): string[][] { return texts.map((text) => this.tokenize(text)); }
  tokenize_sents(texts: readonly (readonly string[])[]): string[][] { return this.tokenizeSents(texts); }
  spanTokenize(tokens: readonly string[]): TokenSpan[] {
    strings(tokens);
    (this.runtime ?? socialTokenizerRuntime()).socialTokenizer({ kind: "mwe", tokens, spans: true });
    throw new Error("MWETokenizer does not implement span_tokenize");
  }
  span_tokenize(tokens: readonly string[]): TokenSpan[] { return this.spanTokenize(tokens); }
  spanTokenizeSents(texts: readonly (readonly string[])[]): TokenSpan[][] { return texts.map((text) => this.spanTokenize(text)); }
  span_tokenize_sents(texts: readonly (readonly string[])[]): TokenSpan[][] { return this.spanTokenizeSents(texts); }
}

export { TweetTokenizer as RustTweetTokenizer, ToktokTokenizer as RustToktokTokenizer, MWETokenizer as RustMWETokenizer };
export function tweetTokenize(text: string, opts: TweetTokenizerOptions = {}): string[] { return new TweetTokenizer(opts).tokenize(text); }
export function toktokTokenize(text: string): string[] { return new ToktokTokenizer().tokenize(text); }
export function mweTokenize(tokens: readonly string[], mwes: readonly (readonly string[])[], separator = "_"): string[] { return new MWETokenizer(mwes, separator).tokenize(tokens); }
export function casualTokenize(text: string, preserveCase = true, reduceLen = false, stripHandles = false, matchPhoneNumbers = true): string[] {
  return tweetTokenize(text, { preserveCase, reduceLen, stripHandles, matchPhoneNumbers });
}
export { tweetTokenize as tweet_tokenize, toktokTokenize as toktok_tokenize, mweTokenize as mwe_tokenize, casualTokenize as casual_tokenize };

const HANDLES_RE = /(?<![A-Za-z0-9_!@#$%&*])@(([A-Za-z0-9_]){15}(?!@)|([A-Za-z0-9_]){1,14}(?![A-Za-z0-9_]*@))/g;

export function reduce_lengthening(text: string): string {
  return text.replace(/(.)\1{2,}/g, "$1$1$1");
}

export function remove_handles(text: string): string {
  return text.replace(HANDLES_RE, " ");
}
