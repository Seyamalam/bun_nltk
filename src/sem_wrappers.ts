/**
 * External semantic wrappers (ports of nltk.sem.boxer/cooper_storage/lfg etc. that require external tools
 * or heavy Prolog glue). API surface preserved; calls throw helpfully.
 */

import { FeatDict, FeatList, type FeatValue } from "./featstruct";
import { CooperStore } from "./cooper_storage";

function externalError(name: string): never {
  throw new Error(`${name} requires an external tool (Boxer / Prolog / Cooper storage) not available in the JS runtime.`);
}

export class Boxer {
  constructor(..._args: unknown[]) { void _args; }
  interpret(_sentence: string): unknown { return externalError("Boxer.interpret"); }
}
export function cooperStore(semrep: unknown, store?: unknown): unknown {
  // Adapted helper: build a CooperStore from a semantic rep + optional store list.
  const fs = new FeatDict({ CORE: semrep as FeatValue, STORE: (store as FeatValue) ?? new FeatList() });
  return new CooperStore(fs);
}
export function lfgParse(_sentence: string, _grammar?: unknown): unknown { return externalError("nltk.sem.lfg"); }

export { CooperStore, cooperStoreFromTree, parse_with_bindops } from "./cooper_storage";
export { InstantiateVarsChart } from "./parse_feature";

export { FStructure } from "./sem_lfg";
