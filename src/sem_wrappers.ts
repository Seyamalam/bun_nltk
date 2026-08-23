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
