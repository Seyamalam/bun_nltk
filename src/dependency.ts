import { posTagAsciiNative } from "./native";
import { wordTokenizeSubset } from "./tokenizers";

export type DependencyArc = {
  head: number;
  dep: number;
  relation: string;
};

export type DependencyParse = {
  tokens: string[];
  posTags: string[];
  root: number;
  arcs: DependencyArc[];
};

const VERB_WORDS = new Set([
  "am",
  "are",
  "be",
  "been",
  "being",
  "is",
  "was",
  "were",
  "do",
  "does",
  "did",
  "have",
  "has",
  "had",
]);

function isVerbLike(token: string, tag: string): boolean {
  if (tag.startsWith("VB")) return true;
  return VERB_WORDS.has(token.toLowerCase());
}

function isPunctuation(token: string): boolean {
  return /^[,.;:!?]$/.test(token);
}

function pickRoot(tokens: string[], posTags: string[]): number {
  for (let i = 0; i < tokens.length; i += 1) {
    if (isVerbLike(tokens[i]!, posTags[i]!)) return i;
  }
  return tokens.length > 0 ? 0 : -1;
}

export function dependencyParse(tokens: string[], posTags?: string[]): DependencyParse {
  const normalizedTokens = tokens.map((t) => t.toLowerCase());
  const tags = posTags && posTags.length === tokens.length ? posTags : posTagAsciiNative(tokens.join(" ")).map((r) => r.tag);
  if (normalizedTokens.length === 0) {
    return { tokens: [], posTags: [], root: -1, arcs: [] };
  }

  const root = pickRoot(normalizedTokens, tags);
  const arcs: DependencyArc[] = [];

  for (let i = 0; i < normalizedTokens.length; i += 1) {
    if (i === root) continue;
    const token = normalizedTokens[i]!;
    const tag = tags[i] ?? "NN";

    let head = root;
    let relation = "dep";

    if (isPunctuation(token)) {
      head = root;
      relation = "punct";
    } else if (i < root && (tag.startsWith("NN") || tag === "PRP")) {
      head = root;
      relation = "nsubj";
    } else if (i > root && (tag.startsWith("NN") || tag === "PRP")) {
      head = root;
      relation = "obj";
    } else if (tag.startsWith("JJ")) {
      const nounRight = tags.findIndex((t, idx) => idx > i && t.startsWith("NN"));
      head = nounRight >= 0 ? nounRight : root;
      relation = "amod";
    } else if (tag.startsWith("RB")) {
      head = root;
      relation = "advmod";
    } else if (tag.startsWith("IN") || tag === "TO") {
      head = root;
      relation = "prep";
    }

    arcs.push({ head, dep: i, relation });
  }

  return {
    tokens: normalizedTokens,
    posTags: tags,
    root,
    arcs,
  };
}

export function dependencyParseText(text: string, options?: { normalizeTokens?: boolean }): DependencyParse {
  const tokens = wordTokenizeSubset(text).filter((tok) => /[A-Za-z0-9']/.test(tok));
  const normalized = options?.normalizeTokens === false ? tokens : tokens.map((tok) => tok.toLowerCase());
  return dependencyParse(normalized);
}
