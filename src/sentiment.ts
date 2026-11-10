// Port of nltk.sentiment.vader (NLTK 3.10.3, Apache-2.0).
// C. J. Hutto et al.; lexicon provenance and MIT license: THIRD_PARTY_NOTICES.md.
import { pythonIsUpper, splitPythonWhitespace } from "./python_text";
import data from "./data/vader.json";

const DEFAULT_LEXICON: Readonly<Record<string, number>> = data.lexicon;
const BOOSTERS: Readonly<Record<string, number>> = data.boosters;
const IDIOMS: Readonly<Record<string, number>> = data.idioms;
const NEGATIONS = new Set(data.negations);
const ASCII_PUNCTUATION = /[!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~]/g;

export type VaderPolarity = { neg: number; neu: number; pos: number; compound: number };
export type VaderOptions = { lexicon?: Record<string, number>; lexiconFile?: string };

const isUpper = pythonIsUpper;

// nltk.sentiment.vader.SentiText — identifies sentiment-relevant properties.
export class SentiText {
  readonly text: string;
  readonly PUNC_LIST: readonly string[];
  readonly REGEX_REMOVE_PUNCTUATION: RegExp;
  readonly words_and_emoticons: string[];
  readonly is_cap_diff: boolean;

  constructor(
    text: string,
    puncList: readonly string[] = data.punctuation,
    regexRemovePunctuation: RegExp = ASCII_PUNCTUATION,
  ) {
    this.text = typeof text === "string" ? text : String(text);
    this.PUNC_LIST = puncList;
    this.REGEX_REMOVE_PUNCTUATION = regexRemovePunctuation;
    this.words_and_emoticons = this._words_and_emoticons();
    this.is_cap_diff = this.allcap_differential(this.words_and_emoticons);
  }

  private _words_plus_punc(): Map<string, string> {
    const noPuncText = this.text.replace(this.REGEX_REMOVE_PUNCTUATION, "");
    const wordsOnly = new Set(
      splitPythonWhitespace(noPuncText).filter((w) => [...w].length > 1),
    );
    const dict = new Map<string, string>();
    for (const p of this.PUNC_LIST) for (const w of wordsOnly) dict.set(p + w, w);
    for (const w of wordsOnly) for (const p of this.PUNC_LIST) dict.set(w + p, w);
    return dict;
  }

  private _words_and_emoticons(): string[] {
    const dict = this._words_plus_punc();
    return splitPythonWhitespace(this.text)
      .filter((w) => [...w].length > 1)
      .map((w) => dict.get(w) ?? w);
  }

  allcap_differential(words: readonly string[]): boolean {
    let allcapWords = 0;
    for (const word of words) if (isUpper(word)) allcapWords += 1;
    const capDifferential = words.length - allcapWords;
    return capDifferential > 0 && capDifferential < words.length;
  }
}

// nltk.sentiment.vader.VaderConstants — booster/negate data + scoring helpers.
export class VaderConstants {
  readonly B_INCR = 0.293;
  readonly B_DECR = -0.293;
  readonly C_INCR = 0.733;
  readonly N_SCALAR = -0.74;
  readonly NEGATE = NEGATIONS;
  readonly BOOSTER_DICT = BOOSTERS;
  readonly PUNC_LIST = data.punctuation;
  readonly REGEX_REMOVE_PUNCTUATION = ASCII_PUNCTUATION;

  negated(inputWords: readonly string[], includeNt = true): boolean {
    for (const word of inputWords) if (NEGATIONS.has(word.toLowerCase())) return true;
    if (includeNt) for (const word of inputWords) if (word.toLowerCase().includes("n't")) return true;
    for (let i = 0; i + 1 < inputWords.length; i += 1) {
      if (inputWords[i + 1]!.toLowerCase() === "least" && inputWords[i]!.toLowerCase() !== "at") {
        return true;
      }
    }
    return false;
  }

  normalize(score: number, alpha = 15): number {
    return score / Math.sqrt(score * score + alpha);
  }

  scalar_inc_dec(word: string, valence: number, isCapDiff: boolean): number {
    const wordLower = word.toLowerCase();
    if (!Object.hasOwn(BOOSTERS, wordLower)) return 0;
    let scalar = BOOSTERS[wordLower]!;
    if (valence < 0) scalar *= -1;
    if (isUpper(word) && isCapDiff) scalar += valence > 0 ? this.C_INCR : -this.C_INCR;
    return scalar;
  }
}

// Python round uses the exact binary value and ties-to-even, unlike toFixed.
function round(value: number, places: number): number {
  const buffer = new DataView(new ArrayBuffer(8));
  buffer.setFloat64(0, Math.abs(value));
  const bits = buffer.getBigUint64(0);
  const exponent = Number((bits >> 52n) & 2047n) - 1023 - 52;
  const mantissa = (bits & ((1n << 52n) - 1n)) | (1n << 52n);
  const scale = 10n ** BigInt(places);
  const numerator = mantissa * scale;
  if (value === 0) return 0;
  if (exponent >= 0) return value;
  const denominator = 1n << BigInt(-exponent);
  let quotient = numerator / denominator;
  const remainder = (numerator % denominator) * 2n;
  if (remainder > denominator || (remainder === denominator && quotient % 2n !== 0n))
    quotient += 1n;
  return (Math.sign(value) * Number(quotient)) / Number(scale);
}

function negated(word: string): boolean {
  return NEGATIONS.has(word.toLowerCase()) || word.toLowerCase().includes("n't");
}

function scalar(word: string, valence: number, mixedCaps: boolean): number {
  const key = word.toLowerCase();
  if (!Object.hasOwn(BOOSTERS, key)) return 0;
  let result = BOOSTERS[key]! * (valence < 0 ? -1 : 1);
  if (isUpper(word) && mixedCaps) result += valence > 0 ? 0.733 : -0.733;
  return result;
}

function neverCheck(valence: number, words: string[], distance: number, i: number): number {
  if (distance === 0) return negated(words[i - 1]!) ? valence * -0.74 : valence;
  if (distance === 1 && words[i - 2] === "never" && ["so", "this"].includes(words[i - 1]!))
    return valence * 1.5;
  // Preserve NLTK's grouping and case-sensitive special-case comparisons.
  if (
    distance === 2 &&
    ((words[i - 3] === "never" && ["so", "this"].includes(words[i - 2]!)) ||
      ["so", "this"].includes(words[i - 1]!))
  )
    return valence * 1.25;
  return negated(words[i - distance - 1]!) ? valence * -0.74 : valence;
}

function idiomsCheck(valence: number, words: string[], i: number): number {
  const sequence = (from: number, to: number) => words.slice(from, to + 1).join(" ");
  for (const phrase of [
    sequence(i - 1, i),
    sequence(i - 2, i),
    sequence(i - 2, i - 1),
    sequence(i - 3, i - 1),
    sequence(i - 3, i - 2),
  ]) {
    if (Object.hasOwn(IDIOMS, phrase)) {
      valence = IDIOMS[phrase]!;
      break;
    }
  }
  for (const end of [i + 1, i + 2]) {
    if (end < words.length && Object.hasOwn(IDIOMS, sequence(i, end)))
      valence = IDIOMS[sequence(i, end)]!;
  }
  if (
    Object.hasOwn(BOOSTERS, sequence(i - 3, i - 2)) ||
    Object.hasOwn(BOOSTERS, sequence(i - 2, i - 1))
  )
    valence -= 0.293;
  return valence;
}

function punctuationEmphasis(text: string): number {
  const exclamations = Math.min((text.match(/!/g) ?? []).length, 4);
  const questions = (text.match(/\?/g) ?? []).length;
  return exclamations * 0.292 + (questions > 3 ? 0.96 : questions > 1 ? questions * 0.18 : 0);
}

function scoreValence(sentiments: number[], text: string): VaderPolarity {
  if (!sentiments.length) return { neg: 0, neu: 0, pos: 0, compound: 0 };
  let sum = sentiments.reduce((a, b) => a + b, 0);
  const punctuation = punctuationEmphasis(text);
  sum += Math.sign(sum) * punctuation;
  let positive = 0,
    negative = 0,
    neutral = 0;
  for (const score of sentiments) {
    if (score > 0) positive += score + 1;
    else if (score < 0) negative += score - 1;
    else neutral += 1;
  }
  if (positive > Math.abs(negative)) positive += punctuation;
  else if (positive < Math.abs(negative)) negative -= punctuation;
  const total = positive + Math.abs(negative) + neutral;
  return {
    neg: round(Math.abs(negative / total), 3),
    neu: round(neutral / total, 3),
    pos: round(positive / total, 3),
    compound: round(sum / Math.sqrt(sum * sum + 15), 4),
  };
}

export class SentimentIntensityAnalyzer {
  readonly constants = new VaderConstants();
  readonly lexicon: Readonly<Record<string, number>>;
  readonly lexicon_file: string;

  constructor(lexiconFile?: string | null);
  constructor(options?: VaderOptions);
  constructor(optionsOrFile: VaderOptions | string | null = {}) {
    // Keep the existing additive override contract for {lexicon}.
    const options: VaderOptions =
      typeof optionsOrFile === "string" ? { lexiconFile: optionsOrFile } : optionsOrFile ?? {};
    this.lexicon_file = options.lexiconFile ?? "sentiment/vader_lexicon.zip/vader_lexicon/vader_lexicon.txt";
    if (options.lexiconFile != null) {
      this.lexicon = this.makeLexDict(this.resolveLexiconFile(options.lexiconFile));
    } else {
      this.lexicon = options.lexicon ? { ...DEFAULT_LEXICON, ...options.lexicon } : DEFAULT_LEXICON;
    }
  }

  private resolveLexiconFile(loc: string): string {
    // NLTK loads via nltk.data.load; we accept either file content or a path.
    if (loc.includes("\t") || loc.includes("\n")) return loc;
    try {
      const fs = require("node:fs") as typeof import("node:fs");
      return fs.readFileSync(loc, "utf8");
    } catch {
      return loc;
    }
  }

  /** NLTK ``make_lex_dict``: ``word\tmeasure`` lines → dict. */
  makeLexDict(lexiconFile?: string): Record<string, number> {
    const text = lexiconFile ?? this.resolveLexiconFile(this.lexicon_file);
    const dict: Record<string, number> = {};
    for (const line of text.split("\n")) {
      const parts = line.trim().split("\t");
      if (parts[0] !== undefined && parts[0] !== "" && parts[1] !== undefined) {
        dict[parts[0]] = Number.parseFloat(parts[1]);
      }
    }
    return dict;
  }

  make_lex_dict(): Record<string, number> {
    return this.makeLexDict();
  }

  /** NLTK ``sentiment_valence``: scores one item, appends to sentiments. */
  sentimentValence(
    valence: number,
    sentitext: SentiText,
    item: string,
    i: number,
    sentiments: number[],
  ): number[] {
    const isCapDiff = sentitext.is_cap_diff;
    const words = sentitext.words_and_emoticons;
    const itemLower = item.toLowerCase();
    if (Object.hasOwn(this.lexicon, itemLower)) {
      valence = this.lexicon[itemLower]!;
      if (isUpper(item) && isCapDiff) {
        valence += valence > 0 ? this.constants.C_INCR : -this.constants.C_INCR;
      }
      for (let distance = 0; distance < 3; distance += 1) {
        if (i <= distance || Object.hasOwn(this.lexicon, words[i - distance - 1]!.toLowerCase()))
          continue;
        valence +=
          scalar(words[i - distance - 1]!, valence, isCapDiff) *
          (distance === 1 ? 0.95 : distance === 2 ? 0.9 : 1);
        valence = neverCheck(valence, words, distance, i);
        if (distance === 2) valence = idiomsCheck(valence, words, i);
      }
      valence = this.leastCheck(valence, words, i);
    }
    sentiments.push(valence);
    return sentiments;
  }

  sentiment_valence(
    valence: number,
    sentitext: SentiText,
    item: string,
    i: number,
    sentiments: number[],
  ): number[] {
    return this.sentimentValence(valence, sentitext, item, i, sentiments);
  }

  private leastCheck(valence: number, words: readonly string[], i: number): number {
    if (
      i > 1 &&
      !Object.hasOwn(this.lexicon, words[i - 1]!.toLowerCase()) &&
      words[i - 1]!.toLowerCase() === "least"
    ) {
      if (!["at", "very"].includes(words[i - 2]!.toLowerCase())) {
        return valence * this.constants.N_SCALAR;
      }
    } else if (
      i > 0 &&
      !Object.hasOwn(this.lexicon, words[i - 1]!.toLowerCase()) &&
      words[i - 1]!.toLowerCase() === "least"
    ) {
      return valence * this.constants.N_SCALAR;
    }
    return valence;
  }

  /** NLTK ``score_valence``: sentiments → {neg,neu,pos,compound}. */
  scoreValence(sentiments: readonly number[], text: string): VaderPolarity {
    return scoreValence([...sentiments], text);
  }

  score_valence(sentiments: readonly number[], text: string): VaderPolarity {
    return this.scoreValence(sentiments, text);
  }

  polarityScores(text: string): VaderPolarity {
    const sentitext = new SentiText(text);
    const words = sentitext.words_and_emoticons;
    const firstIndex = new Map<string, number>();
    words.forEach((word, i) => {
      if (!firstIndex.has(word)) firstIndex.set(word, i);
    });
    let sentiments: number[] = [];
    for (const item of words) {
      let valence = 0;
      // NLTK intentionally uses the first occurrence for repeated tokens.
      const i = firstIndex.get(item)!;
      const key = item.toLowerCase();
      if (
        (i < words.length - 1 && key === "kind" && words[i + 1]!.toLowerCase() === "of") ||
        Object.hasOwn(BOOSTERS, key)
      ) {
        sentiments.push(valence);
        continue;
      }
      sentiments = this.sentimentValence(valence, sentitext, item, i, sentiments);
    }
    const but = words.findIndex((word) => word.toLowerCase() === "but");
    if (but >= 0)
      for (let i = 0; i < sentiments.length; i += 1)
        sentiments[i]! *= i < but ? 0.5 : i > but ? 1.5 : 1;
    return this.scoreValence(sentiments, text);
  }

  polarity_scores(text: string): VaderPolarity {
    return this.polarityScores(text);
  }
}
