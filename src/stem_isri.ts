/**
 * ISRI Arabic stemmer (port of nltk.stem.isri.ISRIStemmer).
 *
 * A root-based stemmer implementing the ISRI algorithm with a few
 * enhancements (Taghva et al.). Includes the stop-word list and all
 * pattern tables from NLTK.
 */

const reShortVowels = /[\u064B-\u0652]/g;
const reInitialHamza = /^[\u0622\u0623\u0625]/;

// length three prefixes
const P3 = ["\u0643\u0627\u0644", "\u0628\u0627\u0644", "\u0648\u0644\u0644", "\u0648\u0627\u0644"];
// length two prefixes
const P2 = ["\u0627\u0644", "\u0644\u0644"];
// length one prefixes
const P1 = ["\u0644", "\u0628", "\u0641", "\u0633", "\u0648", "\u064a", "\u062a", "\u0646", "\u0627"];

// length three suffixes
const S3 = ["\u062a\u0645\u0644", "\u0647\u0645\u0644", "\u062a\u0627\u0646", "\u062a\u064a\u0646", "\u0643\u0645\u0644"];
// length two suffixes
const S2 = [
  "\u0648\u0646", "\u0627\u062a", "\u0627\u0646", "\u064a\u0646", "\u062a\u0646",
  "\u0643\u0645", "\u0647\u0646", "\u0646\u0627", "\u064a\u0627", "\u0647\u0627",
  "\u062a\u0645", "\u0643\u0646", "\u0646\u064a", "\u0648\u0627", "\u0645\u0627", "\u0647\u0645",
];
// length one suffixes
const S1 = ["\u0629", "\u0647", "\u064a", "\u0643", "\u062a", "\u0627", "\u0646"];

// groups of length four patterns
const PR4: Record<number, string[]> = {
  0: ["\u0645"],
  1: ["\u0627"],
  2: ["\u0627", "\u0648", "\u064a"],
  3: ["\u0629"],
};

// Groups of length five patterns and length three roots
const PR53: Record<number, string[]> = {
  0: ["\u0627", "\u062a"],
  1: ["\u0627", "\u064a", "\u0648"],
  2: ["\u0627", "\u062a", "\u0645"],
  3: ["\u0645", "\u064a", "\u062a"],
  4: ["\u0645", "\u062a"],
  5: ["\u0627", "\u0648"],
  6: ["\u0627", "\u0645"],
};

export const ISRI_STOP_WORDS = [
  "\u064a\u0643\u0648\u0646", "\u0648\u0644\u064a\u0633", "\u0648\u0643\u0627\u0646", "\u0643\u0630\u0644\u0643",
  "\u0627\u0644\u062a\u064a", "\u0648\u0628\u064a\u0646", "\u0639\u0644\u064a\u0647\u0627", "\u0645\u0633\u0627\u0621",
  "\u0627\u0644\u0630\u064a", "\u0648\u0643\u0627\u0646\u062a", "\u0648\u0644\u0643\u0646", "\u0648\u0627\u0644\u062a\u064a",
  "\u062a\u0643\u0648\u0646", "\u0627\u0644\u064a\u0648\u0645", "\u0627\u0644\u0644\u0630\u064a\u0646", "\u0639\u0644\u064a\u0647",
  "\u0643\u0627\u0646\u062a", "\u0644\u0630\u0644\u0643", "\u0623\u0645\u0627\u0645", "\u0647\u0646\u0627\u0643",
  "\u0645\u0646\u0647\u0627", "\u0645\u0627\u0632\u0627\u0644", "\u0644\u0627\u0632\u0627\u0644", "\u0644\u0627\u064a\u0632\u0627\u0644",
  "\u0645\u0627\u064a\u0632\u0627\u0644", "\u0627\u0635\u0628\u062d", "\u0623\u0635\u0628\u062d", "\u0623\u0645\u0633\u0649",
  "\u0627\u0645\u0633\u0649", "\u0623\u0636\u062d\u0649", "\u0627\u0636\u062d\u0649", "\u0645\u0627\u0628\u0631\u062d",
  "\u0645\u0627\u0641\u062a\u0626", "\u0645\u0627\u0627\u0646\u0641\u0643", "\u0644\u0627\u0633\u064a\u0645\u0627",
  "\u0648\u0644\u0627\u064a\u0632\u0627\u0644", "\u0627\u0644\u062d\u0627\u0644\u064a", "\u0627\u0644\u064a\u0647\u0627",
  "\u0627\u0644\u0630\u064a\u0646", "\u0641\u0627\u0646\u0647", "\u0648\u0627\u0644\u0630\u064a", "\u0648\u0647\u0630\u0627",
  "\u0644\u0647\u0630\u0627", "\u0641\u0643\u0627\u0646", "\u0633\u062a\u0643\u0648\u0646", "\u0627\u0644\u064a\u0647",
  "\u064a\u0645\u0643\u0646", "\u0628\u0647\u0630\u0627", "\u0627\u0644\u0630\u0649",
];

export class ISRIStemmer {
  private readonly stopWords: Set<string>;

  /** @param stopWords optional custom stop-word list (default: bundled ISRI list) */
  constructor(stopWords: string[] = ISRI_STOP_WORDS) {
    this.stopWords = new Set(stopWords);
  }

  /**
   * Normalization.
   * num=1 strip diacritics; num=2 normalize initial hamza; num=3 both.
   */
  norm(word: string, mode: 1 | 2 | 3 = 3): string {
    if (mode === 1) return word.replace(reShortVowels, "");
    if (mode === 2) return word.replace(reInitialHamza, "\u0627");
    return word.replace(reShortVowels, "").replace(reInitialHamza, "\u0627");
  }

  /** Remove length-three then length-two prefixes. */
  pre32(word: string): string {
    if (word.length >= 6) for (const p of P3) if (word.startsWith(p)) return word.slice(3);
    if (word.length >= 5) for (const p of P2) if (word.startsWith(p)) return word.slice(2);
    return word;
  }

  /** Remove length-three then length-two suffixes. */
  suf32(word: string): string {
    if (word.length >= 6) for (const s of S3) if (word.endsWith(s)) return word.slice(0, -3);
    if (word.length >= 5) for (const s of S2) if (word.endsWith(s)) return word.slice(0, -2);
    return word;
  }

  /** Remove connective Waaw when it precedes a word beginning with Waaw. */
  waw(word: string): string {
    if (word.length >= 4 && word.slice(0, 2) === "\u0648\u0648") return word.slice(1);
    return word;
  }

  private suf1(word: string): string {
    for (const s of S1) if (word.endsWith(s)) return word.slice(0, -1);
    return word;
  }

  private pre1(word: string): string {
    for (const p of P1) if (word.startsWith(p)) return word.slice(1);
    return word;
  }

  /** Length-4 patterns. */
  proW4(word: string): string {
    if (PR4[0]!.includes(word[0]!)) word = word.slice(1); // mafEal
    else if (PR4[1]!.includes(word[1]!)) word = word.slice(0, 1) + word.slice(2); // fAEil
    else if (PR4[2]!.includes(word[2]!)) word = word.slice(0, 2) + word[3]!; // feAl/feOul/feYl
    else if (PR4[3]!.includes(word[3]!)) word = word.slice(0, -1); // feala
    else {
      word = this.suf1(word);
      if (word.length === 4) word = this.pre1(word);
    }
    return word;
  }

  /** Length-5 patterns with trilateral roots. */
  proW53(word: string): string {
    if (PR53[0]!.includes(word[2]!) && word[0] === "\u0627") word = word[1]! + word.slice(3); // iftaeal - afAal
    else if (PR53[1]!.includes(word[3]!) && word[0] === "\u0645") word = word.slice(1, 3) + word[4]; // mafOul/mafAl/mafYl
    else if (PR53[2]!.includes(word[0]!) && word[4] === "\u0629") word = word.slice(1, 4); // mafala/tafala/afala
    else if (PR53[3]!.includes(word[0]!) && word[2] === "\u062a") word = word[1]! + word.slice(3); // maftaeal/yaftaeal/taftaeal
    else if (PR53[4]!.includes(word[0]!) && word[2] === "\u0627") word = word[1]! + word.slice(3); // mafAal/tafAal
    else if (PR53[5]!.includes(word[2]!) && word[4] === "\u0629") word = word.slice(0, 2) + word[3]!; // faOula/faAla
    else if (PR53[6]!.includes(word[0]!) && word[1] === "\u0646") word = word.slice(2); // anfaeal/manfaeal
    else if (word[3] === "\u0627" && word[0] === "\u0627") word = word.slice(1, 3) + word[4]; // afAal
    else if (word[4] === "\u0646" && word[3] === "\u0627") word = word.slice(0, 3); // faalAn
    else if (word[3] === "\u064a" && word[0] === "\u062a") word = word.slice(1, 3) + word[4]; // tafYl
    else if (word[3] === "\u0648" && word[1] === "\u0627") word = word[0]! + word[2]! + word[4]!; // fAOul
    else if (word[2] === "\u0627" && word[1] === "\u0648") word = word[0]! + word.slice(3); // fWAel
    else if (word[3] === "\u0626" && word[2] === "\u0627") word = word.slice(0, 2) + word[4]; // fAAil
    else if (word[4] === "\u0629" && word[1] === "\u0627") word = word[0]! + word.slice(2, 4); // fAEala
    else if (word[4] === "\u064a" && word[2] === "\u0627") word = word.slice(0, 2) + word[3]; // faAli
    else {
      word = this.suf1(word);
      if (word.length === 5) word = this.pre1(word);
    }
    return word;
  }

  /** Length-5 patterns with quadrilateral roots. */
  proW54(word: string): string {
    if (PR53[2]!.includes(word[0]!)) word = word.slice(1); // tafaalal-afalal-mafalal
    else if (word[4] === "\u0629") word = word.slice(0, 4); // faalala
    else if (word[2] === "\u0627") word = word.slice(0, 2) + word.slice(3); // faalal
    return word;
  }

  endW5(word: string): string {
    if (word.length === 4) return this.proW4(word);
    if (word.length === 5) return this.proW54(word);
    return word;
  }

  /** Length-6 patterns. */
  proW6(word: string): string {
    if (word.startsWith("\u0627\u0633\u062a") || word.startsWith("\u0645\u0633\u062a")) word = word.slice(3); // mustafeal-istafeal
    else if (word[0] === "\u0645" && word[3] === "\u0627" && word[5] === "\u0629") word = word.slice(1, 3) + word[4]; // mafAala
    else if (word[0] === "\u0627" && word[2] === "\u062a" && word[4] === "\u0627") word = word[1]! + word[3]! + word[5]!; // ifteAal
    else if (word[0] === "\u0627" && word[3] === "\u0648" && word[2] === word[4]) word = word[1]! + word.slice(4); // af OOel
    else if (word[0] === "\u062a" && word[2] === "\u0627" && word[4] === "\u064a") word = word[1]! + word[3]! + word[5]!; // tafAYil
    else {
      word = this.suf1(word);
      if (word.length === 6) word = this.pre1(word);
    }
    return word;
  }

  /** Length-6 patterns with quadrilateral roots. */
  proW64(word: string): string {
    if (word[0] === "\u0627" && word[4] === "\u0627") word = word.slice(1, 4) + word[5]; // afleal
    else if (word.startsWith("\u0645\u062a")) word = word.slice(2); // mutafaelal
    return word;
  }

  endW6(word: string): string {
    if (word.length === 5) {
      word = this.proW53(word);
      word = this.endW5(word);
    } else if (word.length === 6) {
      word = this.proW64(word);
    }
    return word;
  }

  /** Stem a word token using the ISRI stemmer. */
  stem(token: string): string {
    token = this.norm(token, 1); // remove short-vowel diacritics
    if (this.stopWords.has(token)) return token; // exclude stop words
    token = this.pre32(token);
    token = this.suf32(token);
    token = this.waw(token);
    token = this.norm(token, 2); // normalize initial hamza to bare alif
    if (token.length === 4) {
      token = this.proW4(token);
    } else if (token.length === 5) {
      token = this.proW53(token);
      token = this.endW5(token);
    } else if (token.length === 6) {
      token = this.proW6(token);
      token = this.endW6(token);
    } else if (token.length === 7) {
      token = this.suf1(token);
      if (token.length === 7) token = this.pre1(token);
      if (token.length === 6) {
        token = this.proW6(token);
        token = this.endW6(token);
      }
    }
    return token;
  }
}
