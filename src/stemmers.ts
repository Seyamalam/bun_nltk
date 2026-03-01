import { porterStemAscii } from "./native";
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

export class SnowballStemmer {
  readonly language: string;
  private readonly lancaster = new LancasterStemmer();

  constructor(language = "english") {
    this.language = language.toLowerCase();
  }

  stem(word: string): string {
    const norm = normalize(word);
    if (!norm) return norm;

    // English path uses Porter as default NLTK-like stemmer family baseline.
    if (this.language === "english" && /^[\x00-\x7F]+$/.test(norm)) {
      return porterStemAscii(norm);
    }

    // Fallback aggressive suffix-stripping for unsupported languages.
    return this.lancaster.stem(norm);
  }
}

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

