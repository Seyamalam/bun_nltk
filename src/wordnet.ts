import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { wordnetMorphyAsciiNative } from "./native";

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

function uniqueSynsets(values: WordNetSynset[]): WordNetSynset[] {
  const seen = new Set<string>();
  const out: WordNetSynset[] = [];
  for (const row of values) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

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

  private resolveSynset(idOrSynset: string | WordNetSynset): WordNetSynset | null {
    return typeof idOrSynset === "string" ? this.synset(idOrSynset) : idOrSynset;
  }

  private adjacent(idOrSynset: string | WordNetSynset): WordNetSynset[] {
    const row = this.resolveSynset(idOrSynset);
    if (!row) return [];
    return uniqueSynsets([...this.hypernyms(row), ...this.hyponyms(row)]);
  }

  synset(id: string): WordNetSynset | null {
    return this.byId.get(id) ?? null;
  }

  allSynsets(pos?: WordNetPos): WordNetSynset[] {
    const rows = [...this.byId.values()];
    if (!pos) return rows;
    return rows.filter((row) => row.pos === pos);
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
    const nativeCandidate = wordnetMorphyAsciiNative(word, pos);
    if (nativeCandidate) {
      const rows = this.lemmaIndex.get(nativeCandidate);
      if (rows && rows.length > 0 && (!pos || rows.some((row) => row.pos === pos))) {
        return nativeCandidate;
      }
    }
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
    const node = this.resolveSynset(idOrSynset);
    if (!node) return [];
    return node.antonyms.map((id) => this.byId.get(id)).filter((row): row is WordNetSynset => !!row);
  }

  hypernymPaths(idOrSynset: string | WordNetSynset, options: { maxDepth?: number } = {}): WordNetSynset[][] {
    const start = this.resolveSynset(idOrSynset);
    if (!start) return [];
    const maxDepth = Math.max(1, Math.floor(options.maxDepth ?? 32));
    const out: WordNetSynset[][] = [];

    const visit = (node: WordNetSynset, path: WordNetSynset[], seen: Set<string>, depth: number): void => {
      const nextPath = [...path, node];
      const parents = this.hypernyms(node).filter((parent) => !seen.has(parent.id));
      if (parents.length === 0 || depth >= maxDepth) {
        out.push(nextPath);
        return;
      }
      for (const parent of parents) {
        const nextSeen = new Set(seen);
        nextSeen.add(parent.id);
        visit(parent, nextPath, nextSeen, depth + 1);
      }
    };

    visit(start, [], new Set([start.id]), 0);
    return out;
  }

  shortestPathDistance(
    left: string | WordNetSynset,
    right: string | WordNetSynset,
    options: { maxDepth?: number } = {},
  ): number | null {
    const start = this.resolveSynset(left);
    const target = this.resolveSynset(right);
    if (!start || !target) return null;
    if (start.id === target.id) return 0;

    const maxDepth = Math.max(1, Math.floor(options.maxDepth ?? 64));
    const queue: Array<{ id: string; depth: number }> = [{ id: start.id, depth: 0 }];
    const seen = new Set<string>([start.id]);
    let head = 0;
    while (head < queue.length) {
      const current = queue[head++]!;
      if (current.depth >= maxDepth) continue;
      const node = this.synset(current.id);
      if (!node) continue;
      for (const next of this.adjacent(node)) {
        if (next.id === target.id) return current.depth + 1;
        if (seen.has(next.id)) continue;
        seen.add(next.id);
        queue.push({ id: next.id, depth: current.depth + 1 });
      }
    }
    return null;
  }

  pathSimilarity(
    left: string | WordNetSynset,
    right: string | WordNetSynset,
    options: { maxDepth?: number } = {},
  ): number | null {
    const distance = this.shortestPathDistance(left, right, options);
    if (distance === null) return null;
    return 1 / (distance + 1);
  }

  lowestCommonHypernyms(
    left: string | WordNetSynset,
    right: string | WordNetSynset,
    options: { maxDepth?: number } = {},
  ): WordNetSynset[] {
    const lhs = this.resolveSynset(left);
    const rhs = this.resolveSynset(right);
    if (!lhs || !rhs) return [];
    const maxDepth = Math.max(1, Math.floor(options.maxDepth ?? 64));

    const buildAncestorDepths = (start: WordNetSynset): Map<string, number> => {
      const out = new Map<string, number>();
      const queue: Array<{ node: WordNetSynset; depth: number }> = [{ node: start, depth: 0 }];
      let head = 0;
      while (head < queue.length) {
        const current = queue[head++]!;
        const prevDepth = out.get(current.node.id);
        if (prevDepth !== undefined && prevDepth <= current.depth) continue;
        out.set(current.node.id, current.depth);
        if (current.depth >= maxDepth) continue;
        for (const parent of this.hypernyms(current.node)) {
          queue.push({ node: parent, depth: current.depth + 1 });
        }
      }
      return out;
    };

    const lAnc = buildAncestorDepths(lhs);
    const rAnc = buildAncestorDepths(rhs);
    let best = Infinity;
    const bestIds: string[] = [];
    for (const [id, lDepth] of lAnc.entries()) {
      const rDepth = rAnc.get(id);
      if (rDepth === undefined) continue;
      const score = lDepth + rDepth;
      if (score < best) {
        best = score;
        bestIds.length = 0;
        bestIds.push(id);
      } else if (score === best) {
        bestIds.push(id);
      }
    }

    return bestIds
      .map((id) => this.synset(id))
      .filter((row): row is WordNetSynset => !!row)
      .sort((a, b) => a.id.localeCompare(b.id));
  }
}

let cachedMiniWordNet: WordNet | null = null;
let cachedExtendedWordNet: WordNet | null = null;
let cachedPackedWordNet: WordNet | null = null;
let cachedDefaultWordNet: WordNet | null = null;

export function loadWordNetMini(path?: string): WordNet {
  if (!path && cachedMiniWordNet) return cachedMiniWordNet;
  const sourcePath = path ?? resolve(import.meta.dir, "..", "models", "wordnet_mini.json");
  const payload = JSON.parse(readFileSync(sourcePath, "utf8")) as WordNetMiniPayload;
  const db = new WordNet(payload);
  if (!path) cachedMiniWordNet = db;
  return db;
}

export function loadWordNetExtended(path?: string): WordNet {
  if (!path && cachedExtendedWordNet) return cachedExtendedWordNet;
  const sourcePath = path ?? resolve(import.meta.dir, "..", "models", "wordnet_extended.json");
  const payload = JSON.parse(readFileSync(sourcePath, "utf8")) as WordNetMiniPayload;
  const db = new WordNet(payload);
  if (!path) cachedExtendedWordNet = db;
  return db;
}

const WORDNET_PACK_MAGIC = "BNWN1";

export function loadWordNetPacked(path?: string): WordNet {
  if (!path && cachedPackedWordNet) return cachedPackedWordNet;
  const sourcePath = path ?? resolve(import.meta.dir, "..", "models", "wordnet_full.bin");
  const bytes = readFileSync(sourcePath);
  const magic = new TextDecoder().decode(bytes.subarray(0, WORDNET_PACK_MAGIC.length));
  if (magic !== WORDNET_PACK_MAGIC) {
    throw new Error(`invalid wordnet pack magic: ${magic}`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const len = view.getUint32(WORDNET_PACK_MAGIC.length, true);
  const start = WORDNET_PACK_MAGIC.length + 4;
  const end = start + len;
  if (end > bytes.length) {
    throw new Error("invalid wordnet pack length");
  }
  const payload = JSON.parse(new TextDecoder().decode(bytes.subarray(start, end))) as WordNetMiniPayload;
  const db = new WordNet(payload);
  if (!path) cachedPackedWordNet = db;
  return db;
}

function loadWordNetFromPath(path: string): WordNet {
  if (path.endsWith(".bin")) return loadWordNetPacked(path);
  const payload = JSON.parse(readFileSync(path, "utf8")) as WordNetMiniPayload;
  return new WordNet(payload);
}

export function loadWordNet(path?: string): WordNet {
  if (path) return loadWordNetFromPath(path);
  if (cachedDefaultWordNet) return cachedDefaultWordNet;

  const envPath = process.env.BUN_NLTK_WORDNET_PATH;
  if (envPath && existsSync(envPath)) {
    cachedDefaultWordNet = loadWordNetFromPath(envPath);
    return cachedDefaultWordNet;
  }

  const packedPath = resolve(import.meta.dir, "..", "models", "wordnet_full.bin");
  if (existsSync(packedPath)) {
    cachedDefaultWordNet = loadWordNetPacked(packedPath);
    return cachedDefaultWordNet;
  }

  cachedDefaultWordNet = loadWordNetExtended();
  return cachedDefaultWordNet;
}
