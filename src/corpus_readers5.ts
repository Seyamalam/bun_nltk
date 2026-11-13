// nltk.corpus.reader.* — fifth tier: propbank, nombank, semcor, senseval, rte.
// Originals: nltk/corpus/reader/{propbank,nombank,semcor,senseval,rte}.py
// XML elements/views come from ./xmldocs (ElementTree clone) and
// ./corpus_readers4 (XMLCorpusReader/XMLCorpusView).

import { pyError } from "./internals";
import { PathPointer } from "./data";
import { SeekableUnicodeStreamReader } from "./corpus_stream";
import {
  StreamBackedCorpusView, concat, read_line_block, find_corpus_fileids,
} from "./corpus_view";
import { CorpusReader } from "./corpus_api";
import type { EncodingSpec } from "./corpus_api";
import { AbstractLazySequence, LazyConcatenation } from "./collections";
import { SimpleTree } from "./corpus_tree";
import type { SimpleTreeChild } from "./corpus_tree";
import { XMLElement, parseXmlString, parseXmlStream } from "./xmldocs";
import { XMLCorpusReader, XMLCorpusView } from "./corpus_readers4";

// { shared python-isms

/** Python repr() of a string: prefers ', switches to " when ' is present. */
function pyStrRepr(s: string): string {
  const q = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (ch === "\\") out += "\\\\";
    else if (ch === q) out += "\\" + ch;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (cp < 0x20 || cp === 0x7f) out += `\\x${cp.toString(16).padStart(2, "0")}`;
    else out += ch;
  }
  return q + out + q;
}

/** Marker class so Python (a, b) tuples repr as tuples, not lists. */
class PyTuple<T = unknown> extends Array<T> {
  static make<T>(items: T[]): PyTuple<T> {
    const t = new PyTuple<T>();
    t.push(...items);
    return t;
  }
}
function pyTuple<T>(...items: T[]): PyTuple<T> {
  return PyTuple.make(items);
}

/** Python repr() of a value (None/True/False/str/tuple/list/other). */
function pyValueRepr(v: unknown): string {
  if (v === null || v === undefined) return "None";
  if (v === true) return "True";
  if (v === false) return "False";
  if (typeof v === "string") return pyStrRepr(v);
  if (v instanceof PyTuple) {
    const inner = v.map((x) => pyValueRepr(x)).join(", ");
    return v.length === 1 ? `(${inner},)` : `(${inner})`;
  }
  if (Array.isArray(v)) return `[${v.map((x) => pyValueRepr(x)).join(", ")}]`;
  return String(v);
}

/** Python int(s): trims whitespace, allows sign and single underscores. */
function pyInt(s: string): number {
  const t = s.trim();
  if (!/^[+-]?\d+(_\d+)*$/.test(t)) {
    throw pyError("ValueError", `invalid literal for int() with base 10: ${pyStrRepr(s)}`);
  }
  return parseInt(t.replace(/_/g, ""), 10);
}

/** Python ``str.split(sep, maxsplit)`` — remainder stays in the last element. */
function splitMax(s: string, sep: string, maxsplit: number): string[] {
  const out: string[] = [];
  let rest = s;
  for (let k = 0; k < maxsplit; k++) {
    const idx = rest.indexOf(sep);
    if (idx < 0) break;
    out.push(rest.slice(0, idx));
    rest = rest.slice(idx + sep.length);
  }
  out.push(rest);
  return out;
}

/** Python ``s.split()`` — runs of whitespace, discarding empties. */
function wsTokenize(s: string | null | undefined): string[] {
  if (s === null || s === undefined) {
    throw pyError("AttributeError", "'NoneType' object has no attribute 'split'");
  }
  return s.split(/\s+/).filter((x) => x !== "");
}

/** ``elt[key]`` child indexing — IndexError when out of range. */
function eltAt(elt: XMLElement, i: number): XMLElement {
  const c = elt.get(i);
  if (c === undefined) throw pyError("IndexError", "list index out of range");
  return c;
}

/** ``elt.attrib[key]`` — KeyError when absent. */
function eltAttr(elt: XMLElement, k: string): string {
  const v = elt.attrib.get(k);
  if (v === undefined) throw pyError("KeyError", pyStrRepr(k));
  return v;
}

function bisectRightNums(arr: number[], x: number): number {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (x < arr[mid]!) hi = mid; else lo = mid + 1;
  }
  return lo;
}

// { XML helpers (encoding-aware file parse, mirroring binary expat input)

function xmlEncodingFromFirstLine(s: string): string {
  // s is a latin-1 view of the raw bytes, so BOMs appear as char runs.
  if (s.startsWith("ÿþ")) return "utf-16be";               // BOM_UTF16_BE
  if (s.startsWith("þÿ")) return "utf-16le";               // BOM_UTF16_LE
  if (s.startsWith("\0\0þÿ")) return "utf-32-be";          // BOM_UTF32_BE
  if (s.startsWith("ÿþ\0\0")) return "utf-32-le";          // BOM_UTF32_LE
  if (s.startsWith("ï»¿")) return "utf-8";                 // BOM_UTF8
  let m = /^\s*<\?xml\b.*\bencoding="([^"]+)"/.exec(s);
  if (m) return m[1]!;
  m = /^\s*<\?xml\b.*\bencoding='([^']+)'/.exec(s);
  if (m) return m[1]!;
  return "utf-8";
}

/** Open a PathPointer the way ElementTree sees a binary file: detect the
 * encoding (BOM/XML decl on raw bytes), then decode with it. */
function openXmlPath(pp: PathPointer): SeekableUnicodeStreamReader {
  const probe = pp.open(null);
  let first: string;
  try {
    first = probe.readline();
  } finally {
    probe.close();
  }
  return pp.open(xmlEncodingFromFirstLine(first));
}

/** ``with pp.open() as fp: safe_parse(fp).getroot()`` */
export function parseXmlFile(pp: PathPointer): XMLElement {
  const fp = openXmlPath(pp);
  try {
    return parseXmlStream(fp);
  } finally {
    fp.close();
  }
}
export const parse_xml_file = parseXmlFile;

// { shared propbank/nombank pointer machinery

type AnyBankPointer = PropbankPointer | NombankPointer;

function isBankTreePointer(p: unknown): p is PropbankTreePointer | NombankTreePointer {
  return p instanceof PropbankTreePointer || p instanceof NombankTreePointer;
}

let ptrIdCounter = 0;
const ptrIds = new WeakMap<object, number>();
/** Approximation of ``id(obj)`` for ``id(self) < id(other)`` fallbacks. */
function ptrId(o: object): number {
  let id = ptrIds.get(o);
  if (id === undefined) { id = ++ptrIdCounter; ptrIds.set(o, id); }
  return id;
}

/** Python ``a == b`` for bank pointers: tree pointers compare wordnum/height
 * of first pieces; chain/split pointers only match by identity. */
function bankPtrEq(a: AnyBankPointer, b: AnyBankPointer): boolean {
  if (a === b) return true;
  if (!isBankTreePointer(a)) return false; // non-tree __eq__ is identity
  return a.eq(b);
}

/** Python ``a < b`` for bank pointers, incl. the reflected ``b.__gt__(a)``
 * fallthrough and the chain-vs-chain TypeError. */
function bankPtrLt(a: AnyBankPointer, b: AnyBankPointer): boolean {
  if (isBankTreePointer(a)) return a.lt(b);
  if (isBankTreePointer(b)) {
    // total_ordering _gt_from_lt(b, a) = (not b < a) and b != a
    return !(b.lt(a)) && !(b.eq(a));
  }
  throw pyError("TypeError",
    `'<' not supported between instances of '${a.constructor.name}' and '${b.constructor.name}'`);
}

/** ``sorted()`` of (pointer, argid) tuples: ptr order then argid. */
function bankArgCmp(x: [AnyBankPointer, string], y: [AnyBankPointer, string]): number {
  if (bankPtrEq(x[0], y[0])) return x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0;
  if (bankPtrLt(x[0], y[0])) return -1;
  return bankPtrLt(y[0], x[0]) ? 1 : 0;
}

/** Minimal interface for a parse corpus (e.g. BracketParseCorpusReader). */
export interface BankParseCorpus {
  fileids(): string[];
  parsed_sents(fileids?: string | string[] | null): unknown;
}

function corpusTreeAt(parseCorpus: BankParseCorpus, fileid: string, sentnum: number): SimpleTree | null {
  if (!parseCorpus.fileids().includes(fileid)) return null;
  return (parseCorpus.parsed_sents(fileid) as AbstractLazySequence<SimpleTree>).get(sentnum);
}

// { propbank

export class PropbankCorpusReader extends CorpusReader {
  protected _propfile: string;
  protected _framefiles: string[];
  protected _verbsfile: string | null;
  protected _parse_fileid_xform: ((fileid: string) => string) | null;
  protected _parse_corpus: BankParseCorpus | null;

  constructor(root: string | PathPointer, propfile: string,
    framefiles: string | string[] = "", verbsfile: string | null = null,
    parseFileidXform: ((fileid: string) => string) | null = null,
    parseCorpus: BankParseCorpus | null = null, encoding: EncodingSpec = "utf8") {
    // If framefiles is specified as a regexp, expand it (with the raw root,
    // so a plain string root fails like NLTK's find_corpus_fileids).
    const ffiles = typeof framefiles === "string"
      ? find_corpus_fileids(root as PathPointer, framefiles)
      : [...framefiles];
    super(root, [propfile, verbsfile, ...ffiles] as string[], encoding);
    this._propfile = propfile;
    this._framefiles = ffiles;
    this._verbsfile = verbsfile;
    this._parse_fileid_xform = parseFileidXform;
    this._parse_corpus = parseCorpus;
  }

  private _abspathOf(fileid: string | null): PathPointer {
    if (fileid === null) {
      throw pyError("TypeError", "expected str, bytes or os.PathLike object, not NoneType");
    }
    return this.abspath(fileid);
  }

  /** A corpus view that acts as a list of ``PropbankInstance`` objects. */
  instances(baseform: string | null = null): unknown {
    const instanceFilter = baseform !== null
      ? (inst: PropbankInstance) => inst.baseform === baseform
      : undefined;
    return new StreamBackedCorpusView(
      this._abspathOf(this._propfile),
      (s) => this._readInstanceBlock(s, instanceFilter),
      0, this.encoding(this._propfile));
  }

  /** A corpus view listing each line of the annotation file. */
  lines(): unknown {
    return new StreamBackedCorpusView(
      this._abspathOf(this._propfile), read_line_block, 0, this.encoding(this._propfile));
  }

  /** The xml description for the given roleset. */
  roleset(rolesetId: string): XMLElement {
    const baseform = rolesetId.split(".")[0]!;
    const framefile = `frames/${baseform}.xml`;
    if (!this._framefiles.includes(framefile)) {
      throw pyError("ValueError", `Frameset file for ${rolesetId} not found`);
    }
    // The encoding for XML fileids is specified by the file itself.
    const etree = parseXmlFile(this._abspathOf(framefile));
    for (const roleset of etree.findall("predicate/roleset")) {
      if (eltAttr(roleset, "id") === rolesetId) return roleset;
    }
    throw pyError("ValueError", `Roleset ${rolesetId} not found in ${framefile}`);
  }

  /** List of xml descriptions for rolesets. */
  rolesets(baseform: string | null = null): unknown {
    let framefiles: string[];
    if (baseform !== null) {
      const framefile = `frames/${baseform}.xml`;
      if (!this._framefiles.includes(framefile)) {
        throw pyError("ValueError", `Frameset file for ${baseform} not found`);
      }
      framefiles = [framefile];
    } else {
      framefiles = this._framefiles;
    }
    const rsets = framefiles.map((ff) => parseXmlFile(this._abspathOf(ff)).findall("predicate/roleset"));
    return new LazyConcatenation(rsets);
  }

  /** A corpus view listing all verb lemmas (from the verbs file). */
  verbs(): unknown {
    return new StreamBackedCorpusView(
      this._abspathOf(this._verbsfile), read_line_block, 0,
      this._verbsfile === null ? null : this.encoding(this._verbsfile));
  }

  private _readInstanceBlock(stream: SeekableUnicodeStreamReader,
    instanceFilter?: (inst: PropbankInstance) => boolean): PropbankInstance[] {
    const block: PropbankInstance[] = [];
    // Read 100 at a time.
    for (let i = 0; i < 100; i++) {
      const line = stream.readline().trim();
      if (line) {
        const inst = PropbankInstance.parse(line, this._parse_fileid_xform, this._parse_corpus);
        if (instanceFilter === undefined || instanceFilter(inst)) block.push(inst);
      }
    }
    return block;
  }
}

export class PropbankInstance {
  fileid: string;
  sentnum: number;
  wordnum: number;
  tagger: string;
  roleset: string;
  inflection: PropbankInflection;
  predicate: PropbankPointer;
  arguments: Array<[PropbankPointer, string]>;
  parse_corpus: BankParseCorpus | null;

  constructor(fileid: string, sentnum: number, wordnum: number, tagger: string,
    roleset: string, inflection: PropbankInflection, predicate: PropbankPointer,
    args: Array<[PropbankPointer, string]>, parseCorpus: BankParseCorpus | null = null) {
    this.fileid = fileid;
    this.sentnum = sentnum;
    this.wordnum = wordnum;
    this.tagger = tagger;
    this.roleset = roleset;
    this.inflection = inflection;
    this.predicate = predicate;
    this.arguments = args;
    this.parse_corpus = parseCorpus;
  }

  /** The baseform of the predicate. */
  get baseform(): string {
    return this.roleset.split(".")[0]!;
  }
  get baseForm(): string { return this.baseform; }

  /** The sense number of the predicate. */
  get sensenumber(): string {
    const parts = this.roleset.split(".");
    if (parts[1] === undefined) throw pyError("IndexError", "list index out of range");
    return parts[1];
  }
  get senseNumber(): string { return this.sensenumber; }

  /** Identifier of the predicate. */
  get predid(): string {
    return "rel";
  }
  get predId(): string { return this.predid; }

  /** The parse tree for this instance, or null if not available. */
  get tree(): SimpleTree | null {
    if (this.parse_corpus === null) return null;
    return corpusTreeAt(this.parse_corpus, this.fileid, this.sentnum);
  }

  repr(): string {
    return `<PropbankInstance: ${this.fileid}, sent ${this.sentnum}, word ${this.wordnum}>`;
  }

  toString(): string {
    let s = `${this.fileid} ${this.sentnum} ${this.wordnum} ${this.tagger} ${this.roleset} ${this.inflection}`;
    const items: Array<[AnyBankPointer, string]> = [
      ...this.arguments as Array<[AnyBankPointer, string]>,
      [this.predicate, "rel"],
    ];
    items.sort(bankArgCmp);
    for (const [argloc, argid] of items) s += ` ${argloc}-${argid}`;
    return s;
  }

  static parse(s: string, parseFileidXform: ((fileid: string) => string) | null = null,
    parseCorpus: BankParseCorpus | null = null): PropbankInstance {
    const pieces = s.trim().split(/\s+/).filter((x) => x !== "");
    if (pieces.length < 7) {
      throw pyError("ValueError", `Badly formatted propbank line: ${pyStrRepr(s)}`);
    }
    let [fileid, sentnumS, wordnumS, tagger, roleset, inflectionS] =
      pieces as [string, string, string, string, string, string];
    const rel = pieces.slice(6).filter((p) => p.endsWith("-rel"));
    const args = pieces.slice(6).filter((p) => !p.endsWith("-rel"));
    if (rel.length !== 1) {
      throw pyError("ValueError", `Badly formatted propbank line: ${pyStrRepr(s)}`);
    }
    if (parseFileidXform !== null) fileid = parseFileidXform(fileid);
    // Any malformed numeric field / inflection / pointer surfaces as the same
    // clear message, so callers catch a single error for a malformed line.
    try {
      const sentnum = pyInt(sentnumS!);
      const wordnum = pyInt(wordnumS!);
      const inflection = PropbankInflection.parse(inflectionS!);
      const predicate = PropbankTreePointer.parse(rel[0]!.slice(0, -4));
      const argsParsed: Array<[PropbankPointer, string]> = [];
      for (const arg of args) {
        const pair = splitMax(arg, "-", 1);
        if (pair.length !== 2) throw pyError("ValueError", "");
        argsParsed.push([PropbankTreePointer.parse(pair[0]!), pair[1]!]);
      }
      return new PropbankInstance(fileid, sentnum, wordnum, tagger!, roleset!,
        inflection, predicate, argsParsed, parseCorpus);
    } catch (e) {
      if (e instanceof Error && e.name === "ValueError") {
        throw pyError("ValueError", `Badly formatted propbank line: ${pyStrRepr(s)}`);
      }
      throw e;
    }
  }
}

export class PropbankPointer {
  constructor() {
    if (new.target === PropbankPointer) throw pyError("NotImplementedError", "");
  }
}

export class PropbankChainTreePointer extends PropbankPointer {
  pieces: PropbankPointer[];
  constructor(pieces: PropbankPointer[]) {
    super();
    this.pieces = pieces;
  }
  override toString(): string { return this.pieces.map((p) => `${p}`).join("*"); }
  repr(): string { return `<PropbankChainTreePointer: ${this}>`; }
  select(tree: SimpleTree | null): SimpleTree {
    if (tree === null) throw pyError("ValueError", "Parse tree not available");
    return new SimpleTree("*CHAIN*", this.pieces.map((p) => (p as PropbankTreePointer | PropbankChainTreePointer | PropbankSplitTreePointer).select(tree)));
  }
}

export class PropbankSplitTreePointer extends PropbankPointer {
  pieces: PropbankTreePointer[];
  constructor(pieces: PropbankTreePointer[]) {
    super();
    this.pieces = pieces;
  }
  override toString(): string { return this.pieces.map((p) => `${p}`).join(","); }
  repr(): string { return `<PropbankSplitTreePointer: ${this}>`; }
  select(tree: SimpleTree | null): SimpleTree {
    if (tree === null) throw pyError("ValueError", "Parse tree not available");
    return new SimpleTree("*SPLIT*", this.pieces.map((p) => p.select(tree)));
  }
}

export class PropbankTreePointer extends PropbankPointer {
  wordnum: number;
  height: number;

  constructor(wordnum: number, height: number) {
    super();
    this.wordnum = wordnum;
    this.height = height;
  }

  static parse(s: string): PropbankPointer {
    // Deal with chains (xx*yy*zz)
    let pieces = s.split("*");
    if (pieces.length > 1) {
      return new PropbankChainTreePointer(pieces.map((elt) => PropbankTreePointer.parse(elt)));
    }
    // Deal with split args (xx,yy,zz)
    pieces = s.split(",");
    if (pieces.length > 1) {
      return new PropbankSplitTreePointer(
        pieces.map((elt) => PropbankTreePointer.parse(elt) as PropbankTreePointer));
    }
    // Deal with normal pointers.
    pieces = s.split(":");
    if (pieces.length !== 2) {
      throw pyError("ValueError", `bad propbank pointer ${pyStrRepr(s)}`);
    }
    return new PropbankTreePointer(pyInt(pieces[0]!), pyInt(pieces[1]!));
  }

  override toString(): string { return `${this.wordnum}:${this.height}`; }
  repr(): string { return `PropbankTreePointer(${this.wordnum}, ${this.height})`; }

  eq(other: unknown): boolean {
    let o = other;
    while (o instanceof PropbankChainTreePointer || o instanceof PropbankSplitTreePointer) {
      o = o.pieces[0];
    }
    if (!(o instanceof PropbankTreePointer)) return this === o;
    return this.wordnum === o.wordnum && this.height === o.height;
  }
  ne(other: unknown): boolean { return !this.eq(other); }
  lt(other: unknown): boolean {
    let o = other;
    while (o instanceof PropbankChainTreePointer || o instanceof PropbankSplitTreePointer) {
      o = o.pieces[0];
    }
    if (!(o instanceof PropbankTreePointer)) {
      return this === o ? false : ptrId(this) < ptrId(o as object);
    }
    return this.wordnum < o.wordnum || (this.wordnum === o.wordnum && -this.height < -o.height);
  }

  select(tree: SimpleTree | null): SimpleTreeChild {
    if (tree === null) throw pyError("ValueError", "Parse tree not available");
    const tp = this.treepos(tree);
    let node: SimpleTreeChild = tree;
    for (const i of tp) {
      if (!(node instanceof SimpleTree)) {
        throw pyError("TypeError", "object does not support indexing");
      }
      if (i >= node.children.length) {
        throw pyError("IndexError", "list index out of range");
      }
      node = node.children[i]!;
    }
    return node;
  }

  /** Convert this pointer to a standard 'tree position' pointer, given
   * that it points to the given tree. */
  treepos(tree: SimpleTree | null): number[] {
    if (tree === null) throw pyError("ValueError", "Parse tree not available");
    const stack: SimpleTreeChild[] = [tree];
    const treepos: number[] = [];
    let wordnum = 0;
    for (;;) {
      const top = stack[stack.length - 1];
      if (top === undefined) throw pyError("IndexError", "list index out of range");
      if (top instanceof SimpleTree) {
        // Select the next child.
        if (treepos.length < stack.length) treepos.push(0);
        else treepos[treepos.length - 1]! += 1;
        // Update the stack.
        if (treepos[treepos.length - 1]! < top.children.length) {
          stack.push(top.children[treepos[treepos.length - 1]!]!);
        } else {
          // End of node's child list: pop up a level.
          stack.pop();
          treepos.pop();
        }
      } else {
        // word node:
        if (wordnum === this.wordnum) {
          return treepos.slice(0, treepos.length - this.height - 1);
        }
        wordnum += 1;
        stack.pop();
      }
    }
  }
}

export class PropbankInflection {
  // { Inflection Form
  static INFINITIVE = "i";
  static GERUND = "g";
  static PARTICIPLE = "p";
  static FINITE = "v";
  // { Inflection Tense
  static FUTURE = "f";
  static PAST = "p";
  static PRESENT = "n";
  // { Inflection Aspect
  static PERFECT = "p";
  static PROGRESSIVE = "o";
  static PERFECT_AND_PROGRESSIVE = "b";
  // { Inflection Person
  static THIRD_PERSON = "3";
  // { Inflection Voice
  static ACTIVE = "a";
  static PASSIVE = "p";
  // { Inflection
  static NONE = "-";
  // }

  form: string;
  tense: string;
  aspect: string;
  person: string;
  voice: string;

  constructor(form = "-", tense = "-", aspect = "-", person = "-", voice = "-") {
    this.form = form;
    this.tense = tense;
    this.aspect = aspect;
    this.person = person;
    this.voice = voice;
  }

  toString(): string {
    return this.form + this.tense + this.aspect + this.person + this.voice;
  }
  repr(): string { return `<PropbankInflection: ${this}>`; }

  static _VALIDATE = /^[igpv-][fpn-][pob-][3-][ap-]$/;

  static parse(s: string): PropbankInflection {
    if (typeof s !== "string") throw pyError("TypeError", "expected a string");
    if (s.length !== 5 || !PropbankInflection._VALIDATE.test(s)) {
      throw pyError("ValueError", `Bad propbank inflection string ${pyStrRepr(s)}`);
    }
    return new PropbankInflection(s[0], s[1], s[2], s[3], s[4]);
  }
}

// { nombank

export class NombankCorpusReader extends CorpusReader {
  protected _nomfile: string;
  protected _nounsfile: string | null;
  protected _parse_fileid_xform: ((fileid: string) => string) | null;
  protected _parse_corpus: BankParseCorpus | null;

  constructor(root: string | PathPointer, nomfile: string,
    framefiles: string | string[] = "", nounsfile: string | null = null,
    parseFileidXform: ((fileid: string) => string) | null = null,
    parseCorpus: BankParseCorpus | null = null, encoding: EncodingSpec = "utf8") {
    // NLTK expands a regexp framefiles against the raw root (TypeError for a
    // plain string root); the result is then passed to CorpusReader as-is.
    if (typeof framefiles === "string") find_corpus_fileids(root as PathPointer, framefiles);
    super(root, framefiles, encoding);
    this._nomfile = nomfile;
    this._nounsfile = nounsfile;
    this._parse_fileid_xform = parseFileidXform;
    this._parse_corpus = parseCorpus;
  }

  private _abspathOf(fileid: string | null): PathPointer {
    if (fileid === null) {
      throw pyError("TypeError", "expected str, bytes or os.PathLike object, not NoneType");
    }
    return this.abspath(fileid);
  }

  /** A corpus view that acts as a list of ``NombankInstance`` objects. */
  instances(baseform: string | null = null): unknown {
    const instanceFilter = baseform !== null
      ? (inst: NombankInstance) => inst.baseform === baseform
      : undefined;
    return new StreamBackedCorpusView(
      this._abspathOf(this._nomfile),
      (s) => this._readInstanceBlock(s, instanceFilter),
      0, this.encoding(this._nomfile));
  }

  /** A corpus view listing each line of the annotation file. */
  lines(): unknown {
    return new StreamBackedCorpusView(
      this._abspathOf(this._nomfile), read_line_block, 0, this.encoding(this._nomfile));
  }

  /** The xml description for the given roleset. */
  roleset(rolesetId: string): XMLElement {
    let baseform = rolesetId.split(".")[0]!;
    baseform = baseform.replaceAll("perc-sign", "%");
    baseform = baseform.replaceAll("oneslashonezero", "1/10").replaceAll("1/10", "1-slash-10");
    const framefile = `frames/${baseform}.xml`;
    if (!this.fileids().includes(framefile)) {
      throw pyError("ValueError", `Frameset file for ${rolesetId} not found`);
    }
    // The encoding for XML fileids is specified by the file itself.
    const etree = parseXmlFile(this._abspathOf(framefile));
    for (const roleset of etree.findall("predicate/roleset")) {
      if (eltAttr(roleset, "id") === rolesetId) return roleset;
    }
    throw pyError("ValueError", `Roleset ${rolesetId} not found in ${framefile}`);
  }

  /** List of xml descriptions for rolesets. */
  rolesets(baseform: string | null = null): unknown {
    let framefiles: string[];
    if (baseform !== null) {
      const framefile = `frames/${baseform}.xml`;
      if (!this.fileids().includes(framefile)) {
        throw pyError("ValueError", `Frameset file for ${baseform} not found`);
      }
      framefiles = [framefile];
    } else {
      framefiles = this.fileids();
    }
    const rsets = framefiles.map((ff) => parseXmlFile(this._abspathOf(ff)).findall("predicate/roleset"));
    return new LazyConcatenation(rsets);
  }

  /** A corpus view listing all noun lemmas (from the nouns file). */
  nouns(): unknown {
    return new StreamBackedCorpusView(
      this._abspathOf(this._nounsfile), read_line_block, 0,
      this._nounsfile === null ? null : this.encoding(this._nounsfile));
  }

  private _readInstanceBlock(stream: SeekableUnicodeStreamReader,
    instanceFilter?: (inst: NombankInstance) => boolean): NombankInstance[] {
    const block: NombankInstance[] = [];
    // Read 100 at a time.
    for (let i = 0; i < 100; i++) {
      const line = stream.readline().trim();
      if (line) {
        const inst = NombankInstance.parse(line, this._parse_fileid_xform, this._parse_corpus);
        if (instanceFilter === undefined || instanceFilter(inst)) block.push(inst);
      }
    }
    return block;
  }
}

export class NombankInstance {
  fileid: string;
  sentnum: number;
  wordnum: number;
  baseform: string;
  sensenumber: string;
  predicate: NombankPointer;
  predid: string;
  arguments: Array<[NombankPointer, string]>;
  parse_corpus: BankParseCorpus | null;

  constructor(fileid: string, sentnum: number, wordnum: number, baseform: string,
    sensenumber: string, predicate: NombankPointer, predid: string,
    args: Array<[NombankPointer, string]>, parseCorpus: BankParseCorpus | null = null) {
    this.fileid = fileid;
    this.sentnum = sentnum;
    this.wordnum = wordnum;
    this.baseform = baseform;
    this.sensenumber = sensenumber;
    this.predicate = predicate;
    this.predid = predid;
    this.arguments = args;
    this.parse_corpus = parseCorpus;
  }

  get baseForm(): string { return this.baseform; }
  get senseNumber(): string { return this.sensenumber; }
  get predId(): string { return this.predid; }

  /** The name of the roleset used by this instance's predicate. */
  get roleset(): string {
    let r = this.baseform.replaceAll("%", "perc-sign");
    r = r.replaceAll("1/10", "1-slash-10").replaceAll("1-slash-10", "oneslashonezero");
    return `${r}.${this.sensenumber}`;
  }

  /** The parse tree for this instance, or null if not available. */
  get tree(): SimpleTree | null {
    if (this.parse_corpus === null) return null;
    return corpusTreeAt(this.parse_corpus, this.fileid, this.sentnum);
  }

  repr(): string {
    return `<NombankInstance: ${this.fileid}, sent ${this.sentnum}, word ${this.wordnum}>`;
  }

  toString(): string {
    let s = `${this.fileid} ${this.sentnum} ${this.wordnum} ${this.baseform} ${this.sensenumber}`;
    const items: Array<[AnyBankPointer, string]> = [
      ...this.arguments as Array<[AnyBankPointer, string]>,
      [this.predicate, "rel"],
    ];
    items.sort(bankArgCmp);
    for (const [argloc, argid] of items) s += ` ${argloc}-${argid}`;
    return s;
  }

  static parse(s: string, parseFileidXform: ((fileid: string) => string) | null = null,
    parseCorpus: BankParseCorpus | null = null): NombankInstance {
    const pieces = s.trim().split(/\s+/).filter((x) => x !== "");
    if (pieces.length < 6) {
      throw pyError("ValueError", `Badly formatted nombank line: ${pyStrRepr(s)}`);
    }
    let [fileid, sentnumS, wordnumS, baseform, sensenumber] =
      pieces as [string, string, string, string, string];

    // ``rel = [args.pop(i) for i, p in enumerate(args) if "-rel" in p]`` —
    // enumerate walks the live list, so popping skips the element after a pop.
    const args = pieces.slice(5);
    const rel: string[] = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i]!.includes("-rel")) rel.push(args.splice(i, 1)[0]!);
    }
    if (rel.length !== 1) {
      throw pyError("ValueError", `Badly formatted nombank line: ${pyStrRepr(s)}`);
    }
    if (parseFileidXform !== null) fileid = parseFileidXform(fileid!);

    let sentnum: number, wordnum: number;
    try {
      sentnum = pyInt(sentnumS!);
      wordnum = pyInt(wordnumS!);
    } catch (e) {
      if (e instanceof Error && e.name === "ValueError") {
        throw pyError("ValueError", `Badly formatted nombank line: ${pyStrRepr(s)}`);
      }
      throw e;
    }

    const predPieces = splitMax(rel[0]!, "-", 1);
    if (predPieces.length !== 2) {
      throw pyError("ValueError", `Badly formatted nombank line: ${pyStrRepr(s)}`);
    }
    const [predloc, predid] = predPieces as [string, string];
    const predicate = NombankTreePointer.parse(predloc);

    const argsParsed: Array<[NombankPointer, string]> = [];
    for (const arg of args) {
      const argPieces = splitMax(arg, "-", 1);
      if (argPieces.length !== 2) {
        throw pyError("ValueError", `Badly formatted nombank line: ${pyStrRepr(s)}`);
      }
      argsParsed.push([NombankTreePointer.parse(argPieces[0]!), argPieces[1]!]);
    }

    return new NombankInstance(fileid!, sentnum, wordnum, baseform!, sensenumber!,
      predicate, predid, argsParsed, parseCorpus);
  }
}

export class NombankPointer {
  constructor() {
    if (new.target === NombankPointer) throw pyError("NotImplementedError", "");
  }
}

export class NombankChainTreePointer extends NombankPointer {
  pieces: NombankPointer[];
  constructor(pieces: NombankPointer[]) {
    super();
    this.pieces = pieces;
  }
  override toString(): string { return this.pieces.map((p) => `${p}`).join("*"); }
  repr(): string { return `<NombankChainTreePointer: ${this}>`; }
  select(tree: SimpleTree | null): SimpleTree {
    if (tree === null) throw pyError("ValueError", "Parse tree not available");
    return new SimpleTree("*CHAIN*", this.pieces.map((p) => (p as NombankTreePointer | NombankChainTreePointer | NombankSplitTreePointer).select(tree)));
  }
}

export class NombankSplitTreePointer extends NombankPointer {
  pieces: NombankTreePointer[];
  constructor(pieces: NombankTreePointer[]) {
    super();
    this.pieces = pieces;
  }
  override toString(): string { return this.pieces.map((p) => `${p}`).join(","); }
  repr(): string { return `<NombankSplitTreePointer: ${this}>`; }
  select(tree: SimpleTree | null): SimpleTree {
    if (tree === null) throw pyError("ValueError", "Parse tree not available");
    return new SimpleTree("*SPLIT*", this.pieces.map((p) => p.select(tree)));
  }
}

export class NombankTreePointer extends NombankPointer {
  wordnum: number;
  height: number;

  constructor(wordnum: number, height: number) {
    super();
    this.wordnum = wordnum;
    this.height = height;
  }

  static parse(s: string): NombankPointer {
    // Deal with chains (xx*yy*zz)
    let pieces = s.split("*");
    if (pieces.length > 1) {
      return new NombankChainTreePointer(pieces.map((elt) => NombankTreePointer.parse(elt)));
    }
    // Deal with split args (xx,yy,zz)
    pieces = s.split(",");
    if (pieces.length > 1) {
      return new NombankSplitTreePointer(
        pieces.map((elt) => NombankTreePointer.parse(elt) as NombankTreePointer));
    }
    // Deal with normal pointers.
    pieces = s.split(":");
    if (pieces.length !== 2) {
      throw pyError("ValueError", `bad nombank pointer ${pyStrRepr(s)}`);
    }
    return new NombankTreePointer(pyInt(pieces[0]!), pyInt(pieces[1]!));
  }

  override toString(): string { return `${this.wordnum}:${this.height}`; }
  repr(): string { return `NombankTreePointer(${this.wordnum}, ${this.height})`; }

  eq(other: unknown): boolean {
    let o = other;
    while (o instanceof NombankChainTreePointer || o instanceof NombankSplitTreePointer) {
      o = o.pieces[0];
    }
    if (!(o instanceof NombankTreePointer)) return this === o;
    return this.wordnum === o.wordnum && this.height === o.height;
  }
  ne(other: unknown): boolean { return !this.eq(other); }
  lt(other: unknown): boolean {
    let o = other;
    while (o instanceof NombankChainTreePointer || o instanceof NombankSplitTreePointer) {
      o = o.pieces[0];
    }
    if (!(o instanceof NombankTreePointer)) {
      return this === o ? false : ptrId(this) < ptrId(o as object);
    }
    return this.wordnum < o.wordnum || (this.wordnum === o.wordnum && -this.height < -o.height);
  }

  select(tree: SimpleTree | null): SimpleTreeChild {
    if (tree === null) throw pyError("ValueError", "Parse tree not available");
    const tp = this.treepos(tree);
    let node: SimpleTreeChild = tree;
    for (const i of tp) {
      if (!(node instanceof SimpleTree)) {
        throw pyError("TypeError", "object does not support indexing");
      }
      if (i >= node.children.length) {
        throw pyError("IndexError", "list index out of range");
      }
      node = node.children[i]!;
    }
    return node;
  }

  /** Convert this pointer to a standard 'tree position' pointer, given
   * that it points to the given tree. */
  treepos(tree: SimpleTree | null): number[] {
    if (tree === null) throw pyError("ValueError", "Parse tree not available");
    const stack: SimpleTreeChild[] = [tree];
    const treepos: number[] = [];
    let wordnum = 0;
    for (;;) {
      const top = stack[stack.length - 1];
      if (top === undefined) throw pyError("IndexError", "list index out of range");
      if (top instanceof SimpleTree) {
        if (treepos.length < stack.length) treepos.push(0);
        else treepos[treepos.length - 1]! += 1;
        if (treepos[treepos.length - 1]! < top.children.length) {
          stack.push(top.children[treepos[treepos.length - 1]!]!);
        } else {
          stack.pop();
          treepos.pop();
        }
      } else {
        if (wordnum === this.wordnum) {
          return treepos.slice(0, treepos.length - this.height - 1);
        }
        wordnum += 1;
        stack.pop();
      }
    }
  }
}

// { semcor

/** Anything the caller wants to use for WordNet lemma lookup. */
export interface SemcorWordnet {
  lemma_from_key(key: string): unknown;
}

/** nltk.corpus.reader.semcor._all_xmlwords_in — recursive wf/punc descent. */
function allXmlwordsIn(elt: XMLElement, result: XMLElement[] = []): XMLElement[] {
  for (const child of elt.children) {
    if (child.tag === "wf" || child.tag === "punc") result.push(child);
    else allXmlwordsIn(child, result);
  }
  return result;
}

export class SemcorCorpusReader extends XMLCorpusReader {
  private _lazy: boolean;
  private _wordnet: SemcorWordnet;

  constructor(root: string | PathPointer, fileids: string | string[], wordnet: SemcorWordnet, lazy = true) {
    super(root, fileids);
    this._lazy = lazy;
    this._wordnet = wordnet;
  }

  override words(fileids?: string | string[] | null): unknown {
    return this._items(fileids, "word", false, false, false);
  }

  chunks(fileids?: string | string[] | null): unknown {
    return this._items(fileids, "chunk", false, false, false);
  }

  tagged_chunks(fileids?: string | string[] | null, tag = "pos"): unknown {
    return this._items(fileids, "chunk", false, tag !== "sem", tag !== "pos");
  }
  taggedChunks(fileids?: string | string[] | null, tag = "pos"): unknown { return this.tagged_chunks(fileids, tag); }

  sents(fileids?: string | string[] | null): unknown {
    return this._items(fileids, "word", true, false, false);
  }

  chunk_sents(fileids?: string | string[] | null): unknown {
    return this._items(fileids, "chunk", true, false, false);
  }
  chunkSents(fileids?: string | string[] | null): unknown { return this.chunk_sents(fileids); }

  tagged_sents(fileids?: string | string[] | null, tag = "pos"): unknown {
    return this._items(fileids, "chunk", true, tag !== "sem", tag !== "pos");
  }
  taggedSents(fileids?: string | string[] | null, tag = "pos"): unknown { return this.tagged_sents(fileids, tag); }

  private _items(fileids: string | string[] | null | undefined,
    unit: string, bracketSent: boolean, posTag: boolean, semTag: boolean): unknown {
    const makeView = (fileid: PathPointer): unknown => {
      const inner = this._lazy
        ? new SemcorWordView(fileid, unit, bracketSent, posTag, semTag, this._wordnet)
        : (this._words as (f: PathPointer, u: string, b: boolean, p: boolean, s: boolean, w?: SemcorWordnet) => unknown[])(
          fileid, unit, bracketSent, posTag, semTag, this._wordnet);
      if (unit === "word" && !bracketSent) {
        // LazyConcatenation flattens the per-element word lists one level.
        const materialized = inner instanceof AbstractLazySequence
          ? Array.from(inner as AbstractLazySequence<unknown>)
          : inner as unknown[];
        return new LazyConcatenation(materialized as unknown[][]);
      }
      return inner;
    };
    return concat((this.abspaths(fileids) as PathPointer[]).map((fid) => makeView(fid)));
  }

  /** Non-lazy helper used by ``_items`` — returns a materialized list. NLTK
   * calls it with the wordnet as a 6th positional arg, which raises
   * TypeError under lazy=False. */
  private _words(fileid: PathPointer, unit: string, bracketSent: boolean,
    posTag: boolean, semTag: boolean): unknown[] {
    if (arguments.length > 5) {
      throw pyError("TypeError",
        `SemcorCorpusReader._words() takes 6 positional arguments but ${arguments.length + 1} were given`);
    }
    if (!(unit === "token" || unit === "word" || unit === "chunk")) {
      throw pyError("AssertionError", "");
    }
    const result: unknown[] = [];
    const xmldoc = parseXmlFile(fileid);
    for (const xmlsent of xmldoc.findall(".//s")) {
      const sent: unknown[] = [];
      for (const xmlword of allXmlwordsIn(xmlsent)) {
        const itm = SemcorCorpusReader._word(xmlword, unit, posTag, semTag, this._wordnet);
        if (unit === "word") sent.push(...itm as unknown[]);
        else sent.push(itm);
      }
      if (bracketSent) {
        result.push(new SemcorSentence(eltAttr(xmlsent, "snum"), sent));
      } else {
        result.push(...sent);
      }
    }
    if (result.includes(null)) throw pyError("AssertionError", "");
    return result;
  }

  /** Static one-element projection (``SemcorCorpusReader._word``). */
  static _word(xmlword: XMLElement, unit: string, posTag: boolean, semTag: boolean,
    wordnet: SemcorWordnet): unknown {
    let tkn = xmlword.text;
    if (!tkn) tkn = ""; // fixes issue 337?

    const lemma = xmlword.get("lemma", tkn) ?? tkn; // lemma or NE class
    const lexsn = xmlword.get("lexsn"); // lex_sense
    let senseKey: string | null = null;
    let wnpos: string | null = null;
    if (lexsn !== null) {
      senseKey = `${lemma}%${lexsn}`;
      const wnposArr = ["n", "v", "a", "r", "s"];
      // see http://wordnet.princeton.edu/man/senseidx.5WN.html
      const idx = pyInt(lexsn.split(":")[0]!) - 1;
      wnpos = idx < 0 ? wnposArr[idx + wnposArr.length]! : wnposArr[idx]!;
      if (wnpos === undefined) throw pyError("IndexError", "tuple index out of range");
    }
    const redef = xmlword.get("rdf", tkn); // redefinition — computed, unused
    void redef;
    const sensenum = xmlword.get("wnsn"); // WordNet sense number
    const isOOVEntity = xmlword.attrib.has("pn"); // a "personal name" NE not in WordNet
    const pos = xmlword.get("pos"); // pos for the whole chunk (None for punc)

    if (unit === "token") {
      if (!posTag && !semTag) return tkn;
      const itm: unknown[] = [tkn];
      if (posTag) itm.push(pos);
      if (semTag) itm.push(pyTuple<unknown>(lemma, wnpos, sensenum, isOOVEntity));
      return itm;
    }

    const ww = tkn.split("_"); // TODO: case where punctuation intervenes in MWE
    if (unit === "word") return ww;

    let sense: unknown;
    if (sensenum !== null) {
      try {
        sense = wordnet.lemma_from_key(senseKey!); // Lemma object
      } catch {
        // cannot retrieve the wordnet.Lemma object — fall back to the
        // formatted "lemma.wnpos.sensenum" label.
        try {
          sense = `${lemma}.${wnpos}.${String(pyInt(sensenum)).padStart(2, "0")}`;
        } catch (e) {
          if (e instanceof Error && e.name === "ValueError") {
            sense = `${lemma}.${wnpos}.${sensenum}`; // e.g. sensenum may be "2;1"
          } else {
            throw e;
          }
        }
      }
    }

    const bottom: unknown[] = posTag ? [new SimpleTree(pos ?? "None", ww)] : ww;

    if (semTag && isOOVEntity) {
      if (sensenum !== null) {
        return new SimpleTree(String(sense), [new SimpleTree("NE", bottom as SimpleTreeChild[])]);
      }
      // 'other' NE
      return new SimpleTree("NE", bottom as SimpleTreeChild[]);
    } else if (semTag && sensenum !== null) {
      return new SimpleTree(String(sense), bottom as SimpleTreeChild[]);
    } else if (posTag) {
      return bottom[0];
    }
    return bottom; // chunk as a list
  }
}

export class SemcorSentence extends Array<unknown> {
  /** The sentence identifier (the ``snum`` attribute from the XML). */
  num: string;
  constructor(num: string, items: Iterable<unknown>) {
    super();
    this.push(...items);
    this.num = num;
  }
}

/** A stream backed corpus view specialized for use with the BNC corpus. */
export class SemcorWordView extends XMLCorpusView<unknown> {
  private _unit: string;
  private _sent: boolean;
  private _pos_tag: boolean;
  private _sem_tag: boolean;
  private _wordnet: SemcorWordnet;

  constructor(fileid: string | PathPointer, unit: string, bracketSent: boolean,
    posTag: boolean, semTag: boolean, wordnet: SemcorWordnet) {
    super(fileid, bracketSent ? ".*/s" : ".*/s/(punc|wf)");
    this._unit = unit;
    this._sent = bracketSent;
    this._pos_tag = posTag;
    this._sem_tag = semTag;
    this._wordnet = wordnet;
    this.handle_elt = (elt) => this._sent ? this.handle_sent(elt) : this.handle_word(elt);
  }

  handleElt(elt: XMLElement, context: string): unknown {
    return this.handle_elt(elt, context);
  }

  handle_word(elt: XMLElement): unknown {
    return SemcorCorpusReader._word(elt, this._unit, this._pos_tag, this._sem_tag, this._wordnet);
  }
  handleWord(elt: XMLElement): unknown { return this.handle_word(elt); }

  handle_sent(elt: XMLElement): SemcorSentence {
    const sent: unknown[] = [];
    for (const child of elt.children) {
      if (child.tag === "wf" || child.tag === "punc") {
        const itm = this.handle_word(child);
        if (this._unit === "word") sent.push(...itm as unknown[]);
        else sent.push(itm);
      } else {
        throw pyError("ValueError", `Unexpected element ${child.tag}`);
      }
    }
    return new SemcorSentence(eltAttr(elt, "snum"), sent);
  }
  handleSent(elt: XMLElement): SemcorSentence { return this.handle_sent(elt); }
}

// { senseval

export class SensevalInstance {
  word: string | null;
  senses: PyTuple<string>;
  position: number | null;
  context: Array<string | PyTuple<unknown>>;

  constructor(word: string | null, position: number | null,
    context: Array<string | PyTuple<unknown>>, senses: Iterable<string>) {
    this.word = word;
    this.senses = pyTuple(...senses);
    this.position = position;
    this.context = context;
  }

  repr(): string {
    return `SensevalInstance(word=${pyValueRepr(this.word)}, position=${pyValueRepr(this.position)}, context=${pyValueRepr(this.context)}, senses=${pyValueRepr(this.senses)})`;
  }
  toString(): string { return this.repr(); }
}

export class SensevalCorpusReader extends CorpusReader {
  constructor(root: string | PathPointer, fileids: string | string[], encoding: EncodingSpec = "utf8", tagset: string | null = null) {
    super(root, fileids, encoding, tagset);
  }

  instances(fileids?: string | string[] | null): unknown {
    return concat((this.abspaths(fileids, true) as Array<[PathPointer, string | null]>)
      .map(([fileid, enc]) => new SensevalCorpusView(fileid, enc)));
  }

  _entry(tree: XMLElement): Array<[string, Array<[string | null, string]>]> {
    const elts: Array<[string, Array<[string | null, string]>]> = [];
    for (const lexelt of tree.findall("lexelt")) {
      for (const inst of lexelt.findall("instance")) {
        const sense = eltAttr(eltAt(inst, 0), "senseid");
        const context: Array<[string | null, string]> = [...eltAt(inst, 1)]
          .map((w) => [w.text, eltAttr(w, "pos")] as [string | null, string]);
        elts.push([sense, context]);
      }
    }
    return elts;
  }
}

export class SensevalCorpusView extends StreamBackedCorpusView<SensevalInstance> {
  private _lexeltStarts: number[] = [0];
  private _lexelts: Array<string | null> = [null];

  constructor(fileid: string | PathPointer, encoding: string | null) {
    super(fileid, undefined, 0, encoding);
    this.read_block = (stream) => this.readBlock(stream);
  }

  readBlock(stream: SeekableUnicodeStreamReader): SensevalInstance[] {
    // Decide which lexical element we're in.
    let lexeltNum = bisectRightNums(this._lexeltStarts, stream.tell()) - 1;
    let lexelt = this._lexelts[lexeltNum]!;

    const instanceLines: string[] = [];
    let inInstance = false;
    for (;;) {
      const line = stream.readline();
      if (line === "") {
        if (instanceLines.length !== 0) throw pyError("AssertionError", "");
        return [];
      }
      // Start of a lexical element?
      if (line.trimStart().startsWith("<lexelt")) {
        lexeltNum += 1;
        const m = /item=("[^"]+"|'[^']+')/.exec(line);
        if (m === null) throw pyError("AssertionError", "");
        lexelt = m[1]!.slice(1, -1);
        if (lexeltNum < this._lexelts.length) {
          if (lexelt !== this._lexelts[lexeltNum]) throw pyError("AssertionError", "");
        } else {
          this._lexelts.push(lexelt);
          this._lexeltStarts.push(stream.tell());
        }
      }
      // Start of an instance?
      if (line.trimStart().startsWith("<instance")) {
        if (instanceLines.length !== 0) throw pyError("AssertionError", "");
        inInstance = true;
      }
      // Body of an instance?
      if (inInstance) instanceLines.push(line);
      // End of an instance?
      if (line.trimStart().startsWith("</instance")) {
        const xmlBlock = sensevalFixXml(instanceLines.join("\n"));
        const inst = parseXmlString(xmlBlock);
        return [this._parseInstance(inst, lexelt)];
      }
    }
  }

  private _parseInstance(instance: XMLElement, lexelt: string | null): SensevalInstance {
    const senses: string[] = [];
    const context: Array<string | PyTuple<unknown>> = [];
    let position: number | null = null;
    for (const child of instance.children) {
      if (child.tag === "answer") {
        senses.push(eltAttr(child, "senseid"));
      } else if (child.tag === "context") {
        context.push(...wsTokenize(child.text));
        for (const cword0 of child.children) {
          let cword = cword0;
          if (cword.tag === "compound") {
            cword = eltAt(cword, 0); // is this ok to do?
          }
          if (cword.tag === "head") {
            // Some santiy checks:
            if (position !== null) throw pyError("AssertionError", "head specified twice");
            const ctext = cword.text;
            if (ctext === null) {
              throw pyError("AttributeError", "'NoneType' object has no attribute 'strip'");
            }
            if (!(ctext.trim() !== "" || cword.children.length === 1)) {
              throw pyError("AssertionError", "");
            }
            if (ctext.trim() !== "" && cword.children.length === 1) {
              throw pyError("AssertionError", "");
            }
            // Record the position of the head:
            position = context.length;
            // Add on the head word itself:
            if (ctext.trim() !== "") {
              context.push(ctext.trim());
            } else if (eltAt(cword, 0).tag === "wf") {
              const inner = eltAt(cword, 0);
              context.push(pyTuple<string | null>(inner.text, eltAttr(inner, "pos")));
              if (inner.tail) context.push(...wsTokenize(inner.tail));
            } else {
              throw pyError("AssertionError", "expected CDATA or wf in <head>");
            }
          } else if (cword.tag === "wf") {
            context.push(pyTuple<string | null>(cword.text, eltAttr(cword, "pos")));
          } else if (cword.tag === "s") {
            // Sentence boundary marker.
          } else {
            console.log("ACK", cword.tag);
            throw pyError("AssertionError", "expected CDATA or <wf> or <head>");
          }
          if (cword.tail) context.push(...wsTokenize(cword.tail));
        }
      } else {
        throw pyError("AssertionError", `unexpected tag ${child.tag}`);
      }
    }
    return new SensevalInstance(lexelt, position, context, senses);
  }
  private _parse_instance(instance: XMLElement, lexelt: string | null): SensevalInstance {
    return this._parseInstance(instance, lexelt);
  }
}

/** Fix the various issues with Senseval pseudo-XML. */
function sensevalFixXml(text: string): string {
  // <~> or <^> => ~ or ^
  text = text.replace(/<([~^])>/g, "$1");
  // fix lone &
  text = text.replace(/(\s+)&(\s+)/g, "$1&amp;$2");
  // fix """
  text = text.replace(/"""/g, "'\"'");
  // fix <s snum=dd> => <s snum="dd"/>
  text = text.replace(/(<[^<]*snum=)([^">]+)>/g, '$1"$2"/>');
  // fix foreign word tag
  text = text.replace(/<&frasl>\s*<p[^>]*>/g, "FRASL");
  // remove <&I .>
  text = text.replace(/<&I[^>]*>/g, "");
  // fix <{word}>
  text = text.replace(/<{([^}]+)}>/g, "$1");
  // remove <@>, <p>, </p>
  text = text.replace(/<(@|\/?p)>/g, "");
  // remove <&M .> and <&T .> and <&Ms .>
  text = text.replace(/<&\w+ \.>/g, "");
  // remove <!DOCTYPE... > lines
  text = text.replace(/<!DOCTYPE[^>]*>/g, "");
  // remove <[hi]> and <[/p]> etc
  text = text.replace(/<\[\/?[^>]+\]*>/g, "");
  // take the thing out of the brackets: <&hellip;>
  text = text.replace(/<(&\w+;)>/g, "$1");
  // and remove the & for those patterns that aren't regular XML
  text = text.replace(/&(?!(amp|gt|lt|apos|quot))/g, "");
  // fix 'abc <p="foo"/>' style tags - now <wf pos="foo">abc</wf>
  // (Python uses possessive quantifiers for ReDoS safety; the possessive and
  // greedy forms are match-for-match identical here.)
  text = text.replace(/[ \t]*([^<>\s]+)[ \t]*<p="([^"]*"?)"\/>/g, ' <wf pos="$2">$1</wf>');
  text = text.replace(/\s*"\s*<p='"'?\/>/g, " <wf pos='\"'>\"</wf>");
  return text;
}
export { sensevalFixXml as _fixXML };

// { rte

/** Normalize the string value in an RTE pair's ``value`` or ``entailment``
 * attribute as an integer (1, 0). */
export function norm(valueString: string): number {
  const valdict: Record<string, number> = { TRUE: 1, FALSE: 0, YES: 1, NO: 0 };
  const key = valueString.toUpperCase();
  if (!(key in valdict)) throw pyError("KeyError", pyStrRepr(key));
  return valdict[key]!;
}

/** Container for RTE text-hypothesis pairs. */
export class RTEPair {
  challenge: string | null;
  id: string;
  gid: string;
  text: string | null;
  hyp: string | null;
  value: number | null;
  task: string | null;
  length: string | null;

  constructor(pair: XMLElement, options: {
    challenge?: string | null;
    id?: string | null;
    text?: string | null;
    hyp?: string | null;
    value?: number | null;
    task?: string | null;
    length?: string | null;
  } = {}) {
    const { challenge = null, value = null, task = null, length = null } = options;
    this.challenge = challenge;
    this.id = eltAttr(pair, "id");
    this.gid = `${this.challenge === null ? "None" : this.challenge}-${this.id}`;
    this.text = eltAt(pair, 0).text;
    this.hyp = eltAt(pair, 1).text;

    if (pair.attrib.has("value")) this.value = norm(pair.attrib.get("value")!);
    else if (pair.attrib.has("entailment")) this.value = norm(pair.attrib.get("entailment")!);
    else this.value = value;
    this.task = pair.attrib.has("task") ? pair.attrib.get("task")! : task;
    this.length = pair.attrib.has("length") ? pair.attrib.get("length")! : length;
  }

  repr(): string {
    if (this.challenge) return `<RTEPair: gid=${this.challenge}-${this.id}>`;
    return `<RTEPair: id=${this.id}>`;
  }
  toString(): string { return this.repr(); }
}

/** Corpus reader for corpora in RTE challenges. */
export class RTECorpusReader extends XMLCorpusReader {
  private _readEtree(doc: XMLElement): RTEPair[] {
    const challenge = doc.attrib.has("challenge") ? doc.attrib.get("challenge")! : null;
    return [...doc.iter("pair")].map((pair) => new RTEPair(pair, { challenge }));
  }

  /** Build a list of RTEPairs from a RTE corpus. */
  pairs(fileids: string | string[]): unknown {
    const ids = typeof fileids === "string" ? [fileids] : fileids;
    return concat(ids.map((fid) => this._readEtree(this.xml(fid) as XMLElement)));
  }
}
