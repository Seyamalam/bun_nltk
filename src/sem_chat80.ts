/**
 * Port of nltk.sem.chat80 — Chat-80 world database / Concept / Valuation helpers.
 *
 * Algorithms are ported (Concept graph closure, binary/unary concept building,
 * valuation assembly, lexical rule generation). Corpus loading (_str2records,
 * reading Prolog files via nltk.data) is stubbed with a helpful error because
 * it requires the NLTK Chat-80 corpus (corpora/chat80/*.pl). Likewise SQL and
 * shelve persistence throw corpus-missing errors. All pure-data helpers work
 * headlessly.
 */

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
    + `In bun_nltk this corpus is not bundled. Provide records programmatically via `
    + `clause2concepts / processBundle with pre-loaded data, or install NLTK data via `
    + `nltk.download('chat80') in Python.`
  );
}

// ---------------------------------------------------------------------------
// Concept
// ---------------------------------------------------------------------------
export class Concept {
  prefLabel: string;
  arity: number;
  altLabels: string[];
  closures: string[];
  private _extension: Set<string | [string,string]>;
  extension: Array<string | [string,string]>;

  constructor(prefLabel: string, arity: number, altLabels: string[] = [], closures: string[] = [], extension: Set<string | [string,string]> = new Set()) {
    this.prefLabel = prefLabel;
    this.arity = arity;
    this.altLabels = altLabels;
    this.closures = closures;
    this._extension = new Set(extension);
    this.extension = Array.from(this._extension).sort(compareExt);
  }

  toString(): string {
    return `Label = '${this.prefLabel}'\nArity = ${this.arity}\nExtension = ${JSON.stringify(this.extension)}`;
  }

  augment(data: string | [string,string]): Set<string | [string,string]> {
    this._extension.add(data as string);
    this.extension = Array.from(this._extension).sort(compareExt);
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
      for (const adjacent of [...g[x]!]) {
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
    const hasPairs = Array.from(this._extension).some(v => Array.isArray(v));
    if (!hasPairs) return;
    if (this.closures.includes("symmetric")) {
      const sym = new Set<[string,string]>();
      for (const e of this._extension) if (Array.isArray(e)) sym.add([e[1], e[0]] as [string,string]);
      for (const p of sym) this._extension.add(p as unknown as string);
    }
    if (this.closures.includes("transitive")) {
      const pairSet = new Set<[string,string]>(Array.from(this._extension).filter(v => Array.isArray(v)) as [string,string][]);
      const g = this.makeGraph(pairSet);
      const closed = this.transclose(g);
      const trans = this.makePairs(closed);
      for (const p of trans) this._extension.add(p as unknown as string);
    }
    this.extension = Array.from(this._extension).sort(compareExt);
  }

  get innerExtension(): Set<string | [string,string]> { return this._extension; }
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
  if (!records) corpusMissing(filename);
  const recs = records!;
  void relName;
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

/** Parse a Prolog file's lines into records — stubbed (requires corpus). */
export function str2records(_filename: string, _rel: string): string[][] {
  corpusMissing(_filename);
}

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
  for (const e of domain) valuation.set(e, e);
  if (lexicon) {
    // in browser/Node this would write chat_pnames.cfg — here just note
    void makeLex(domain);
  }
  return valuation;
}

export function makeLex(symbols: Set<string> | string[]): string[] {
  const arr = symbols instanceof Set ? Array.from(symbols) : symbols;
  const header = "\n##################################################################\n# Lexical rules (chat80) — generated by sem_chat80.makeLex\n##################################################################\n\n";
  const out: string[] = [header];
  const template = (s: string, pname: string) => `PropN[num=sg, sem=<\\P.(P ${s})>] -> '${pname}'\n`;
  for (const s of arr) {
    const caps = s.split("_").map(p => p.charAt(0).toUpperCase() + p.slice(1));
    out.push(template(s, caps.join("_")));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Stubs for corpus/file-dependent entry points
// ---------------------------------------------------------------------------

export function concepts(itemsParam: string | string[] = items): Concept[] {
  if (typeof itemsParam === "string") itemsParam = [itemsParam];
  const metas = (itemsParam as string[]).map(r => {
    const m = itemMetadata[r];
    if (!m) throw new Error(`Unknown Chat-80 item '${r}'`);
    return m;
  });
  // will throw corpusMissing because no preloaded records
  return Object.values(processBundle(metas));
}

export function valDump(_rels: RelationMeta[], _db: string): never {
  throw new Error(
    `chat80.valDump: persistence via shelve is Python-only. In bun_nltk, build a valuation with `
    + `processBundle + makeValuation and serialize with JSON. Corpus data still required via preloaded records.`
  );
}

export function valLoad(_db: string): never {
  throw new Error(`chat80.valLoad: shelve persistence is Python-only and corpus-dependent. Build valuations programmatically.`);
}

export function cities2table(_filename: string, _relName: string, _dbname: string, _verbose = false, _setup = false): never {
  throw new Error(
    `chat80.cities2table: requires sqlite3 and corpus file '${_filename}'. `
    + `In bun_nltk use a JS SQL layer (e.g. better-sqlite3) and provide records via str2records override.`
  );
}

export function sqlQuery(_dbname: string, _query: string): never {
  throw new Error(
    `chat80.sqlQuery: requires sqlite3 database '${_dbname}' built from Chat-80 corpora. `
    + `Build the DB in Python (cities2table) or provide a JS DB handle.`
  );
}

// ---------------------------------------------------------------------------
// Corpus reader stub (matches NLTK's Chat80CorpusReader surface)
// ---------------------------------------------------------------------------
export class Chat80CorpusReader {
  constructor(_root?: string, _files?: string[]) {}
  sqlQuery(_query: string): unknown[] {
    throw new Error(`Chat80CorpusReader.sqlQuery: corpus not available (Chat-80 Prolog KB not bundled).`);
  }
  query(_q: string): unknown[] {
    throw new Error(`Chat80CorpusReader.query: corpus not available (Chat-80 Prolog KB not bundled).`);
  }
}

export function sqlDemo(): void {
  throw new Error(`chat80.sqlDemo: requires city.db built from Chat-80 corpus. Run cities2table in Python first.`);
}

export function main(): void {
  throw new Error(`chat80.main: CLI entry point not available in JS runtime. Use processBundle/makeLex programmatically.`);
}

// Keep demo() for parity checklist
export function demo(): string {
  throw new Error(`chat80.demo: requires Chat-80 corpora (nltk_data/corpora/chat80). Build concepts via processBundle with preloaded records.`);
}
