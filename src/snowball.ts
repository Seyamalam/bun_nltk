/**
 * Snowball (Porter2-family) stemmers — public barrel.
 *
 * Implementation lives in per-language modules under src/snowball/
 * (ported line-for-line from NLTK's nltk/stem/snowball.py, which itself is a
 * Python translation of the Snowball spec at http://snowball.tartarus.org/).
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

export { stemDanish } from "./snowball/danish";
export { stemDutch } from "./snowball/dutch";
export { stemEnglish } from "./snowball/english";
export { stemFrench } from "./snowball/french";
export { stemGerman } from "./snowball/german";
export { stemItalian } from "./snowball/italian";
export { stemNorwegian } from "./snowball/norwegian";
export { stemPortuguese } from "./snowball/portuguese";
export { stemRomanian } from "./snowball/romanian";
export { stemRussian } from "./snowball/russian";
export { stemSpanish } from "./snowball/spanish";
export { stemSwedish } from "./snowball/swedish";

import { stemDanish } from "./snowball/danish";
import { stemDutch } from "./snowball/dutch";
import { stemEnglish } from "./snowball/english";
import { stemFrench } from "./snowball/french";
import { stemGerman } from "./snowball/german";
import { stemItalian } from "./snowball/italian";
import { stemNorwegian } from "./snowball/norwegian";
import { stemPortuguese } from "./snowball/portuguese";
import { stemRomanian } from "./snowball/romanian";
import { stemRussian } from "./snowball/russian";
import { stemSpanish } from "./snowball/spanish";
import { stemSwedish } from "./snowball/swedish";

// ---------------------------------------------------------------------------
// Registry / public API
// ---------------------------------------------------------------------------

export const SNOWBALL_LANGUAGES = [
  "danish",
  "dutch",
  "english",
  "french",
  "german",
  "italian",
  "norwegian",
  "portuguese",
  "romanian",
  "russian",
  "spanish",
  "swedish",
] as const;

export type SnowballLanguage = (typeof SNOWBALL_LANGUAGES)[number];

const SNOWBALL_STEMMERS: Record<string, (word: string) => string> = {
  danish: stemDanish,
  dutch: stemDutch,
  english: stemEnglish,
  french: stemFrench,
  german: stemGerman,
  italian: stemItalian,
  norwegian: stemNorwegian,
  portuguese: stemPortuguese,
  romanian: stemRomanian,
  russian: stemRussian,
  spanish: stemSpanish,
  swedish: stemSwedish,
};

/**
 * Stem `word` with the NLTK-compatible Snowball stemmer for `language`.
 *
 * Throws an Error (mirroring NLTK's ValueError) when the language is not
 * supported. Each language's algorithm lowercases internally (except
 * Russian, which does not lowercase — matching NLTK exactly).
 */
export function snowballStem(word: string, language: string): string {
  const key = language.toLowerCase();
  const stemmer = SNOWBALL_STEMMERS[key];
  if (!stemmer) {
    throw new Error(`The language '${language}' is not supported.`);
  }
  return stemmer(word);
}

export function isSnowballLanguage(language: string): boolean {
  return Object.prototype.hasOwnProperty.call(SNOWBALL_STEMMERS, language.toLowerCase());
}
