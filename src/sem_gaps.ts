/**
 * Honest unsupported stubs for nltk.sem surfaces that depend on external
 * toolchains (Boxer/CandC prover binaries), tkinter visualization, or
 * interactive demos. Exported so the compatibility inventory can name a
 * real root export; every surface throws a clear error when used.
 */
import { pyError } from "./internals";

function unsupported(name: string, why: string): never {
  throw pyError("NotImplementedError", `${name}: ${why}`);
}

export class UnparseableInputException extends Error {
  constructor(message: string) { super(message); this.name = "UnparseableInputException"; }
}

export {
  AbstractBoxerDrs, BoxerCard, BoxerDrs, BoxerDrsParser, BoxerEq, BoxerIndexed,
  BoxerNamed, BoxerNot, BoxerOr, BoxerOutputDrsParser, BoxerPred, BoxerProp,
  BoxerRel, BoxerWhq, NltkDrtBoxerDrsInterpreter, PassthroughBoxerDrsInterpreter,
  parseToDrsDict, parse_to_drs_dict,
} from "./sem_boxer";

export { findBinaryIter as find_binary_iter } from "./internals";

const TK_WHY = "requires tkinter/canvas visualization, unavailable in the JS runtime";
export class DrsDrawer { constructor() { unsupported("DrsDrawer", TK_WHY); } }
export class CanvasFrame { constructor() { unsupported("CanvasFrame", TK_WHY); } }
export class DrsWidget { constructor() { unsupported("DrsWidget", TK_WHY); } }
export class ShowText { constructor() { unsupported("ShowText", TK_WHY); } }
export function test_draw(): never { return unsupported("test_draw", TK_WHY); }

const DEMO_WHY = "interactive demo helper; not applicable to the TS runtime contract";
export function decorator(): never { return unsupported("decorator", DEMO_WHY); }
export function foldemo(): never { return unsupported("foldemo", DEMO_WHY); }
export function folmodel(): never { return unsupported("folmodel", DEMO_WHY); }
export function propdemo(): never { return unsupported("propdemo", DEMO_WHY); }
export function satdemo(): never { return unsupported("satdemo", DEMO_WHY); }
export function demo_read_depgraph(): never { return unsupported("demo_read_depgraph", DEMO_WHY); }
