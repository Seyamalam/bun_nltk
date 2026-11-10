/**
 * External semantic wrappers (ports of nltk.sem.boxer/cooper_storage/lfg etc. that require external tools
 * or heavy Prolog glue). API surface preserved; calls throw helpfully.
 */

function externalError(name: string): never {
  throw new Error(`${name} requires an external tool (Boxer / Prolog / Cooper storage) not available in the JS runtime.`);
}

export class Boxer {
  constructor(..._args: unknown[]) { void _args; }
  interpret(_sentence: string): unknown { return externalError("Boxer.interpret"); }
}
export function cooperStore(_semrep: unknown, _store?: unknown): unknown { return externalError("nltk.sem.cooper_storage.cooperStore"); }
export function lfgParse(_sentence: string, _grammar?: unknown): unknown { return externalError("nltk.sem.lfg"); }

/** Honest stub: CooperStore requires the cooper-storage chart machinery (nltk.parse.featurechart.InstantiateVarsChart). */
export class CooperStore {
  constructor(..._args: unknown[]) { externalError("nltk.sem.cooper_storage.CooperStore"); }
}
/** Honest stub: InstantiateVarsChart belongs to nltk.parse.featurechart — not ported. */
export class InstantiateVarsChart {
  constructor(..._args: unknown[]) { externalError("nltk.parse.featurechart.InstantiateVarsChart"); }
}
/** Honest stub: FStructure LFG parsing depends on the MaltParser dependency pipeline. */
export class FStructure {
  static read_depgraph(..._args: unknown[]): never { return externalError("nltk.sem.lfg.FStructure.read_depgraph"); }
  constructor(..._args: unknown[]) { externalError("nltk.sem.lfg.FStructure"); }
}
/** Honest stub: parse_with_bindops requires a feature-grammar parser with binding ops. */
export function parse_with_bindops(..._args: unknown[]): never { return externalError("nltk.sem.cooper_storage.parse_with_bindops"); }
