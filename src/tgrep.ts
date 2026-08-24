/**
 * Shim for nltk.tgrep — TGrep2 search for NLTK trees (2437 LOC, pyparsing-based).
 *
 * Full TGrep requires pyparsing grammar + ParentedTree traversal. This shim
 * preserves the public API with typed signatures and throws a helpful error
 * pointing to the Python implementation. Tree-position helpers that are pure
 * (no pyparsing) are implemented so code that only needs positions can run.
 */

export type TGrepPattern = string;
export type TreePosition = number[];
export type TGrepPredicate = (node: unknown, macroDict?: Record<string, unknown>, labelDict?: Record<string, unknown>) => boolean;

function tgrepMissing(op: string): never {
  throw new Error(
    `nltk.tgrep.${op}: TGrep search requires the full pyparsing-based parser (nltk/tgrep.py, ~2400 LOC). ` +
    `In bun_nltk this is a shim. Options:\n` +
    `  • Run TGrep in Python: from nltk.tgrep import tgrep_nodes, tgrep_positions, tgrep_compile\n` +
    `  • Port your pattern to a JS tree walker over your Tree/ParentedTree structure\n` +
    `  • Vendor a JS pyparsing-equivalent parser for the TGrep2 syntax\n` +
    `See https://www.nltk.org/howto/tgrep.html and http://tedlab.mit.edu/~dr/Tgrep2/tgrep2.pdf`
  );
}

export function tgrepTokenize(_tgrepString: string): string[] {
  tgrepMissing("tgrep_tokenize");
}

export function tgrepCompile(_tgrepString: string): TGrepPredicate {
  tgrepMissing("tgrep_compile");
}

export function tgrep_tokenize(s: string): string[] { return tgrepTokenize(s); }
export function tgrep_compile(s: string): TGrepPredicate { return tgrepCompile(s); }

export function tgrepPositions(
  _pattern: string | TGrepPredicate,
  _trees: unknown[],
  _searchLeaves = true,
): TreePosition[][] {
  tgrepMissing("tgrep_positions");
}

export function tgrepNodes(
  _pattern: string | TGrepPredicate,
  _trees: unknown[],
  _searchLeaves = true,
): unknown[][] {
  tgrepMissing("tgrep_nodes");
}

export const tgrep_positions = tgrepPositions;
export const tgrep_nodes = tgrepNodes;

// Pure helper — no pyparsing needed, included for completeness
export function treepositionsNoLeaves(tree: { treepositions(): TreePosition[] }): TreePosition[] {
  const positions = tree.treepositions();
  const prefixes = new Set<string>();
  for (const pos of positions) for (let len = 0; len < pos.length; len++) prefixes.add(pos.slice(0, len).join(","));
  return positions.filter((pos) => prefixes.has(pos.join(",")));
}

export const treepositions_no_leaves = treepositionsNoLeaves;

// Ancestor/descendant helpers (lightweight stubs — operate on ParentedTree-like objects)
export function ancestors(_node: unknown): unknown[] { tgrepMissing("ancestors"); }
export function uniqueAncestors(_node: unknown): unknown[] { tgrepMissing("uniqueAncestors"); }

export const unique_ancestors = uniqueAncestors;

// Re-export placeholder for _build_tgrep_parser
export function buildTgrepParser(_setParseActions = true): never {
  tgrepMissing("_build_tgrep_parser");
}
export const _build_tgrep_parser = buildTgrepParser;
