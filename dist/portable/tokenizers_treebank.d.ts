import { WasmNltk } from './wasm.js';
import { TokenSpan } from './tokenizer_types.js';
import './metrics_wasm.js';

declare class TreebankWordTokenizer {
    private readonly runtime?;
    constructor(runtime?: WasmNltk | undefined);
    tokenize(text: string, convertParentheses?: boolean, _returnStr?: boolean): string[];
    spanTokenize(text: string): TokenSpan[];
    span_tokenize(text: string): TokenSpan[];
    tokenizeSents(texts: readonly string[]): string[][];
    tokenize_sents(texts: readonly string[]): string[][];
    spanTokenizeSents(texts: readonly string[]): TokenSpan[][];
    span_tokenize_sents(texts: readonly string[]): TokenSpan[][];
}
declare class WordPunctTokenizer {
    private readonly runtime?;
    constructor(runtime?: WasmNltk | undefined);
    tokenize(text: string): string[];
    spanTokenize(text: string): TokenSpan[];
    span_tokenize(text: string): TokenSpan[];
    tokenizeSents(texts: readonly string[]): string[][];
    tokenize_sents(texts: readonly string[]): string[][];
    spanTokenizeSents(texts: readonly string[]): TokenSpan[][];
    span_tokenize_sents(texts: readonly string[]): TokenSpan[][];
}
declare class TreebankWordDetokenizer {
    private readonly runtime?;
    constructor(runtime?: WasmNltk | undefined);
    detokenize(tokens: readonly string[], convertParentheses?: boolean): string;
    tokenize(tokens: readonly string[], convertParentheses?: boolean): string;
    tokenizeSents(texts: readonly (readonly string[])[]): string[];
    tokenize_sents(texts: readonly (readonly string[])[]): string[];
}
declare function treebankWordTokenize(text: string): string[];
declare function wordPunctTokenize(text: string): string[];

export { TreebankWordDetokenizer, TreebankWordTokenizer, WordPunctTokenizer, treebankWordTokenize, wordPunctTokenize };
