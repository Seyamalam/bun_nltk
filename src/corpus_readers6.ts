// nltk.corpus.reader.* — sixth tier: timit, panlex_lite, panlex_swadesh,
// pl196x, bcp47, crubadan, markdown (+ mini markdown-it-py port), framenet
// container types (AttrDict/Pretty*/SpecialList/Future), rte.norm helpers.
// Originals: nltk/corpus/reader/{timit,panlex_lite,panlex_swadesh,pl196x,
// bcp47,crubadan,markdown,rte}.py, container/pretty classes in
// nltk/corpus/reader/framenet.py, nltk/xmlsec.py (safe_parse),
// CPython textwrap.py (fill/wrap used by framenet pretty printing).

import { existsSync } from "node:fs";
import { join as pathJoin } from "node:path";
import { pyError } from "./internals";
import { PathPointer, FileSystemPathPointer, ZipFilePathPointer } from "./data";
import { SeekableUnicodeStreamReader } from "./corpus_stream";
import {
  StreamBackedCorpusView, concat, find_corpus_fileids, read_blankline_block,
} from "./corpus_view";
import {
  CorpusReader, CategorizedCorpusReaderBase, categorizedInit,
} from "./corpus_api";
import type { CategorizedInit, EncodingSpec } from "./corpus_api";
import { PlaintextCorpusReader, WordListCorpusReader } from "./corpus_text_readers";
import type { TextTokenizerLike } from "./corpus_text_readers";
import type { BlockReader } from "./corpus_view";
import {
  AbstractLazySequence, LazyConcatenation, LazyIteratorList, LazyMap,
} from "./collections";
import { SimpleTree } from "./corpus_tree";
import { WordPunctTokenizer } from "./tokenizers_treebank";
import { PunktTokenizer } from "./punkt_nltk";
import { word_tokenize, sent_tokenize } from "./nltk_compat";
import { blankline_tokenize } from "./tokenizers_basic";
import { FreqDist } from "./freqdist";
import { pathsec_open, validate_path } from "./pathsec";
import { XMLElement, parseXmlString, xmlUnescape } from "./xmldocs";

// { small python-runtime helpers

/** Python int() for decimal strings — strict, no partial parses. */
function pyInt(s: string): number {
  const t = s.trim();
  if (!/^[+-]?\d+$/.test(t)) {
    throw pyError("ValueError", `invalid literal for int() with base 10: ${pyReprDeep(s)}`);
  }
  return parseInt(t, 10);
}

/** Python str.split(None, maxsplit): runs of whitespace, no empty pieces. */
function pySplit(s: string, maxsplit = -1): string[] {
  const out: string[] = [];
  const n = s.length;
  let i = 0;
  while (i < n && (maxsplit < 0 || out.length < maxsplit + 1)) {
    while (i < n && /\s/.test(s[i]!)) i++;
    if (i >= n) break;
    if (maxsplit >= 0 && out.length === maxsplit) {
      out.push(s.slice(i));
      i = n;
      break;
    }
    let j = i;
    while (j < n && !/\s/.test(s[j]!)) j++;
    out.push(s.slice(i, j));
    i = j;
  }
  return out;
}

/** Python str comparison for sorting (codepoint order ~ UTF-16 order for BMP). */
function pyStrCmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Python tuple/list ordering: element-wise, ints sort before strings. */
function pyTupleCmp(a: readonly unknown[], b: readonly unknown[]): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i]!, y = b[i]!;
    if (typeof x === "number" && typeof y === "number") {
      if (x !== y) return x < y ? -1 : 1;
    } else if (typeof x === "string" && typeof y === "string") {
      const c = pyStrCmp(x, y);
      if (c !== 0) return c;
    } else if (typeof x === "boolean" && typeof y === "boolean") {
      if (x !== y) return x ? 1 : -1;
    } else {
      throw pyError("TypeError", `'<' not supported between instances of '${typeof y === "string" ? "str" : typeof y}' and '${typeof x === "string" ? "str" : typeof x}'`);
    }
  }
  return a.length - b.length;
}

/** Python str.islower(). */
function pyIsLower(s: string): boolean {
  return /[^\W\d_]/.test(s) && s === s.toLowerCase();
}

/** Python str.title(): uppercase each letter following a non-letter. */
function pyTitle(s: string): string {
  let out = "";
  let prevIsLetter = false;
  for (const ch of s) {
    const isLetter = /[a-zA-Z]/.test(ch);
    out += !isLetter ? ch : prevIsLetter ? ch.toLowerCase() : ch.toUpperCase();
    prevIsLetter = isLetter;
  }
  return out;
}

/** Python str.ljust(width). */
function pyLjust(s: string, w: number): string {
  return s.length >= w ? s : s + " ".repeat(w - s.length);
}

/** Python repr() of common container values (lists, dicts, strings). */
/** CPython repr() of a str: quote selection + escapes. */
function pyStrRepr(s: string): string {
  const hasS = s.includes("'"), hasD = s.includes('"');
  const q = hasS && !hasD ? '"' : "'";
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (ch === "\\") out += "\\\\";
    else if (ch === q) out += `\\${q}`;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (c < 32 || c === 127) out += `\\x${c.toString(16).padStart(2, "0")}`;
    else out += ch;
  }
  return q + out + q;
}

function pyReprDeep(v: unknown): string {
  if (v === null || v === undefined) return "None";
  if (v === true) return "True";
  if (v === false) return "False";
  if (typeof v === "string") return pyStrRepr(v);
  if (typeof v === "number") return String(v);
  if (v instanceof Future) return pyReprDeep(v._data());
  if (v instanceof AttrDict) return v.repr();
  if (v instanceof SpecialList) return v.repr();
  if (Array.isArray(v)) return `[${v.map(pyReprDeep).join(", ")}]`;
  if (v instanceof Map) {
    const parts: string[] = [];
    for (const [k, x] of v) parts.push(`${pyReprDeep(k)}: ${pyReprDeep(x)}`);
    return `{${parts.join(", ")}}`;
  }
  if (typeof v === "object") {
    const parts: string[] = [];
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      parts.push(`${pyReprDeep(k)}: ${pyReprDeep(x)}`);
    }
    return `{${parts.join(", ")}}`;
  }
  return String(v);
}

/** Python str()/f-string interpolation of common values. */
function pyStr(v: unknown): string {
  if (typeof v === "string") return v;
  if (v === null || v === undefined) return "None";
  if (v === true) return "True";
  if (v === false) return "False";
  return pyReprDeep(v);
}

function pyWarn(msg: string): void {
  console.warn(msg);
}

/** itertools.zip_longest over arrays. */
function zipLongest<T>(arrs: T[][], fill: T): T[][] {
  const n = Math.max(0, ...arrs.map((a) => a.length));
  const out: T[][] = [];
  for (let i = 0; i < n; i++) out.push(arrs.map((a) => (i < a.length ? a[i]! : fill)));
  return out;
}

// { textwrap (CPython 3.14 textwrap.py — the parts framenet uses)

const TW_WS = "[\\t\\n\\x0b\\x0c\\r ]";
const TW_NWS = "[^\\t\\n\\x0b\\x0c\\r ]";
const TW_WORDPUNCT = "[\\p{L}\\p{N}\\p{M}\\p{Pc}!\"'&.,?]";
const TW_LETTER = "[\\p{L}\\p{M}\\p{Pc}\\p{Nl}\\p{No}]";
const TW_WORD = "[\\p{L}\\p{N}\\p{M}\\p{Pc}]";

const TW_WORDSEP = new RegExp(
  `(${TW_WS}+` +
    `|(?<=${TW_WORDPUNCT})-{2,}(?=${TW_WORD})` +
    `|${TW_NWS}+?(?:` +
    `-(?:(?<=${TW_LETTER}{2}-)|(?<=${TW_LETTER}-${TW_LETTER}-))` +
    `(?=${TW_LETTER}-?${TW_LETTER})` +
    `|(?=${TW_WS}|$)` +
    `|(?<=${TW_WORDPUNCT})(?=-{2,}${TW_WORD})` +
    `))`,
  "gu",
);
const TW_WORDSEP_SIMPLE = new RegExp(`(${TW_WS}+)`, "gu");
const TW_SENTENCE_END = /[a-z][.!?]["']?$/;

function pyExpandTabs(text: string, tabsize = 8): string {
  let out = "";
  let col = 0;
  for (const ch of text) {
    if (ch === "\t") {
      const n = tabsize - (col % tabsize);
      out += " ".repeat(n);
      col += n;
    } else {
      out += ch;
      col = ch === "\n" || ch === "\r" ? 0 : col + 1;
    }
  }
  return out;
}

export interface TextWrapperOptions {
  width?: number;
  initial_indent?: string;
  subsequent_indent?: string;
  expand_tabs?: boolean;
  replace_whitespace?: boolean;
  fix_sentence_endings?: boolean;
  break_long_words?: boolean;
  drop_whitespace?: boolean;
  break_on_hyphens?: boolean;
  tabsize?: number;
  max_lines?: number | null;
  placeholder?: string;
}

/** CPython textwrap.TextWrapper. */
export class TextWrapper {
  width: number;
  initial_indent: string;
  subsequent_indent: string;
  expand_tabs: boolean;
  replace_whitespace: boolean;
  fix_sentence_endings: boolean;
  break_long_words: boolean;
  drop_whitespace: boolean;
  break_on_hyphens: boolean;
  tabsize: number;
  max_lines: number | null;
  placeholder: string;

  constructor(opts: TextWrapperOptions = {}) {
    this.width = opts.width ?? 70;
    this.initial_indent = opts.initial_indent ?? "";
    this.subsequent_indent = opts.subsequent_indent ?? "";
    this.expand_tabs = opts.expand_tabs ?? true;
    this.replace_whitespace = opts.replace_whitespace ?? true;
    this.fix_sentence_endings = opts.fix_sentence_endings ?? false;
    this.break_long_words = opts.break_long_words ?? true;
    this.drop_whitespace = opts.drop_whitespace ?? true;
    this.break_on_hyphens = opts.break_on_hyphens ?? true;
    this.tabsize = opts.tabsize ?? 8;
    this.max_lines = opts.max_lines ?? null;
    this.placeholder = opts.placeholder ?? " [...]";
  }

  private _munge_whitespace(text: string): string {
    if (this.expand_tabs) text = pyExpandTabs(text, this.tabsize);
    // eslint-disable-next-line no-control-regex -- CPython whitespace class
    if (this.replace_whitespace) text = text.replace(/[\t\n\x0b\x0c\r ]/g, " ");
    return text;
  }

  private _split(text: string): string[] {
    const chunks = text.split(this.break_on_hyphens ? TW_WORDSEP : TW_WORDSEP_SIMPLE);
    return chunks.filter((c) => c.length > 0);
  }

  private _fix_sentence_endings(chunks: string[]): void {
    let i = 0;
    while (i < chunks.length - 1) {
      if (chunks[i + 1] === " " && TW_SENTENCE_END.test(chunks[i]!)) {
        chunks[i + 1] = "  ";
        i += 2;
      } else i += 1;
    }
  }

  private _handle_long_word(reversedChunks: string[], curLine: string[], curLen: number, width: number): void {
    const spaceLeft = width < 1 ? 1 : width - curLen;
    if (this.break_long_words && spaceLeft > 0) {
      let end = spaceLeft;
      const chunk = reversedChunks[reversedChunks.length - 1]!;
      if (this.break_on_hyphens && chunk.length > spaceLeft) {
        const hyphen = chunk.slice(0, spaceLeft).lastIndexOf("-");
        if (hyphen > 0 && chunk.slice(0, hyphen).split("").some((c) => c !== "-")) end = hyphen + 1;
      }
      curLine.push(chunk.slice(0, end));
      reversedChunks[reversedChunks.length - 1] = chunk.slice(end);
    } else if (curLine.length === 0) {
      curLine.push(reversedChunks.pop()!);
    }
  }

  private _wrap_chunks(chunks: string[]): string[] {
    const lines: string[] = [];
    if (this.width <= 0) {
      throw pyError("ValueError", `invalid width ${this.width} (must be > 0)`);
    }
    if (this.max_lines !== null) {
      const indent = this.max_lines > 1 ? this.subsequent_indent : this.initial_indent;
      if (indent.length + this.placeholder.trimStart().length > this.width) {
        throw pyError("ValueError", "placeholder too large for max width");
      }
    }
    chunks.reverse();
    while (chunks.length) {
      const curLine: string[] = [];
      let curLen = 0;
      const indent = lines.length ? this.subsequent_indent : this.initial_indent;
      const width = this.width - indent.length;
      if (this.drop_whitespace && chunks[chunks.length - 1]!.trim() === "" && lines.length) {
        chunks.pop();
      }
      while (chunks.length) {
        const l = chunks[chunks.length - 1]!.length;
        if (curLen + l <= width) {
          curLine.push(chunks.pop()!);
          curLen += l;
        } else break;
      }
      if (chunks.length && chunks[chunks.length - 1]!.length > width) {
        this._handle_long_word(chunks, curLine, curLen, width);
        curLen = curLine.reduce((n, c) => n + c.length, 0);
      }
      if (this.drop_whitespace && curLine.length && curLine[curLine.length - 1]!.trim() === "") {
        curLen -= curLine[curLine.length - 1]!.length;
        curLine.pop();
      }
      if (curLine.length) {
        if (
          this.max_lines === null ||
          lines.length + 1 < this.max_lines ||
          ((!chunks.length ||
            (this.drop_whitespace && chunks.length === 1 && !chunks[0]!.trim())) &&
            curLen <= width)
        ) {
          lines.push(indent + curLine.join(""));
        } else {
          let broke = false;
          while (curLine.length) {
            if (curLine[curLine.length - 1]!.trim() && curLen + this.placeholder.length <= width) {
              curLine.push(this.placeholder);
              lines.push(indent + curLine.join(""));
              broke = true;
              break;
            }
            curLen -= curLine[curLine.length - 1]!.length;
            curLine.pop();
          }
          if (!broke) {
            if (lines.length) {
              const prevLine = lines[lines.length - 1]!.trimEnd();
              if (prevLine.length + this.placeholder.length <= this.width) {
                lines[lines.length - 1] = prevLine + this.placeholder;
                break;
              }
            }
            lines.push(indent + this.placeholder.trimStart());
          }
          break;
        }
      }
    }
    return lines;
  }

  private _split_chunks(text: string): string[] {
    return this._split(this._munge_whitespace(text));
  }

  wrap(text: string): string[] {
    const chunks = this._split_chunks(text);
    if (this.fix_sentence_endings) this._fix_sentence_endings(chunks);
    return this._wrap_chunks(chunks);
  }

  fill(text: string): string {
    return this.wrap(text).join("\n");
  }
}

function pyTextwrapFill(s: string, width: number, opts: TextWrapperOptions = {}): string {
  return new TextWrapper({ ...opts, width }).fill(s);
}

/** framenet.mimic_wrap — wrap line 0 with textwrap, remaining lines at the
 * same positions, overflowing via textwrap at the same width. */
function* mimicWrap(lines: string[], wrap_at = 65): Generator<string[]> {
  const w = new TextWrapper({ width: wrap_at, drop_whitespace: false });
  const l0 = w.fill(lines[0]!).split("\n");
  yield l0;
  function* inner(line0: string): Generator<string> {
    let line = line0;
    let il0 = 0;
    while (line && il0 < l0.length - 1) {
      yield line.slice(0, l0[il0]!.length);
      line = line.slice(l0[il0]!.length);
      il0 += 1;
    }
    if (line) yield* w.fill(line).split("\n");
  }
  for (const l of lines.slice(1)) yield [...inner(l)];
}

// { xmlsec — safe_parse wraps delegate B's ElementTree engine (src/xmldocs.ts).
// Python nltk.xmlsec.parse / safe_parse is defusedxml.ElementTree.parse: entities
// are forbidden; DOCTYPE/comments/PIs are skipped. parseXmlString already ignores
// DOCTYPE/comment/PI tokens, so only the entity-declaration check sits on top.

/** ElementTree-shaped wrapper so callers get getroot()/iterfind()/findall(). */
export class XmlElementTree {
  constructor(private readonly _root: XMLElement) {}
  getroot(): XMLElement { return this._root; }
  iterfind(path: string, ns?: Record<string, string> | null): XMLElement[] {
    return this._root.findall(path, ns);
  }
  iter(tag?: string | null): Generator<XMLElement> { return this._root.iter(tag); }
  find(path: string, ns?: Record<string, string> | null): XMLElement | null {
    return this._root.find(path, ns);
  }
  findall(path: string, ns?: Record<string, string> | null): XMLElement[] {
    return this._root.findall(path, ns);
  }
}

/** nltk.xmlsec.parse — parse XML after rejecting entity declarations. */
export function safeParse(source: string | { read(size?: number): string }): XmlElementTree {
  return safe_parse(source);
}

export function safe_parse(source: string | { read(size?: number): string }): XmlElementTree {
  const s = typeof source === "string" ? source : source.read();
  if (/<!ENTITY/i.test(s)) {
    throw pyError("EntitiesForbidden", "EntitiesForbidden(name='entity', system_id=None, public_id=None)");
  }
  return new XmlElementTree(parseXmlString(s));
}

/** nltk.xmlsec.fromstring. */
export function safe_fromstring(text: string): XMLElement {
  return safe_parse(text).getroot();
}

export function safeFromstring(text: string): XMLElement { return safe_fromstring(text); }

/** nltk.corpus.reader.mte.xpath — thin wrapper over Element.findall. */
export function xpath(root: XMLElement, path: string, ns?: Record<string, string> | null): XMLElement[] {
  return root.findall(path, ns);
}

// { timit

export class SpeakerInfo {
  id: string;
  sex: string;
  dr: string;
  use: string;
  recdate: string;
  birthdate: string;
  ht: string;
  race: string;
  edu: string;
  comments: string | null;

  constructor(id: string, sex: string, dr: string, use: string, recdate: string,
    birthdate: string, ht: string, race: string, edu: string, comments: string | null = null) {
    this.id = id;
    this.sex = sex;
    this.dr = dr;
    this.use = use;
    this.recdate = recdate;
    this.birthdate = birthdate;
    this.ht = ht;
    this.race = race;
    this.edu = edu;
    this.comments = comments;
  }

  repr(): string {
    const attribs = "id sex dr use recdate birthdate ht race edu comments";
    const args = attribs.split(" ").map((attr) => `${attr}=${pyReprDeep((this as unknown as Record<string, unknown>)[attr])}`);
    return `SpeakerInfo(${args.join(", ")})`;
  }

  toString(): string { return this.repr(); }
}

function asciiBytes(s: string): Uint8Array {
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

export class TimitCorpusReader extends CorpusReader {
  static _FILE_RE = "(\\w+-\\w+/\\w+\\.(phn|txt|wav|wrd))|timitdic\\.txt|spkrinfo\\.txt";
  static _UTTERANCE_RE = "\\w+-\\w+/\\w+\\.txt";

  private _utterances: string[];
  private _speakerinfo: Map<string, SpeakerInfo> | null = null;
  speakers: string[];

  constructor(root: string | PathPointer, encoding: EncodingSpec = "utf8") {
    let enc: EncodingSpec = encoding;
    if (typeof enc === "string") {
      enc = [[String.raw`.*\.wav`, null as unknown as string], [".*", enc]];
    }
    // Python's find_corpus_fileids() wraps non-PathPointer roots in a
    // FileSystemPathPointer before matching.
    const ptr = typeof root === "string" ? new FileSystemPathPointer(root) : root;
    const ids = find_corpus_fileids(ptr, TimitCorpusReader._FILE_RE);
    super(ptr, ids, enc);
    this._utterances = find_corpus_fileids(ptr, TimitCorpusReader._UTTERANCE_RE)
      .map((name) => name.slice(0, -4));
    // NLTK quirk: _root is overwritten with the *constructor argument* —
    // a plain string when the reader is built directly, so open() then fails
    // on str.join(). A PathPointer root (as LazyCorpusLoader passes) works.
    this._root = root as PathPointer;
    this.speakers = [...new Set(this._utterances.map((u) => u.split("/")[0]!))].sort();
  }

  override fileids(filetype?: string | null): string[] {
    if (filetype === undefined || filetype === null) return super.fileids();
    if (["txt", "wrd", "phn", "wav"].includes(filetype)) {
      return this._utterances.map((u) => `${u}.${filetype}`);
    }
    if (filetype === "metadata") return ["timitdic.txt", "spkrinfo.txt"];
    throw pyError("ValueError", `Bad value for filetype: ${pyReprDeep(filetype)}`);
  }

  utteranceids(dialect?: string | string[] | null, sex?: string | string[] | null,
    spkrid?: string | string[] | null, sent_type?: string | string[] | null,
    sentid?: string | string[] | null): string[] {
    return this._utteranceids(dialect, sex, spkrid, sent_type, sentid);
  }

  utteranceIds(dialect?: string | string[] | null, sex?: string | string[] | null,
    spkrid?: string | string[] | null, sent_type?: string | string[] | null,
    sentid?: string | string[] | null): string[] {
    return this.utteranceids(dialect, sex, spkrid, sent_type, sentid);
  }

  private _utteranceids(dialect?: string | string[] | null, sex?: string | string[] | null,
    spkrid?: string | string[] | null, sent_type?: string | string[] | null,
    sentid?: string | string[] | null): string[] {
    const d = typeof dialect === "string" ? [dialect] : dialect;
    const sx = typeof sex === "string" ? [sex] : sex;
    const sp = typeof spkrid === "string" ? [spkrid] : spkrid;
    const st = typeof sent_type === "string" ? [sent_type] : sent_type;
    const si = typeof sentid === "string" ? [sentid] : sentid;
    let utterances = [...this._utterances];
    if (d != null) utterances = utterances.filter((u) => d.includes(u[2]!));
    if (sx != null) utterances = utterances.filter((u) => sx.includes(u[4]!));
    if (sp != null) utterances = utterances.filter((u) => sp.includes(u.slice(0, 9)));
    if (st != null) utterances = utterances.filter((u) => st.includes(u[11]!));
    // NLTK bug preserved: the sentid filter matches u[10:] against `spkrid`,
    // not `sentid` — and crashes on `in None` if spkrid was not supplied.
    if (si != null) {
      if (sp == null) throw pyError("TypeError", "argument of type 'NoneType' is not iterable");
      utterances = utterances.filter((u) => sp.includes(u.slice(10)));
    }
    return utterances;
  }

  transcriptionDict(): Record<string, string[]> { return this.transcription_dict(); }

  transcription_dict(): Record<string, string[]> {
    const transcriptions: Record<string, string[]> = {};
    const fp = this.open("timitdic.txt");
    for (const line of fp.read().split("\n")) {
      if (!line.trim() || line[0] === ";") continue;
      const m = /^\s*(\S+)\s+\/(.*)\/\s*$/.exec(line);
      if (!m) throw pyError("ValueError", `Bad line: ${pyReprDeep(line)}`);
      transcriptions[m[1]!] = m[2]!.split(/\s+/).filter((x) => x !== "");
    }
    return transcriptions;
  }

  spkrid(utterance: string): string {
    return utterance.split("/")[0]!;
  }

  sentid(utterance: string): string {
    return utterance.split("/")[1]!;
  }

  utterance(spkrid: string, sentid: string): string {
    return `${spkrid}/${sentid}`;
  }

  spkrutteranceids(speaker: string): string[] {
    return this._utterances.filter((u) => u.startsWith(speaker + "/"));
  }

  spkrinfo(speaker: string): SpeakerInfo {
    let key = speaker;
    if (this._utterances.includes(speaker)) key = this.spkrid(speaker);
    if (this._speakerinfo === null) {
      this._speakerinfo = new Map();
      const fp = this.open("spkrinfo.txt");
      for (const line of fp.read().split("\n")) {
        if (!line.trim() || line[0] === ";") continue;
        const rec = pySplit(line.trim(), 9);
        if (rec.length < 9) {
          throw pyError("TypeError", `SpeakerInfo() missing ${9 - rec.length} required positional arguments`);
        }
        const k = `dr${rec[2]}-${rec[1]!.toLowerCase()}${rec[0]!.toLowerCase()}`;
        this._speakerinfo.set(k, new SpeakerInfo(
          rec[0]!, rec[1]!, rec[2]!, rec[3]!, rec[4]!, rec[5]!, rec[6]!, rec[7]!, rec[8]!,
          rec.length > 9 ? rec[9]! : null));
      }
    }
    const info = this._speakerinfo.get(key);
    if (info === undefined) throw pyError("KeyError", pyReprDeep(key));
    return info;
  }

  private *_readLines(fileid: string): Generator<string> {
    const fp = this.open(fileid);
    for (const line of fp.read().split("\n")) {
      if (line.trim()) yield line;
    }
  }

  private _utterance_fileids(utterances: string | string[] | null | undefined, extension: string): string[] {
    let utts: string[];
    if (utterances === null || utterances === undefined) utts = this._utterances;
    else if (typeof utterances === "string") utts = [utterances];
    else utts = utterances;
    return utts.map((u) => `${u}${extension}`);
  }

  phones(utterances?: string | string[] | null): string[] {
    const results: string[] = [];
    for (const fileid of this._utterance_fileids(utterances, ".phn")) {
      for (const line of this._readLines(fileid)) results.push(pySplit(line).pop()!);
    }
    return results;
  }

  phoneTimes(utterances?: string | string[] | null): Array<[string, number, number]> { return this.phone_times(utterances); }

  phone_times(utterances?: string | string[] | null): Array<[string, number, number]> {
    const results: Array<[string, number, number]> = [];
    for (const fileid of this._utterance_fileids(utterances, ".phn")) {
      for (const line of this._readLines(fileid)) {
        const parts = pySplit(line);
        results.push([parts[2]!, pyInt(parts[0]!), pyInt(parts[1]!)]);
      }
    }
    return results;
  }

  words(utterances?: string | string[] | null): string[] {
    const results: string[] = [];
    for (const fileid of this._utterance_fileids(utterances, ".wrd")) {
      for (const line of this._readLines(fileid)) results.push(pySplit(line).pop()!);
    }
    return results;
  }

  wordTimes(utterances?: string | string[] | null): Array<[string, number, number]> { return this.word_times(utterances); }

  word_times(utterances?: string | string[] | null): Array<[string, number, number]> {
    const results: Array<[string, number, number]> = [];
    for (const fileid of this._utterance_fileids(utterances, ".wrd")) {
      for (const line of this._readLines(fileid)) {
        const parts = pySplit(line);
        results.push([parts[2]!, pyInt(parts[0]!), pyInt(parts[1]!)]);
      }
    }
    return results;
  }

  sents(utterances?: string | string[] | null): string[][] {
    const results: string[][] = [];
    for (const fileid of this._utterance_fileids(utterances, ".wrd")) {
      const sent: string[] = [];
      for (const line of this._readLines(fileid)) sent.push(pySplit(line).pop()!);
      results.push(sent);
    }
    return results;
  }

  sentTimes(utterances?: string | string[] | null): Array<[string, number, number]> { return this.sent_times(utterances); }

  sent_times(utterances?: string | string[] | null): Array<[string, number, number]> {
    const results: Array<[string, number, number]> = [];
    for (const fileid of this._utterance_fileids(utterances, ".txt")) {
      for (const line of this._readLines(fileid)) {
        const parts = pySplit(line, 2);
        results.push([parts[parts.length - 1]!.trim(), pyInt(parts[0]!), pyInt(parts[1]!)]);
      }
    }
    return results;
  }

  phoneTrees(utterances?: string | string[] | null): SimpleTree[] { return this.phone_trees(utterances); }

  phone_trees(utterances?: string | string[] | null): SimpleTree[] {
    let utts: string[];
    if (utterances === null || utterances === undefined) utts = this._utterances;
    else if (typeof utterances === "string") utts = [utterances];
    else utts = utterances;
    const trees: SimpleTree[] = [];
    for (const utterance of utts) {
      const wordTimes = this.word_times(utterance);
      const phoneTimes = this.phone_times(utterance);
      const sentTimes = this.sent_times(utterance);
      while (sentTimes.length) {
        const [sent, _sentStart, sentEnd] = sentTimes.shift()!;
        void sent;
        trees.push(new SimpleTree("S", []));
        while (wordTimes.length && phoneTimes.length && phoneTimes[0]![2] <= wordTimes[0]![1]) {
          trees[trees.length - 1]!.children.push(phoneTimes.shift()![0]);
        }
        while (wordTimes.length && wordTimes[0]![2] <= sentEnd) {
          const [word, _ws, wordEnd] = wordTimes.shift()!;
          const top = trees[trees.length - 1]!;
          top.children.push(new SimpleTree(word, []));
          while (phoneTimes.length && phoneTimes[0]![2] <= wordEnd) {
            (top.children[top.children.length - 1] as SimpleTree).children.push(phoneTimes.shift()![0]);
          }
        }
        while (phoneTimes.length && phoneTimes[0]![2] <= sentEnd) {
          trees[trees.length - 1]!.children.push(phoneTimes.shift()![0]);
        }
      }
    }
    return trees;
  }

  /** Minimal PCM RIFF wave reader/writer matching Python's wave round-trip. */
  wav(utterance: string, start = 0, end: number | null = null): Uint8Array {
    const fp = this.open(utterance + ".wav");
    const bytes = Uint8Array.from(fp.read(), (c) => c.charCodeAt(0) & 0xff);
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tag = (o: number, n: number) => String.fromCharCode(...bytes.subarray(o, o + n));
    if (tag(0, 4) !== "RIFF") throw pyError("Error", "file does not start with RIFF id");
    if (tag(8, 4) !== "WAVE") throw pyError("Error", "not a WAVE file");
    let pos = 12;
    let channels = 0, sampwidth = 0, framerate = 0, dataStart = -1, dataLen = 0;
    while (pos + 8 <= bytes.length) {
      const id = tag(pos, 4);
      const size = dv.getUint32(pos + 4, true);
      if (id === "fmt ") {
        const audioFmt = dv.getUint16(pos + 8, true);
        if (audioFmt !== 1) throw pyError("Error", `unknown format: ${audioFmt}`);
        channels = dv.getUint16(pos + 10, true);
        framerate = dv.getUint32(pos + 12, true);
        sampwidth = dv.getUint16(pos + 22, true) / 8;
      } else if (id === "data") {
        dataStart = pos + 8;
        dataLen = Math.min(size, bytes.length - pos - 8);
      }
      pos += 8 + size + (size % 2);
    }
    if (dataStart < 0) throw pyError("Error", "data chunk not found");
    const blockAlign = sampwidth * channels;
    const nframes = Math.floor(dataLen / blockAlign);
    if (end === null) end = nframes;
    const frames = bytes.subarray(dataStart + start * blockAlign, dataStart + end * blockAlign);
    const out = new Uint8Array(44 + frames.length);
    const odv = new DataView(out.buffer);
    out.set(asciiBytes("RIFF"), 0);
    odv.setUint32(4, 36 + frames.length, true);
    out.set(asciiBytes("WAVEfmt "), 8);
    odv.setUint32(16, 16, true);
    odv.setUint16(20, 1, true);
    odv.setUint16(22, channels, true);
    odv.setUint32(24, framerate, true);
    odv.setUint32(28, framerate * blockAlign, true);
    odv.setUint16(32, blockAlign, true);
    odv.setUint16(34, sampwidth * 8, true);
    out.set(asciiBytes("data"), 36);
    odv.setUint32(40, frames.length, true);
    out.set(frames, 44);
    return out;
  }

  audiodata(utterance: string, start = 0, end: number | null = null): Uint8Array {
    if (!(end === null || end > start)) throw pyError("AssertionError", "");
    const headersize = 44;
    const fp = this.open(utterance + ".wav");
    const data = end === null ? fp.read() : fp.read(headersize + end * 2);
    const sliced = data.slice(headersize + start * 2);
    return Uint8Array.from(sliced, (c) => c.charCodeAt(0) & 0xff);
  }

  play(utterance: string, start = 0, end: number | null = null): void {
    void utterance;
    void start;
    void end;
    // ossaudiodev and pygame are unavailable in this environment — NLTK's
    // third fallback prints a complaint to stderr.
    console.error("you must install pygame or ossaudiodev for audio playback.");
  }
}

/** timit.read_timit_block — sentence preceded by an ignored sentence number. */
export function readTimitBlock(stream: SeekableUnicodeStreamReader): string[] {
  return read_timit_block(stream);
}

export function read_timit_block(stream: SeekableUnicodeStreamReader): string[] {
  const line = stream.readline();
  if (!line) return [];
  const idx = line.indexOf(" ");
  if (idx < 0) throw pyError("ValueError", "not enough values to unpack (expected 2, got 1)");
  return [line.slice(idx + 1)];
}
// { panlex_lite

interface SqliteStmt { all(...params: unknown[]): unknown[][]; }
interface SqliteDb { prepare(sql: string): SqliteStmt; }

/** Open an SQLite db read-path using bun:sqlite, falling back to node:sqlite. */
function openSqlite(dbPath: string): SqliteDb {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const req = (globalThis as Record<string, unknown>).require as ((m: string) => unknown) | undefined
    ?? (typeof require === "function" ? require : undefined);
  if (req) {
    try {
      const { Database } = req("bun:sqlite") as { Database: new (p: string) => { prepare(sql: string): { values(...p: unknown[]): unknown[][] } } };
      const db = new Database(dbPath);
      return { prepare: (sql) => ({ all: (...p) => db.prepare(sql).values(...p) }) };
    } catch { /* fall through to node:sqlite */ }
    try {
      const { DatabaseSync } = req("node:sqlite") as { DatabaseSync: new (p: string) => { prepare(sql: string): { all(...p: unknown[]): unknown[] } } };
      const db = new DatabaseSync(dbPath);
      return {
        prepare: (sql) => ({
          all: (...p) => db.prepare(sql).all(...p).map((r) => (Array.isArray(r) ? r as unknown[] : Object.values(r as object))),
        }),
      };
    } catch { /* fall through */ }
  }
  throw pyError("ImportError", "panlex_lite requires sqlite3 support (bun:sqlite or node:sqlite)");
}

/** panlex_lite.Meaning — dict subclass for a PanLex translation set. */
export class Meaning {
  private _d = new Map<string, unknown>();

  constructor(mn: number, attr: Record<string, unknown>) {
    for (const [k, v] of Object.entries(attr)) this._d.set(k, v);
    this._d.set("mn", mn);
  }

  get(key: string, def?: unknown): unknown {
    return this._d.has(key) ? this._d.get(key) : def;
  }
  has(key: string): boolean { return this._d.has(key); }
  keys(): Iterator<string> { return this._d.keys(); }
  items(): Iterator<[string, unknown]> { return this._d.entries(); }
  toObject(): Record<string, unknown> { return Object.fromEntries(this._d); }
  get size(): number { return this._d.size; }
  [Symbol.iterator](): Iterator<string> { return this._d.keys(); }

  id(): unknown { return this._d.get("mn"); }
  quality(): unknown { return this._d.get("uq"); }
  source(): unknown { return this._d.get("ap"); }
  source_group(): unknown { return this._d.get("ui"); }
  sourceGroup(): unknown { return this.source_group(); }
  expressions(): unknown { return this._d.get("ex"); }
}

export class PanLexLiteCorpusReader extends CorpusReader {
  static MEANING_Q = `
        SELECT dnx2.mn, dnx2.uq, dnx2.ap, dnx2.ui, ex2.tt, ex2.lv
        FROM dnx
        JOIN ex ON (ex.ex = dnx.ex)
        JOIN dnx dnx2 ON (dnx2.mn = dnx.mn)
        JOIN ex ex2 ON (ex2.ex = dnx2.ex)
        WHERE dnx.ex != dnx2.ex AND ex.tt = ? AND ex.lv = ?
        ORDER BY dnx2.uq DESC
    `;

  static TRANSLATION_Q = `
        SELECT s.tt, sum(s.uq) AS trq FROM (
            SELECT ex2.tt, max(dnx.uq) AS uq
            FROM dnx
            JOIN ex ON (ex.ex = dnx.ex)
            JOIN dnx dnx2 ON (dnx2.mn = dnx.mn)
            JOIN ex ex2 ON (ex2.ex = dnx2.ex)
            WHERE dnx.ex != dnx2.ex AND ex.lv = ? AND ex.tt = ? AND ex2.lv = ?
            GROUP BY ex2.tt, dnx.ui
        ) s
        GROUP BY s.tt
        ORDER BY trq DESC, s.tt
    `;

  private _c: SqliteDb;
  private _uid_lv = new Map<string, number>();
  private _lv_uid = new Map<number, string>();

  constructor(root: string | PathPointer) {
    // Python never calls CorpusReader.__init__ here — it validates the db
    // path and opens SQLite directly, so _fileids/_root/etc. stay unset and
    // every inherited corpus method raises AttributeError. We still run the
    // base ctor for typing, then shadow the inherited surface to raise.
    const rootPath = root instanceof FileSystemPathPointer ? root.path : String(root);
    const dbPath = pathJoin(rootPath, "db.sqlite");
    validate_path(dbPath, "PanLexLiteCorpusReader", rootPath);
    super(new FileSystemPathPointer(rootPath), []);
    this._c = openSqlite(dbPath);
    for (const row of this._c.prepare("SELECT uid, lv FROM lv").all()) {
      this._uid_lv.set(row[0] as string, row[1] as number);
      this._lv_uid.set(row[1] as number, row[0] as string);
    }
  }

  languageVarieties(lc?: string | null): Array<[string, string]> { return this.language_varieties(lc); }

  language_varieties(lc?: string | null): Array<[string, string]> {
    if (lc === undefined || lc === null) {
      return this._c.prepare("SELECT uid, tt FROM lv ORDER BY uid").all() as Array<[string, string]>;
    }
    return this._c.prepare("SELECT uid, tt FROM lv WHERE lc = ? ORDER BY uid").all(lc) as Array<[string, string]>;
  }

  meanings(expr_uid: string, expr_tt: string): Meaning[] {
    const expr_lv = this._uid_lv.get(expr_uid);
    if (expr_lv === undefined) throw pyError("KeyError", pyReprDeep(expr_uid));
    const mn_info = new Map<number, Record<string, unknown>>();
    for (const i of this._c.prepare(PanLexLiteCorpusReader.MEANING_Q).all(expr_tt, expr_lv)) {
      const mn = i[0] as number;
      const uid = this._lv_uid.get(i[5] as number);
      if (uid === undefined) throw pyError("KeyError", pyReprDeep(i[5]));
      if (!mn_info.has(mn)) {
        mn_info.set(mn, { uq: i[1], ap: i[2], ui: i[3], ex: { [expr_uid]: [expr_tt] } });
      }
      const ex = mn_info.get(mn)!["ex"] as Record<string, string[]>;
      if (!(uid in ex)) ex[uid] = [];
      ex[uid]!.push(i[4] as string);
    }
    return [...mn_info.keys()].map((mn) => new Meaning(mn, mn_info.get(mn)!));
  }

  translations(from_uid: string, from_tt: string, to_uid: string): Array<[string, number]> {
    const from_lv = this._uid_lv.get(from_uid);
    if (from_lv === undefined) throw pyError("KeyError", pyReprDeep(from_uid));
    const to_lv = this._uid_lv.get(to_uid);
    if (to_lv === undefined) throw pyError("KeyError", pyReprDeep(to_uid));
    return this._c.prepare(PanLexLiteCorpusReader.TRANSLATION_Q).all(from_lv, from_tt, to_lv) as Array<[string, number]>;
  }

  // Python's reader never initializes CorpusReader state (_fileids, _root,
  // _encoding); every inherited method fails with AttributeError there.
  private _uninitialized(name: string): never {
    throw pyError("AttributeError", `'PanLexLiteCorpusReader' object has no attribute '${name}'`);
  }
  override fileids(): string[] { return this._uninitialized("_fileids"); }
  override abspath(fileid: string): PathPointer { void fileid; return this._uninitialized("_root"); }
  override abspaths(): PathPointer[] { return this._uninitialized("_root"); }
  override raw(): string { return this._uninitialized("_fileids"); }
  override open(file: string): SeekableUnicodeStreamReader { void file; return this._uninitialized("_root"); }
  override encoding(file: string): string | null { void file; return this._uninitialized("_encoding"); }
  override get root(): PathPointer { return this._uninitialized("_root"); }
  override repr(): string { return this._uninitialized("_root"); }
}

// { panlex_swadesh

/** panlex_swadesh.PanlexLanguage namedtuple. */
export class PanlexLanguage {
  constructor(
    readonly panlex_uid: string,
    readonly iso639: string,
    readonly iso639_type: string,
    readonly script: string,
    readonly name: string,
    readonly langvar_uid: string,
  ) {}
  get length(): number { return 6; }
  *[Symbol.iterator](): Generator<string> {
    yield this.panlex_uid;
    yield this.iso639;
    yield this.iso639_type;
    yield this.script;
    yield this.name;
    yield this.langvar_uid;
  }
  get(i: number): string | undefined {
    return [...this][i];
  }
  repr(): string {
    return `PanlexLanguage(panlex_uid=${pyReprDeep(this.panlex_uid)}, iso639=${pyReprDeep(this.iso639)}, iso639_type=${pyReprDeep(this.iso639_type)}, script=${pyReprDeep(this.script)}, name=${pyReprDeep(this.name)}, langvar_uid=${pyReprDeep(this.langvar_uid)})`;
  }
}

export class PanlexSwadeshCorpusReader extends WordListCorpusReader {
  swadesh_size: string;
  private _languages = new Map<string, PanlexLanguage>();
  private _macro_langauges = new Map<string, string[]>();

  constructor(root: string | PathPointer, fileids: string | string[], encoding: EncodingSpec = "utf8") {
    super(root, fileids, encoding);
    const first = this.fileids()[0];
    if (first === undefined) throw pyError("IndexError", "list index out of range");
    const m = /^swadesh([0-9].*)\//.exec(first);
    if (m === null) {
      throw pyError("AttributeError", `'NoneType' object has no attribute 'group'`);
    }
    this.swadesh_size = m[1]!;
    for (const lang of this.get_languages()) this._languages.set(lang.panlex_uid, lang);
    const macro = new Map<string, string[]>();
    for (const lang of this._languages.values()) {
      if (!macro.has(lang.iso639)) macro.set(lang.iso639, []);
      macro.get(lang.iso639)!.push(lang.panlex_uid);
    }
    this._macro_langauges = macro;
  }

  override license(): string {
    return "CC0 1.0 Universal";
  }

  languageCodes(): string[] { return this.language_codes(); }

  language_codes(): string[] {
    return [...this._languages.keys()];
  }

  *getLanguages(): Generator<PanlexLanguage> { yield* this.get_languages(); }

  *get_languages(): Generator<PanlexLanguage> {
    for (const line of this.raw(`langs${this.swadesh_size}.txt`).split("\n")) {
      if (!line.trim()) continue;
      const f = line.trim().split("\t");
      yield new PanlexLanguage(f[0]!, f[1]!, f[2]!, f[3]!, f[4]!, f[5]!);
    }
  }

  getMacrolanguages(): Map<string, string[]> { return this.get_macrolanguages(); }

  get_macrolanguages(): Map<string, string[]> {
    return this._macro_langauges;
  }

  words_by_lang(lang_code: string): string[][] {
    const fileid = `swadesh${this.swadesh_size}/${lang_code}.txt`;
    return this.words(fileid).map((concept) => concept.split("\t"));
  }

  wordsByLang(lang_code: string): string[][] { return this.words_by_lang(lang_code); }

  words_by_iso639(iso63_code: string): string[][] {
    // defaultdict(list): an unknown code creates an empty entry and yields [].
    if (!this._macro_langauges.has(iso63_code)) this._macro_langauges.set(iso63_code, []);
    const fileids = this._macro_langauges.get(iso63_code)!
      .map((lang_code) => `swadesh${this.swadesh_size}/${lang_code}.txt`);
    const out: string[][] = [];
    for (const fileid of fileids) {
      for (const concept of this.words(fileid)) out.push(concept.split("\t"));
    }
    return out;
  }

  wordsByIso639(iso63_code: string): string[][] { return this.words_by_iso639(iso63_code); }

  entries(fileids?: string[] | null): string[][] {
    // Python: ``if not fileids`` — an empty list also falls back to all fileids.
    const ids = !fileids || fileids.length === 0 ? this.fileids() : fileids;
    const wordlists = ids.map((f) => this.words(f));
    const out: string[][] = [];
    const minLen = Math.min(...wordlists.map((w) => w.length));
    for (let i = 0; i < minLen; i++) out.push(wordlists.map((w) => w[i]!));
    return out;
  }
}

// { pl196x

const PL196X_PARA = /<p(?: [^>]*){0,1}>([\s\S]*?)<\/p>/g;
const PL196X_SENT = /<s(?: [^>]*){0,1}>([\s\S]*?)<\/s>/g;
const PL196X_TAGGEDWORD = /<([wc](?: [^>]*){0,1}>)([\s\S]*?)<\/[wc]>/g;
const PL196X_WORD = /<[wc](?: [^>]*){0,1}>([\s\S]*?)<\/[wc]>/g;
const PL196X_TYPE = /type="(.*?)"/;
const PL196X_ANA = /ana="(.*?)"/;

function countOccurrences(haystack: string, needle: string): number {
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i >= 0) {
    n++;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return n;
}

export class TEICorpusView extends StreamBackedCorpusView<unknown> {
  static _pagesize = 4096;

  constructor(
    corpus_file: string | PathPointer,
    private _tagged: boolean,
    private _group_by_sent: boolean,
    private _group_by_para: boolean,
    tagset: string | null = null,
    head_len = 0,
    private _textids: Set<string> | null = null,
  ) {
    super(corpus_file, undefined, head_len);
    void tagset;
    this.read_block = (s) => this._readBlock(s);
  }

  private _readBlock(stream: SeekableUnicodeStreamReader): unknown[] {
    const blockLines = stream.readlines(TEICorpusView._pagesize);
    let block = concat(blockLines) as string;
    let openCount = countOccurrences(block, "<text id");
    let closeCount = countOccurrences(block, "</text>");
    while (openCount > closeCount || openCount === 0) {
      const tmp = stream.readline();
      if (tmp.length <= 0) break;
      block += tmp;
      openCount += countOccurrences(tmp, "<text id");
      closeCount += countOccurrences(tmp, "</text>");
    }
    block = block.replaceAll("\n", "");
    if (this._textids !== null && this._textids.size > 0) {
      const kept: string[] = [];
      let pos = 0;
      for (;;) {
        const beg = block.indexOf("<text id", pos);
        if (beg < 0) {
          kept.push(block.slice(pos));
          break;
        }
        const q1 = block.indexOf('"', beg);
        const q2 = q1 >= 0 ? block.indexOf('"', q1 + 1) : -1;
        const tid = q1 >= 0 && q1 < q2 ? block.slice(q1 + 1, q2) : "";
        const close = block.indexOf("</text>", beg);
        const end = close < 0 ? block.length : close + "</text>".length;
        kept.push(block.slice(pos, beg));
        if (this._textids.has(tid)) kept.push(block.slice(beg, end));
        pos = end;
      }
      block = kept.join("");
    }
    const output: unknown[] = [];
    for (const pm of block.matchAll(PL196X_PARA)) {
      const para: unknown[] = [];
      for (const sm of pm[1]!.matchAll(PL196X_SENT)) {
        let sent: unknown[];
        if (!this._tagged) {
          sent = [...sm[1]!.matchAll(PL196X_WORD)].map((m) => m[1]!);
        } else {
          sent = [...sm[1]!.matchAll(PL196X_TAGGEDWORD)].map((m) => this._parse_tag([m[1]!, m[2]!]) as unknown);
        }
        if (this._group_by_sent) para.push(sent);
        else para.push(...sent);
      }
      if (this._group_by_para) output.push(para);
      else output.push(...para);
    }
    return output;
  }

  private _parse_tag(tagWordTuple: [string, string]): [string, string] {
    let [tag, word] = tagWordTuple;
    if (tag.startsWith("w")) {
      const m = PL196X_ANA.exec(tag);
      if (!m) throw pyError("AttributeError", `'NoneType' object has no attribute 'group'`);
      tag = m[1]!;
    } else {
      const m = PL196X_TYPE.exec(tag);
      if (!m) throw pyError("AttributeError", `'NoneType' object has no attribute 'group'`);
      tag = m[1]!;
    }
    return [word, tag];
  }
}

export interface Pl196xInit extends CategorizedInit {
  textid_file?: string;
}

export class Pl196xCorpusReader extends CategorizedCorpusReaderBase {
  head_len = 2770;
  private _textids: string | null = null;
  private _f2t = new Map<string, string[]>();
  private _t2f = new Map<string, string[]>();

  constructor(root: string | PathPointer, fileids: string | string[], init?: Pl196xInit) {
    super(root, fileids, "utf8");
    const { textid_file, ...cat } = init ?? {};
    this._textids = textid_file ?? null;
    categorizedInit(this, cat);
    this._init_textids();
  }

  private _init_textids(): void {
    this._f2t = new Map();
    this._t2f = new Map();
    if (this._textids !== null) {
      const rootPath = this._root instanceof FileSystemPathPointer ? this._root.path : null;
      const bytes = pathsec_open(this._textids, "r", "Pl196xCorpusReader", rootPath);
      const text = new TextDecoder("utf-8").decode(bytes);
      // Python iterates the file's lines: a trailing newline produces no extra
      // empty line, but blank lines in the middle DO (then crash on unpack).
      const lines = text.split("\n");
      if (lines.length && lines[lines.length - 1] === "") lines.pop();
      for (const rawLine of lines) {
        const line = rawLine.trim();
        const sp = line.indexOf(" ");
        const parts = sp < 0 ? [line] : [line.slice(0, sp), line.slice(sp + 1)];
        if (parts.length !== 2) {
          throw pyError("ValueError", `not enough values to unpack (expected 2, got ${parts.length})`);
        }
        const file_id = parts[0]!;
        const text_ids = parts[1]!;
        if (!this.fileids().includes(file_id)) {
          throw pyError("ValueError", `In text_id mapping file ${this._textids}: ${file_id} not found`);
        }
        for (const text_id of this._catDelimiter === null ? pySplit(text_ids) : text_ids.split(this._catDelimiter)) {
          this._add_textids(file_id, text_id);
        }
      }
    }
  }

  private _add_textids(file_id: string, text_id: string): void {
    if (!this._f2t.has(file_id)) this._f2t.set(file_id, []);
    if (!this._t2f.has(text_id)) this._t2f.set(text_id, []);
    this._f2t.get(file_id)!.push(text_id);
    this._t2f.get(text_id)!.push(file_id);
  }

  // NLTK quirk: this counts the Nones and requires the count to equal 1 —
  // i.e. exactly *two* of the three selectors must be supplied, not one.
  private _resolve3(fileids: string | string[] | null | undefined,
    categories: string | string[] | null | undefined,
    textids: string | string[] | null | undefined = null): [string | string[] | null, Record<string, Set<string>> | null] {
    const nNones = [fileids ?? null, categories ?? null, textids ?? null].filter((a) => a === null).length;
    if (nNones !== 1) {
      throw pyError("ValueError", "Specify exactly one of: fileids, categories or textids");
    }
    if (fileids !== null && fileids !== undefined) return [fileids, null];
    if (categories !== null && categories !== undefined) return [this.fileids(categories), null];
    if (textids !== null && textids !== undefined) {
      const tids = typeof textids === "string" ? [textids] : textids;
      const files: string[] = [];
      for (const t of tids) {
        // defaultdict: lookup on a missing key creates the empty entry.
        if (!this._t2f.has(t)) this._t2f.set(t, []);
        files.push(...this._t2f.get(t)!);
      }
      const tdict: Record<string, Set<string>> = {};
      const tidSet = new Set(tids);
      for (const f of files) {
        if (!this._f2t.has(f)) this._f2t.set(f, []);
        tdict[f] = new Set(this._f2t.get(f)!.filter((t) => tidSet.has(t)));
      }
      return [files, tdict];
    }
    return [null, null];
  }

  decode_tag(tag: string): string {
    return tag;
  }

  decodeTag(tag: string): string { return this.decode_tag(tag); }

  textids(fileids?: string | string[] | null, categories?: string | string[] | null): string[] {
    const [resolved] = this._resolve3(fileids, categories);
    if (resolved === null) return [...this._t2f.keys()].sort();
    const ids = typeof resolved === "string" ? [resolved] : resolved;
    const out: string[] = [];
    for (const d of ids) {
      // defaultdict: lookup on a missing key creates the empty entry.
      if (!this._f2t.has(d)) this._f2t.set(d, []);
      out.push(...this._f2t.get(d)!);
    }
    return out.sort();
  }

  private _views(fileids: string | string[] | null | undefined,
    categories: string | string[] | null | undefined,
    textids: string | string[] | null | undefined,
    tagged: boolean, bySent: boolean, byPara: boolean): unknown {
    const [resolved, tdict] = this._resolve3(fileids, categories, textids);
    let ids: string[];
    if (resolved === null) ids = this._fileids;
    else if (typeof resolved === "string") ids = [resolved];
    else ids = resolved;
    const views = ids.map((fileid) => new TEICorpusView(
      this.abspath(fileid), tagged, bySent, byPara, null, this.head_len,
      tdict ? tdict[fileid]! : null));
    return concat(views);
  }

  words(fileids?: string | string[] | null, categories?: string | string[] | null, textids?: string | string[] | null): unknown {
    return this._views(fileids, categories, textids, false, false, false);
  }

  sents(fileids?: string | string[] | null, categories?: string | string[] | null, textids?: string | string[] | null): unknown {
    return this._views(fileids, categories, textids, false, true, false);
  }

  paras(fileids?: string | string[] | null, categories?: string | string[] | null, textids?: string | string[] | null): unknown {
    return this._views(fileids, categories, textids, false, true, true);
  }

  tagged_words(fileids?: string | string[] | null, categories?: string | string[] | null, textids?: string | string[] | null): unknown {
    return this._views(fileids, categories, textids, true, false, false);
  }

  taggedWords(fileids?: string | string[] | null, categories?: string | string[] | null, textids?: string | string[] | null): unknown {
    return this.tagged_words(fileids, categories, textids);
  }

  tagged_sents(fileids?: string | string[] | null, categories?: string | string[] | null, textids?: string | string[] | null): unknown {
    return this._views(fileids, categories, textids, true, true, false);
  }

  taggedSents(fileids?: string | string[] | null, categories?: string | string[] | null, textids?: string | string[] | null): unknown {
    return this.tagged_sents(fileids, categories, textids);
  }

  tagged_paras(fileids?: string | string[] | null, categories?: string | string[] | null, textids?: string | string[] | null): unknown {
    return this._views(fileids, categories, textids, true, true, true);
  }

  taggedParas(fileids?: string | string[] | null, categories?: string | string[] | null, textids?: string | string[] | null): unknown {
    return this.tagged_paras(fileids, categories, textids);
  }

  xml(fileids?: string | string[] | null, categories?: string | string[] | null): XMLElement {
    const [resolved] = this._resolve3(fileids, categories);
    // Python checks len(fileids) == 1 on the *resolved* value: a string's
    // length is its character count, so string fileids always raise.
    const n = resolved === null || resolved === undefined ? 0 : resolved.length;
    if (n === 1) {
      const fid = (resolved as string | string[])[0]!;
      const fp = this.abspath(fid).open();
      return safe_parse(fp).getroot();
    }
    throw pyError("TypeError", "Expected a single file");
  }
}

// { bcp47

export class BCP47CorpusReader extends CorpusReader {
  langcode: Record<string, string> = {};
  db!: Record<string, Record<string, Record<string, string | string[]>>>;
  subdiv: Record<string, string | null> = {};
  casing!: Record<string, (s: string) => string>;
  format!: Record<string, RegExp>;
  version!: string;
  wiki_q!: Record<string, string>;

  constructor(root: string | PathPointer, fileids: string | string[]) {
    super(root, fileids);
    this.langcode = {};
    {
      const fp = this.open("iana/language-subtag-registry.txt");
      this.db = this.data_dict(fp.read().split("%%\n"));
    }
    {
      const fp = this.open("cldr/common-subdivisions-en.xml");
      const tree = safe_parse(fp);
      this.subdiv = this.subdiv_dict(tree.iterfind("localeDisplayNames/subdivisions/subdivision"));
    }
    this.morphology();
  }

  load_wiki_q(): void {
    const fp = this.open("cldr/tools-cldr-rdf-external-entityToCode.tsv");
    this.wiki_q = this.wiki_dict(fp.read().trim().split("\n").slice(1));
  }

  loadWikiQ(): void { this.load_wiki_q(); }

  wiki_dict(lines: string[]): Record<string, string> {
    const out: Record<string, string> = {};
    for (const line of lines) {
      const pair = line.trim().split("\t");
      if (pair.length < 2) throw pyError("IndexError", "list index out of range");
      out[pair[1]!] = pair[0]!.split("/").pop()!;
    }
    return out;
  }

  wikiDict(lines: string[]): Record<string, string> { return this.wiki_dict(lines); }

  subdiv_dict(subdivs: Iterable<XMLElement>): Record<string, string | null> {
    const out: Record<string, string | null> = {};
    for (const sub of subdivs) out[sub.attrib.get("type")!] = sub.text;
    return out;
  }

  subdivDict(subdivs: Iterable<XMLElement>): Record<string, string | null> { return this.subdiv_dict(subdivs); }

  morphology(): void {
    this.casing = {
      language: (s) => s.toLowerCase(),
      extlang: (s) => s.toLowerCase(),
      script: (s) => pyTitle(s),
      region: (s) => s.toUpperCase(),
      variant: (s) => s.toLowerCase(),
    };
    this.format = {
      language: /^[a-z][a-z][a-z]?$/,
      extlang: /^[a-z][a-z][a-z]$/,
      script: /^[A-Z][a-z][a-z][a-z]$/,
      region: /^(?:[A-Z][A-Z]|[0-9][0-9][0-9])$/,
      variant: /^[a-zA-Z0-9][a-zA-Z0-9][a-zA-Z0-9][a-zA-Z0-9](?:[a-zA-Z0-9]?){4}$/,
      singleton: /^[a-z]$/,
    };
  }

  data_dict(records: string[]): Record<string, Record<string, Record<string, string | string[]>>> {
    if (records.length === 0) throw pyError("IndexError", "list index out of range");
    this.version = records[0]!.replaceAll("File-Date:", "").trim();
    const dic: Record<string, Record<string, Record<string, string | string[]>>> = {};
    const deprecated: Record<string, Record<string, Record<string, string | string[]>>> = {};
    for (const label of ["language", "extlang", "script", "region", "variant", "redundant", "grandfathered"]) {
      deprecated[label] = {};
    }
    dic["deprecated"] = deprecated as unknown as Record<string, Record<string, string | string[]>>;
    let key: string | undefined;
    for (const record of records.slice(1)) {
      const fields = record.trim().split("\n").map((field) => field.split(": "));
      if (fields[0] === undefined || fields[0].length < 2 ||
          fields[1] === undefined || fields[1].length < 2) {
        throw pyError("IndexError", "list index out of range");
      }
      const typ = fields[0][1]!;
      const tag = fields[1][1]!;
      if (!(typ in dic)) dic[typ] = {};
      const subfields: Record<string, string[]> = {};
      for (const field of fields.slice(2)) {
        if (field.length === 2) {
          key = field[0]!;
          const val = field[1]!;
          if (!(key in subfields)) subfields[key] = [val];
          else subfields[key]!.push(val);
        } else {
          if (key === undefined) throw pyError("NameError", "name 'key' is not defined");
          const arr = subfields[key];
          if (arr === undefined) throw pyError("KeyError", pyReprDeep(key));
          arr[arr.length - 1] = arr[arr.length - 1] + " " + field[0]!.trim();
        }
        if (!record.includes("Deprecated") && typ === "language" && key === "Description") {
          this.langcode[subfields[key]![subfields[key]!.length - 1]!] = tag;
        }
      }
      const outSub: Record<string, string | string[]> = {};
      for (const k of Object.keys(subfields)) {
        outSub[k] = subfields[k]!.length === 1 ? subfields[k]![0]! : subfields[k]!;
      }
      if (record.includes("Deprecated")) {
        const dep = dic["deprecated"] as unknown as Record<string, Record<string, Record<string, string | string[]>>>;
        if (!(typ in dep)) throw pyError("KeyError", pyReprDeep(typ));
        dep[typ]![tag] = outSub;
      } else {
        dic[typ]![tag] = outSub;
      }
    }
    return dic;
  }

  dataDict(records: string[]): ReturnType<BCP47CorpusReader["data_dict"]> { return this.data_dict(records); }

  val2str(val: string | string[]): string {
    return Array.isArray(val) ? val[0]! : val;
  }

  lang2str(lg_record: Record<string, string>): string {
    if (!("language" in lg_record)) throw pyError("KeyError", "'language'");
    let name = `${lg_record["language"]}`;
    for (const label of ["extlang", "script", "region", "variant", "extension"]) {
      if (label in lg_record) name += `: ${lg_record[label]}`;
    }
    return name;
  }

  parse_tag(tag: string): Record<string, string> {
    const subtags = tag.split("-");
    const lang: Record<string, string> = {};
    const labels = ["language", "extlang", "script", "region", "variant", "variant"];
    while (subtags.length && labels.length) {
      let subtag = subtags.shift()!;
      let found = false;
      while (labels.length) {
        const label = labels.shift()!;
        subtag = this.casing[label]!(subtag);
        if (this.format[label]!.test(subtag)) {
          if (!(label in this.db)) throw pyError("KeyError", pyReprDeep(label));
          if (subtag in this.db[label]!) {
            found = true;
            const valstr = this.val2str(this.db[label]![subtag]!["Description"] as string | string[]);
            if (label === "variant" && label in lang) lang[label] = lang[label]! + ": " + valstr;
            else lang[label] = valstr;
            break;
          } else if (subtag in this.db["deprecated"]![label]!) {
            found = true;
            const dep = this.db["deprecated"]![label]![subtag]! as unknown as Record<string, string | string[]>;
            let note = `The ${pyReprDeep(subtag)} ${label} code is deprecated`;
            if ("Preferred-Value" in dep) {
              note += `', prefer '${this.val2str(dep["Preferred-Value"] as string | string[])}'`;
            }
            lang[label] = this.val2str(dep["Description"] as string | string[]);
            pyWarn(note);
            break;
          }
        }
      }
      if (!found) {
        let ext: string;
        if (subtag === "u") {
          if (subtags.length === 0) throw pyError("IndexError", "list index out of range");
          if (subtags[0] === "sd") {
            if (subtags.length < 2) throw pyError("IndexError", "list index out of range");
            const sd = subtags[1]!;
            if (sd in this.subdiv) {
              ext = this.subdiv[sd]!;
            } else {
              // NLTK bug preserved: the error branch interpolates the variable
              // being defined, so an unknown subdivision raises NameError —
              // caught in name(), which then reports the tag unrecognized.
              throw pyError("NameError", "name 'ext' is not defined");
            }
          } else {
            ext = (subtag + subtags.map((e) => "-" + e).join("")).toLowerCase();
            if (!this.format["singleton"]!.test(subtag)) {
              ext = `<Invalid extension: ${ext}>`;
              pyWarn(ext);
            }
          }
        } else {
          ext = (subtag + subtags.map((e) => "-" + e).join("")).toLowerCase();
          if (!this.format["singleton"]!.test(subtag)) {
            ext = `<Invalid extension: ${ext}>`;
            pyWarn(ext);
          }
        }
        lang["extension"] = ext;
        subtags.length = 0;
      }
    }
    return lang;
  }

  parseTag(tag: string): Record<string, string> { return this.parse_tag(tag); }

  name(tag: string): string | null {
    for (const label of ["redundant", "grandfathered"]) {
      let val: string | null = null;
      let note = "";
      if (this.db[label] && tag in this.db[label]!) {
        val = pyStr(this.db[label]![tag]!["Description"]);
        note = `The ${pyReprDeep(tag)} code is ${label}`;
      } else if (this.db["deprecated"]![label] && tag in this.db["deprecated"]![label]!) {
        const dep = this.db["deprecated"]![label]![tag]! as unknown as Record<string, string | string[]>;
        val = pyStr(dep["Description"]);
        note = `The ${pyReprDeep(tag)} code is ${label} and deprecated`;
        if ("Preferred-Value" in dep) {
          note += `, prefer ${pyReprDeep(this.val2str(dep["Preferred-Value"] as string | string[]))}`;
        }
      }
      if (val) {
        pyWarn(note);
        return val;
      }
    }
    try {
      return this.lang2str(this.parse_tag(tag));
    } catch (e) {
      if (e instanceof Error) pyWarn(`Tag ${pyReprDeep(tag)} was not recognized`);
      else throw e;
      return null;
    }
  }
}

// { crubadan

export class CrubadanCorpusReader extends CorpusReader {
  static _LANG_MAPPER_FILE = "table.txt";
  // NLTK quirk preserved: _all_lang_freq is a *class* attribute — the cache
  // is shared across all CrubadanCorpusReader instances.
  private static _all_lang_freq = new Map<string, FreqDist<string>>();

  private _lang_mapping_data: string[][] = [];

  constructor(root: string | PathPointer, fileids: string | string[], _encoding: EncodingSpec = "utf8", tagset: string | null = null) {
    void _encoding;
    void tagset;
    super(root, fileids, "utf8");
    this._lang_mapping_data = [];
    this._load_lang_mapping_data();
  }

  lang_freq(lang: string): FreqDist<string> {
    if (!CrubadanCorpusReader._all_lang_freq.has(lang)) {
      CrubadanCorpusReader._all_lang_freq.set(lang, this._load_lang_ngrams(lang));
    }
    return CrubadanCorpusReader._all_lang_freq.get(lang)!;
  }

  langFreq(lang: string): FreqDist<string> { return this.lang_freq(lang); }

  private _row(row: string[], i: number): string {
    if (i >= row.length) throw pyError("IndexError", "list index out of range");
    return row[i]!;
  }

  langs(): string[] {
    return this._lang_mapping_data.map((row) => this._row(row, 1));
  }

  iso_to_crubadan(lang: string): string | null {
    for (const i of this._lang_mapping_data) {
      if (this._row(i, 1).toLowerCase() === lang.toLowerCase()) return i[0]!;
    }
    return null;
  }

  isoToCrubadan(lang: string): string | null { return this.iso_to_crubadan(lang); }

  crubadan_to_iso(lang: string): string | null {
    for (const i of this._lang_mapping_data) {
      if (this._row(i, 0).toLowerCase() === lang.toLowerCase()) return i[1]!;
    }
    return null;
  }

  crubadanToIso(lang: string): string | null { return this.crubadan_to_iso(lang); }

  private _load_lang_mapping_data(): void {
    if (this.root instanceof ZipFilePathPointer) {
      throw pyError("RuntimeError", "Please install the 'crubadan' corpus first, use nltk.download()");
    }
    const rootPath = (this.root as FileSystemPathPointer).path;
    const mapper_file = pathJoin(rootPath, CrubadanCorpusReader._LANG_MAPPER_FILE);
    if (!this.fileids().includes(CrubadanCorpusReader._LANG_MAPPER_FILE)) {
      throw pyError("RuntimeError", `Could not find language mapper file: ${mapper_file}`);
    }
    const bytes = pathsec_open(mapper_file, "r", "CrubadanCorpusReader", (this.root as FileSystemPathPointer).path);
    const strip_raw = new TextDecoder("utf-8").decode(bytes).trim();
    this._lang_mapping_data = strip_raw.split("\n").map((row) => row.split("\t"));
  }

  private _load_lang_ngrams(lang: string): FreqDist<string> {
    if (!this.langs().includes(lang)) {
      throw pyError("RuntimeError", "Unsupported language.");
    }
    const rootPath = (this.root as FileSystemPathPointer).path;
    const crubadan_code = this.iso_to_crubadan(lang)!;
    const ngram_file = pathJoin(rootPath, crubadan_code + "-3grams.txt");
    if (!existsSync(ngram_file)) {
      throw pyError("RuntimeError", "No N-gram file found for requested language.");
    }
    const counts = new FreqDist<string>();
    const bytes = pathsec_open(ngram_file, "r", "CrubadanCorpusReader", (this.root as FileSystemPathPointer).path);
    const text = new TextDecoder("utf-8").decode(bytes);
    const lines = text.split("\n");
    // Python file iteration: a trailing newline yields no extra empty line,
    // but a blank line in the middle DOES and then crashes on data[1].
    if (lines.length && lines[lines.length - 1] === "") lines.pop();
    for (const line of lines) {
      const data = line.split(" ");
      if (data.length < 2) throw pyError("IndexError", "list index out of range");
      const ngram = data[1]!.replace(/^\n+|\n+$/g, "");
      const freq = pyInt(data[0]!);
      counts.set(ngram, freq);
    }
    return counts;
  }
}

// { shared python-behavior helpers

/** Python truthiness for the value kinds these readers produce. */
function pyTruthy(v: unknown): boolean {
  if (v === null || v === undefined || v === false) return false;
  if (v === true) return true;
  if (typeof v === "number") return v !== 0 && !Number.isNaN(v);
  if (typeof v === "string") return v.length > 0;
  if (v instanceof AttrDict || v instanceof Map) return v.size > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (v instanceof Future) return pyTruthy(v._data());
  if (v instanceof AbstractLazySequence) return v.length > 0;
  return true;
}

/** Python class name for error messages ('str', 'int', 'NoneType', ...). */
function pyTypeName(v: unknown): string {
  if (v === null || v === undefined) return "NoneType";
  if (typeof v === "string") return "str";
  if (typeof v === "boolean") return "bool";
  if (typeof v === "number") return Number.isInteger(v) ? "int" : "float";
  if (typeof v === "function") return "function";
  if (v instanceof AttrDict) return "AttrDict";
  if (v instanceof Future) return "Future";
  if (v instanceof SpecialList) return "SpecialList";
  if (v instanceof PrettyList) return "list";
  if (Array.isArray(v)) return "list";
  if (v instanceof Map) return "dict";
  if (v instanceof AbstractLazySequence) return "list";
  return (v as object).constructor?.name ?? "object";
}

/** Python len() for the value kinds used here. */
function pyLen(v: unknown): number {
  if (typeof v === "string" || Array.isArray(v)) return v.length;
  if (v instanceof AttrDict || v instanceof Map) return v.size;
  if (v instanceof Future) return pyLen(v._data());
  if (v instanceof AbstractLazySequence) return v.length;
  throw pyError("TypeError", `object of type '${pyTypeName(v)}' has no len()`);
}

/** dict.get(key, default) — returns the raw stored value (no Future
 * resolution, matching dict.get vs __getitem__). Non-dict objects raise the
 * Python AttributeError. */
function pyDictGet(obj: unknown, key: unknown, def: unknown): unknown {
  let o = obj;
  if (o instanceof Future) o = o._data();
  if (o instanceof AttrDict) return o._d.has(key) ? o._d.get(key) : def;
  if (o instanceof Map) return o.has(key) ? o.get(key) : def;
  if (o !== null && typeof o === "object" && !Array.isArray(o)) {
    const r = o as Record<string, unknown>;
    return Object.prototype.hasOwnProperty.call(r, String(key)) ? r[String(key)] : def;
  }
  throw pyError("AttributeError", `'${pyTypeName(o)}' object has no attribute 'get'`);
}

/** repr() of a Python tuple (for AssertionError args in assert statements);
 * nested arrays also print as tuples (parens, not list brackets). */
function pyReprTuple(v: unknown): string {
  if (Array.isArray(v)) {
    const inner = v.map(pyReprTuple).join(", ");
    return `(${inner}${v.length === 1 ? "," : ""})`;
  }
  return pyReprDeep(v);
}

/** Collect a mimicWrap generator's rows into arrays. */
function collectMimic(lines: string[], wrap_at = 65): string[][] {
  const out: string[][] = [];
  for (const row of mimicWrap(lines, wrap_at)) out.push(row);
  return out;
}

// { rte.norm

/** rte.norm — normalize an RTE ``value``/``entailment`` attribute to 1 or 0.
 * Unknown labels raise KeyError (the *uppercased* key). */
export function norm(value_string: string): number {
  const valdict: Record<string, number> = { TRUE: 1, FALSE: 0, YES: 1, NO: 0 };
  const key = value_string.toUpperCase();
  if (!(key in valdict)) throw pyError("KeyError", pyReprDeep(key));
  return valdict[key]!;
}

// { markdown helpers (nltk/corpus/reader/markdown.py)

/** markdown.comma_separated_string_args conversion for one argument:
 * a string becomes a set of its stripped comma-separated parts; a list
 * becomes a set of its elements; anything else passes through. */
function csArg<T>(v: T): T | Set<string> {
  if (typeof v === "string") return new Set(v.split(",").map((p) => p.trim()));
  if (Array.isArray(v)) return new Set(v as Iterable<string>);
  return v;
}

/** markdown.comma_separated_string_args — decorator: converts string args to
 * sets of stripped comma-separated parts and list args to sets. */
export function commaSeparatedStringArgs(
  func: (...args: unknown[]) => unknown,
): (...args: unknown[]) => unknown {
  return comma_separated_string_args(func);
}

export function comma_separated_string_args(
  func: (...args: unknown[]) => unknown,
): (...args: unknown[]) => unknown {
  return function (this: unknown, ...args: unknown[]) {
    return func.apply(this, args.map(csArg));
  };
}

/** markdown.read_parse_blankline_block — read a blankline block and render it
 * through the markdown parser, returning [rendered] or the empty list. */
export function readParseBlanklineBlock(stream: SeekableUnicodeStreamReader, parser: MiniMarkdownIt): string[] {
  return read_parse_blankline_block(stream, parser);
}

export function read_parse_blankline_block(stream: SeekableUnicodeStreamReader, parser: MiniMarkdownIt): string[] {
  const block = read_blankline_block(stream);
  if (block.length) return [parser.render(block[0]!)];
  return block;
}

// { mini markdown-it (commonmark subset) + mdit_plain RendererPlain

export class MdToken {
  type: string;
  attrs: Map<string, string> | null = null;
  map: [number, number] | null = null;
  level = 0;
  children: MdToken[] | null = null;
  content = "";
  markup = "";
  info = "";
  meta: unknown = null;
  block = false;
  hidden = false;
  constructor(type: string) { this.type = type; }
  attrGet(name: string): string | null {
    if (this.attrs === null) return null;
    const v = this.attrs.get(name);
    return v === undefined ? null : v;
  }
  attrJoin(name: string, join: string): string {
    if (this.attrs === null) return "";
    const v = this.attrs.get(name);
    return v === undefined ? "" : v.split(" ").join(join);
  }
}

interface RefDef { href: string; title: string | null; }

const MD_BULLET_RE = /^ {0,3}([-+*])(?:[ \t]+(.*)|[ \t]*)$/;
const MD_ORDERED_RE = /^ {0,3}(\d{1,9})([.)])(?:[ \t]+(.*)|[ \t]*)$/;
const MD_ATX_RE = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/;
const MD_FENCE_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const MD_BQ_RE = /^ {0,3}> ?/;
const MD_SETEXT1 = /^ {0,3}=+[ \t]*$/;
const MD_SETEXT2 = /^ {0,3}-+[ \t]*$/;
const MD_HR_RE = /^ {0,3}(?:(\*[ \t]*){3,}|(_[ \t]*){3,}|(-[ \t]*){3,})$/;
const MD_REFDEF_RE = /^ {0,3}\[([^\]]+)\]:[ \t]*(<[^<>\n]*>|\S+)(?:[ \t]+("[^"\n]*"|'[^'\n]*'|\([^()\n]*\)))?[ \t]*$/;

const MD_HTML_TAGS = new Set(
  ("address article aside base basefont blockquote body caption center col colgroup dd details dialog dir div dl dt fieldset figcaption figure footer form frame frameset h1 h2 h3 h4 h5 h6 head header hr html iframe legend li link main menu menuitem nav noframes ol optgroup option p param search section summary table tbody td tfoot th thead title tr track ul").split(" "),
);

/** Starts a block-level construct at this line (used to end paragraphs/items). */
function mdStartsBlock(line: string, level: number): boolean {
  if (/^\s*$/.test(line)) return true;
  if (MD_FENCE_RE.test(line)) return true;
  if (MD_ATX_RE.test(line)) return true;
  if (MD_HR_RE.test(line)) return true;
  if (MD_BQ_RE.test(line)) return true;
  if (MD_BULLET_RE.test(line) || MD_ORDERED_RE.test(line)) return true;
  if (mdHtmlBlockEnd(line) === "start") return true;
  void level;
  return false;
}

/** Returns "start" if the line begins an html block per the commonmark
 * conditions we support; otherwise null. */
function mdHtmlBlockEnd(line: string): "start" | null {
  if (/^ {0,3}<!--/.test(line)) return "start";
  if (/^ {0,3}<\?/.test(line)) return "start";
  if (/^ {0,3}<![A-Za-z]/.test(line)) return "start";
  if (/^ {0,3}<!\[CDATA\[/.test(line)) return "start";
  const m = /^ {0,3}<\/?([A-Za-z][A-Za-z0-9-]*)/.exec(line);
  if (m && MD_HTML_TAGS.has(m[1]!.toLowerCase())) return "start";
  if (/^ {0,3}<(script|pre|style|textarea)(?:\s|>|$)/i.test(line)) return "start";
  return null;
}

/** Collect an html block starting at line i. Returns [token, nextI]. */
function mdHtmlBlock(lines: string[], i: number, e: number, level: number): [MdToken, number] {
  const line = lines[i]!;
  let endRe: RegExp | null = null;
  let untilBlank = false;
  if (/^ {0,3}<!--/.test(line)) endRe = /-->/;
  else if (/^ {0,3}<\?/.test(line)) endRe = /\?>/;
  else if (/^ {0,3}<!\[CDATA\[/.test(line)) endRe = /\]\]>/;
  else if (/^ {0,3}<![A-Za-z]/.test(line)) endRe = />/;
  else {
    const m = /^ {0,3}<(script|pre|style|textarea)(?:\s|>|$)/i.exec(line);
    if (m) endRe = new RegExp(`</${m[1]!.toLowerCase()}\\s*>`, "i");
    else untilBlank = true;
  }
  const body: string[] = [];
  let j = i;
  if (untilBlank) {
    while (j < e && !/^\s*$/.test(lines[j]!)) { body.push(lines[j]!); j++; }
  } else {
    while (j < e) {
      body.push(lines[j]!);
      if (endRe!.test(lines[j]!)) { j++; break; }
      j++;
    }
  }
  const t = new MdToken("html_block");
  t.block = true;
  t.level = level;
  t.content = body.join("\n") + (body.length ? "\n" : "");
  t.map = [i, j];
  return [t, j];
}

/** Parse block-level tokens for lines[s..e). refs collects link reference
 * definitions. level is the nesting depth (top-level = 0). */
function mdParseBlocks(lines: string[], s: number, e: number, level: number, refs: Map<string, RefDef>, docStart: boolean): MdToken[] {
  const out: MdToken[] = [];
  let i = s;
  while (i < e) {
    const line = lines[i]!;
    if (/^\s*$/.test(line)) { i++; continue; }

    // front_matter plugin: --- at absolute doc start only.
    if (docStart && i === 0 && level === 0 && /^-{3,}/.test(line)) {
      const markerCount = /^-+/.exec(line)![0].length;
      let found = -1;
      for (let j = i + 1; j < e; j++) {
        const l2 = lines[j]!;
        if (/^\s*$/.test(l2)) continue;
        if (/^\.{3,}\s*$/.test(l2)) { found = j; break; }
        const dm = /^-+/.exec(l2);
        if (dm && dm[0].length >= markerCount && /^\s*$/.test(l2.slice(dm[0].length))) { found = j; break; }
      }
      if (found >= 0) {
        const t = new MdToken("front_matter");
        t.hidden = true;
        t.block = true;
        t.level = level;
        t.markup = "---";
        t.content = lines.slice(i + 1, found).join("\n");
        t.map = [i, found + 1];
        out.push(t);
        i = found + 1;
        continue;
      }
      // unclosed → falls through to normal rules (hr etc.)
    }

    // fenced code
    const fm = MD_FENCE_RE.exec(line);
    if (fm && (fm[1]![0] === "~" || !fm[2]!.includes("`"))) {
      const fenceCh = fm[1]![0]!;
      const fenceLen = fm[1]!.length;
      const info = fm[2]!.trim();
      const body: string[] = [];
      let j = i + 1;
      for (; j < e; j++) {
        const cm = new RegExp(`^ {0,3}\\${fenceCh}{${fenceLen},}[ \\t]*$`).exec(lines[j]!);
        if (cm) break;
        body.push(lines[j]!);
      }
      const t = new MdToken("fence");
      t.block = true;
      t.level = level;
      t.markup = fm[1]!;
      t.info = info;
      t.content = body.join("\n") + (body.length ? "\n" : "");
      t.map = [i, Math.min(j + 1, e)];
      out.push(t);
      i = j < e ? j + 1 : e;
      continue;
    }

    // indented code block (4+ spaces)
    if (/^(?: {4}| {0,3}\t)/.test(line)) {
      const body: string[] = [];
      let j = i;
      while (j < e) {
        if (/^(?: {4}| {0,3}\t)/.test(lines[j]!)) {
          body.push(lines[j]!.replace(/^(?: {4}| {0,3}\t)/, ""));
          j++;
        } else if (/^\s*$/.test(lines[j]!)) {
          // blank inside code block — include tentatively
          body.push("");
          j++;
        } else break;
      }
      while (body.length && body[body.length - 1] === "") body.pop();
      const t = new MdToken("code_block");
      t.block = true;
      t.level = level;
      t.markup = "";
      t.content = body.join("\n") + (body.length ? "\n" : "");
      t.map = [i, j];
      out.push(t);
      i = j;
      continue;
    }

    // ATX heading
    const am = MD_ATX_RE.exec(line);
    if (am) {
      const open = new MdToken("heading_open");
      open.block = true; open.level = level; open.markup = am[1]!;
      let text = (am[2] ?? "").replace(/[ \t]+#+[ \t]*$/, "").trim();
      const inline = new MdToken("inline");
      inline.level = level + 1;
      inline.content = text;
      inline.children = mdParseInline(text, refs, level + 1);
      const close = new MdToken("heading_close");
      close.block = true; close.level = level; close.markup = am[1]!;
      out.push(open, inline, close);
      i++;
      continue;
    }

    // thematic break
    if (MD_HR_RE.test(line)) {
      const t = new MdToken("hr");
      t.block = true; t.level = level;
      t.markup = line.trim()[0]!.repeat(3);
      t.map = [i, i + 1];
      out.push(t);
      i++;
      continue;
    }

    // blockquote
    if (MD_BQ_RE.test(line)) {
      const inner: string[] = [];
      let j = i;
      while (j < e) {
        if (MD_BQ_RE.test(lines[j]!)) { inner.push(lines[j]!.replace(MD_BQ_RE, "")); j++; continue; }
        // lazy continuation: non-blank line that doesn't start a new block
        if (!/^\s*$/.test(lines[j]!) && inner.length && !mdStartsBlock(lines[j]!, level)) {
          inner.push(lines[j]!);
          j++;
          continue;
        }
        break;
      }
      const open = new MdToken("blockquote_open");
      open.block = true; open.level = level; open.markup = ">";
      const close = new MdToken("blockquote_close");
      close.block = true; close.level = level; close.markup = ">";
      out.push(open);
      out.push(...mdParseBlocks(inner, 0, inner.length, level + 1, refs, false));
      out.push(close);
      i = j;
      continue;
    }

    // html block
    if (mdHtmlBlockEnd(line) === "start") {
      const [tok, nj] = mdHtmlBlock(lines, i, e, level);
      out.push(tok);
      i = nj;
      continue;
    }

    // list
    const bm = MD_BULLET_RE.exec(line);
    const om = bm ? null : MD_ORDERED_RE.exec(line);
    if (bm || om) {
      const ordered = om !== null;
      const marker = bm ? bm[1]! : `${om![1]}${om![2]}`;
      const openType = ordered ? "ordered_list_open" : "bullet_list_open";
      const closeType = ordered ? "ordered_list_close" : "bullet_list_close";
      const open = new MdToken(openType);
      open.block = true; open.level = level; open.markup = marker;
      if (ordered && om![1] !== "1") { open.attrs = new Map([["start", om![1]!]]); }
      open.map = [i, -1];
      out.push(open);
      // parse items: marker column = leading ws + marker + following ws
      interface Item { inner: string[]; }
      const items: Item[] = [];
      let loose = false;
      let j = i;
      let endedByBlank = false;
      while (j < e) {
        const il = lines[j]!;
        const ib = MD_BULLET_RE.exec(il);
        const io = ib ? null : MD_ORDERED_RE.exec(il);
        if (!(ib || io) || Boolean(io) !== ordered) break;
        const markerRe = ordered ? /^ {0,3}(\d{1,9}[.)])([ \t]*)/ : /^ {0,3}([-+*])([ \t]*)/;
        const contentIndent = markerRe.exec(il)![0].length;
        const first = ordered ? (io![3] ?? "") : (ib![2] ?? "");
        const inner: string[] = [first];
        let hasBlank = false;
        j++;
        while (j < e) {
          const nl = lines[j]!;
          if (/^\s*$/.test(nl)) {
            // blank — lookahead: list-item of our type → item boundary; an
            // indented line → continues this item; anything else → list ends
            let k = j + 1;
            while (k < e && /^\s*$/.test(lines[k]!)) k++;
            if (k >= e) { j = k; endedByBlank = true; break; }
            const kb = MD_BULLET_RE.exec(lines[k]!);
            const ko = kb ? null : MD_ORDERED_RE.exec(lines[k]!);
            if ((kb || ko) && Boolean(ko) === ordered) { hasBlank = true; j = k; break; }
            if (/^ */.exec(lines[k]!)![0].length >= contentIndent) { hasBlank = true; inner.push(""); j++; continue; }
            j = k; endedByBlank = true; break;
          }
          const jb = MD_BULLET_RE.exec(nl);
          const jo = jb ? null : MD_ORDERED_RE.exec(nl);
          if ((jb || jo) && Boolean(jo) === ordered) break;
          const ind = /^ */.exec(nl)![0].length;
          if (ind >= contentIndent) { inner.push(nl.slice(contentIndent)); j++; continue; }
          break;
        }
        if (hasBlank) loose = true;
        items.push({ inner });
        if (endedByBlank) break;
      }
      void loose;
      const tight = !loose;
      for (const it of items) {
        const io2 = new MdToken("list_item_open");
        io2.block = true; io2.level = level; io2.markup = marker;
        out.push(io2);
        const innerTokens = mdParseBlocks(it.inner, 0, it.inner.length, level + 1, refs, false);
        for (const t of innerTokens) {
          if ((t.type === "paragraph_open" || t.type === "paragraph_close") && tight) t.hidden = true;
        }
        out.push(...innerTokens);
        const ic = new MdToken("list_item_close");
        ic.block = true; ic.level = level; ic.markup = marker;
        out.push(ic);
      }
      i = j;
      const close = new MdToken(closeType);
      close.block = true; close.level = level; close.markup = marker;
      out.push(close);
      i = j;
      continue;
    }

    // paragraph (possibly containing refdefs; possibly becoming setext heading)
    const paraLines: string[] = [];
    let j = i;
    let isSetext: string | null = null;
    while (j < e) {
      const nl = lines[j]!;
      if (/^\s*$/.test(nl)) break;
      if (paraLines.length > 0 && mdStartsBlock(nl, level)) {
        // setext underline → heading instead of paragraph
        if (MD_SETEXT1.test(nl)) { isSetext = "="; j++; }
        else if (MD_SETEXT2.test(nl)) { isSetext = "-"; j++; }
        break;
      }
      if (paraLines.length > 0 && (MD_SETEXT1.test(nl) || MD_SETEXT2.test(nl))) {
        isSetext = nl.trim()[0]!; j++; break;
      }
      paraLines.push(nl);
      j++;
      // refdef lines may sit inside/after; handle at emit
    }
    // extract leading refdefs from the collected paragraph lines
    while (paraLines.length) {
      const rm = MD_REFDEF_RE.exec(paraLines[0]!);
      if (!rm) break;
      const label = rm[1]!.toLowerCase().replace(/\s+/g, " ").trim();
      let href = rm[2]!;
      if (href.startsWith("<") && href.endsWith(">")) href = href.slice(1, -1);
      let title: string | null = rm[3] ?? null;
      if (title !== null) title = title.slice(1, -1);
      refs.set(label, { href, title });
      paraLines.shift();
    }
    // trailing refdefs too (paragraph text ends when a refdef starts)
    while (paraLines.length) {
      const last = paraLines[paraLines.length - 1]!;
      const rm = MD_REFDEF_RE.exec(last);
      if (!rm) break;
      const label = rm[1]!.toLowerCase().replace(/\s+/g, " ").trim();
      let href = rm[2]!;
      if (href.startsWith("<") && href.endsWith(">")) href = href.slice(1, -1);
      let title: string | null = rm[3] ?? null;
      if (title !== null) title = title.slice(1, -1);
      refs.set(label, { href, title });
      paraLines.pop();
    }
    if (isSetext !== null) {
      const text = paraLines.join("\n").trim();
      const open = new MdToken("heading_open");
      open.block = true; open.level = level; open.markup = isSetext;
      const inline = new MdToken("inline");
      inline.level = level + 1; inline.content = text;
      inline.children = mdParseInline(text, refs, level + 1);
      const close = new MdToken("heading_close");
      close.block = true; close.level = level; close.markup = isSetext;
      out.push(open, inline, close);
    } else if (paraLines.length) {
      const text = paraLines.join("\n");
      const open = new MdToken("paragraph_open");
      open.block = true; open.level = level;
      const inline = new MdToken("inline");
      inline.level = level + 1; inline.content = text;
      inline.children = mdParseInline(text, refs, level + 1);
      const close = new MdToken("paragraph_close");
      close.block = true; close.level = level;
      out.push(open, inline, close);
    }
    i = j;
  }
  return out;
}

const MD_ENTITY_MAP: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", copy: "©", reg: "®", trade: "™", hellip: "…", mdash: "—", ndash: "–", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", laquo: "«", raquo: "»", times: "×", divide: "÷", deg: "°", plusmn: "±", middot: "·", bull: "•", dagger: "†", Dagger: "‡", permil: "‰", prime: "′", Prime: "″", euro: "€", pound: "£", yen: "¥", cent: "¢", sect: "§", para: "¶", micro: "µ",
};

function mdDecodeEntity(body: string): string | null {
  if (body[0] === "#") {
    const cp = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
    return Number.isNaN(cp) ? null : String.fromCodePoint(cp);
  }
  return MD_ENTITY_MAP[body] ?? null;
}

const MD_PUNCT = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;

/** Parse inline text into child tokens (links/images/emphasis/code/breaks). */
function mdParseInline(src: string, refs: Map<string, RefDef>, level: number): MdToken[] {
  const tokens: MdToken[] = [];
  const pushText = (content: string) => {
    if (!content) return;
    const last = tokens[tokens.length - 1];
    if (last && last.type === "text" && last.children === null) last.content += content;
    else { const t = new MdToken("text"); t.level = level; t.content = content; tokens.push(t); }
  };
  const isAlnum = (ch: string | undefined) => ch !== undefined && /[A-Za-z0-9]/.test(ch);

  // find the closing ] for a label opened at src[openI]==='['
  const findLabelEnd = (openI: number): number => {
    let depth = 1;
    for (let j = openI + 1; j < src.length; j++) {
      const ch = src[j]!;
      if (ch === "\\") { j++; continue; }
      if (ch === "[") depth++;
      else if (ch === "]") { depth--; if (depth === 0) return j; }
    }
    return -1;
  };
  // parse "(dest [title])" starting at i (src[i]==='('). returns [href,title,end] or null
  const parseInlineDest = (i: number): [string, string | null, number] | null => {
    let j = i + 1;
    while (j < src.length && /\s/.test(src[j]!)) j++;
    if (j >= src.length) return null;
    let href = "";
    if (src[j] === "<") {
      const close = src.indexOf(">", j + 1);
      if (close < 0) return null;
      href = src.slice(j + 1, close);
      j = close + 1;
    } else {
      const start = j;
      let depth = 0;
      while (j < src.length) {
        const ch = src[j]!;
        if (ch === "\\") { j += 2; continue; }
        if (ch === "(") depth++;
        else if (ch === ")") { if (depth === 0) break; depth--; }
        else if (/\s/.test(ch) && depth === 0) break;
        j++;
      }
      href = src.slice(start, j);
    }
    while (j < src.length && /\s/.test(src[j]!)) j++;
    let title: string | null = null;
    if (j < src.length && (src[j] === '"' || src[j] === "'" || src[j] === "(")) {
      const qc = src[j]!;
      const qcEnd = qc === "(" ? ")" : qc;
      const close = src.indexOf(qcEnd, j + 1);
      if (close < 0) return null;
      title = src.slice(j + 1, close);
      j = close + 1;
      while (j < src.length && /\s/.test(src[j]!)) j++;
    }
    if (j < src.length && src[j] === ")") return [href, title, j + 1];
    return null;
  };
  const normRef = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

  let i = 0;
  while (i < src.length) {
    const c = src[i]!;

    if (c === "\n") {
      // hardbreak: backslash-newline or two+ trailing spaces
      if (i > 0 && src[i - 1] === "\\") {
        const last = tokens[tokens.length - 1];
        if (last && last.type === "text" && last.content.endsWith("\\")) {
          last.content = last.content.slice(0, -1);
          if (!last.content) tokens.pop();
        }
        const t = new MdToken("hardbreak"); t.level = level; tokens.push(t); i++;
        continue;
      }
      const last = tokens[tokens.length - 1];
      if (last && last.type === "text" && / {2,}$/.test(last.content)) {
        last.content = last.content.replace(/ {2,}$/, "");
        if (!last.content) tokens.pop();
        const t = new MdToken("hardbreak"); t.level = level; tokens.push(t); i++;
        continue;
      }
      const t = new MdToken("softbreak"); t.level = level; tokens.push(t); i++;
      continue;
    }

    if (c === "\\" && i + 1 < src.length && MD_PUNCT.test(src[i + 1]!)) {
      pushText(src[i + 1]!); i += 2; continue;
    }
    if (c === "\\") { pushText("\\"); i++; continue; }

    if (c === "`") {
      let run = 0;
      while (src[i + run] === "`") run++;
      const closer = src.indexOf("`".repeat(run), i + run);
      if (closer >= 0) {
        let code = src.slice(i + run, closer).replace(/\n/g, " ");
        if (code.length >= 2 && code.startsWith(" ") && code.endsWith(" ") && code.trim() !== "") code = code.slice(1, -1);
        const t = new MdToken("code_inline"); t.level = level; t.content = code; t.markup = "`".repeat(run);
        tokens.push(t);
        i = closer + run;
        continue;
      }
      pushText("`".repeat(run)); i += run; continue;
    }

    if (c === "&") {
      const em = /^&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/.exec(src.slice(i));
      if (em) {
        const decoded = mdDecodeEntity(em[1]!);
        if (decoded !== null) { pushText(decoded); i += em[0].length; continue; }
      }
      pushText("&"); i++; continue;
    }

    if (c === "<") {
      const am = /^<([a-zA-Z][a-zA-Z0-9+.-]{1,31}:[^<>\s]*)>/.exec(src.slice(i));
      const mm = /^<([A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*)>/.exec(src.slice(i));
      if (am) {
        const open = new MdToken("link_open");
        open.level = level; open.markup = "autolink";
        open.attrs = new Map([["href", am[1]!]]);
        const text = new MdToken("text"); text.level = level + 1; text.content = am[1]!;
        const close = new MdToken("link_close"); close.level = level; close.markup = "autolink";
        tokens.push(open, text, close);
        i += am[0].length; continue;
      }
      if (mm) {
        const open = new MdToken("link_open");
        open.level = level; open.markup = "autolink";
        open.attrs = new Map([["href", `mailto:${mm[1]!}`]]);
        const text = new MdToken("text"); text.level = level + 1; text.content = mm[1]!;
        const close = new MdToken("link_close"); close.level = level; close.markup = "autolink";
        tokens.push(open, text, close);
        i += mm[0].length; continue;
      }
      const hm = /^<\/?[A-Za-z][^>\n]*>|^<!--[\s\S]*?-->|^<\?[^>\n]*\?>|^<![A-Z][^>\n]*>|^<!\[CDATA\[[\s\S]*?\]\]>/.exec(src.slice(i));
      if (hm) {
        const t = new MdToken("html_inline"); t.level = level; t.content = hm[0]; tokens.push(t);
        i += hm[0].length; continue;
      }
      pushText("<"); i++; continue;
    }

    if (c === "!" && src[i + 1] === "[") {
      const close = findLabelEnd(i + 1);
      if (close >= 0) {
        const label = src.slice(i + 2, close);
        let j = close + 1;
        let href: string | null = null;
        let title: string | null = null;
        let ok = false;
        if (src[j] === "(") {
          const d = parseInlineDest(j);
          if (d) { [href, title, j] = [d[0], d[1], d[2]]; ok = true; }
        } else if (src[j] === "[") {
          const c2 = src.indexOf("]", j + 1);
          if (c2 >= 0) {
            const ref = src.slice(j + 1, c2) || label;
            const def = refs.get(normRef(ref));
            if (def) { href = def.href; title = def.title; j = c2 + 1; ok = true; }
          }
        } else {
          const def = refs.get(normRef(label));
          if (def) { href = def.href; title = def.title; ok = true; }
        }
        if (ok) {
          const t = new MdToken("image");
          t.level = level;
          t.attrs = new Map<string, string>([["src", href!]]);
          if (title !== null) t.attrs.set("title", title);
          t.content = label;
          t.children = mdParseInline(label, refs, level + 1);
          tokens.push(t);
          i = j;
          continue;
        }
      }
      pushText("!"); i++; continue;
    }

    if (c === "[") {
      const close = findLabelEnd(i);
      if (close >= 0) {
        const label = src.slice(i + 1, close);
        let j = close + 1;
        let href: string | null = null;
        let title: string | null = null;
        let ok = false;
        if (src[j] === "(") {
          const d = parseInlineDest(j);
          if (d) { [href, title, j] = [d[0], d[1], d[2]]; ok = true; }
        } else if (src[j] === "[") {
          const c2 = src.indexOf("]", j + 1);
          if (c2 >= 0) {
            const ref = src.slice(j + 1, c2) || label;
            const def = refs.get(normRef(ref));
            if (def) { href = def.href; title = def.title; j = c2 + 1; ok = true; }
          }
        } else {
          const def = refs.get(normRef(label));
          if (def) { href = def.href; title = def.title; ok = true; }
        }
        if (ok) {
          const open = new MdToken("link_open");
          open.level = level; open.markup = "linkify";
          open.attrs = new Map<string, string>([["href", href!]]);
          if (title !== null) open.attrs.set("title", title);
          const close2 = new MdToken("link_close");
          close2.level = level; close2.markup = "linkify";
          tokens.push(open, ...mdParseInline(label, refs, level + 1), close2);
          i = j;
          continue;
        }
      }
      pushText("["); i++; continue;
    }

    if (c === "*" || c === "_") {
      let run = 0;
      while (src[i + run] === c) run++;
      // underscores cannot open inside a word
      if (c === "_" && isAlnum(src[i - 1])) { pushText(c.repeat(run)); i += run; continue; }
      let handled = false;
      if (run >= 2) {
        const close = src.indexOf(c + c, i + 2);
        if (close > i + 2) {
          if (c !== "_" || !isAlnum(src[close + 2])) {
            const open = new MdToken("strong_open"); open.level = level; open.markup = c + c;
            const closeT = new MdToken("strong_close"); closeT.level = level; closeT.markup = c + c;
            tokens.push(open, ...mdParseInline(src.slice(i + 2, close), refs, level + 1), closeT);
            i = close + 2; handled = true;
          }
        }
      }
      if (!handled && run >= 1) {
        // single emphasis: find the closing single delim not part of a pair
        let j = i + 1;
        while (j < src.length) {
          if (src[j] === c && src[j - 1] !== "\\") {
            if (c === "_" && isAlnum(src[j + 1])) { j++; continue; }
            break;
          }
          j++;
        }
        if (j < src.length && j > i + 1) {
          const open = new MdToken("em_open"); open.level = level; open.markup = c;
          const closeT = new MdToken("em_close"); closeT.level = level; closeT.markup = c;
          tokens.push(open, ...mdParseInline(src.slice(i + 1, j), refs, level + 1), closeT);
          i = j + 1; handled = true;
        }
      }
      if (!handled) { pushText(c.repeat(run)); i += run; }
      continue;
    }

    // plain text run
    let j = i;
    while (j < src.length && !/[\n\\`&<!*_[\]]/.test(src[j]!)) j++;
    pushText(src.slice(i, j));
    i = j;
  }
  return tokens;
}

/** mdit_plain HTMLTextRenderer — collect all data nodes, decode entities. */
function mdHtmlToText(html: string): string {
  const noComments = html.replace(/<!--[\s\S]*?-->/g, "");
  const noTags = noComments.replace(/<[^>]*>/g, "");
  return xmlUnescape(noTags);
}

/** mdit_plain.renderer.RendererPlain — renders tokens to plain text. */
export class RendererPlain {
  static __output__ = "plain";
  private readonly rules: Record<string, (tokens: MdToken[], i: number) => string>;

  constructor() {
    this.rules = {
      bullet_list_close: (tokens, i) =>
        i + 1 === tokens.length || tokens[i + 1]!.type.includes("list") ? "" : "\n",
      code_block: (tokens, i) => `\n${tokens[i]!.content}\n`,
      code_inline: (tokens, i) => tokens[i]!.content,
      fence: (tokens, i) => `\n${tokens[i]!.content}\n`,
      hardbreak: () => "\n",
      heading_close: () => "\n",
      heading_open: () => "\n",
      html_block: (tokens, i) => mdHtmlToText(tokens[i]!.content),
      list_item_open: (tokens, i) => {
        const nt = tokens[i + 1];
        if (nt === undefined) throw pyError("IndexError", "list index out of range");
        return !nt.hidden ? "" : "\n";
      },
      ordered_list_close: (tokens, i) =>
        i + 1 === tokens.length || tokens[i + 1]!.type.includes("list") ? "" : "\n",
      paragraph_close: (tokens, i) => (tokens[i]!.hidden ? "" : "\n"),
      paragraph_open: (tokens, i) => (tokens[i]!.hidden ? "" : "\n"),
      softbreak: () => "\n",
      text: (tokens, i) => tokens[i]!.content,
    };
  }

  render(tokens: MdToken[] | null | undefined, _options: unknown, _env: unknown): string {
    if (tokens === null || tokens === undefined) return "";
    let result = "";
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i]!;
      const rule = this.rules[t.type] ?? (() => "");
      result += rule(tokens, i);
      if (t.children !== null) result += this.render(t.children, _options, _env);
    }
    return result.trim();
  }
}

/** MarkdownIt("commonmark", renderer_cls=RendererPlain) + front_matter —
 * the subset NLTK's markdown reader exercises. */
export class MiniMarkdownIt {
  renderer = new RendererPlain();
  options: Record<string, unknown> = {};

  parse(src: string, _env?: unknown): MdToken[] {
    void _env;
    const norm = src.replace(/\0/g, "�").replace(/\r\n?/g, "\n");
    const lines = norm.split("\n");
    const refs = new Map<string, RefDef>();
    return mdParseBlocks(lines, 0, lines.length, 0, refs, true);
  }

  render(src: string, env?: unknown): string {
    return this.renderer.render(this.parse(src, env), this.options, env ?? null);
  }
}

// { yaml.safe_load subset — block maps/sequences, flow collections, scalars

function yamlScalar(s: string): unknown {
  const t = s.trim();
  if (t === "" || t === "~" || /^null$/i.test(t)) return null;
  if (/^(?:true|yes|on)$/i.test(t)) return true;
  if (/^(?:false|no|off)$/i.test(t)) return false;
  if (/^[+-]?\d+$/.test(t)) return parseInt(t, 10);
  if (/^[+-]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?$/.test(t) && /[.eE]/.test(t)) return parseFloat(t);
  if (t === ".inf" || t === "+.inf") return Infinity;
  if (t === "-.inf") return -Infinity;
  if (t === ".nan") return NaN;
  if (t.startsWith('"') && t.endsWith('"') && t.length >= 2) {
    return t.slice(1, -1).replace(/\\(["\\/bfnrt]|u[0-9a-fA-F]{4})/g, (_m, esc: string) => {
      const map: Record<string, string> = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };
      if (esc in map) return map[esc]!;
      return String.fromCodePoint(parseInt(esc.slice(1), 16));
    });
  }
  if (t.startsWith("'") && t.endsWith("'") && t.length >= 2) return t.slice(1, -1).replace(/''/g, "'");
  if (t.startsWith("[") && t.endsWith("]")) {
    const inner = t.slice(1, -1).trim();
    if (!inner) return [];
    return yamlFlowSplit(inner).map(yamlScalar);
  }
  if (t.startsWith("{") && t.endsWith("}")) {
    const inner = t.slice(1, -1).trim();
    const out: Record<string, unknown> = {};
    if (!inner) return out;
    for (const part of yamlFlowSplit(inner)) {
      const ci = yamlColonIndex(part);
      if (ci < 0) { out[part.trim()] = null; continue; }
      out[String(yamlScalar(part.slice(0, ci)))] = yamlScalar(part.slice(ci + 1));
    }
    return out;
  }
  return t;
}

/** Split a flow collection body on top-level commas. */
function yamlFlowSplit(s: string): string[] {
  const parts: string[] = [];
  let depth = 0, inS = false, inD = false, cur = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (inD) { cur += ch; if (ch === '"' && s[i - 1] !== "\\") inD = false; continue; }
    if (inS) { cur += ch; if (ch === "'") inS = false; continue; }
    if (ch === '"') { inD = true; cur += ch; continue; }
    if (ch === "'") { inS = true; cur += ch; continue; }
    if (ch === "[" || ch === "{") depth++;
    if (ch === "]" || ch === "}") depth--;
    if (ch === "," && depth === 0) { parts.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim() !== "" || parts.length) parts.push(cur);
  return parts;
}

/** Index of the ": " separating a mapping key from its value, at top level. */
function yamlColonIndex(s: string): number {
  let depth = 0, inS = false, inD = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (inD) { if (ch === '"' && s[i - 1] !== "\\") inD = false; continue; }
    if (inS) { if (ch === "'") inS = false; continue; }
    if (ch === '"') { inD = true; continue; }
    if (ch === "'") { inS = true; continue; }
    if (ch === "[" || ch === "{") depth++;
    if (ch === "]" || ch === "}") depth--;
    if (ch === ":" && depth === 0 && (i + 1 >= s.length || /\s/.test(s[i + 1]!))) return i;
  }
  return -1;
}

/** yaml.safe_load — subset covering front-matter documents. */
export function yamlSafeLoad(src: string): unknown {
  const rawLines = src.replace(/\r\n?/g, "\n").split("\n");
  // strip comments (outside quotes) and record indents
  interface YLine { indent: number; text: string; }
  const lines: YLine[] = [];
  for (const raw of rawLines) {
    let inS = false, inD = false, cut = raw.length;
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i]!;
      if (inD) { if (ch === '"' && raw[i - 1] !== "\\") inD = false; continue; }
      if (inS) { if (ch === "'") inS = false; continue; }
      if (ch === '"') { inD = true; continue; }
      if (ch === "'") { inS = true; continue; }
      if (ch === "#" && (i === 0 || /\s/.test(raw[i - 1]!))) { cut = i; break; }
    }
    const line = raw.slice(0, cut);
    if (/^\s*$/.test(line)) continue;
    const indent = /^ */.exec(line)![0].length;
    lines.push({ indent, text: line.slice(indent) });
  }
  if (!lines.length) return null;
  const parse = (start: number, indent: number): [unknown, number] => {
    // sequence?
    if (lines[start]!.text.startsWith("- ") || lines[start]!.text === "-") {
      const seq: unknown[] = [];
      let i = start;
      while (i < lines.length && lines[i]!.indent === indent && (lines[i]!.text.startsWith("- ") || lines[i]!.text === "-")) {
        const rest = lines[i]!.text === "-" ? "" : lines[i]!.text.slice(2);
        if (rest === "") {
          // nested block on following lines
          if (i + 1 < lines.length && lines[i + 1]!.indent > indent) {
            const [v, ni] = parse(i + 1, lines[i + 1]!.indent);
            seq.push(v); i = ni;
          } else { seq.push(null); i++; }
        } else if (yamlColonIndex(rest) >= 0) {
          // inline map start "- key: val"
          const map: Record<string, unknown> = {};
          const ci = yamlColonIndex(rest);
          const k = String(yamlScalar(rest.slice(0, ci)));
          const v = rest.slice(ci + 1).trim();
          map[k] = v === "" ? null : yamlScalar(v);
          i++;
          // deeper-indented continuation of the same map
          while (i < lines.length && lines[i]!.indent > indent) {
            const l = lines[i]!;
            const ci2 = yamlColonIndex(l.text);
            if (ci2 >= 0) {
              map[String(yamlScalar(l.text.slice(0, ci2)))] = l.text.slice(ci2 + 1).trim() === "" ? null : yamlScalar(l.text.slice(ci2 + 1));
            }
            i++;
          }
          seq.push(map);
        } else {
          seq.push(yamlScalar(rest));
          i++;
        }
      }
      return [seq, i];
    }
    // mapping?
    if (yamlColonIndex(lines[start]!.text) >= 0) {
      const map: Record<string, unknown> = {};
      let i = start;
      while (i < lines.length && lines[i]!.indent === indent) {
        const l = lines[i]!;
        const ci = yamlColonIndex(l.text);
        if (ci < 0) break;
        const k = String(yamlScalar(l.text.slice(0, ci)));
        const v = l.text.slice(ci + 1).trim();
        if (v !== "") { map[k] = yamlScalar(v); i++; continue; }
        // value on deeper-indented block (or null)
        if (i + 1 < lines.length && lines[i + 1]!.indent > indent) {
          const [vv, ni] = parse(i + 1, lines[i + 1]!.indent);
          map[k] = vv; i = ni;
        } else if (i + 1 < lines.length && lines[i + 1]!.indent === indent && (lines[i + 1]!.text.startsWith("- ") || lines[i + 1]!.text === "-")) {
          // sequence at the same indent as the key
          const [vv, ni] = parse(i + 1, indent);
          map[k] = vv; i = ni;
        } else { map[k] = null; i++; }
      }
      return [map, i];
    }
    // plain scalar (join continuation lines with a space)
    let i = start;
    let text = lines[i]!.text;
    i++;
    while (i < lines.length && lines[i]!.indent > indent) { text += " " + lines[i]!.text.trim(); i++; }
    return [yamlScalar(text), i];
  };
  const [v] = parse(0, lines[0]!.indent);
  return v;
}


// { markdown block/value classes (nltk/corpus/reader/markdown.py)

/** Python str.splitlines() — splits on all Unicode line boundaries; a
 * trailing line boundary does NOT produce an empty final element. */
function pySplitlines(s: string): string[] {
  const lines = s.split(/\r\n|\r|\n|\v|\f|\x85|\u2028|\u2029/);
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** markdown.MarkdownBlock — base rendered-block value. */
export class MarkdownBlock {
  content: string;
  truncate_at = 16;
  constructor(content: string) { this.content = content; }
  get raw(): string { return this.content; }
  get words(): string[] { return word_tokenize(this.content); }
  get sents(): string[][] {
    return sent_tokenize(this.content).map((sent) => word_tokenize(sent));
  }
  get paras(): string[][][] {
    return blankline_tokenize(this.content).map((para) =>
      sent_tokenize(para).map((sent) => word_tokenize(sent)));
  }
  repr(): string {
    return `${this.constructor.name}(content=${pyReprDeep(this.toString())})`;
  }
  toString(): string {
    return `${this.content.slice(0, this.truncate_at)}${this.content.length > this.truncate_at ? "..." : ""}`;
  }
}

/** markdown.CodeBlock — language + code lines; sents/paras treat lines as units. */
export class CodeBlock extends MarkdownBlock {
  language: string;
  constructor(language: string, content: string) {
    super(content);
    this.language = language;
  }
  override get sents(): string[][] {
    return pySplitlines(this.content).map((line) => word_tokenize(line));
  }
  get lines(): string[] { return pySplitlines(this.content); }
  override get paras(): string[][][] {
    return blankline_tokenize(this.content).map((para) =>
      pySplitlines(para).map((line) => word_tokenize(line)));
  }
}

/** markdown.MarkdownSection — heading, level, rendered content. */
export class MarkdownSection extends MarkdownBlock {
  heading: string;
  level: number;
  constructor(heading: string, level: number, content: string) {
    super(content);
    this.heading = heading;
    this.level = level;
  }
}

/** markdown.Image — namedtuple(label, src, title). */
export class Image {
  readonly 0: string; readonly 1: string; readonly 2: string | null;
  constructor(readonly label: string, readonly src: string, readonly title: string | null) {
    this[0] = label; this[1] = src; this[2] = title;
  }
  get length(): number { return 3; }
  *[Symbol.iterator](): Iterator<string | null> { yield this.label; yield this.src; yield this.title; }
  repr(): string {
    return `Image(label=${pyReprDeep(this.label)}, src=${pyReprDeep(this.src)}, title=${pyReprDeep(this.title)})`;
  }
}

/** markdown.Link — namedtuple(label, href, title). */
export class Link {
  readonly 0: string; readonly 1: string; readonly 2: string | null;
  constructor(readonly label: string, readonly href: string, readonly title: string | null) {
    this[0] = label; this[1] = href; this[2] = title;
  }
  get length(): number { return 3; }
  *[Symbol.iterator](): Iterator<string | null> { yield this.label; yield this.href; yield this.title; }
  repr(): string {
    return `Link(label=${pyReprDeep(this.label)}, href=${pyReprDeep(this.href)}, title=${pyReprDeep(this.title)})`;
  }
}

/** markdown.List — namedtuple(is_ordered, items). */
export class List {
  readonly 0: boolean; readonly 1: unknown[];
  constructor(readonly is_ordered: boolean, readonly items: unknown[]) {
    this[0] = is_ordered; this[1] = items;
  }
  get length(): number { return 2; }
  *[Symbol.iterator](): Iterator<unknown> { yield this.is_ordered; yield this.items; }
  repr(): string {
    return `List(is_ordered=${pyReprDeep(this.is_ordered)}, items=${pyReprDeep(this.items)})`;
  }
}

// { markdown readers

export interface MarkdownInit {
  parser?: MiniMarkdownIt;
  wordTokenizer?: TextTokenizerLike;
  sentTokenizer?: TextTokenizerLike | null;
  paraBlockReader?: BlockReader<string>;
  encoding?: EncodingSpec;
}

/** markdown.MarkdownCorpusReader — paragraphs are rendered markdown blocks. */
export class MarkdownCorpusReader extends PlaintextCorpusReader {
  parser: MiniMarkdownIt;

  constructor(root: string | PathPointer, fileids: string | string[], init: MarkdownInit = {}) {
    const parser = init.parser ?? new MiniMarkdownIt();
    super(
      root, fileids,
      init.wordTokenizer ?? new WordPunctTokenizer(),
      init.sentTokenizer === undefined ? null : init.sentTokenizer,
      init.paraBlockReader ?? ((stream) => read_parse_blankline_block(stream, parser)),
      init.encoding ?? "utf8",
    );
    this.parser = parser;
  }

  protected override _read_word_block(stream: SeekableUnicodeStreamReader): string[] {
    const words: string[] = [];
    for (const para of this._para_block_reader(stream)) {
      words.push(...this._word_tokenizer.tokenize(para));
    }
    return words;
  }
}

export interface CategorizedMarkdownInit extends CategorizedInit {
  cat_field?: string;
  parser?: MiniMarkdownIt;
  wordTokenizer?: TextTokenizerLike;
  sentTokenizer?: TextTokenizerLike | null;
  paraBlockReader?: BlockReader<string>;
  encoding?: EncodingSpec;
}

/** markdown.CategorizedMarkdownCorpusReader — categories pulled from each
 * document's front-matter ``cat_field`` (default "tags"). */
export class CategorizedMarkdownCorpusReader extends CategorizedCorpusReaderBase {
  parser: MiniMarkdownIt;
  protected _word_tokenizer: TextTokenizerLike;
  protected _sent_tokenizer: TextTokenizerLike | null;
  protected _para_block_reader: BlockReader<string>;
  private _plain: MarkdownCorpusReader;

  constructor(root: string | PathPointer, fileids: string | string[], init: CategorizedMarkdownInit = {}) {
    const { cat_field, parser, wordTokenizer, sentTokenizer, paraBlockReader, encoding, ...catArgs } = init;
    const catKwargs: CategorizedInit = {};
    if (catArgs.cat_pattern !== undefined) catKwargs.cat_pattern = catArgs.cat_pattern;
    if (catArgs.cat_map !== undefined) catKwargs.cat_map = catArgs.cat_map;
    if (catArgs.cat_file !== undefined) catKwargs.cat_file = catArgs.cat_file;
    if (catArgs.cat_delimiter !== undefined) catKwargs.cat_delimiter = catArgs.cat_delimiter;
    const hasCatKey = catKwargs.cat_pattern !== undefined || catKwargs.cat_map !== undefined || catKwargs.cat_file !== undefined;
    super(root, fileids, encoding ?? "utf8");
    const p = parser ?? new MiniMarkdownIt();
    this.parser = p;
    this._word_tokenizer = wordTokenizer ?? new WordPunctTokenizer();
    this._sent_tokenizer = sentTokenizer === undefined ? null : sentTokenizer;
    this._para_block_reader = paraBlockReader ?? ((stream) => read_parse_blankline_block(stream, p));
    // NLTK injects cat_map={} when no cat_* key is given, then fills it from
    // front-matter metadata below.
    if (!hasCatKey) catKwargs.cat_map = {};
    categorizedInit(this, catKwargs);
    const catField = cat_field ?? "tags";
    if (this._catMap !== null && Object.keys(this._catMap).length === 0) {
      for (const fileId of this._fileids) {
        const metadata = this.metadata(fileId) as AbstractLazySequence<unknown>;
        if (pyTruthy(metadata)) {
          const m0 = metadata.get(0);
          (this._catMap as Record<string, string[]>)[fileId] = pyDictGet(m0, catField, []) as string[];
        }
      }
    }
    // MRO in Python: CategorizedMarkdownCorpusReader(CategorizedCorpusReader,
    // MarkdownCorpusReader) — words()/sents()/paras() must use the markdown
    // _read_word_block override (markup stripped), so delegate to a
    // MarkdownCorpusReader, not a plain PlaintextCorpusReader.
    this._plain = new MarkdownCorpusReader(root, fileids, {
      wordTokenizer: this._word_tokenizer,
      sentTokenizer: this._sent_tokenizer,
      paraBlockReader: this._para_block_reader,
      encoding: this._encoding,
    });
  }

  protected sentTokenizer(): TextTokenizerLike {
    if (this._sent_tokenizer === null) {
      try {
        this._sent_tokenizer = new PunktTokenizer();
      } catch {
        throw pyError("ValueError", "No sentence tokenizer for this corpus");
      }
    }
    return this._sent_tokenizer;
  }

  concatenatedView(
    reader: (s: SeekableUnicodeStreamReader) => unknown[],
    fileids?: string | string[] | null, categories?: string | string[] | null,
  ): unknown {
    return this.concatenated_view(reader, fileids, categories);
  }

  concatenated_view(
    reader: BlockReader<unknown>,
    fileids?: string | string[] | Set<string> | null,
    categories?: string | string[] | Set<string> | null,
  ): unknown {
    const resolved = this._resolve(
      (fileids instanceof Set ? [...fileids] : fileids) as string | string[] | null,
      (categories instanceof Set ? [...categories] : categories) as string | string[] | null,
    );
    const views = (this.abspaths(resolved, true) as Array<[PathPointer, string | null]>)
      .map(([path, enc]) => new StreamBackedCorpusView(path, reader, 0, enc));
    return concat(views);
  }

  private _resolveToIds(fileids: unknown, categories: unknown): string | string[] | null {
    const resolved = this._resolve(
      csArg(fileids) as string | string[] | null,
      csArg(categories) as string | string[] | null,
    );
    return resolved instanceof Set ? [...resolved] : (resolved as string | string[] | null);
  }

  override raw(fileids?: string | string[] | null, categories?: string | string[] | null): string {
    return super.raw(this._resolveToIds(fileids, categories));
  }

  words(fileids?: string | string[] | null, categories?: string | string[] | null): unknown {
    return this._plain.words(this._resolveToIds(fileids, categories));
  }

  sents(fileids?: string | string[] | null, categories?: string | string[] | null): unknown {
    return this._plain.sents(this._resolveToIds(fileids, categories));
  }

  paras(fileids?: string | string[] | null, categories?: string | string[] | null): unknown {
    return this._plain.paras(this._resolveToIds(fileids, categories));
  }

  // readers over parsed tokens
  metadataReader(stream: SeekableUnicodeStreamReader): unknown[] { return this.metadata_reader(stream); }

  metadata_reader(stream: SeekableUnicodeStreamReader): unknown[] {
    return this.parser.parse(stream.read())
      .filter((t) => t.type === "front_matter")
      .map((t) => yamlSafeLoad(t.content));
  }

  blockquoteReader(stream: SeekableUnicodeStreamReader): MarkdownBlock[] { return this.blockquote_reader(stream); }

  blockquote_reader(stream: SeekableUnicodeStreamReader): MarkdownBlock[] {
    const out: MarkdownBlock[] = [];
    const tokens = this.parser.parse(stream.read());
    let slice: MdToken[] | null = null;
    for (const t of tokens) {
      if (t.level === 0 && t.type === "blockquote_open") slice = [t];
      else if (t.level === 0 && t.type === "blockquote_close" && slice !== null) {
        slice.push(t);
        out.push(new MarkdownBlock(this.parser.renderer.render(slice, this.parser.options, null)));
        slice = null;
      } else if (slice !== null) slice.push(t);
    }
    return out;
  }

  codeBlockReader(stream: SeekableUnicodeStreamReader): CodeBlock[] { return this.code_block_reader(stream); }

  code_block_reader(stream: SeekableUnicodeStreamReader): CodeBlock[] {
    return this.parser.parse(stream.read())
      .filter((t) => t.level === 0 && (t.type === "fence" || t.type === "code_block"))
      .map((t) => new CodeBlock(t.info, t.content));
  }

  imageReader(stream: SeekableUnicodeStreamReader): Image[] { return this.image_reader(stream); }

  image_reader(stream: SeekableUnicodeStreamReader): Image[] {
    const out: Image[] = [];
    for (const t of this.parser.parse(stream.read())) {
      if (t.type !== "inline") continue;
      for (const child of t.children ?? []) {
        if (child.type === "image") {
          out.push(new Image(child.content, child.attrGet("src")!, child.attrGet("title")));
        }
      }
    }
    return out;
  }

  linkReader(stream: SeekableUnicodeStreamReader): Link[] { return this.link_reader(stream); }

  link_reader(stream: SeekableUnicodeStreamReader): Link[] {
    const out: Link[] = [];
    for (const t of this.parser.parse(stream.read())) {
      if (t.type !== "inline") continue;
      const children = t.children ?? [];
      for (let i = 0; i < children.length; i++) {
        if (children[i]!.type === "link_open") {
          const next = children[i + 1];
          out.push(new Link(
            next === undefined ? (() => { throw pyError("IndexError", "list index out of range"); })() : next.content,
            children[i]!.attrGet("href")!, children[i]!.attrGet("title")));
        }
      }
    }
    return out;
  }

  listReader(stream: SeekableUnicodeStreamReader): List[] { return this.list_reader(stream); }

  list_reader(stream: SeekableUnicodeStreamReader): List[] {
    const out: List[] = [];
    const tokens = this.parser.parse(stream.read());
    let block: MdToken[] | null = null;
    let ordered = false;
    for (const t of tokens) {
      if (t.level === 0 && (t.type === "bullet_list_open" || t.type === "ordered_list_open")) {
        block = [t];
        ordered = t.type === "ordered_list_open";
      } else if (t.level === 0 && (t.type === "bullet_list_close" || t.type === "ordered_list_close")) {
        if (block !== null) {
          out.push(new List(ordered, block.filter((x) => x.content).map((x) => x.content)));
          block = null;
        }
      } else if (block !== null) block.push(t);
    }
    return out;
  }

  sectionReader(stream: SeekableUnicodeStreamReader): MarkdownSection[] { return this.section_reader(stream); }

  section_reader(stream: SeekableUnicodeStreamReader): MarkdownSection[] {
    const out: MarkdownSection[] = [];
    const tokens = this.parser.parse(stream.read());
    let block: MdToken[] | null = null;
    const flush = () => {
      if (block === null) return;
      out.push(new MarkdownSection(
        block[1] === undefined ? (() => { throw pyError("IndexError", "list index out of range"); })() : block[1]!.content,
        block[0] === undefined ? 0 : block[0]!.markup.split("").filter((ch) => ch === "#").length,
        this.parser.renderer.render(block, this.parser.options, null)));
      block = null;
    };
    for (const t of tokens) {
      if (t.level === 0 && t.type === "heading_open") flush();
      if (block !== null || t.type === "heading_open") {
        (block ??= []).push(t);
      }
    }
    flush();
    return out;
  }

  metadata(fileids?: string | string[] | null, categories?: string | string[] | null): unknown {
    return this.concatenated_view((s) => this.metadata_reader(s), csArg(fileids) as string | string[] | null, csArg(categories) as string | string[] | null);
  }

  blockquotes(fileids?: string | string[] | null, categories?: string | string[] | null): unknown {
    return this.concatenated_view((s) => this.blockquote_reader(s), csArg(fileids) as string | string[] | null, csArg(categories) as string | string[] | null);
  }

  codeBlocks(fileids?: string | string[] | null, categories?: string | string[] | null): unknown {
    return this.code_blocks(fileids, categories);
  }

  code_blocks(fileids?: string | string[] | null, categories?: string | string[] | null): unknown {
    return this.concatenated_view((s) => this.code_block_reader(s), csArg(fileids) as string | string[] | null, csArg(categories) as string | string[] | null);
  }

  images(fileids?: string | string[] | null, categories?: string | string[] | null): unknown {
    return this.concatenated_view((s) => this.image_reader(s), csArg(fileids) as string | string[] | null, csArg(categories) as string | string[] | null);
  }

  links(fileids?: string | string[] | null, categories?: string | string[] | null): unknown {
    return this.concatenated_view((s) => this.link_reader(s), csArg(fileids) as string | string[] | null, csArg(categories) as string | string[] | null);
  }

  lists(fileids?: string | string[] | null, categories?: string | string[] | null): unknown {
    return this.concatenated_view((s) => this.list_reader(s), csArg(fileids) as string | string[] | null, csArg(categories) as string | string[] | null);
  }

  sections(fileids?: string | string[] | null, categories?: string | string[] | null): unknown {
    return this.concatenated_view((s) => this.section_reader(s), csArg(fileids) as string | string[] | null, csArg(categories) as string | string[] | null);
  }

  override categories(fileids?: string | string[] | null): string[] {
    return super.categories(csArg(fileids) as string | string[] | null);
  }

  override fileids(categories?: string | string[] | null): string[] {
    if (categories === undefined || categories === null) return [...this._fileids];
    return super.fileids(csArg(categories) as string | string[] | null);
  }
}


// { framenet.py value/lazy containers and _pretty_* helpers

/** framenet.Future — lazy attribute value resolved on first access. */
export class Future {
  private _data_val: unknown;
  private _resolved = false;
  constructor(private readonly loader: () => unknown) {}
  _data(): unknown {
    if (!this._resolved) {
      this._data_val = this.loader();
      this._resolved = true;
    }
    return this._data_val;
  }
  /** Future.__getitem__ — forwards to the resolved value's subscript. */
  item(key: unknown): unknown {
    const d = this._data();
    if (d instanceof AttrDict) return d.item(key);
    if (Array.isArray(d)) return d[key as number];
    if (typeof d === "string") return d[key as number];
    if (d instanceof Map) {
      if (!d.has(key)) throw pyError("KeyError", pyReprDeep(key));
      return d.get(key);
    }
    if (d !== null && typeof d === "object") {
      const r = d as Record<string, unknown>;
      if (Object.prototype.hasOwnProperty.call(r, String(key))) return r[String(key)];
      throw pyError("KeyError", pyReprDeep(key));
    }
    throw pyError("TypeError", `'${pyTypeName(d)}' object is not subscriptable`);
  }
  /** Future.__getattr__ — forwards to the resolved value's getattr. */
  attr(key: string): unknown {
    const d = this._data();
    if (d instanceof AttrDict) return d.item(key);
    throw pyError("AttributeError", `'${pyTypeName(d)}' object has no attribute '${key}'`);
  }
  get length(): number { return pyLen(this._data()); }
  get truthy(): boolean { return pyTruthy(this._data()); }
  repr(): string { return pyReprDeep(this._data()); }
  toString(): string { return pyStr(this._data()); }
}

/** framenet.AttrDict — dict with attribute access; values that are Futures
 * resolve lazily on __getitem__. String representation depends on _type. */
export class AttrDict {
  _d = new Map<unknown, unknown>();

  constructor(init?: Iterable<[unknown, unknown]> | Record<string, unknown> | Map<unknown, unknown> | AttrDict | null) {
    let src: Iterable<[unknown, unknown]> | null = null;
    if (init === null || init === undefined) src = null;
    else if (init instanceof AttrDict) src = init._d.entries();
    else if (init instanceof Map) src = init.entries();
    else if (typeof (init as Iterable<[unknown, unknown]>)[Symbol.iterator] === "function") {
      src = init as Iterable<[unknown, unknown]>;
    } else src = Object.entries(init as Record<string, unknown>);
    if (src !== null) for (const [k, v] of src) this._d.set(k, v);

    return new Proxy(this, {
      get(t, prop, recv) {
        if (typeof prop === "symbol" || Reflect.has(t, prop)) {
          const v = Reflect.get(t, prop, recv);
          return typeof v === "function" ? v.bind(recv) : v;
        }
        return t.item(prop);
      },
      set(t, prop, v) {
        // Python AttrDict.__setattr__ stores into the dict, but
        // dict.__setattr__ (used by PrettyDict/PrettyList for _BREAK_LINES/
        // _MAX_REPR_SIZE) and ordinary instance attributes bypass it.
        // Underscore-prefixed props therefore land on the object itself.
        if (typeof prop === "string" && prop.startsWith("_")) {
          Reflect.set(t, prop, v);
          return true;
        }
        t._d.set(prop, v);
        return true;
      },
      has(t, prop) {
        return Reflect.has(t, prop) || t._d.has(prop);
      },
      deleteProperty(t, prop) {
        return t._d.delete(prop);
      },
      ownKeys(t) {
        return [...t._d.keys()].map((k) => String(k));
      },
      getOwnPropertyDescriptor(t, prop) {
        if (t._d.has(prop)) {
          return { enumerable: true, configurable: true, writable: true, value: t._d.get(prop) };
        }
        return Reflect.getOwnPropertyDescriptor(t, prop);
      },
    });
  }

  /** dict.__getitem__ — resolves Future values. */
  item(key: unknown): unknown {
    if (!this._d.has(key)) throw pyError("KeyError", pyReprDeep(key));
    const v = this._d.get(key);
    return v instanceof Future ? v._data() : v;
  }

  /** dict.get — raw value, no Future resolution. */
  get(key: unknown, def?: unknown): unknown {
    return this._d.has(key) ? this._d.get(key) : def;
  }

  set(key: unknown, v: unknown): void { this._d.set(key, v); }
  has(key: unknown): boolean { return this._d.has(key); }
  update(other: AttrDict | Map<unknown, unknown> | Record<string, unknown>): void {
    const entries = other instanceof AttrDict ? other._d.entries()
      : other instanceof Map ? other.entries() : Object.entries(other);
    for (const [k, v] of entries) this._d.set(k, v);
  }
  setdefault(key: unknown, def: unknown): unknown {
    if (!this._d.has(key)) this._d.set(key, def);
    return this._d.get(key);
  }
  pop(key: unknown, def?: unknown): unknown {
    if (this._d.has(key)) { const v = this._d.get(key); this._d.delete(key); return v; }
    if (arguments.length > 1) return def;
    throw pyError("KeyError", pyReprDeep(key));
  }
  keys(): unknown[] { return [...this._d.keys()]; }
  values(): unknown[] { return [...this._d.values()]; }
  items(): [unknown, unknown][] { return [...this._d.entries()]; }
  get size(): number { return this._d.size; }
  *[Symbol.iterator](): Iterator<unknown> { yield* this._d.keys(); }

  toString(): string { return this._str(); }
  repr(): string { return this._str(); }

  _str(): string {
    const typ = this._d.has("_type") ? this.item("_type") : undefined;
    if (typ === undefined) return _pretty_any(this);
    if (typ === "frame") return _pretty_frame(this);
    if (typ === "fe") return _pretty_fe(this);
    if (typ === "lu") return _pretty_lu(this);
    if (typ === "luexemplars") {
      return _pretty_exemplars(this, (this.item(0) as AttrDict).item("LU") as AttrDict);
    }
    if (typ === "fulltext_annotation") return _pretty_fulltext_sentences(this);
    if (typ === "lusentence") return _pretty_annotation(this);
    if (typ === "fulltext_sentence") return _pretty_fulltext_sentence(this);
    if (typ === "luannotationset" || typ === "fulltext_annotationset") {
      return _pretty_annotation(this, true);
    }
    if (typ === "posannotationset") return _pretty_pos(this);
    if (typ === "semtype") return _pretty_semtype(this);
    if (typ === "framerelationtype") return _pretty_frame_relation_type(this);
    if (typ === "framerelation") return _pretty_frame_relation(this);
    if (typ === "ferelation") return _pretty_fe_relation(this);
    return _pretty_any(this);
  }

  _short_repr(): string {
    if (this._d.has("_type")) {
      const typ = this.item("_type");
      if (typeof typ !== "string") {
        throw pyError("AttributeError", `'${pyTypeName(typ)}' object has no attribute 'endswith'`);
      }
      if (typ.endsWith("relation")) return this.repr();
      try {
        return `<${pyStr(typ)} ID=${pyStr(this.item("ID"))} name=${pyStr(this.item("name"))}>`;
      } catch {
        try {
          return `<${pyStr(typ)} name=${pyStr(this.item("name"))}>`;
        } catch {
          return `<${pyStr(typ)} ID=${pyStr(this.item("ID"))}>`;
        }
      }
    }
    return this.repr();
  }
}

/** framenet._pretty_any — generic AttrDict dump used for unknown _types. */
export function _pretty_any(obj: AttrDict): string {
  let outstr = "";
  for (const k of obj.keys()) {
    const v = obj.item(k);
    if (typeof v === "string" && v.length > 65) {
      outstr += `[${pyStr(k)}]\n`;
      outstr += _pretty_longstring(v, "  ") + "\n";
    } else {
      outstr += `[${pyStr(k)}] ${pyStr(v)}\n`;
    }
  }
  return outstr;
}

/** framenet._pretty_longstring — textwrap at wrap_at, prefix each line. */
export function _pretty_longstring(defstr: string, prefix = "", wrap_at = 65): string {
  return pyTextwrapFill(defstr, wrap_at).split("\n").map((l) => prefix + l).join("\n");
}

function sentAscii(sent: AttrDict): string {
  const ascii = sent.item("_ascii");
  if (typeof ascii !== "function") {
    throw pyError("TypeError", `'${pyTypeName(ascii)}' object is not callable`);
  }
  return (ascii as () => string)();
}

/** framenet._annotation_ascii — frames-style if >2 annotationSets or a
 * fulltext sentence; else FE-style. */
export function _annotation_ascii(sent: AttrDict): string {
  if (sent.item("_type") === "fulltext_sentence" ||
      (sent.has("annotationSet") && (sent.item("annotationSet") as unknown[]).length > 2)) {
    return _annotation_ascii_frames(sent);
  }
  return _annotation_ascii_FEs(sent);
}

/** framenet._annotation_ascii_FEs (single-annotationSet sentence rendering). */
export function _annotation_ascii_FEs(sent: AttrDict): string {
  const feAbbrevs = new Map<string, string>();

  const posspec: [number, number, string][] = [];
  let posspec_separate = false;
  for (const lyr of ["Verb", "Noun", "Adj", "Adv", "Prep", "Scon", "Art"]) {
    if (sent.has(lyr) && (sent.item(lyr) as unknown[]).length > 0) {
      for (const [a, b, lbl] of sent.item(lyr) as [number, number, string][]) {
        if (lbl === "X") continue;
        const feSpans = (sent.item("FE") as [unknown, unknown])[0] as [number, number, string][];
        if (feSpans.some(([x, y]) => (x <= a && a < y) || (a <= x && x < b))) posspec_separate = true;
        posspec.push([a, b, lbl.toLowerCase().replaceAll("-", "")]);
      }
    }
  }
  let POSSPEC: [string, string, string] | null = null;
  if (posspec_separate) POSSPEC = _annotation_ascii_FE_layer(posspec, null, feAbbrevs);

  const fe = sent.item("FE") as [[number, number, string][], Record<string, string>];
  const fe1Spans: [number, number, string][] = [...fe[0], ...(posspec_separate ? [] : posspec)];
  fe1Spans.sort(pyTupleCmp);
  const FE1 = _annotation_ascii_FE_layer(fe1Spans, fe[1], feAbbrevs);

  let FE2: [string, string, string] | null = null;
  let FE3: [string, string, string] | null = null;
  if (sent.has("FE2")) {
    const fe2 = sent.item("FE2") as [[number, number, string][], Record<string, string>];
    FE2 = _annotation_ascii_FE_layer(fe2[0], fe2[1], feAbbrevs);
    if (sent.has("FE3")) {
      const fe3 = sent.item("FE3") as [[number, number, string][], Record<string, string>];
      FE3 = _annotation_ascii_FE_layer(fe3[0], fe3[1], feAbbrevs);
    }
  }

  for (const [i, j] of sent.item("Target") as [number, number][]) {
    let FE1span = FE1[0], FE1name = FE1[1];
    if (FE1span.length < j) FE1span += " ".repeat(j - FE1span.length);
    if (FE1name.length < j) { FE1name += " ".repeat(j - FE1name.length); FE1[1] = FE1name; }
    FE1[0] = FE1span.slice(0, i) + FE1span.slice(i, j).replaceAll(" ", "*").replaceAll("-", "=") + FE1span.slice(j);
  }

  const long_lines = [String(sent.item("text"))];
  if (posspec_separate) { long_lines.push(POSSPEC![0], POSSPEC![1]); }
  long_lines.push(FE1[0], FE1[1] + FE1[2]);
  if (FE2) { long_lines.push(FE2[0], FE2[1] + FE2[2]); if (FE3) long_lines.push(FE3[0], FE3[1] + FE3[2]); }
  long_lines.push("");

  let outstr = zipLongest(collectMimic(long_lines), " ").map((row) => row.join("\n")).join("\n");
  if (feAbbrevs.size > 0) {
    outstr += "(" + [...feAbbrevs.entries()].map(([a, b]) => `${a}=${b}`).join(", ") + ")";
  }
  outstr += "\n";
  return outstr;
}

/** framenet._annotation_ascii_FE_layer — underline spans + names + NI dict. */
export function _annotation_ascii_FE_layer(
  overt: [number, number, string][],
  ni: Record<string, string> | Map<string, string> | null,
  feAbbrevs: Map<string, string>,
): [string, string, string] {
  let s1 = "", s2 = "", i = 0;
  for (const [j, k, fename] of overt) {
    s1 += " ".repeat(j - i) + (pyIsLower(fename) ? "^" : "-").repeat(k - j);
    let short = fename.slice(0, k - j);
    if (fename.length > short.length) {
      let r = 0;
      while (feAbbrevs.has(short)) {
        if (feAbbrevs.get(short) === fename) break;
        r++;
        short = fename.slice(0, k - j - 1) + r;
      }
      if (!feAbbrevs.has(short)) feAbbrevs.set(short, fename);
    }
    s2 += " ".repeat(j - i) + pyLjust(short, k - j);
    i = k;
  }
  let sNI = "";
  const niLen = ni instanceof Map ? ni.size : ni === null ? 0 : Object.keys(ni).length;
  if (ni !== null && niLen > 0) {
    const items = ni instanceof Map ? [...ni.entries()] : Object.entries(ni);
    items.sort((a, b) => pyStrCmp(String(a[0]), String(b[0])));
    sNI += " [" + items.map(([k, v]) => `${String(k)}:${String(v)}`).join(", ") + "]";
  }
  return [s1, s2, sNI];
}

/** framenet._annotation_ascii_frames (multi-annotationSet sentence). */
export function _annotation_ascii_frames(sent: AttrDict): string {
  const overt: [number, number, string, string][] = [];
  const annSets = sent.item("annotationSet") as AttrDict[];
  for (let a = 0; a < annSets.length - 1; a++) {
    const aset = annSets[a + 1]!;
    const lu = aset.item("LU") as AttrDict;
    for (const [j, k] of aset.item("Target") as [number, number][]) {
      let indexS = `[${a + 1}]`;
      if (aset.item("status") === "UNANN" || lu.item("status") === "Problem") {
        indexS += " ";
        if (aset.item("status") === "UNANN") indexS += "!";
        if (lu.item("status") === "Problem") indexS += "?";
      }
      overt.push([j, k, String((lu.item("frame") as AttrDict).item("name")), indexS]);
    }
  }
  overt.sort(pyTupleCmp);
  const duplicates: number[] = [];
  for (let o = 0; o < overt.length; o++) {
    const [j, k, fname, asetIndex] = overt[o]!;
    if (o > 0 && j <= overt[o - 1]![1]) {
      if (overt[o - 1]![0] === j && overt[o - 1]![1] === k && overt[o - 1]![2] === fname) {
        let combinedIndex = overt[o - 1]![3] + asetIndex;
        combinedIndex = combinedIndex.replace(" !", "! ").replace(" ?", "? ");
        overt[o - 1] = [overt[o - 1]![0], overt[o - 1]![1], overt[o - 1]![2], combinedIndex];
        duplicates.push(o);
      } else {
        let s = String(sent.item("text"));
        for (const [j2, k2, fname2, asetIndex2] of overt) {
          s += `\n${asetIndex2} ${String(sent.item("text")).slice(j2, k2)} :: ${fname2}`;
        }
        s += "\n(Unable to display sentence with targets marked inline due to overlap)";
        return s;
      }
    }
  }
  for (const o of duplicates.sort((x, y) => y - x)) overt.splice(o, 1);

  let s0 = String(sent.item("text")), s1 = "", s11 = "", s2 = "", i = 0, adjust = 0;
  const fAbbrevs = new Map<string, string>();
  for (const [j, k, fname, asetIndex] of overt) {
    if (!(j >= i)) {
      const unann = annSets.slice(1).some((a2) => a2.item("status") === "UNANN");
      const msg = "Overlapping targets?" + (unann ? " UNANN" : "");
      throw pyError("AssertionError", pyReprTuple([msg, [j, k, asetIndex]]));
    }
    s1 += " ".repeat(j - i) + "*".repeat(k - j);
    let short = fname.slice(0, k - j);
    if (k - j < fname.length) {
      let r = 0;
      while (fAbbrevs.has(short)) {
        if (fAbbrevs.get(short) === fname) break;
        r++;
        short = fname.slice(0, k - j - 1) + r;
      }
      if (!fAbbrevs.has(short)) fAbbrevs.set(short, fname);
    }
    s11 += " ".repeat(j - i) + pyLjust(short, k - j);
    if (asetIndex.length > k - j) {
      const amt = asetIndex.length - (k - j);
      s0 = s0.slice(0, k + adjust) + "~".repeat(amt) + s0.slice(k + adjust);
      s1 = s1.slice(0, k + adjust) + " ".repeat(amt) + s1.slice(k + adjust);
      s11 = s11.slice(0, k + adjust) + " ".repeat(amt) + s11.slice(k + adjust);
      adjust += amt;
    }
    s2 += " ".repeat(j - i) + pyLjust(asetIndex, k - j);
    i = k;
  }

  const long_lines = [s0, s1, s11, s2];
  let outstr = zipLongest(collectMimic(long_lines), " ").map((row) => row.join("\n")).join("\n\n").replaceAll("~", " ");
  outstr += "\n";
  if (fAbbrevs.size > 0) {
    outstr += " (" + [...fAbbrevs.entries()].map(([a, b]) => `${a}=${b}`).join(", ") + ")";
  }
  return outstr;
}

/** framenet._pretty_annotation (lusentence/luannotationset). */
export function _pretty_annotation(sent: AttrDict, aset_level = false): string {
  const sentkeys = sent.keys();
  let outstr = aset_level ? "annotation set" : "exemplar sentence";
  outstr += ` (${pyStr(sent.item("ID"))}):\n`;
  if (aset_level) outstr += `\n[status] ${pyStr(sent.item("status"))}\n`;
  for (const k of ["corpID", "docID", "paragNo", "sentNo", "aPos"]) {
    if (sentkeys.includes(k)) outstr += `[${k}] ${pyStr(sent.item(k))}\n`;
  }
  const lu = sent.item("LU");
  if (pyTruthy(lu)) {
    const luD = lu as AttrDict;
    outstr += `\n[LU] (${pyStr(luD.item("ID"))}) ${pyStr(luD.item("name"))} in ${pyStr((luD.item("frame") as AttrDict).item("name"))}\n`;
  } else {
    outstr += "\n[LU] Not found!";
  }
  const frame = sent.item("frame") as AttrDict;
  outstr += `\n[frame] (${pyStr(frame.item("ID"))}) ${pyStr(frame.item("name"))}\n`;
  if (!aset_level) {
    outstr += `\n[annotationSet] ${pyLen(sent.item("annotationSet"))} annotation sets\n`;
    outstr += `\n[POS] ${pyLen(sent.item("POS"))} tags\n`;
    outstr += `\n[POS_tagset] ${pyStr(sent.item("POS_tagset"))}\n`;
  }
  const gfLen = pyLen(sent.item("GF"));
  outstr += `\n[GF] ${gfLen} relation${gfLen !== 1 ? "s" : ""}\n`;
  const ptLen = pyLen(sent.item("PT"));
  outstr += `\n[PT] ${ptLen} phrase${ptLen !== 1 ? "s" : ""}\n`;
  for (const lyr of ["NER", "WSL", "Other", "Sent"]) {
    if (sent.has(lyr) && pyLen(sent.item(lyr)) > 0) {
      const n = pyLen(sent.item(lyr));
      outstr += `\n[${lyr}] ${n} entr${n !== 1 ? "ies" : "y"}\n`;
    }
  }
  outstr += "\n[text] + [Target] + [FE]";
  for (const lyr of ["Verb", "Noun", "Adj", "Adv", "Prep", "Scon", "Art"]) {
    if (sent.has(lyr) && pyLen(sent.item(lyr)) > 0) outstr += ` + [${lyr}]`;
  }
  if (sentkeys.includes("FE2")) {
    outstr += " + [FE2]";
    if (sentkeys.includes("FE3")) outstr += " + [FE3]";
  }
  outstr += "\n\n";
  outstr += sentAscii(sent);
  outstr += "\n";
  return outstr;
}

/** framenet._pretty_exemplars. */
export function _pretty_exemplars(exemplars: Iterable<unknown>, lu: AttrDict): string {
  let outstr = `exemplar sentences for ${pyStr(lu.item("name"))} in ${pyStr((lu.item("frame") as AttrDict).item("name"))}:\n\n`;
  let i = 0;
  for (const sent of exemplars) {
    if (!(sent instanceof AttrDict)) {
      throw pyError("AttributeError", `'${pyTypeName(sent)}' object has no attribute 'text'`);
    }
    outstr += `[${i}] ${pyStr(sent.item("text"))}\n`;
    i++;
  }
  outstr += "\n";
  return outstr;
}

/** framenet._pretty_fe. */
export function _pretty_fe(fe: AttrDict): string {
  const fekeys = fe.keys();
  const frame = fe.item("frame") as AttrDict;
  let outstr = `frame element (${pyStr(fe.item("ID"))}): ${pyStr(fe.item("name"))}\n    of ${pyStr(frame.item("name"))}(${pyStr(frame.item("ID"))})\n`;
  if (fekeys.includes("definition")) outstr += "[definition]\n" + _pretty_longstring(String(fe.item("definition")), "  ");
  if (fekeys.includes("abbrev")) outstr += `[abbrev] ${pyStr(fe.item("abbrev"))}\n`;
  if (fekeys.includes("coreType")) outstr += `[coreType] ${pyStr(fe.item("coreType"))}\n`;
  if (fekeys.includes("requiresFE")) {
    outstr += "[requiresFE] ";
    const req = fe.item("requiresFE");
    if (req === null) outstr += "<None>\n";
    else outstr += `${pyStr((req as AttrDict).item("name"))}(${pyStr((req as AttrDict).item("ID"))})\n`;
  }
  if (fekeys.includes("excludesFE")) {
    outstr += "[excludesFE] ";
    const exc = fe.item("excludesFE");
    if (exc === null) outstr += "<None>\n";
    else outstr += `${pyStr((exc as AttrDict).item("name"))}(${pyStr((exc as AttrDict).item("ID"))})\n`;
  }
  if (fekeys.includes("semType")) {
    outstr += "[semType] ";
    const st = fe.item("semType");
    if (st === null) outstr += "<None>\n";
    else outstr += `\n  ${pyStr((st as AttrDict).item("name"))}(${pyStr((st as AttrDict).item("ID"))})` + "\n";
  }
  return outstr;
}

/** framenet._pretty_frame. */
export function _pretty_frame(frame: AttrDict): string {
  let outstr = `frame (${pyStr(frame.item("ID"))}): ${pyStr(frame.item("name"))}\n\n`;
  outstr += `[URL] ${pyStr(frame.item("URL"))}\n\n`;
  outstr += "[definition]\n" + _pretty_longstring(String(frame.item("definition")), "  ") + "\n";

  const semTypes = frame.item("semTypes") as AttrDict[];
  outstr += `[semTypes] ${semTypes.length} semantic types\n`;
  outstr += (semTypes.length > 0 ? "  " : "") + semTypes.map((x) => `${pyStr(x.item("name"))}(${pyStr(x.item("ID"))})`).join(", ") + (semTypes.length > 0 ? "\n" : "");

  const frels = frame.item("frameRelations") as AttrDict[];
  outstr += `\n[frameRelations] ${frels.length} frame relations\n`;
  outstr += "  " + frels.map((frel) => frel.repr()).join("\n  ") + "\n";

  const lexUnit = frame.item("lexUnit") as AttrDict;
  outstr += `\n[lexUnit] ${lexUnit.size} lexical units\n`;
  const lustrs = lexUnit.items().sort((a, b) => pyStrCmp(String(a[0]), String(b[0])))
    .map(([luName, lu]) => `${pyStr(luName)} (${pyStr((lu as AttrDict).item("ID"))})`);
  outstr += _pretty_longstring(lustrs.join(", "), "  ") + "\n";

  const FE = frame.item("FE") as AttrDict;
  outstr += `\n[FE] ${FE.size} frame elements\n`;
  const fes = new Map<string, string[]>();
  for (const [feName, fe] of FE.items().sort((a, b) => pyStrCmp(String(a[0]), String(b[0])))) {
    const ct = String((fe as AttrDict).item("coreType"));
    if (!fes.has(ct)) fes.set(ct, []);
    fes.get(ct)!.push(`${pyStr(feName)} (${pyStr((fe as AttrDict).item("ID"))})`);
  }
  const order = ["Core", "Core-Unexpressed", "Peripheral", "Extra-Thematic"];
  for (const ct of fes.keys()) {
    if (!order.includes(ct)) throw pyError("ValueError", `'${ct}' is not in list`);
  }
  const sortedCts = [...fes.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  for (const ct of sortedCts) {
    outstr += `${ct.padStart(16)}: ${fes.get(ct)!.sort(pyStrCmp).join(", ")}\n`;
  }

  const feCoreSets = frame.item("FEcoreSets") as AttrDict[][];
  outstr += `\n[FEcoreSets] ${feCoreSets.length} frame element core sets\n`;
  outstr += "  " + feCoreSets.map((coreSet) => coreSet.map((x) => pyStr(x.item("name"))).join(", ")).join("\n  ") + "\n";
  return outstr;
}

/** framenet._pretty_frame_relation. */
export function _pretty_frame_relation(frel: AttrDict): string {
  const typ = frel.item("type") as AttrDict;
  return `<${pyStr(typ.item("superFrameName"))}=${pyStr(frel.item("superFrameName"))} -- ${pyStr(typ.item("name"))} -> ${pyStr(typ.item("subFrameName"))}=${pyStr(frel.item("subFrameName"))}>`;
}

/** framenet._pretty_frame_relation_type. */
export function _pretty_frame_relation_type(t: AttrDict): string {
  return `<frame relation type (${pyStr(t.item("ID"))}): ${pyStr(t.item("superFrameName"))} -- ${pyStr(t.item("name"))} -> ${pyStr(t.item("subFrameName"))}>`;
}

/** framenet._pretty_fe_relation. */
export function _pretty_fe_relation(ferel: AttrDict): string {
  const typ = ferel.item("type") as AttrDict;
  const frel = ferel.item("frameRelation") as AttrDict;
  return `<${pyStr(typ.item("superFrameName"))}=${pyStr(frel.item("superFrameName"))}.${pyStr(ferel.item("superFEName"))} -- ${pyStr(typ.item("name"))} -> ${pyStr(typ.item("subFrameName"))}=${pyStr(frel.item("subFrameName"))}.${pyStr(ferel.item("subFEName"))}>`;
}

/** framenet._pretty_fulltext_sentence. */
export function _pretty_fulltext_sentence(sent: AttrDict): string {
  const doc = sent.item("doc") as AttrDict;
  // NB: the default arg to doc.get() is evaluated eagerly in Python — a doc
  // with no "description" raises KeyError even when "name" is present.
  const docDesc = doc.item("description");
  const docName = doc.get("name", docDesc);
  let outstr = `full-text sentence (${pyStr(sent.item("ID"))}) in ${pyStr(docName)}:\n\n`;
  outstr += `\n[POS] ${pyLen(sent.item("POS"))} tags\n`;
  outstr += `\n[POS_tagset] ${pyStr(sent.item("POS_tagset"))}\n\n`;
  outstr += "[text] + [annotationSet]\n\n";
  outstr += sentAscii(sent);
  outstr += "\n";
  return outstr;
}

/** framenet._pretty_fulltext_sentences (corpus-document listing). */
export function _pretty_fulltext_sentences(sents: AttrDict): string {
  let outstr = `full-text document (${pyStr(sents.item("ID"))}) ${pyStr(sents.item("name"))}:\n\n`;
  outstr += `[corpid] ${pyStr(sents.item("corpid"))}\n`;
  outstr += `[corpname] ${pyStr(sents.item("corpname"))}\n`;
  outstr += `[description] ${pyStr(sents.item("description"))}\n`;
  outstr += `[URL] ${pyStr(sents.item("URL"))}\n\n`;
  outstr += "[sentence]\n";
  const sentence = sents.item("sentence") as AttrDict[];
  for (let i = 0; i < sentence.length; i++) {
    outstr += `[${i}] ${pyStr(sentence[i]!.item("text"))}\n`;
  }
  outstr += "\n";
  return outstr;
}

/** framenet._pretty_lu. */
export function _pretty_lu(lu: AttrDict): string {
  const lukeys = lu.keys();
  let outstr = `lexical unit (${pyStr(lu.item("ID"))}): ${pyStr(lu.item("name"))}\n\n`;

  if (lukeys.includes("definition")) {
    outstr += "[definition]\n" + _pretty_longstring(String(lu.item("definition")), "  ");
  }
  if (lukeys.includes("frame")) {
    const f = lu.item("frame") as AttrDict;
    outstr += `\n[frame] ${pyStr(f.item("name"))}(${pyStr(f.item("ID"))})\n`;
  }
  if (lukeys.includes("incorporatedFE")) {
    outstr += `\n[incorporatedFE] ${pyStr(lu.item("incorporatedFE"))}\n`;
  }
  if (lukeys.includes("POS")) outstr += `\n[POS] ${pyStr(lu.item("POS"))}\n`;
  if (lukeys.includes("status")) outstr += `\n[status] ${pyStr(lu.item("status"))}\n`;
  if (lukeys.includes("totalAnnotated")) {
    outstr += `\n[totalAnnotated] ${pyStr(lu.item("totalAnnotated"))} annotated examples\n`;
  }
  if (lukeys.includes("lexemes")) {
    const lexemes = lu.item("lexemes") as AttrDict[];
    outstr += `\n[lexemes] ${lexemes.map((lex) => `${pyStr(lex.item("name"))}/${pyStr(lex.item("POS"))}`).join(" ")}\n`;
  }
  if (lukeys.includes("semTypes")) {
    const semTypes = lu.item("semTypes") as AttrDict[];
    outstr += `\n[semTypes] ${semTypes.length} semantic types\n`;
    outstr += (semTypes.length > 0 ? "  " : "") + semTypes.map((x) => `${pyStr(x.item("name"))}(${pyStr(x.item("ID"))})`).join(", ") + (semTypes.length > 0 ? "\n" : "");
  }
  if (lukeys.includes("URL")) outstr += `\n[URL] ${pyStr(lu.item("URL"))}\n`;
  if (lukeys.includes("subCorpus")) {
    const subCorpus = lu.item("subCorpus") as AttrDict[];
    const subc = subCorpus.map((x) => String(x.item("name"))).sort(pyStrCmp);
    outstr += `\n[subCorpus] ${subCorpus.length} subcorpora\n`;
    for (const line of pyTextwrapFill(subc.join(", "), 60).split("\n")) {
      outstr += `  ${line}\n`;
    }
  }
  if (lukeys.includes("exemplars")) {
    outstr += `\n[exemplars] ${pyLen(lu.item("exemplars"))} sentences across all subcorpora\n`;
  }
  return outstr;
}

/** framenet._pretty_pos. */
export function _pretty_pos(aset: AttrDict): string {
  const sent = aset.item("sent") as AttrDict;
  let outstr = `POS annotation set (${pyStr(aset.item("ID"))}) ${pyStr(aset.item("POS_tagset"))} in sentence ${pyStr(sent.item("ID"))}:\n\n`;
  const overt = (aset.item("POS") as [number, number, string][]).slice().sort(pyTupleCmp);
  let s0 = String(sent.item("text"));
  let s1 = "", s2 = "", i = 0, adjust = 0;
  for (const [j, k, lbl] of overt) {
    if (!(j >= i)) {
      throw pyError("AssertionError", pyReprTuple(["Overlapping targets?", [j, k, lbl]]));
    }
    s1 += " ".repeat(j - i) + "-".repeat(k - j);
    if (lbl.length > k - j) {
      const amt = lbl.length - (k - j);
      s0 = s0.slice(0, k + adjust) + "~".repeat(amt) + s0.slice(k + adjust);
      s1 = s1.slice(0, k + adjust) + " ".repeat(amt) + s1.slice(k + adjust);
      adjust += amt;
    }
    s2 += " ".repeat(j - i) + pyLjust(lbl, k - j);
    i = k;
  }
  const long_lines = [s0, s1, s2];
  outstr += zipLongest(collectMimic(long_lines), " ").map((row) => row.join("\n")).join("\n\n").replaceAll("~", " ");
  outstr += "\n";
  return outstr;
}

/** framenet._pretty_semtype. */
export function _pretty_semtype(st: AttrDict): string {
  const semkeys = st.keys();
  if (semkeys.length === 1) return "<None>";
  let outstr = `semantic type (${pyStr(st.item("ID"))}): ${pyStr(st.item("name"))}\n`;
  if (semkeys.includes("abbrev")) outstr += `[abbrev] ${pyStr(st.item("abbrev"))}\n`;
  if (semkeys.includes("definition")) {
    outstr += "[definition]\n" + _pretty_longstring(String(st.item("definition")), "  ");
  }
  const rootType = st.item("rootType") as AttrDict;
  outstr += `[rootType] ${pyStr(rootType.item("name"))}(${pyStr(rootType.item("ID"))})\n`;
  const superType = st.item("superType");
  if (superType === null) outstr += "[superType] <None>\n";
  else outstr += `[superType] ${pyStr((superType as AttrDict).item("name"))}(${pyStr((superType as AttrDict).item("ID"))})\n`;
  const subTypes = st.item("subTypes") as AttrDict[];
  outstr += `[subTypes] ${subTypes.length} subtypes\n`;
  outstr += "  " + subTypes.map((x) => `${pyStr(x.item("name"))}(${pyStr(x.item("ID"))})`).join(", ") + (subTypes.length > 0 ? "\n" : "");
  return outstr;
}

/** framenet.SpecialList — list subclass whose repr depends on _type. */
export class SpecialList extends Array<unknown> {
  _type: string;
  constructor(typ: string, items?: Iterable<unknown>) {
    super();
    this._type = typ;
    if (items) for (const x of items) this.push(x);
  }
  _str(): string {
    if (!this._type) throw pyError("AssertionError", "");
    if (this.length === 0) return "[]";
    if (this._type === "luexemplars") {
      return _pretty_exemplars(this, ((this[0] as AttrDict)).item("LU") as AttrDict);
    }
    throw pyError("AssertionError", String(this._type));
  }
  override toString(): string { return this._str(); }
  repr(): string { return this._str(); }
}

function pyShortRepr(v: unknown): string {
  let x = v;
  if (x instanceof Future) x = x._data();
  const f = (x as { _short_repr?: unknown })._short_repr;
  if (typeof f === "function") return (f as () => string).call(x);
  throw pyError("AttributeError", `'${pyTypeName(x)}' object has no attribute '_short_repr'`);
}

function pyKeyCmp(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "string" && typeof b === "string") return pyStrCmp(a, b);
  throw pyError("TypeError", `'<' not supported between instances of '${pyTypeName(a)}' and '${pyTypeName(b)}'`);
}

/** framenet.PrettyDict — dict repr sorted by key, _short_repr'd values. */
export class PrettyDict extends AttrDict {
  _BREAK_LINES: boolean;
  constructor(
    init?: Iterable<[unknown, unknown]> | Record<string, unknown> | Map<unknown, unknown> | AttrDict | null,
    opts: { breakLines?: boolean } = {},
  ) {
    super(init);
    this._BREAK_LINES = opts.breakLines ?? false;
  }
  override repr(): string {
    const parts: string[] = [];
    const entries = this.items().sort((a, b) => pyKeyCmp(a[0], b[0]));
    for (const [k, v] of entries) {
      let kv = `${pyReprDeep(k)}: `;
      try {
        kv += pyShortRepr(v);
      } catch {
        kv += pyReprDeep(v);
      }
      parts.push(kv);
    }
    return `{${parts.join(this._BREAK_LINES ? ",\n " : ", ")}}`;
  }
}

/** framenet.PrettyList — repr uses _short_repr, truncates at _MAX_REPR_SIZE. */
export class PrettyList extends Array<unknown> {
  _MAX_REPR_SIZE: number;
  _BREAK_LINES: boolean;
  constructor(items?: Iterable<unknown>, opts: { maxReprSize?: number; breakLines?: boolean } = {}) {
    super();
    if (items) for (const x of items) this.push(x);
    this._MAX_REPR_SIZE = opts.maxReprSize ?? 60;
    this._BREAK_LINES = opts.breakLines ?? false;
  }
  repr(): string {
    const sep = this._BREAK_LINES ? ",\n " : ", ";
    const pieces: string[] = [];
    let length = 5;
    for (const elt of this) {
      pieces.push(pyShortRepr(elt));
      length += pieces[pieces.length - 1]!.length + 2;
      if (this._MAX_REPR_SIZE > 0 && length > this._MAX_REPR_SIZE && pieces.length > 2) {
        return `[${pieces.slice(0, -1).join(sep)}, ...]`;
      }
    }
    return `[${pieces.join(sep)}]`;
  }
  override toString(): string { return this.repr(); }
}

/** util.PrettyLazyMap — repr uses _short_repr unconditionally. */
export class PrettyLazyMap extends LazyMap<unknown, unknown> {
  _MAX_REPR_SIZE = 60;
  _BREAK_LINES = false;
  repr(): string {
    const pieces: string[] = [];
    let length = 5;
    for (const elt of this) {
      pieces.push(pyShortRepr(elt));
      length += pieces[pieces.length - 1]!.length + 2;
      if (length > this._MAX_REPR_SIZE && pieces.length > 2) {
        return `[${pieces.slice(0, -1).join(", ")}, ...]`;
      }
    }
    return `[${pieces.join(", ")}]`;
  }
  override toString(): string { return this.repr(); }
}

/** util.PrettyLazyIteratorList. */
export class PrettyLazyIteratorList extends LazyIteratorList<unknown> {
  _MAX_REPR_SIZE = 60;
  _BREAK_LINES = false;
  repr(): string {
    const pieces: string[] = [];
    let length = 5;
    for (const elt of this) {
      pieces.push(pyShortRepr(elt));
      length += pieces[pieces.length - 1]!.length + 2;
      if (length > this._MAX_REPR_SIZE && pieces.length > 2) {
        return `[${pieces.slice(0, -1).join(", ")}, ...]`;
      }
    }
    return `[${pieces.join(", ")}]`;
  }
  override toString(): string { return this.repr(); }
}

function* pyChain<T>(a: Iterable<T>, b: Iterable<T>): Generator<T> {
  yield* a;
  yield* b;
}

/** util.PrettyLazyConcatenation — repr uses _short_repr unconditionally. */
export class PrettyLazyConcatenation extends LazyConcatenation<unknown> {
  _MAX_REPR_SIZE = 60;
  _BREAK_LINES = false;
  repr(): string {
    const pieces: string[] = [];
    let length = 5;
    for (const elt of this) {
      pieces.push(pyShortRepr(elt));
      length += pieces[pieces.length - 1]!.length + 2;
      if (length > this._MAX_REPR_SIZE && pieces.length > 2) {
        return `[${pieces.slice(0, -1).join(", ")}, ...]`;
      }
    }
    return `[${pieces.join(", ")}]`;
  }
  add(other: Iterable<unknown>): PrettyLazyIteratorList {
    return new PrettyLazyIteratorList(pyChain(this, other));
  }
  radd(other: Iterable<unknown>): PrettyLazyIteratorList {
    return new PrettyLazyIteratorList(pyChain(other, this));
  }
  override toString(): string { return this.repr(); }
}


