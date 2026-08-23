/**
 * Tree pretty-printer (port of nltk.tree.prettyprinter / nltk.treeprettyprinter).
 *
 * Renders an NLTK-style tree as bracketed string; thin wrapper over existing treeToBracket.
 */
import { treeToBracket } from "./tree_transforms";
import type { ParseTree } from "./parse";

export function prettyPrint(tree: ParseTree): string {
  return treeToBracket(tree as any);
}

export class TreePrettyPrinter {
  constructor(private readonly tree: ParseTree) {}
  text(): string { return prettyPrint(this.tree); }
  toString(): string { return this.text(); }
}
