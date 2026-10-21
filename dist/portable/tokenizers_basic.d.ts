import { WasmNltk } from './wasm.js';
import { TokenizerKind, BlanklineHandling, TokenSpan } from './tokenizer_types.js';
import './metrics_wasm.js';

declare class RustTokenizer {
    private readonly kind;
    private readonly runtime?;
    constructor(kind: TokenizerKind, runtime?: WasmNltk | undefined);
    protected blanklines: BlanklineHandling;
    tokenize(text: string): string[];
    spanTokenize(text: string): TokenSpan[];
    span_tokenize(text: string): TokenSpan[];
    tokenizeSents(texts: readonly string[]): string[][];
    tokenize_sents(texts: readonly string[]): string[][];
    spanTokenizeSents(texts: readonly string[]): TokenSpan[][];
    span_tokenize_sents(texts: readonly string[]): TokenSpan[][];
}
declare class WhitespaceTokenizer extends RustTokenizer {
    constructor(runtime?: WasmNltk);
}
declare class BlanklineTokenizer extends RustTokenizer {
    constructor(runtime?: WasmNltk);
}
declare class SpaceTokenizer extends RustTokenizer {
    constructor(runtime?: WasmNltk);
}
declare class TabTokenizer extends RustTokenizer {
    constructor(runtime?: WasmNltk);
}
declare class LineTokenizer extends RustTokenizer {
    constructor(blanklines?: BlanklineHandling, runtime?: WasmNltk);
}
declare function lineTokenize(text: string, blanklines?: BlanklineHandling): string[];
declare function blanklineTokenize(text: string): string[];

export { type BlanklineHandling, BlanklineTokenizer, LineTokenizer, SpaceTokenizer, TabTokenizer, type TokenSpan, WhitespaceTokenizer, blanklineTokenize, blanklineTokenize as blankline_tokenize, lineTokenize, lineTokenize as line_tokenize };
