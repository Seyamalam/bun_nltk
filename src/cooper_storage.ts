// Port of nltk.sem.cooper_storage (NLTK 3.10.3): Cooper storage for
// quantifier ambiguity.
//
// Original: nltk/sem/cooper_storage.py

import { FeatDict, FeatList, FeatureValueTuple, type FeatValue } from "./featstruct";
import { ApplicationExpression, LambdaExpression, Variable, type Expression } from "./sem_logic";
import type { FeatStructNonterminal } from "./parse_feature";
import type { ParseTree } from "./parse";
import { FeatureGrammar, FeatureIncrementalChartParser, InstantiateVarsChart } from "./parse_feature";
import { pyError } from "./internals";

interface BindOpExpression extends Expression {
  args: Expression[];
}

/** Cooper storage container: core semantics + a store of binding operators. */
export class CooperStore {
  readonly featstruct: FeatDict;
  readonly readings: Expression[] = [];
  readonly core?: FeatValue;
  readonly store?: FeatList | FeatValue;

  constructor(featstruct: FeatDict) {
    this.featstruct = featstruct;
    const core = featstruct.get("CORE");
    const store = featstruct.get("STORE");
    if (core === undefined || store === undefined) {
      console.log(`${featstruct} is not a Cooper storage structure`);
    } else {
      this.core = core;
      this.store = store;
    }
  }

  private *_permute<T>(lst: T[]): Generator<T[]> {
    if (lst.length === 0) {
      yield [];
      return;
    }
    for (let i = 0; i < lst.length; i++) {
      const rest = [...lst.slice(0, i), ...lst.slice(i + 1)];
      for (const p of this._permute(rest)) yield [lst[i]!, ...p];
    }
  }

  /** S-Retrieval: apply each permutation of the store to the core term. */
  s_retrieve(trace = false): void {
    if (this.store === undefined) {
      throw pyError("AttributeError", "'CooperStore' object has no attribute 'store'");
    }
    // Oracle quirk: _permute slices self.store — FeatList.__getitem__ rejects
    // slices, so only FeatureValueTuple/plain-list stores retrieve readings.
    if (this.store instanceof FeatList) {
      throw pyError("TypeError", "Expected int or feature path.  Got slice(None, 0, None).");
    }
    const storeItems = this.store instanceof FeatureValueTuple
      ? this.store.items
      : Array.isArray(this.store)
        ? this.store
        : (() => { throw pyError("TypeError", `'${this.store}' object is not subscriptable`); })();
    let permIdx = 0;
    for (const storePerm of this._permute(storeItems)) {
      permIdx++;
      if (trace) console.log(`Permutation ${permIdx}`);
      let term = this.core as Expression;
      for (const bindop of storePerm) {
        const [quant, varex] = (bindop as BindOpExpression).args as [Expression, Expression];
        const v = (varex as unknown as { variable: Variable }).variable;
        term = new ApplicationExpression(quant, new LambdaExpression(v, term));
        if (trace) console.log("  ", String(term));
        term = term.simplify();
      }
      this.readings.push(term);
    }
  }
}

/**
 * Use a grammar with Binding Operators to parse a sentence.
 * Adapted: `grammar` is a FeatureGrammar or feature-grammar text (the oracle's
 * default nltk_data grammar 'grammars/book_grammars/storage.fcfg' is not
 * bundled — pass a grammar explicitly).
 */
export function parse_with_bindops(
  sentence: string,
  grammar?: FeatureGrammar | string | null,
  trace = 0,
): ParseTree[] {
  void trace;
  const g = grammar instanceof FeatureGrammar
    ? grammar
    : typeof grammar === "string"
      ? FeatureGrammar.fromstring(grammar)
      : null;
  if (!g) {
    throw pyError(
      "LookupError",
      "parse_with_bindops() requires a feature grammar: the oracle default " +
        "'grammars/book_grammars/storage.fcfg' is not bundled in this runtime.",
    );
  }
  const tokens = sentence.trim().split(/\s+/).filter((t) => t.length > 0);
  const parser = new FeatureIncrementalChartParser(g, { chartClass: InstantiateVarsChart });
  return parser.parse(tokens);
}

/** Tree label -> CooperStore featstruct. */
export function cooperStoreFromTree(tree: ParseTree): CooperStore {
  const label = tree.label as unknown as FeatStructNonterminal | FeatDict;
  const fs = label instanceof FeatDict ? label : (label as FeatStructNonterminal).fstruct;
  const sem = (fs as FeatDict).get("SEM");
  if (!(sem instanceof FeatDict)) {
    throw pyError("KeyError", "tree label has no SEM feature");
  }
  return new CooperStore(sem);
}
