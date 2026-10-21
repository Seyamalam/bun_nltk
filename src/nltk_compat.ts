import { sentenceTokenizePunkt } from "./punkt.ts";
import { ngramsIterator, wordpunctNltk, wordTokenizeNltk, type NgramOptions } from "./nltk_compat_runtime.ts";
export type { NgramOptions } from "./nltk_compat_runtime.ts";

function requireText(text: string): void {
  if (typeof text !== "string") throw new TypeError("text must be a string");
}

function requireEnglish(language: string): void {
  if (language !== "english") {
    throw new Error(`only the bundled English Punkt model is available (requested ${JSON.stringify(language)})`);
  }
}

/** NLTK-compatible sentence tokenizer backed by the bundled English Punkt model. */
export function sent_tokenize(text: string, language = "english"): string[] {
  requireEnglish(language);
  requireText(text);
  return sentenceTokenizePunkt(text);
}

/** NLTK word tokenizer: Punkt sentences followed by the destructive word tokenizer. */
export function word_tokenize(text: string, language = "english", preserve_line = false): string[] {
  requireText(text);
  if (preserve_line) return wordTokenizeNltk(text);
  requireEnglish(language);
  return sentenceTokenizePunkt(text).flatMap((sentence) => wordTokenizeNltk(sentence));
}

/** NLTK-compatible word-punctuation tokenizer. */
export function wordpunct_tokenize(text: string): string[] {
  return wordpunctNltk(text);
}

/** Materialized NLTK windows; preserves the existing array-returning API. */
export function ngrams<T>(sequence: Iterable<T>, n: number): T[][];
export function ngrams<T, P>(sequence: Iterable<T>, n: number, options: NgramOptions<P>): Array<Array<T | P | null>>;
export function ngrams<T, P = null>(sequence: Iterable<T>, n: number, options: NgramOptions<P> = {}): Array<Array<T | P | null>> {
  return Array.from(ngramsIterator(sequence, n, options));
}

export function bigrams<T>(sequence: Iterable<T>): T[][];
export function bigrams<T, P>(sequence: Iterable<T>, options: NgramOptions<P>): Array<Array<T | P | null>>;
export function bigrams<T, P = null>(sequence: Iterable<T>, options: NgramOptions<P> = {}): Array<Array<T | P | null>> {
  return ngrams(sequence, 2, options);
}

export function trigrams<T>(sequence: Iterable<T>): T[][];
export function trigrams<T, P>(sequence: Iterable<T>, options: NgramOptions<P>): Array<Array<T | P | null>>;
export function trigrams<T, P = null>(sequence: Iterable<T>, options: NgramOptions<P> = {}): Array<Array<T | P | null>> {
  return ngrams(sequence, 3, options);
}

export { ngramsIterator as ngrams_iter };
