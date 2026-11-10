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

const BOXER_WHY = "requires the external CandC/Boxer DRS pipeline, unavailable in the JS runtime";
export class AbstractBoxerDrs { constructor() { unsupported("AbstractBoxerDrs", BOXER_WHY); } }
export class BoxerCard { constructor() { unsupported("BoxerCard", BOXER_WHY); } }
export class BoxerDrs { constructor() { unsupported("BoxerDrs", BOXER_WHY); } }
export class BoxerDrsParser { constructor() { unsupported("BoxerDrsParser", BOXER_WHY); } }
export class BoxerEq { constructor() { unsupported("BoxerEq", BOXER_WHY); } }
export class BoxerIndexed { constructor() { unsupported("BoxerIndexed", BOXER_WHY); } }
export class BoxerNamed { constructor() { unsupported("BoxerNamed", BOXER_WHY); } }
export class BoxerNot { constructor() { unsupported("BoxerNot", BOXER_WHY); } }
export class BoxerOr { constructor() { unsupported("BoxerOr", BOXER_WHY); } }
export class BoxerOutputDrsParser { constructor() { unsupported("BoxerOutputDrsParser", BOXER_WHY); } }
export class BoxerPred { constructor() { unsupported("BoxerPred", BOXER_WHY); } }
export class BoxerProp { constructor() { unsupported("BoxerProp", BOXER_WHY); } }
export class BoxerRel { constructor() { unsupported("BoxerRel", BOXER_WHY); } }
export class BoxerWhq { constructor() { unsupported("BoxerWhq", BOXER_WHY); } }
export class NltkDrtBoxerDrsInterpreter { constructor() { unsupported("NltkDrtBoxerDrsInterpreter", BOXER_WHY); } }
export class PassthroughBoxerDrsInterpreter { constructor() { unsupported("PassthroughBoxerDrsInterpreter", BOXER_WHY); } }

export function find_binary_iter(_name: string): never {
  return unsupported("find_binary_iter", "external binary lookup is not available in the JS runtime");
}

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
