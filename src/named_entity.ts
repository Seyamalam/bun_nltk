/** Statistical NLTK named-entity chunking; explicit grammars retain rule-based parsing. */
import { tagNamedEntities } from "./ne_model";
import {
  chunkTreeToIob,
  regexpChunkParse,
  type ChunkElement,
  type IobRow,
  type TaggedToken,
} from "./chunk";

/**
 * Default rule grammar approximating NLTK's NE categories. Rules are applied
 * in order, so earlier (more specific) rules win:
 *
 * - ORGANIZATION: plural proper-noun heads (Corporations, Agencies)
 * - PERSON: runs of two or more singular proper nouns (first + last name)
 * - GPE: a single remaining singular proper noun (most single proper nouns
 *   in news text are geopolitical entities: countries, cities)
 * - LOCATION: adjective + proper noun ("Northern Ireland")
 * - MONEY / PERCENT / DATE: numeric expressions
 */
export const DEFAULT_NE_GRAMMAR = `
ORGANIZATION: {<NNP><NNPS>|<NNPS>+}
PERSON:       {<NNP><NNP>+}
LOCATION:     {<JJ><NNP>+}
GPE:          {<NNP>}
MONEY:        {<$><CD>}
PERCENT:      {<CD><%>}
`;

export type NeChunkOptions = {
  /** Use an explicit rule grammar instead of the statistical model (RegexpParser syntax). */
  grammar?: string;
  /**
   * When true, use NLTK’s separately trained binary model with `NE` labels,
   * matching `ne_chunk(sentence, binary=True)`.
   */
  binary?: boolean;
};

/** Group tagged tokens into NE chunks (labeled nodes), NLTK `ne_chunk` style. */
export function neChunk(
  taggedSentence: TaggedToken[],
  options: NeChunkOptions = {},
): ChunkElement[] {
  if (options.grammar !== undefined) {
    const tree = regexpChunkParse(taggedSentence, options.grammar);
    return options.binary
      ? tree.map((node) => ("kind" in node ? { ...node, label: "NE" } : node))
      : tree;
  }
  const tags = tagNamedEntities(taggedSentence, options.binary ?? false);
  const tree: ChunkElement[] = [];
  taggedSentence.forEach((token, i) => {
    const tag = tags[i]!;
    if (tag === "O") {
      tree.push(token);
      return;
    }
    const label = tag.slice(2),
      previous = tree.at(-1);
    if (tag.startsWith("I-") && previous && "kind" in previous && previous.label === label)
      previous.tokens.push(token);
    else tree.push({ kind: "chunk", label, tokens: [token] });
  });
  return tree;
}

export type NeIobTuple = [word: string, pos: string, ne: string];

/** IOB-tagged view of the NE chunks: Array<[word, pos, ne]> with B-/I-/O tags. */
export function neChunkIob(
  taggedSentence: TaggedToken[],
  options: NeChunkOptions = {},
): NeIobTuple[] {
  const rows: IobRow[] = chunkTreeToIob(neChunk(taggedSentence, options));
  return rows.map((row) => [row.token, row.tag, row.iob]);
}
