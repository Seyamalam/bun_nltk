import { SNOWBALL_LANGUAGES, snowballStem } from "./snowball";
import { SNOWBALL_STOPWORDS } from "./snowball/stopwords";
import { PorterStemmer } from "./porter_stemmer";
import { loadWordNet, type WordNetPos } from "./wordnet";

function normalize(word: string): string {
  return word.trim().toLowerCase();
}

export class RegexpStemmer {
  private readonly pattern: RegExp;
  private readonly min: number;

  constructor(pattern: RegExp | string, min = 0) {
    this.pattern = typeof pattern === "string" ? new RegExp(pattern, "i") : pattern;
    this.min = Math.max(0, Math.floor(min));
  }

  stem(word: string): string {
    if (word.length <= this.min) return word;
    return word.replace(this.pattern, "");
  }
}

type LancasterRule = {
  suffix: string;
  replacement: string;
  minLen: number;
};

// Compact aggressive subset inspired by Lancaster behavior.
const LANCASTER_RULES: LancasterRule[] = [
  { suffix: "sses", replacement: "ss", minLen: 4 },
  { suffix: "ies", replacement: "y", minLen: 4 },
  { suffix: "ied", replacement: "y", minLen: 4 },
  { suffix: "ing", replacement: "", minLen: 5 },
  { suffix: "edly", replacement: "e", minLen: 6 },
  { suffix: "ed", replacement: "", minLen: 4 },
  { suffix: "ly", replacement: "", minLen: 4 },
  { suffix: "ness", replacement: "", minLen: 6 },
  { suffix: "ment", replacement: "", minLen: 6 },
  { suffix: "tion", replacement: "t", minLen: 6 },
  { suffix: "ions", replacement: "ion", minLen: 6 },
  { suffix: "ers", replacement: "er", minLen: 5 },
  { suffix: "er", replacement: "", minLen: 5 },
  { suffix: "s", replacement: "", minLen: 4 },
];

function undouble(term: string): string {
  if (term.length < 2) return term;
  const last = term[term.length - 1]!;
  const prev = term[term.length - 2]!;
  if (last === prev && /[bdfgmnprst]/.test(last)) return term.slice(0, -1);
  return term;
}

export class LancasterStemmer {
  stem(word: string): string {
    let stem = normalize(word);
    if (!stem) return stem;

    for (const rule of LANCASTER_RULES) {
      if (!stem.endsWith(rule.suffix)) continue;
      if (stem.length < rule.minLen) continue;
      stem = stem.slice(0, -rule.suffix.length) + rule.replacement;
      stem = undouble(stem);
      break;
    }

    return stem || normalize(word);
  }
}

/**
 * NLTK-compatible Snowball stemmer backed by real Snowball (Porter2-family)
 * implementations in ./snowball. Unsupported languages throw an Error
 * (mirroring NLTK's ValueError), both at construction time and via
 * {@link snowballStem}.
 *
 * `ignoreStopwords` mirrors NLTK's `ignore_stopwords`: the language's NLTK
 * stopwords list is loaded at construction (a language without a list raises
 * the same `'<X>Stemmer> has no list of stopwords' error NLTK raises), and
 * `stem` returns a stopword unchanged (lowercased, except Russian which is
 * checked un-normalized). The `porter` language delegates to the classic
 * {@link PorterStemmer} exactly like NLTK's snowball.PorterStemmer.
 */
export class SnowballStemmer {
  static readonly languages: readonly string[] = [...SNOWBALL_LANGUAGES, "porter"];

  readonly language: string;
  readonly stopwords: Set<string>;
  readonly stemmer: { stem(word: string): string };

  constructor(language = "english", ignoreStopwords = false) {
    this.language = language.toLowerCase();
    if (!SnowballStemmer.languages.includes(this.language)) {
      throw new Error(`The language '${language}' is not supported.`);
    }
    this.stopwords = new Set();
    if (ignoreStopwords) {
      const words = SNOWBALL_STOPWORDS[this.language];
      if (!words) {
        const cls = `${this.language[0]!.toUpperCase()}${this.language.slice(1)}Stemmer`;
        throw new Error(`<${cls}> has no list of stopwords. Please set 'ignore_stopwords' to 'False'.`);
      }
      for (const word of words) this.stopwords.add(word);
    }
    this.stemmer =
      this.language === "porter"
        ? new PorterStemmer()
        : { stem: (word: string) => snowballStem(word, this.language) };
  }

  stem(word: string): string {
    const normalized = this.language === "russian" ? word : word.toLowerCase();
    if (this.stopwords.has(normalized)) return normalized;
    return this.stemmer.stem(word);
  }
}

function languageStemmer(language: string) {
  return class extends SnowballStemmer {
    constructor(ignoreStopwords = false) {
      super(language, ignoreStopwords);
    }
  };
}

export const DanishStemmer = languageStemmer("danish");
export const DutchStemmer = languageStemmer("dutch");
export const EnglishStemmer = languageStemmer("english");
export const FrenchStemmer = languageStemmer("french");
export const GermanStemmer = languageStemmer("german");
export const ItalianStemmer = languageStemmer("italian");
export const NorwegianStemmer = languageStemmer("norwegian");
export const PortugueseStemmer = languageStemmer("portuguese");
export const RomanianStemmer = languageStemmer("romanian");
export const RussianStemmer = languageStemmer("russian");
export const SpanishStemmer = languageStemmer("spanish");
export const SwedishStemmer = languageStemmer("swedish");

function normalizePos(pos?: string): WordNetPos | undefined {
  if (!pos) return undefined;
  const lower = pos.toLowerCase();
  if (lower === "n" || lower === "noun") return "n";
  if (lower === "v" || lower === "verb") return "v";
  if (lower === "a" || lower === "s" || lower === "adj" || lower === "adjective") return "a";
  if (lower === "r" || lower === "adv" || lower === "adverb") return "r";
  return undefined;
}

export class WordNetLemmatizer {
  lemmatize(word: string, pos: string = "n"): string {
    const value = normalize(word);
    if (!value) return value;
    const wnPos = normalizePos(pos);
    const lemma = loadWordNet().morphy(value, wnPos);
    return lemma ?? value;
  }
}

