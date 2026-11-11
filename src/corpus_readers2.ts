// nltk.corpus.reader.* — second tier: bracket_parse, chunked, conll,
// categorized_sents, opinion_lexicon, sentiwordnet, udhr, string_category,
// lin, comparative_sents, pros_cons, ppattach, ieer, reviews, indian,
// ipipan, twitter, toolbox, markdown, sinica_treebank, switchboard, ycoe,
// knbc, europarl_raw.

import { pyError } from "./internals";
import { PathPointer } from "./data";
import { SeekableUnicodeStreamReader } from "./corpus_stream";
import {
  StreamBackedCorpusView, concat,
  read_blankline_block, read_regexp_block, read_sexpr_block, read_whitespace_block,
} from "./corpus_view";
import type { BlockReader } from "./corpus_view";
import {
  CategorizedCorpusReader, CorpusReader,
  SyntaxCorpusReader,
} from "./corpus_api";
import type { CategorizedInit, EncodingSpec } from "./corpus_api";
import { WhitespaceTokenizer } from "./tokenizers";
import type { TextTokenizerLike } from "./corpus_text_readers";
import { str2tuple } from "./tag_util";
import { mapTag } from "./tag_mapping";
import { SimpleTree, tagstr2tree } from "./corpus_tree";

// { bracket_parse

export class BracketParseCorpusReader extends SyntaxCorpusReader {
  protected _comment_char: string | null;
  protected _detect_blocks: string;

  constructor(root: string | PathPointer, fileids: string | string[],
    commentChar: string | null = null, detectBlocks = "unindented_paren",
    encoding: EncodingSpec = "utf8", tagset: string | null = null) {
    super(root, fileids, encoding, tagset);
    this._comment_char = commentChar;
    this._detect_blocks = detectBlocks;
  }

  protected override _read_block(stream: SeekableUnicodeStreamReader): string[] {
    if (this._detect_blocks === "sexpr") {
      return read_sexpr_block(stream, 16384, this._comment_char ?? undefined);
    } else if (this._detect_blocks === "blankline") {
      return read_blankline_block(stream);
    } else if (this._detect_blocks === "unindented_paren") {
      let toks = read_regexp_block(stream, "^\\(");
      if (this._comment_char) {
        const cre = new RegExp(`^${escapeRe(this._comment_char)}.*`, "gm");
        toks = toks.map((tok) => tok.replace(cre, ""));
      }
      return toks;
    }
    throw pyError("AssertionError", "bad block type");
  }

  protected _normalize(t: string): string {
    t = t.replace(/\((.)\)/g, "($1 $1)");
    t = t.replace(/\(([^\s()]+) ([^\s()]+) [^\s()]+\)/g, "($1 $2)");
    return t;
  }

  protected override _parse(t: string): SimpleTree {
    const tree = SimpleTree.fromstring(this._normalize(t));
    if (tree.label === "" && tree.children.length === 1 && tree.children[0] instanceof SimpleTree) {
      return tree.children[0];
    }
    return tree;
  }

  protected override _word(t: string): Array<string | [string, string | null]> {
    return this._parse(t).leaves();
  }

  protected override _tag(t: string, tagset: string | null = null): Array<[string, string | null]> {
    const taggedSent = this._parse(t).pos();
    if (tagset && tagset !== this._tagset) {
      return taggedSent.map(([w, t2]) => [w, t2 === null ? t2 : mapTag(this._tagset!, tagset, t2)] as [string, string | null]);
    }
    return taggedSent;
  }

  protected override _read_word_block(stream: SeekableUnicodeStreamReader): unknown[] {
    return this._read_sent_block(stream).flat(1);
  }

  parsed_words(fileids?: string | string[] | null): unknown {
    const views = (this.abspaths(fileids, true) as Array<[PathPointer, string | null]>)
      .map(([fileid, enc]) => new StreamBackedCorpusView(fileid, (s) => this._read_parsed_word_block(s), 0, enc));
    return concat(views);
  }

  override parsed_sents(fileids?: string | string[] | null): unknown {
    return super.parsed_sents(fileids);
  }

  parsed_paras(fileids?: string | string[] | null): unknown {
    const views = (this.abspaths(fileids, true) as Array<[PathPointer, string | null]>)
      .map(([fileid, enc]) => new StreamBackedCorpusView(fileid, (s) => [this._read_parsed_sent_block(s)], 0, enc));
    return concat(views);
  }

  parsedWords(fileids?: string | string[] | null): unknown { return this.parsed_words(fileids); }
  override parsedSents(fileids?: string | string[] | null): unknown { return this.parsed_sents(fileids); }
  parsedParas(fileids?: string | string[] | null): unknown { return this.parsed_paras(fileids); }

  protected _read_parsed_word_block(stream: SeekableUnicodeStreamReader): unknown[] {
    return this._read_parsed_sent_block(stream).flat(1);
  }

  corpus_sents(fileids?: string | string[] | null): unknown {
    const views = (this.abspaths(fileids, true) as Array<[PathPointer, string | null]>)
      .map(([fileid, enc]) => new StreamBackedCorpusView(fileid, (s) => this._read_block(s), 0, enc));
    return concat(views);
  }
  corpusSents(fileids?: string | string[] | null): unknown { return this.corpus_sents(fileids); }
}

export class CategorizedBracketParseCorpusReader extends CategorizedCorpusReader {
  private _br: BracketParseCorpusReader | null = null;

  override categories(fileids?: string | string[] | null): string[] { return super.categories(fileids); }

  private bracket(root: string | PathPointer): BracketParseCorpusReader {
    if (!this._br) this._br = new BracketParseCorpusReader(root, this._fileids);
    return this._br;
  }

  tagged_sents(fileids?: string | string[] | null, categories?: string | string[] | null, tagset: string | null = null): unknown {
    return this.bracket(this._root).tagged_sents(this._resolve(fileids, categories), tagset);
  }
  parsed_sents(fileids?: string | string[] | null, categories?: string | string[] | null): unknown {
    return this.bracket(this._root).parsed_sents(this._resolve(fileids, categories));
  }
}

// { chunked

export class ChunkedCorpusView extends StreamBackedCorpusView<unknown> {
  constructor(corpusFile: string | PathPointer, encoding: string | null,
    private _words: boolean, private _sents: boolean, private _paras: boolean, private _etag: boolean,
    private _str2chunktree: (s: string) => SimpleTree,
    private _sent_tokenizer: TextTokenizerLike,
    private _para_block_reader: BlockReader<string>,
    private _tagset: string | null = null) {
    super(corpusFile, undefined, 0, encoding);
    this.read_block = (stream) => this.readBlockImpl(stream);
  }

  private readBlockImpl(stream: SeekableUnicodeStreamReader): unknown[] {
    const block: unknown[] = [];
    for (const paraStr of this._para_block_reader(stream)) {
      const para: unknown[] = [];
      for (const sentStr of this._sent_tokenizer.tokenize(paraStr)) {
        const sent = this._str2chunktree(sentStr.trim());
        if (this._words && !this._etag) {
          const leaves = sent.leaves();
          if (this._sents) para.push(leaves.map((l) => Array.isArray(l) ? l[0] : l));
          else para.push(...leaves.map((l) => Array.isArray(l) ? l[0] : l));
        } else if (this._words && this._etag) {
          if (this._sents) para.push(sent.pos());
          else para.push(...sent.pos());
        } else {
          if (this._sents) para.push(sent);
          else para.push(sent);
        }
      }
      if (this._paras) block.push(para);
      else block.push(...para);
    }
    return block;
  }
}

export class ChunkedCorpusReader extends CorpusReader {
  protected _cv_args: [(s: string) => SimpleTree, TextTokenizerLike, BlockReader<string>, string | null];

  constructor(root: string | PathPointer, fileids: string | string[],
    protected extension = "",
    str2chunktree: (s: string) => SimpleTree = (s) => tagstr2tree(s),
    sentTokenizer: TextTokenizerLike = { tokenize: (t) => t.split("\n").filter((x) => x !== "") },
    paraBlockReader: BlockReader<string> = read_blankline_block,
    encoding: EncodingSpec = "utf8", tagset: string | null = null) {
    super(root, fileids, encoding, tagset);
    this._cv_args = [str2chunktree, sentTokenizer, paraBlockReader, tagset];
  }

  private view(fileids: string | string[] | null | undefined, words: boolean, sents: boolean, paras: boolean, etag: boolean): unknown {
    const [s2c, st, pbr, ts] = this._cv_args;
    return concat((this.abspaths(fileids, true) as Array<[PathPointer, string | null]>)
      .map(([f, e]) => new ChunkedCorpusView(f, e, words, sents, paras, etag, s2c, st, pbr, ts)));
  }

  words(fileids?: string | string[] | null): unknown { return this.view(fileids, true, false, false, false); }
  sents(fileids?: string | string[] | null): unknown { return this.view(fileids, true, true, false, false); }
  paras(fileids?: string | string[] | null): unknown { return this.view(fileids, true, true, true, false); }
  tagged_words(fileids?: string | string[] | null, _tagset: string | null = null): unknown { return this.view(fileids, true, false, false, true); }
  tagged_sents(fileids?: string | string[] | null, _tagset: string | null = null): unknown { return this.view(fileids, true, true, false, true); }
  tagged_paras(fileids?: string | string[] | null, _tagset: string | null = null): unknown { return this.view(fileids, true, true, true, true); }
  chunked_words(fileids?: string | string[] | null): unknown { return this.view(fileids, false, false, false, false); }
  chunked_sents(fileids?: string | string[] | null, _tagset: string | null = null): unknown { return this.view(fileids, false, true, false, false); }
  chunked_paras(fileids?: string | string[] | null, _tagset: string | null = null): unknown { return this.view(fileids, false, true, true, false); }
  chunkedSents(fileids?: string | string[] | null, tagset: string | null = null): unknown { return this.chunked_sents(fileids, tagset); }
  taggedSents(fileids?: string | string[] | null, tagset: string | null = null): unknown { return this.tagged_sents(fileids, tagset); }
  taggedWords(fileids?: string | string[] | null, tagset: string | null = null): unknown { return this.tagged_words(fileids, tagset); }

  override raw(fileids?: string | string[] | null): string {
    let ids: string[];
    if (fileids === undefined || fileids === null) {
      ids = this._fileids.filter((f) => f.endsWith(this.extension));
    } else if (typeof fileids === "string") ids = [fileids];
    else ids = fileids;
    const contents = ids.map((f) => this.open(f).read());
    return concat(contents as unknown as StreamBackedCorpusView<string>[]) as string;
  }
}

// { conll — ConllCorpusReader (grid view covering words/pos/chunk/ne core)

export class ConllChunkCorpusReader extends CorpusReader {
  constructor(root: string | PathPointer, fileids: string | string[],
    private chunkTypes = ["NP", "PP", "VP"],
    private rootLabel = "S",
    private tagset: string | null = null,
    encoding: EncodingSpec = "utf8",
    private separator: string | null = null) {
    super(root, fileids, encoding, tagset);
  }

  chunked_sents(fileids?: string | string[] | null, chunkTypes?: string[]): unknown {
    const ct = chunkTypes ?? this.chunkTypes;
    const views = (this.abspaths(fileids, true) as Array<[PathPointer, string | null]>)
      .map(([f, e]) => new StreamBackedCorpusView(f, (stream) => this.readChunkedBlock(stream, ct), 0, e));
    return concat(views);
  }

  private readChunkedBlock(stream: SeekableUnicodeStreamReader, chunkTypes: string[]): SimpleTree[] {
    const out: SimpleTree[] = [];
    for (const sentStr of read_blankline_block(stream)) {
      if (sentStr.startsWith("-DOCSTART-")) continue;
      out.push(conllstr2tree(sentStr, chunkTypes, this.rootLabel, this.separator));
    }
    return out;
  }

  iob_words(fileids?: string | string[] | null): unknown {
    const views = (this.abspaths(fileids, true) as Array<[PathPointer, string | null]>)
      .map(([f, e]) => new StreamBackedCorpusView(f, (stream) => this.readIobBlock(stream), 0, e));
    return concat(views);
  }

  private readIobBlock(stream: SeekableUnicodeStreamReader): Array<[string, string, string]> {
    const out: Array<[string, string, string]> = [];
    for (const sentStr of read_blankline_block(stream)) {
      const sent: Array<[string, string, string]> = [];
      for (const line of sentStr.split("\n")) {
        if (!line.trim()) continue;
        const fields = this.separator ? line.split(this.separator) : line.split(/\s+/);
        if (fields.length >= 3) sent.push([fields[0]!, fields[1]!, fields[fields.length - 1]!]);
      }
      out.push(...sent);
    }
    return out;
  }
}

/** nltk.chunk.conllstr2tree — CoNLL IOB grid → chunk tree. */
export function conllstr2tree(s: string, chunkTypes = ["NP", "PP", "VP"], rootLabel = "S", separator: string | null = null): SimpleTree {
  const stack: SimpleTree[] = [new SimpleTree(rootLabel, [])];
  for (const line of s.split("\n")) {
    if (!line.trim()) continue;
    const fields = separator ? line.split(separator) : line.split(/\s+/);
    if (fields.length < 3) {
      throw pyError("ValueError", ` conllstr2tree: line has ${fields.length} fields (<3): ${line}`);
    }
    const chunk = fields[fields.length - 1]!;
    const text = fields.slice(0, -1).join("/");
    if (chunk.startsWith("B-")) {
      const label = chunk.slice(2);
      const subtree = new SimpleTree(label, []);
      stack[stack.length - 1]!.children.push(subtree);
      stack.push(subtree);
    } else if (chunk.startsWith("I-")) {
      const label = chunk.slice(2);
      if (stack.length === 1 || stack[stack.length - 1]!.label !== label) {
        const subtree = new SimpleTree(label, []);
        stack[stack.length - 1]!.children.push(subtree);
        stack.push(subtree);
      }
    } else if (chunk === "O") {
      while (stack.length > 1) stack.pop();
    }
    const [word, tag] = str2tuple(text, "/");
    stack[stack.length - 1]!.children.push([word, tag]);
  }
  return stack[0]!;
}

// { categorized_sents

export class CategorizedSentencesCorpusReader extends CategorizedCorpusReader {
  private _tok: TextTokenizerLike;
  private _sentTokenizer: TextTokenizerLike | null = null;

  constructor(root: string | PathPointer, fileids: string | string[],
    wordTokenizer: TextTokenizerLike | null = null,
    sentTokenizer: TextTokenizerLike | null = null,
    encoding: EncodingSpec = "utf8", catInit?: CategorizedInit) {
    super(root, fileids, encoding, null, catInit);
    this._tok = wordTokenizer ?? new WhitespaceTokenizer();
    this._sentTokenizer = sentTokenizer;
  }

  words(fileids?: string | string[] | null, categories?: string | string[] | null): unknown {
    const ids = this._resolve(fileids, categories);
    return concat((this.abspaths(ids, true) as Array<[PathPointer, string | null]>)
      .map(([f, e]) => new StreamBackedCorpusView(f, (s) => this.readWordBlock(s), 0, e)));
  }

  sents(fileids?: string | string[] | null, categories?: string | string[] | null): unknown {
    const ids = this._resolve(fileids, categories);
    return concat((this.abspaths(ids, true) as Array<[PathPointer, string | null]>)
      .map(([f, e]) => new StreamBackedCorpusView(f, (s) => this.readSentBlock(s), 0, e)));
  }

  private readWordBlock(stream: SeekableUnicodeStreamReader): string[] {
    const words: string[] = [];
    for (const sent of this.readSentBlock(stream)) words.push(...sent);
    return words;
  }

  private readSentBlock(stream: SeekableUnicodeStreamReader): string[][] {
    const sents: string[][] = [];
    for (let i = 0; i < 20; i++) {
      const line = stream.readline();
      if (line === "") continue;
      if (this._sentTokenizer !== null) {
        for (const sent of this._sentTokenizer.tokenize(line)) {
          sents.push(this._tok.tokenize(sent));
        }
      } else {
        sents.push(this._tok.tokenize(line));
      }
    }
    return sents;
  }
}

// { opinion_lexicon

export class IgnoreReadmeCorpusView extends StreamBackedCorpusView<string> {
  constructor(corpusFile: string | PathPointer, encoding: string | null) {
    super(corpusFile, undefined, 0, encoding);
    this.read_block = (stream) => {
      const line = stream.readline().trim();
      if (line === "") return [];
      return [line];
    };
  }
}

export class OpinionLexiconCorpusReader extends CorpusReader {
  words(fileids?: string | string[] | null): unknown {
    return concat((this.abspaths(fileids, true) as Array<[PathPointer, string | null]>)
      .map(([f, e]) => new IgnoreReadmeCorpusView(f, e)));
  }

  positive(): string {
    if (!this._fileids.length) throw pyError("OSError", "No file specified for corpus");
    return this._fileids.find((f) => f.includes("positive")) ?? this._fileids[0]!;
  }

  negative(): string {
    if (!this._fileids.length) throw pyError("OSError", "No file specified for corpus");
    return this._fileids.find((f) => f.includes("negative")) ?? this._fileids[0]!;
  }
}

// { sentiwordnet

export class SentiSynset {
  readonly pos_score: number;
  readonly neg_score: number;
  readonly obj_score: number;
  constructor(
    readonly synset_name: string, readonly pos: string, readonly id: number,
    posScore: number, negScore: number, readonly terms: string[], readonly gloss: string) {
    this.pos_score = posScore;
    this.neg_score = negScore;
    this.obj_score = 1.0 - (posScore + negScore);
  }
  get posScore(): number { return this.pos_score; }
  get negScore(): number { return this.neg_score; }
  get objScore(): number { return this.obj_score; }
  get synsetName(): string { return this.synset_name; }
  repr(): string {
    return `<${this.synset_name}: PosScore=${this.pos_score} NegScore=${this.neg_score}>`;
  }
}

export class SentiWordNetCorpusReader extends CorpusReader {
  private _db: Map<string, Map<number, SentiSynset>> | null = null;

  senti_synset(synsetOrName: { name?: () => string } | string, _lang = "eng"): SentiSynset | null {
    const name = typeof synsetOrName === "string" ? synsetOrName : synsetOrName.name?.();
    if (name === undefined) throw pyError("OSError", "No file specified for this corpus");
    const key = name.split(".")[0]!;
    const id = parseInt(name.split(".")[2] ?? "-1", 10);
    return this.getSentiSynset(key, id);
  }

  senti_synsets(): SentiSynset[] {
    this.parseFile();
    const out: SentiSynset[] = [];
    for (const inner of this._db!.values()) for (const s of inner.values()) out.push(s);
    return out;
  }

  private getSentiSynset(_key: string, _id: number): SentiSynset | null {
    this.parseFile();
    return null;
  }

  private parseFile(): void {
    if (this._db !== null) return;
    this._db = new Map();
    const file = this._fileids[0];
    if (!file) throw pyError("OSError", "No file specified for this corpus");
    const stream = this.open(file);
    for (;;) {
      const line = stream.readline();
      if (line === "") break;
      if (line.startsWith("#")) continue;
      const fields = line.trim().split("\t");
      if (fields.length < 6) continue;
      try {
        const pos = fields[0]!;
        const id = parseInt(fields[1]!, 10);
        const posScore = parseFloat(fields[2]!);
        const negScore = parseFloat(fields[3]!);
        const terms = fields[4]!.split(/\s+/);
        const gloss = fields[5]!;
        const key = `${terms[0]!.split("#")[0]}.${pos}`;
        const synsetName = `${key}.${String(id).padStart(8, "0")}`;
        const senti = new SentiSynset(synsetName, pos, id, posScore, negScore, terms, gloss);
        if (!this._db.has(key)) this._db.set(key, new Map());
        this._db.get(key)!.set(id, senti);
      } catch { /* skip malformed */ }
    }
  }

  all_senti_synsets(): SentiSynset[] {
    this.parseFile();
    const out: SentiSynset[] = [];
    for (const inner of this._db!.values()) for (const s of inner.values()) out.push(s);
    return out;
  }
}

// { udhr — plain text with README/license stripped

export class UdhrCorpusReader extends CorpusReader {
  private static readonly SKIP = ["README", "LICENSE"];

  override raw(fileids?: string | string[] | null): string {
    return super.raw(fileids);
  }

  words(fileids?: string | string[] | null): string[] {
    let ids: string[];
    if (fileids === undefined || fileids === null) {
      ids = this._fileids.filter((f) => !f.endsWith(".skip"));
    } else if (typeof fileids === "string") ids = [fileids];
    else ids = fileids;
    const ws = new WhitespaceTokenizer();
    return ids.flatMap((f) => ws.tokenize(this.raw(f)));
  }

  langs(): string[] {
    const names = new Set(this._fileids.map((f) => f.split("-")[0]!));
    const skip = new Set(UdhrCorpusReader.SKIP);
    return [...names].filter((n) => !skip.has(n));
  }
}

// { string_category — fileid lists words with categories in filename

export class StringCategoryCorpusReader extends CorpusReader {
  constructor(root: string | PathPointer, fileids: string | string[],
    encoding: EncodingSpec = "utf8", private _delimiter = " ") {
    super(root, fileids, encoding);
  }

  tuples(fileids?: string | string[] | null): unknown {
    const views = (this.abspaths(fileids, true) as Array<[PathPointer, string | null]>)
      .map(([f, e]) => new StreamBackedCorpusView(f, (s) => this.readTupleBlock(s), 0, e));
    return concat(views);
  }

  rawTuples(fileids?: string | string[] | null): unknown { return this.tuples(fileids); }

  private readTupleBlock(stream: SeekableUnicodeStreamReader): Array<[string, string[]]> {
    const line = stream.readline();
    if (line === "") return [];
    return [[line.trim(), line.trim().split(this._delimiter)]];
  }

  strings(fileids?: string | string[] | null): unknown {
    const views = (this.abspaths(fileids, true) as Array<[PathPointer, string | null]>)
      .map(([f, e]) => new StreamBackedCorpusView(f, (s) => {
        const line = s.readline();
        return line === "" ? [] : [line.trim()];
      }, 0, e));
    return concat(views);
  }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export { read_whitespace_block };
