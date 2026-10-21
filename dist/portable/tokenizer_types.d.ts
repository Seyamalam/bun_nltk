type TokenizerKind = "treebank" | "wordpunct" | "whitespace" | "blankline" | "space" | "tab" | "line";
type BlanklineHandling = "discard" | "keep" | "discard-eof";
/** Python-compatible Unicode code-point offsets (not JavaScript slice offsets). */
type TokenSpan = [number, number];
type TokenizerOptions = {
    convertParentheses?: boolean;
    blanklines?: BlanklineHandling;
};
type TokenizerRequest = {
    kind: TokenizerKind | "treebank-detokenize";
    text?: string;
    tokens?: readonly string[];
    spans?: boolean;
    convert_parentheses?: boolean;
    blanklines?: BlanklineHandling;
};

export type { BlanklineHandling, TokenSpan, TokenizerKind, TokenizerOptions, TokenizerRequest };
