/**
 * CFG sentence generation (port of nltk.parse.generate).
 *
 * Enumerates all sentences derivable from a CFG up to a given depth.
 * Matches NLTK's budget-limited generation (CWE-400 protection): caps total
 * expansion+emission steps; throws once the limit is hit.
 */

import type { CfgGrammar } from "./parse";
import { CFG, Nonterminal, type GrammarSymbol } from "./grammar";

export const MAX_GENERATE_OPERATIONS = 1_000_000;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _ = 0;

class GenerationBudget {
  remaining: number;
  constructor(readonly limit: number) {
    this.remaining = limit;
  }
  spend(): void {
    if (--this.remaining < 0)
      throw new Error(
        `Refusing to generate further: generation exceeded ${this.limit} derivation steps (CWE-400). Pass a smaller depth/n or raise MAX_GENERATE_OPERATIONS.`,
      );
  }
}

type GenItem = { sym: string; isNt: boolean };
type GenProd = { lhs: string; rhs: GenItem[] };

function normalize(grammar: CfgGrammar | CFG): { prods: GenProd[]; start: GenItem } {
  if (grammar instanceof CFG) {
    return {
      prods: grammar.productions().map((p) => ({
        lhs: p.lhs().symbol(),
        rhs: p.rhs().map((elt) =>
          elt instanceof Nonterminal
            ? { sym: elt.symbol(), isNt: true }
            : { sym: String(elt), isNt: false },
        ),
      })),
      start: { sym: grammar.start().symbol(), isNt: true },
    };
  }
  const prods = grammar.productions.map((p) => ({
    lhs: p.lhs,
    rhs: p.rhs.map((sym) => ({ sym, isNt: grammar.productions.some((q) => q.lhs === sym) })),
  }));
  return { prods, start: { sym: grammar.startSymbol, isNt: true } };
}

function* generateAll(
  prods: GenProd[],
  items: GenItem[],
  depth: number,
  budget: GenerationBudget,
): Generator<string[]> {
  if (items.length === 0) {
    yield [];
    return;
  }
  const first = items[0]!;
  const rest = items.slice(1);
  for (const frag1 of generateOne(prods, first, depth, budget)) {
    for (const frag2 of generateAll(prods, rest, depth, budget)) {
      budget.spend(); // per emitted sentence
      yield [...frag1, ...frag2];
    }
  }
}

function* generateOne(
  prods: GenProd[],
  item: GenItem,
  depth: number,
  budget: GenerationBudget,
): Generator<string[]> {
  budget.spend();
  if (depth <= 0) return;
  if (!item.isNt) {
    // terminal
    yield [item.sym];
    return;
  }
  for (const prod of prods) {
    if (prod.lhs !== item.sym) continue;
    yield* generateAll(prods, prod.rhs, depth - 1, budget);
  }
}

/**
 * Generate sentences from a CFG.
 *
 * @param grammar  CFG (or CfgGrammar) to generate from
 * @param options  start symbol (default: grammar.start()), depth & n limits
 */
export function* generate(
  grammar: CfgGrammar | CFG,
  options: { start?: string | GrammarSymbol; depth?: number; n?: number } = {},
): Generator<string[]> {
  const { prods, start } = normalize(grammar);
  const startItem: GenItem = options.start === undefined
    ? start
    : typeof options.start === "string"
      ? { sym: options.start, isNt: prods.some((p) => p.lhs === options.start) }
      : options.start instanceof Nonterminal
        ? { sym: options.start.symbol(), isNt: true }
        : { sym: String(options.start), isNt: false };
  const depth = options.depth ?? 12; // safe default (NLTK uses recursionlimit/3)
  const budget = new GenerationBudget(MAX_GENERATE_OPERATIONS);
  let iter: Generator<string[]> = generateAll(prods, [startItem], depth, budget);
  if (options.n !== undefined) {
    // honour n=0 as "no sentences"
    let count = 0;
    const n = options.n;
    const base = iter;
    iter = (function* () {
      for (const s of base) {
        if (count++ >= n) break;
        yield s;
      }
    })();
  }
  yield* iter;
}

/** Convenience: collect up to n sentences into an array. */
export function generateSentences(
  grammar: CfgGrammar | CFG,
  options: { start?: string | GrammarSymbol; depth?: number; n?: number } = {},
): string[][] {
  return [...generate(grammar, options)];
}
