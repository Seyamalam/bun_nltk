// Port of nltk.tokenize.nltk.NLTKWordTokenizer (NLTK 3.10.3) — the improved
// destructive word tokenizer behind word_tokenize(). Regex tables are
// translated 1:1; Python (?i) groups map to `i` and re.sub is global (`g` flag).
import { align_tokens } from "./tokenizers_treebank";

type Subst = [RegExp, string];

export class NLTKWordTokenizer {
  // Starting quotes.
  static readonly STARTING_QUOTES: Subst[] = [
    [/([«“‘„]|[`]+)/gu, " $1 "],
    [/^"/g, "``"],
    [/(``)/g, " $1 "],
    [/([ ([{<])("|'{2})/g, "$1 `` "],
    [/(?<![\p{L}\p{N}_])(')(?!(?:re|ve|ll|m|t|s|d|n)(?![\p{L}\p{N}_]))(?=[\p{L}\p{N}_])/giu, "$1 "],
  ];

  // Ending quotes.
  static readonly ENDING_QUOTES: Subst[] = [
    [/([»”’])/gu, " $1 "],
    [/''/g, " '' "],
    [/"/g, " '' "],
    [/\s+/g, " "],
    [/([^' ])('[sS]|'[mM]|'[dD]|') /g, "$1 $2 "],
    [/([^' ])('ll|'LL|'re|'RE|'ve|'VE|n't|N'T) /g, "$1 $2 "],
  ];

  // Punctuation.
  static readonly PUNCTUATION: Subst[] = [
    [/([^.])(\.)([\]}>"'»”’]*)\s*$/gu, "$1 $2 $3 "],
    [/([:,])([^\d])/g, " $1 $2"],
    [/([:,])$/g, " $1 "],
    [/\.{2,}/gu, " $& "],
    [/[;@#$%&]/g, " $& "],
    [/[‒-―]/gu, " $& "],
    [/([^.])(\.)([\]}>"']*)\s*$/g, "$1 $2$3 "],
    [/[?!]/g, " $& "],
    [/([^'])' /g, "$1 ' "],
    [/\*/gu, " $& "],
  ];

  // Pads parentheses.
  static readonly PARENS_BRACKETS: Subst = [/[\][(){}<>\]]/g, " $& "];

  // Optionally convert parentheses to PTB symbols.
  static readonly CONVERT_PARENTHESES: Subst[] = [
    [/\(/g, "-LRB-"], [/\)/g, "-RRB-"],
    [/\[/g, "-LSB-"], [/]/g, "-RSB-"],
    [/[{]/g, "-LCB-"], [/}]/g, "-RCB-"],
  ];

  static readonly DOUBLE_DASHES: Subst = [/--/g, " -- "];

  // Python \b is Unicode-aware; JS \b is ASCII-only. Emulate with
  // lookarounds on the Unicode word class [\p{L}\p{N}_].
  static readonly CONTRACTIONS2: RegExp[] = [
    /(?<![\p{L}\p{N}_])(can)(not)(?![\p{L}\p{N}_])/giu, /(?<![\p{L}\p{N}_])(d)('ye)(?![\p{L}\p{N}_])/giu,
    /(?<![\p{L}\p{N}_])(gim)(me)(?![\p{L}\p{N}_])/giu, /(?<![\p{L}\p{N}_])(gon)(na)(?![\p{L}\p{N}_])/giu,
    /(?<![\p{L}\p{N}_])(got)(ta)(?![\p{L}\p{N}_])/giu, /(?<![\p{L}\p{N}_])(lem)(me)(?![\p{L}\p{N}_])/giu,
    /(?<![\p{L}\p{N}_])(more)('n)(?![\p{L}\p{N}_])/giu, /(?<![\p{L}\p{N}_])(wan)(na)(?=\s)/giu,
  ];
  static readonly CONTRACTIONS3: RegExp[] = [/ ('t)(is)(?![\p{L}\p{N}_])/giu, / ('t)(was)(?![\p{L}\p{N}_])/giu];
  static readonly CONTRACTIONS4: RegExp[] = [/(?<![\p{L}\p{N}_])(whad)(dd)(ya)(?![\p{L}\p{N}_])/giu, /(?<![\p{L}\p{N}_])(wha)(t)(cha)(?![\p{L}\p{N}_])/giu];

  tokenize(text: string, convertParentheses?: boolean, returnStr?: boolean): string[] | string;
  tokenize(text: string, convert_parentheses?: boolean, return_str?: boolean): string[] | string;
  tokenize(text: string, convertParentheses = false, returnStr = false): string[] | string {
    if (returnStr) console.warn("Parameter 'return_str' has been deprecated and should no longer be used.");
    for (const [re, sub] of NLTKWordTokenizer.STARTING_QUOTES) text = text.replace(re, sub);
    for (const [re, sub] of NLTKWordTokenizer.PUNCTUATION) text = text.replace(re, sub);
    const [parenRe, parenSub] = NLTKWordTokenizer.PARENS_BRACKETS;
    text = text.replace(parenRe, parenSub);
    if (convertParentheses) {
      for (const [re, sub] of NLTKWordTokenizer.CONVERT_PARENTHESES) text = text.replace(re, sub);
    }
    const [dashRe, dashSub] = NLTKWordTokenizer.DOUBLE_DASHES;
    text = text.replace(dashRe, dashSub);
    text = " " + text + " ";
    for (const [re, sub] of NLTKWordTokenizer.ENDING_QUOTES) text = text.replace(re, sub);
    for (const re of NLTKWordTokenizer.CONTRACTIONS2) text = text.replace(re, " $1 $2 ");
    for (const re of NLTKWordTokenizer.CONTRACTIONS3) text = text.replace(re, " $1 $2 ");
    return text.trim().split(/\s+/).filter((t) => t.length > 0);
  }

  *span_tokenize(text: string): Generator<[number, number]> {
    const rawTokens = this.tokenize(text) as string[];
    let tokens = rawTokens;
    if (text.includes('"') || text.includes("''")) {
      const matched = [...text.matchAll(/``|'{2}|"/g)].map((m) => m[0]);
      let mi = 0;
      tokens = rawTokens.map((tok) => (tok === '"' || tok === "``" || tok === "''") ? matched[mi++]! : tok);
    }
    yield* align_tokens(tokens, text);
  }

  *spanTokenize(text: string): Generator<[number, number]> {
    yield* this.span_tokenize(text);
  }

  tokenize_sents(strings: readonly string[]): string[][] {
    return strings.map((s) => this.tokenize(s) as string[]);
  }

  *span_tokenize_sents(strings: readonly string[]): Generator<[number, number][]> {
    for (const s of strings) yield [...this.span_tokenize(s)];
  }
}
