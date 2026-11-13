/**
 * Port of nltk.sem.chat80 — Chat-80 world database / Concept / Valuation helpers.
 *
 * Algorithms are ported (Concept graph closure, binary/unary concept building,
 * valuation assembly, lexical rule generation). Corpus loading (_str2records)
 * reads the NLTK chat80 Prolog files via nltk.data.find semantics
 * (corpora/chat80/*.pl). SQL helpers use bun:sqlite where Python uses sqlite3,
 * keeping the same affinity/SQL semantics. shelve-based val_dump/val_load stay
 * honest gaps (shelve is a Python-only persistence format).
 */

import { existsSync, writeFileSync } from "node:fs";
import { pyError } from "./internals";
import { FileSystemPathPointer, find } from "./data";

export const notUnary = ["borders.pl", "contain.pl"];

// ---------------------------------------------------------------------------
// Metadata bundles (mirrors NLTK's chat80.py)
// ---------------------------------------------------------------------------
export interface RelationMeta {
  rel_name: string;
  closures: string[];
  schema: string[];
  filename: string;
}

export const borders: RelationMeta = { rel_name: "borders", closures: ["symmetric"], schema: ["region", "border"], filename: "borders.pl" };
export const contains: RelationMeta = { rel_name: "contains0", closures: ["transitive"], schema: ["region", "contain"], filename: "contain.pl" };
export const city: RelationMeta = { rel_name: "city", closures: [], schema: ["city", "country", "population"], filename: "cities.pl" };
export const country: RelationMeta = { rel_name: "country", closures: [], schema: ["country","region","latitude","longitude","area","population","capital","currency"], filename: "countries.pl" };
export const circle_of_lat: RelationMeta = { rel_name: "circle_of_latitude", closures: [], schema: ["circle_of_latitude","degrees"], filename: "world1.pl" };
export const circle_of_long: RelationMeta = { rel_name: "circle_of_longitude", closures: [], schema: ["circle_of_longitude","degrees"], filename: "world1.pl" };
export const continent: RelationMeta = { rel_name: "continent", closures: [], schema: ["continent"], filename: "world1.pl" };
export const region: RelationMeta = { rel_name: "in_continent", closures: [], schema: ["region","continent"], filename: "world1.pl" };
export const ocean: RelationMeta = { rel_name: "ocean", closures: [], schema: ["ocean"], filename: "world1.pl" };
export const sea: RelationMeta = { rel_name: "sea", closures: [], schema: ["sea"], filename: "world1.pl" };

export const items: string[] = ["borders","contains","city","country","circle_of_lat","circle_of_long","continent","region","ocean","sea"].sort();
export const itemMetadata: Record<string, RelationMeta> = {
  borders, contains, city, country, circle_of_lat, circle_of_long, continent, region, ocean, sea,
};
export const rels: RelationMeta[] = Object.values(itemMetadata);

function corpusMissing(filename: string): never {
  throw new Error(
    `nltk.sem.chat80: corpus file not available: '${filename}'. `
    + `This requires NLTK data 'corpora/chat80' (world1.pl, cities.pl, etc.). `
    + `Set NLTK_DATA to a directory containing corpora/chat80 (e.g. via `
    + `nltk.download('chat80') in Python), or pass records explicitly to `
    + `clause2concepts / processBundle.`
  );
}

// ---------------------------------------------------------------------------
// Python repr/str helpers for printed output
// ---------------------------------------------------------------------------

/** repr() of a Python str: single-quoted, with Python escaping. */
function pyStrRepr(s: string): string {
  let out = "'";
  for (const ch of s) {
    if (ch === "\\") out += "\\\\";
    else if (ch === "'") out += "\\'";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else out += ch;
  }
  return out + "'";
}

/** repr() of a Python value (str/int/tuple/list). */
function pyRepr(v: unknown): string {
  if (typeof v === "string") return pyStrRepr(v);
  if (typeof v === "number") return `${v}`;
  if (v === null || v === undefined) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (Array.isArray(v)) return `[${v.map(pyRepr).join(", ")}]`;
  return String(v);
}

/** repr() of a Python tuple: ('a', 'b', 1368) — trailing comma for 1-tuples. */
function pyTupleRepr(row: unknown[]): string {
  if (row.length === 1) return `(${pyRepr(row[0])},)`;
  return `(${row.map(pyRepr).join(", ")})`;
}

/** Python str.splitlines() over the common line boundaries. */
function splitlines(text: string): string[] {
  // eslint-disable-next-line no-control-regex -- CPython whitespace class
  return text.split(/\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/);
}

// ---------------------------------------------------------------------------
// SQLite plumbing — bun:sqlite where Python uses sqlite3, node:sqlite fallback
// ---------------------------------------------------------------------------

interface Chat80SqliteDb {
  exec(sql: string): unknown;
  prepare(sql: string): {
    run(...params: unknown[]): unknown;
    values(...params: unknown[]): unknown[][];
  };
  close(): void;
}

function openSqliteDb(dbPath: string): Chat80SqliteDb {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const req = (globalThis as Record<string, unknown>).require as ((m: string) => unknown) | undefined
    ?? (typeof require === "function" ? require : undefined);
  if (req) {
    try {
      const { Database } = req("bun:sqlite") as {
        Database: new (p: string) => {
          exec(sql: string): unknown;
          prepare(sql: string): { run(...p: unknown[]): unknown; values(...p: unknown[]): unknown[][] };
          close(): void;
        };
      };
      return new Database(dbPath);
    } catch { /* fall through to node:sqlite */ }
    try {
      const { DatabaseSync } = req("node:sqlite") as {
        DatabaseSync: new (p: string) => {
          exec(sql: string): unknown;
          prepare(sql: string): { run(...p: unknown[]): unknown; all(...p: unknown[]): unknown[] };
          close(): void;
        };
      };
      const db = new DatabaseSync(dbPath);
      return {
        exec: (sql) => db.exec(sql),
        prepare: (sql) => {
          const stmt = db.prepare(sql);
          return {
            run: (...p) => stmt.run(...p),
            values: (...p) => stmt.all(...p).map((r) => (Array.isArray(r) ? (r as unknown[]) : Object.values(r as object))),
          };
        },
        close: () => db.close(),
      };
    } catch { /* fall through */ }
  }
  throw pyError("ImportError", "chat80 requires sqlite3 support (bun:sqlite or node:sqlite)");
}

// ---------------------------------------------------------------------------
// Concept
// ---------------------------------------------------------------------------
export class Concept {
  prefLabel: string;
  arity: number;
  altLabels: string[];
  closures: string[];
  // Python keeps the extension in a set — tuples dedupe by VALUE, so the
  // backing store is a key→element map (Set of arrays would compare by identity).
  private _extension: Map<string, string | [string,string]>;
  extension: Array<string | [string,string]>;

  constructor(prefLabel: string, arity: number, altLabels: string[] = [], closures: string[] = [], extension: Iterable<string | [string,string]> = []) {
    this.prefLabel = prefLabel;
    this.arity = arity;
    this.altLabels = altLabels;
    this.closures = closures;
    this._extension = new Map();
    for (const e of extension) this._extension.set(extKey(e), e);
    this.extension = Array.from(this._extension.values()).sort(compareExt);
  }

  toString(): string {
    // "Label = '%s'\nArity = %s\nExtension = %s" — extension reprs as a
    // Python list of strings / ('a', 'b') tuples.
    const ext = `[${this.extension.map((e) => (Array.isArray(e) ? pyTupleRepr(e) : pyRepr(e))).join(", ")}]`;
    return `Label = '${this.prefLabel}'\nArity = ${this.arity}\nExtension = ${ext}`;
  }

  augment(data: string | [string,string]): Map<string, string | [string,string]> {
    this._extension.set(extKey(data), data);
    this.extension = Array.from(this._extension.values()).sort(compareExt);
    return this._extension;
  }

  private makeGraph(s: Set<[string,string]>): Record<string,string[]> {
    const g: Record<string,string[]> = {};
    for (const [x,y] of s) {
      if (x in g) g[x]!.push(y);
      else g[x] = [y];
    }
    return g;
  }

  private transclose(g: Record<string,string[]>): Record<string,string[]> {
    for (const x of Object.keys(g)) {
      for (const adjacent of Array.from(g[x]!)) {
        if (adjacent in g) {
          for (const y of g[adjacent]!) if (!g[x]!.includes(y)) g[x]!.push(y);
        }
      }
    }
    return g;
  }

  private makePairs(g: Record<string,string[]>): Set<[string,string]> {
    const pairs = new Set<[string,string]>();
    for (const node of Object.keys(g)) for (const adj of g[node]!) pairs.add([node, adj] as [string,string]);
    return pairs;
  }

  close(): void {
    // only meaningful for binary (pair) extensions
    const hasPairs = Array.from(this._extension.values()).some(v => Array.isArray(v));
    if (!hasPairs) return;
    if (this.closures.includes("symmetric")) {
      const sym = new Map<string, [string,string]>();
      for (const e of this._extension.values()) if (Array.isArray(e)) sym.set(extKey([e[1], e[0]]), [e[1], e[0]]);
      for (const p of sym.values()) this._extension.set(extKey(p), p);
    }
    if (this.closures.includes("transitive")) {
      const pairSet: [string,string][] = Array.from(this._extension.values()).filter((v): v is [string,string] => Array.isArray(v));
      const g = this.makeGraph(new Set(pairSet));
      const closed = this.transclose(g);
      const trans = this.makePairs(closed);
      for (const p of trans) this._extension.set(extKey(p), p);
    }
    this.extension = Array.from(this._extension.values()).sort(compareExt);
  }

  get innerExtension(): Map<string, string | [string,string]> { return this._extension; }
}

/** Value key for extension elements — Python dedupes tuples by value. */
function extKey(e: string | [string,string]): string {
  return Array.isArray(e) ? `${e[0]}${e[1]}` : e;
}

function compareExt(a: string | [string,string], b: string | [string,string]): number {
  const sa = Array.isArray(a) ? `${a[0]},${a[1]}` : a;
  const sb = Array.isArray(b) ? `${b[0]},${b[1]}` : b;
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Record / concept builders (pure, no corpus I/O)
// ---------------------------------------------------------------------------

export function unaryConcept(label: string, subj: number, records: string[][]): Concept {
  const c = new Concept(label, 1, [], [], new Set());
  for (const rec of records) c.augment(rec[subj]!);
  return c;
}

export function binaryConcept(label: string, closures: string[], subj: number, obj: number, records: string[][]): Concept {
  let pref = label;
  if (pref !== "border" && pref !== "contain") pref = pref + "_of";
  const c = new Concept(pref, 2, [], closures, new Set());
  for (const rec of records) c.augment([rec[subj]!, rec[obj]!] as [string,string]);
  c.close();
  return c;
}

export function clause2concepts(filename: string, relName: string, schema: string[], closures: string[] = [], records?: string[][]): Concept[] {
  // Python always loads via _str2records; `records` is a bun_nltk escape hatch.
  const recs = records ?? str2records(filename, relName);
  const concepts: Concept[] = [];
  const subj = 0;
  const pkey = schema[0]!;
  const fields = schema.slice(1);
  if (!notUnary.includes(filename)) concepts.push(unaryConcept(pkey, subj, recs));
  for (const field of fields) {
    const obj = schema.indexOf(field);
    concepts.push(binaryConcept(field, closures, subj, obj, recs));
  }
  return concepts;
}

/** nltk.sem.chat80._str2records — read a Prolog file from corpora/chat80 and
 * convert each `rel(...)` clause into a record (list of field strings). */
export function str2records(filename: string, rel: string): string[][] {
  const recs: string[][] = [];
  let contents: string;
  try {
    contents = find(`corpora/chat80/${filename}`).open("utf-8").read();
  } catch (e) {
    if (e instanceof Error && e.name === "LookupError") corpusMissing(filename);
    throw e;
  }
  for (const line of splitlines(contents)) {
    if (line.startsWith(rel)) {
      const stripped = line.split(rel + "(").join("").replace(/\)\.$/, "");
      recs.push(stripped.split(","));
    }
  }
  return recs;
}
export const _str2records = str2records;

export function processBundle(bundles: RelationMeta[], preloaded?: Map<string,string[][]>): Record<string, Concept> {
  const concepts: Record<string, Concept> = {};
  for (const rel of bundles) {
    const recs = preloaded?.get(rel.rel_name);
    const list = clause2concepts(rel.filename, rel.rel_name, rel.schema, rel.closures, recs);
    for (const c of list) {
      const label = c.prefLabel;
      if (label in concepts) {
        for (const d of c.extension) concepts[label]!.augment(d as string | [string,string]);
        concepts[label]!.close();
      } else concepts[label] = c;
    }
  }
  return concepts;
}
export const process_bundle = processBundle;

export function makeValuation(concepts: Concept[] | Record<string,Concept>, read = false, lexicon = false): Array<[string, Array<string | [string,string]>]> | Map<string, unknown> {
  const list = Array.isArray(concepts) ? concepts : Object.values(concepts);
  const vals: Array<[string, Array<string | [string,string]>]> = list.map(c => [c.prefLabel, [...c.extension]]);
  if (lexicon) read = true;
  if (read) {
    const m = new Map<string, unknown>(vals as [string, unknown][]);
    // add individual labels
    return labelIndivs(m, lexicon);
  }
  return vals;
}

export function labelIndivs(valuation: Map<string, unknown>, lexicon = false): Map<string, unknown> {
  // collect domain = all atomic individuals from valuation values
  const domain = new Set<string>();
  for (const [, ext] of valuation) {
    if (Array.isArray(ext)) for (const e of ext as (string | [string,string])[]) {
      if (typeof e === "string") domain.add(e);
      else { domain.add(e[0]); domain.add(e[1]); }
    }
  }
  // Valuation.domain is a sorted list in Python.
  const domainList = Array.from(domain).sort();
  for (const e of domainList) valuation.set(e, e);
  if (lexicon) {
    // label_indivs(lexicon=True) writes chat_pnames.cfg in the cwd.
    const lex = makeLex(domainList);
    writeFileSync("chat_pnames.cfg", lex.join(""));
  }
  return valuation;
}

export function makeLex(symbols: Set<string> | string[]): string[] {
  const arr = symbols instanceof Set ? Array.from(symbols) : symbols;
  const header = "\n##################################################################\n# Lexical rules automatically generated by running 'chat80.py -x'.\n##################################################################\n\n";
  const out: string[] = [header];
  const template = (s: string, pname: string) => `PropN[num=sg, sem=<\\P.(P ${s})>] -> '${pname}'\n`;
  for (const s of arr) {
    // str.capitalize(): first char upper, rest lower.
    const caps = s.split("_").map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
    out.push(template(s, caps.join("_")));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Corpus-facing entry points (nltk.sem.chat80)
// ---------------------------------------------------------------------------

export function concepts(itemsParam: string | string[] = items): Concept[] {
  if (typeof itemsParam === "string") itemsParam = [itemsParam];
  const metas = (itemsParam as string[]).map(r => {
    const m = itemMetadata[r];
    if (!m) throw pyError("KeyError", `'${r}'`);
    return m;
  });
  return Object.values(processBundle(metas));
}

export function valDump(_rels: RelationMeta[], _db: string): never {
  throw new Error(
    `chat80.valDump: persistence via shelve is Python-only. In bun_nltk, build a valuation with `
    + `processBundle + makeValuation and serialize with JSON. Corpus data still required via preloaded records.`
  );
}
export const val_dump = valDump;

export function valLoad(_db: string): never {
  throw new Error(`chat80.valLoad: shelve persistence is Python-only and corpus-dependent. Build valuations programmatically.`);
}
export const val_load = valLoad;

/** nltk.sem.chat80.cities2table — build the sqlite city table from cities.pl. */
export function cities2table(filename: string, relName: string, dbname: string, verbose = false, setup = false): void {
  const records = str2records(filename, relName);
  const connection = openSqliteDb(dbname);
  try {
    if (setup) {
      connection.exec(`CREATE TABLE city_table
        (City text, Country text, Population int)`);
    }
    const tableName = "city_table";
    const stmt = connection.prepare(`insert into ${tableName} values (?,?,?)`);
    for (const t of records) {
      stmt.run(t[0], t[1], t[2]);
      if (verbose) console.log(`inserting values into ${tableName}: `, pyRepr(t));
    }
    if (verbose) console.log(`Committing update to ${dbname}`);
  } finally {
    connection.close();
  }
}

/** nltk.sem.chat80.sql_query — run an SQL query, resolving dbname via
 * nltk.data.find. Returns the rows as tuples (arrays). */
export function sqlQuery(dbname: string, query: string): unknown[][] {
  let connection: Chat80SqliteDb;
  try {
    const path = find(dbname);
    const dbPath = path instanceof FileSystemPathPointer ? path.path : String(path);
    connection = openSqliteDb(dbPath);
  } catch (e) {
    // Python catches (ValueError, sqlite3.OperationalError) — find()'s
    // LookupError propagates uncaught.
    if (e instanceof Error && (e.name === "ValueError" || e.name === "OperationalError")) {
      process.stderr.write(`UserWarning: Make sure the database file ${dbname} is installed and uncompressed.\n`);
    }
    throw e;
  }
  try {
    return connection.prepare(query).values();
  } catch (e) {
    process.stderr.write(`UserWarning: Make sure the database file ${dbname} is installed and uncompressed.\n`);
    throw pyError("OperationalError", (e as Error).message);
  } finally {
    connection.close();
  }
}
export const sql_query = sqlQuery;

// ---------------------------------------------------------------------------
// Corpus reader (matches NLTK's Chat80CorpusReader surface)
// ---------------------------------------------------------------------------
export class Chat80CorpusReader {
  constructor(_root?: string, _files?: string[]) {}
  sqlQuery(query: string): unknown[][] {
    return sqlQuery("corpora/city_database/city.db", query);
  }
  query(_q: string): unknown[] {
    throw new Error(
      `Chat80CorpusReader.query: English-question evaluation is driven by the book's `
      + `sql0.fcfg grammar + evaluateString, not by a chat80 API.`
    );
  }
}

/** nltk.sem.chat80.sql_demo — print every row of city.db's city_table. */
export function sqlDemo(): string[] {
  const out: string[] = [];
  const emit = (s: string) => {
    out.push(s);
    console.log(s);
  };
  emit("");
  emit("Using SQL to extract rows from 'city.db' RDB.");
  for (const row of sqlQuery("corpora/city_database/city.db", "SELECT * FROM city_table")) {
    emit(pyTupleRepr(row));
  }
  return out;
}
export const sql_demo = sqlDemo;

export interface Chat80MainOptions {
  outdb?: string | null;
  indb?: string | null;
  concepts?: boolean;
  label?: string | null;
  verbose?: boolean;
  lex?: boolean;
  vocab?: boolean;
}

/** nltk.sem.chat80.main — OptionParser surface as an options object. */
export function main(options: Chat80MainOptions = {}): unknown {
  const verbose = options.verbose !== false;
  const outdb = options.outdb ?? null;
  const indb = options.indb ?? null;
  const label = options.label ?? null;
  const lex = options.lex ?? false;
  const vocab = options.vocab ?? false;
  const showConcepts = options.concepts ?? false;

  if (outdb && indb) throw pyError("ValueError", "Options --store and --load are mutually exclusive");

  if (outdb) {
    // write the valuation to a persistent database
    if (verbose) console.log(`Dumping a valuation to ${outdb}.db`);
    return valDump(rels, outdb); // honest gap: shelve
  }
  // try to read in a valuation from a database
  if (indb !== null) {
    const dbname = indb + ".db";
    if (!existsSync(dbname)) throw pyError("SystemExit", `Cannot read file: ${dbname}`);
    return valLoad(indb); // honest gap: shelve
  }
  // we need to create the valuation from scratch
  const conceptMap = processBundle(rels);
  const conceptList = Object.values(conceptMap);
  // just print out the vocabulary
  if (vocab) {
    const pairs = conceptList.map((c) => [c.arity, c.prefLabel] as [number, string]);
    pairs.sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
    for (const [arity, lbl] of pairs) console.log(lbl, arity);
    return pairs;
  }
  // show all the concepts
  if (showConcepts) {
    for (const c of conceptList) {
      console.log(`${c}`);
      console.log();
    }
  }
  if (label) {
    if (!(label in conceptMap)) throw pyError("KeyError", `'${label}'`);
    console.log(`${conceptMap[label]}`);
    return conceptMap[label];
  }
  // turn the concepts into a Valuation
  if (lex) {
    if (verbose) console.log("Writing out lexical rules");
    return makeValuation(conceptList, true, true);
  }
  const valuation = makeValuation(conceptList, true);
  console.log(valuation instanceof Map ? valuation : `${valuation}`);
  return valuation;
}

// Keep demo() for parity checklist
export function demo(): string {
  throw new Error(`chat80.demo: not an nltk.sem.chat80 API. Use sqlDemo() / main().`);
}

// snake_case aliases (mirroring NLTK names)
export const unary_concept = unaryConcept;
export const binary_concept = binaryConcept;
export const make_valuation = makeValuation;
export const label_indivs = labelIndivs;
export const make_lex = makeLex;
export const item_metadata = itemMetadata;
