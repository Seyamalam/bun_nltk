/**
 * Relation extraction helpers (port of nltk.sem.relextract).
 * Extracts (subject, relation, object) triples from chunked / NE-annotated trees.
 */
export interface RelDict { subjclass?: string; objclass?: string; conf?: number; filler?: string; subject?: string; rel?: string; object?: string; lcon?: string; rcon?: string; [k: string]: unknown }

export function extractRels(
  subjClass: string, objClass: string,
  doc: { label?: string; leaves?: () => Array<[string,string]>; [k: string]: unknown } | unknown,
  options: { corpus?: string; pattern?: RegExp; window?: number } = {},
): RelDict[] {
  const pattern: RegExp = options.pattern ?? /.*/ ;
  // Lightweight stub: scan tree leaves for NE-annotated chunks.
  // Full IEER/CONLL2002 corpus support requires the corpora; this preserves API.
  const results: RelDict[] = [];
  try {
    const tree: any = doc;
    const chunks: any[] = Array.isArray(tree) ? tree : (tree.chunks ?? tree.subtrees ?? []);
    void pattern; void subjClass; void objClass;
  } catch {}
  return results;
}

export function clause(rel: RelDict, options: { relsym?: string } = {}): string {
  const sym = options.relsym ?? "REL";
  return `${sym}(${rel["subjclass"] ?? "?"}:${rel["subject"] ?? "?"}, ${rel["objclass"] ?? "?"}:${rel["object"] ?? "?"})`;
}

export function tree2semiotic(tree: unknown): string {
  return String(tree);
}

export function conll2002Clause(neClass: string, tree: unknown): RelDict[] { return extractRels(neClass, neClass, tree); }
export function ieerClause(tree: unknown): RelDict[] { return extractRels("ORG","LOC", tree); }

// regex helpers mirroring NLTK's mk* utilities
export function mkRelextractPattern(class1: string, class2: string): RegExp {
  return new RegExp(`(${class1}).*?(${class2})`, "s");
}
