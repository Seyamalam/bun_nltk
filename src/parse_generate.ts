/**
 * CFG sentence generation (port of nltk.parse.generate).
 *
 * Enumerates all sentences derivable from a CFG up to a given depth.
 * Matches NLTK's budget-limited generation (CWE-400 protection): caps total
 * expansion+emission steps; throws once the limit is hit.
 */

import type { CfgGrammar } from "./parse";

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

function* generateAll(
  grammar: CfgGrammar,
  items: string[],
  depth: number,
  budget: GenerationBudget,
): Generator<string[]> {
  if (items.length === 0) {
    yield [];
    return;
  }
  const first = items[0]!;
  const rest = items.slice(1);
  for (const frag1 of generateOne(grammar, first, depth, budget)) {
    for (const frag2 of generateAll(grammar, rest, depth, budget)) {
      budget.spend(); // per emitted sentence
      yield [...frag1, ...frag2];
    }
  }
}

function* generateOne(
  grammar: CfgGrammar,
  item: string,
  depth: number,
  budget: GenerationBudget,
): Generator<string[]> {
  budget.spend();
  if (depth <= 0) return;
  const isNonterminal = grammar.productions.some((p) => p.lhs === item);
  if (!isNonterminal) {
    // terminal
    yield [item];
    return;
  }
  for (const prod of grammar.productions) {
    if (prod.lhs !== item) continue;
    yield* generateAll(grammar, prod.rhs, depth - 1, budget);
  }
}

/**
 * Generate sentences from a CFG.
 *
 * @param grammar  CFG to generate from
 * @param options  start symbol (default: grammar.startSymbol), depth & n limits
 */
export function* generate(
  grammar: CfgGrammar,
  options: { start?: string; depth?: number; n?: number } = {},
): Generator<string[]> {
  const start = options.start ?? grammar.startSymbol;
  const depth = options.depth ?? 12; // safe default (NLTK uses recursionlimit/3)
  const budget = new GenerationBudget(MAX_GENERATE_OPERATIONS);
  let iter: Generator<string[]> = generateAll(grammar, [start], depth, budget);
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
  grammar: CfgGrammar,
  options: { start?: string; depth?: number; n?: number } = {},
): string[][] {
  return [...generate(grammar, options)];
}
