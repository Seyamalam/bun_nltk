/**
 * Real Snowball (Porter2-family) stemmers, ported line-for-line from
 * NLTK's nltk/stem/snowball.py (see nltk.md in this repo), which itself is a
 * Python translation of the Snowball spec at http://snowball.tartarus.org/.
 *
 * Supported languages: danish, dutch, english, french, german, italian,
 * norwegian, portuguese, romanian, russian, spanish, swedish.
 *
 * Behavior notes:
 * - Each language stemmer lowercases its input first (exactly like NLTK;
 *   the Russian stemmer does NOT lowercase, matching NLTK).
 * - Unsupported languages throw an Error mirroring NLTK's ValueError:
 *   "The language '<language>' is not supported."
 */

export function suffixReplace(original: string, old: string, neu: string): string {
  return original.slice(0, original.length - old.length) + neu;
}

/** Python-style single-character index; returns "" when out of range. */
export function at(s: string, i: number): string {
  const idx = i < 0 ? i + s.length : i;
  return idx >= 0 && idx < s.length ? s[idx]! : "";
}

export function endsWithAny(s: string, suffixes: readonly string[]): boolean {
  return suffixes.some((suffix) => s.endsWith(suffix));
}

type Regions = { r1: string; r2: string };

export function r1r2Standard(word: string, vowels: string): Regions {
  let r1 = "";
  let r2 = "";
  for (let i = 1; i < word.length; i++) {
    if (!vowels.includes(word[i]!) && vowels.includes(word[i - 1]!)) {
      r1 = word.slice(i + 1);
      break;
    }
  }
  for (let i = 1; i < r1.length; i++) {
    if (!vowels.includes(r1[i]!) && vowels.includes(r1[i - 1]!)) {
      r2 = r1.slice(i + 1);
      break;
    }
  }
  return { r1, r2 };
}

export function rvStandard(word: string, vowels: string): string {
  let rv = "";
  if (word.length >= 2) {
    if (!vowels.includes(word[1]!)) {
      for (let i = 2; i < word.length; i++) {
        if (vowels.includes(word[i]!)) {
          rv = word.slice(i + 1);
          break;
        }
      }
    } else if (vowels.includes(word[0]!) && vowels.includes(word[1]!)) {
      for (let i = 2; i < word.length; i++) {
        if (!vowels.includes(word[i]!)) {
          rv = word.slice(i + 1);
          break;
        }
      }
    } else {
      rv = word.slice(3);
    }
  }
  return rv;
}

export function r1Scandinavian(word: string, vowels: string): string {
  let r1 = "";
  for (let i = 1; i < word.length; i++) {
    if (!vowels.includes(word[i]!) && vowels.includes(word[i - 1]!)) {
      const prefixLen = i + 1;
      if (prefixLen > 0 && prefixLen < 3) {
        r1 = word.slice(3);
      } else if (prefixLen >= 3) {
        r1 = word.slice(i + 1);
      } else {
        return word;
      }
      break;
    }
  }
  return r1;
}

