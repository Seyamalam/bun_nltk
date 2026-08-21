import { loadWordNet, type WordNetSynset } from "./wordnet";

export type Synset = WordNetSynset;

export function synsetDefinition(synset: Synset): string {
  const withoutExamples = synset.gloss.replace(/"[^"]*"/g, "");
  return withoutExamples.trim().replace(/^[; ]+|[; ]+$/g, "");
}

function signatureTokens(synset: Synset): Set<string> {
  const out = new Set<string>();
  for (const token of synsetDefinition(synset).split(/\s+/)) {
    if (token.length > 0) out.add(token);
  }
  return out;
}

export function lesk(
  contextSentence: string[],
  ambiguousWord: string,
  pos?: string | number,
  synsets?: Synset[],
): Synset | null {
  let candidates: Synset[];
  if (synsets) {
    candidates = [...synsets];
  } else {
    candidates = loadWordNet().synsets(ambiguousWord);
  }

  if (pos !== undefined && pos !== null && String(pos) !== "") {
    const posKey = String(pos);
    candidates = candidates.filter((ss) => String(ss.pos) === posKey);
  }

  if (candidates.length === 0) return null;

  const context = new Set(contextSentence);
  let best: Synset | null = null;
  let bestOverlap = -1;
  for (const ss of candidates) {
    const signature = signatureTokens(ss);
    let overlap = 0;
    for (const token of context) {
      if (signature.has(token)) overlap += 1;
    }
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = ss;
    }
  }
  return best;
}
