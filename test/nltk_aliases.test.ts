import { expect, test } from "bun:test";
import * as api from "../index";

test("generated NLTK snake_case aliases mirror camelCase exports", () => {
  const pairs: Array<[string, string]> = [
    ["word_tokenize_subset", "wordTokenizeSubset"],
    ["count_tokens_ascii", "countTokensAscii"],
    ["count_unique_ngrams_ascii", "countUniqueNgramsAscii"],
    ["ngram_freq_dist_hash_ascii", "ngramFreqDistHashAscii"],
    ["sentence_tokenize_punkt_ascii_native", "sentenceTokenizePunktAsciiNative"],
    ["naive_bayes_log_scores_ids_native", "naiveBayesLogScoresIdsNative"],
    ["treebank_word_tokenize", "treebankWordTokenize"],
    ["word_punct_tokenize", "wordPunctTokenize"],
  ];
  const exported = api as unknown as Record<string, unknown>;
  for (const [alias, original] of pairs) {
    expect(exported[alias], alias).toBe(exported[original]);
  }
});
