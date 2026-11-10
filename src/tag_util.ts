/**
 * Port of nltk.tag.util (str2tuple, tuple2str) and nltk.tag.pos_tag_sents.
 */
import { posTag } from "./parser_tagger_compat";
import { pyError } from "./internals";

/**
 * Given the string representation of a tagged token, return the
 * corresponding tuple representation.  The rightmost occurrence of
 * `sep` in `s` is used to divide `s` into a word string and a tag
 * string.  If `sep` does not occur in `s`, return `[s, null]`.
 *
 * NLTK upper-cases the tag: `str2tuple('fly/nn') -> ('fly','NN')`.
 */
export function str2tuple(s: string, sep = "/"): [string, string | null] {
  const loc = s.lastIndexOf(sep);
  if (loc >= 0) {
    return [s.slice(0, loc), s.slice(loc + sep.length).toUpperCase()];
  }
  return [s, null];
}

/**
 * Given the tuple representation of a tagged token, return the
 * corresponding string representation: `word + sep + tag`.  If the
 * tag is null, return the bare word string.
 */
export function tuple2str(taggedToken: readonly [string, string | null], sep = "/"): string {
  const [word, tag] = taggedToken;
  if (tag === null || tag === undefined) {
    return word;
  }
  if (tag.includes(sep)) {
    throw pyError("AssertionError", "tag may not contain sep!");
  }
  return `${word}${sep}${tag}`;
}

/**
 * Use NLTK's currently recommended part of speech tagger to tag the
 * given list of sentences, each consisting of a list of tokens.
 *
 * The `tagset`/`lang` keyword arguments of the Python signature are
 * accepted but ignored (the bundled perceptron model is always used).
 */
export function pos_tag_sents(
  sentences: Iterable<readonly string[]>,
  _options?: { tagset?: string; lang?: string },
): Array<Array<[string, string]>> {
  void _options;
  return [...sentences].map((sent) => posTag([...sent]));
}
export const posTagSents = pos_tag_sents;
