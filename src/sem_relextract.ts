/**
 * Port of nltk.sem.relextract — Relation Extraction (539 LOC).
 * Pure algorithmic, no external corpora deps at runtime.
 * APIs are provided in both snake_case (faithful to NLTK) and camelCase.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const NE_CLASSES: Record<string, string[]> = {
  ieer: ["LOCATION","ORGANIZATION","PERSON","DURATION","DATE","CARDINAL","PERCENT","MONEY","MEASURE"],
  conll2002: ["LOC","PER","ORG"],
  ace: ["LOCATION","ORGANIZATION","PERSON","DURATION","DATE","CARDINAL","PERCENT","MONEY","MEASURE","FACILITY","GPE"],
};

export const short2long: Record<string,string> = { LOC:"LOCATION", ORG:"ORGANIZATION", PER:"PERSON" };
export const long2short: Record<string,string> = { LOCATION:"LOC", ORGANIZATION:"ORG", PERSON:"PER" };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function _expand(type: string): string {
  return short2long[type] ?? type;
}
export const expandType = _expand;

export function class_abbrev(type: string): string {
  return long2short[type] ?? type;
}
export const classAbbrev = class_abbrev;

type TaggedWord = [string,string];
type JoinItem = string | TaggedWord;

function tuple2str(tup: TaggedWord): string {
  // mirrors nltk.tag.tuple2str: "word/TAG"
  return `${tup[0]}/${tup[1]}`;
}

export function _join(lst: JoinItem[], sep=" ", untag=false): string {
  const allStrings = lst.every(x => typeof x === "string");
  if (allStrings) return (lst as string[]).join(sep);
  if (untag) return (lst as TaggedWord[]).map(t => Array.isArray(t) ? t[0]! : t as unknown as string).join(sep);
  return (lst as TaggedWord[]).map(t => Array.isArray(t) ? tuple2str(t as TaggedWord) : t as unknown as string).join(sep);
}
export const joinList = _join;

// Minimal html entity map
const ENTITY_DEFS: Record<string,string> = { amp:"&", lt:"<", gt:">", quot:'"', apos:"'", nbsp:"\u00a0", copy:"\u00a9", reg:"\u00ae" };

export function descape_entity(m: RegExpMatchArray): string {
  const key = m[1]!;
  return ENTITY_DEFS[key] ?? m[0]!;
}
export const descapeEntity = descape_entity;

export function list2sym(lst: JoinItem[]): string {
  let sym = _join(lst, "_", true);
  sym = sym.toLowerCase();
  sym = sym.replace(/&(\w+?);/g, (_match, p1: string) => ENTITY_DEFS[p1] ?? `&${p1};`);
  sym = sym.replace(/\./g, "");
  return sym;
}

// ---------------------------------------------------------------------------
// Chunk tree types
// ---------------------------------------------------------------------------

export interface NeTree { label(): string; leaves(): JoinItem[]; }

function isNeTree(x: unknown): x is NeTree {
  return typeof x === "object" && x !== null && typeof (x as NeTree).label === "function" && typeof (x as NeTree).leaves === "function";
}

export class SimpleNeTree implements NeTree {
  constructor(private _label: string, private _leaves: JoinItem[]) {}
  label(): string { return this._label; }
  leaves(): JoinItem[] { return this._leaves; }
}

export type ChunkTree = Array<string | TaggedWord | NeTree>;
export type SemiRel = [JoinItem[], NeTree | null];
export type RelDict = Record<string,string>;
export type IeDocument = { text: ChunkTree; headline: ChunkTree; docno?: string };

// ---------------------------------------------------------------------------
// tree2semi_rel
// ---------------------------------------------------------------------------

export function tree2semi_rel(tree: ChunkTree): SemiRel[] {
  const semiRels: SemiRel[] = [];
  let semiRel: SemiRel = [[], null];
  for (const dtr of tree) {
    if (!isNeTree(dtr)) {
      semiRel[0].push(dtr as JoinItem);
    } else {
      semiRel[1] = dtr as NeTree;
      semiRels.push(semiRel);
      semiRel = [[], null];
    }
  }
  return semiRels;
}
export const tree2semiRel = tree2semi_rel;

// ---------------------------------------------------------------------------
// semi_rel2reldict
// ---------------------------------------------------------------------------

export function semi_rel2reldict(pairs: SemiRel[], window=5, trace=false): RelDict[] {
  const result: RelDict[] = [];
  let p: SemiRel[] = [...pairs];
  while (p.length > 2) {
    const reldict: RelDict = {};
    reldict["lcon"] = _join(p[0]![0].slice(-window));
    reldict["subjclass"] = p[0]![1]!.label();
    reldict["subjtext"] = _join(p[0]![1]!.leaves());
    reldict["subjsym"] = list2sym(p[0]![1]!.leaves());
    reldict["filler"] = _join(p[1]![0]);
    reldict["untagged_filler"] = _join(p[1]![0], " ", true);
    reldict["objclass"] = p[1]![1]!.label();
    reldict["objtext"] = _join(p[1]![1]!.leaves());
    reldict["objsym"] = list2sym(p[1]![1]!.leaves());
    reldict["rcon"] = _join(p[2]![0].slice(0, window));
    if (trace) console.log(`(${reldict["untagged_filler"]}(${reldict["subjclass"]}, ${reldict["objclass"]})`);
    result.push(reldict);
    p = p.slice(1);
  }
  return result;
}
export const semiRel2reldict = semi_rel2reldict;

// ---------------------------------------------------------------------------
// extract_rels
// ---------------------------------------------------------------------------

function isIeDocument(x: unknown): x is IeDocument {
  return typeof x === "object" && x !== null && "text" in (x as Record<string,unknown>) && "headline" in (x as Record<string,unknown>);
}

export function extract_rels(
  subjclass: string | null,
  objclass: string | null,
  doc: ChunkTree | IeDocument,
  corpus="ace",
  pattern: RegExp | null = null,
  window=10,
): RelDict[] {
  if (subjclass && !(NE_CLASSES[corpus]?.includes(subjclass))) {
    if (NE_CLASSES[corpus]?.includes(_expand(subjclass))) subjclass = _expand(subjclass);
    else throw new Error(`your value for the subject type has not been recognized: ${subjclass}`);
  }
  if (objclass && !(NE_CLASSES[corpus]?.includes(objclass))) {
    if (NE_CLASSES[corpus]?.includes(_expand(objclass))) objclass = _expand(objclass);
    else throw new Error(`your value for the object type has not been recognized: ${objclass}`);
  }
  let pairs: SemiRel[];
  if (corpus === "ace" || corpus === "conll2002") {
    pairs = tree2semi_rel(doc as ChunkTree);
  } else if (corpus === "ieer") {
    const ie = doc as IeDocument;
    pairs = [...tree2semi_rel(ie.text), ...tree2semi_rel(ie.headline)];
  } else {
    throw new Error("corpus type not recognized");
  }
  const reldicts = semi_rel2reldict(pairs);
  const pat: RegExp = pattern ?? /.*/;
  return reldicts.filter(x => {
    const filler = x["filler"] ?? "";
    // emulate Python pattern.match: must match from start; but NLTK patterns contain .* so test suffices
    // Use exec and check not null; for faithful .match, ensure match starts at 0 when pattern is anchored,
    // but since patterns are user-supplied with .*, we just test existence.
    const m = (() => {
      if ((pat as RegExp).global) (pat as RegExp).lastIndex = 0;
      const res = (pat as RegExp).exec(filler);
      if (!res) return null;
      return res;
    })();
    const fillerTokens = filler.split(/\s+/).filter(Boolean).length;
    // Python: len(x["filler"].split()) <= window — Note split on whitespace counts tokens, punctuation included
    return x["subjclass"] === subjclass && fillerTokens <= window && m !== null && x["objclass"] === objclass;
  });
}

// camelCase wrapper with options object (as used by index.ts)
export function extractRels(
  subjClass: string,
  objClass: string,
  doc: ChunkTree | IeDocument,
  opts: { corpus?: string; pattern?: RegExp; window?: number } = {},
): RelDict[] {
  return extract_rels(subjClass, objClass, doc, opts.corpus ?? "ace", opts.pattern ?? null, opts.window ?? 10);
}

// Legacy helpers expected by older index shims
export interface RelDictLegacy { subjclass?: string; objclass?: string; [k:string]: unknown }

export function conll2002Clause(neClass: string, tree: unknown): RelDict[] {
  return extract_rels(neClass, neClass, tree as ChunkTree, "conll2002", null, 10);
}
export function ieerClause(tree: unknown): RelDict[] {
  return extract_rels("ORGANIZATION","LOCATION", tree as ChunkTree, "ieer", null, 10);
}
export function tree2semiotic(tree: unknown): string { return String(tree); }
export function mkRelextractPattern(class1: string, class2: string): RegExp {
  return new RegExp(`(${class1}).*?(${class2})`, "s");
}

// ---------------------------------------------------------------------------
// rtuple / clause serialization
// ---------------------------------------------------------------------------

function pyRepr(s: string): string {
  return `'${s.replace(/\\/g,"\\\\").replace(/'/g,"\\'")}'`;
}

export function rtuple(reldict: RelDict, lcon=false, rcon=false): string {
  const items: string[] = [
    class_abbrev(reldict["subjclass"] ?? ""),
    reldict["subjtext"] ?? "",
    reldict["filler"] ?? "",
    class_abbrev(reldict["objclass"] ?? ""),
    reldict["objtext"] ?? "",
  ];
  let format = "[%s: %r] %r [%s: %r]";
  const fmtArgs = [...items];
  if (lcon) { fmtArgs.unshift(reldict["lcon"] ?? ""); format = "...%r)" + format; }
  if (rcon) { fmtArgs.push(reldict["rcon"] ?? ""); format = format + "(%r..."; }
  let out = format;
  for (const arg of fmtArgs) {
    // replace first %s then %r alternating — do sequentially by placeholders in order
    if (out.includes("%s")) out = out.replace("%s", arg);
    else if (out.includes("%r")) out = out.replace("%r", pyRepr(arg));
  }
  // Above approach breaks when format interleaves %s/%r. Instead do correct positional:
  // Rebuild properly:
  // We'll redo by token replacement in order
  // Safer: rebuild from scratch matching Python logic
  const template = (() => {
    let t = "[%s: %r] %r [%s: %r]";
    if (lcon) t = "...%r)" + t;
    if (rcon) t = t + "(%r...";
    return t;
  })();
  const tokens = template.split(/(%s|%r)/);
  let idx = 0;
  let rebuilt = "";
  for (const tok of tokens) {
    if (tok === "%s") rebuilt += fmtArgs[idx++] ?? "";
    else if (tok === "%r") rebuilt += pyRepr(fmtArgs[idx++] ?? "");
    else rebuilt += tok;
  }
  return rebuilt;
}

export function clause(reldict: RelDict, relsym: string): string {
  return `${relsym}(${pyRepr(reldict["subjsym"] ?? "")}, ${pyRepr(reldict["objsym"] ?? "")})`;
}

// Demo stubs (corpora not bundled)
export function in_demo(_trace=0, _sql=true): void { console.log("in_demo requires ieer corpus — not available in JS runtime."); }
export const inDemo = in_demo;
export function roles_demo(_trace=0): void { console.log("roles_demo requires ieer corpus — not available in JS runtime."); }
export const rolesDemo = roles_demo;
export function ieer_headlines(): void { console.log("ieer_headlines requires ieer corpus — not available in JS runtime."); }
export const ieerHeadlines = ieer_headlines;
export function conllned(_trace=1): void { console.log("conllned requires conll2002 corpus — not available in JS runtime."); }
export function conllesp(): void { console.log("conllesp requires conll2002 corpus — not available in JS runtime."); }
export function ne_chunked(): void { console.log("ne_chunked requires treebank corpus — not available in JS runtime."); }
export const neChunked = ne_chunked;

// Back-compat: expose RelDict as type
export type { RelDict as RelDictType };
