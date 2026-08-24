/**
 * CCGCat — port of category parsing helpers (nltk/ccg/lexicon + api category parsing)
 * Provides slash-type helpers, feature parsing, and string→category parsing.
 */
import { CCGVar, Direction, FunctionalCategory, PrimitiveCategory } from "./ccg_api.ts";
import type { AbstractCCGCategory } from "./ccg_api.ts";

// ---------------------------------------------------------------------------
// Feature helpers
// ---------------------------------------------------------------------------

export function parseSubscripts(subscr: string | null | undefined): string[] {
  if (!subscr) return [];
  return subscr.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
}

export function parseApplication(app: string[]): Direction {
  // app = [dir, restr1, restr2] where dir is "/" or "\"
  return new Direction(app[0] as "/" | "\\", (app[1] ?? "") + (app[2] ?? ""));
}

// ---------------------------------------------------------------------------
// Low-level string parsing (mirrors nltk/ccg/lexicon.py)
// ---------------------------------------------------------------------------

const PRIM_RE = /^([A-Za-z]+)(\[[A-Za-z,]+])?/;
const NEXTPRIM_RE = /^([A-Za-z]+(?:\[[A-Za-z,]+\])?)(.*)/s;
const APP_RE = /^([\\/])([.,_]?)([.,]?)(.*)/s;

function matchBrackets(s: string): [string, string] {
  let rest = s.slice(1);
  let inside = "(";
  while (rest !== "" && !rest.startsWith(")")) {
    if (rest.startsWith("(")) {
      const [part, r] = matchBrackets(rest);
      inside += part;
      rest = r;
    } else {
      inside += rest[0];
      rest = rest.slice(1);
    }
  }
  if (rest.startsWith(")")) return [inside + ")", rest.slice(1)];
  throw new Error(`Unmatched bracket in string '${s}'`);
}

function nextCategory(s: string): [string, string] {
  if (s.startsWith("(")) return matchBrackets(s);
  const m = NEXTPRIM_RE.exec(s);
  if (!m) throw new Error(`Cannot parse category chunk: ${s}`);
  return [m[1]!, m[2]!];
}

function parsePrimitiveCategory(
  chunks: RegExpMatchArray | (string | null | undefined)[],
  primitives: Set<string>,
  families: Map<string, [AbstractCCGCategory, CCGVar | null]>,
  v: CCGVar | null,
): [AbstractCCGCategory, CCGVar | null] {
  const name = chunks[0] as string;
  const subscr = chunks[1] as string | undefined;
  if (name === "var") {
    if (!subscr) {
      if (v === null) v = new CCGVar();
      return [v, v];
    }
  }
  if (families.has(name)) {
    const [cat, cvar] = families.get(name)!;
    if (v === null) v = cvar;
    else if (cvar) cat.substitute; // family var substitution
    // Apply substitution if needed
    let result: AbstractCCGCategory = cat;
    if (cvar && v) result = cat.substitute([[cvar, v]]);
    return [result, v];
  }
  if (primitives.has(name)) {
    return [new PrimitiveCategory(name, parseSubscripts(subscr)), v];
  }
  throw new Error(`String '${name}' is neither a family nor primitive category.`);
}

export function augParseCategory(
  line: string,
  primitives: Set<string>,
  families: Map<string, [AbstractCCGCategory, CCGVar | null]>,
  v: CCGVar | null = null,
): [AbstractCCGCategory, CCGVar | null] {
  let [catString, rest] = nextCategory(line.trim());
  let res: AbstractCCGCategory;

  if (catString.startsWith("(")) {
    const inner = catString.slice(1, -1);
    const r = augParseCategory(inner, primitives, families, v);
    res = r[0]; v = r[1];
  } else {
    const m = PRIM_RE.exec(catString);
    if (!m) throw new Error(`Cannot parse primitive: ${catString}`);
    const r = parsePrimitiveCategory([m[1], m[2]], primitives, families, v);
    res = r[0]; v = r[1];
  }

  while (rest !== "") {
    const m = APP_RE.exec(rest);
    if (!m) throw new Error(`Cannot parse application: ${rest}`);
    const dir = parseApplication([m[1]!, m[2]!, m[3]!]);
    rest = m[4]!;
    const [cs, r2] = nextCategory(rest);
    rest = r2;
    let arg: AbstractCCGCategory;
    if (cs.startsWith("(")) {
      const r = augParseCategory(cs.slice(1, -1), primitives, families, v);
      arg = r[0]; v = r[1];
    } else {
      const pm = PRIM_RE.exec(cs);
      if (!pm) throw new Error(`Cannot parse primitive: ${cs}`);
      const r = parsePrimitiveCategory([pm[1], pm[2]], primitives, families, v);
      arg = r[0]; v = r[1];
    }
    res = new FunctionalCategory(res, arg, dir);
  }
  return [res, v];
}

/** Parse a category string like "S\\NP/NP" given primitives/families. */
export function parseCategory(
  catStr: string,
  primitives: string[] = ["S", "NP", "N", "PP"],
  families: Map<string, [AbstractCCGCategory, CCGVar | null]> = new Map(),
): AbstractCCGCategory {
  const primSet = new Set(primitives);
  const [cat] = augParseCategory(catStr.trim(), primSet, families);
  return cat;
}

// ---------------------------------------------------------------------------
// CCGCat façade (convenience wrapper)
// ---------------------------------------------------------------------------

export class CCGCat {
  static parse(catStr: string, primitives?: string[]): AbstractCCGCategory {
    return parseCategory(catStr, primitives);
  }
  static isForward(dir: Direction): boolean { return dir.isForward(); }
  static isBackward(dir: Direction): boolean { return dir.isBackward(); }
  static slashChar(dir: Direction): string { return dir.dir; }
}
