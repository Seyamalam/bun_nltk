/**
 * CCG Lexicon — port of nltk/ccg/lexicon.py
 */
import { CCGVar, PrimitiveCategory } from "./ccg_api.ts";
import type { AbstractCCGCategory } from "./ccg_api.ts";
import { augParseCategory } from "./ccg_ccgcat.ts";
import { fromstring as logicFromString } from "./sem_logic.ts";
import type { Expression } from "./sem_logic.ts";

// Regex mirrors
const LEX_RE = /^([\S_]*?[^\s=-])\s*(::|[-=]+>)\s*(.+)/;
const RHS_RE = /^([^{}]*[^ {}])\s*(\{[^}]+\})?/;
const SEM_RE = /\{([^}]+)\}/;
const COMMENTS_RE = /^([^#]*)(?:#.*)?/;

export class Token {
  readonly token: string;
  readonly categ: AbstractCCGCategory;
  readonly semantics: Expression | null;
  constructor(token: string, categ: AbstractCCGCategory, semantics: Expression | null = null) {
    this.token = token;
    this.categ = categ;
    this.semantics = semantics;
  }
  toString(): string {
    let s = `${this.categ}`;
    if (this.semantics) s += ` {${this.semantics}}`;
    return s;
  }
}

export class CCGLexicon {
  readonly start: AbstractCCGCategory;
  readonly primitives: string[];
  readonly families: Map<string, [AbstractCCGCategory, CCGVar | null]>;
  readonly entries: Map<string, Token[]>;

  constructor(
    start: string,
    primitives: string[],
    families: Map<string, [AbstractCCGCategory, CCGVar | null]>,
    entries: Map<string, Token[]>,
  ) {
    this.start = new PrimitiveCategory(start);
    this.primitives = primitives;
    this.families = families;
    this.entries = entries;
  }

  categories(word: string): Token[] {
    return this.entries.get(word) ?? [];
  }

  toString(): string {
    const keys = [...this.entries.keys()].sort();
    return keys.map((k) => `${k} => ${this.entries.get(k)!.map((t) => `${t.categ}`).join(" | ")}`).join("\n");
  }
}

export function fromString(lexStr: string, includeSemantics = false): CCGLexicon {
  CCGVar.resetId();
  let primitives: string[] = [];
  const families = new Map<string, [AbstractCCGCategory, CCGVar | null]>();
  const entries = new Map<string, Token[]>();

  for (const rawLine of lexStr.split("\n")) {
    const stripped = (COMMENTS_RE.exec(rawLine)?.[1] ?? "").trim();
    if (stripped === "") continue;

    if (stripped.startsWith(":-")) {
      primitives = primitives.concat(stripped.slice(2).split(",").map((s) => s.trim()).filter(Boolean));
    } else {
      const m = LEX_RE.exec(stripped);
      if (!m) throw new Error(`Cannot parse lexicon line: ${stripped}`);
      const ident = m[1]!, sep = m[2]!, rhs = m[3]!;
      const rhsM = RHS_RE.exec(rhs);
      if (!rhsM) throw new Error(`Cannot parse RHS: ${rhs}`);
      const catStr = rhsM[1]!, semanticsStr = rhsM[2];
      const primSet = new Set(primitives);
      const [cat] = augParseCategory(catStr.trim(), primSet, families);

      if (sep === "::") {
        // family definition: need var if present
        const [, v] = augParseCategory(catStr.trim(), primSet, families);
        families.set(ident, [cat, v]);
      } else {
        let semantics: Expression | null = null;
        if (includeSemantics) {
          if (!semanticsStr) throw new Error(`${stripped} must contain semantics because includeSemantics is true`);
          const sm = SEM_RE.exec(semanticsStr);
          semantics = logicFromString(sm![1]!);
        }
        const tok = new Token(ident, cat, semantics);
        if (!entries.has(ident)) entries.set(ident, []);
        entries.get(ident)!.push(tok);
      }
    }
  }
  if (primitives.length === 0) throw new Error("No primitives defined (missing :- line)");
  return new CCGLexicon(primitives[0]!, primitives, families, entries);
}

/** @deprecated use fromString */
export function parseLexicon(lexStr: string): CCGLexicon { return fromString(lexStr); }

export const openccgTinytiny: CCGLexicon = fromString(`
    :- S,NP,N
    Det :: NP/N
    Pro :: NP
    IntransVsg :: S\\NP[sg]
    IntransVpl :: S\\NP[pl]
    TransVsg :: S\\NP[sg]/NP
    TransVpl :: S\\NP[pl]/NP
    the => NP[sg]/N[sg]
    the => NP[pl]/N[pl]
    I => Pro
    me => Pro
    we => Pro
    us => Pro
    book => N[sg]
    books => N[pl]
    peach => N[sg]
    peaches => N[pl]
    policeman => N[sg]
    policemen => N[pl]
    boy => N[sg]
    boys => N[pl]
    sleep => IntransVsg
    sleep => IntransVpl
    eat => IntransVpl
    eat => TransVpl
    eats => IntransVsg
    eats => TransVsg
    see => TransVpl
    sees => TransVsg
`);
