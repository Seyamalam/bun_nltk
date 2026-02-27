import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type WordNetPos = "n" | "v" | "a" | "r";

export type WordNetSynset = {
  id: string;
  pos: WordNetPos;
  lemmas: string[];
  gloss: string;
  examples: string[];
  hypernyms: string[];
  hyponyms: string[];
  similarTo: string[];
  antonyms: string[];
};

export type WordNetMiniPayload = {
  version: number;
  synsets: WordNetSynset[];
};

function normalizeLemma(lemma: string): string {
  return lemma.toLowerCase().replace(/\s+/g, "_");
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function nounMorphCandidates(word: string): string[] {
  const lower = normalizeLemma(word);
  const out = [lower];
  if (lower.endsWith("ies") && lower.length > 3) out.push(`${lower.slice(0, -3)}y`);
  if (lower.endsWith("ves") && lower.length > 3) out.push(`${lower.slice(0, -3)}f`);
  if (lower.endsWith("es") && lower.length > 2) out.push(lower.slice(0, -2));
  if (lower.endsWith("s") && lower.length > 1) out.push(lower.slice(0, -1));
  return unique(out);
}

function verbMorphCandidates(word: string): string[] {
  const lower = normalizeLemma(word);
  const out = [lower];
  if (lower.endsWith("ies") && lower.length > 3) out.push(`${lower.slice(0, -3)}y`);
  if (lower.endsWith("ing") && lower.length > 4) {
    out.push(lower.slice(0, -3));
    out.push(`${lower.slice(0, -3)}e`);
  }
  if (lower.endsWith("ed") && lower.length > 3) {
    out.push(lower.slice(0, -2));
    out.push(`${lower.slice(0, -1)}`);
  }
  if (lower.endsWith("s") && lower.length > 1) out.push(lower.slice(0, -1));
  return unique(out);
}

function adjectiveMorphCandidates(word: string): string[] {
  const lower = normalizeLemma(word);
  const out = [lower];
  if (lower.endsWith("er") && lower.length > 2) out.push(lower.slice(0, -2));
  if (lower.endsWith("est") && lower.length > 3) out.push(lower.slice(0, -3));
  return unique(out);
}

function morphCandidates(word: string, pos?: WordNetPos): string[] {
  if (pos === "n") return nounMorphCandidates(word);
  if (pos === "v") return verbMorphCandidates(word);
  if (pos === "a") return adjectiveMorphCandidates(word);
  if (pos === "r") return [normalizeLemma(word)];
  return unique([
    ...nounMorphCandidates(word),
    ...verbMorphCandidates(word),
    ...adjectiveMorphCandidates(word),
    normalizeLemma(word),
  ]);
}

export class WordNet {
  private readonly byId = new Map<string, WordNetSynset>();
  private readonly lemmaIndex = new Map<string, WordNetSynset[]>();

  constructor(payload: WordNetMiniPayload) {
    for (const row of payload.synsets) {
      const normalized: WordNetSynset = {
        id: row.id,
        pos: row.pos,
        lemmas: row.lemmas.map((lemma) => normalizeLemma(lemma)),
        gloss: row.gloss,
        examples: [...row.examples],
        hypernyms: [...row.hypernyms],
        hyponyms: [...row.hyponyms],
        similarTo: [...row.similarTo],
        antonyms: [...row.antonyms],
      };
      this.byId.set(normalized.id, normalized);
      for (const lemma of normalized.lemmas) {
        const bucket = this.lemmaIndex.get(lemma) ?? [];
        bucket.push(normalized);
        this.lemmaIndex.set(lemma, bucket);
      }
    }
  }

  synset(id: string): WordNetSynset | null {
    return this.byId.get(id) ?? null;
  }

  synsets(word: string, pos?: WordNetPos): WordNetSynset[] {
    const lemma = this.morphy(word, pos) ?? normalizeLemma(word);
    const rows = this.lemmaIndex.get(lemma) ?? [];
    if (!pos) return rows;
    return rows.filter((row) => row.pos === pos);
  }

  lemmas(pos?: WordNetPos): string[] {
    const out: string[] = [];
    for (const [lemma, rows] of this.lemmaIndex.entries()) {
      if (!pos || rows.some((row) => row.pos === pos)) out.push(lemma);
    }
    out.sort();
    return out;
  }

  morphy(word: string, pos?: WordNetPos): string | null {
    for (const candidate of morphCandidates(word, pos)) {
      const rows = this.lemmaIndex.get(candidate);
      if (!rows || rows.length === 0) continue;
      if (!pos || rows.some((row) => row.pos === pos)) return candidate;
    }
    return null;
  }

  hypernyms(idOrSynset: string | WordNetSynset): WordNetSynset[] {
    const node = typeof idOrSynset === "string" ? this.synset(idOrSynset) : idOrSynset;
    if (!node) return [];
    return node.hypernyms.map((id) => this.byId.get(id)).filter((row): row is WordNetSynset => !!row);
  }

  hyponyms(idOrSynset: string | WordNetSynset): WordNetSynset[] {
    const node = typeof idOrSynset === "string" ? this.synset(idOrSynset) : idOrSynset;
    if (!node) return [];
    return node.hyponyms.map((id) => this.byId.get(id)).filter((row): row is WordNetSynset => !!row);
  }

  similarTo(idOrSynset: string | WordNetSynset): WordNetSynset[] {
    const node = typeof idOrSynset === "string" ? this.synset(idOrSynset) : idOrSynset;
    if (!node) return [];
    return node.similarTo.map((id) => this.byId.get(id)).filter((row): row is WordNetSynset => !!row);
  }

  antonyms(idOrSynset: string | WordNetSynset): WordNetSynset[] {
    const node = typeof idOrSynset === "string" ? this.synset(idOrSynset) : idOrSynset;
    if (!node) return [];
    return node.antonyms.map((id) => this.byId.get(id)).filter((row): row is WordNetSynset => !!row);
  }
}

let cachedMiniWordNet: WordNet | null = null;

export function loadWordNetMini(path?: string): WordNet {
  if (!path && cachedMiniWordNet) return cachedMiniWordNet;
  const sourcePath = path ?? resolve(import.meta.dir, "..", "models", "wordnet_mini.json");
  const payload = JSON.parse(readFileSync(sourcePath, "utf8")) as WordNetMiniPayload;
  const db = new WordNet(payload);
  if (!path) cachedMiniWordNet = db;
  return db;
}

