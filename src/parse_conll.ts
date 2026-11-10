/** Ports of nltk.parse.util CONLL conversion helpers. */

/** Port of nltk.parse.util.taggedsent_to_conll: yields CONLL lines for one tagged sentence. */
export function* taggedsent_to_conll(sentence: Iterable<[string, string]>): Generator<string> {
  let i = 0;
  for (const [word, tag] of sentence) {
    i += 1;
    yield [String(i), word, "_", tag, tag, "_", "0", "a", "_", "_"].join("\t") + "\n";
  }
}

export const taggedSentToConll = taggedsent_to_conll;

/** Port of nltk.parse.util.taggedsents_to_conll: emits a blank line after each sentence. */
export function* taggedsents_to_conll(sentences: Iterable<Iterable<[string, string]>>): Generator<string> {
  for (const sent of sentences) {
    yield* taggedsent_to_conll(sent);
    yield "\n\n";
  }
}

export const taggedSentsToConll = taggedsents_to_conll;
