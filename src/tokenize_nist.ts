/**
 * NIST tokenizer (port of nltk.tokenize.nist.NISTTokenizer).
 *
 * Sentence-based port of mteval-v14.pl tokenization. Uses the bundled
 * perluniprops character-class data for the international path.
 */

import { pupNumber, pupPunct, pupSymbol, pupNumberEscaped, pupPunctEscaped, pupSymbolEscaped } from "./perluniprops_data";

function escClass(s: string): string {
  return s.replace(/[]^\\-]/g, (m) => "\\" + m);
}

const pupNumberClass = pupNumberEscaped || escClass(pupNumber);
const pupPunctClass = pupPunctEscaped || escClass(pupPunct);
const pupSymbolClass = pupSymbolEscaped || escClass(pupSymbol);

function xmlUnescape(s: string): string {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/&apos;/g, "'").replace(/&quot;/g, '"');
}

export class NISTTokenizer {
  private static STRIP_SKIP: [RegExp, string] = [/<skipped>/g, ""];
  private static STRIP_EOL_HYPHEN: [RegExp, string] = [/\u2028/g, " "];
  // PUNCT pattern from NLTK nist.py: ([\\{-\\~\\[-\\` -\\&\\(-\\+\\:-\\@\\/])
  private static PUNCT: [RegExp, string] = [new RegExp("([\\{-\\~\\[-\\` -\\&\\(-\\+\\:-\\@\\/])", "g"), " $1 "];
  private static PERIOD_COMMA_PRECEED: [RegExp, string] = [new RegExp("([^0-9])([\\.,])", "g"), "$1 $2 "];
  private static PERIOD_COMMA_FOLLOW: [RegExp, string] = [new RegExp("([\\.,])([^0-9])", "g"), " $1 $2"];
  private static DASH_PRECEED_DIGIT: [RegExp, string] = [new RegExp("([0-9])(-)", "g"), "$1 $2 "];
  private static LANG_DEPENDENT: Array<[RegExp, string]> = [
    NISTTokenizer.PUNCT,
    NISTTokenizer.PERIOD_COMMA_PRECEED,
    NISTTokenizer.PERIOD_COMMA_FOLLOW,
    NISTTokenizer.DASH_PRECEED_DIGIT,
  ];

  private static NONASCII: [RegExp, string] = [new RegExp("([\\x00-\\x7f]+)", "g"), " $1 "];
  private static PUNCT_1: [RegExp, string] = [new RegExp("([" + pupNumberClass + "])([" + pupPunctClass + "])", "g"), "$1 $2 "];
  private static PUNCT_2: [RegExp, string] = [new RegExp("([" + pupPunctClass + "])([" + pupNumberClass + "])", "g"), " $1 $2"];
  private static SYMBOLS: [RegExp, string] = [new RegExp("([" + pupSymbolClass + "])", "g"), " $1 "];
  private static INTERNATIONAL: Array<[RegExp, string]> = [
    NISTTokenizer.NONASCII,
    NISTTokenizer.PUNCT_1,
    NISTTokenizer.PUNCT_2,
    NISTTokenizer.SYMBOLS,
  ];

  private langIndependentSub(text: string): string {
    let t = text.replace(NISTTokenizer.STRIP_SKIP[0], NISTTokenizer.STRIP_SKIP[1]);
    t = xmlUnescape(t);
    t = t.replace(NISTTokenizer.STRIP_EOL_HYPHEN[0], NISTTokenizer.STRIP_EOL_HYPHEN[1]);
    return t;
  }

  tokenize(text: string, opts: { lowercase?: boolean; westernLang?: boolean; returnStr?: boolean } = {}): string[] | string {
    const { lowercase = false, westernLang = true, returnStr = false } = opts;
    let t = String(text);
    t = this.langIndependentSub(t);
    if (westernLang) {
      t = " " + t + " ";
      if (lowercase) t = t.toLowerCase();
      for (const [re, sub] of NISTTokenizer.LANG_DEPENDENT) t = t.replace(re, sub);
    }
    t = t.split(/\\s+/).filter(Boolean).join(" ");
    t = t.trim();
    return returnStr ? t : t ? t.split(/\s+/).filter(Boolean) : [];
  }

  internationalTokenize(
    text: string,
    opts: { lowercase?: boolean; splitNonAscii?: boolean; returnStr?: boolean } = {},
  ): string[] | string {
    const { lowercase = false, returnStr = false } = opts;
    let t = String(text);
    t = t.replace(NISTTokenizer.STRIP_SKIP[0], NISTTokenizer.STRIP_SKIP[1]);
    t = t.replace(NISTTokenizer.STRIP_EOL_HYPHEN[0], NISTTokenizer.STRIP_EOL_HYPHEN[1]);
    t = xmlUnescape(t);
    if (lowercase) t = t.toLowerCase();
    for (const [re, sub] of NISTTokenizer.INTERNATIONAL) t = t.replace(re, sub);
    t = t.trim().split(/\\s+/).filter(Boolean).join(" ");
    return returnStr ? t : t ? t.split(/\s+/).filter(Boolean) : [];
  }
}

export function nistTokenize(text: string, lowercase = false): string[] {
  return new NISTTokenizer().tokenize(text, { lowercase }) as string[];
}
export function nistInternationalTokenize(text: string, lowercase = false): string[] {
  return new NISTTokenizer().internationalTokenize(text, { lowercase }) as string[];
}
