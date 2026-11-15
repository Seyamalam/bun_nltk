// nltk.downloader — fetch-based data-server client (NLTK 3.10.3 parity port).
// Original: nltk/downloader.py.
//
// Network methods (index load, download/update/incr_download, status paths
// that resolve string ids) are async where Python was synchronous, because
// the fetch happens through pathsec.urlopen (fetch/file://). DownloaderGUI,
// DownloaderShell, download_gui and download_shell (Tk / interactive cmd
// loop) remain out of scope.

import { createHash } from "node:crypto";
import {
  closeSync, existsSync, lstatSync, mkdirSync, openSync, readdirSync,
  readFileSync, readSync, realpathSync, renameSync, rmdirSync, statSync,
  unlinkSync, utimesSync, writeFileSync, writeSync,
} from "node:fs";
import { homedir } from "node:os";
import {
  basename, dirname, isAbsolute, join as pathJoin, resolve as pathResolve, sep,
} from "node:path";
import { isWritable, pyError, pyLstrip, pyRstrip, pyStrip } from "./internals";
import { dataPath } from "./data";
import {
  is_private_dir, urlopen as pathsecUrlopen, validate_path, zip_member_is_unsafe,
} from "./pathsec";
import { OpenOnDemandZipFile } from "./zipfile";
import { XMLElement, parseXmlString } from "./xmldocs";

// ---------------------------------------------------------------------------
// Python shims (str/repr/int/os.path/textwrap) — local to keep this file a
// light portable surface.
// ---------------------------------------------------------------------------

/** Python str() for the values the downloader prints. */
function pyStr(x: unknown): string {
  if (x === null || x === undefined) return "None";
  if (x === true) return "True";
  if (x === false) return "False";
  return String(x);
}

const _PRINTABLE_ASCII = /^[\x20-\x7e]$/;

/** Python repr() of a string — single quotes unless it contains ' but not ". */
function pyReprStr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = quote;
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (ch === "\\") out += "\\\\";
    else if (ch === quote) out += "\\" + quote;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (_PRINTABLE_ASCII.test(ch)) out += ch;
    else if (cp < 0x100) out += `\\x${cp.toString(16).padStart(2, "0")}`;
    else if (cp < 0x10000) out += `\\u${cp.toString(16).padStart(4, "0")}`;
    else out += `\\U${cp.toString(16).padStart(8, "0")}`;
  }
  return out + quote;
}

/** Python int() for index attribute strings. */
function pyInt(v: unknown): number {
  if (v === null || v === undefined) {
    throw pyError("TypeError", "int() argument must be a string, a bytes-like object or a real number, not 'NoneType'");
  }
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw pyError("ValueError", `cannot convert float ${v} to integer`);
    return Math.trunc(v);
  }
  const s = String(v);
  if (/^[\t\n\v\f\r \x1c-\x1f\x85\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]*[+-]?\d[\d_]*[\t\n\v\f\r \x1c-\x1f\x85\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]*$/u.test(s)) {
    return parseInt(pyStrip(s).replace(/_/g, ""), 10);
  }
  throw pyError("ValueError", `invalid literal for int() with base 10: ${pyReprStr(s)}`);
}

/** Python float division that raises ZeroDivisionError. */
function pyDiv(a: number, b: number): number {
  if (b === 0) throw pyError("ZeroDivisionError", "float division by zero");
  return a / b;
}

/** Python type-of name for the few retry AttributeError cases. */
function pyTypeName(x: unknown): string {
  if (x === null || x === undefined) return "NoneType";
  if (typeof x === "string") return "str";
  if (typeof x === "number") return "int";
  if (typeof x === "boolean") return "bool";
  return (x as object).constructor?.name ?? "object";
}

// { os.path (posix semantics; the oracle runs posix)

function pyNormpath(p: string): string {
  if (p === "") return ".";
  const doubleSlash = p.startsWith("//") && !p.startsWith("///");
  const absolute = p.startsWith("/");
  const parts = p.split("/").filter((x) => x !== "" && x !== ".");
  const out: string[] = [];
  for (const part of parts) {
    if (part === "..") {
      if (out.length > 0 && out[out.length - 1] !== "..") out.pop();
      else if (!absolute) out.push("..");
    } else {
      out.push(part);
    }
  }
  let result = `${absolute ? "/" : ""}${out.join("/")}`;
  if (result === "") result = absolute ? "/" : ".";
  if (doubleSlash) result = `/${result}`;
  return result;
}

/** os.path.split — (head, tail) with head stripped of trailing seps unless all seps. */
function pySplit(p: string): [string, string] {
  const i = p.lastIndexOf("/");
  if (i < 0) return ["", p];
  let head = p.slice(0, i);
  const tail = p.slice(i + 1);
  if (head !== "" && !/^\/+$/.test(head)) head = head.replace(/\/+$/, "");
  else if (p.startsWith("/")) head = "/";
  return [head, tail];
}

/** os.path.splitext — last dot after last sep, leading dots skipped. */
function pySplitext(p: string): [string, string] {
  const sepIndex = p.lastIndexOf("/");
  const dotIndex = p.lastIndexOf(".");
  if (dotIndex > sepIndex) {
    let filenameIndex = sepIndex + 1;
    while (filenameIndex < dotIndex) {
      if (p[filenameIndex] !== ".") return [p.slice(0, dotIndex), p.slice(dotIndex)];
      filenameIndex += 1;
    }
  }
  return [p, ""];
}

/** os.path.join — unlike path.join, a later absolute segment resets the path
 * (and join("a", "") keeps a trailing sep). */
function pyJoin(...parts: string[]): string {
  let out = "";
  for (const p of parts) {
    if (p === "") {
      if (out !== "" && !out.endsWith("/")) out += "/";
      continue;
    }
    if (out === "" || isAbsolute(p)) out = p;
    else out = out.endsWith("/") ? out + p : out + "/" + p;
  }
  return out;
}

/** os.path.normcase — identity on POSIX, case-fold + sep-flip on Windows. */
function normcase(p: string): string {
  if (process.platform === "win32") return p.replace(/\//g, "\\").toLowerCase();
  return p;
}

/** os.path.commonpath — absolute-only subset used by the containment checks. */
function pyCommonpath(paths: string[]): string {
  const allAbs = paths.every((p) => isAbsolute(p));
  const allRel = paths.every((p) => !isAbsolute(p));
  if (!allAbs && !allRel) {
    throw pyError("ValueError", "Can't mix absolute and relative paths");
  }
  const splits = paths.map((p) => pyNormpath(p).split("/").filter((x) => x !== ""));
  const first = splits[0]!;
  const common: string[] = [];
  for (let i = 0; i < first.length; i++) {
    const c = first[i]!;
    if (splits.every((s) => s[i] === c)) common.push(c);
    else break;
  }
  const joined = common.join("/");
  return allAbs ? `/${joined}` : joined;
}

/** os.path.lexists — true even for dangling symlinks. */
function lexists(p: string): boolean {
  try { lstatSync(p); return true; } catch { return false; }
}

function isLink(p: string): boolean {
  try { return lstatSync(p).isSymbolicLink(); } catch { return false; }
}

function isDir(p: string): boolean {
  try { return statSync(p).isDirectory(); } catch { return false; }
}

/** os.path.realpath(strict=False): resolve the longest existing ancestor,
 * then append the non-existent tail lexically. */
function pyRealpath(p: string): string {
  const abs = pathResolve(p);
  let cur = abs;
  const tail: string[] = [];
  while (!existsSync(cur) && dirname(cur) !== cur) {
    tail.unshift(basename(cur));
    cur = dirname(cur);
  }
  let base: string;
  try { base = realpathSync(cur); } catch { base = cur; }
  return tail.length ? pathJoin(base, ...tail) : base;
}

// { textwrap — CPython textwrap.py port (same algorithm as src/corpus_readers6.ts)

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
      if (indent.length + pyLstrip(this.placeholder).length > this.width) {
        throw pyError("ValueError", "placeholder too large for max width");
      }
    }
    chunks.reverse();
    while (chunks.length) {
      const curLine: string[] = [];
      let curLen = 0;
      const indent = lines.length ? this.subsequent_indent : this.initial_indent;
      const width = this.width - indent.length;
      if (this.drop_whitespace && pyStrip(chunks[chunks.length - 1]!) === "" && lines.length) {
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
      if (this.drop_whitespace && curLine.length && pyStrip(curLine[curLine.length - 1]!) === "") {
        curLen -= curLine[curLine.length - 1]!.length;
        curLine.pop();
      }
      if (curLine.length) {
        if (
          this.max_lines === null ||
          lines.length + 1 < this.max_lines ||
          ((!chunks.length ||
            (this.drop_whitespace && chunks.length === 1 && !pyStrip(chunks[0]!))) &&
            curLen <= width)
        ) {
          lines.push(indent + curLine.join(""));
        } else {
          let broke = false;
          while (curLine.length) {
            if (pyStrip(curLine[curLine.length - 1]!) && curLen + this.placeholder.length <= width) {
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
              const prevLine = pyRstrip(lines[lines.length - 1]!);
              if (prevLine.length + this.placeholder.length <= this.width) {
                lines[lines.length - 1] = prevLine + this.placeholder;
                break;
              }
            }
            lines.push(indent + pyLstrip(this.placeholder));
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

function textwrapFill(s: string, opts: TextWrapperOptions): string {
  return new TextWrapper(opts).fill(s);
}

// { python-level io / error plumbing

/** Writable target for print()/print_error_to sinks. */
export interface PyStream {
  write(s: string): unknown;
}

function stdoutStream(): PyStream | null {
  if (typeof process !== "undefined" && process.stdout) return process.stdout;
  return null;
}

function stderrStream(): PyStream {
  if (typeof process !== "undefined" && process.stderr) return process.stderr;
  return { write: (s) => console.error(s.replace(/\n$/, "")) };
}

/** builtins print() -> stdout (line-buffered, newline appended). */
function printStdout(s = ""): void {
  const st = stdoutStream();
  if (st) st.write(s + "\n");
  else console.log(s);
}

/** sys.stdout.write — verbatim, no newline. */
function stdoutWrite(s: string): void {
  const st = stdoutStream();
  if (st) st.write(s);
}

/** warnings.warn(...) — message to stderr once per call site (unpinnable
 * file/line prefix in Python; we surface the bare message). */
function emitWarning(message: string, warnType = "UserWarning"): void {
  const st = stderrStream();
  if (typeof process !== "undefined" && typeof (process as { emitWarning?: unknown }).emitWarning === "function") {
    (process as { emitWarning: (w: string, t?: string) => void }).emitWarning(message, warnType);
  } else {
    st.write(`${warnType}: ${message}\n`);
  }
}

/** builtins.input — synchronous line read on fd 0; EOFError on empty EOF. */
function pyInput(prompt = ""): string {
  if (prompt) stdoutWrite(prompt);
  let out = "";
  try {
    const buf = new Uint8Array(1);
    for (;;) {
      let n = 0;
      try {
        n = readSync(0, buf, 0, 1, null);
      } catch {
        break;
      }
      if (n === 0) break;
      const ch = String.fromCharCode(buf[0]!);
      if (ch === "\n") return out;
      out += ch;
    }
  } catch {
    // fall through to EOF handling
  }
  if (out.length > 0) return out; // input() returns a partial line on EOF
  throw pyError("EOFError", "EOF when reading a line");
}

// Python OSError subclass names our port can raise.
const PY_OSERROR_NAMES = new Set([
  "OSError", "PermissionError", "FileNotFoundError", "FileExistsError",
  "IsADirectoryError", "NotADirectoryError", "HTTPError", "URLError",
  "BlockingIOError", "ConnectionError", "TimeoutError", "EOFError",
]);

// Node errno-code -> Python (errno, class, strerror).
const FS_ERRNO: Record<string, [number, string, string]> = {
  ENOENT: [2, "FileNotFoundError", "No such file or directory"],
  EACCES: [13, "PermissionError", "Permission denied"],
  EPERM: [1, "PermissionError", "Operation not permitted"],
  EEXIST: [17, "FileExistsError", "File exists"],
  EISDIR: [21, "IsADirectoryError", "Is a directory"],
  ENOTDIR: [20, "NotADirectoryError", "Not a directory"],
  ENOSPC: [28, "OSError", "No space left on device"],
  ELOOP: [40, "OSError", "Too many levels of symbolic links"],
};

/** Translate a raw Node fs error into the pythonic (name, message) pair. */
function toPyErr(e: unknown): Error {
  const anyE = e as { code?: unknown; path?: unknown } | null;
  if (anyE && typeof anyE.code === "string" && anyE.code in FS_ERRNO) {
    const [no, name, desc] = FS_ERRNO[anyE.code]!;
    const p = anyE.path !== undefined ? `: '${anyE.path}'` : "";
    return pyError(name, `[Errno ${no}] ${desc}${p}`);
  }
  return e instanceof Error ? e : pyError("Error", String(e));
}

/** Python `except OSError`. */
function isOSError(e: unknown): boolean {
  const anyE = e as { code?: unknown; name?: string } | null;
  if (anyE && typeof anyE.code === "string" && anyE.code in FS_ERRNO) return true;
  return e instanceof Error && PY_OSERROR_NAMES.has(e.name);
}

function strErr(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** urllib wraps transport/fs failures as URLError — an OSError whose str()
 * is '<urlopen error %s>' % reason. */
function urlerror(e: unknown): Error {
  const pe = toPyErr(e);
  if (pe.name === "URLError" || pe.name === "HTTPError") return pe;
  return pyError("URLError", `<urlopen error ${pe.message}>`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// nltk.data._check_decompression_bomb (lives on nltk.data; used by _unzip_iter)
// ---------------------------------------------------------------------------

/** nltk.data.MAX_UNZIP_RATIO */
export let MAX_UNZIP_RATIO = 1000;
/** nltk.data.MAX_UNZIP_SIZE */
export let MAX_UNZIP_SIZE: number | null = null;
/** nltk.data.MAX_UNZIP_ACTIVATION */
export let MAX_UNZIP_ACTIVATION = 32 * 1024 * 1024;

function _checkDecompressionBomb(info: { compress_size?: number; file_size?: number; filename?: string }): void {
  const compressSize = info.compress_size ?? 0;
  const fileSize = info.file_size ?? 0;
  const name = info.filename ?? "<member>";
  if (MAX_UNZIP_SIZE !== null && fileSize > MAX_UNZIP_SIZE) {
    throw pyError("ValueError",
      `Refusing to decompress zip member ${pyReprStr(name)}: uncompressed size ${fileSize} bytes ` +
      `exceeds nltk.data.MAX_UNZIP_SIZE=${MAX_UNZIP_SIZE}.`);
  }
  if (fileSize >= MAX_UNZIP_ACTIVATION && compressSize > 0 && fileSize > MAX_UNZIP_RATIO * compressSize) {
    throw pyError("ValueError",
      `Refusing to decompress suspected zip bomb ${pyReprStr(name)}: it expands ` +
      `${(fileSize / compressSize).toFixed(1)}x (${compressSize} -> ${fileSize} bytes), ` +
      `above nltk.data.MAX_UNZIP_RATIO=${MAX_UNZIP_RATIO}. ` +
      `Raise nltk.data.MAX_UNZIP_RATIO if this data is trusted.`);
  }
}

// ---------------------------------------------------------------------------
// XML: ElementTree.tostring + safe_parse (xmlsec) helpers
// ---------------------------------------------------------------------------

function escapeCdata(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttrib(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\r/g, "&#13;")
    .replace(/\n/g, "&#10;")
    .replace(/\t/g, "&#09;");
}

function serializeXml(elt: XMLElement, out: string[]): void {
  out.push(`<${elt.tag}`);
  for (const [k, v] of elt.attrib) out.push(` ${k}="${escapeAttrib(v)}"`);
  if (elt.text || elt.children.length) {
    out.push(">");
    if (elt.text) out.push(escapeCdata(elt.text));
    for (const c of elt.children) serializeXml(c, out);
    out.push(`</${elt.tag}>`);
  } else {
    out.push(" />");
  }
  if (elt.tail) out.push(escapeCdata(elt.tail));
}

/** xml.etree.ElementTree.tostring(elem, encoding="unicode"). */
export function xml_tostring(elt: XMLElement): string {
  const out: string[] = [];
  serializeXml(elt, out);
  return out.join("");
}
export const xmlTostring = xml_tostring;

/** nltk.xmlsec.parse / ElementTree.parse on a string. */
function safeParseXml(text: string): XMLElement {
  if (/<!ENTITY/i.test(text)) {
    throw pyError("EntitiesForbidden", "EntitiesForbidden(name='entity', system_id=None, public_id=None)");
  }
  return parseXmlString(text);
}

/** ElementTree.parse(file).getroot() over a filesystem path. */
function safeParseXmlFile(filename: string): XMLElement {
  return safeParseXml(readFileSync(filename, "utf-8"));
}

// ---------------------------------------------------------------------------
// Directory entry objects (from the data server's index file)
// ---------------------------------------------------------------------------

type PackageKw = Record<string, unknown> & { id: string; url: string };

/** nltk.downloader.Package — index.xml package entry. */
export class Package {
  id: string;
  name: string;
  subdir: string;
  url: string;
  size: number;
  unzipped_size: number;
  checksum: string | null;
  svn_revision: unknown;
  copyright: string;
  contact: string;
  license: string;
  author: string;
  unzip: boolean;
  filename: string;
  [key: string]: unknown;

  constructor(kw: PackageKw) {
    const { id, url } = kw;
    this.id = id;
    this.name = (kw["name"] as string | undefined) ?? id;

    const subdir = (kw["subdir"] as string | undefined) ?? "";
    if (isAbsolute(subdir) || subdir.replace(/\\/g, "/").split("/").includes("..")) {
      throw pyError("ValueError",
        `Invalid package subdir ${pyReprStr(subdir)}: must be a relative path without parent directory references`);
    }
    if (id.includes("/") || id.includes("\\") || id.includes("..")) {
      throw pyError("ValueError",
        `Invalid package id ${pyReprStr(id)}: must not contain path separators`);
    }
    this.subdir = subdir;
    this.url = url;
    this.size = pyInt(kw["size"]);
    this.unzipped_size = pyInt(kw["unzipped_size"]);
    this.checksum = (kw["checksum"] as string | undefined) ?? null;
    this.svn_revision = kw["svn_revision"] ?? null;
    this.copyright = (kw["copyright"] as string | undefined) ?? "Unknown";
    this.contact = (kw["contact"] as string | undefined) ?? "Unknown";
    this.license = (kw["license"] as string | undefined) ?? "Unknown";
    this.author = (kw["author"] as string | undefined) ?? "Unknown";
    this.unzip = Boolean(pyInt(kw["unzip"] ?? 1));

    const {
      id: _i, url: _u, name: _n, subdir: _s, size: _z, unzipped_size: _uz,
      checksum: _c, svn_revision: _sr, copyright: _cr, contact: _co,
      license: _l, author: _a, unzip: _un, ...rest
    } = kw as Record<string, unknown>;
    Object.assign(this, rest);

    const ext = pySplitext(url.split("/").pop()!)[1];
    this.filename = pathJoin(this.subdir, this.id + ext);
  }

  static fromxml(xml: string | XMLElement | { attrib: Record<string, string> | Map<string, string> }): Package {
    let attrib: Record<string, string>;
    if (typeof xml === "string") {
      // safe_parse treats a string as a file PATH (ElementTree.parse), not content.
      attrib = Object.fromEntries(safeParseXmlFile(xml).attrib);
    } else if (xml instanceof XMLElement) {
      attrib = Object.fromEntries(xml.attrib);
    } else {
      attrib = xml.attrib instanceof Map ? Object.fromEntries(xml.attrib) : xml.attrib;
    }
    return new Package(attrib as PackageKw);
  }

  toString(): string { return `<Package ${this.id}>`; }
}

type CollectionKw = Record<string, unknown> & { id: string; children: (string | Package | Collection)[] };

/** nltk.downloader.Collection — index.xml collection entry. */
export class Collection {
  id: string;
  name: string;
  children: (string | Package | Collection)[];
  packages: Package[] | null = null;
  [key: string]: unknown;

  constructor(kw: CollectionKw) {
    this.id = kw.id;
    this.name = (kw["name"] as string | undefined) ?? this.id;
    this.children = kw.children;
    const { id: _i, name: _n, children: _c, ...rest } = kw as Record<string, unknown>;
    Object.assign(this, rest);
  }

  static fromxml(xml: string | XMLElement | { attrib: Record<string, string> | Map<string, string>; itemRefs: (string | null)[] }): Collection {
    if (typeof xml === "string") {
      const elt = safeParseXmlFile(xml);
      const itemRefs = elt.findall("item").map((c) => c.get("ref"));
      return new Collection({ children: itemRefs as string[], ...Object.fromEntries(elt.attrib) } as CollectionKw);
    }
    if (xml instanceof XMLElement) {
      const itemRefs = xml.findall("item").map((c) => c.get("ref"));
      return new Collection({ children: itemRefs as string[], ...Object.fromEntries(xml.attrib) } as CollectionKw);
    }
    const attrib = xml.attrib instanceof Map ? Object.fromEntries(xml.attrib) : xml.attrib;
    return new Collection({ children: xml.itemRefs as string[], ...attrib } as CollectionKw);
  }

  toString(): string { return `<Collection ${this.id}>`; }
}

// ---------------------------------------------------------------------------
// Message passing objects (yielded by incr_download)
// ---------------------------------------------------------------------------

/** nltk.downloader.DownloaderMessage. */
export class DownloaderMessage {}

export class StartCollectionMessage extends DownloaderMessage {
  constructor(public collection: Collection) { super(); }
}
export class FinishCollectionMessage extends DownloaderMessage {
  constructor(public collection: Collection) { super(); }
}
abstract class PackageMessage extends DownloaderMessage {
  declare package: Package;
  constructor(pkg: Package) { super(); this.package = pkg; }
}
export class StartPackageMessage extends PackageMessage {}
export class FinishPackageMessage extends PackageMessage {}
export class StartDownloadMessage extends PackageMessage {}
export class FinishDownloadMessage extends PackageMessage {}
export class StartUnzipMessage extends PackageMessage {}
export class FinishUnzipMessage extends PackageMessage {}
export class UpToDateMessage extends PackageMessage {}
export class StaleMessage extends PackageMessage {}

export class ErrorMessage extends DownloaderMessage {
  package: Package | Collection | string | null;
  message: string;
  constructor(pkg: Package | Collection | string | null, message: unknown) {
    super();
    this.package = pkg;
    this.message = strErr(message);
  }
}

export class ProgressMessage extends DownloaderMessage {
  constructor(public progress: number) { super(); }
}
export class SelectDownloadDirMessage extends DownloaderMessage {
  constructor(public download_dir: string) { super(); }
}

// ---------------------------------------------------------------------------
// Checksum helpers + unzip
// ---------------------------------------------------------------------------

/** nltk.downloader.md5_hexdigest — filename, path-like or bytes. */
export function md5_hexdigest(file: string | { path: string } | Uint8Array): string {
  return createHash("md5").update(readAllBytes(file)).digest("hex");
}

/** nltk.downloader.sha256_hexdigest. */
export function sha256_hexdigest(file: string | { path: string } | Uint8Array): string {
  return createHash("sha256").update(readAllBytes(file)).digest("hex");
}

function readAllBytes(file: string | { path: string } | Uint8Array): Uint8Array {
  if (file instanceof Uint8Array) return file;
  const raw = typeof file === "object" && "path" in file ? file.path : (file as string);
  const buf = readFileSync(raw);
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

/** nltk.downloader._validate_member — null for safe, else error string. */
function _validateMember(member: string, rootAbs: string): string | null {
  if (member.includes("\x00")) {
    return `Null byte in entry name blocked: ${pyReprStr(member)}`;
  }
  const absPrefix = normcase(rootAbs).replace(/[/\\]+$/, "") + sep;
  const targetAbs = normcase(pathResolve(pyJoin(rootAbs, member)));
  if (!targetAbs.startsWith(absPrefix)) {
    return `Zip Slip blocked: ${member}`;
  }
  const realPrefix = normcase(pyRealpath(rootAbs)).replace(/[/\\]+$/, "") + sep;
  const targetReal = normcase(pyRealpath(pyJoin(rootAbs, member)));
  if (!targetReal.startsWith(realPrefix)) {
    return `Symlink escape blocked: ${member}`;
  }
  return null;
}

/** pathsec.validate_zip_archive + zipfile extract sanitize, per member. */
function extractMember(zf: OpenOnDemandZipFile, member: string, rootAbs: string): void {
  if (member.includes("\x00")) {
    throw pyError("ValueError", `Null byte in ZIP member: ${member}`);
  }
  const memberPath = pyRealpath(pyJoin(rootAbs, member));
  const target = pyRealpath(rootAbs);
  if (
    zip_member_is_unsafe(member) ||
    !(memberPath === target || memberPath.startsWith(target + sep))
  ) {
    throw pyError("PermissionError", `Security Violation [ZipAudit]: Traversal member '${member}' detected.`);
  }
  // zipfile._extract_member arcname sanitization.
  const arcname = member.split("/").filter((x) => x !== "" && x !== "." && x !== "..").join(sep);
  const memberIsDir = member.endsWith("/");
  if (!arcname && !memberIsDir) throw pyError("ValueError", "Empty filename.");
  const targetpath = pyNormpath(pyJoin(rootAbs, arcname));
  // Upper dirs are created only when absent — exists() is True for a
  // file, so a file at an upper path falls through to open() -> ENOTDIR.
  const upperdirs = dirname(targetpath);
  if (upperdirs && !existsSync(upperdirs)) mkdirSync(upperdirs, { recursive: true });
  if (memberIsDir) {
    if (!isDir(targetpath)) {
      try {
        mkdirSync(targetpath);
      } catch (e) {
        if (!isDir(targetpath)) throw e;
      }
    }
    return;
  }
  writeFileSync(targetpath, zf.read(member));
}

/** nltk.downloader._unzip_iter — validate-then-extract generator. */
export function* _unzip_iter(
  filename: string,
  root: string,
  verbose = true,
  expected_root: string | null = null,
): Generator<ErrorMessage> {
  if (verbose) stdoutWrite(`Unzipping ${pySplit(filename)[1]}`);

  let zf: OpenOnDemandZipFile;
  try {
    validate_path(filename, "pathsec.ZipFile");
    zf = new OpenOnDemandZipFile(filename);
    zf.namelist(); // force the eager central-directory read Python does at open
  } catch (e) {
    const pe = toPyErr(e);
    yield new ErrorMessage(filename, pe.name === "BadZipFile" ? "File is not a zip file" : pe);
    if (verbose) printStdout();
    return;
  }

  try {
    const rootAbs = pathResolve(root);
    const members = zf.namelist();

    // Phase 1 — validate every member before touching the filesystem.
    let hasViolations = false;
    for (const member of members) {
      if (expected_root !== null) {
        const top = member.replace(/\\/g, "/").replace(/^\/+/, "").split("/")[0];
        if (top !== expected_root) {
          yield new ErrorMessage(filename,
            `Cross-package overwrite blocked: member ${pyReprStr(member)} ` +
            `is outside the owning package directory ${pyReprStr(expected_root)}`);
          hasViolations = true;
          continue;
        }
      }
      const error = _validateMember(member, rootAbs);
      if (error !== null) {
        yield new ErrorMessage(filename, error);
        hasViolations = true;
        continue;
      }
      try {
        _checkDecompressionBomb(zf.getinfo(member));
      } catch (e) {
        yield new ErrorMessage(filename, strErr(toPyErr(e)));
        hasViolations = true;
      }
    }

    if (hasViolations) return;

    // Phase 2 — all members passed; extract.
    try {
      mkdirSync(rootAbs, { recursive: true });
    } catch (e) {
      yield new ErrorMessage(filename, `Extraction error: ${strErr(toPyErr(e))}`);
      return;
    }

    for (const member of members) {
      if (expected_root !== null) {
        const top = member.replace(/\\/g, "/").replace(/^\/+/, "").split("/")[0];
        if (top !== expected_root) {
          yield new ErrorMessage(filename,
            `Cross-package overwrite blocked: member ${pyReprStr(member)} ` +
            `is outside the owning package directory ${pyReprStr(expected_root)}`);
          return;
        }
      }
      const error = _validateMember(member, rootAbs);
      if (error !== null) {
        yield new ErrorMessage(filename, `${error} (during extraction)`);
        return;
      }
      try {
        extractMember(zf, member, rootAbs);
      } catch (e) {
        yield new ErrorMessage(filename, `Extraction error for ${member}: ${strErr(toPyErr(e))}`);
        return;
      }
    }
  } catch (e) {
    yield new ErrorMessage(filename, `Validation error: ${strErr(toPyErr(e))}`);
  } finally {
    if (verbose) printStdout();
  }
}

let _fakeObjAddr = 0x7f0000000000;

/** Python `raise Exception(errorMessage)` — str(exc) is the default object
 * repr: '<nltk.downloader.ErrorMessage object at 0x...>'. */
function errorMessageRepr(): string {
  return `<nltk.downloader.ErrorMessage object at 0x${(_fakeObjAddr++).toString(16)}>`;
}

/** nltk.downloader.unzip — extract a package zip into a directory. */
export function unzip(filename: string, root: string, verbose = true): void {
  for (const message of _unzip_iter(filename, root, verbose)) {
    if (message instanceof ErrorMessage) {
      throw pyError("Exception", errorMessageRepr());
    }
  }
}

// ---------------------------------------------------------------------------
// nltk.data.path authorization (nltk.downloader._authorize_data_dir)
// ---------------------------------------------------------------------------

function _authorizeDataDir(directory: string | null | undefined): void {
  if (!directory) return;
  let resolved: string;
  try {
    resolved = pyRealpath(String(directory));
  } catch {
    return;
  }
  let probe = resolved;
  while (!existsSync(probe) && dirname(probe) !== probe) {
    probe = dirname(probe);
  }
  if (!is_private_dir(probe)) {
    emitWarning(
      `NLTK will not authorize the non-private download directory ` +
      `'${resolved}': it (or an ancestor) is world- or group-writable, so ` +
      `another local user could plant files there. Choose a private ` +
      `location such as ~/nltk_data.`,
    );
    return;
  }
  const existing = new Set<string>();
  for (const p of dataPath) {
    try { existing.add(pyRealpath(String(p))); } catch { /* skip */ }
  }
  if (!existing.has(resolved)) dataPath.push(resolved);
}

// ---------------------------------------------------------------------------
// NLTK Data Server
// ---------------------------------------------------------------------------

export type InfoOrId = string | Package | Collection | (string | Package | Collection)[] | null | undefined;

export interface DownloadOptions {
  quiet?: boolean;
  force?: boolean;
  prefix?: string;
  halt_on_error?: boolean;
  raise_on_error?: boolean;
  print_error_to?: PyStream | null;
  hf?: boolean;
}

export interface ListOptions {
  download_dir?: string | null;
  show_packages?: boolean;
  show_collections?: boolean;
  header?: boolean;
  more_prompt?: boolean;
  skip_installed?: boolean;
}

/** nltk.downloader.Downloader — NLTK data server client (fetch-based). */
export class Downloader {
  static INDEX_TIMEOUT = 60 * 60;
  static DEFAULT_URL = "https://raw.githubusercontent.com/nltk/nltk_data/gh-pages/index.xml";

  static INSTALLED = "installed";
  static NOT_INSTALLED = "not installed";
  static STALE = "out of date";
  static PARTIAL = "partial";

  // Instance-level mirrors of the status constants (Python exposes them on
  // both the class and instances via attribute lookup).
  readonly INSTALLED = Downloader.INSTALLED;
  readonly NOT_INSTALLED = Downloader.NOT_INSTALLED;
  readonly STALE = Downloader.STALE;
  readonly PARTIAL = Downloader.PARTIAL;

  _url: string;
  _collections = new Map<string, Collection>();
  _packages = new Map<string, Package>();
  _download_dir: string | undefined;
  _index: XMLElement | null = null;
  _index_timestamp = 0;
  _status_cache = new Map<string, string>();
  _errors: boolean | null = null;
  private _warned_missing_sha256_checksum = false;

  constructor(server_index_url: string | null = null, download_dir: string | null = null) {
    this._url = server_index_url || Downloader.DEFAULT_URL;
    this._download_dir = download_dir ?? undefined;
    if (this._download_dir === undefined) {
      this._download_dir = this.default_download_dir();
    }
  }

  // { Information

  async list(options: ListOptions = {}): Promise<void> {
    const {
      download_dir: dArg = null,
      show_packages = true,
      show_collections = true,
      header = true,
      more_prompt = false,
      skip_installed = false,
    } = options;
    let download_dir = dArg;
    let lines = 0;
    if (download_dir === null || download_dir === undefined) {
      download_dir = this._download_dir ?? null;
      printStdout(`Using default data directory (${pyStr(download_dir)})`);
    }
    if (header) {
      printStdout("=".repeat(26 + this._url.length));
      printStdout(` Data server index for <${this._url}>`);
      printStdout("=".repeat(26 + this._url.length));
      lines += 3;
    }
    let stale = false;
    let partial = false;

    const categories: string[] = [];
    if (show_packages) categories.push("packages");
    if (show_collections) categories.push("collections");
    for (const category of categories) {
      printStdout(`${category.charAt(0).toUpperCase()}${category.slice(1)}:`);
      lines += 1;
      const items = category === "packages" ? await this.packages() : await this.collections();
      const sortedItems = [...items].sort((a, b) => {
        const sa = String(a);
        const sb = String(b);
        return sa < sb ? -1 : sa > sb ? 1 : 0;
      });
      for (const info of sortedItems) {
        const status = await this.status(info, download_dir);
        if (status === Downloader.INSTALLED && skip_installed) continue;
        if (status === Downloader.STALE) stale = true;
        if (status === Downloader.PARTIAL) partial = true;
        const prefix = {
          [Downloader.INSTALLED]: "*",
          [Downloader.STALE]: "-",
          [Downloader.PARTIAL]: "P",
          [Downloader.NOT_INSTALLED]: " ",
        }[status];
        const name = textwrapFill(
          "-".repeat(27) + (info.name || info.id),
          { width: 75, subsequent_indent: " ".repeat(27) },
        ).slice(27);
        printStdout(`  [${prefix}] ${info.id.padEnd(20, ".")} ${name}`);
        lines += name.split("\n").length;
        if (more_prompt && lines > 20) {
          const user_input = pyInput("Hit Enter to continue: ");
          if (["x", "q"].includes(user_input.toLowerCase())) return;
          lines = 0;
        }
      }
      printStdout();
    }
    let msg = "([*] marks installed packages";
    if (stale) msg += "; [-] marks out-of-date or corrupt packages";
    if (partial) msg += "; [P] marks partially installed collections";
    printStdout(textwrapFill(msg + ")", { width: 76, subsequent_indent: " " }));
  }

  async packages(): Promise<Package[]> {
    await this._update_index();
    return [...this._packages.values()];
  }

  async corpora(): Promise<Package[]> {
    await this._update_index();
    return [...this._packages.values()].filter((p) => p.subdir === "corpora");
  }

  async models(): Promise<Package[]> {
    await this._update_index();
    return [...this._packages.values()].filter((p) => p.subdir !== "corpora");
  }

  async collections(): Promise<Collection[]> {
    await this._update_index();
    return [...this._collections.values()];
  }

  // { Downloading

  private async _info_or_id(info_or_id: string | Package | Collection | null | undefined): Promise<Package | Collection> {
    if (typeof info_or_id === "string") {
      return this.info(info_or_id);
    }
    return info_or_id as Package;
  }

  async *incr_download(
    info_or_id: InfoOrId = null,
    download_dir: string | null = null,
    force = false,
  ): AsyncGenerator<DownloaderMessage> {
    // If they didn't specify a download_dir, then use the default one.
    let dir = download_dir;
    if (dir === null || dir === undefined) {
      dir = this._download_dir!;
      yield new SelectDownloadDirMessage(dir);
    }

    _authorizeDataDir(dir);

    // If they gave us a list of ids, then download each one.
    if (Array.isArray(info_or_id)) {
      yield* this._download_list(info_or_id, dir, force);
      return;
    }

    // Look up the requested collection or package.
    let info: Package | Collection;
    try {
      info = await this._info_or_id(info_or_id);
    } catch (e) {
      const pe = toPyErr(e);
      if (!(isOSError(pe) || pe.name === "ValueError")) throw e;
      yield new ErrorMessage(null, `Error loading ${pyStr(info_or_id)}: ${pe.message}`);
      return;
    }

    if (info instanceof Collection) {
      yield new StartCollectionMessage(info);
      yield* this.incr_download(info.children, dir, force);
      yield new FinishCollectionMessage(info);
    } else {
      yield* this._download_package(info as Package, dir, force);
    }
  }

  incrDownload(info_or_id: InfoOrId = null, download_dir: string | null = null, force = false): AsyncGenerator<DownloaderMessage> {
    return this.incr_download(info_or_id, download_dir, force);
  }

  private _num_packages(item: Package | Collection): number {
    if (item instanceof Package) return 1;
    return item.packages!.length;
  }

  private async *_download_list(
    items: (string | Package | Collection)[],
    download_dir: string,
    force: boolean,
  ): AsyncGenerator<DownloaderMessage> {
    // Look up the requested items.
    for (let i = 0; i < items.length; i++) {
      try {
        items[i] = await this._info_or_id(items[i]!);
      } catch (e) {
        const pe = toPyErr(e);
        if (!(isOSError(pe) || pe.name === "ValueError")) throw e;
        yield new ErrorMessage(items[i]!, pe);
        return;
      }
    }

    // Download each item, re-scaling their progress.
    const num_packages = items.reduce((n, it) => n + this._num_packages(it as Package), 0);
    let progress = 0;
    for (const item of items) {
      const delta = item instanceof Package
        ? pyDiv(1.0, num_packages)
        : pyDiv((item as Collection).packages!.length, num_packages);
      for await (const msg of this.incr_download(item as Package, download_dir, force)) {
        if (msg instanceof ProgressMessage) {
          yield new ProgressMessage(progress + msg.progress * delta);
        } else {
          yield msg;
        }
      }
      progress += 100 * delta;
    }
  }

  private async *_download_package(
    info: Package,
    download_dir: string,
    force: boolean,
  ): AsyncGenerator<DownloaderMessage> {
    yield new StartPackageMessage(info);
    yield new ProgressMessage(0);

    const filepath = pathJoin(download_dir, info.filename);
    const tmp_filepath = filepath + ".tmp";
    const lock_filepath = filepath + ".lock";

    const _within = (child: string, root: string): boolean => {
      try {
        return pyCommonpath([root, child]) === root;
      } catch {
        return false;
      }
    };

    const _symlink_contained = (p: string): boolean => {
      let ancestor = pathResolve(p);
      while (!lexists(ancestor)) {
        const parent = dirname(ancestor);
        if (parent === ancestor) break;
        ancestor = parent;
      }
      const lex_ancestor = normcase(ancestor);
      const lex_download = normcase(pathResolve(pyNormpath(download_dir)));
      if (_within(lex_download, lex_ancestor)) return true;
      const real_ancestor = normcase(pyRealpath(ancestor));
      const real_download = normcase(pyRealpath(download_dir));
      return _within(real_ancestor, real_download);
    };

    const safe_download = normcase(pathResolve(pyNormpath(download_dir)));
    const safe_filepath = normcase(pathResolve(pyNormpath(filepath)));
    if (!(
      _within(safe_filepath, safe_download) &&
      _symlink_contained(filepath) &&
      _symlink_contained(tmp_filepath)
    )) {
      yield new ErrorMessage(info,
        `Path traversal blocked: package '${info.id}' attempted to ` +
        `write outside download directory (subdir='${info.subdir}')`);
      return;
    }

    const unzipdir = filepath.endsWith(".zip") ? filepath.slice(0, -4) : null;
    const MAX_ZOMBIE_TIME = 60;
    const POLL_INTERVAL = 1;

    const _safe_remove = (p: string): void => {
      try { unlinkSync(p); } catch { /* pass */ }
    };

    const _safe_rmtree = (p: string): void => {
      if (isLink(p)) { _safe_remove(p); return; }
      if (!isDir(p)) return;
      for (const [dir, dirs, files] of walkBottomUp(p)) {
        for (const name of files) {
          try { unlinkSync(pathJoin(dir, name)); } catch { /* pass */ }
        }
        for (const name of dirs) {
          const full = pathJoin(dir, name);
          if (isLink(full)) { _safe_remove(full); continue; }
          try { rmdirSync(full); } catch { /* pass */ }
        }
      }
      try { rmdirSync(p); } catch { /* pass */ }
    };

    const _touch_lock = (): void => {
      try { utimesSync(lock_filepath, new Date(), new Date()); } catch { /* pass */ }
    };

    const _lock_exists = (): boolean => existsSync(lock_filepath);

    const _status_now = async (): Promise<string> => {
      this._status_cache.delete(info.id);
      return this.status(info, download_dir);
    };

    const _installed_now = async (): Promise<boolean> => (await _status_now()) === Downloader.INSTALLED;

    mkdirSync(download_dir, { recursive: true });
    mkdirSync(pathJoin(download_dir, info.subdir), { recursive: true });

    // Fast path before taking the lock.
    if (!force && (await _installed_now()) && !_lock_exists()) {
      yield new UpToDateMessage(info);
      yield new ProgressMessage(100);
      yield new FinishPackageMessage(info);
      return;
    }

    // Acquire a package-wide install lock that covers download + unzip.
    for (;;) {
      if (!force && (await _installed_now()) && !_lock_exists()) {
        yield new UpToDateMessage(info);
        yield new ProgressMessage(100);
        yield new FinishPackageMessage(info);
        return;
      }
      try {
        const fd = openSync(lock_filepath, "wx");
        closeSync(fd);
        break;
      } catch (e) {
        if ((e as { code?: string }).code === "EEXIST") {
          try {
            const age = Date.now() / 1000 - statSync(lock_filepath).mtimeMs / 1000;
            if (age >= MAX_ZOMBIE_TIME) {
              _safe_remove(lock_filepath);
              continue;
            }
          } catch {
            continue;
          }
          await sleep(POLL_INTERVAL * 1000);
        } else {
          throw e;
        }
      }
    }

    try {
      // Recheck after lock acquisition in case another process completed first.
      if (!force && (await _installed_now())) {
        yield new UpToDateMessage(info);
        yield new ProgressMessage(100);
        yield new FinishPackageMessage(info);
        return;
      }

      const status = await _status_now();

      // Only the lock holder may clean stale state.
      if (status === Downloader.STALE) {
        yield new StaleMessage(info);
        _safe_remove(tmp_filepath);
        _safe_remove(filepath);
        if (unzipdir) _safe_rmtree(unzipdir);
        this._status_cache.delete(info.id);
      }

      // Download if needed.
      if (force || !existsSync(filepath)) {
        yield new StartDownloadMessage(info);
        yield new ProgressMessage(5);

        try {
          let res: Response;
          try {
            res = await pathsecUrlopen(info.url);
          } catch (e) {
            throw urlerror(e);
          }
          if (res.status >= 400) {
            throw pyError("HTTPError", `HTTP Error ${res.status}: ${res.statusText}`);
          }
          const data = new Uint8Array(await res.arrayBuffer());

          validate_path(tmp_filepath, "Downloader._download_package", download_dir);
          const fd = openSync(tmp_filepath, "w");
          try {
            const num_blocks = Math.max(1, info.size / (1024 * 16));
            let off = 0;
            for (let block = 0; ; block++) {
              const s = data.subarray(off, off + 1024 * 16);
              if (!s.length) break;
              writeSync(fd, s);
              off += s.length;
              if (block % 2 === 0) {
                _touch_lock();
                yield new ProgressMessage(Math.min(80, 5 + 75 * (block / num_blocks)));
              }
            }
          } finally {
            closeSync(fd);
          }

          // Integrity check on the temp file BEFORE replacing the destination.
          const tmp_size = statSync(tmp_filepath).size;
          if (tmp_size !== info.size) {
            _safe_remove(tmp_filepath);
            yield new ErrorMessage(info,
              `Integrity check failed for ${pyReprStr(info.id)}: ` +
              `size mismatch (got ${tmp_size}, expected ${info.size})`);
            return;
          }

          const sha256_checksum = info["sha256_checksum"] as string | undefined;
          if (sha256_checksum) {
            if (sha256_hexdigest(tmp_filepath) !== sha256_checksum) {
              _safe_remove(tmp_filepath);
              yield new ErrorMessage(info,
                `Integrity check failed for ${pyReprStr(info.id)}: sha256 mismatch`);
              return;
            }
          } else {
            const md5_checksum = info.checksum;
            if (md5_checksum && md5_hexdigest(tmp_filepath) !== md5_checksum) {
              _safe_remove(tmp_filepath);
              yield new ErrorMessage(info,
                `Integrity check failed for ${pyReprStr(info.id)}: md5 mismatch`);
              return;
            }
          }

          validate_path(filepath, "Downloader._download_package", download_dir);
          renameSync(tmp_filepath, filepath);
          this._status_cache.delete(info.id);
        } catch (e) {
          let pe = toPyErr(e);
          if (!isOSError(pe)) {
            // urllib surfaces transport failures as URLError (an OSError);
            // fetch() throws TypeError instead — translate for parity.
            if (e instanceof TypeError) pe = urlerror(e);
            else throw e;
          }
          _safe_remove(tmp_filepath);
          yield new ErrorMessage(info,
            `Error downloading ${pyReprStr(info.id)} from <${info.url}>:\n  ${pe.message}`);
          return;
        }

        yield new FinishDownloadMessage(info);
        yield new ProgressMessage(80);
      }

      // Unzip while still holding the same install lock.
      if (info.filename.endsWith(".zip")) {
        const zipdir = pathJoin(download_dir, info.subdir);
        if (info.unzip || existsSync(pathJoin(zipdir, info.id))) {
          yield new StartUnzipMessage(info);
          for (const msg of _unzip_iter(filepath, zipdir, false, info.id)) {
            _touch_lock();
            msg.package = info;
            yield msg;
            if (msg instanceof ErrorMessage) return;
          }
          yield new FinishUnzipMessage(info);
        }
      }

      // Final verification: followers should only ever observe INSTALLED.
      if (!(await _installed_now())) {
        yield new ErrorMessage(info,
          `Package ${pyReprStr(info.id)} did not reach installed state ` +
          `(final status: ${await _status_now()})`);
        return;
      }

      yield new FinishPackageMessage(info);
    } finally {
      _safe_remove(tmp_filepath);
      _safe_remove(lock_filepath);
    }
  }

  async download(
    info_or_id: InfoOrId = null,
    download_dir: string | null = null,
    options: DownloadOptions = {},
  ): Promise<boolean> {
    const {
      quiet = false,
      force = false,
      prefix = "[nltk_data] ",
      halt_on_error = true,
      raise_on_error = false,
      print_error_to = null,
      hf = false,
    } = options;

    if (hf && info_or_id != null) {
      throw pyError("NotImplementedError", "nltk.downloader.download(hf=True) delegates to nltk.huggingface.dataset.download — not ported");
    }

    const print_to = (s: string) => {
      (print_error_to ?? stderrStream()).write(s + "\n");
    };

    // If no info or id is given, then use the interactive shell.
    if (info_or_id === null || info_or_id === undefined) {
      if (download_dir !== null && download_dir !== undefined) {
        this._download_dir = download_dir;
      }
      return this._interactive_download();
    }

    let dlDir = download_dir;
    let curPrefix = prefix;
    const show = (s: string, prefix2 = ""): void => {
      print_to(textwrapFill(s, {
        width: 70,
        initial_indent: curPrefix + prefix2,
        subsequent_indent: curPrefix + prefix2 + " ".repeat(4),
      }));
    };

    for await (const msg of this.incr_download(info_or_id, dlDir, force)) {
      // Error messages
      if (msg instanceof ErrorMessage) {
        show(msg.message);
        if (raise_on_error) throw pyError("ValueError", msg.message);
        if (halt_on_error) return false;
        this._errors = true;
        if (!quiet) {
          print_to("Error installing package. Retry? [n/y/e]");
          const choice = pyStrip(pyInput());
          if (choice === "y" || choice === "Y") {
            const pkg = msg.package;
            if (pkg === null || typeof pkg === "string") {
              throw pyError("AttributeError", `'${pyTypeName(pkg)}' object has no attribute 'id'`);
            }
            if (!(await this.download(pkg.id, dlDir, { quiet, force, prefix: curPrefix, halt_on_error, raise_on_error }))) {
              return false;
            }
          } else if (choice === "e" || choice === "E") {
            return false;
          }
        }
      }

      // All other messages
      if (!quiet) {
        if (msg instanceof StartCollectionMessage) {
          show(`Downloading collection ${pyReprStr(msg.collection.id)}`);
          curPrefix += "   | ";
          print_to(curPrefix);
        } else if (msg instanceof FinishCollectionMessage) {
          print_to(curPrefix);
          curPrefix = curPrefix.slice(0, -4);
          if (this._errors) {
            show(`Downloaded collection ${pyReprStr(msg.collection.id)} with errors`);
          } else {
            show(`Done downloading collection ${msg.collection.id}`);
          }
        } else if (msg instanceof StartPackageMessage) {
          show(`Downloading package ${msg.package.id} to ${dlDir}...`);
        } else if (msg instanceof UpToDateMessage) {
          show(`Package ${msg.package.id} is already up-to-date!`, "  ");
        } else if (msg instanceof StartUnzipMessage) {
          show(`Unzipping ${msg.package.filename}.`, "  ");
        } else if (msg instanceof SelectDownloadDirMessage) {
          dlDir = msg.download_dir;
        }
      }
    }
    return true;
  }

  async is_stale(info_or_id: string | Package | Collection, download_dir: string | null = null): Promise<boolean> {
    return (await this.status(info_or_id, download_dir)) === Downloader.STALE;
  }
  async isStale(info_or_id: string | Package | Collection, download_dir: string | null = null): Promise<boolean> {
    return this.is_stale(info_or_id, download_dir);
  }

  async is_installed(info_or_id: string | Package | Collection, download_dir: string | null = null): Promise<boolean> {
    return (await this.status(info_or_id, download_dir)) === Downloader.INSTALLED;
  }
  async isInstalled(info_or_id: string | Package | Collection, download_dir: string | null = null): Promise<boolean> {
    return this.is_installed(info_or_id, download_dir);
  }

  clear_status_cache(id: string | null = null): void {
    if (id === null || id === undefined) this._status_cache.clear();
    else this._status_cache.delete(id);
  }
  clearStatusCache(id: string | null = null): void {
    this.clear_status_cache(id);
  }

  async status(info_or_id: string | Package | Collection, download_dir: string | null = null): Promise<string> {
    const dir = download_dir ?? this._download_dir!;
    const info = await this._info_or_id(info_or_id);

    if (info instanceof Collection) {
      const pkg_status: string[] = [];
      for (const pkg of info.packages!) {
        pkg_status.push(await this.status(pkg.id));
      }
      if (pkg_status.includes(Downloader.STALE)) return Downloader.STALE;
      if (pkg_status.includes(Downloader.PARTIAL)) return Downloader.PARTIAL;
      if (pkg_status.includes(Downloader.INSTALLED) && pkg_status.includes(Downloader.NOT_INSTALLED)) {
        return Downloader.PARTIAL;
      }
      if (pkg_status.includes(Downloader.NOT_INSTALLED)) return Downloader.NOT_INSTALLED;
      return Downloader.INSTALLED;
    }

    const filepath = pathJoin(dir, (info as Package).filename);
    if (dir !== this._download_dir) {
      return this._pkg_status(info as Package, filepath);
    }
    if (!this._status_cache.has(info.id)) {
      this._status_cache.set(info.id, this._pkg_status(info as Package, filepath));
    }
    return this._status_cache.get(info.id)!;
  }

  private _pkg_status(info: Package, filepath: string): string {
    if (!existsSync(filepath)) return Downloader.NOT_INSTALLED;

    // Check if the file has the correct size.
    let filestat;
    try {
      filestat = statSync(filepath);
    } catch {
      return Downloader.NOT_INSTALLED;
    }
    if (filestat.size !== info.size) return Downloader.STALE;

    // Check if the file's checksum matches (sha256 preferred, md5 fallback).
    const sha256_checksum = info["sha256_checksum"] as string | undefined;
    if (sha256_checksum) {
      if (sha256_hexdigest(filepath) !== sha256_checksum) return Downloader.STALE;
    } else {
      if (!this._warned_missing_sha256_checksum) {
        emitWarning(
          "NLTK downloader package metadata is missing SHA256 checksums; " +
          "falling back to legacy MD5 verification. Consider updating your " +
          "NLTK data index (or re-running the downloader) to get SHA256 checksums.",
          "RuntimeWarning",
        );
        this._warned_missing_sha256_checksum = true;
      }
      const md5_checksum = info.checksum;
      if (!md5_checksum) return Downloader.STALE;
      if (md5_hexdigest(filepath) !== md5_checksum) return Downloader.STALE;
    }

    // If it's a zipfile, and it's been at least partially unzipped, check
    // whether it's been fully unzipped.
    if (filepath.endsWith(".zip")) {
      const unzipdir = filepath.slice(0, -4);
      if (!existsSync(unzipdir)) {
        return info.unzip ? Downloader.NOT_INSTALLED : Downloader.INSTALLED;
      }
      if (!isDir(unzipdir)) return Downloader.STALE;

      let unzipped_size = 0;
      for (const f of walkAllFiles(unzipdir)) {
        try { unzipped_size += statSync(f).size; } catch { /* pass */ }
      }
      if (unzipped_size !== info.unzipped_size) return Downloader.STALE;
    }

    return Downloader.INSTALLED;
  }

  async update(options: { quiet?: boolean; prefix?: string } = {}): Promise<void> {
    const { quiet = false, prefix = "[nltk_data] " } = options;
    this.clear_status_cache();
    for (const pkg of await this.packages()) {
      if ((await this.status(pkg)) === Downloader.STALE) {
        await this.download(pkg, null, { quiet, prefix });
      }
    }
  }

  // { Index

  private async _update_index(url: string | null = null): Promise<void> {
    // If the index is fresh, do nothing.
    if (!(
      this._index === null ||
      url !== null ||
      Date.now() / 1000 - this._index_timestamp > Downloader.INDEX_TIMEOUT
    )) {
      return;
    }

    if (url !== null) this._url = url;

    // Download the index file.
    let res: Response;
    try {
      res = await pathsecUrlopen(this._url);
    } catch (e) {
      throw urlerror(e);
    }
    if (res.status >= 400) {
      throw pyError("HTTPError", `HTTP Error ${res.status}: ${res.statusText}`);
    }
    this._index = safeParseXml(await res.text());
    this._index_timestamp = Date.now() / 1000;

    // Build a dictionary of packages.
    const packages = this._index.findall("packages/package").map((p) => Package.fromxml(p));
    this._packages = new Map(packages.map((p) => [p.id, p]));

    // Build a dictionary of collections.
    const collections = this._index.findall("collections/collection").map((c) => Collection.fromxml(c));
    this._collections = new Map(collections.map((c) => [c.id, c]));

    // Replace identifiers with actual children in collection.children.
    for (const collection of this._collections.values()) {
      for (let i = 0; i < collection.children.length; i++) {
        const child_id = collection.children[i]!;
        if (typeof child_id === "string" && this._packages.has(child_id)) {
          collection.children[i] = this._packages.get(child_id)!;
        } else if (typeof child_id === "string" && this._collections.has(child_id)) {
          collection.children[i] = this._collections.get(child_id)!;
        } else {
          printStdout(`removing collection member with no package: ${pyStr(child_id)}`);
          collection.children.splice(i, 1);
        }
      }
    }

    // Fill in collection.packages for each collection.
    for (const collection of this._collections.values()) {
      const packages = new Map<string, Package>();
      const queue: (string | Package | Collection)[] = [collection];
      for (const child of queue) {
        if (child instanceof Collection) {
          queue.push(...child.children);
        } else if (child instanceof Package) {
          packages.set(child.id, child);
        }
      }
      collection.packages = [...packages.values()];
    }

    // Flush the status cache.
    this._status_cache.clear();
  }

  async index(): Promise<XMLElement> {
    await this._update_index();
    return this._index!;
  }

  async info(id: string): Promise<Package | Collection> {
    await this._update_index();
    const pkg = this._packages.get(id);
    if (pkg !== undefined) return pkg;
    const col = this._collections.get(id);
    if (col !== undefined) return col;
    throw pyError("ValueError", `Package ${pyReprStr(id)} not found in index`);
  }

  async xmlinfo(id: string): Promise<XMLElement> {
    await this._update_index();
    for (const pkg of this._index!.findall("packages/package")) {
      if (pkg.get("id") === id) return pkg;
    }
    for (const col of this._index!.findall("collections/collection")) {
      if (col.get("id") === id) return col;
    }
    throw pyError("ValueError", `Package ${pyReprStr(id)} not found in index`);
  }

  // { URL & Data Directory

  /** The URL for the data server's index file (get-only; use setUrl). */
  get url(): string {
    return this._url;
  }

  /** Python's url setter — async here because it re-downloads the index. */
  async setUrl(url: string): Promise<void> {
    const original_url = this._url;
    try {
      await this._update_index(url);
    } catch (e) {
      this._url = original_url;
      throw e;
    }
  }

  /** nltk.downloader.Downloader.default_download_dir. */
  default_download_dir(): string | undefined {
    if (typeof process !== "undefined" && process.env && "APPENGINE_RUNTIME" in process.env) {
      return undefined;
    }

    for (const nltkdir of dataPath) {
      if (existsSync(nltkdir) && isWritable(nltkdir)) return nltkdir;
    }

    let homedirStr: string;
    if (process.platform === "win32" && process.env["APPDATA"]) {
      homedirStr = process.env["APPDATA"]!;
    } else {
      const home = process.env?.["HOME"] ?? safeHomedir();
      if (home === undefined || home === "" || home === "~/") {
        throw pyError("ValueError", "Could not find a default download directory");
      }
      homedirStr = home;
    }
    return pathJoin(homedirStr, "nltk_data");
  }
  defaultDownloadDir(): string | undefined {
    return this.default_download_dir();
  }

  get download_dir(): string | undefined {
    return this._download_dir;
  }

  set download_dir(download_dir: string | undefined) {
    this._download_dir = download_dir;
    this._status_cache.clear();
  }

  // { Interactive Shell — out of scope (Tk / cmd loop)

  protected _interactive_download(): never {
    throw pyError("NotImplementedError",
      "interactive download (DownloaderGUI/DownloaderShell) is out of scope for this runtime");
  }
}

function safeHomedir(): string | undefined {
  try {
    const h = homedir();
    return h || undefined;
  } catch {
    return undefined;
  }
}

// { fs walk helpers

/** DirEntry.is_dir(follow_symlinks=True): symlinks classify by target. */
function entryIsDir(dir: string, ent: { name: string; isDirectory(): boolean; isSymbolicLink(): boolean }): boolean {
  if (ent.isDirectory()) return true;
  if (ent.isSymbolicLink()) return isDir(pathJoin(dir, ent.name));
  return false;
}

/** os.walk(top, topdown=False): [dir, dirs[], files[]] bottom-up; symlinked
 * dirs are listed but never descended into (followlinks=False). */
function walkBottomUp(root: string): [string, string[], string[]][] {
  const out: [string, string[], string[]][] = [];
  const visit = (dir: string): void => {
    const dirs: string[] = [];
    const files: string[] = [];
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      if (entryIsDir(dir, ent)) dirs.push(ent.name);
      else files.push(ent.name);
    }
    for (const name of dirs) {
      const full = pathJoin(dir, name);
      if (isLink(full)) continue;
      if (isDir(full)) visit(full);
    }
    out.push([dir, dirs, files]);
  };
  visit(root);
  return out;
}

/** All files under root (os.walk, following real dirs only). Symlinked files
 * are counted (os.stat follows); symlinked dirs are listed but not entered. */
function* walkAllFiles(root: string): Generator<string> {
  for (const ent of readdirSync(root, { withFileTypes: true })) {
    const full = pathJoin(root, ent.name);
    if (entryIsDir(root, ent)) {
      if (!ent.isSymbolicLink()) yield* walkAllFiles(full);
    } else {
      yield full;
    }
  }
}

/** os.walk(root) yielding [dir, subdirs, files] top-down; ".svn" pruned. */
function* walkTopDown(root: string): Generator<[string, string[], string[]]> {
  if (!isDir(root)) return;
  const dirs: string[] = [];
  const files: string[] = [];
  for (const ent of readdirSync(root, { withFileTypes: true })) {
    if (entryIsDir(root, ent)) dirs.push(ent.name);
    else files.push(ent.name);
  }
  const kept = dirs.filter((d) => d !== ".svn");
  yield [root, kept, files];
  for (const d of kept) {
    const full = pathJoin(root, d);
    if (isLink(full)) continue; // os.walk(followlinks=False) never descends
    yield* walkTopDown(full);
  }
}

// ---------------------------------------------------------------------------
// Index Builder
// ---------------------------------------------------------------------------

/** nltk.corpus.reader.util._path_from. */
function _path_from(parent: string, child: string): string[] {
  let p = parent;
  if (pySplit(p)[1] === "") p = pySplit(p)[0];
  const path: string[] = [];
  let c = child;
  while (p !== c) {
    const [head, tail] = pySplit(c);
    c = head;
    path.unshift(tail);
    if (pySplit(c)[0] === c) {
      throw pyError("AssertionError", "");
    }
  }
  return path;
}

interface FoundPackage {
  pkg_xml: XMLElement;
  zf: OpenOnDemandZipFile;
  subdir: string;
}

/** nltk.downloader._find_packages. */
function* _find_packages(root: string): Generator<FoundPackage> {
  for (const [dirname_, , files] of walkTopDown(root)) {
    const relpath = _path_from(root, dirname_).join("/");
    for (const filename of files) {
      if (filename.endsWith(".xml")) {
        const xmlfilename = pathJoin(dirname_, filename);
        const zipfilename = xmlfilename.slice(0, -4) + ".zip";
        let zf: OpenOnDemandZipFile;
        try {
          validate_path(zipfilename, "pathsec.ZipFile");
          zf = new OpenOnDemandZipFile(zipfilename);
          zf.namelist(); // eager open like zipfile.ZipFile
        } catch (e) {
          const pe = toPyErr(e);
          const msg = pe.name === "BadZipFile" ? "File is not a zip file" : pe.message;
          throw pyError("ValueError", `Error reading file ${pyReprStr(zipfilename)}!\n${msg}`);
        }
        let pkg_xml: XMLElement;
        try {
          pkg_xml = safeParseXmlFile(xmlfilename);
        } catch (e) {
          throw pyError("ValueError", `Error reading file ${pyReprStr(xmlfilename)}!\n${strErr(toPyErr(e))}`);
        }

        // Check that the UID matches the filename.
        const uid = pySplit(xmlfilename.slice(0, -4))[1];
        if (pkg_xml.get("id") !== uid) {
          throw pyError("ValueError",
            `package identifier mismatch (${pkg_xml.get("id")} vs ${uid})`);
        }

        // Check that the zipfile expands to a subdir whose name matches uid.
        const names = zf.namelist();
        if (names.filter((name) => name !== uid && !name.startsWith(uid + "/")).length) {
          throw pyError("ValueError",
            `Zipfile ${uid}.zip does not expand to a single subdirectory ${uid}/`);
        }

        yield { pkg_xml, zf, subdir: relpath };
      } else if (filename.endsWith(".zip")) {
        // Warn user in case a .xml does not exist for a .zip.
        const resourcename = pySplitext(filename)[0];
        const xmlfilename = pathJoin(dirname_, resourcename + ".xml");
        if (!existsSync(xmlfilename)) {
          emitWarning(
            `${filename} exists, but ${resourcename + ".xml"} cannot be found! ` +
            `This could mean that ${resourcename} can not be downloaded.`,
          );
        }
      }
    }
  }
}

/** nltk.downloader._find_collections. */
function* _find_collections(root: string): Generator<XMLElement> {
  for (const [dirname_, , files] of walkTopDown(root)) {
    for (const filename of files) {
      if (filename.endsWith(".xml")) {
        yield safeParseXmlFile(pathJoin(dirname_, filename));
      }
    }
  }
}

/** nltk.downloader._indent_xml — 2-space indented element tree. */
function _indent_xml(xml: XMLElement, prefix = ""): void {
  if (xml.children.length > 0) {
    xml.text = pyStrip(xml.text ?? "") + "\n" + prefix + "  ";
    for (const child of xml.children) {
      _indent_xml(child, prefix + "  ");
    }
    for (const child of xml.children.slice(0, -1)) {
      child.tail = pyStrip(child.tail ?? "") + "\n" + prefix + "  ";
    }
    const last = xml.children[xml.children.length - 1]!;
    last.tail = pyStrip(last.tail ?? "") + "\n" + prefix;
  }
}

/** nltk.downloader.build_index — scan a local package tree, build index xml. */
export function build_index(root: string, base_url: string): XMLElement {
  _authorizeDataDir(root);

  // Find all packages.
  const packages: XMLElement[] = [];
  for (const { pkg_xml, zf, subdir } of _find_packages(pathJoin(root, "packages"))) {
    const zipstat = statSync(zf.filename);
    const url = `${base_url}/${subdir}/${pySplit(zf.filename)[1]}`;
    const unzipped_size = zf.infolist().reduce((n, i) => n + i.file_size, 0);

    // Fill in several fields of the package xml with calculated values.
    pkg_xml.set("unzipped_size", `${unzipped_size}`);
    pkg_xml.set("size", `${zipstat.size}`);
    pkg_xml.set("checksum", `${md5_hexdigest(zf.filename)}`);
    pkg_xml.set("sha256_checksum", `${sha256_hexdigest(zf.filename)}`);
    pkg_xml.set("subdir", subdir);
    if (!pkg_xml.get("url")) {
      pkg_xml.set("url", url);
    }
    packages.push(pkg_xml);
  }

  // Find all collections.
  const collections = [..._find_collections(pathJoin(root, "collections"))];

  // Check that all UIDs are unique.
  const uids = new Set<string | null>();
  for (const item of [...packages, ...collections]) {
    const id = item.get("id");
    if (uids.has(id)) {
      throw pyError("ValueError", `Duplicate UID: ${id}`);
    }
    uids.add(id);
  }

  // Put it all together.
  const topElt = new XMLElement("nltk_data");
  const packagesElt = new XMLElement("packages");
  packagesElt.children = packages
    .slice()
    .sort((a, b) => {
      const ka = a.get("id") ?? "";
      const kb = b.get("id") ?? "";
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  topElt.append(packagesElt);
  const collectionsElt = new XMLElement("collections");
  collectionsElt.children = collections
    .slice()
    .sort((a, b) => {
      const ka = a.get("id") ?? "";
      const kb = b.get("id") ?? "";
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  topElt.append(collectionsElt);

  _indent_xml(topElt);
  return topElt;
}

// ---------------------------------------------------------------------------
// Out-of-scope interactive surfaces (kept as honest stubs)
// ---------------------------------------------------------------------------

function unsupportedDownloader(name: string): never {
  throw pyError("NotImplementedError",
    `nltk.downloader.${name} requires an interactive UI (Tk / cmd loop), which is out of scope for this runtime`);
}

/** nltk.downloader.DownloaderGUI — Tk GUI (not ported). */
export class DownloaderGUI {
  constructor() { unsupportedDownloader("DownloaderGUI"); }
}
/** nltk.downloader.DownloaderShell — interactive cmd loop (not ported). */
export class DownloaderShell {
  constructor() { unsupportedDownloader("DownloaderShell"); }
}
export function download_gui(..._a: unknown[]): never {
  return unsupportedDownloader("download_gui");
}
export function download_shell(..._a: unknown[]): never {
  return unsupportedDownloader("download_shell");
}

// ---------------------------------------------------------------------------
// Module-level singleton — nltk.downloader._downloader
// ---------------------------------------------------------------------------

let _singleton: Downloader | null = null;

/** Lazily created module-level downloader (Python builds it at import). */
export function defaultDownloader(): Downloader {
  if (_singleton === null) _singleton = new Downloader();
  return _singleton;
}

/** nltk.downloader._downloader — lazy proxy over the module singleton. */
export const _downloader: Downloader = new Proxy({} as Downloader, {
  get: (_t, p) => {
    const inst = defaultDownloader();
    const v = Reflect.get(inst, p, inst);
    return typeof v === "function" ? v.bind(inst) : v;
  },
  set: (_t, p, v) => Reflect.set(defaultDownloader(), p, v),
  has: (_t, p) => p in defaultDownloader(),
});

/** nltk.downloader.download = _downloader.download. */
export function download(
  info_or_id: InfoOrId = null,
  download_dir: string | null = null,
  options: DownloadOptions = {},
): Promise<boolean> {
  return defaultDownloader().download(info_or_id, download_dir, options);
}

/** nltk.downloader.update = _downloader.update. */
export async function update(): Promise<void> {
  return defaultDownloader().update();
}
