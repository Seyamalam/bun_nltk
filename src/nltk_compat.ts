import { sentenceTokenizePunkt } from "./punkt.ts";
import { treebankWordTokenize, wordPunctTokenize } from "./tokenizers.ts";

function requireEnglish(language: string): void {
  if (language !== "english") {
    throw new Error(`only the bundled English Punkt model is available (requested ${JSON.stringify(language)})`);
  }
}

/** NLTK-compatible sentence tokenizer backed by the bundled English Punkt model. */
export function sent_tokenize(text: string, language = "english"): string[] {
  requireEnglish(language);
  return sentenceTokenizePunkt(text);
}

/** NLTK-compatible word tokenizer: sentence splitting followed by Treebank tokenization. */
export function word_tokenize(text: string, language = "english", preserve_line = false): string[] {
  requireEnglish(language);
  if (preserve_line) return treebankWordTokenize(text);
  return sentenceTokenizePunkt(text).flatMap((sentence) => treebankWordTokenize(sentence));
}

/** NLTK-compatible word-punctuation tokenizer. */
export function wordpunct_tokenize(text: string): string[] {
  return wordPunctTokenize(text);
}

/** NLTK's ngrams helper. Returns an array of n-length slices. */
export function ngrams<T>(sequence: Iterable<T>, n: number): T[][] {
  if (!Number.isInteger(n) || n <= 0) throw new Error("n must be a positive integer");
  const values = [...sequence];
  const out: T[][] = [];
  for (let index = 0; index + n <= values.length; index += 1) out.push(values.slice(index, index + n));
  return out;
}

export function bigrams<T>(sequence: Iterable<T>): T[][] {
  return ngrams(sequence, 2);
}

export function trigrams<T>(sequence: Iterable<T>): T[][] {
  return ngrams(sequence, 3);
}
