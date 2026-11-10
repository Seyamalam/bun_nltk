// nltk.corpus.reader.util — corpus views, block readers, concat, file discovery.
// Original: nltk/corpus/reader/util.py

import { readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join as pathJoin, relative, resolve as pathResolve, sep } from "node:path";
import { pyError } from "./internals";
import { AbstractLazySequence, LazyConcatenation, LazySubsequence } from "./collections";
import { FileSystemPathPointer, PathPointer, ZipFilePathPointer } from "./data";
import { SeekableUnicodeStreamReader } from "./corpus_stream";
import { wordpunct_tokenize } from "./nltk_compat";

export type BlockReader<T> = (stream: SeekableUnicodeStreamReader) => T[];

function bisectRight<T>(arr: T[], x: T, cmp: (a: T, b: T) => number = (a, b) => (a as number) - (b as number)): number {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cmp(x, arr[mid]!) < 0) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/** nltk.corpus.reader.util.StreamBackedCorpusView — lazily read token blocks. */
export class StreamBackedCorpusView<T = unknown> extends AbstractLazySequence<T> {
  protected _fileid: string | PathPointer;
  protected _encoding: string | null;
  protected _stream: SeekableUnicodeStreamReader | null = null;
  protected _toknum: number[];
  protected _filepos: number[];
  protected _len: number | null = null;
  protected _eofpos: number;
  protected _cache: [number, number, T[] | null] = [-1, -1, null];
  _current_toknum: number | null = null;
  _current_blocknum: number | null = null;
  read_block: (stream: SeekableUnicodeStreamReader) => T[] = (stream) => { void stream; throw pyError("NotImplementedError", "Abstract Method"); };

  constructor(fileid: string | PathPointer, blockReader?: BlockReader<T>, startpos = 0, encoding: string | null = "utf-8") {
    super();
    if (blockReader) this.read_block = blockReader;
    this._toknum = [0];
    this._filepos = [startpos];
    this._encoding = encoding;
    this._fileid = fileid;
    try {
      this._eofpos = fileid instanceof PathPointer ? fileid.file_size() : statSync(fileid).size;
    } catch (e) {
      throw pyError("ValueError", `Unable to open or access '${String(fileid)}' -- ${(e as Error).message}`);
    }
    // The byte size is only a bound; _open() replaces it with the decoded length.
    this._eofpos = Number.MAX_SAFE_INTEGER;
  }

  get fileid(): string | PathPointer {
    return this._fileid;
  }

  protected _open(): void {
    if (this._fileid instanceof PathPointer) {
      this._stream = this._fileid.open(this._encoding);
    } else {
      this._stream = new SeekableUnicodeStreamReader(
        new Uint8Array(readFileSyncNode(this._fileid)), this._encoding);
    }
    // Positions are in decoded characters, so eof is the decoded length.
    this._eofpos = this._stream.charLength;
  }

  close(): void {
    if (this._stream !== null) this._stream.close();
    this._stream = null;
  }

  get length(): number {
    if (this._len === null) {
      for (const _tok of this.iterate_from(this._toknum[this._toknum.length - 1]!)) void _tok;
    }
    return this._len!;
  }

  get(index: number): T {
    let i = index;
    if (i < 0) i += this.length;
    if (i < 0) throw pyError("IndexError", "index out of range");
    const offset = this._cache[0]!;
    if (offset <= i && i < this._cache[1]!) return this._cache[2]![i - offset]!;
    const it = this.iterate_from(i);
    const next = it.next();
    if (next.done) throw pyError("IndexError", "index out of range");
    return next.value;
  }

  /** Slice access (adaptation of __getitem__ slice -> LazySubsequence). */
  slice(start?: number, stop?: number): T[] | LazySubsequence<T> {
    const [s, e] = sliceBounds(this.length, start, stop);
    const offset = this._cache[0];
    if (offset <= s && e <= this._cache[1]) return this._cache[2]!.slice(s - offset, e - offset);
    return new LazySubsequence(this, s, e);
  }

  *iterate_from(startTok: number): Generator<T> {
    let toknum = startTok;
    // Feed from the cache if possible.
    if (this._cache[0] <= toknum && toknum < this._cache[1]) {
      for (const tok of this._cache[2]!.slice(toknum - this._cache[0])) {
        yield tok;
        toknum += 1;
      }
    }

    let blockIndex: number;
    let blockToknum: number;
    let filepos: number;
    if (toknum < this._toknum[this._toknum.length - 1]!) {
      blockIndex = bisectRight(this._toknum, toknum) - 1;
      blockToknum = this._toknum[blockIndex]!;
      filepos = this._filepos[blockIndex]!;
    } else {
      blockIndex = this._toknum.length - 1;
      blockToknum = this._toknum[blockIndex]!;
      filepos = this._filepos[blockIndex]!;
    }

    if (this._stream === null) this._open();
    if (this._eofpos === 0) this._len = 0;

    while (filepos < this._eofpos) {
      this._stream!.seek(filepos);
      this._current_toknum = blockToknum;
      this._current_blocknum = blockIndex;
      const tokens = this.read_block(this._stream!);
      const numToks = tokens.length;
      const newFilepos = this._stream!.tell();
      if (newFilepos <= filepos) {
        throw pyError("AssertionError", `block reader read_block() should consume at least 1 byte (filepos=${filepos})`);
      }

      this._cache = [blockToknum, blockToknum + numToks, [...tokens]];
      if (numToks > 0) {
        blockIndex += 1;
        if (blockToknum === this._toknum[this._toknum.length - 1]) {
          this._filepos.push(newFilepos);
          this._toknum.push(blockToknum + numToks);
        }
      }

      if (newFilepos === this._eofpos) this._len = blockToknum + numToks;
      for (const tok of tokens.slice(Math.max(0, toknum - blockToknum))) yield tok;
      if (newFilepos === this._eofpos) break;
      blockToknum += numToks;
      filepos = newFilepos;
    }
    this.close();
  }

  /** Concatenation helpers (adaptation of __add__/__mul__). */
  add(other: unknown): unknown {
    return concat([this, other]);
  }

  mul(count: number): unknown {
    return concat(Array.from({ length: count }, () => this));
  }
}

function readFileSyncNode(path: string): Uint8Array {
  return new Uint8Array(readFileSync(path));
}

/** nltk.corpus.reader.util.ConcatenatedCorpusView — join multiple views, one handle. */
export class ConcatenatedCorpusView<T = unknown> extends AbstractLazySequence<T> {
  private _pieces: StreamBackedCorpusView<T>[];
  private _offsets = [0];
  private _openPiece: StreamBackedCorpusView<T> | null = null;

  constructor(corpusViews: StreamBackedCorpusView<T>[]) {
    super();
    this._pieces = corpusViews;
  }

  get length(): number {
    if (this._offsets.length <= this._pieces.length) {
      for (const _tok of this.iterate_from(this._offsets[this._offsets.length - 1]!)) void _tok;
    }
    return this._offsets[this._offsets.length - 1]!;
  }

  get(index: number): T {
    let i = index;
    if (i < 0) i += this.length;
    if (i < 0) throw pyError("IndexError", "index out of range");
    const it = this.iterate_from(i);
    const next = it.next();
    if (next.done) throw pyError("IndexError", "index out of range");
    return next.value;
  }

  close(): void {
    for (const piece of this._pieces) piece.close();
  }

  *iterate_from(startTok: number): Generator<T> {
    let piecenum = bisectRight(this._offsets, startTok) - 1;
    while (piecenum < this._pieces.length) {
      const offset = this._offsets[piecenum]!;
      const piece = this._pieces[piecenum]!;
      if (this._openPiece !== piece) {
        if (this._openPiece !== null) this._openPiece.close();
        this._openPiece = piece;
      }
      yield* piece.iterate_from(Math.max(0, startTok - offset));
      if (piecenum + 1 === this._offsets.length) {
        this._offsets.push(this._offsets[this._offsets.length - 1]! + piece.length);
      }
      piecenum += 1;
    }
  }
}

/** nltk.corpus.reader.util.concat — pick the right concatenation for doc types. */
export function concat(docs: unknown[]): unknown {
  if (docs.length === 1) return docs[0];
  if (docs.length === 0) throw pyError("ValueError", "concat() expects at least one object!");
  if (docs.every((d) => typeof d === "string")) return (docs as string[]).join("");
  if (docs.every((d) => d instanceof StreamBackedCorpusView || d instanceof ConcatenatedCorpusView)) {
    return new ConcatenatedCorpusView(docs as StreamBackedCorpusView[]);
  }
  if (docs.every((d) => d instanceof AbstractLazySequence)) {
    return new LazyConcatenation(docs as AbstractLazySequence<unknown>[]);
  }
  if (docs.every((d) => Array.isArray(d))) {
    return (docs as unknown[][]).flat();
  }
  throw pyError("ValueError", `Don't know how to concatenate types: ${docs.map((d) => typeof d)}`);
}

function sliceBounds(len: number, start?: number, stop?: number): [number, number] {
  let s = start ?? 0;
  let e = stop ?? len;
  if (s < 0) s += len;
  if (e < 0) e += len;
  if (s < 0) s = 0;
  if (e < 0) e = 0;
  if (e > len) e = len;
  return [s, e];
}

// { Block Readers

/** 20 lines at a time, whitespace split. */
export function read_whitespace_block(stream: SeekableUnicodeStreamReader): string[] {
  const toks: string[] = [];
  for (let i = 0; i < 20; i++) {
    const line = stream.readline();
    toks.push(...line.split(/\s+/).filter((t) => t.length > 0));
  }
  return toks;
}

/** 20 lines at a time, wordpunct_tokenize. */
export function read_wordpunct_block(stream: SeekableUnicodeStreamReader): string[] {
  const toks: string[] = [];
  for (let i = 0; i < 20; i++) {
    toks.push(...wordpunct_tokenize(stream.readline()));
  }
  return toks;
}

/** 20 lines at a time, one token per line. */
export function read_line_block(stream: SeekableUnicodeStreamReader): string[] {
  const toks: string[] = [];
  for (let i = 0; i < 20; i++) {
    const line = stream.readline();
    if (!line) return toks;
    toks.push(line.replace(/\n$/, ""));
  }
  return toks;
}

/** One paragraph (blank-line-separated) per block. */
export function read_blankline_block(stream: SeekableUnicodeStreamReader): string[] {
  let s = "";
  for (;;) {
    const line = stream.readline();
    if (!line) {
      return s ? [s] : [];
    } else if (!line.trim()) {
      if (s) return [s];
    } else {
      s += line;
    }
  }
}

/** Aligned-corpus block: skips '=' lines and comment/blank lines, ends at \d+-\d+. */
export function read_alignedsent_block(stream: SeekableUnicodeStreamReader): string[] {
  let s = "";
  for (;;) {
    const line = stream.readline();
    // NLTK quirk: line[0] is accessed before the EOF check — IndexError at EOF.
    if (line === "") throw pyError("IndexError", "string index out of range");
    if (line[0] === "=" || line[0] === "\n" || line.startsWith("\r\n")) {
      continue;
    }
    s += line;
    if (/^\d+-\d+/.test(line)) return [s];
  }
}

/** Tokens bounded by start_re / end_re line patterns. */
export function read_regexp_block(stream: SeekableUnicodeStreamReader, startRe: string | RegExp, endRe?: string | RegExp): string[] {
  const start = typeof startRe === "string" ? new RegExp(startRe) : startRe;
  const end = endRe === undefined ? null : typeof endRe === "string" ? new RegExp(endRe) : endRe;
  let line = "";
  for (;;) {
    line = stream.readline();
    if (!line) return [];
    if (start.test(line)) break;
  }
  const lines = [line];
  for (;;) {
    const oldpos = stream.tell();
    line = stream.readline();
    if (!line) return [lines.join("")];
    if (end !== null && end.test(line)) return [lines.join("")];
    if (end === null && start.test(line)) {
      stream.seek(oldpos);
      return [lines.join("")];
    }
    lines.push(line);
  }
}

function parseSexprBlock(block: string): [string[], number] {
  const tokens: string[] = [];
  let end = 0;
  while (end < block.length) {
    const m = /\S/.exec(block.slice(end));
    if (!m) return [tokens, end];
    const start = end + m.index;
    let stop: number;
    if (m[0] !== "(") {
      const m2 = /[\s(]/.exec(block.slice(start));
      if (m2) {
        stop = start + m2.index;
      } else {
        if (tokens.length) return [tokens, end];
        throw pyError("ValueError", "Block too small");
      }
    } else {
      let nesting = 0;
      stop = -1;
      const re = /[()]/g;
      re.lastIndex = start;
      let mm: RegExpExecArray | null;
      while ((mm = re.exec(block)) !== null) {
        if (mm[0] === "(") nesting += 1;
        else nesting -= 1;
        if (nesting === 0) { stop = mm.index + 1; break; }
      }
      if (stop === -1) {
        if (tokens.length) return [tokens, end];
        throw pyError("ValueError", "Block too small");
      }
    }
    end = stop;
    tokens.push(block.slice(start, end));
  }
  return [tokens, end];
}

/** Read s-expressions one per block, doubling the read size as needed. */
export function read_sexpr_block(stream: SeekableUnicodeStreamReader, blockSize = 16384, commentChar?: string): string[] {
  const start = stream.tell();
  let block = stream.read(blockSize);
  let commentRe: RegExp | null = null;
  if (commentChar) {
    commentRe = new RegExp(`^${commentChar.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.*$`, "gm");
  }
  let readSize = blockSize;
  for (;;) {
    try {
      if (commentRe) {
        block += stream.readline();
        block = block.replace(commentRe, (m0) => " ".repeat(m0.length));
      }
      const [tokens, offset0] = parseSexprBlock(block);
      const ws = /\s*/.exec(block.slice(offset0))!;
      const offset = offset0 + ws[0].length;
      stream.seek(start + offset);
      return tokens;
    } catch (e) {
      if (e instanceof Error && e.message === "Block too small") {
        readSize *= 2;
        const nextBlock = stream.read(readSize);
        if (nextBlock) {
          block += nextBlock;
          continue;
        }
        return [block.trim()];
      }
      throw e;
    }
  }
}

/** Treebank paragraph block reader — paragraphs split by =====+ rules. */
export function tagged_treebank_para_block_reader(stream: SeekableUnicodeStreamReader): string[] {
  let para = "";
  for (;;) {
    const line = stream.readline();
    if (/^======+\s*$/.test(line)) {
      if (para.trim()) return [para];
    } else if (line === "") {
      return para.trim() ? [para] : [];
    } else {
      para += line;
    }
  }
}

// { Finding Corpus Items

/** nltk.corpus.reader.util.find_corpus_fileids — expand a regexp over a corpus root. */
export function find_corpus_fileids(root: PathPointer, regexp: string): string[] {
  if (!(root instanceof PathPointer)) {
    throw pyError("TypeError", "find_corpus_fileids: expected a PathPointer");
  }
  const re = new RegExp(`^(?:${regexp})$`);
  if (root instanceof ZipFilePathPointer) {
    const names = root.zipfile.namelist().filter((n) => !n.endsWith("/"));
    const fileids = names.map((n) => n.slice(root.entry.length));
    return fileids.filter((n) => re.test(n)).sort();
  }
  if (root instanceof FileSystemPathPointer) {
    const items: string[] = [];
    const resolvedRoot = realpath(root.path);
    const walk = (dir: string): void => {
      const dirReal = realpath(dir);
      if (!isWithin(resolvedRoot, dirReal)) return;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = pathJoin(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === ".svn") continue;
          if (isWithin(resolvedRoot, realpath(full))) walk(full);
        } else if (entry.isFile()) {
          const rel = relative(root.path, full).split(sep).join("/");
          if (re.test(rel)) items.push(rel);
        }
      }
    };
    walk(root.path);
    return items.sort();
  }
  throw pyError("AssertionError", `Don't know how to handle ${root}`);
}

function realpath(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return pathResolve(p);
  }
}

function isWithin(root: string, child: string): boolean {
  return child === root || child.startsWith(root.endsWith(sep) ? root : root + sep);
}
