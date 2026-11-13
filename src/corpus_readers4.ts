// nltk.corpus.reader batch-D: XML-backed corpus readers.
// Originals: nltk/corpus/reader/{xmldocs,bnc,childes,verbnet,mte,ipipan,nkjp,nps_chat,framenet}.py
// XML elements come from the local ElementTree clone in ./xmldocs.

import { readFileSync, mkdtempSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pathJoin, isAbsolute, resolve as pathResolve } from "node:path";
import { pyError } from "./internals";
import { PathPointer, FileSystemPathPointer, ZipFilePathPointer } from "./data";
import { StreamBackedCorpusView, concat } from "./corpus_view";
import { SeekableUnicodeStreamReader } from "./corpus_stream";
import { CorpusReader } from "./corpus_api";
import { TaggedCorpusReader } from "./corpus_text_readers";
import { AbstractLazySequence, LazyConcatenation, LazyIteratorList, LazyMap } from "./collections";
import { mapTag } from "./tag_mapping";
import { wordpunct_tokenize } from "./nltk_compat";
import { pathsec_open as pathsecOpen, validate_path } from "./pathsec";
import { XMLElement, parseXmlStream, parseXmlString } from "./xmldocs";

/** Python ``str()`` for error messages (None/True/False names). */
function pystr(v: unknown): string {
  if (v === null || v === undefined) return "None";
  if (v === true) return "True";
  if (v === false) return "False";
  return String(v);
}

/** Python ``repr()`` for simple values used in messages. */
function pyrepr(v: unknown): string {
  if (typeof v === "string") return `'${v}'`;
  return pystr(v);
}

/** nltk.internals.ElementWrapper — attribute-delegating element wrapper. */
export class ElementWrapper {
  private _etree: XMLElement;

  constructor(etree: XMLElement | string) {
    this._etree = typeof etree === "string" ? parseXmlString(etree) : etree;
  }

  get _element(): XMLElement { return this._etree; }
  get tag(): string { return this._etree.tag; }
  get text(): string | null { return this._etree.text; }
  get tail(): string | null { return this._etree.tail; }
  get attrib(): Map<string, string> { return this._etree.attrib; }
  get length(): number { return this._etree.length; }

  private _wrap(e: XMLElement | null): ElementWrapper | null {
    return e === null ? null : new ElementWrapper(e);
  }

  findall(path: string, ns?: Record<string, string> | null): ElementWrapper[] {
    return this._etree.findall(path, ns).map((e) => new ElementWrapper(e));
  }
  findAll(path: string, ns?: Record<string, string> | null): ElementWrapper[] {
    return this.findall(path, ns);
  }
  find(path: string, ns?: Record<string, string> | null): ElementWrapper | null {
    return this._wrap(this._etree.find(path, ns));
  }
  findtext(path: string, deflt?: string | null, ns?: Record<string, string> | null): string | null {
    return this._etree.findtext(path, deflt, ns);
  }
  *iter(tag?: string | null): Generator<ElementWrapper> {
    for (const e of this._etree.iter(tag)) yield new ElementWrapper(e);
  }
  getiterator(tag?: string | null): ElementWrapper[] {
    return [...this.iter(tag)];
  }
  *[Symbol.iterator](): Generator<ElementWrapper> {
    for (const e of this._etree) yield new ElementWrapper(e);
  }
  get(i: number): ElementWrapper | undefined;
  get(key: string, deflt?: string | null): string | null;
  get(key: number | string, deflt: string | null = null): ElementWrapper | string | null | undefined {
    if (typeof key === "number") {
      const e = this._etree.get(key);
      return e === undefined ? undefined : new ElementWrapper(e);
    }
    return this._etree.get(key, deflt);
  }
  set(key: string, value: string): void { this._etree.set(key, value); }
  append(child: ElementWrapper | XMLElement): void {
    this._etree.append(child instanceof ElementWrapper ? child._etree : child);
  }
  keys(): string[] { return this._etree.keys(); }
  items(): Array<[string, string]> { return this._etree.items(); }

  repr(): string { return `<Element '${this._etree.tag}'>`; }
  toString(): string { return this.repr(); }
}

const decUtf8 = new TextDecoder("utf-8");

/** nltk.corpus.reader.xmldocs.xpath — ``return root.findall(path, ns)``. */
export function xpath(elt: XMLElement, path: string, ns: Record<string, string> | null = null): XMLElement[] {
  return elt.findall(path, ns);
}

type XmlEltHandler<T> = (elt: XMLElement, context: string) => T;

function firstLineBytes(fileid: string | PathPointer): Uint8Array {
  let data: Uint8Array;
  if (fileid instanceof ZipFilePathPointer) {
    data = fileid.zipfile.read(fileid.entry);
  } else if (fileid instanceof FileSystemPathPointer) {
    data = new Uint8Array(readFileSync(fileid.path));
  } else if (fileid instanceof PathPointer) {
    const fp = fileid.open(null);
    try {
      const line = fp.readline();
      return new TextEncoder().encode(line);
    } finally {
      fp.close();
    }
  } else {
    // bare string path: go through pathsec like Python's pathsec_open("rb").
    data = pathsecOpen(String(fileid), "rb", "XMLCorpusReader", null);
  }
  const nl = data.indexOf(0x0a);
  return nl < 0 ? data : data.subarray(0, nl + 1);
}

const BOM_UTF8 = [0xef, 0xbb, 0xbf];
const BOM_UTF16_BE = [0xfe, 0xff];
const BOM_UTF16_LE = [0xff, 0xfe];
const BOM_UTF32_BE = [0x00, 0x00, 0xfe, 0xff];
const BOM_UTF32_LE = [0xff, 0xfe, 0x00, 0x00];

function startsWithBytes(s: Uint8Array, bom: number[]): boolean {
  return bom.every((b, i) => s[i] === b);
}

function normalizeXmlEncoding(name: string): string {
  const n = name.toLowerCase();
  if (n === "utf-16-be") return "utf-16be";
  if (n === "utf-16-le") return "utf-16le";
  return name;
}

function detectXmlEncoding(fileid: string | PathPointer): string {
  const s = firstLineBytes(fileid);
  if (startsWithBytes(s, BOM_UTF16_BE)) return "utf-16-be";
  if (startsWithBytes(s, BOM_UTF16_LE)) return "utf-16-le";
  if (startsWithBytes(s, BOM_UTF32_BE)) return "utf-32-be";
  if (startsWithBytes(s, BOM_UTF32_LE)) return "utf-32-le";
  if (startsWithBytes(s, BOM_UTF8)) return "utf-8";
  // regex over the raw first line, latin-1 safe for ascii bytes
  const line = decUtf8.decode(s);
  let m = /^\s*<\?xml\b.*\bencoding="([^"]+)"/.exec(line);
  if (m) return m[1]!;
  m = /^\s*<\?xml\b.*\bencoding='([^']+)'/.exec(line);
  if (m) return m[1]!;
  return "utf-8";
}

/** Mirror Python ``fileid.open()`` binary + parser auto-detection: detect the
 * encoding from raw bytes, then decode the whole file with it. */
function openXml(fileid: PathPointer): SeekableUnicodeStreamReader {
  const enc = normalizeXmlEncoding(detectXmlEncoding(fileid));
  return fileid.open(enc);
}

/** nltk.corpus.reader.xmldocs.XMLCorpusReader */
export class XMLCorpusReader extends CorpusReader {
  protected _wrap_etree: boolean;

  constructor(root: string | PathPointer, fileids: string | string[], wrap_etree = false) {
    super(root, fileids);
    this._wrap_etree = wrap_etree;
  }

  xml(fileid: string | null = null): unknown {
    let fid = fileid;
    if (fid === null && this._fileids.length === 1) fid = this._fileids[0]!;
    if (typeof fid !== "string") {
      throw pyError("TypeError", "Expected a single file identifier string");
    }
    const fp = openXml(this.abspath(fid));
    let elt: unknown;
    try {
      elt = parseXmlStream(fp);
    } finally {
      fp.close();
    }
    if (this._wrap_etree) elt = new ElementWrapper(elt as XMLElement);
    return elt;
  }

  words(fileid: string | null = null): unknown {
    const elt = this.xml(fileid) as XMLElement;
    const out: string[] = [];
    for (const node of elt.iter()) {
      const text = node.text;
      if (text !== null) out.push(...wordpunct_tokenize(text));
    }
    return out;
  }
}

/** nltk.corpus.reader.xmldocs.XMLCorpusView — regex tag-path scanning view. */
export class XMLCorpusView<T = unknown> extends StreamBackedCorpusView<T> {
  _DEBUG = false;
  _BLOCK_SIZE = 1024;

  /** tag specification: full-match regex over "/"-joined tag paths */
  _tagspec: RegExp;
  /** filepos -> tag-name context stack (tuples in Python) */
  _tag_context: Map<number, string[]>;
  handle_elt: XmlEltHandler<T> = (elt) => elt as unknown as T;

  static _VALID_XML_RE = /^[^<]*((<!--(?:(?!-->).)*-->|<!\[CDATA\[(?:(?!\]\]>).)*\]\]>|<!DOCTYPE\s+[^[>]*(\[[^\]]*\])?\s*>|<[^!>][^>]*>)[^<]*)*$/s;
  static _XML_TAG_NAME = /<\s*(?:\/\s*)?([^\s>]+)/;
  static _XML_PIECE = /(?<COMMENT><!--.*?-->)|(?<CDATA><!\[CDATA\[.*?\]\]>)|(?<PI><\?.*?\?>)|(?<DOCTYPE><!DOCTYPE\s+[^[^>]*(\[[^\]]*\])?\s*>)|(?<EMPTY_ELT_TAG><\s*[^>/?!\s][^>]*\/\s*>)|(?<START_TAG><\s*[^>/?!\s][^>]*>)|(?<END_TAG><\s*\/[^>/?!\s][^>]*>)/gs;

  constructor(fileid: string | PathPointer, tagspec: string, elt_handler: XmlEltHandler<T> | null = null) {
    const encoding = normalizeXmlEncoding(detectXmlEncoding(fileid));
    super(fileid, undefined, 0, encoding);
    if (elt_handler) this.handle_elt = elt_handler;
    this._tagspec = new RegExp(`^(?:${tagspec})$`);
    this._tag_context = new Map([[0, []]]);
    this.read_block = (stream: SeekableUnicodeStreamReader) => this.readBlock(stream) as T[];
  }

  /** Python ``re.match(tagspec, path)`` — anchored at start, not at end. */
  private tagspecMatch(tagspec: string | RegExp, path: string): boolean {
    if (typeof tagspec === "string") return new RegExp(`^(?:${tagspec})`).test(path);
    return new RegExp(`^(?:${tagspec.source})`, tagspec.flags).test(path);
  }

  /** ``XMLCorpusView.read_block`` — read until at least one matching elt. */
  readBlock(stream: SeekableUnicodeStreamReader, tagspec?: string | RegExp, elt_handler?: XmlEltHandler<T>): T[] {
    const ts: string | RegExp = tagspec ?? this._tagspec;
    const handler: XmlEltHandler<T> = elt_handler ?? ((e, c) => this.handle_elt(e, c));

    const ctx0 = this._tag_context.get(stream.tell());
    if (ctx0 === undefined) throw pyError("AssertionError", "context is not None");
    let context = [...ctx0];

    const elts: Array<[string, string]> = [];
    let elt_start: number | null = null;
    let elt_depth: number | null = null;
    let elt_text = "";

    while (elts.length === 0 || elt_start !== null) {
      const startpos = stream.tell();
      const xml_fragment = this.readXmlFragment(stream);

      if (!xml_fragment) {
        if (elt_start === null) break;
        else throw pyError("ValueError", "Unexpected end of file");
      }

      for (const piece of matchAllXmlPieces(xml_fragment)) {
        if (this._DEBUG) console.log(`${context.join("/").slice(-20).padStart(25)} ${piece.group}`);

        if (piece.name === "START_TAG") {
          const name = XMLCorpusView._XML_TAG_NAME.exec(piece.group)![1]!;
          context.push(name);
          if (elt_start === null) {
            if (this.tagspecMatch(ts, context.join("/"))) {
              elt_start = piece.start;
              elt_depth = context.length;
            }
          }
        } else if (piece.name === "END_TAG") {
          const name = XMLCorpusView._XML_TAG_NAME.exec(piece.group)![1]!;
          if (context.length === 0) throw pyError("ValueError", `Unmatched tag </${name}>`);
          if (name !== context[context.length - 1]) {
            throw pyError("ValueError", `Unmatched tag <${context[context.length - 1]}>...</${name}>`);
          }
          if (elt_start !== null && elt_depth === context.length) {
            elt_text += xml_fragment.slice(elt_start, piece.end);
            elts.push([elt_text, context.join("/")]);
            elt_start = elt_depth = null;
            elt_text = "";
          }
          context.pop();
        } else if (piece.name === "EMPTY_ELT_TAG") {
          const name = XMLCorpusView._XML_TAG_NAME.exec(piece.group)![1]!;
          if (elt_start === null) {
            if (this.tagspecMatch(ts, `${context.join("/")}/${name}`)) {
              elts.push([piece.group, `${context.join("/")}/${name}`]);
            }
          }
        }
      }

      if (elt_start !== null) {
        if (elts.length === 0) {
          elt_text += xml_fragment.slice(elt_start);
          elt_start = 0;
        } else {
          // backtrack: return what we have; re-scan the pending elt next block
          stream.seek(startpos);
          stream.char_seek_forward(elt_start);
          context = context.slice(0, elt_depth! - 1);
          elt_start = elt_depth = null;
          elt_text = "";
        }
      }
    }

    const pos = stream.tell();
    const existing = this._tag_context.get(pos);
    if (existing !== undefined) {
      if (existing.join("") !== context.join("")) {
        throw pyError("AssertionError", "tag context mismatch");
      }
    } else {
      this._tag_context.set(pos, [...context]);
    }

    return elts.map(([eltStr, ctx]) => handler(parseXmlString(eltStr), ctx));
  }

  /** ``XMLCorpusView._read_xml_fragment`` — read a block with no unclosed tags. */
  readXmlFragment(stream: SeekableUnicodeStreamReader): string {
    let fragment = "";
    let in_tag = false;
    let last_lt = -1;
    const startpos = stream.tell();

    for (;;) {
      const block_start = fragment.length;
      const xml_block = stream.read(this._BLOCK_SIZE);
      fragment += xml_block;
      for (let offset = 0; offset < xml_block.length; offset++) {
        const ch = xml_block[offset];
        if (ch === "<") {
          in_tag = true;
          last_lt = block_start + offset;
        } else if (ch === ">") {
          in_tag = false;
        }
      }

      if (!in_tag && XMLCorpusView._VALID_XML_RE.test(fragment)) return fragment;

      const m = /[<>]/.exec(fragment)!;
      if (m[0] === ">") {
        const pos = stream.tell() - (fragment.length - (m.index + 1));
        throw pyError("ValueError", `Unexpected ">" near char ${pos}`);
      }

      if (!xml_block) throw pyError("ValueError", "Unexpected end of file: tag not closed");

      const last_open_bracket = last_lt;
      if (last_open_bracket > 0) {
        if (XMLCorpusView._VALID_XML_RE.test(fragment.slice(0, last_open_bracket))) {
          stream.seek(startpos);
          stream.char_seek_forward(last_open_bracket);
          return fragment.slice(0, last_open_bracket);
        }
      }
    }
  }
}

interface XmlPiece { name: string; group: string; start: number; end: number }

function* matchAllXmlPieces(fragment: string): Generator<XmlPiece> {
  const re = new RegExp(XMLCorpusView._XML_PIECE.source, "gs");
  let m: RegExpExecArray | null;
  while ((m = re.exec(fragment)) !== null) {
    const g = m.groups!;
    const name = Object.keys(g).find((k) => g[k] !== undefined)!;
    yield { name, group: m[0], start: m.index, end: m.index + m[0].length };
  }
}

// { bnc

/** nltk.corpus.reader.bnc.BNCSentence — word list + ``num`` attr. */
export class BNCSentence extends Array<unknown> {
  num: string;
  static override get [Symbol.species]() {
    return Array;
  }
  constructor(num: string | number, items?: unknown[]) {
    if (typeof num === "number") {
      // Array-internal: new this(len) from map/filter etc.
      super(num);
      this.num = "";
    } else {
      super(...(items ?? []));
      this.num = num;
    }
  }
}

function allXmlwordsIn(elt: XMLElement, result: XMLElement[] = []): XMLElement[] {
  for (const child of elt.children) {
    if (child.tag === "c" || child.tag === "w") result.push(child);
    else allXmlwordsIn(child, result);
  }
  return result;
}

/** nltk.corpus.reader.bnc.BNCCorpusReader */
export class BNCCorpusReader extends XMLCorpusReader {
  private _lazy: boolean;

  constructor(root: string | PathPointer, fileids: string | string[], lazy = true) {
    super(root, fileids);
    this._lazy = lazy;
  }

  override words(fileids: string | string[] | null = null, strip_space = true, stem = false): unknown {
    return this._views(fileids, false, null, strip_space, stem);
  }

  tagged_words(fileids: string | string[] | null = null, c5 = false, strip_space = true, stem = false): unknown {
    const tag = c5 ? "c5" : "pos";
    return this._views(fileids, false, tag, strip_space, stem);
  }
  taggedWords(fileids: string | string[] | null = null, c5 = false, strip_space = true, stem = false): unknown {
    return this.tagged_words(fileids, c5, strip_space, stem);
  }

  sents(fileids: string | string[] | null = null, strip_space = true, stem = false): unknown {
    return this._views(fileids, true, null, strip_space, stem);
  }

  tagged_sents(fileids: string | string[] | null = null, c5 = false, strip_space = true, stem = false): unknown {
    const tag = c5 ? "c5" : "pos";
    return this._views(fileids, true, tag, strip_space, stem);
  }
  taggedSents(fileids: string | string[] | null = null, c5 = false, strip_space = true, stem = false): unknown {
    return this.tagged_sents(fileids, c5, strip_space, stem);
  }

  _views(fileids: string | string[] | null = null, sent = false, tag: string | false | null = false, strip_space = true, stem = false): unknown {
    const abspaths = this.abspaths(fileids) as PathPointer[];
    const f = this._lazy
      ? (fid: PathPointer): unknown => new BNCWordView(fid, sent, tag, strip_space, stem)
      : (fid: PathPointer): unknown => this._words(fid, sent, tag, strip_space, stem);
    return concat(abspaths.map(f));
  }

  _words(fileid: PathPointer, bracket_sent: boolean, tag: string | false | null, strip_space: boolean, stem: boolean): unknown[] {
    const result: unknown[] = [];
    const fp = openXml(fileid);
    let xmldoc: XMLElement;
    try {
      xmldoc = parseXmlStream(fp);
    } finally {
      fp.close();
    }
    for (const xmlsent of xmldoc.findall(".//s")) {
      const sent: unknown[] = [];
      for (const xmlword of allXmlwordsIn(xmlsent)) {
        let word: unknown = xmlword.text;
        if (!word) word = "";
        if (strip_space || stem) word = (word as string).trim();
        if (stem) word = xmlword.get("hw", word as string);
        if (tag === "c5") word = [word, xmlword.get("c5")];
        else if (tag === "pos") word = [word, xmlword.get("pos", xmlword.get("c5"))];
        sent.push(word);
      }
      if (bracket_sent) result.push(new BNCSentence(xmlsent.attrib.get("n")!, sent));
      else result.push(...sent);
    }
    return result;
  }
}

/** nltk.corpus.reader.bnc.BNCWordView */
export class BNCWordView extends XMLCorpusView<unknown> {
  static tags_to_ignore = new Set(["pb", "gap", "vocal", "event", "unclear", "shift", "pause", "align"]);

  private _sent: boolean;
  private _tag: string | false | null;
  private _strip_space: boolean;
  private _stem: boolean;

  title: string | null = null;
  author: string | null = null;
  editor: string | null = null;
  resps: string | null = null;

  constructor(fileid: string | PathPointer, sent: boolean, tag: string | false | null, strip_space: boolean, stem: boolean) {
    const tagspec = sent ? ".*/s" : ".*/s/(.*/)?(c|w)";
    super(fileid, tagspec);
    this._sent = sent;
    this._tag = tag;
    this._strip_space = strip_space;
    this._stem = stem;
    this.handle_elt = (elt) => (this._sent ? this.handle_sent(elt) : this.handle_word(elt));

    // Read in a tasty header.
    this._open();
    this.readBlock(this._stream!, ".*/teiHeader$", (e, c) => this.handle_header(e, c));
    this.close();

    this._tag_context = new Map([[0, []]]);
  }

  handle_header(elt: XMLElement, _context: string): unknown {
    const titles = elt.findall("titleStmt/title");
    if (titles.length) this.title = titles.map((t) => (t.text ?? "").trim()).join("\n");
    const authors = elt.findall("titleStmt/author");
    if (authors.length) this.author = authors.map((a) => (a.text ?? "").trim()).join("\n");
    const editors = elt.findall("titleStmt/editor");
    if (editors.length) this.editor = editors.map((e) => (e.text ?? "").trim()).join("\n");
    const resps = elt.findall("titleStmt/respStmt");
    if (resps.length) {
      this.resps = resps
        .map((resp) => resp.children.map((r) => (r.text ?? "").trim()).join("\n"))
        .join("\n\n");
    }
    return undefined;
  }

  handle_word(elt: XMLElement): unknown {
    let word: unknown = elt.text;
    if (!word) word = "";
    if (this._strip_space || this._stem) word = (word as string).trim();
    if (this._stem) word = elt.get("hw", word as string);
    if (this._tag === "c5") word = [word, elt.get("c5")];
    else if (this._tag === "pos") word = [word, elt.get("pos", elt.get("c5"))];
    return word;
  }

  handle_sent(elt: XMLElement): BNCSentence {
    const sent: unknown[] = [];
    for (const child of elt.children) {
      if (["mw", "hi", "corr", "trunc"].includes(child.tag)) {
        sent.push(...child.children.map((w) => this.handle_word(w)));
      } else if (child.tag === "w" || child.tag === "c") {
        sent.push(this.handle_word(child));
      } else if (!BNCWordView.tags_to_ignore.has(child.tag)) {
        throw pyError("ValueError", `Unexpected element ${child.tag}`);
      }
    }
    return new BNCSentence(elt.attrib.get("n")!, sent);
  }
}

// { childes

const CHILDES_NS = "http://www.talkbank.org/ns/talkbank";

/** nltk.corpus.reader.childes.CHILDESCorpusReader */
export class CHILDESCorpusReader extends XMLCorpusReader {
  static childes_url_base = "https://childes.talkbank.org/browser/index.php?url=";
  private _lazy: boolean;

  constructor(root: string | PathPointer, fileids: string | string[], lazy = true) {
    super(root, fileids);
    this._lazy = lazy;
  }

  override words(fileids: string | string[] | null = null, speaker: string | string[] = "ALL",
    stem = false, relation = false, strip_space = true, replace = false): unknown {
    return this.getWords(fileids, speaker, null, stem, relation, false, strip_space, replace);
  }

  tagged_words(fileids: string | string[] | null = null, speaker: string | string[] = "ALL",
    stem = false, relation = false, strip_space = true, replace = false): unknown {
    return this.getWords(fileids, speaker, null, stem, relation, true, strip_space, replace);
  }
  taggedWords(fileids: string | string[] | null = null, speaker: string | string[] = "ALL",
    stem = false, relation = false, strip_space = true, replace = false): unknown {
    return this.tagged_words(fileids, speaker, stem, relation, strip_space, replace);
  }

  sents(fileids: string | string[] | null = null, speaker: string | string[] = "ALL",
    stem = false, relation: boolean | null = null, strip_space = true, replace = false): unknown {
    return this.getWords(fileids, speaker, true, stem, relation, false, strip_space, replace);
  }

  tagged_sents(fileids: string | string[] | null = null, speaker: string | string[] = "ALL",
    stem = false, relation: boolean | null = null, strip_space = true, replace = false): unknown {
    return this.getWords(fileids, speaker, true, stem, relation, true, strip_space, replace);
  }
  taggedSents(fileids: string | string[] | null = null, speaker: string | string[] = "ALL",
    stem = false, relation: boolean | null = null, strip_space = true, replace = false): unknown {
    return this.tagged_sents(fileids, speaker, stem, relation, strip_space, replace);
  }

  private getWords(fileids: string | string[] | null, speaker: string | string[],
    sent: boolean | null, stem: boolean, relation: boolean | null, pos: boolean,
    strip_space: boolean, replace: boolean): unknown {
    const abspaths = this.abspaths(fileids) as PathPointer[];
    if (!this._lazy) {
      return abspaths.map((f) => this._get_words(f, speaker, sent, stem, relation, pos, strip_space, replace));
    }
    return new LazyConcatenation(
      abspaths.map((f) => new LazyMap((x: unknown) => x,
        this._get_words(f, speaker, sent, stem, relation, pos, strip_space, replace) as unknown[])));
  }

  corpus(fileids: string | string[] | null = null): unknown {
    const abspaths = this.abspaths(fileids) as PathPointer[];
    if (!this._lazy) return abspaths.map((f) => this._get_corpus(f));
    return new LazyMap((f: PathPointer) => this._get_corpus(f), abspaths);
  }

  _get_corpus(fileid: PathPointer): Record<string, string> {
    const fp = openXml(fileid);
    let xmldoc: XMLElement;
    try {
      xmldoc = parseXmlStream(fp);
    } finally {
      fp.close();
    }
    const results: Record<string, string> = {};
    for (const [k, v] of xmldoc.attrib) results[k] = v;
    return results;
  }

  participants(fileids: string | string[] | null = null): unknown {
    const abspaths = this.abspaths(fileids) as PathPointer[];
    if (!this._lazy) return abspaths.map((f) => this._get_participants(f));
    return new LazyMap((f: PathPointer) => this._get_participants(f), abspaths);
  }

  _get_participants(fileid: PathPointer): Record<string, Record<string, string>> {
    const fp = openXml(fileid);
    let xmldoc: XMLElement;
    try {
      xmldoc = parseXmlStream(fp);
    } finally {
      fp.close();
    }
    const pat: Record<string, Record<string, string>> = {};
    for (const participant of xmldoc.findall(`.//{${CHILDES_NS}}Participants/{${CHILDES_NS}}participant`)) {
      const pid = participant.get("id")!;
      if (!(pid in pat)) pat[pid] = {};
      for (const [k, v] of participant.attrib) pat[pid]![k] = v;
    }
    return pat;
  }

  age(fileids: string | string[] | null = null, speaker = "CHI", month = false): unknown {
    const abspaths = this.abspaths(fileids) as PathPointer[];
    if (!this._lazy) return abspaths.map((f) => this._get_age(f, speaker, month));
    return new LazyMap((f: PathPointer) => this._get_age(f, speaker, month), abspaths);
  }

  _get_age(fileid: PathPointer, speaker: string, month: boolean): unknown {
    const fp = openXml(fileid);
    let xmldoc: XMLElement;
    try {
      xmldoc = parseXmlStream(fp);
    } finally {
      fp.close();
    }
    for (const pat of xmldoc.findall(`.//{${CHILDES_NS}}Participants/{${CHILDES_NS}}participant`)) {
      try {
        if (pat.get("id") === speaker) {
          let age: unknown = pat.get("age");
          if (month) age = this.convert_age(age as string);
          return age;
        }
      } catch {
        return null;
      }
    }
    return undefined as unknown; // Python: implicit None
  }

  convert_age(age_year: string): number {
    const m = /^P(\d+)Y(\d+)M?(\d?\d?)D?/.exec(age_year);
    if (m === null) {
      throw pyError("ValueError",
        `Cannot convert age ${pyrepr(age_year)}: expected a CHILDES age string ` +
        "of the form 'P<years>Y<months>' with an optional 'M' and " +
        "'<days>D', e.g. 'P2Y10M', 'P2Y10', or 'P2Y1M15D'");
    }
    let age_month = parseInt(m[1]!, 10) * 12 + parseInt(m[2]!, 10);
    try {
      if (m[3] === "") throw pyError("ValueError", "int('')");
      if (parseInt(m[3]!, 10) > 15) age_month += 1;
    } catch { /* some corpora don't have age information */ }
    return age_month;
  }

  convertAge(age_year: string): number { return this.convert_age(age_year); }

  MLU(fileids: string | string[] | null = null, speaker = "CHI"): unknown {
    const abspaths = this.abspaths(fileids) as PathPointer[];
    if (!this._lazy) return abspaths.map((f) => this._getMLU(f, speaker));
    return new LazyMap((f: PathPointer) => this._getMLU(f, speaker), abspaths);
  }

  _getMLU(fileid: PathPointer, speaker: string): number {
    const sents = this._get_words(fileid, speaker, true, true, false, true, true, true) as Array<Array<[string, string]>>;
    const results: string[][] = [];
    let lastSent: Array<[string, string]> = [];
    let numFillers = 0;
    let sentDiscount = 0;
    for (const sent of sents) {
      const posList = sent.map(([, p]) => p);
      if (posList.some((p) => p === "unk")) continue;
      else if (sent.length === 0) continue;
      else if (pyListEq(sent, lastSent)) continue;
      else {
        results.push(sent.map(([w]) => w));
        if (posList.filter((p) => p === "co" || p === null).length > 0) {
          numFillers += posList.filter((p) => p === "co").length;
          numFillers += posList.filter((p) => p === null).length;
          sentDiscount += 1;
        }
      }
      lastSent = sent;
    }
    let mlu: number;
    try {
      const thisWordList = results.flat();
      const numWords = thisWordList.flatMap((w) => w.split("-")).length - numFillers;
      const numSents = results.length - sentDiscount;
      mlu = numWords / numSents;
      if (Number.isNaN(mlu)) throw pyError("ZeroDivisionError", "division by zero");
    } catch {
      mlu = 0;
    }
    return mlu;
  }

  _get_words(fileid: PathPointer, speaker: string | string[], sent: boolean | null,
    stem: boolean, relation: boolean | null, pos: boolean, strip_space: boolean, replace: boolean): unknown[] {
    let spk = speaker;
    if (typeof spk === "string" && spk !== "ALL") spk = [spk];
    const fp = openXml(fileid);
    let xmldoc: XMLElement;
    try {
      xmldoc = parseXmlStream(fp);
    } finally {
      fp.close();
    }
    const results: unknown[] = [];
    for (const xmlsent of xmldoc.findall(`.//{${CHILDES_NS}}u`)) {
      const sents: unknown[] = [];
      let _repl_cond: XMLElement | null = null;
      let _repl_word: XMLElement | null = null;
      let _wk: XMLElement | null = null;
      if (replace) {
        _repl_cond = xmlsent.find(`.//{${CHILDES_NS}}w/{${CHILDES_NS}}replacement`);
        _repl_word = xmlsent.find(`.//{${CHILDES_NS}}w/{${CHILDES_NS}}replacement/{${CHILDES_NS}}w`);
        _wk = xmlsent.find(`.//{${CHILDES_NS}}w/{${CHILDES_NS}}wk`);
      }
      if (spk === "ALL" || (spk as string[]).includes(xmlsent.get("who")!)) {
        for (const origWord of xmlsent.findall(`.//{${CHILDES_NS}}w`)) {
          let xmlword = origWord;
          let suffixStem: unknown = null;
          let suffixTag: unknown = null;
          if (_repl_cond !== null && _repl_cond.length) xmlword = _repl_word!;
          else if (_wk !== null && _wk.length) xmlword = _wk!;
          // get text
          let word: unknown = xmlword.text ? xmlword.text : "";
          if (strip_space) word = (word as string).trim();
          // stem
          if (relation || stem) {
            try {
              const xmlstem = xmlword.find(`.//{${CHILDES_NS}}stem`);
              if (xmlstem === null) throw pyError("AttributeError", "find()->None");
              word = xmlstem.text;
            } catch { /* AttributeError */ }
            // inflection
            try {
              const xmlinfl = xmlword.find(`.//{${CHILDES_NS}}mor/{${CHILDES_NS}}mw/{${CHILDES_NS}}mk`);
              if (xmlinfl === null || typeof word !== "string" || xmlinfl.text === null) {
                throw pyError("Exception", "infl");
              }
              word += "-" + xmlinfl.text;
            } catch { /* Exception */ }
            // suffix
            try {
              const xmlsuffix = xmlword.find(`.//{${CHILDES_NS}}mor/{${CHILDES_NS}}mor-post/{${CHILDES_NS}}mw/{${CHILDES_NS}}stem`);
              if (xmlsuffix === null) throw pyError("AttributeError", "find()->None");
              suffixStem = xmlsuffix.text;
            } catch {
              suffixStem = "";
            }
            if (suffixStem) {
              if (typeof word !== "string") throw pyError("TypeError", "None + str");
              word += "~" + (suffixStem as string);
            }
          }
          // pos
          if (relation || pos) {
            let tag: string;
            try {
              const xmlpos = xmlword.findall(`.//{${CHILDES_NS}}c`);
              const xmlpos2 = xmlword.findall(`.//{${CHILDES_NS}}s`);
              if (xmlpos2.length !== 0) tag = `${xmlpos[0]!.text}:${xmlpos2[0]!.text}`;
              else tag = xmlpos[0]!.text!;
            } catch {
              tag = "";
            }
            try {
              const xmlsuffixpos = xmlword.findall(`.//{${CHILDES_NS}}mor/{${CHILDES_NS}}mor-post/{${CHILDES_NS}}mw/{${CHILDES_NS}}pos/{${CHILDES_NS}}c`);
              const xmlsuffixpos2 = xmlword.findall(`.//{${CHILDES_NS}}mor/{${CHILDES_NS}}mor-post/{${CHILDES_NS}}mw/{${CHILDES_NS}}pos/{${CHILDES_NS}}s`);
              if (xmlsuffixpos2.length) suffixTag = `${xmlsuffixpos[0]!.text}:${xmlsuffixpos2[0]!.text}`;
              else suffixTag = xmlsuffixpos[0]!.text;
            } catch { /* Exception */ }
            if (suffixTag) tag += "~" + (suffixTag as string);
            word = [word, tag];
          }
          // relational
          if (relation) {
            for (const xmlstem_rel of xmlword.findall(`.//{${CHILDES_NS}}mor/{${CHILDES_NS}}gra`)) {
              const w = word as unknown[];
              if (xmlstem_rel.get("type") !== "grt") {
                word = [w[0], w[1],
                  `${xmlstem_rel.get("index")}|${xmlstem_rel.get("head")}|${xmlstem_rel.get("relation")}`];
              } else {
                word = [w[0], w[1], w[2], w[0], w[1],
                  `${xmlstem_rel.get("index")}|${xmlstem_rel.get("head")}|${xmlstem_rel.get("relation")}`];
              }
            }
            try {
              for (const xmlpost_rel of xmlword.findall(`.//{${CHILDES_NS}}mor/{${CHILDES_NS}}mor-post/{${CHILDES_NS}}gra`)) {
                const s = suffixStem as unknown[];
                if (xmlpost_rel.get("type") !== "grt") {
                  suffixStem = [s[0], s[1],
                    `${xmlpost_rel.get("index")}|${xmlpost_rel.get("head")}|${xmlpost_rel.get("relation")}`];
                } else {
                  suffixStem = [s[0], s[1], s[2], s[0], s[1],
                    `${xmlpost_rel.get("index")}|${xmlpost_rel.get("head")}|${xmlpost_rel.get("relation")}`];
                }
              }
            } catch { /* Exception */ }
          }
          sents.push(word);
        }
        if (sent || relation) results.push(sents);
        else results.push(...sents);
      }
    }
    return results;
  }

  webview_file(fileid: string, urlbase: string | null = null): string {
    let path: string;
    if (urlbase) {
      path = urlbase + "/" + fileid;
    } else {
      let full = String(this.root) + "/" + fileid;
      full = full.replace(/\\/g, "/");
      if (full.toLowerCase().includes("/childes/")) {
        path = /\/childes(?:\/data-xml)?\/(.*)\.xml/i.exec(full)![1]!;
      } else if (full.toLowerCase().includes("eng-usa")) {
        path = "Eng-USA/" + /\/Eng-USA\/(.*)\.xml/i.exec(full)![1]!;
      } else {
        path = fileid;
      }
    }
    if (path.endsWith(".xml")) path = path.slice(0, -4);
    if (!path.endsWith(".cha")) path += ".cha";
    const url = CHILDESCorpusReader.childes_url_base + path;
    console.log("Opening in browser:", url);
    return url;
  }
  webviewFile(fileid: string, urlbase: string | null = null): string { return this.webview_file(fileid, urlbase); }
}

function pyListEq(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const [x, y] = [a[i], b[i]];
    if (Array.isArray(x) && Array.isArray(y)) { if (!pyListEq(x, y)) return false; }
    else if (x !== y) return false;
  }
  return true;
}

// { verbnet

function textwrapFill(s: string, width: number, initial_indent: string, subsequent_indent: string): string {
  // Approximate textwrap.fill for the simple single-paragraph strings VN uses.
  const words = s.split(/\s+/).filter((w) => w !== "");
  const lines: string[] = [];
  let cur = initial_indent;
  for (const w of words) {
    const sep = cur === initial_indent || cur === subsequent_indent ? "" : " ";
    if ((cur + sep + w).length > width && cur !== initial_indent && cur !== subsequent_indent) {
      lines.push(cur);
      cur = subsequent_indent + w;
    } else {
      cur = cur + sep + w;
    }
  }
  lines.push(cur);
  return lines.join("\n");
}

/** nltk.corpus.reader.verbnet.VerbnetCorpusReader */
export class VerbnetCorpusReader extends XMLCorpusReader {
  static SUPPORTED_VERSIONS = ["2.1", "3.2", "3.3"];
  static _LONGID_RE = /^([A-Za-z_]+)-([\d.-]+)$/;
  // Python: re.compile(r"[\d.\-]+$") used via .match() -> start-anchored.
  static _SHORTID_RE = /^[\d.-]+$/;
  static _INDEX_RE = /<MEMBER name="\??([^"]+)" wn="([^"]*)"[^>]+>|<VNSUBCLASS ID="([^"]+)"\/?>/g;

  private _version: string;
  private _lemma_to_class: Map<string, string[]> = new Map();
  private _wordnet_to_class: Map<string, string[]> = new Map();
  private _class_to_fileid: Map<string, string> = new Map();
  private _shortid_to_longid: Map<string, string> = new Map();

  constructor(root: string | PathPointer, fileids: string | string[], wrap_etree = false, version = "2.1") {
    if (!VerbnetCorpusReader.SUPPORTED_VERSIONS.includes(version)) {
      throw pyError("ValueError",
        `VerbNet version ${pyrepr(version)} is not supported. ` +
        `Supported versions: (${VerbnetCorpusReader.SUPPORTED_VERSIONS.map((v) => `'${v}'`).join(", ")})`);
    }
    super(root, fileids, wrap_etree);
    this._version = version;
    this._quick_index();
  }

  get version(): string { return this._version; }

  lemmas(vnclass: string | XMLElement | null = null): unknown[] {
    if (vnclass === null) return [...this._lemma_to_class.keys()].sort();
    const vc = typeof vnclass === "string" ? (this.vnclass(vnclass) as XMLElement) : vnclass;
    return vc.findall("MEMBERS/MEMBER").map((m) => m.get("name"));
  }

  wordnetids(vnclass: string | XMLElement | null = null): unknown[] {
    if (vnclass === null) return [...this._wordnet_to_class.keys()].sort();
    const vc = typeof vnclass === "string" ? (this.vnclass(vnclass) as XMLElement) : vnclass;
    return vc.findall("MEMBERS/MEMBER").flatMap((m) => (m.get("wn", "") ?? "").split(/\s+/).filter((s) => s !== ""));
  }
  wordnetIds(vnclass: string | XMLElement | null = null): unknown[] { return this.wordnetids(vnclass); }

  classids(opts: { lemma?: string; wordnetid?: string; fileid?: string; classid?: string } = {}): unknown {
    const { lemma = null, wordnetid = null, fileid = null, classid = null } = opts;
    if (fileid !== null) {
      return [...this._class_to_fileid.entries()].filter(([, f]) => f === fileid).map(([c]) => c);
    } else if (lemma !== null) {
      return this._lemma_to_class.get(lemma) ?? [];
    } else if (wordnetid !== null) {
      return this._wordnet_to_class.get(wordnetid) ?? [];
    } else if (classid !== null) {
      const xmltree = this.vnclass(classid) as XMLElement;
      return xmltree.findall("SUBCLASSES/VNSUBCLASS").map((s) => s.get("ID"));
    } else {
      return [...this._class_to_fileid.keys()].sort();
    }
  }

  vnclass(fileid_or_classid: string): unknown {
    if (this._fileids.includes(fileid_or_classid)) return this.xml(fileid_or_classid);
    const classid = this.longid(fileid_or_classid);
    if (this._class_to_fileid.has(classid)) {
      const fileid = this._class_to_fileid.get(classid)!;
      const tree = this.xml(fileid) as XMLElement;
      if (classid === tree.get("ID")) return tree;
      for (const subclass of tree.findall(".//VNSUBCLASS")) {
        if (classid === subclass.get("ID")) return subclass;
      }
      throw pyError("AssertionError", "we saw it during _index()!");
    } else {
      throw pyError("ValueError", `Unknown identifier ${fileid_or_classid}`);
    }
  }

  override fileids(vnclass_ids: string | string[] | null = null): string[] {
    if (vnclass_ids === null) return this._fileids;
    else if (typeof vnclass_ids === "string") return [this._class_to_fileid.get(this.longid(vnclass_ids))!];
    else return vnclass_ids.map((id) => this._class_to_fileid.get(this.longid(id))!);
  }

  frames(vnclass: string | XMLElement): unknown[] {
    const vc = typeof vnclass === "string" ? (this.vnclass(vnclass) as XMLElement) : vnclass;
    return vc.findall("FRAMES/FRAME").map((vnframe) => ({
      example: this._get_example_within_frame(vnframe),
      description: this._get_description_within_frame(vnframe),
      syntax: this._get_syntactic_list_within_frame(vnframe),
      semantics: this._get_semantics_within_frame(vnframe),
    }));
  }

  subclasses(vnclass: string | XMLElement): unknown[] {
    const vc = typeof vnclass === "string" ? (this.vnclass(vnclass) as XMLElement) : vnclass;
    return vc.findall("SUBCLASSES/VNSUBCLASS").map((s) => s.get("ID"));
  }

  themroles(vnclass: string | XMLElement): unknown[] {
    const vc = typeof vnclass === "string" ? (this.vnclass(vnclass) as XMLElement) : vnclass;
    return vc.findall("THEMROLES/THEMROLE").map((trole) => ({
      type: trole.get("type"),
      modifiers: trole.findall("SELRESTRS/SELRESTR").map((r) => ({ value: r.get("Value"), type: r.get("type") })),
    }));
  }

  _index_helper(xmltree: XMLElement, fileid: string): void {
    const vnclass = xmltree.get("ID")!;
    this._class_to_fileid.set(vnclass, fileid);
    this._shortid_to_longid.set(this.shortid(vnclass), vnclass);
    for (const member of xmltree.findall("MEMBERS/MEMBER")) {
      pushMap(this._lemma_to_class, member.get("name")!, vnclass);
      for (const wn of (member.get("wn", "") ?? "").split(/\s+/).filter((s) => s !== "")) {
        pushMap(this._wordnet_to_class, wn, vnclass);
      }
    }
    for (const subclass of xmltree.findall("SUBCLASSES/VNSUBCLASS")) {
      this._index_helper(subclass, fileid);
    }
  }

  _quick_index(): void {
    for (const fileid of this._fileids) {
      let vnclass = fileid.slice(0, -4); // strip '.xml'
      this._class_to_fileid.set(vnclass, fileid);
      this._shortid_to_longid.set(this.shortid(vnclass), vnclass);
      const fp = this.open(fileid);
      try {
        const text = fp.read();
        VerbnetCorpusReader._INDEX_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = VerbnetCorpusReader._INDEX_RE.exec(text)) !== null) {
          const [, lemma, wn, subclassId] = m;
          if (lemma !== undefined) {
            pushMap(this._lemma_to_class, lemma, vnclass);
            for (const w of (wn ?? "").split(/\s+/).filter((s) => s !== "")) {
              pushMap(this._wordnet_to_class, w, vnclass);
            }
          } else if (subclassId !== undefined) {
            this._class_to_fileid.set(subclassId, fileid);
            vnclass = subclassId;
            this._shortid_to_longid.set(this.shortid(vnclass), vnclass);
          } else {
            throw pyError("AssertionError", "unexpected match condition");
          }
        }
      } finally {
        fp.close();
      }
    }
  }

  longid(shortid: string): string {
    const lm = VerbnetCorpusReader._LONGID_RE.exec(shortid);
    if (lm) return shortid;
    else if (!VerbnetCorpusReader._SHORTID_RE.test(shortid)) {
      throw pyError("ValueError", `vnclass identifier ${pyrepr(shortid)} not found`);
    }
    const l = this._shortid_to_longid.get(shortid);
    if (l === undefined) throw pyError("ValueError", `vnclass identifier ${pyrepr(shortid)} not found`);
    return l;
  }

  shortid(longid: string): string {
    if (VerbnetCorpusReader._SHORTID_RE.test(longid)) return longid;
    const m = VerbnetCorpusReader._LONGID_RE.exec(longid);
    if (m) return m[2]!;
    else throw pyError("ValueError", `vnclass identifier ${pyrepr(longid)} not found`);
  }

  _get_semantics_within_frame(vnframe: XMLElement): unknown[] {
    return vnframe.findall("SEMANTICS/PRED").map((pred) => ({
      predicate_value: pred.get("value"),
      arguments: pred.findall("ARGS/ARG").map((arg) => ({ type: arg.get("type"), value: arg.get("value") })),
      negated: pred.get("bool") === "!",
    }));
  }

  _get_example_within_frame(vnframe: XMLElement): unknown {
    const ex = vnframe.find("EXAMPLES/EXAMPLE");
    return ex !== null ? ex.text : "";
  }

  _get_description_within_frame(vnframe: XMLElement): unknown {
    const d = vnframe.find("DESCRIPTION")!;
    return { primary: d.attrib.get("primary"), secondary: d.get("secondary", "") };
  }

  _get_syntactic_list_within_frame(vnframe: XMLElement): unknown[] {
    return vnframe.find("SYNTAX")!.children.map((elt) => ({
      pos_tag: elt.tag,
      modifiers: {
        value: elt.attrib.has("value") ? elt.get("value") : "",
        selrestrs: elt.findall("SELRESTRS/SELRESTR").map((r) => ({ value: r.get("Value"), type: r.get("type") })),
        synrestrs: elt.findall("SYNRESTRS/SYNRESTR").map((r) => ({ value: r.get("Value"), type: r.get("type") })),
      },
    }));
  }

  pprint(vnclass: string | XMLElement): string {
    const vc = typeof vnclass === "string" ? (this.vnclass(vnclass) as XMLElement) : vnclass;
    let s = vc.get("ID") + "\n";
    s += this.pprint_subclasses(vc, "  ") + "\n";
    s += this.pprint_members(vc, "  ") + "\n";
    s += "  Thematic roles:\n";
    s += this.pprint_themroles(vc, "    ") + "\n";
    s += "  Frames:\n";
    s += this.pprint_frames(vc, "    ");
    return s;
  }

  pprint_subclasses(vnclass: string | XMLElement, indent = ""): string {
    const vc = typeof vnclass === "string" ? (this.vnclass(vnclass) as XMLElement) : vnclass;
    let subclasses = this.subclasses(vc) as string[];
    if (!subclasses.length) subclasses = ["(none)"];
    return textwrapFill("Subclasses: " + subclasses.join(" "), 70, indent, indent + "  ");
  }
  pprintSubclasses(vnclass: string | XMLElement, indent = ""): string { return this.pprint_subclasses(vnclass, indent); }

  pprint_members(vnclass: string | XMLElement, indent = ""): string {
    const vc = typeof vnclass === "string" ? (this.vnclass(vnclass) as XMLElement) : vnclass;
    let members = this.lemmas(vc) as string[];
    if (!members.length) members = ["(none)"];
    return textwrapFill("Members: " + members.join(" "), 70, indent, indent + "  ");
  }
  pprintMembers(vnclass: string | XMLElement, indent = ""): string { return this.pprint_members(vnclass, indent); }

  pprint_themroles(vnclass: string | XMLElement, indent = ""): string {
    const vc = typeof vnclass === "string" ? (this.vnclass(vnclass) as XMLElement) : vnclass;
    const pieces: string[] = [];
    for (const themrole of this.themroles(vc) as Array<Record<string, unknown>>) {
      let piece = indent + "* " + (themrole["type"] as string);
      const modifiers = (themrole["modifiers"] as Array<Record<string, string>>).map((m) => m["value"]! + m["type"]!);
      if (modifiers.length) piece += `[${modifiers.join(" ")}]`;
      pieces.push(piece);
    }
    return pieces.join("\n");
  }
  pprintThemroles(vnclass: string | XMLElement, indent = ""): string { return this.pprint_themroles(vnclass, indent); }

  pprint_frames(vnclass: string | XMLElement, indent = ""): string {
    const vc = typeof vnclass === "string" ? (this.vnclass(vnclass) as XMLElement) : vnclass;
    return (this.frames(vc) as Array<Record<string, unknown>>)
      .map((vnframe) => this._pprint_single_frame(vnframe, indent)).join("\n");
  }
  pprintFrames(vnclass: string | XMLElement, indent = ""): string { return this.pprint_frames(vnclass, indent); }

  _pprint_single_frame(vnframe: Record<string, unknown>, indent = ""): string {
    let frame_string = this._pprint_description_within_frame(vnframe, indent) + "\n";
    frame_string += (this._pprint_example_within_frame(vnframe, indent + " ") ?? "") + "\n";
    frame_string += this._pprint_syntax_within_frame(vnframe, indent + "  Syntax: ") + "\n";
    frame_string += indent + "  Semantics:\n";
    frame_string += this._pprint_semantics_within_frame(vnframe, indent + "    ");
    return frame_string;
  }

  _pprint_example_within_frame(vnframe: Record<string, unknown>, indent = ""): string | null {
    if (vnframe["example"]) return `${indent} Example: ${vnframe["example"]}`;
    return null;
  }

  _pprint_description_within_frame(vnframe: Record<string, unknown>, indent = ""): string {
    const d = vnframe["description"] as Record<string, string>;
    let description = indent + d["primary"];
    if (d["secondary"]) description += ` (${d["secondary"]})`;
    return description;
  }

  _pprint_syntax_within_frame(vnframe: Record<string, unknown>, indent = ""): string {
    const pieces: string[] = [];
    for (const element of vnframe["syntax"] as Array<Record<string, unknown>>) {
      let piece = element["pos_tag"] as string;
      const modifier_list: string[] = [];
      const mods = element["modifiers"] as Record<string, unknown>;
      if (mods["value"]) modifier_list.push(mods["value"] as string);
      const restrs = [...(mods["selrestrs"] as Array<Record<string, string>>), ...(mods["synrestrs"] as Array<Record<string, string>>)];
      modifier_list.push(...restrs.map((r) => `${r["value"]}${r["type"]}`));
      if (modifier_list.length) piece += `[${modifier_list.join(" ")}]`;
      pieces.push(piece);
    }
    return indent + pieces.join(" ");
  }

  _pprint_semantics_within_frame(vnframe: Record<string, unknown>, indent = ""): string {
    const pieces: string[] = [];
    for (const predicate of vnframe["semantics"] as Array<Record<string, unknown>>) {
      const args = (predicate["arguments"] as Array<Record<string, string>>).map((a) => a["value"]);
      pieces.push(`${predicate["negated"] ? "¬" : ""}${predicate["predicate_value"]}(${args.join(", ")})`);
    }
    return pieces.map((p) => `${indent}* ${p}`).join("\n");
  }
}

function pushMap<K, V>(m: Map<K, V[]>, k: K, v: V): void {
  const arr = m.get(k);
  if (arr) arr.push(v);
  else m.set(k, [v]);
}

// { mte

const MTE_MSD_UNIVERSAL: Record<string, string> = {
  A: "ADJ",
  S: "ADP",
  R: "ADV",
  C: "CONJ",
  D: "DET",
  N: "NOUN",
  M: "NUM",
  Q: "PRT",
  P: "PRON",
  V: "VERB",
  ".": ".",
  "-": "X",
};

const MTE_NS: Record<string, string> = { t: "https://www.tei-c.org/ns/1.0" };

/** nltk.corpus.reader.mte.MTETagConverter */
export class MTETagConverter {
  static readonly mapping_msd_universal = MTE_MSD_UNIVERSAL;

  static msd_to_universal(tag: string): string {
    let indicator = tag[0] !== "#" ? tag[0] : tag[1];
    if (indicator === undefined || !(indicator in MTE_MSD_UNIVERSAL)) indicator = "-";
    return MTE_MSD_UNIVERSAL[indicator]!;
  }
  static msdToUniversal(tag: string): string { return MTETagConverter.msd_to_universal(tag); }
}

// class-level state mirroring MTEFileReader.__tags/__tagset (name-mangled class attrs)
const mteReaderState = { tags: "", tagset: "msd" };

/** nltk.corpus.reader.mte.MTECorpusView — filters out null handler results. */
export class MTECorpusView extends XMLCorpusView<unknown> {
  constructor(fileid: string | PathPointer, tagspec: string, elt_handler: XmlEltHandler<unknown> | null = null) {
    super(fileid, tagspec, elt_handler);
    const orig = this.read_block;
    this.read_block = (stream) => {
      const toks = (orig as (s: SeekableUnicodeStreamReader) => unknown[])(stream);
      return toks.filter((x) => x !== null);
    };
  }
}

/** nltk.corpus.reader.mte.MTEFileReader */
export class MTEFileReader {
  protected file_path: string;
  private requiredRoot: string | null;

  static word_path = "TEI/text/body/div/div/p/s/(w|c)";
  static sent_path = "TEI/text/body/div/div/p/s";
  static para_path = "TEI/text/body/div/div/p";

  constructor(file_path: string, requiredRoot: string | null = null) {
    this.file_path = file_path;
    this.requiredRoot = requiredRoot;
    validate_path(file_path, "MTECorpusReader", this.requiredRoot);
  }

  _view(tagspec: string, elt_handler: XmlEltHandler<unknown>): unknown {
    return new MTECorpusView(this.file_path, tagspec, elt_handler);
  }

  words(): unknown {
    mteReaderState.tagset = "msd"; mteReaderState.tags = "";
    return this._view(MTEFileReader.word_path, (e) => MTEFileReader._word_elt(e));
  }
  sents(): unknown {
    mteReaderState.tagset = "msd"; mteReaderState.tags = "";
    return this._view(MTEFileReader.sent_path, (e) => MTEFileReader._sent_elt(e));
  }
  paras(): unknown {
    mteReaderState.tagset = "msd"; mteReaderState.tags = "";
    return this._view(MTEFileReader.para_path, (e) => MTEFileReader._para_elt(e));
  }
  lemma_words(): unknown {
    mteReaderState.tagset = "msd"; mteReaderState.tags = "";
    return this._view(MTEFileReader.word_path, (e) => MTEFileReader._lemma_word_elt(e));
  }
  tagged_words(tagset: string, tags: string): unknown {
    mteReaderState.tagset = tagset; mteReaderState.tags = tags;
    return this._view(MTEFileReader.word_path, (e) => MTEFileReader._tagged_word_elt(e));
  }
  tagged_sents(tagset: string, tags: string): unknown {
    mteReaderState.tagset = tagset; mteReaderState.tags = tags;
    return this._view(MTEFileReader.sent_path, (e) => MTEFileReader._tagged_sent_elt(e));
  }
  tagged_paras(tagset: string, tags: string): unknown {
    mteReaderState.tagset = tagset; mteReaderState.tags = tags;
    return this._view(MTEFileReader.para_path, (e) => MTEFileReader._tagged_para_elt(e));
  }
  lemma_sents(): unknown {
    mteReaderState.tagset = "msd"; mteReaderState.tags = "";
    return this._view(MTEFileReader.sent_path, (e) => MTEFileReader._lemma_sent_elt(e));
  }
  lemma_paras(): unknown {
    mteReaderState.tagset = "msd"; mteReaderState.tags = "";
    return this._view(MTEFileReader.para_path, (e) => MTEFileReader._lemma_para_elt(e));
  }

  static _word_elt(elt: XMLElement): unknown {
    return elt.text;
  }

  static _lemma_word_elt(elt: XMLElement): unknown {
    return [elt.text, elt.attrib.get("lemma") ?? ""];
  }

  static _tagged_word_elt(elt: XMLElement): unknown {
    if (!elt.attrib.has("ana")) return [elt.text, ""];
    const tags = mteReaderState.tags;
    const tagset = mteReaderState.tagset;
    const ana = elt.attrib.get("ana")!;
    if (tags === "" && tagset === "msd") {
      return [elt.text, ana];
    } else if (tags === "" && tagset === "universal") {
      return [elt.text, MTETagConverter.msd_to_universal(ana)];
    } else {
      const re = new RegExp("^" + tags.replace(/-/g, ".") + ".*$");
      if (re.test(ana)) {
        if (tagset === "msd") return [elt.text, ana];
        return [elt.text, MTETagConverter.msd_to_universal(ana)];
      }
      return null;
    }
  }

  static _sent_elt(elt: XMLElement): unknown {
    return xpath(elt, "*", MTE_NS).map((w) => MTEFileReader._word_elt(w));
  }
  static _lemma_sent_elt(elt: XMLElement): unknown {
    return xpath(elt, "*", MTE_NS).map((w) => MTEFileReader._lemma_word_elt(w));
  }
  static _tagged_sent_elt(elt: XMLElement): unknown {
    return xpath(elt, "*", MTE_NS).map((w) => MTEFileReader._tagged_word_elt(w))
      .filter((x) => x !== null);
  }
  static _para_elt(elt: XMLElement): unknown {
    return xpath(elt, "*", MTE_NS).map((x) => MTEFileReader._sent_elt(x));
  }
  static _lemma_para_elt(elt: XMLElement): unknown {
    return xpath(elt, "*", MTE_NS).map((x) => MTEFileReader._lemma_sent_elt(x));
  }
  static _tagged_para_elt(elt: XMLElement): unknown {
    return xpath(elt, "*", MTE_NS).map((x) => MTEFileReader._tagged_sent_elt(x))
      .filter((x) => x !== null);
  }
}

/** nltk.corpus.reader.mte.MTECorpusReader */
export class MTECorpusReader extends TaggedCorpusReader {
  protected override _readme = "00README.txt";

  constructor(root: string | PathPointer | null = null, fileids: string | null = null, encoding = "utf8") {
    // Python: TaggedCorpusReader.__init__(self, root, fileids, encoding)
    // -> 'encoding' lands in the 'sep' slot (kept quirk).
    super(root!, fileids as unknown as string, encoding as unknown as string);
  }

  private filtered_fileids(fileids: string[] | null): string[] {
    if (fileids === null || fileids === undefined) fileids = this._fileids;
    else if (typeof (fileids as unknown) === "string") fileids = [fileids as unknown as string];
    return fileids.filter(
      (f) => f !== "oana-bg.xml" && f !== "oana-mk.xml" && this._fileids.includes(f));
  }

  private readers(fileids: string[] | null): MTEFileReader[] {
    const fs = this.filtered_fileids(fileids);
    // Python: filter object truthiness => warning never fires (kept quirk).
    return fs.map((f) => new MTEFileReader(pathJoin(String(this._root), f), String(this._root)));
  }

  override words(fileids: string[] | null = null): unknown {
    return concat(this.readers(fileids).map((f) => f.words()));
  }
  override sents(fileids: string[] | null = null): unknown {
    return concat(this.readers(fileids).map((f) => f.sents()));
  }
  override paras(fileids: string[] | null = null): unknown {
    return concat(this.readers(fileids).map((f) => f.paras()));
  }
  lemma_words(fileids: string[] | null = null): unknown {
    return concat(this.readers(fileids).map((f) => f.lemma_words()));
  }
  lemmaWords(fileids: string[] | null = null): unknown { return this.lemma_words(fileids); }
  override tagged_words(fileids: string[] | null = null, tagset = "msd", tags = ""): unknown {
    return concat(this.readers(fileids).map((f) => f.tagged_words(tagset, tags)));
  }
  override taggedWords(fileids: string[] | null = null, tagset = "msd", tags = ""): unknown {
    return this.tagged_words(fileids, tagset, tags);
  }
  lemma_sents(fileids: string[] | null = null): unknown {
    return concat(this.readers(fileids).map((f) => f.lemma_sents()));
  }
  lemmaSents(fileids: string[] | null = null): unknown { return this.lemma_sents(fileids); }
  override tagged_sents(fileids: string[] | null = null, tagset = "msd", tags = ""): unknown {
    return concat(this.readers(fileids).map((f) => f.tagged_sents(tagset, tags)));
  }
  override taggedSents(fileids: string[] | null = null, tagset = "msd", tags = ""): unknown {
    return this.tagged_sents(fileids, tagset, tags);
  }
  lemma_paras(fileids: string[] | null = null): unknown {
    return concat(this.readers(fileids).map((f) => f.lemma_paras()));
  }
  lemmaParas(fileids: string[] | null = null): unknown { return this.lemma_paras(fileids); }
  override tagged_paras(fileids: string[] | null = null, tagset = "msd", tags = ""): unknown {
    return concat(this.readers(fileids).map((f) => f.tagged_paras(tagset, tags)));
  }
  override taggedParas(fileids: string[] | null = null, tagset = "msd", tags = ""): unknown {
    return this.tagged_paras(fileids, tagset, tags);
  }
}

// { ipipan

interface IpOptions {
  tags?: boolean;
  mode?: number;
  simplify_tags?: boolean;
  one_tag?: boolean;
  disamb_only?: boolean;
  append_no_space?: boolean;
  append_space?: boolean;
  replace_xmlentities?: boolean;
}

const IP_OPTIONS_KEYS = new Set(["tags", "mode", "simplify_tags", "one_tag", "disamb_only", "append_no_space", "append_space", "replace_xmlentities"]);

/** nltk.corpus.reader.ipipan.IPIPANCorpusReader */
export class IPIPANCorpusReader extends CorpusReader {
  constructor(root: string | PathPointer, fileids: string | string[]) {
    super(root, fileids);
  }

  channels(fileids: string[] | null = null): string[] {
    if (!fileids) fileids = this.fileids();
    return this._parse_header(fileids, "channel");
  }

  domains(fileids: string[] | null = null): string[] {
    if (!fileids) fileids = this.fileids();
    return this._parse_header(fileids, "domain");
  }

  categories(fileids: string[] | null = null): string[] {
    if (!fileids) fileids = this.fileids();
    return this._parse_header(fileids, "keyTerm").map((c) => this._map_category(c));
  }

  override fileids(channels: string | string[] | null = null, domains: string | string[] | null = null, categories: string | string[] | null = null): string[] {
    if (channels !== null && domains !== null && categories !== null) {
      throw pyError("ValueError", "You can specify only one of channels, domains and categories parameter at once");
    }
    if (channels === null && domains === null && categories === null) return super.fileids();
    const ch = typeof channels === "string" ? [channels] : channels;
    const dom = typeof domains === "string" ? [domains] : domains;
    const cat = typeof categories === "string" ? [categories] : categories;
    if (ch) return this._list_morph_files_by("channel", ch);
    else if (dom) return this._list_morph_files_by("domain", dom);
    else return this._list_morph_files_by("keyTerm", cat!, (v) => this._map_category(v));
  }

  sents(fileids: string[] | null = null, options: IpOptions = {}): unknown {
    fileids = fileids && fileids.length ? fileids : this.fileids();
    return concat(this._list_morph_files(fileids).map((f) =>
      this._view(f, { ...options, mode: IPIPANCorpusView.SENTS_MODE, tags: false })));
  }

  paras(fileids: string[] | null = null, options: IpOptions = {}): unknown {
    fileids = fileids && fileids.length ? fileids : this.fileids();
    return concat(this._list_morph_files(fileids).map((f) =>
      this._view(f, { ...options, mode: IPIPANCorpusView.PARAS_MODE, tags: false })));
  }

  words(fileids: string[] | null = null, options: IpOptions = {}): unknown {
    fileids = fileids && fileids.length ? fileids : this.fileids();
    return concat(this._list_morph_files(fileids).map((f) =>
      this._view(f, { ...options, tags: false })));
  }

  tagged_sents(fileids: string[] | null = null, options: IpOptions = {}): unknown {
    fileids = fileids && fileids.length ? fileids : this.fileids();
    return concat(this._list_morph_files(fileids).map((f) =>
      this._view(f, { ...options, mode: IPIPANCorpusView.SENTS_MODE })));
  }
  taggedSents(fileids: string[] | null = null, options: IpOptions = {}): unknown { return this.tagged_sents(fileids, options); }

  tagged_paras(fileids: string[] | null = null, options: IpOptions = {}): unknown {
    fileids = fileids && fileids.length ? fileids : this.fileids();
    return concat(this._list_morph_files(fileids).map((f) =>
      this._view(f, { ...options, mode: IPIPANCorpusView.PARAS_MODE })));
  }
  taggedParas(fileids: string[] | null = null, options: IpOptions = {}): unknown { return this.tagged_paras(fileids, options); }

  tagged_words(fileids: string[] | null = null, options: IpOptions = {}): unknown {
    fileids = fileids && fileids.length ? fileids : this.fileids();
    return concat(this._list_morph_files(fileids).map((f) => this._view(f, { ...options })));
  }
  taggedWords(fileids: string[] | null = null, options: IpOptions = {}): unknown { return this.tagged_words(fileids, options); }

  _list_morph_files(fileids: string[]): PathPointer[] {
    return this.abspaths(fileids) as PathPointer[];
  }

  _list_header_files(fileids: string[]): string[] {
    return this._list_morph_files(fileids).map((f) => String(f).replace("morph.xml", "header.xml"));
  }

  _parse_header(fileids: string[], tag: string): string[] {
    const values = new Set<string>();
    for (const f of this._list_header_files(fileids)) {
      for (const v of this._get_tag(f, tag)) values.add(v);
    }
    return [...values];
  }

  _list_morph_files_by(tag: string, values: string[], map?: (v: string) => string): string[] {
    const fileids = this.fileids();
    const ret = new Set<string>();
    for (const f of fileids) {
      const fp = String(this.abspath(f)).replace("morph.xml", "header.xml");
      for (let value of this._get_tag(fp, tag)) {
        if (map) value = map(value);
        if (values.includes(value)) ret.add(f);
      }
    }
    return [...ret];
  }

  _get_tag(f: string, tag: string): string[] {
    const raw = pathsecOpen(f, "r", "IPIPANCorpusReader", String(this.root));
    const header = decUtf8.decode(raw);
    const tags: string[] = [];
    let tag_end = 0;
    for (;;) {
      const tag_pos = header.indexOf("<" + tag, tag_end);
      if (tag_pos < 0) return tags;
      tag_end = header.indexOf("</" + tag + ">", tag_pos);
      tags.push(header.slice(tag_pos + tag.length + 2, tag_end));
    }
  }

  _map_category(cat: string): string {
    const pos = cat.indexOf(">");
    return pos === -1 ? cat : cat.slice(pos + 1);
  }

  _view(filename: PathPointer, options: IpOptions): IPIPANCorpusView {
    const opts: IpOptions = {
      tags: options.tags ?? true,
      mode: options.mode ?? 0,
      simplify_tags: options.simplify_tags ?? false,
      one_tag: options.one_tag ?? true,
      disamb_only: options.disamb_only ?? true,
      append_no_space: options.append_no_space ?? false,
      append_space: options.append_space ?? false,
      replace_xmlentities: options.replace_xmlentities ?? true,
    };
    const unexpected = Object.keys(options).filter((k) => !IP_OPTIONS_KEYS.has(k));
    if (unexpected.length > 0) {
      throw pyError("ValueError", `Unexpected arguments: ${unexpected}`);
    }
    if (!opts.one_tag && !opts.disamb_only) {
      throw pyError("ValueError", "You cannot specify both one_tag=False and disamb_only=False");
    }
    if (!opts.tags && (opts.simplify_tags || !opts.one_tag || !opts.disamb_only)) {
      throw pyError("ValueError", "You cannot specify simplify_tags, one_tag or disamb_only with functions other than tagged_*");
    }
    return new IPIPANCorpusView(filename, 0, opts as Required<IpOptions>);
  }
}

/** nltk.corpus.reader.ipipan.IPIPANCorpusView */
export class IPIPANCorpusView extends StreamBackedCorpusView<unknown> {
  static WORDS_MODE = 0;
  static SENTS_MODE = 1;
  static PARAS_MODE = 2;

  in_sentence = false;
  position = 0;
  show_tags: boolean;
  disamb_only: boolean;
  mode: number;
  simplify_tags: boolean;
  one_tag: boolean;
  append_no_space: boolean;
  append_space: boolean;
  replace_xmlentities: boolean;

  constructor(filename: string | PathPointer, startpos = 0, options: Required<IpOptions>) {
    // Python: StreamBackedCorpusView.__init__(self, filename, None, startpos, None)
    // — encoding=None opens a *binary* stream (see _read_data for the fallout).
    super(filename, undefined, startpos, null);
    this.show_tags = options.tags;
    this.disamb_only = options.disamb_only;
    this.mode = options.mode;
    this.simplify_tags = options.simplify_tags;
    this.one_tag = options.one_tag;
    this.append_no_space = options.append_no_space;
    this.append_space = options.append_space;
    this.replace_xmlentities = options.replace_xmlentities;
    this.read_block = (stream) => this.readIpBlock(stream);
  }

  private readIpBlock(stream: SeekableUnicodeStreamReader): unknown[] {
    const sentence: unknown[] = [];
    const sentences: unknown[] = [];
    let space = false;
    let no_space = false;

    let tags = new Set<string>();
    let orth = "";

    let lines = this._read_data(stream);
    for (;;) {
      if (lines.length <= 1) {
        this._seek(stream);
        lines = this._read_data(stream);
      }
      if (lines.length === 1 && lines[0] === "") {
        if (sentences.length !== 0) throw pyError("AssertionError", "not sentences");
        return [];
      }
      const line = lines.pop()!;
      this.position += line.length + 1;

      if (line.startsWith('<chunk type="s"')) {
        this.in_sentence = true;
      } else if (line.startsWith('<chunk type="p"')) {
        // pass
      } else if (line.startsWith("<tok")) {
        if (this.append_space && space && !no_space) this._append_space(sentence);
        space = true;
        no_space = false;
        orth = "";
        tags = new Set();
      } else if (line.startsWith("</chunk")) {
        if (this.in_sentence) {
          this.in_sentence = false;
          this._seek(stream);
          if (this.mode === IPIPANCorpusView.SENTS_MODE) {
            return [sentence];
          } else if (this.mode === IPIPANCorpusView.WORDS_MODE) {
            if (this.append_space) this._append_space(sentence);
            return sentence;
          } else {
            sentences.push(sentence);
          }
        } else if (this.mode === IPIPANCorpusView.PARAS_MODE) {
          this._seek(stream);
          return [sentences];
        }
      } else if (line.startsWith("<orth")) {
        orth = line.slice(6, -7);
        if (this.replace_xmlentities) {
          orth = orth.replace(/&quot;/g, "\"").replace(/&amp;/g, "&");
        }
      } else if (line.startsWith("<lex")) {
        if (!this.disamb_only || line.indexOf("disamb=") !== -1) {
          const tag = line.slice(line.indexOf("<ctag") + 6, line.indexOf("</ctag"));
          tags.add(tag);
        }
      } else if (line.startsWith("</tok")) {
        if (this.show_tags) {
          if (this.simplify_tags) {
            tags = new Set([...tags].map((t) => t.split(":")[0]!));
          }
          if (!this.one_tag || !this.disamb_only) {
            sentence.push([orth, [...tags]]);
          } else {
            sentence.push([orth, [...tags].pop()]);
          }
        } else {
          sentence.push(orth);
        }
      } else if (line.startsWith("<ns/>")) {
        if (this.append_space) no_space = true;
        if (this.append_no_space) {
          if (this.show_tags) sentence.push(["", "no-space"]);
          else sentence.push("");
        }
      } else if (line.startsWith("</cesAna")) {
        // pass
      }
    }
  }

  _read_data(stream: SeekableUnicodeStreamReader): string[] {
    this.position = stream.tell();
    // Faithful to NLTK 3.10.3 on Python 3: encoding=None yields a raw binary
    // stream, so ``buff`` is bytes and ``buff.split("\n")`` raises:
    if (!this._encoding) {
      throw pyError("TypeError", "a bytes-like object is required, not 'str'");
    }
    const buff = stream.read(4096);
    const lines = buff.split("\n");
    lines.reverse();
    return lines;
  }

  _seek(stream: SeekableUnicodeStreamReader): void {
    stream.seek(this.position);
  }

  _append_space(sentence: unknown[]): void {
    if (this.show_tags) sentence.push([" ", "space"]);
    else sentence.push(" ");
  }
}

// { nkjp

/** nltk.corpus.reader.nkjp.NKJPCorpusReader */
export class NKJPCorpusReader extends XMLCorpusReader {
  static WORDS_MODE = 0;
  static SENTS_MODE = 1;
  static HEADER_MODE = 2;
  static RAW_MODE = 3;

  _paths: string[];

  constructor(root: string | PathPointer, fileids: string | string[] = ".*") {
    if (typeof fileids === "string") {
      super(root, fileids + ".*/header.xml");
    } else {
      super(root, fileids.map((f) => f + "/header.xml"));
    }
    this._paths = this.get_paths();
  }

  get_paths(): string[] {
    return this._fileids.map((f) => pathJoin(String(this._root), f.split("header.xml")[0]!));
  }
  getPaths(): string[] { return this.get_paths(); }

  override fileids(): string[] {
    return this._fileids.map((f) => f.split("header.xml")[0]!);
  }

  _view(filename: string, tags: string[] | null = null, mode: number = NKJPCorpusReader.WORDS_MODE): XMLCorpusView<unknown> {
    if (mode === NKJPCorpusReader.WORDS_MODE) {
      return new NKJPCorpus_Morph_View(filename, { tags });
    } else if (mode === NKJPCorpusReader.SENTS_MODE) {
      return new NKJPCorpus_Segmentation_View(filename, { tags });
    } else if (mode === NKJPCorpusReader.HEADER_MODE) {
      return new NKJPCorpus_Header_View(filename);
    } else if (mode === NKJPCorpusReader.RAW_MODE) {
      return new NKJPCorpus_Text_View(filename, { mode: NKJPCorpus_Text_View.RAW_MODE });
    } else {
      throw pyError("NameError", "No such mode!");
    }
  }

  add_root(fileid: string): string {
    const root = pathResolve(String(this.root));
    fileid = String(fileid);
    const result = isAbsolute(fileid) ? fileid : pathJoin(root, fileid);
    validate_path(result, "NKJPCorpusReader", String(this.root));
    return result;
  }
  addRoot(fileid: string): string { return this.add_root(fileid); }

  private fileidsOrPaths(fileids: string[] | null): string[] {
    return fileids && fileids.length ? fileids : this._paths;
  }

  header(fileids: string[] | null = null): unknown {
    const ids = this.fileidsOrPaths(fileids);
    return concat(ids.map((f) =>
      (this._view(this.add_root(f), null, NKJPCorpusReader.HEADER_MODE) as NKJPCorpus_Header_View).handle_query()));
  }

  sents(fileids: string[] | null = null): unknown {
    const ids = this.fileidsOrPaths(fileids);
    return concat(ids.map((f) =>
      (this._view(this.add_root(f), null, NKJPCorpusReader.SENTS_MODE) as NKJPCorpus_Segmentation_View).handle_query()));
  }

  override words(fileids: string | string[] | null = null): unknown {
    const ids = this.fileidsOrPaths(typeof fileids === "string" ? [fileids] : fileids);
    return concat(ids.map((f) =>
      (this._view(this.add_root(f), null, NKJPCorpusReader.WORDS_MODE) as NKJPCorpus_Morph_View).handle_query()));
  }

  tagged_words(fileids: string[] | null = null, tags: string[] = []): unknown {
    const ids = this.fileidsOrPaths(fileids);
    return concat(ids.map((f) =>
      (this._view(this.add_root(f), tags, NKJPCorpusReader.WORDS_MODE) as NKJPCorpus_Morph_View).handle_query()));
  }
  taggedWords(fileids: string[] | null = null, tags: string[] = []): unknown { return this.tagged_words(fileids, tags); }

  override raw(fileids: string | string[] | null = null): string {
    const ids = this.fileidsOrPaths(typeof fileids === "string" ? [fileids] : fileids);
    return concat(ids.map((f) =>
      (this._view(this.add_root(f), null, NKJPCorpusReader.RAW_MODE) as NKJPCorpus_Text_View).handle_query())) as unknown as string;
  }
}

/** nltk.corpus.reader.nkjp.NKJPCorpus_Header_View */
export class NKJPCorpus_Header_View extends XMLCorpusView<unknown> {
  tagspec = ".*/sourceDesc$";
  constructor(filename: string, _kwargs: Record<string, unknown> = {}) {
    super(filename + "header.xml", ".*/sourceDesc$");
    this.handle_elt = (elt, ctx) => this.handleHeaderElt(elt, ctx);
  }

  handle_query(): unknown[] {
    this._open();
    const header: unknown[] = [];
    for (;;) {
      const segm = this.readBlock(this._stream!);
      if (segm.length === 0) break;
      header.push(...segm);
    }
    this.close();
    return header;
  }
  handleQuery(): unknown[] { return this.handle_query(); }

  private handleHeaderElt(elt: XMLElement, _context: string): unknown {
    const grab = (name: string): string | string[] => {
      const elts = elt.findall(`bibl/${name}`);
      return elts.length ? elts.map((e) => (e.text ?? "").trim()).join("\n") : [];
    };
    return {
      title: grab("title"), author: grab("author"), date: grab("date"),
      publisher: grab("publisher"), idno: grab("idno"), note: grab("note"),
    };
  }
}

/**
 * nltk.corpus.reader.nkjp.XML_Tool — strips ``nkjp:`` names into a temp file.
 * Faithful to NLTK 3.10.3: ``write_file`` is a *binary* NamedTemporaryFile,
 * so ``fw.write(str)`` raises TypeError and build_preprocessed_file()
 * propagates a bare ``Exception``.
 */
export class XML_Tool {
  _root: string;
  read_file: string;
  write_file_name: string;

  constructor(root: string, filename: string) {
    this._root = root;
    this.read_file = pathJoin(root, filename);
    // tempfile.NamedTemporaryFile(delete=False) — binary mode ("w+b"),
    // created eagerly on construction.
    const dir = mkdtempSync(pathJoin(tmpdir(), "nkjp"));
    this.write_file_name = pathJoin(dir, "tmp-nkjp.xml");
    writeFileSync(this.write_file_name, "");
  }

  build_preprocessed_file(): string {
    try {
      const fr = pathsecOpen(this.read_file, "r", "NKJPCorpusReader", this._root);
      const text = decUtf8.decode(fr);
      for (const line of text.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
        let x = line.split(/nkjp:[^ ]* /);
        let ret = x.join(" ");
        x = ret.split("<nkjp:paren>"); ret = x.join(" ");
        x = ret.split("</nkjp:paren>"); ret = x.join(" ");
        x = ret.split("<choice>"); ret = x.join(" ");
        x = ret.split("</choice>"); ret = x.join(" ");
        // fw.write(ret) on a binary-mode file: writing str raises TypeError
        this.writeBinary(ret as unknown as Uint8Array);
      }
      return this.write_file_name;
    } catch {
      this.remove_preprocessed_file();
      throw pyError("Exception", "");
    }
  }
  buildPreprocessedFile(): string { return this.build_preprocessed_file(); }

  /** Binary-mode temp file write — accepts bytes only (str => TypeError). */
  private writeBinary(data: Uint8Array): void {
    if (!(data instanceof Uint8Array)) {
      throw pyError("TypeError", "a bytes-like object is required, not 'str'");
    }
    writeFileSync(this.write_file_name, data, { flag: "a" });
  }

  remove_preprocessed_file(): void {
    unlinkSync(this.write_file_name);
  }
  removePreprocessedFile(): void { this.remove_preprocessed_file(); }
}

/** nltk.corpus.reader.nkjp.NKJPCorpus_Text_View */
export class NKJPCorpus_Text_View extends XMLCorpusView<unknown> {
  static SENTS_MODE = 0;
  static RAW_MODE = 1;

  mode: number;
  tagspec = ".*/div/ab";
  segm_dict: Map<string, string | null> = new Map();
  xml_tool: XML_Tool;

  constructor(filename: string, kwargs: { mode?: number } = {}) {
    const mode = kwargs.mode ?? 0;
    const xml_tool = new XML_Tool(filename, "text.xml");
    super(xml_tool.build_preprocessed_file(), ".*/div/ab");
    this.xml_tool = xml_tool;
    this.mode = mode;
    this.handle_elt = (elt, ctx) => this.handleTextElt(elt, ctx);
    this.read_block = (stream) => this.readTextBlock(stream);
  }

  private handleTextElt(elt: XMLElement, _context: string): unknown {
    if (this.mode === NKJPCorpus_Text_View.SENTS_MODE) {
      this.segm_dict.set(this.get_segm_id(elt)!, elt.text);
    }
    return elt.text;
  }

  private readTextBlock(stream: SeekableUnicodeStreamReader): unknown[] {
    const txt: string[] = [];
    for (;;) {
      const segm = this.readBlock(stream);
      if (segm.length === 0) break;
      for (const part of segm) txt.push(part as string);
    }
    return [txt.join(" ")];
  }

  handle_query(): unknown {
    try {
      this._open();
      const x = this.read_block(this._stream!);
      this.close();
      this.xml_tool.remove_preprocessed_file();
      return x;
    } catch {
      this.xml_tool.remove_preprocessed_file();
      throw pyError("Exception", "");
    }
  }
  handleQuery(): unknown { return this.handle_query(); }

  get_segm_id(elt: XMLElement): string | null {
    for (const attr of elt.attrib.keys()) {
      if (attr.endsWith("id")) return elt.get(attr);
    }
    return null;
  }
  getSegmId(elt: XMLElement): string | null { return this.get_segm_id(elt); }
}

/** nltk.corpus.reader.nkjp.NKJPCorpus_Segmentation_View */
export class NKJPCorpus_Segmentation_View extends XMLCorpusView<unknown> {
  tagspec = ".*p/.*s";
  text_view: NKJPCorpus_Text_View;
  xml_tool: XML_Tool;

  constructor(filename: string, _kwargs: { tags?: string[] | null } = {}) {
    const text_view = new NKJPCorpus_Text_View(filename, { mode: NKJPCorpus_Text_View.SENTS_MODE });
    text_view.handle_query();
    const xml_tool = new XML_Tool(filename, "ann_segmentation.xml");
    super(xml_tool.build_preprocessed_file(), ".*p/.*s");
    this.text_view = text_view;
    this.xml_tool = xml_tool;
    this.handle_elt = (elt, ctx) => this.handleSegmElt(elt, ctx);
  }

  private handleSegmElt(elt: XMLElement, _context: string): unknown {
    const ret: unknown[] = [];
    for (const seg of elt.children) ret.push(seg.get("corresp"));
    return ret;
  }

  get_segm_id(example_word: string): string {
    return example_word.split("(")[1]!.split(",")[0]!;
  }
  getSegmId(example_word: string): string { return this.get_segm_id(example_word); }

  get_sent_beg(beg_word: string): number {
    return parseInt(beg_word.split(",")[1]!, 10);
  }
  getSentBeg(beg_word: string): number { return this.get_sent_beg(beg_word); }

  get_sent_end(end_word: string): number {
    const splitted = end_word.split(")")[0]!.split(",");
    return parseInt(splitted[1]!, 10) + parseInt(splitted[2]!, 10);
  }
  getSentEnd(end_word: string): number { return this.get_sent_end(end_word); }

  get_sentences(sent_segm: string[]): string {
    const id = this.get_segm_id(sent_segm[0]!);
    const segm = this.text_view.segm_dict.get(id)!;
    const beg = this.get_sent_beg(sent_segm[0]!);
    const end = this.get_sent_end(sent_segm[sent_segm.length - 1]!);
    return (segm ?? "").slice(beg, end);
  }
  getSentences(sent_segm: string[]): string { return this.get_sentences(sent_segm); }

  remove_choice(segm: string[]): string[] {
    const ret: string[] = [];
    let prev_txt_end = -1;
    let prev_txt_nr = "-1";
    for (const word of segm) {
      const txt_nr = this.get_segm_id(word);
      if (this.get_sent_beg(word) > prev_txt_end - 1 || prev_txt_nr !== txt_nr) {
        ret.push(word);
        prev_txt_end = this.get_sent_end(word);
      }
      prev_txt_nr = txt_nr;
    }
    return ret;
  }
  removeChoice(segm: string[]): string[] { return this.remove_choice(segm); }

  handle_query(): unknown[] {
    try {
      this._open();
      const sentences: string[] = [];
      for (;;) {
        const sent_segm = this.readBlock(this._stream!);
        if (sent_segm.length === 0) break;
        for (const segm0 of sent_segm) {
          const segm = this.remove_choice(segm0 as string[]);
          sentences.push(this.get_sentences(segm));
        }
      }
      this.close();
      this.xml_tool.remove_preprocessed_file();
      return sentences;
    } catch {
      this.xml_tool.remove_preprocessed_file();
      throw pyError("Exception", "");
    }
  }
  handleQuery(): unknown[] { return this.handle_query(); }
}

/** nltk.corpus.reader.nkjp.NKJPCorpus_Morph_View */
export class NKJPCorpus_Morph_View extends XMLCorpusView<unknown> {
  tags: string[] | null;
  tagspec = ".*/seg/fs";
  xml_tool: XML_Tool;

  constructor(filename: string, kwargs: { tags?: string[] | null } = {}) {
    const xml_tool = new XML_Tool(filename, "ann_morphosyntax.xml");
    super(xml_tool.build_preprocessed_file(), ".*/seg/fs");
    this.xml_tool = xml_tool;
    this.tags = kwargs.tags ?? null;
    this.handle_elt = (elt, ctx) => this.handleMorphElt(elt, ctx);
  }

  private handleMorphElt(elt: XMLElement, _context: string): unknown {
    let word: string | null = "";
    let flag = false;
    let is_not_interp = true;
    if (this.tags === null) flag = true;

    for (const child of elt.children) {
      if (child.attrib.has("name") && child.attrib.get("name") === "orth") {
        for (const symbol of child.children) {
          if (symbol.tag === "string") word = symbol.text;
        }
      } else if (child.attrib.has("name") && child.attrib.get("name") === "interps") {
        for (const symbol of child.children) {
          if (symbol.attrib.has("type") && symbol.attrib.get("type") === "lex") {
            for (const symbol2 of symbol.children) {
              if (symbol2.attrib.has("name") && symbol2.attrib.get("name") === "ctag") {
                for (const symbol3 of symbol2.children) {
                  if (symbol3.attrib.has("value") && this.tags !== null && this.tags.includes(symbol3.attrib.get("value")!)) {
                    flag = true;
                  } else if (symbol3.attrib.has("value") && symbol3.attrib.get("value") === "interp") {
                    is_not_interp = false;
                  }
                }
              }
            }
          }
        }
      }
    }
    if (flag && is_not_interp) return word;
    return undefined;
  }

  handle_query(): unknown[] {
    try {
      this._open();
      const words: unknown[] = [];
      for (;;) {
        const segm = this.readBlock(this._stream!);
        if (segm.length === 0) break;
        for (const part of segm) {
          if (part !== null && part !== undefined) words.push(part);
        }
      }
      this.close();
      this.xml_tool.remove_preprocessed_file();
      return words;
    } catch {
      this.xml_tool.remove_preprocessed_file();
      throw pyError("Exception", "");
    }
  }
  handleQuery(): unknown[] { return this.handle_query(); }
}

// { nps_chat

/** nltk.corpus.reader.nps_chat.NPSChatCorpusReader */
export class NPSChatCorpusReader extends XMLCorpusReader {
  constructor(root: string | PathPointer, fileids: string | string[], wrap_etree = false, tagset: string | null = null) {
    super(root, fileids, wrap_etree);
    this._tagset = tagset;
  }

  xml_posts(fileids: string | string[] | null = null): unknown {
    if (this._wrap_etree) {
      return concat((this.abspaths(fileids) as PathPointer[]).map((f) =>
        new XMLCorpusView(f, "Session/Posts/Post", (e, h) => this._wrap_elt(e, h))));
    }
    return concat((this.abspaths(fileids) as PathPointer[]).map((f) =>
      new XMLCorpusView(f, "Session/Posts/Post")));
  }
  xmlPosts(fileids: string | string[] | null = null): unknown { return this.xml_posts(fileids); }

  posts(fileids: string | string[] | null = null): unknown {
    return concat((this.abspaths(fileids) as PathPointer[]).map((f) =>
      new XMLCorpusView(f, "Session/Posts/Post/terminals", (e, h) => this._elt_to_words(e, h))));
  }

  tagged_posts(fileids: string | string[] | null = null, tagset: string | null = null): unknown {
    return concat((this.abspaths(fileids) as PathPointer[]).map((f) =>
      new XMLCorpusView(f, "Session/Posts/Post/terminals", (e, h) => this._elt_to_tagged_words(e, h, tagset))));
  }
  taggedPosts(fileids: string | string[] | null = null, tagset: string | null = null): unknown {
    return this.tagged_posts(fileids, tagset);
  }

  override words(fileids: string | string[] | null = null): unknown {
    const posts = this.posts(fileids) as AbstractLazySequence<string[]> | string[][];
    return new LazyConcatenation(Array.isArray(posts) ? posts : [...posts]);
  }

  tagged_words(fileids: string | string[] | null = null, tagset: string | null = null): unknown {
    const posts = this.tagged_posts(fileids, tagset) as AbstractLazySequence<[string, string][]> | [string, string][][];
    return new LazyConcatenation(Array.isArray(posts) ? posts : [...posts]);
  }
  taggedWords(fileids: string | string[] | null = null, tagset: string | null = null): unknown {
    return this.tagged_words(fileids, tagset);
  }

  _wrap_elt(elt: XMLElement, _handler: unknown): unknown {
    return new ElementWrapper(elt);
  }

  _elt_to_words(elt: XMLElement, _handler: unknown): string[] {
    return elt.findall("t").map((t) => NPSChatCorpusReader._simplify_username(t.attrib.get("word")!));
  }

  _elt_to_tagged_words(elt: XMLElement, _handler: unknown, tagset: string | null = null): Array<[string, string | null]> {
    let tagged_post = elt.findall("t").map((t): [string, string | null] => [
      NPSChatCorpusReader._simplify_username(t.attrib.get("word")!), t.attrib.get("pos") ?? null]);
    if (tagset && tagset !== this._tagset) {
      tagged_post = tagged_post.map(([w, t]) => [w, mapTag(this._tagset!, tagset, t!)]);
    }
    return tagged_post;
  }

  static _simplify_username(word: string): string {
    if (word.includes("User")) {
      word = "U" + word.slice(word.indexOf("User") + 4);
    }
    return word;
  }
}

// { framenet

/** nltk.corpus.reader.framenet.FramenetError */
export class FramenetError extends Error {
  constructor(message = "") {
    super(message);
    this.name = "FramenetError";
  }
}

function ntpathSplitdrive(value: string): string {
  // Windows drive or UNC prefix, applied on every platform like ntpath.
  const m = /^[a-zA-Z]:/.exec(value);
  if (m) return m[0];
  if (/^\\\\[^\\]+\\[^\\]+/.test(value)) return /^\\\\[^\\]+\\[^\\]+/.exec(value)![0];
  if (/^\/\/[^/]+\/[^/]+/.test(value)) return /^\/\/[^/]+\/[^/]+/.exec(value)![0];
  return "";
}

function rejectUnsafePathComponent(value: unknown, kind: string): void {
  const v = String(value);
  if (v.includes("/") || v.includes("\\") || v.includes("..") || ntpathSplitdrive(v)) {
    throw new FramenetError(`Invalid ${kind}: ${pyrepr(v)}`);
  }
}

/** nltk.corpus.reader.framenet.Future — lazily resolves a value on demand. */
export class Future {
  private _loader: (() => unknown) | null;
  private _d: unknown = null;
  constructor(loader: () => unknown) {
    this._loader = loader;
  }
  _data(): unknown {
    if (this._loader !== null) {
      this._d = this._loader();
      this._loader = null;
    }
    return this._d;
  }
}

/**
 * nltk.corpus.reader.framenet.AttrDict — dict + attribute access.
 * Data lives in own enumerable properties (insertion order like Python dict);
 * reads go through a Proxy so Future values resolve transparently, exactly
 * like AttrDict.__getitem__ unwrapping Futures.
 */
export class AttrDict {
  [key: string]: unknown;

  constructor(init?: Record<string, unknown>) {
    if (init) {
      for (const [k, v] of Object.entries(init)) (this as Record<string, unknown>)[k] = v;
    }
    return new Proxy(this, {
      get(t, prop, _receiver) {
        const v = Reflect.get(t, prop, t);
        if (v instanceof Future) return v._data();
        return v;
      },
      set(t, prop, v) {
        Reflect.set(t, prop, v);
        return true;
      },
      deleteProperty(t, prop) {
        return Reflect.deleteProperty(t, prop);
      },
    });
  }

  /** dict.get(key, default) — does NOT unwrap Futures (mirrors dict.get). */
  get(key: string, deflt: unknown = null): unknown {
    const d = Object.getOwnPropertyDescriptor(this, key);
    if (d === undefined) return deflt;
    return d.value;
  }

  has(key: string): boolean { return Object.getOwnPropertyDescriptor(this, key) !== undefined; }

  keys(): string[] { return Object.keys(this); }
  values(): unknown[] { return Object.values(this); }
  items(): Array<[string, unknown]> { return Object.entries(this); }
  entries(): Array<[string, unknown]> { return Object.entries(this); }

  delete(key: string): void { delete (this as Record<string, unknown>)[key]; }

  _short_repr(): string {
    const t = (this as Record<string, unknown>)["_type"];
    if (t !== undefined) {
      if (typeof t === "string" && t.endsWith("relation")) return JSON.stringify(this.toJSON());
      const d = this as Record<string, unknown>;
      if ("ID" in d && "name" in d) return `<${t} ID=${String(d["ID"])} name=${String(d["name"])}>`;
      if ("name" in d) return `<${t} name=${String(d["name"])}>`;
      if ("ID" in d) return `<${t} ID=${String(d["ID"])}>`;
      return `<${t}>`;
    }
    return JSON.stringify(this.toJSON());
  }

  toJSON(): unknown {
    const out: Record<string, unknown> = {};
    for (const [k, v0] of Object.entries(this)) {
      let v = v0;
      if (v instanceof Future) v = v._data();
      if (v instanceof AttrDict || v instanceof SpecialList || Array.isArray(v)) {
        out[k] = fnProj(v);
      } else out[k] = v;
    }
    return out;
  }
}

/** nltk.corpus.reader.framenet.SpecialList — list with a ``_type`` attr. */
export class SpecialList extends Array<unknown> {
  _type: string;
  static override get [Symbol.species]() {
    return Array;
  }
  constructor(typ: string | number, items?: Iterable<unknown>) {
    super();
    this._type = typeof typ === "number" ? "" : typ;
    if (items) for (const x of items) this.push(x);
  }
}

export class PrettyDict extends AttrDict {}
export class PrettyList extends Array<unknown> {
  static override get [Symbol.species]() {
    return Array;
  }
  constructor(items?: Iterable<unknown> | number) {
    super();
    if (typeof items === "number") this.length = items;
    else if (items) for (const x of items) this.push(x);
  }
}
export class PrettyLazyMap<T, U> extends LazyMap<T, U> {}
export class PrettyLazyIteratorList<T> extends LazyIteratorList<T> {}
export class PrettyLazyConcatenation<T> extends LazyConcatenation<T> {}

function fnProj(v: unknown): unknown {
  if (v instanceof Future) return fnProj(v._data());
  if (v instanceof AttrDict) return v.toJSON();
  if (v instanceof SpecialList || Array.isArray(v)) return (v as unknown[]).map(fnProj);
  return v;
}

/** JSON projection of framenet values (Futures resolved, AttrDicts unwrapped). */
export function framenetProj(v: unknown): unknown {
  return fnProj(v);
}

/** nltk.corpus.reader.framenet.FramenetCorpusReader */
export class FramenetCorpusReader extends XMLCorpusReader {
  _bad_statuses = ["Problem"];
  _warnings = false;

  private _frame_dir = "frame";
  private _lu_dir = "lu";
  private _fulltext_dir = "fulltext";
  private _fnweb_url = "https://framenet2.icsi.berkeley.edu/fnReports/data";

  private _frame_idx: Map<number, AttrDict> | null = null;
  private _cached_frames: Map<string, number> = new Map();
  private _lu_idx: Map<number, AttrDict> | null = null;
  private _fulltext_idx: Map<number, AttrDict> | null = null;
  private _semtypes: Map<number | string, unknown> | null = null;
  private _freltyp_idx: Map<number, AttrDict> | null = null;
  private _frel_idx: Map<number, AttrDict> | null = null;
  private _ferel_idx: Map<number, AttrDict> | null = null;
  private _frel_f_idx: Map<number, Set<number>> | null = null;

  constructor(root: string | PathPointer, fileids: string | string[]) {
    super(root, fileids);
  }

  warnings(v: unknown): void {
    this._warnings = !!v;
  }

  private _warn(...message: unknown[]): void {
    if (this._warnings) console.error(...message);
  }

  help(attrname: string | null = null): void {
    if (attrname !== null) {
      console.log((this as Record<string, unknown>)[attrname]);
      return;
    }
    console.log(`Citation: Nathan Schneider and Chuck Wooters (2017),
"The NLTK FrameNet API: Designing for Discoverability with a Rich Linguistic Resource".
Proceedings of EMNLP: System Demonstrations. https://arxiv.org/abs/1703.07438

Use the following methods to access data in FrameNet.
Provide a method name to 'help()' for more information.

FRAMES, FRAME ELEMENTS, LEXICAL UNITS, RELATIONS, SEMANTIC TYPES, ANNOTATIONS, UTILITIES
(see Python help() for the full text)`);
  }

  private _buildframeindex(): void {
    if (!this._frel_idx) this._buildrelationindex();
    this._frame_idx = new Map();
    const view = new XMLCorpusView<AttrDict>(this.abspath("frameIndex.xml"), "frameIndex/frame",
      (e) => this._handle_elt(e));
    try {
      for (const f of view) this._frame_idx.set(f["ID"] as number, f);
    } finally {
      view.close();
    }
  }

  private _buildcorpusindex(): void {
    this._fulltext_idx = new Map();
    const view = new XMLCorpusView<AttrDict[]>(this.abspath("fulltextIndex.xml"), "fulltextIndex/corpus",
      (e) => this._handle_fulltextindex_elt(e));
    try {
      for (const doclist of view) {
        for (const doc of doclist) this._fulltext_idx.set(doc["ID"] as number, doc);
      }
    } finally {
      view.close();
    }
  }

  private _buildluindex(): void {
    this._lu_idx = new Map();
    const view = new XMLCorpusView<AttrDict>(this.abspath("luIndex.xml"), "luIndex/lu",
      (e) => this._handle_elt(e));
    try {
      for (const lu of view) this._lu_idx.set(lu["ID"] as number, lu);
    } finally {
      view.close();
    }
  }

  private _buildrelationindex(): void {
    this._freltyp_idx = new Map();
    this._frel_idx = new Map();
    this._frel_f_idx = new Map();
    this._ferel_idx = new Map();
    const view = new XMLCorpusView<AttrDict>(this.abspath("frRelation.xml"), "frameRelations/frameRelationType",
      (e) => this._handle_framerelationtype_elt(e));
    try {
      for (const freltyp of view) {
        this._freltyp_idx.set(freltyp["ID"] as number, freltyp);
        for (const frel of freltyp["frameRelations"] as AttrDict[]) {
          const supF = new Future(() => this.frame_by_id(frel["supID"] as number));
          const subF = new Future(() => this.frame_by_id(frel["subID"] as number));
          frel["superFrame"] = supF;
          frel[freltyp["superFrameName"] as string] = supF;
          frel["subFrame"] = subF;
          frel[freltyp["subFrameName"] as string] = subF;
          this._frel_idx.set(frel["ID"] as number, frel);
          pushSet(this._frel_f_idx, frel["supID"] as number, frel["ID"] as number);
          pushSet(this._frel_f_idx, frel["subID"] as number, frel["ID"] as number);
          for (const ferel of frel["feRelations"] as AttrDict[]) {
            ferel["superFrame"] = supF;
            ferel["subFrame"] = subF;
            ferel["superFE"] = new Future(() => ((ferel["superFrame"] as AttrDict)["FE"] as AttrDict)[ferel["superFEName"] as string]);
            ferel["subFE"] = new Future(() => ((ferel["subFrame"] as AttrDict)["FE"] as AttrDict)[ferel["subFEName"] as string]);
            this._ferel_idx.set(ferel["ID"] as number, ferel);
          }
        }
      }
    } finally {
      view.close();
    }
  }

  buildindexes(): void {
    this._buildframeindex();
    this._buildluindex();
    this._buildcorpusindex();
    this._buildrelationindex();
  }

  doc(fn_docid: number): AttrDict {
    let xmlfname: string;
    try {
      if (this._fulltext_idx === null) throw new TypeError();
      const doc = this._fulltext_idx.get(fn_docid);
      if (doc === undefined) throw new FramenetErrorKey();
      xmlfname = doc["filename"] as string;
    } catch (e) {
      if (e instanceof FramenetErrorKey) throw new FramenetError(`Unknown document id: ${pystr(fn_docid)}`);
      this._buildcorpusindex();
      const doc = this._fulltext_idx!.get(fn_docid);
      if (doc === undefined) throw new FramenetError(`Unknown document id: ${pystr(fn_docid)}`);
      xmlfname = doc["filename"] as string;
    }

    rejectUnsafePathComponent(xmlfname, "document filename");
    const locpath = this.abspath(pathJoin(this._fulltext_dir, xmlfname));
    validate_path(String(locpath), "FramenetCorpusReader", String(this.root));

    const view = new XMLCorpusView<XMLElement>(locpath, "fullTextAnnotation");
    let elt: XMLElement;
    try {
      elt = view.get(0);
    } finally {
      view.close();
    }
    const info = this._handle_fulltextannotation_elt(elt);
    for (const [k, v] of this._fulltext_idx!.get(fn_docid)!.entries()) info[k] = v;
    return info;
  }

  frame_by_id(fn_fid: number, ignorekeys: string[] = []): AttrDict {
    let name: string;
    if (this._frame_idx === null) {
      this._buildframeindex();
      const fe = this._frame_idx!.get(fn_fid);
      if (fe === undefined) throw new FramenetError(`Unknown frame id: ${pystr(fn_fid)}`);
      name = fe["name"] as string;
    } else {
      const fentry = this._frame_idx.get(fn_fid);
      if (fentry === undefined) throw new FramenetError(`Unknown frame id: ${pystr(fn_fid)}`);
      if (fentry.has("_type")) return fentry;
      name = fentry["name"] as string;
    }
    return this.frame_by_name(name, ignorekeys, false);
  }
  frameById(fn_fid: number, ignorekeys: string[] = []): AttrDict { return this.frame_by_id(fn_fid, ignorekeys); }

  frame_by_name(fn_fname: string, ignorekeys: string[] = [], check_cache = true): AttrDict {
    if (check_cache && this._cached_frames.has(fn_fname)) {
      return this._frame_idx!.get(this._cached_frames.get(fn_fname)!)!;
    } else if (!this._frame_idx) {
      this._buildframeindex();
    }

    rejectUnsafePathComponent(fn_fname, "frame name");

    let elt: XMLElement;
    try {
      const locpath = this.abspath(pathJoin(this._frame_dir, fn_fname + ".xml"));
      validate_path(String(locpath), "FramenetCorpusReader", String(this.root));
      const view = new XMLCorpusView<XMLElement>(locpath, "frame");
      try {
        elt = view.get(0);
      } finally {
        view.close();
      }
    } catch (e) {
      if ((e as Error).name === "OSError") throw new FramenetError(`Unknown frame: ${fn_fname}`);
      throw e;
    }

    const fentry = this._handle_frame_elt(elt, ignorekeys);
    if (!fentry) throw pyError("AssertionError", "fentry");

    fentry["URL"] = `${this._fnweb_url}/${this._frame_dir}/${fn_fname}.xml`;

    // INFERENCE RULE: propagate lexical semtypes from frame to its LUs
    for (const st of fentry["semTypes"] as AttrDict[]) {
      if (((st as AttrDict)["rootType"] as AttrDict)["name"] === "Lexical_type") {
        for (const lu of Object.values(fentry["lexUnit"] as Record<string, AttrDict>)) {
          const sts = lu["semTypes"] as AttrDict[];
          if (!sts.some((x) => x === st)) sts.push(st);
        }
      }
    }

    this._frame_idx!.set(fentry["ID"] as number, fentry);
    this._cached_frames.set(fentry["name"] as string, fentry["ID"] as number);
    return fentry;
  }
  frameByName(fn_fname: string, ignorekeys: string[] = [], check_cache = true): AttrDict {
    return this.frame_by_name(fn_fname, ignorekeys, check_cache);
  }

  frame(fn_fid_or_fname: number | string | AttrDict, ignorekeys: string[] = []): AttrDict {
    if (typeof fn_fid_or_fname === "string") return this.frame_by_name(fn_fid_or_fname, ignorekeys);
    return this.frame_by_id(fn_fid_or_fname as number, ignorekeys);
  }

  frames_by_lemma(pat: string): PrettyList {
    return new PrettyList(
      (this.frames() as unknown as Iterable<AttrDict>)
        ? [...(this.frames() as unknown as Iterable<AttrDict>)].filter((f) =>
            Object.keys(f["lexUnit"] as object).some((luName) => new RegExp(pat).test(luName)))
        : []);
  }
  framesByLemma(pat: string): PrettyList { return this.frames_by_lemma(pat); }

  lu_basic(fn_luid: number): AttrDict {
    return this.lu(fn_luid, ["subCorpus", "exemplars"]);
  }
  luBasic(fn_luid: number): AttrDict { return this.lu_basic(fn_luid); }

  lu(fn_luid: number, ignorekeys: string[] = [], luName: string | null = null,
    frameID: number | null = null, frameName: string | null = null): AttrDict {
    if (!this._lu_idx) this._buildluindex();
    let luinfo = this._lu_idx!.get(fn_luid);
    if (luinfo === undefined) {
      this._warn(`LU ID not found: ${luName} (${fn_luid}) in ${frameName} (${frameID})`);
      luinfo = new AttrDict({
        _type: "lu", ID: fn_luid, name: luName, frameID, status: "Problem",
      });
      const f = this.frame_by_id(luinfo["frameID"] as number);
      if (f["name"] !== frameName) throw pyError("AssertionError", `(${f["name"]}, ${frameName})`);
      luinfo["frame"] = f;
      this._lu_idx!.set(fn_luid, luinfo);
    } else if (!luinfo.has("_type")) {
      // we only have an index entry for the LU. loading the frame will replace this.
      this.frame_by_id(luinfo["frameID"] as number);
      luinfo = this._lu_idx!.get(fn_luid)!;
    }
    if (ignorekeys.length) {
      const filtered: Record<string, unknown> = {};
      for (const [k, v] of luinfo.entries()) {
        if (!ignorekeys.includes(k)) filtered[k] = v;
      }
      return new AttrDict(filtered);
    }
    return luinfo;
  }

  _lu_file(lu: AttrDict, ignorekeys: string[] = []): AttrDict {
    const fn_luid = lu["ID"] as number;
    rejectUnsafePathComponent(fn_luid, "LU id");
    const fname = `lu${fn_luid}.xml`;
    if (!this._lu_idx) this._buildluindex();

    let elt: XMLElement;
    try {
      const locpath = this.abspath(pathJoin(this._lu_dir, fname));
      validate_path(String(locpath), "FramenetCorpusReader", String(this.root));
      const view = new XMLCorpusView<XMLElement>(locpath, "lexUnit");
      try {
        elt = view.get(0);
      } finally {
        view.close();
      }
    } catch (e) {
      if ((e as Error).name === "OSError") throw new FramenetError(`Unknown LU id: ${fn_luid}`);
      throw e;
    }

    const lu2 = this._handle_lexunit_elt(elt, ignorekeys);
    lu["URL"] = `${this._fnweb_url}/${this._lu_dir}/${fname}`;
    lu["subCorpus"] = lu2["subCorpus"];
    const sc = lu["subCorpus"] as AttrDict[];
    lu["exemplars"] = new SpecialList("luexemplars", sc.flatMap((subc) => subc["sentence"] as AttrDict[]));
    for (const sent of lu["exemplars"] as AttrDict[]) {
      sent["LU"] = lu;
      sent["frame"] = lu["frame"];
      for (const aset of sent["annotationSet"] as AttrDict[]) {
        aset["LU"] = lu;
        aset["frame"] = lu["frame"];
      }
    }
    return lu;
  }

  private _loadsemtypes(): void {
    this._semtypes = new Map();
    const view = new XMLCorpusView<AttrDict>(this.abspath("semTypes.xml"), "semTypes/semType",
      (e) => this._handle_semtype_elt(e));
    try {
      for (const st of view) {
        const n = st["name"] as string;
        const a = st["abbrev"] as string;
        const i = st["ID"] as number;
        this._semtypes.set(n, i);
        this._semtypes.set(a, i);
        this._semtypes.set(i, st);
      }
    } finally {
      view.close();
    }
    const roots: AttrDict[] = [];
    for (const st of this.semtypes() as unknown as AttrDict[]) {
      if (st["superType"]) {
        st["superType"] = this.semtype((st["superType"] as AttrDict)["supID"] as number);
        ((st["superType"] as AttrDict)["subTypes"] as AttrDict[]).push(st);
      } else {
        if (!roots.includes(st)) roots.push(st);
        st["rootType"] = st;
      }
    }
    const queue = [...roots];
    if (!queue.length) throw pyError("AssertionError", "queue");
    while (queue.length) {
      const st = queue.shift()!;
      for (const child of st["subTypes"] as AttrDict[]) {
        child["rootType"] = st["rootType"];
        queue.push(child);
      }
    }
  }

  propagate_semtypes(): void {
    if (!this._semtypes) this._loadsemtypes();
    if (!this._ferel_idx) this._buildrelationindex();
    let changed = true;
    while (changed) {
      changed = false;
      for (const ferel of this.fe_relations() as unknown as AttrDict[]) {
        try {
          let superST = (ferel["superFE"] as AttrDict)["semType"] as AttrDict | null;
          let subST = (ferel["subFE"] as AttrDict)["semType"] as AttrDict | null;
          if (superST && superST !== subST) {
            if (!(subST === null || this.semtype_inherits(subST, superST))) {
              throw pyError("AssertionError", "");
            }
            if (subST === null) {
              (ferel["subFE"] as AttrDict)["semType"] = subST = superST;
              changed = true;
            }
          }
          if (["Perspective_on", "Subframe", "Precedes"].includes((ferel["type"] as AttrDict)["name"] as string)
            && subST && subST !== superST) {
            if (superST !== null) throw pyError("AssertionError", "");
            (ferel["superFE"] as AttrDict)["semType"] = superST = subST;
            changed = true;
          }
        } catch {
          continue; // bug in the data! ignore
        }
      }
    }
  }
  propagateSemtypes(): void { this.propagate_semtypes(); }

  semtype(key: number | string): AttrDict {
    let stid: number | string;
    if (typeof key === "number") {
      stid = key;
    } else {
      try {
        if (this._semtypes === null) throw new TypeError();
        stid = this._semtypes.get(key) as number | string;
      } catch {
        this._loadsemtypes();
        stid = this._semtypes!.get(key) as number | string;
      }
    }
    try {
      if (this._semtypes === null) throw new TypeError();
      return this._semtypes.get(stid) as AttrDict;
    } catch {
      this._loadsemtypes();
      return this._semtypes!.get(stid) as AttrDict;
    }
  }

  semtype_inherits(st: AttrDict | number | string, superST: AttrDict | number | string): boolean {
    const stObj = st instanceof AttrDict ? st : this.semtype(st as number | string);
    const superObj = superST instanceof AttrDict ? superST : this.semtype(superST as number | string);
    let par = stObj["superType"] as AttrDict | null;
    while (par) {
      if (par === superObj) return true;
      par = par["superType"] as AttrDict | null;
    }
    return false;
  }
  semtypeInherits(st: AttrDict | number | string, superST: AttrDict | number | string): boolean {
    return this.semtype_inherits(st, superST);
  }

  frames(name: string | null = null): unknown {
    let fIDs: number[];
    try {
      if (this._frame_idx === null) throw new TypeError();
      fIDs = [...this._frame_idx.keys()];
    } catch {
      this._buildframeindex();
      fIDs = [...this._frame_idx!.keys()];
    }
    if (name !== null) {
      const ids = this.frame_ids_and_names(name);
      return new PrettyList([...ids.keys()].map((fID) => this.frame(fID)));
    }
    return new PrettyLazyMap((fID: number) => this.frame(fID), fIDs);
  }

  frame_ids_and_names(name: string | null = null): Map<number, string> {
    if (!this._frame_idx) this._buildframeindex();
    const out = new Map<number, string>();
    for (const [fID, finfo] of this._frame_idx!) {
      if (name === null || new RegExp(name).test(finfo["name"] as string)) {
        out.set(fID, finfo["name"] as string);
      }
    }
    return out;
  }
  frameIdsAndNames(name: string | null = null): Map<number, string> { return this.frame_ids_and_names(name); }

  fes(name: string | null = null, frame: number | string | AttrDict | null = null): PrettyList {
    let frames: AttrDict[];
    if (frame !== null) {
      if (typeof frame === "number") frames = [this.frame(frame)];
      else if (typeof frame === "string") frames = [...(this.frames(frame) as Iterable<AttrDict>)];
      else frames = [frame];
    } else {
      frames = [...(this.frames() as Iterable<AttrDict>)];
    }
    const out = new PrettyList();
    for (const f of frames) {
      for (const [fename, fe] of Object.entries(f["FE"] as Record<string, AttrDict>)) {
        if (name === null || new RegExp(name, "i").test(fename)) out.push(fe);
      }
    }
    return out;
  }

  lus(name: string | null = null, frame: number | string | AttrDict | null = null): unknown {
    if (!this._lu_idx) this._buildluindex();
    if (name !== null) {
      const ids = this.lu_ids_and_names(name);
      let result = new PrettyList([...ids.keys()].map((luID) => this.lu(luID)));
      if (frame !== null) {
        let frameIDs: Set<number>;
        if (typeof frame === "number") frameIDs = new Set([frame]);
        else if (typeof frame === "string") frameIDs = new Set([...(this.frames(frame) as Iterable<AttrDict>)].map((f) => f["ID"] as number));
        else frameIDs = new Set([frame["ID"] as number]);
        result = new PrettyList((result as unknown as AttrDict[]).filter((lu) => frameIDs.has((lu["frame"] as AttrDict)["ID"] as number)));
      }
      return result;
    } else if (frame !== null) {
      let frames: AttrDict[];
      if (typeof frame === "number") frames = [this.frame(frame)];
      else if (typeof frame === "string") frames = [...(this.frames(frame) as Iterable<AttrDict>)];
      else frames = [frame];
      return new PrettyLazyIteratorList(
        new LazyConcatenation(frames.map((f) => Object.values(f["lexUnit"] as Record<string, AttrDict>))) as unknown as Iterable<AttrDict>);
    }
    const luIDs = [...this._lu_idx!.entries()].filter(([, lu]) => !this._bad_statuses.includes(lu["status"] as string)).map(([id]) => id);
    return new PrettyLazyMap((id: number) => this.lu(id), luIDs);
  }

  lu_ids_and_names(name: string | null = null): Map<number, string> {
    if (!this._lu_idx) this._buildluindex();
    const out = new Map<number, string>();
    for (const [luID, luinfo] of this._lu_idx!) {
      if (this._bad_statuses.includes(luinfo["status"] as string)) continue;
      if (name === null || new RegExp(name).test(luinfo["name"] as string)) {
        out.set(luID, luinfo["name"] as string);
      }
    }
    return out;
  }
  luIdsAndNames(name: string | null = null): Map<number, string> { return this.lu_ids_and_names(name); }

  docs_metadata(name: string | null = null): PrettyList {
    let ftlist: PrettyList;
    try {
      if (this._fulltext_idx === null) throw new TypeError();
      ftlist = new PrettyList(this._fulltext_idx.values());
    } catch {
      this._buildcorpusindex();
      ftlist = new PrettyList(this._fulltext_idx!.values());
    }
    if (name === null) return ftlist;
    return new PrettyList([...ftlist].filter((x) => new RegExp(name).test((x as AttrDict)["filename"] as string)));
  }
  docsMetadata(name: string | null = null): PrettyList { return this.docs_metadata(name); }

  docs(name: string | null = null): PrettyLazyMap<AttrDict, AttrDict> {
    return new PrettyLazyMap((x: AttrDict) => this.doc(x["ID"] as number),
      this.docs_metadata(name) as unknown as AttrDict[]);
  }

  sents(exemplars = true, full_text = true): unknown {
    if (exemplars) {
      if (full_text) {
        return new PrettyLazyIteratorList(
          function* (self: FramenetCorpusReader) {
            yield* self.exemplars() as Iterable<unknown>;
            yield* self.ft_sents() as Iterable<unknown>;
          }(this));
      }
      return this.exemplars();
    } else if (full_text) {
      return this.ft_sents();
    }
    return undefined;
  }

  annotations(luNamePattern: string | null = null, exemplars = true, full_text = true): unknown {
    let epart: Iterable<unknown> | unknown[] = [];
    if (exemplars) {
      epart = new PrettyLazyIteratorList(
        function* (self: FramenetCorpusReader) {
          for (const sent of self.exemplars(luNamePattern) as Iterable<AttrDict>) yield sent["frameAnnotation"];
        }(this));
    }
    let ftpart: Iterable<unknown> | unknown[] = [];
    if (full_text) {
      let matchedLUIDs: Set<number> | null = null;
      if (luNamePattern !== null) matchedLUIDs = new Set(this.lu_ids_and_names(luNamePattern).keys());
      ftpart = new PrettyLazyIteratorList(
        function* (self: FramenetCorpusReader) {
          for (const sent of self.ft_sents() as Iterable<AttrDict>) {
            for (const aset of (sent["annotationSet"] as AttrDict[]).slice(1)) {
              if (luNamePattern === null || matchedLUIDs!.has(aset.get("luID", "CXN_ASET") as number)) yield aset;
            }
          }
        }(this));
    }
    if (exemplars) {
      if (full_text) {
        return new PrettyLazyIteratorList(function* () { yield* epart; yield* ftpart; }());
      }
      return new PrettyLazyIteratorList(epart);
    } else if (full_text) {
      return new PrettyLazyIteratorList(ftpart);
    }
    return undefined;
  }

  exemplars(luNamePattern: string | null = null, frame: number | string | AttrDict | null = null,
    fe: string | AttrDict | null = null, fe2: string | AttrDict | null = null): unknown {
    if (fe === null && fe2 !== null) {
      throw new FramenetError("exemplars(..., fe=None, fe2=<value>) is not allowed");
    } else if (fe !== null && fe2 !== null) {
      if (typeof fe2 !== "string") {
        if (typeof fe === "string") {
          [fe, fe2] = [fe2, fe];
        } else if ((fe as AttrDict)["frame"] !== (fe2 as AttrDict)["frame"]) {
          throw new FramenetError("exemplars() call with inconsistent `fe` and `fe2` specification (frames must match)");
        }
      }
    }
    if (frame === null && fe !== null && typeof fe !== "string") {
      frame = (fe as AttrDict)["frame"] as AttrDict;
    }

    const lusByFrame = new Map<string, AttrDict[]>();
    let frames: Iterable<AttrDict> | AttrDict[];
    if (frame !== null || luNamePattern !== null) {
      if (frame === null || typeof frame === "string") {
        if (luNamePattern !== null) {
          const frameIds = new Set<number>();
          for (const lu of this.lus(luNamePattern, frame) as Iterable<AttrDict>) {
            frameIds.add((lu["frame"] as AttrDict)["ID"] as number);
            pushMap(lusByFrame, (lu["frame"] as AttrDict)["name"] as string, lu);
          }
          frames = new LazyMap((id: number) => this.frame(id), [...frameIds]) as unknown as AttrDict[];
        } else {
          frames = this.frames(frame) as unknown as AttrDict[];
        }
      } else {
        if (typeof frame === "number") frames = [this.frame(frame)];
        else frames = [frame];
        if (luNamePattern !== null) {
          lusByFrame.set((frame as AttrDict)["name"] as string,
            [...(this.lus(luNamePattern, frame) as Iterable<AttrDict>)]);
        }
      }
      if (fe !== null) {
        if (typeof fe === "string") {
          frames = [...frames].filter((f) =>
            fe in (f["FE"] as object) || Object.keys(f["FE"] as object).some((ffe) => new RegExp(fe, "i").test(ffe)));
        } else {
          if (![...frames].includes((fe as AttrDict)["frame"] as AttrDict)) {
            throw new FramenetError("exemplars() call with inconsistent `frame` and `fe` specification");
          }
          frames = [(fe as AttrDict)["frame"] as AttrDict];
        }
        if (fe2 !== null) {
          if (typeof fe2 === "string") {
            frames = [...frames].filter((f) =>
              (fe2 as string) in (f["FE"] as object) || Object.keys(f["FE"] as object).some((ffe) => new RegExp(fe2 as string, "i").test(ffe)));
          }
        }
      }
    } else {
      if (fe !== null) {
        const frameIds = new Set<number>((this.fes(fe as string) as unknown as AttrDict[]).map((ffe) => (ffe["frame"] as AttrDict)["ID"] as number));
        if (fe2 !== null) {
          const frames2 = new Set<number>((this.fes(fe2 as string) as unknown as AttrDict[]).map((ffe) => (ffe["frame"] as AttrDict)["ID"] as number));
          for (const id of frameIds) if (!frames2.has(id)) frameIds.delete(id);
        }
        frames = new LazyMap((id: number) => this.frame(id), [...frameIds]) as unknown as AttrDict[];
      } else {
        frames = this.frames() as unknown as AttrDict[];
      }
    }

    return new PrettyLazyIteratorList(
      this._matchingExs(frames, lusByFrame, luNamePattern, fe, fe2));
  }

  private *_matchingExs(frames: Iterable<AttrDict>, lusByFrame: Map<string, AttrDict[]>,
    luNamePattern: string | null, fe: string | AttrDict | null,
    fe2: string | AttrDict | null): Generator<AttrDict> {
    for (const f of frames) {
      let fes: Set<string> | null = null;
      let fes2: Set<string> | null = null;
      if (fe !== null) {
        fes = typeof fe === "string"
          ? new Set(Object.keys(f["FE"] as object).filter((ffe) => new RegExp(fe, "i").test(ffe)))
          : new Set([(fe as AttrDict)["name"] as string]);
        if (fe2 !== null) {
          fes2 = typeof fe2 === "string"
            ? new Set(Object.keys(f["FE"] as object).filter((ffe) => new RegExp(fe2 as string, "i").test(ffe)))
            : new Set([(fe2 as AttrDict)["name"] as string]);
        }
      }
      const lus = luNamePattern !== null ? (lusByFrame.get(f["name"] as string) ?? []) : Object.values(f["lexUnit"] as Record<string, AttrDict>);
      for (const lu of lus) {
        for (const ex of lu["exemplars"] as AttrDict[]) {
          if ((fes === null || this._exemplar_of_fes(ex, fes).size > 0)
            && (fes2 === null || this._exemplar_of_fes(ex, fes2).size > 0)) {
            yield ex;
          }
        }
      }
    }
  }

  _exemplar_of_fes(ex: AttrDict, fes: Set<string> | null = null): Set<string> {
    const overt = (feList: unknown): Set<string> => {
      const tup = feList as [Array<[number, number, string]>, Record<string, string>];
      const s = new Set<string>();
      if (tup[0]) for (const t of tup[0]) s.add(t[2]);
      return s;
    };
    let overtNames = ex.has("FE") ? overt(ex["FE"]) : new Set<string>();
    if (ex.has("FE2")) {
      for (const n of overt(ex["FE2"])) overtNames.add(n);
      if (ex.has("FE3")) for (const n of overt(ex["FE3"])) overtNames.add(n);
    }
    return fes !== null ? new Set([...overtNames].filter((n) => fes.has(n))) : overtNames;
  }

  ft_sents(docNamePattern: string | null = null): unknown {
    return new PrettyLazyIteratorList(this._ftSents(docNamePattern));
  }

  private *_ftSents(docNamePattern: string | null): Generator<AttrDict> {
    for (const d of this.docs(docNamePattern) as Iterable<AttrDict>) {
      yield* d["sentence"] as Iterable<AttrDict>;
    }
  }
  ftSents(docNamePattern: string | null = null): unknown { return this.ft_sents(docNamePattern); }

  frame_relation_types(): AttrDict[] {
    if (!this._freltyp_idx) this._buildrelationindex();
    return [...this._freltyp_idx!.values()];
  }
  frameRelationTypes(): AttrDict[] { return this.frame_relation_types(); }

  frame_relations(frame: number | string | AttrDict | null = null, frame2: number | string | AttrDict | null = null,
    type: string | AttrDict | null = null): unknown {
    let relation_type = type;
    if (!this._frel_idx) this._buildrelationindex();

    let rels: AttrDict[] | unknown;
    let frameId: number | null = null;

    if (relation_type !== null && !(relation_type instanceof AttrDict)) {
      type = this.frame_relation_types().filter((rt) => rt["name"] === type)[0]!;
      if (!(type instanceof AttrDict)) throw pyError("AssertionError", "type");
    }

    if (frame !== null) {
      if (frame instanceof AttrDict && frame.has("frameRelations")) {
        rels = new PrettyList(frame["frameRelations"] as Iterable<AttrDict>);
      } else {
        if (typeof frame !== "number") {
          if (frame instanceof AttrDict) frameId = frame["ID"] as number;
          else frameId = this.frame_by_name(frame).get("ID") as number;
        } else frameId = frame;
        rels = [...(this._frel_f_idx!.get(frameId) ?? new Set<number>())].map((id) => this._frel_idx!.get(id)!);
      }
      if (type !== null) {
        rels = (rels as AttrDict[]).filter((rel) => rel["type"] === type);
      }
    } else if (type !== null) {
      rels = (type as AttrDict)["frameRelations"];
    } else {
      rels = [...this._frel_idx!.values()];
    }

    if (frame2 !== null) {
      if (frame === null) {
        throw new FramenetError("frame_relations(frame=None, frame2=<value>) is not allowed");
      }
      let f2: number;
      if (typeof frame2 !== "number") {
        if (frame2 instanceof AttrDict) f2 = frame2["ID"] as number;
        else f2 = this.frame_by_name(frame2).get("ID") as number;
      } else f2 = frame2;
      if (frameId === f2) {
        throw new FramenetError("The two frame arguments to frame_relations() must be different frames");
      }
      rels = (rels as AttrDict[]).filter((rel) =>
        ((rel["superFrame"] as AttrDict)["ID"] as number) === f2 || ((rel["subFrame"] as AttrDict)["ID"] as number) === f2);
    }

    return new PrettyList((rels as AttrDict[]).slice().sort((a, b) => {
      const ka: [AttrDict, unknown, unknown] = [a["type"] as AttrDict, a["superFrameName"], a["subFrameName"]];
      const kb: [AttrDict, unknown, unknown] = [b["type"] as AttrDict, b["superFrameName"], b["subFrameName"]];
      const c1 = (ka[0]["ID"] as number) - (kb[0]["ID"] as number);
      if (c1) return c1;
      const c2 = String(ka[1]).localeCompare(String(kb[1]));
      if (c2) return c2;
      return String(ka[2]).localeCompare(String(kb[2]));
    }));
  }
  frameRelations(frame: number | string | AttrDict | null = null, frame2: number | string | AttrDict | null = null,
    type: string | AttrDict | null = null): unknown {
    return this.frame_relations(frame, frame2, type);
  }

  fe_relations(): PrettyList {
    if (!this._ferel_idx) this._buildrelationindex();
    const key = (ferel: AttrDict): string => {
      const fr = ferel["frameRelation"] as AttrDict;
      return `${(ferel["type"] as AttrDict)["ID"]}|${fr["superFrameName"]}|${ferel["superFEName"]}|${fr["subFrameName"]}|${ferel["subFEName"]}`;
    };
    return new PrettyList([...this._ferel_idx!.values()].sort((a, b) => {
      const ta = a["type"] as AttrDict, tb = b["type"] as AttrDict;
      const c = (ta["ID"] as number) - (tb["ID"] as number);
      if (c) return c;
      return key(a).localeCompare(key(b));
    }));
  }
  feRelations(): PrettyList { return this.fe_relations(); }

  semtypes(): PrettyList {
    if (!this._semtypes) this._loadsemtypes();
    return new PrettyList(
      [...this._semtypes!.entries()].filter(([i]) => typeof i === "number").map(([, st]) => st));
  }

  _load_xml_attributes<T extends AttrDict>(d: T, elt: XMLElement): T {
    const out: T = d instanceof PrettyDict ? (new PrettyDict() as T) : (new AttrDict() as T);
    for (const [k, v] of d.entries()) (out as Record<string, unknown>)[k] = v;
    const attr_dict = elt.attrib;
    if (!attr_dict) return out;
    const ignore_attrs = ["xsi", "schemaLocation", "xmlns", "bgColor", "fgColor"];
    for (const [attr, val] of attr_dict) {
      if (ignore_attrs.some((x) => attr.endsWith(x))) continue;
      (out as Record<string, unknown>)[attr] = /^\d+$/.test(val) ? parseInt(val, 10) : val;
    }
    return out;
  }

  _strip_tags(data: unknown): unknown {
    if (typeof data !== "string") return data;
    let d = data;
    d = d.replace(/<t>/g, "").replace(/<\/t>/g, "");
    d = d.replace(/<fex name="[^"]+">/g, "").replace(/<\/fex>/g, "");
    d = d.replace(/<fen>/g, "").replace(/<\/fen>/g, "");
    d = d.replace(/<m>/g, "").replace(/<\/m>/g, "");
    d = d.replace(/<ment>/g, "").replace(/<\/ment>/g, "");
    d = d.replace(/<ex>/g, "'").replace(/<\/ex>/g, "'");
    d = d.replace(/<gov>/g, "").replace(/<\/gov>/g, "");
    d = d.replace(/<x>/g, "").replace(/<\/x>/g, "");
    d = d.replace(/<def-root>/g, "").replace(/<\/def-root>/g, "");
    d = d.replace(/\n/g, " ");
    return d;
  }
  _stripTags(data: unknown): unknown { return this._strip_tags(data); }

  _handle_elt(elt: XMLElement): AttrDict {
    return this._load_xml_attributes(new AttrDict(), elt);
  }

  _handle_fulltextindex_elt(elt: XMLElement): AttrDict[] {
    const ftinfo = this._load_xml_attributes(new AttrDict(), elt);
    const corpname = ftinfo["name"] as string;
    const corpid = ftinfo["ID"] as number;
    const retlist: AttrDict[] = [];
    for (const sub of elt.children) {
      if (sub.tag.endsWith("document")) {
        const doc = this._load_xml_attributes(new AttrDict(), sub);
        const docname = doc.has("name") ? doc["name"] as string : doc["description"] as string;
        doc["filename"] = `${corpname}__${docname}.xml`;
        doc["URL"] = `${this._fnweb_url}/${this._fulltext_dir}/${doc["filename"]}`;
        doc["corpname"] = corpname;
        doc["corpid"] = corpid;
        retlist.push(doc);
      }
    }
    return retlist;
  }

  _handle_frame_elt(elt: XMLElement, ignorekeys: string[] = []): AttrDict {
    const frinfo = this._load_xml_attributes(new AttrDict(), elt);
    frinfo["_type"] = "frame";
    frinfo["definition"] = "";
    frinfo["definitionMarkup"] = "";
    frinfo["FE"] = new PrettyDict();
    frinfo["FEcoreSets"] = new PrettyList();
    frinfo["lexUnit"] = new PrettyDict();
    frinfo["semTypes"] = new PrettyList();
    for (const k of ignorekeys) if (frinfo.has(k)) frinfo.delete(k);

    for (const sub of elt.children) {
      if (sub.tag.endsWith("definition") && !ignorekeys.includes("definition")) {
        frinfo["definitionMarkup"] = sub.text;
        frinfo["definition"] = this._strip_tags(sub.text);
      } else if (sub.tag.endsWith("FE") && !ignorekeys.includes("FE")) {
        const feinfo = this._handle_fe_elt(sub);
        (frinfo["FE"] as AttrDict)[feinfo["name"] as string] = feinfo;
        feinfo["frame"] = frinfo;
      } else if (sub.tag.endsWith("FEcoreSet") && !ignorekeys.includes("FEcoreSet")) {
        const coreset = this._handle_fecoreset_elt(sub);
        (frinfo["FEcoreSets"] as PrettyList).push(
          new PrettyList(coreset.map((fe) => (frinfo["FE"] as AttrDict)[fe["name"] as string])));
      } else if (sub.tag.endsWith("lexUnit") && !ignorekeys.includes("lexUnit")) {
        const luentry = this._handle_framelexunit_elt(sub);
        if (this._bad_statuses.includes(luentry["status"] as string)) continue;
        luentry["frame"] = frinfo;
        luentry["URL"] = `${this._fnweb_url}/${this._lu_dir}/lu${luentry["ID"]}.xml`;
        luentry["subCorpus"] = new Future(() => (this._lu_file(luentry) as AttrDict)["subCorpus"]);
        luentry["exemplars"] = new Future(() => (this._lu_file(luentry) as AttrDict)["exemplars"]);
        (frinfo["lexUnit"] as AttrDict)[luentry["name"] as string] = luentry;
        if (!this._lu_idx) this._buildluindex();
        this._lu_idx!.set(luentry["ID"] as number, luentry);
      } else if (sub.tag.endsWith("semType") && !ignorekeys.includes("semTypes")) {
        const semtypeinfo = this._load_xml_attributes(new AttrDict(), sub);
        (frinfo["semTypes"] as PrettyList).push(this.semtype(semtypeinfo["ID"] as number));
      }
    }

    frinfo["frameRelations"] = this.frame_relations(frinfo);

    for (const fe of Object.values(frinfo["FE"] as Record<string, AttrDict>)) {
      if (fe["requiresFE"]) {
        const name = (fe["requiresFE"] as AttrDict)["name"] as string;
        const ID = (fe["requiresFE"] as AttrDict)["ID"] as number;
        fe["requiresFE"] = (frinfo["FE"] as AttrDict)[name];
        if ((fe["requiresFE"] as AttrDict)["ID"] !== ID) throw pyError("AssertionError", "requiresFE ID mismatch");
      }
      if (fe["excludesFE"]) {
        const name = (fe["excludesFE"] as AttrDict)["name"] as string;
        const ID = (fe["excludesFE"] as AttrDict)["ID"] as number;
        fe["excludesFE"] = (frinfo["FE"] as AttrDict)[name];
        if ((fe["excludesFE"] as AttrDict)["ID"] !== ID) throw pyError("AssertionError", "excludesFE ID mismatch");
      }
    }

    return frinfo;
  }

  _handle_fecoreset_elt(elt: XMLElement): AttrDict[] {
    const tmp: AttrDict[] = [];
    for (const sub of elt.children) tmp.push(this._load_xml_attributes(new AttrDict(), sub));
    return tmp;
  }

  _handle_framerelationtype_elt(elt: XMLElement): AttrDict {
    const info = this._load_xml_attributes(new AttrDict(), elt);
    info["_type"] = "framerelationtype";
    info["frameRelations"] = new PrettyList();
    for (const sub of elt.children) {
      if (sub.tag.endsWith("frameRelation")) {
        const frel = this._handle_framerelation_elt(sub);
        frel["type"] = info;
        for (const ferel of frel["feRelations"] as AttrDict[]) ferel["type"] = info;
        (info["frameRelations"] as AttrDict[]).push(frel);
      }
    }
    return info;
  }

  _handle_framerelation_elt(elt: XMLElement): AttrDict {
    const info = this._load_xml_attributes(new AttrDict(), elt);
    if (info["superFrameName"] === info["subFrameName"]) {
      throw pyError("AssertionError", "superFrameName == subFrameName");
    }
    info["_type"] = "framerelation";
    info["feRelations"] = new PrettyList();
    for (const sub of elt.children) {
      if (sub.tag.endsWith("FERelation")) {
        const ferel = this._handle_elt(sub);
        ferel["_type"] = "ferelation";
        ferel["frameRelation"] = info;
        (info["feRelations"] as AttrDict[]).push(ferel);
      }
    }
    return info;
  }

  _handle_fulltextannotation_elt(elt: XMLElement): AttrDict {
    const info = new AttrDict();
    info["_type"] = "fulltext_annotation";
    info["sentence"] = new PrettyList();
    for (const sub of elt.children) {
      if (sub.tag.endsWith("header")) continue;
      else if (sub.tag.endsWith("sentence")) {
        const s = this._handle_fulltext_sentence_elt(sub);
        s["doc"] = info;
        (info["sentence"] as AttrDict[]).push(s);
      }
    }
    return info;
  }

  _handle_fulltext_sentence_elt(elt: XMLElement): AttrDict {
    const info = this._load_xml_attributes(new AttrDict(), elt);
    info["_type"] = "fulltext_sentence";
    info["annotationSet"] = new PrettyList();
    info["targets"] = new PrettyList();
    const target_spans = new Set<string>();
    info["_ascii"] = () => fnAnnotationAscii(info);
    info["text"] = "";
    for (const sub of elt.children) {
      if (sub.tag.endsWith("text")) {
        info["text"] = this._strip_tags(sub.text);
      } else if (sub.tag.endsWith("annotationSet")) {
        const a = this._handle_fulltextannotationset_elt(sub, (info["annotationSet"] as AttrDict[]).length === 0);
        if (a.has("cxnID")) continue;
        a["sent"] = info;
        a["text"] = info["text"];
        (info["annotationSet"] as AttrDict[]).push(a);
        if (a.has("Target")) {
          for (const tspan of a["Target"] as Array<[number, number]>) {
            const key = tspan.join(",");
            if (target_spans.has(key)) {
              this._warn(`Duplicate target span "${(info["text"] as string).slice(tspan[0], tspan[1])}"`,
                tspan, "in sentence", info["ID"], info["text"]);
            } else {
              target_spans.add(key);
            }
          }
          (info["targets"] as unknown[]).push([a["Target"], a["luName"], a["frameName"]]);
        }
      }
    }
    if (((info["annotationSet"] as AttrDict[])[0]!["status"] as string) !== "UNANN") {
      throw pyError("AssertionError", "first annotationSet must be UNANN");
    }
    info["POS"] = (info["annotationSet"] as AttrDict[])[0]!["POS"];
    info["POS_tagset"] = (info["annotationSet"] as AttrDict[])[0]!["POS_tagset"];
    return info;
  }

  _handle_fulltextannotationset_elt(elt: XMLElement, is_pos = false): AttrDict {
    const info = this._handle_luannotationset_elt(elt, is_pos);
    if (!is_pos) {
      info["_type"] = "fulltext_annotationset";
      if (!info.has("cxnID")) {
        info["LU"] = this.lu(info["luID"] as number, [],
          info["luName"] as string, info["frameID"] as number, info["frameName"] as string);
        info["frame"] = (info["LU"] as AttrDict)["frame"];
      }
    }
    return info;
  }

  _handle_fulltextlayer_elt(elt: XMLElement): AttrDict {
    const info = this._load_xml_attributes(new AttrDict(), elt);
    info["_type"] = "layer";
    info["label"] = new PrettyList();
    for (const sub of elt.children) {
      if (sub.tag.endsWith("label")) {
        (info["label"] as AttrDict[]).push(this._load_xml_attributes(new AttrDict(), sub));
      }
    }
    return info;
  }

  _handle_framelexunit_elt(elt: XMLElement): AttrDict {
    let luinfo = new AttrDict();
    luinfo["_type"] = "lu";
    luinfo = this._load_xml_attributes(luinfo, elt);
    luinfo["definition"] = "";
    luinfo["definitionMarkup"] = "";
    luinfo["sentenceCount"] = new PrettyDict();
    luinfo["lexemes"] = new PrettyList();
    luinfo["semTypes"] = new PrettyList();

    for (const sub of elt.children) {
      if (sub.tag.endsWith("definition")) {
        luinfo["definitionMarkup"] = sub.text;
        luinfo["definition"] = this._strip_tags(sub.text);
      } else if (sub.tag.endsWith("sentenceCount")) {
        luinfo["sentenceCount"] = this._load_xml_attributes(new PrettyDict(), sub);
      } else if (sub.tag.endsWith("lexeme")) {
        const lexemeinfo = this._load_xml_attributes(new PrettyDict(), sub);
        if (typeof lexemeinfo["name"] !== "string") {
          lexemeinfo["name"] = String(lexemeinfo["name"]);
        }
        (luinfo["lexemes"] as AttrDict[]).push(lexemeinfo);
      } else if (sub.tag.endsWith("semType")) {
        const semtypeinfo = this._load_xml_attributes(new PrettyDict(), sub);
        (luinfo["semTypes"] as AttrDict[]).push(this.semtype(semtypeinfo["ID"] as number));
      }
    }

    (luinfo["lexemes"] as AttrDict[]).sort((a, b) => (a["order"] as number) - (b["order"] as number));
    return luinfo;
  }

  _handle_lexunit_elt(elt: XMLElement, ignorekeys: string[] = []): AttrDict {
    const luinfo = this._load_xml_attributes(new AttrDict(), elt);
    luinfo["_type"] = "lu";
    luinfo["definition"] = "";
    luinfo["definitionMarkup"] = "";
    luinfo["subCorpus"] = new PrettyList();
    luinfo["lexemes"] = new PrettyList();
    luinfo["semTypes"] = new PrettyList();
    for (const k of ignorekeys) if (luinfo.has(k)) luinfo.delete(k);

    for (const sub of elt.children) {
      if (sub.tag.endsWith("header")) continue;
      else if (sub.tag.endsWith("valences")) continue;
      else if (sub.tag.endsWith("definition") && !ignorekeys.includes("definition")) {
        luinfo["definitionMarkup"] = sub.text;
        luinfo["definition"] = this._strip_tags(sub.text);
      } else if (sub.tag.endsWith("subCorpus") && !ignorekeys.includes("subCorpus")) {
        const sc = this._handle_lusubcorpus_elt(sub);
        if (sc !== null) (luinfo["subCorpus"] as AttrDict[]).push(sc);
      } else if (sub.tag.endsWith("lexeme") && !ignorekeys.includes("lexeme")) {
        (luinfo["lexemes"] as AttrDict[]).push(this._load_xml_attributes(new PrettyDict(), sub));
      } else if (sub.tag.endsWith("semType") && !ignorekeys.includes("semType")) {
        const semtypeinfo = this._load_xml_attributes(new AttrDict(), sub);
        (luinfo["semTypes"] as AttrDict[]).push(this.semtype(semtypeinfo["ID"] as number));
      }
    }
    return luinfo;
  }

  _handle_lusubcorpus_elt(elt: XMLElement): AttrDict | null {
    const sc = new AttrDict();
    sc["name"] = elt.get("name");
    sc["_type"] = "lusubcorpus";
    sc["sentence"] = new PrettyList();
    for (const sub of elt.children) {
      if (sub.tag.endsWith("sentence")) {
        const s = this._handle_lusentence_elt(sub);
        if (s !== null) (sc["sentence"] as AttrDict[]).push(s);
      }
    }
    return sc;
  }

  _handle_lusentence_elt(elt: XMLElement): AttrDict | null {
    const info = this._load_xml_attributes(new AttrDict(), elt);
    info["_type"] = "lusentence";
    info["annotationSet"] = new PrettyList();
    info["_ascii"] = () => fnAnnotationAscii(info);
    for (const sub of elt.children) {
      if (sub.tag.endsWith("text")) {
        info["text"] = this._strip_tags(sub.text);
      } else if (sub.tag.endsWith("annotationSet")) {
        const annset = this._handle_luannotationset_elt(sub, (info["annotationSet"] as AttrDict[]).length === 0);
        if (annset !== null) {
          if (!(annset["status"] === "UNANN" || annset.has("FE"))) {
            throw pyError("AssertionError", "annset status/FE");
          }
          if (annset["status"] !== "UNANN") info["frameAnnotation"] = annset;
          for (const k of ["Target", "FE", "FE2", "FE3", "GF", "PT", "POS", "POS_tagset",
            "Other", "Sent", "Verb", "Noun", "Adj", "Adv", "Prep", "Scon", "Art"]) {
            if (annset.has(k)) info[k] = annset[k];
          }
          (info["annotationSet"] as AttrDict[]).push(annset);
          annset["sent"] = info;
          annset["text"] = info["text"];
        }
      }
    }
    return info;
  }

  _handle_luannotationset_elt(elt: XMLElement, is_pos = false): AttrDict {
    const info = this._load_xml_attributes(new AttrDict(), elt);
    info["_type"] = is_pos ? "posannotationset" : "luannotationset";
    info["layer"] = new PrettyList();
    info["_ascii"] = () => fnAnnotationAscii(info);

    if (info.has("cxnID")) return info;

    for (const sub of elt.children) {
      if (sub.tag.endsWith("layer")) {
        const l = this._handle_lulayer_elt(sub);
        if (l !== null) {
          const overt: Array<[number, number, string]> = [];
          const ni: Record<string, unknown> = {};
          (info["layer"] as AttrDict[]).push(l);
          for (const lbl of l["label"] as AttrDict[]) {
            if (lbl.has("start")) {
              const thespan: [number, number, string] = [lbl["start"] as number, (lbl["end"] as number) + 1, lbl["name"] as string];
              if (!["Sent", "Other"].includes(l["name"] as string)) {
                if (overt.some((s) => s[0] === thespan[0] && s[1] === thespan[1] && s[2] === thespan[2])) {
                  throw pyError("AssertionError", `(${info["ID"]}, ${l["name"]}, ${thespan})`);
                }
              }
              overt.push(thespan);
            } else {
              if (lbl["name"] as string in ni) {
                this._warn("FE with multiple NI entries:", lbl["name"], ni[lbl["name"] as string], lbl["itype"]);
              } else {
                ni[lbl["name"] as string] = lbl["itype"];
              }
            }
          }
          overt.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2].localeCompare(b[2]));

          if (l["name"] === "Target") {
            if (!overt.length) {
              this._warn(`Skipping empty Target layer in annotation set ID=${info["ID"]}`);
              continue;
            }
            info["Target"] = overt.map(([i, j]) => [i, j]);
          } else if (l["name"] === "FE") {
            if (l["rank"] === 1) {
              if (info.has("FE")) throw pyError("AssertionError", "FE");
              info["FE"] = [overt, ni];
            } else {
              if (!((l["rank"] as number) >= 2 && (l["rank"] as number) <= 3)) {
                throw pyError("AssertionError", `rank ${l["rank"]}`);
              }
              const k = "FE" + String(l["rank"]);
              if (info.has(k)) throw pyError("AssertionError", k);
              info[k] = [overt, ni];
            }
          } else if (["GF", "PT"].includes(l["name"] as string)) {
            if (l["rank"] !== 1) throw pyError("AssertionError", "rank");
            info[l["name"] as string] = overt;
          } else if (["BNC", "PENN"].includes(l["name"] as string)) {
            if (l["rank"] !== 1) throw pyError("AssertionError", "rank");
            info["POS"] = overt;
            info["POS_tagset"] = l["name"];
          } else {
            if (is_pos) {
              if (!["NER", "WSL"].includes(l["name"] as string)) {
                this._warn("Unexpected layer in sentence annotationset:", l["name"]);
              }
            } else {
              if (!["Sent", "Verb", "Noun", "Adj", "Adv", "Prep", "Scon", "Art", "Other"].includes(l["name"] as string)) {
                this._warn("Unexpected layer in frame annotationset:", l["name"]);
              }
            }
            info[l["name"] as string] = overt;
          }
        }
      }
    }
    if (!is_pos && !info.has("cxnID")) {
      if (!info.has("Target")) this._warn(`Missing target in annotation set ID=${info["ID"]}`);
      if (!info.has("FE")) throw pyError("AssertionError", `"FE" in annset`);
      if (info.has("FE3") && !info.has("FE2")) throw pyError("AssertionError", "FE3 requires FE2");
    }
    return info;
  }

  _handle_lulayer_elt(elt: XMLElement): AttrDict | null {
    const layer = this._load_xml_attributes(new AttrDict(), elt);
    layer["_type"] = "lulayer";
    layer["label"] = new PrettyList();
    for (const sub of elt.children) {
      if (sub.tag.endsWith("label")) {
        const l = this._load_xml_attributes(new AttrDict(), sub);
        if (l !== null) (layer["label"] as AttrDict[]).push(l);
      }
    }
    return layer;
  }

  _handle_fe_elt(elt: XMLElement): AttrDict {
    const feinfo = this._load_xml_attributes(new AttrDict(), elt);
    feinfo["_type"] = "fe";
    feinfo["definition"] = "";
    feinfo["definitionMarkup"] = "";
    feinfo["semType"] = null;
    feinfo["requiresFE"] = null;
    feinfo["excludesFE"] = null;
    for (const sub of elt.children) {
      if (sub.tag.endsWith("definition")) {
        feinfo["definitionMarkup"] = sub.text;
        feinfo["definition"] = this._strip_tags(sub.text);
      } else if (sub.tag.endsWith("semType")) {
        const stinfo = this._load_xml_attributes(new AttrDict(), sub);
        feinfo["semType"] = this.semtype(stinfo["ID"] as number);
      } else if (sub.tag.endsWith("requiresFE")) {
        feinfo["requiresFE"] = this._load_xml_attributes(new AttrDict(), sub);
      } else if (sub.tag.endsWith("excludesFE")) {
        feinfo["excludesFE"] = this._load_xml_attributes(new AttrDict(), sub);
      }
    }
    return feinfo;
  }

  _handle_semtype_elt(elt: XMLElement): AttrDict {
    const semt = this._load_xml_attributes(new AttrDict(), elt);
    semt["_type"] = "semtype";
    semt["superType"] = null;
    semt["subTypes"] = new PrettyList();
    for (const sub of elt.children) {
      if (sub.text !== null) {
        semt["definitionMarkup"] = sub.text;
        semt["definition"] = this._strip_tags(sub.text);
      } else {
        const supertypeinfo = this._load_xml_attributes(new AttrDict(), sub);
        semt["superType"] = supertypeinfo;
      }
    }
    return semt;
  }
}

class FramenetErrorKey extends Error {}

function pushSet<K, V>(m: Map<K, Set<V>>, k: K, v: V): void {
  const s = m.get(k);
  if (s) s.add(v);
  else m.set(k, new Set([v]));
}

function fnAnnotationAscii(sent: AttrDict): string {
  // _annotation_ascii(sent): frame line + FE underlines, compact port.
  const text = sent["text"] as string;
  const out: string[] = [text, ""];
  const overt = sent.has("FE") ? ((sent["FE"] as [Array<[number, number, string]>, unknown])[0] ?? []) : [];
  for (const [i, j, name] of overt) {
    out.push(`${" ".repeat(i)}${name} [${text.slice(i, j)}]`);
  }
  return out.join("\n");
}
