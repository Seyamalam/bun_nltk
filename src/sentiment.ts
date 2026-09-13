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
export type VaderOptions = { lexicon?: Record<string, number> };

const isUpper = pythonIsUpper;

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

function wordsAndEmoticons(text: string): string[] {
  const words = new Set(
    splitPythonWhitespace(text.replace(ASCII_PUNCTUATION, "")).filter((w) => [...w].length > 1),
  );
  const punctuation = new Map<string, string>();
  for (const p of data.punctuation) for (const word of words) punctuation.set(p + word, word);
  for (const word of words) for (const p of data.punctuation) punctuation.set(word + p, word);
  return splitPythonWhitespace(text)
    .filter((w) => [...w].length > 1)
    .map((w) => punctuation.get(w) ?? w);
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
  private readonly lexicon: Readonly<Record<string, number>>;

  constructor(options: VaderOptions = {}) {
    // Keep the existing additive override contract.
    this.lexicon = options.lexicon ? { ...DEFAULT_LEXICON, ...options.lexicon } : DEFAULT_LEXICON;
  }

  polarityScores(text: string): VaderPolarity {
    const words = wordsAndEmoticons(text);
    const capCount = words.filter(isUpper).length;
    const mixedCaps = capCount > 0 && capCount < words.length;
    const firstIndex = new Map<string, number>();
    words.forEach((word, i) => {
      if (!firstIndex.has(word)) firstIndex.set(word, i);
    });
    const sentiments = words.map((word) => {
      // NLTK intentionally uses the first occurrence for repeated tokens.
      const i = firstIndex.get(word)!;
      const key = word.toLowerCase();
      if (
        (key === "kind" && words[i + 1]?.toLowerCase() === "of") ||
        Object.hasOwn(BOOSTERS, key) ||
        !Object.hasOwn(this.lexicon, key)
      )
        return 0;
      let valence = this.lexicon[key]!;
      if (isUpper(word) && mixedCaps) valence += valence > 0 ? 0.733 : -0.733;
      for (let distance = 0; distance < 3; distance += 1) {
        if (i <= distance || Object.hasOwn(this.lexicon, words[i - distance - 1]!.toLowerCase()))
          continue;
        valence +=
          scalar(words[i - distance - 1]!, valence, mixedCaps) *
          (distance === 1 ? 0.95 : distance === 2 ? 0.9 : 1);
        valence = neverCheck(valence, words, distance, i);
        if (distance === 2) valence = idiomsCheck(valence, words, i);
      }
      if (
        i > 0 &&
        words[i - 1]!.toLowerCase() === "least" &&
        !Object.hasOwn(this.lexicon, "least")
      ) {
        if (i === 1 || !["at", "very"].includes(words[i - 2]!.toLowerCase())) valence *= -0.74;
      }
      return valence;
    });
    const but = words.findIndex((word) => word.toLowerCase() === "but");
    if (but >= 0)
      for (let i = 0; i < sentiments.length; i += 1)
        sentiments[i]! *= i < but ? 0.5 : i > but ? 1.5 : 1;
    return scoreValence(sentiments, text);
  }
}
