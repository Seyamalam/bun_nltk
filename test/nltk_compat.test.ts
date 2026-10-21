import { expect, test } from "bun:test";
import { bigrams, ngrams, sent_tokenize, trigrams, word_tokenize, wordpunct_tokenize } from "../src/nltk_compat";
import { sentenceTokenizePunkt } from "../src/punkt";
import { treebankWordTokenize, wordPunctTokenize } from "../src/tokenizers";
import { PorterStemmer } from "../src/porter_stemmer";

test("NLTK-compatible tokenization helpers delegate to the tested implementations", () => {
  const texts = [
    "Hello, world! I can't.",
    "One. Two! Three?",
    "Dr. Smith went home. He slept.",
    "email@example.com and 3.14",
    "",
  ];
  for (const text of texts) {
    expect(sent_tokenize(text)).toEqual(sentenceTokenizePunkt(text));
    expect(word_tokenize(text)).toEqual(sentenceTokenizePunkt(text).flatMap((sentence) => treebankWordTokenize(sentence)));
    expect(word_tokenize(text, "english", true)).toEqual(treebankWordTokenize(text));
    expect(wordpunct_tokenize(text)).toEqual(wordPunctTokenize(text));
  }
});

test("NLTK ngrams helpers and PorterStemmer wrappers", () => {
  expect(ngrams([1, 2, 3, 4], 2)).toEqual([[1, 2], [2, 3], [3, 4]]);
  expect(bigrams([1, 2, 3])).toEqual([[1, 2], [2, 3]]);
  expect(trigrams("abcd")).toEqual([["a", "b", "c"], ["b", "c", "d"]]);
  const stemmer = new PorterStemmer();
  expect(stemmer.stem("caresses")).toBe("caress");
  expect(stemmer.stem("running")).toBe("run");
  expect(stemmer.mode).toBe("NLTK_EXTENSIONS");
  expect(new PorterStemmer("ORIGINAL_ALGORITHM").stem("ties")).toBe("ti");
  expect(ngrams([1, 2], 0)).toEqual([[], [], []]);
});
