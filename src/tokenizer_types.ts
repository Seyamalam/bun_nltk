export type TokenizerKind = "treebank" | "wordpunct" | "whitespace" | "blankline" | "space" | "tab" | "line";
export type BlanklineHandling = "discard" | "keep" | "discard-eof";
/** Python-compatible Unicode code-point offsets (not JavaScript slice offsets). */
export type TokenSpan = [number, number];
export type TokenizerOptions = { convertParentheses?: boolean; blanklines?: BlanklineHandling };
export type TokenizerRequest = {
  kind: TokenizerKind | "treebank-detokenize";
  text?: string;
  tokens?: readonly string[];
  spans?: boolean;
  convert_parentheses?: boolean;
  blanklines?: BlanklineHandling;
};
