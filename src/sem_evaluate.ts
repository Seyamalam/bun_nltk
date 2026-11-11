/**
 * Port of nltk.sem.evaluate helpers: relation utilities, read_valuation,
 * Error/Undefined exception types, and the trace decorator.
 */
import { pyError } from "./internals";
import { Valuation, type ValuationSpec } from "./sem_logic";

export class SemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SemError";
  }
}

export class Undefined extends SemError {
  constructor(message: string) {
    super(message);
    this.name = "Undefined";
  }
}

/** Port of nltk.sem.evaluate.trace: print "Calling <fn> with <args>" then return f(*args). */
export function sem_trace<A extends unknown[], R>(f: (...args: A) => R, ...args: A): R {
  const argstr = args.map((a) => JSON.stringify(a)).join(", ");
  // eslint-disable-next-line no-console
  console.log(`Calling ${f.name} with ${argstr}`);
  return f(...args);
}

/** Port of nltk.sem.evaluate.is_rel. */
export function is_rel(s: Set<unknown>): boolean {
  if (s.size === 0) return true;
  const els = [...s];
  if (els.every((el) => Array.isArray(el))) {
    const lens = els.map((el) => (el as unknown[]).length);
    if (Math.max(...lens) === Math.min(...lens)) return true;
  }
  throw pyError("ValueError", `Set ${JSON.stringify(els)} contains sequences of different lengths`);
}

/** Port of nltk.sem.evaluate.set2rel. */
export function set2rel(s: Set<unknown>): Set<unknown> {
  // NLTK quirk: strings -> (elem,) tuples, but ints -> bare str(elem) element.
  const out = new Set<unknown>();
  for (const elem of s) {
    if (typeof elem === "string") {
      out.add([elem]);
    } else if (typeof elem === "number" || typeof elem === "bigint") {
      out.add(String(elem) as unknown as unknown[]);
    } else {
      out.add(elem as unknown[]);
    }
  }
  return out as Set<unknown[]>;
}

/** Port of nltk.sem.evaluate.arity. */
export function arity(rel: Set<unknown[]>): number {
  if (rel.size === 0) return 0;
  return [...rel][0]!.length;
}

const VAL_SPLIT_RE = /\s*=>\s*/;
const TUPLES_RE = /\([^)]*\)/g;

/** Port of nltk.sem.evaluate._read_valuation_line. */
function readValuationLine(s: string): [string, string | boolean | string[] | string[][]] {
  const pieces = s.split(VAL_SPLIT_RE).map((p) => p.trim());
  const symbol = pieces[0]!;
  let value: string | string[] | string[][] | boolean = pieces[1]!;
  if (value.startsWith("{")) {
    const inner = value.slice(1, -1);
    const tupleStrings = inner.match(TUPLES_RE);
    if (tupleStrings) {
      const setElements: string[][] = tupleStrings.map((ts) =>
        ts.slice(1, -1).split(",").map((e) => e.trim()));
      value = setElements;
    } else {
      value = inner
        .split(",")
        .map((e) => e.trim())
        .filter((e) => e.length > 0);
    }
  }
  // NLTK quirk: "True"/"False" stay plain strings and join the valuation domain.
  return [symbol, value];
}

/** Port of nltk.sem.evaluate.read_valuation. */
export function read_valuation(s: string, encoding?: string): Valuation {
  void encoding;
  const spec: ValuationSpec = {};
  const lines = s.split(/\r?\n/);
  for (let linenum = 0; linenum < lines.length; linenum++) {
    const line = lines[linenum]!.trim();
    if (line.startsWith("#") || line === "") continue;
    try {
      const [sym, val] = readValuationLine(line);
      spec[sym] = val;
    } catch (e) {
      // NLTK quirk: only ValueError is wrapped; IndexError-style failures propagate.
      if ((e as Error).name === "ValueError") {
        throw pyError("ValueError", `Unable to parse line ${linenum}: ${line}`);
      }
      throw e;
    }
  }
  return new Valuation(spec);
}

export const readValuation = read_valuation;
