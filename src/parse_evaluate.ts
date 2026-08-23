/**
 * Dependency parse evaluation (port of nltk.parse.evaluate.DependencyEvaluator).
 *
 * Measures labelled (LAS) and unlabelled (UAS) attachment scores between
 * parsed and gold dependency structures. Punctuation is ignored.
 */

/** Minimal node shape shared by our DependencyParse arcs and gold inputs. */
export type DependencyEvalNode = {
  word: string;
  /** Head position, 0 = root. */
  head: number;
  /** Dependency relation label. */
  rel: string;
};

const PUNCT_RE =
  /[\p{Pc}\p{Pd}\p{Ps}\p{Pe}\p{Pi}\p{Pf}\p{Po}]/u;

function removePunct(input: string): string {
  return [...input]
    .filter((ch) => !PUNCT_RE.test(ch))
    .join("");
}

function toNodes(parse: {
  tokens: readonly string[];
  arcs: ReadonlyArray<{ from: number; to: number; label: string }>;
  root: number;
}): DependencyEvalNode[] {
  // Build a head map: NLTK's DependencyGraph nodes have head addresses where
  // 0 = ROOT. Our arcs are (from -> to); treat "from" as head of "to".
  const heads = new Array<number>(parse.tokens.length).fill(0);
  const rels = new Array<string>(parse.tokens.length).fill("");
  for (const arc of parse.arcs) {
    heads[arc.to - 1] = arc.from;
    rels[arc.to - 1] = arc.label;
  }
  return parse.tokens.map((word, idx) => ({
    word,
    head: heads[idx]!,
    rel: rels[idx]!,
  }));
}

/**
 * Evaluate parsed vs gold dependency structures.
 * Accepts pre-built node lists or our DependencyParse objects.
 * Returns [LAS, UAS].
 */
export function dependencyEvaluate(
  parsedSents: ReadonlyArray<
    | { nodes: readonly DependencyEvalNode[] }
    | { tokens: readonly string[]; arcs: ReadonlyArray<{ from: number; to: number; label: string }>; root: number }
  >,
  goldSents: ReadonlyArray<
    | { nodes: readonly DependencyEvalNode[] }
    | { tokens: readonly string[]; arcs: ReadonlyArray<{ from: number; to: number; label: string }>; root: number }
  >,
): [las: number, uas: number] {
  if (parsedSents.length !== goldSents.length) {
    throw new Error("Number of parsed sentences is different from number of gold sentences.");
  }

  const normalize = (
    sent:
      | { nodes: readonly DependencyEvalNode[] }
      | { tokens: readonly string[]; arcs: ReadonlyArray<{ from: number; to: number; label: string }>; root: number },
  ): readonly DependencyEvalNode[] => ("nodes" in sent ? sent.nodes : toNodes(sent));

  let corr = 0;
  let corrL = 0;
  let total = 0;

  for (let i = 0; i < parsedSents.length; i += 1) {
    const parsedNodes = normalize(parsedSents[i]!);
    const goldNodes = normalize(goldSents[i]!);

    if (parsedNodes.length !== goldNodes.length) {
      throw new Error("Sentences must have equal length.");
    }

    for (let j = 0; j < parsedNodes.length; j += 1) {
      const parsedNode = parsedNodes[j]!;
      const goldNode = goldNodes[j]!;

      if (removePunct(parsedNode.word) === "") continue;

      if (parsedNode.word !== goldNode.word) {
        throw new Error("Sentence sequence is not matched.");
      }

      total += 1;
      if (parsedNode.head === goldNode.head) {
        corr += 1;
        if (parsedNode.rel === goldNode.rel) corrL += 1;
      }
    }
  }

  return [corrL / total, corr / total];
}
