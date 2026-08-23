/**
 * CISTEM stemmer for German (port of nltk.stem.cistem.Cistem).
 *
 * Official Python implementation of the CISTEM stemmer, based on:
 * Weissweiler & Fraser (2017), "Developing a Stemmer for German Based on a
 * Comparative Analysis of Publicly Available Stemmers" (GSCL).
 */

const STRIP_GE = /^ge(.{4,})$/;
const REPL_XX = /(.)\1/g;
const REPL_XX_BACK = /(.)\*/g;

function replaceTo(word: string): string {
  word = word.replaceAll("sch", "$");
  word = word.replaceAll("ei", "%");
  word = word.replaceAll("ie", "&");
  word = word.replace(REPL_XX, "$1*");
  return word;
}

function replaceBack(word: string): string {
  word = word.replace(REPL_XX_BACK, "$1$1");
  word = word.replaceAll("%", "ei");
  word = word.replaceAll("&", "ie");
  word = word.replaceAll("$", "sch");
  return word;
}

export class CistemStemmer {
  private readonly caseInsensitive: boolean;

  constructor(caseInsensitive = false) {
    this.caseInsensitive = caseInsensitive;
  }

  /** Stem the input word. */
  stem(word: string): string {
    if (word.length === 0) return word;

    const upper = word[0]! >= "A" && word[0]! <= "Z";
    let w = word.toLowerCase();

    w = w
      .replaceAll("ü", "u")
      .replaceAll("ö", "o")
      .replaceAll("ä", "a")
      .replaceAll("ß", "ss");

    const m = STRIP_GE.exec(w);
    if (m) w = m[1]!;

    return this.segmentInner(w, upper)[0]!;
  }

  /**
   * Like stem(), but also returns the removed suffix so that
   * stem + rest === the original word.
   */
  segment(word: string): [stem: string, rest: string] {
    if (word.length === 0) return ["", ""];

    const upper = word[0]! >= "A" && word[0]! <= "Z";
    const w = word.toLowerCase();
    return this.segmentInner(w, upper);
  }

  private segmentInner(word: string, upper: boolean): [string, string] {
    let restLength = 0;
    const wordCopy = word;

    let w = replaceTo(word);

    // Strip characters off the end per NLTK's anchored-pattern logic. A single
    // trailing newline is transparent to the patterns and preserved.
    const chars = [...w];

    const strip = (count: number): void => {
      if (chars[chars.length - 1] === "\n") {
        chars.pop();
        chars.splice(chars.length - count, count);
        chars.push("\n");
      } else {
        chars.splice(chars.length - count, count);
      }
    };

    while (chars.length > 3) {
      const j = chars[chars.length - 1] === "\n" ? chars.length - 2 : chars.length - 1;
      if (j < 1) break;
      if (chars.length > 5) {
        const cj = chars[j]!;
        const prev = chars[j - 1]!;
        if ((cj === "m" || cj === "r") && prev === "e") {
          strip(2);
          restLength += 2;
          continue;
        }
        if (cj === "d" && prev === "n") {
          strip(2);
          restLength += 2;
          continue;
        }
      }

      const cj = chars[j]!;
      if (!upper || this.caseInsensitive) {
        if (cj === "t") {
          strip(1);
          restLength += 1;
          continue;
        }
      }

      if (cj === "e" || cj === "s" || cj === "n") {
        strip(1);
        restLength += 1;
        continue;
      }
      break;
    }

    w = replaceBack(chars.join(""));

    const rest = restLength ? wordCopy.slice(wordCopy.length - restLength) : "";
    return [w, rest];
  }
}

/** Module-level convenience matching nltk usage. */
export function cistemStem(word: string, caseInsensitive = false): string {
  return new CistemStemmer(caseInsensitive).stem(word);
}
