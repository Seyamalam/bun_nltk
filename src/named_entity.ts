/**
 * Named-entity chunking subset (nltk.chunk.named_entity).
 *
 * NOTE ON FIDELITY: NLTK's `ne_chunk` is a trained-model based chunker
 * (`nltk.chunk.named_entity.NEChunkParser` trained on ACE data and shipped as
 * pickled model files). We cannot ship that model here, so this module keeps
 * the same PUBLIC API SHAPE but implements the chunker as a RULE-BASED
 * approximation: regex rules over POS tags (the same style as NLTK's
 * `RegexpParser`) targeting NLTK's NE label inventory
 * (PERSON, ORGANIZATION, GPE, LOCATION, FACILITY, ...).
 *
 * The output structure mirrors what `ne_chunk` returns: when `binary=false`,
 * recognized spans are grouped into labeled NE nodes (Tree with an NE node
 * label); when `binary=true`, every recognized span is grouped into a single
 * `NE` node. IOB conversion reuses the machinery from ./chunk.
 */
import { chunkTreeToIob, regexpChunkParse, type ChunkElement, type IobRow, type TaggedToken } from "./chunk";

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
  /** Override the default rule grammar (RegexpParser syntax). */
  grammar?: string;
  /**
   * When true, all entity spans are collapsed into a single `NE` label,
   * matching `ne_chunk(sentence, binary=True)`.
   */
  binary?: boolean;
};

/** Group tagged tokens into NE chunks (labeled nodes), NLTK `ne_chunk` style. */
export function neChunk(taggedSentence: TaggedToken[], options: NeChunkOptions = {}): ChunkElement[] {
  const grammar = options.grammar ?? DEFAULT_NE_GRAMMAR;
  const tree = regexpChunkParse(taggedSentence, grammar);
  if (!options.binary) return tree;

  return tree.map((node) =>
    "kind" in node ? ({ kind: "chunk", label: "NE", tokens: node.tokens } as const) : node,
  );
}

export type NeIobTuple = [word: string, pos: string, ne: string];

/** IOB-tagged view of the NE chunks: Array<[word, pos, ne]> with B-/I-/O tags. */
export function neChunkIob(taggedSentence: TaggedToken[], options: NeChunkOptions = {}): NeIobTuple[] {
  const rows: IobRow[] = chunkTreeToIob(neChunk(taggedSentence, options));
  return rows.map((row) => [row.token, row.tag, row.iob]);
}
