// nltk.corpus.reader.api — CorpusReader, CategorizedCorpusReader, SyntaxCorpusReader.
// nltk.corpus.util — LazyCorpusLoader (adapted: JS has no __class__ swap; the
// loader proxies through an accessor that materializes the reader on first call).
// Originals: nltk/corpus/reader/api.py, nltk/corpus/util.py

import { isAbsolute } from "node:path";
import { pyError } from "./internals";
import * as pathsec from "./pathsec";
import { AbstractLazySequence } from "./collections";
import { FileSystemPathPointer, PathPointer, ZipFilePathPointer, find as dataFind } from "./data";
import { SeekableUnicodeStreamReader } from "./corpus_stream";
import { StreamBackedCorpusView, concat, find_corpus_fileids } from "./corpus_view";

export type EncodingSpec = string | null | Record<string, string> | Array<[string, string]>;

export class CorpusReader {
  protected _fileids: string[];
  protected _root: PathPointer;
  protected _readme = "README";
  protected _license = "LICENSE";
  protected _citation = "citation.bib";
  protected _encoding: EncodingSpec;
  protected _tagset: string | null;

  constructor(root: string | PathPointer, fileids: string | string[], encoding: EncodingSpec = "utf8", tagset: string | null = null) {
    if (pathsec.ENFORCE && typeof root === "string") {
      pathsec.validate_path(root, "CorpusReader.__init__");
    }
    if (typeof root === "string") {
      const m = /(.*\.zip)\/?(.*)$/.exec(root);
      root = m && m[1] ? new ZipFilePathPointer(m[1]!, m[2]!) : new FileSystemPathPointer(root);
    } else if (!(root instanceof PathPointer)) {
      throw pyError("TypeError", "CorpusReader: expected a string or a PathPointer");
    }
    const fileidList = typeof fileids === "string" ? find_corpus_fileids(root, fileids) : [...fileids];
    this._fileids = fileidList;
    this._root = root;
    let enc: EncodingSpec = encoding;
    if (Array.isArray(enc)) {
      const dict: Record<string, string> = {};
      for (const fileid of this._fileids) {
        for (const [regexp, encName] of enc) {
          if (new RegExp(regexp).test(fileid)) { dict[fileid] = encName; break; }
        }
      }
      enc = dict;
    }
    this._encoding = enc;
    this._tagset = tagset;
  }

  repr(): string {
    let path: string;
    if (this._root instanceof ZipFilePathPointer) {
      path = `${this._root.zipfile.filename}/${this._root.entry}`;
    } else {
      path = `${this._root}`;
    }
    return `<${this.constructor.name} in '${path}'>`;
  }

  toString(): string { return this.repr(); }

  ensure_loaded(): void { /* no-op — readers are eagerly constructed. */ }
  ensureLoaded(): void { this.ensure_loaded(); }

  readme(): string {
    return this.open(this._readme).read();
  }

  license(): string {
    return this.open(this._license).read();
  }

  citation(): string {
    return this.open(this._citation).read();
  }

  fileids(): string[] {
    return this._fileids;
  }

  abspath(fileid: string): PathPointer {
    return this._root.join(fileid);
  }

  abspaths(fileids?: string | string[] | null, includeEncoding = false, includeFileid = false): PathPointer[] | Array<[PathPointer, string | null]> | Array<[PathPointer, string | null, string]> {
    let ids: string[];
    if (fileids === undefined || fileids === null) ids = this._fileids;
    else if (typeof fileids === "string") ids = [fileids];
    else ids = fileids;
    const paths = ids.map((f) => this._root.join(f));
    if (includeEncoding && includeFileid) {
      return paths.map((p, i) => [p, this.encoding(ids[i]!), ids[i]!] as [PathPointer, string | null, string]);
    }
    if (includeFileid) {
      return paths.map((p, i) => [p, null, ids[i]!] as [PathPointer, string | null, string]);
    }
    if (includeEncoding) {
      return paths.map((p, i) => [p, this.encoding(ids[i]!)] as [PathPointer, string | null]);
    }
    return paths;
  }

  raw(fileids?: string | string[] | null): string {
    let ids: string[];
    if (fileids === undefined || fileids === null) ids = this._fileids;
    else if (typeof fileids === "string") ids = [fileids];
    else ids = fileids;
    const contents = ids.map((f) => this.open(f).read());
    return concat(contents) as string;
  }

  open(file: string): SeekableUnicodeStreamReader {
    if (isAbsolute(file) || file.replace(/\\/g, "/").split("/").includes("..")) {
      throw pyError("ValueError", `CorpusReader paths must be relative: ${file}`);
    }
    const path = this._root.join(file);
    let encoding = this._encoding;
    if (encoding !== null && typeof encoding === "object" && !Array.isArray(encoding)) {
      encoding = (encoding as Record<string, string>)[file] ?? null;
    }
    return path.open(encoding as string | null);
  }

  encoding(file: string): string | null {
    if (this._encoding !== null && typeof this._encoding === "object" && !Array.isArray(this._encoding)) {
      return (this._encoding as Record<string, string>)[file] ?? null;
    }
    return this._encoding as string | null;
  }

  get root(): PathPointer {
    return this._root;
  }
}

export interface CategorizedInit {
  cat_pattern?: string;
  cat_map?: Record<string, string[]>;
  cat_file?: string;
  cat_delimiter?: string;
}

/** Mixin state for CategorizedCorpusReader (applied by readers via ctor arg). */
export function categorizedInit(self: CategorizedCorpusReaderBase, kwargs: CategorizedInit): void {
  const keys = (["cat_pattern", "cat_map", "cat_file"] as const).filter((k) => kwargs[k] !== undefined);
  if (keys.length === 0) {
    throw pyError("ValueError", "Expected keyword argument cat_pattern or cat_map or cat_file.");
  }
  if (keys.length > 1) {
    throw pyError("ValueError", "Specify exactly one of: cat_pattern, cat_map, cat_file.");
  }
  self._catPattern = kwargs.cat_pattern ?? null;
  self._catMap = kwargs.cat_map ?? null;
  self._catFile = kwargs.cat_file ?? null;
  self._catDelimiter = kwargs.cat_delimiter ?? null;
}

export class CategorizedCorpusReaderBase extends CorpusReader {
  _catPattern: string | null = null;
  _catMap: Record<string, string[]> | null = null;
  _catFile: string | null = null;
  _catDelimiter: string | null = null;
  private _f2c: Map<string, Set<string>> | null = null;
  private _c2f: Map<string, Set<string>> | null = null;

  protected _initCategories(): void {
    this._f2c = new Map();
    this._c2f = new Map();
    const add = (fileId: string, category: string): void => {
      if (!this._f2c!.has(fileId)) this._f2c!.set(fileId, new Set());
      if (!this._c2f!.has(category)) this._c2f!.set(category, new Set());
      this._f2c!.get(fileId)!.add(category);
      this._c2f!.get(category)!.add(fileId);
    };
    if (this._catPattern !== null) {
      const re = new RegExp(this._catPattern);
      for (const fileId of this._fileids) {
        const m = re.exec(fileId);
        add(fileId, m ? (m[1] ?? m[0]) : "");
      }
    } else if (this._catMap !== null) {
      for (const [fileId, categories] of Object.entries(this._catMap)) {
        for (const category of categories) add(fileId, category);
      }
    } else if (this._catFile !== null) {
      const stream = this.open(this._catFile);
      const delim = this._catDelimiter ?? undefined;
      for (const rawLine of stream.read().split("\n")) {
        const line = rawLine.trim();
        if (!line) continue;
        const idx = delim === undefined ? line.indexOf(" ") : line.indexOf(delim);
        const fileId = line.slice(0, idx);
        const categories = line.slice(idx + (delim ?? " ").length).split(delim ?? " ");
        if (!this._fileids.includes(fileId)) {
          throw pyError("ValueError", `In category mapping file ${this._catFile}: ${fileId} not found`);
        }
        for (const category of categories) if (category) add(fileId, category);
      }
    }
  }

  categories(fileids?: string | string[] | null): string[] {
    if (this._f2c === null) this._initCategories();
    if (fileids === undefined || fileids === null) return [...this._c2f!.keys()].sort();
    const ids = typeof fileids === "string" ? [fileids] : fileids;
    const out = new Set<string>();
    for (const d of ids) for (const c of this._f2c!.get(d) ?? []) out.add(c);
    return [...out].sort();
  }

  override fileids(categories?: string | string[] | null): string[] {
    if (categories === undefined || categories === null) return super.fileids();
    if (this._f2c === null) this._initCategories();
    if (typeof categories === "string") {
      if (this._c2f!.has(categories)) return [...this._c2f!.get(categories)!].sort();
      throw pyError("ValueError", `Category ${categories} not found`);
    }
    const out = new Set<string>();
    for (const c of categories) for (const f of this._c2f!.get(c) ?? []) out.add(f);
    return [...out].sort();
  }

  _resolve(fileids: string | string[] | null | undefined, categories: string | string[] | null | undefined): string | string[] | null | undefined {
    if (fileids != null && categories != null) {
      throw pyError("ValueError", "Specify fileids or categories, not both");
    }
    if (categories != null) return this.fileids(categories);
    return fileids;
  }

  rawWithCategories(fileids?: string | string[] | null, categories?: string | string[] | null): string {
    return this.raw(this._resolve(fileids, categories));
  }
}

export class CategorizedCorpusReader extends CategorizedCorpusReaderBase {
  constructor(root: string | PathPointer, fileids: string | string[], encoding: EncodingSpec = "utf8", tagset: string | null = null, catInit?: CategorizedInit) {
    super(root, fileids, encoding, tagset);
    categorizedInit(this, catInit ?? {});
  }
}

export class SyntaxCorpusReader extends CorpusReader {
  protected _parse(_s: string): unknown { throw pyError("NotImplementedError", "SyntaxCorpusReader._parse"); }
  protected _word(_s: string): unknown { throw pyError("NotImplementedError", "SyntaxCorpusReader._word"); }
  protected _tag(_s: string, _tagset: string | null = null): unknown { throw pyError("NotImplementedError", "SyntaxCorpusReader._tag"); }
  protected _read_block(_stream: SeekableUnicodeStreamReader): unknown[] { throw pyError("NotImplementedError", "SyntaxCorpusReader._read_block"); }

  protected _read_parsed_sent_block(stream: SeekableUnicodeStreamReader): unknown[] {
    return this._read_block(stream).map((block) => this._parse(block as string));
  }

  protected _read_tagged_sent_block(stream: SeekableUnicodeStreamReader, tagset: string | null = null): unknown[] {
    return this._read_block(stream).map((block) => this._tag(block as string, tagset));
  }

  protected _read_sent_block(stream: SeekableUnicodeStreamReader): unknown[] {
    return this._read_block(stream).map((block) => this._word(block as string));
  }

  protected _read_word_block(stream: SeekableUnicodeStreamReader): unknown[] {
    return this._read_sent_block(stream).flat(1) as unknown[];
  }

  protected _read_tagged_word_block(stream: SeekableUnicodeStreamReader, tagset: string | null = null): unknown[] {
    return this._read_tagged_sent_block(stream, tagset).flat(1) as unknown[];
  }

  parsed_sents(fileids?: string | string[] | null): unknown {
    const views = (this.abspaths(fileids, true) as Array<[PathPointer, string | null]>)
      .map(([fileid, enc]) => new StreamBackedCorpusView(fileid, (s) => this._read_parsed_sent_block(s), 0, enc));
    return concat(views);
  }

  parsedSents(fileids?: string | string[] | null): unknown { return this.parsed_sents(fileids); }

  tagged_sents(fileids?: string | string[] | null, tagset: string | null = null): unknown {
    const views = (this.abspaths(fileids, true) as Array<[PathPointer, string | null]>)
      .map(([fileid, enc]) => new StreamBackedCorpusView(fileid, (s) => this._read_tagged_sent_block(s, tagset), 0, enc));
    return concat(views);
  }

  taggedSents(fileids?: string | string[] | null, tagset: string | null = null): unknown { return this.tagged_sents(fileids, tagset); }

  sents(fileids?: string | string[] | null): unknown {
    const views = (this.abspaths(fileids, true) as Array<[PathPointer, string | null]>)
      .map(([fileid, enc]) => new StreamBackedCorpusView(fileid, (s) => this._read_sent_block(s), 0, enc));
    return concat(views);
  }

  tagged_words(fileids?: string | string[] | null, tagset: string | null = null): unknown {
    const views = (this.abspaths(fileids, true) as Array<[PathPointer, string | null]>)
      .map(([fileid, enc]) => new StreamBackedCorpusView(fileid, (s) => this._read_tagged_word_block(s, tagset), 0, enc));
    return concat(views);
  }

  taggedWords(fileids?: string | string[] | null, tagset: string | null = null): unknown { return this.tagged_words(fileids, tagset); }

  words(fileids?: string | string[] | null): unknown {
    const views = (this.abspaths(fileids, true) as Array<[PathPointer, string | null]>)
      .map(([fileid, enc]) => new StreamBackedCorpusView(fileid, (s) => this._read_word_block(s), 0, enc));
    return concat(views);
  }
}

/** nltk.corpus.util.LazyCorpusLoader — defers corpus construction to first use. */
export class LazyCorpusLoader {
  private loaded: CorpusReader | null = null;
  private readonly subdir: string;

  constructor(
    private readonly name: string,
    private readonly readerCls: new (root: PathPointer, ...args: unknown[]) => CorpusReader,
    args: unknown[] = [],
    private readonly kwargs: Record<string, unknown> = {},
  ) {
    this._args = args;
    this.subdir = (kwargs.nltk_data_subdir as string) ?? "corpora";
    delete kwargs.nltk_data_subdir;
  }

  private _args: unknown[];

  private load(): CorpusReader {
    if (this.loaded !== null) return this.loaded;
    const zipName = this.name.replace(/(([^/]+)(\/.*)?)/, "$2.zip/$1/");
    let root: PathPointer;
    try {
      root = dataFind(`${this.subdir}/${this.name}`);
    } catch (e) {
      try {
        root = dataFind(`${this.subdir}/${zipName}`);
      } catch {
        throw e;
      }
    }
    const [first, ...rest] = this._args;
    const ctorArgs: unknown[] = [root, ...(first !== undefined ? [first] : []), ...rest];
    this.loaded = new this.readerCls(...(ctorArgs as [PathPointer, ...unknown[]]));
    return this.loaded;
  }

  /** Forwarded calls: materialize on first use, then delegate to the reader. */
  ensure_loaded(): void { this.load().ensure_loaded(); }
  ensureLoaded(): void { this.ensure_loaded(); }

  fileids(...args: unknown[]): unknown { return this.call("fileids", args); }
  raw(...args: unknown[]): unknown { return this.call("raw", args); }
  words(...args: unknown[]): unknown { return this.call("words", args); }
  sents(...args: unknown[]): unknown { return this.call("sents", args); }
  paras(...args: unknown[]): unknown { return this.call("paras", args); }

  call(method: string, args: unknown[] = []): unknown {
    const reader = this.load();
    const fn = (reader as unknown as Record<string, (...a: unknown[]) => unknown>)[method];
    if (typeof fn !== "function") throw pyError("AttributeError", `'${reader.constructor.name}' object has no attribute '${method}'`);
    return fn.apply(reader, args);
  }

  get(): CorpusReader {
    return this.load();
  }

  repr(): string {
    if (this.loaded !== null) return this.loaded.repr();
    return `<${this.readerCls.name} in '.../corpora/${this.name}' (not loaded yet)>`;
  }
}

export { AbstractLazySequence };
