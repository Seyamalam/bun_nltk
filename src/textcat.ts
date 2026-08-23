/**
 * Language identification using the TextCat algorithm
 * (nltk.classify.textcat) — a port of Cavnar & Trenkle,
 * "N-Gram-Based Text Categorization".
 *
 * FIDELITY NOTES (checked against nltk/classify/textcat.py):
 * - NLTK's implementation profiles character TRIGRAMS only, despite the
 *   original paper describing n-grams of length 1..5. The task brief's
 *   "NGRAM_RANGE 1-5" refers to the paper; NLTK's code uses
 *   `trigrams(START_CHAR + token + END_CHAR)`, so we match NLTK exactly.
 * - Tokens are padded with `<` (start) and `>` (end) characters.
 * - Punctuation is removed except apostrophes (`remove_punctuation`).
 * - Distance is the "out-of-place" measure; trigrams missing from a language
 *   profile contribute sys.maxsize each (we use Number.MAX_SAFE_INTEGER).
 * - `guess_language` returns None on ties and when every language is
 *     equidistant (uninformative input); `return_all=True` mirrors that with [].
 *
 * DEVIATION FROM NLTK: NLTK loads pre-ranked n-gram frequency files from the
 * An Crubadan corpus directory. We cannot ship that corpus, so this port
 * instead TRAINS language profiles from samples supplied by the caller:
 * `new TextCat({ languages: { eng: ["sample text", ...], ... } })`. Profiles
 * are frequency-ranked trigram distributions (count desc, then first-seen
 * order), matching the ranking semantics of Crubadan freq files.
 */
import { treebankWordTokenize } from "./tokenizers";

const START_CHAR = "<";
const END_CHAR = ">";
/** NLTK penalty for a trigram absent from a language profile (sys.maxsize). */
const MAXSIZE = Number.MAX_SAFE_INTEGER;

export type TextCatOptions = {
  /** Language name/code -> sample texts used to train that language's profile. */
  languages: Record<string, string[]>;
};

export type LanguageDistance = {
  language: string;
  distance: number;
};

function removePunctuation(text: string): string {
  // Get rid of punctuation except apostrophes (NLTK uses \P{P} unicode props).
  return [...text]
    .filter((ch) => ch === "'" || !/\p{P}/u.test(ch))
    .join("");
}

function charTrigrams(padded: string): string[] {
  const out: string[] = [];
  if (padded.length < 3) return out;
  for (let i = 0; i + 2 < padded.length; i += 1) out.push(padded.slice(i, i + 3));
  return out;
}

/** Frequency-ordered profile: trigram -> count, in insertion (first-seen) order. */
function buildDistribution(text: string): Map<string, number> {
  const fingerprint = new Map<string, number>();
  const cleanText = removePunctuation(text);
  const tokens = treebankWordTokenize(cleanText);
  for (const t of tokens) {
    for (const tri of charTrigrams(`${START_CHAR}${t}${END_CHAR}`)) {
      fingerprint.set(tri, (fingerprint.get(tri) ?? 0) + 1);
    }
  }
  return fingerprint;
}

/** Rank map (trigram -> index) ordered by count desc, ties by first-seen order. */
function rankProfile(freq: Map<string, number>): Map<string, number> {
  const entries = [...freq.entries()];
  const firstSeen = new Map(entries.map(([tri], i) => [tri, i] as const));
  entries.sort((a, b) => (b[1] !== a[1] ? b[1] - a[1] : firstSeen.get(a[0])! - firstSeen.get(b[0])!));
  return new Map(entries.map(([tri], i) => [tri, i] as const));
}

export class TextCat {
  readonly fingerprints: Map<string, Map<string, number>>;
  lastDistances: Record<string, number> = {};

  constructor(options: TextCatOptions) {
    this.fingerprints = new Map();
    for (const [language, samples] of Object.entries(options.languages)) {
      const merged = new Map<string, number>();
      for (const sample of samples) {
        for (const [tri, count] of buildDistribution(sample)) {
          merged.set(tri, (merged.get(tri) ?? 0) + count);
        }
      }
      this.fingerprints.set(language, rankProfile(merged));
    }
  }

  /** Create frequency distribution of trigrams within text (NLTK `profile`). */
  profile(text: string): Map<string, number> {
    return buildDistribution(text);
  }

  /**
   * Out-of-place measure between the text and one language profile
   * (NLTK `calc_dist`, using the rank-precomputation optimization NLTK added).
   */
  calcDist(langRanks: Map<string, number>, textRanks: Map<string, number>, trigram: string): number {
    const langIdx = langRanks.get(trigram);
    const textIdx = textRanks.get(trigram);
    if (langIdx === undefined || textIdx === undefined) return MAXSIZE;
    return Math.abs(langIdx - textIdx);
  }

  /** Distances between the text and all trained languages (NLTK `lang_dists`). */
  langDists(text: string): Record<string, number> {
    const distances: Record<string, number> = {};
    const profile = buildDistribution(text);
    const textRanks = rankProfile(profile);
    for (const [lang, langRanks] of this.fingerprints) {
      let dist = 0;
      for (const trigram of profile.keys()) {
        dist += this.calcDist(langRanks, textRanks, trigram);
      }
      distances[lang] = dist;
    }
    return distances;
  }

  /**
   * Most likely language for the text. Returns null/[] when ambiguous or
   * unclassifiable, mirroring `guess_language` semantics.
   */
  guessLanguage(text: string, returnAll = false): string | null | string[] {
    this.lastDistances = this.langDists(text);
    const langs = Object.keys(this.lastDistances);
    if (langs.length === 0) return returnAll ? [] : null;

    let minDist = Infinity;
    for (const lang of langs) minDist = Math.min(minDist, this.lastDistances[lang]!);

    const candidates = langs.filter((lang) => this.lastDistances[lang] === minDist);
    // All languages match equally -> uninformative.
    if (candidates.length === langs.length) return returnAll ? [] : null;

    if (returnAll) return candidates;
    return candidates.length === 1 ? candidates[0]! : null;
  }
}
