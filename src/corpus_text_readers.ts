// nltk.corpus.reader.* — text-format corpus readers.
// Originals: nltk/corpus/reader/{plaintext,wordlist,cmudict,tagged,dependency,
// aligned,categorized_sents,opinion_lexicon,sentiwordnet,string_category,
// udhr,ieer,lin,comparative_sents,pros_cons,ppattach,reviews,indian,ipipan,
// twitter,toolbox}.py

import { pyError } from "./internals";
import { PathPointer } from "./data";
import { SeekableUnicodeStreamReader } from "./corpus_stream";
import {
  StreamBackedCorpusView, concat,
  read_blankline_block, read_regexp_block,
} from "./corpus_view";
import type { BlockReader } from "./corpus_view";
import {
  CategorizedCorpusReaderBase, CorpusReader, SyntaxCorpusReader, categorizedInit,
} from "./corpus_api";
import type { CategorizedInit, EncodingSpec } from "./corpus_api";
import { WhitespaceTokenizer, LineTokenizer } from "./tokenizers";
import { WordPunctTokenizer } from "./tokenizers_treebank";
import { RegexpTokenizer } from "./tokenizers_regexp";
import { PunktTokenizer } from "./punkt_nltk";
import { line_tokenize } from "./tokenizers_basic";
import { str2tuple } from "./tag_util";
import { mapTag } from "./tag_mapping";
import { AlignedSent, Alignment } from "./translate_api";
import { DependencyGraph } from "./dependency_graph";

export interface TextTokenizerLike { tokenize(text: string): string[]; }

/** Wrap a RegexpTokenizer so its (possibly non-string) tokens satisfy TextTokenizerLike. */
function regexpAsTokenizer(t: RegexpTokenizer): TextTokenizerLike {
  return { tokenize: (text: string) => t.tokenize(text) as unknown as string[] };
}

// { plaintext

export class PlaintextCorpusReader extends CorpusReader {
  static CorpusView = StreamBackedCorpusView;
  protected _word_tokenizer: TextTokenizerLike;
  protected _sent_tokenizer: TextTokenizerLike | null;
  protected _para_block_reader: BlockReader<string>;

  constructor(root: string | PathPointer, fileids: string | string[],
    wordTokenizer: TextTokenizerLike = new WordPunctTokenizer(),
    sentTokenizer: TextTokenizerLike | null = null,
    paraBlockReader: BlockReader<string> = read_blankline_block,
    encoding: EncodingSpec = "utf8") {
    super(root, fileids, encoding);
    this._word_tokenizer = wordTokenizer;
    this._sent_tokenizer = sentTokenizer;
    this._para_block_reader = paraBlockReader;
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

  protected _read_word_block(stream: SeekableUnicodeStreamReader): string[] {
    const words: string[] = [];
    for (let i = 0; i < 20; i++) words.push(...this._word_tokenizer.tokenize(stream.readline()));
    return words;
  }

  protected _read_sent_block(stream: SeekableUnicodeStreamReader): string[][] {
    const sents: string[][] = [];
    for (const para of this._para_block_reader(stream)) {
      for (const sent of this.sentTokenizer().tokenize(para)) {
        sents.push(this._word_tokenizer.tokenize(sent));
      }
    }
    return sents;
  }

  protected _read_para_block(stream: SeekableUnicodeStreamReader): string[][][] {
    const paras: string[][][] = [];
    for (const para of this._para_block_reader(stream)) {
      paras.push(this.sentTokenizer().tokenize(para).map((sent) => this._word_tokenizer.tokenize(sent)));
    }
    return paras;
  }

  words(fileids?: string | string[] | null): unknown {
    const ctor = (this.constructor as typeof PlaintextCorpusReader).CorpusView;
    const views = (this.abspaths(fileids, true, true) as Array<[PathPointer, string | null, string]>)
      .map(([path, enc]) => new ctor(path, (s) => this._read_word_block(s), 0, enc));
    return concat(views);
  }

  sents(fileids?: string | string[] | null): unknown {
    const ctor = (this.constructor as typeof PlaintextCorpusReader).CorpusView;
    const views = (this.abspaths(fileids, true, true) as Array<[PathPointer, string | null, string]>)
      .map(([path, enc]) => new ctor(path, (s) => this._read_sent_block(s), 0, enc));
    return concat(views);
  }

  paras(fileids?: string | string[] | null): unknown {
    const ctor = (this.constructor as typeof PlaintextCorpusReader).CorpusView;
    const views = (this.abspaths(fileids, true, true) as Array<[PathPointer, string | null, string]>)
      .map(([path, enc]) => new ctor(path, (s) => this._read_para_block(s), 0, enc));
    return concat(views);
  }
}

export class CategorizedPlaintextCorpusReader extends CategorizedCorpusReaderBase {
  private readonly _plain: PlaintextCorpusReader;

  constructor(root: string | PathPointer, fileids: string | string[],
    wordTokenizer?: TextTokenizerLike, sentTokenizer?: TextTokenizerLike | null,
    paraBlockReader?: BlockReader<string>, encoding: EncodingSpec = "utf8", catInit?: CategorizedInit) {
    super(root, fileids, encoding);
    categorizedInit(this, catInit ?? {});
    this._plain = new PlaintextCorpusReader(root, this._fileids, wordTokenizer, sentTokenizer, paraBlockReader, encoding);
  }

  words(fileids?: string | string[] | null, categories?: string | string[] | null): unknown {
    return this._plain.words(this._resolve(fileids, categories));
  }

  sents(fileids?: string | string[] | null, categories?: string | string[] | null): unknown {
    return this._plain.sents(this._resolve(fileids, categories));
  }

  paras(fileids?: string | string[] | null, categories?: string | string[] | null): unknown {
    return this._plain.paras(this._resolve(fileids, categories));
  }
}

export class PortugueseCategorizedPlaintextCorpusReader extends CategorizedPlaintextCorpusReader {
  constructor(root: string | PathPointer, fileids: string | string[], catInit?: CategorizedInit, encoding: EncodingSpec = "utf8") {
    super(root, fileids, undefined, new PunktTokenizer("portuguese"), undefined, encoding, catInit);
  }
}

export class EuroparlCorpusReader extends PlaintextCorpusReader {
  protected override _read_word_block(stream: SeekableUnicodeStreamReader): string[] {
    const words: string[] = [];
    for (let i = 0; i < 20; i++) {
      const line = stream.readline();
      words.push(...line.split(/\s+/).filter((t) => t.length > 0));
    }
    return words;
  }

  protected override _read_sent_block(stream: SeekableUnicodeStreamReader): string[][] {
    const sents: string[][] = [];
    for (const para of this._para_block_reader(stream)) {
      for (const sent of para.split("\n")) sents.push(sent.split(/\s+/).filter((t) => t.length > 0));
    }
    return sents;
  }

  protected override _read_para_block(stream: SeekableUnicodeStreamReader): string[][][] {
    const paras: string[][][] = [];
    for (const para of this._para_block_reader(stream)) {
      paras.push(para.split("\n").map((sent) => sent.split(/\s+/).filter((t) => t.length > 0)));
    }
    return paras;
  }

  chapters(fileids?: string | string[] | null): unknown {
    const ctor = (this.constructor as typeof PlaintextCorpusReader).CorpusView;
    const views = (this.abspaths(fileids, true) as Array<[PathPointer, string | null]>)
      .map(([fileid, enc]) => new ctor(fileid, (s) => this._read_para_block(s), 0, enc));
    return concat(views);
  }

  override paras(_fileids?: string | string[] | null): unknown {
    throw pyError("NotImplementedError", "The Europarl corpus reader does not support paragraphs. Please use chapters() instead.");
  }
}

// { wordlist

export class WordListCorpusReader extends CorpusReader {
  words(fileids?: string | string[] | null, ignoreLinesStartswith = "\n"): string[] {
    return line_tokenize(this.raw(fileids)).filter((line) => !line.startsWith(ignoreLinesStartswith));
  }
}

export class SwadeshCorpusReader extends WordListCorpusReader {
  entries(fileids?: string[] | null): string[][] {
    const ids = fileids ?? this.fileids();
    const wordlists = ids.map((f) => this.words(f));
    const out: string[][] = [];
    const minLen = Math.min(...wordlists.map((w) => w.length));
    for (let i = 0; i < minLen; i++) out.push(wordlists.map((w) => w[i]!));
    return out;
  }
}

export class NonbreakingPrefixesCorpusReader extends WordListCorpusReader {
  static readonly available_langs: Record<string, string> = (() => {
    const langs: Record<string, string> = {
      catalan: "ca", czech: "cs", german: "de", greek: "el", english: "en", spanish: "es",
      finnish: "fi", french: "fr", hungarian: "hu", icelandic: "is", italian: "it",
      latvian: "lv", dutch: "nl", polish: "pl", portuguese: "pt", romanian: "ro",
      russian: "ru", slovak: "sk", slovenian: "sl", swedish: "sv", tamil: "ta",
    };
    for (const v of Object.values(langs)) langs[v] = v;
    return langs;
  })();
  readonly available_langs = NonbreakingPrefixesCorpusReader.available_langs;

  override words(lang?: string | null, fileids?: string | string[] | null, ignoreLinesStartswith = "#"): string[] {
    let ids = fileids;
    if (lang !== undefined && lang !== null && lang in NonbreakingPrefixesCorpusReader.available_langs) {
      ids = ["nonbreaking_prefix." + NonbreakingPrefixesCorpusReader.available_langs[lang]];
    }
    return line_tokenize(this.raw(ids)).filter((line) => !line.startsWith(ignoreLinesStartswith));
  }
}

export class UnicharsCorpusReader extends WordListCorpusReader {
  static readonly available_categories = [
    "Close_Punctuation", "Currency_Symbol", "IsAlnum", "IsAlpha", "IsLower", "IsN",
    "IsSc", "IsSo", "IsUpper", "Line_Separator", "Number", "Open_Punctuation",
    "Punctuation", "Separator", "Symbol",
  ];
  readonly available_categories = UnicharsCorpusReader.available_categories;

  chars(category?: string | null, fileids?: string | string[] | null): string[] {
    let ids = fileids;
    if (category !== undefined && category !== null && UnicharsCorpusReader.available_categories.includes(category)) {
      ids = [`${category}.txt`];
    }
    return [...this.raw(ids).trim()];
  }
}

export class MWAPPDBCorpusReader extends WordListCorpusReader {
  static readonly mwa_ppdb_xxxl_file = "ppdb-1.0-xxxl-lexical.extended.synonyms.uniquepairs";
  entries(fileids: string | string[] | null = MWAPPDBCorpusReader.mwa_ppdb_xxxl_file): string[][] {
    return line_tokenize(this.raw(fileids)).map((line) => line.split("\t"));
  }
}

// { cmudict

export function read_cmudict_block(stream: SeekableUnicodeStreamReader): Array<[string, string[]]> {
  const entries: Array<[string, string[]]> = [];
  while (entries.length < 100) {
    const line = stream.readline();
    if (line === "") return entries;
    const pieces = line.split(/\s+/).filter((p) => p.length > 0);
    if (!pieces.length) continue;
    entries.push([pieces[0]!.toLowerCase(), pieces.slice(2)]);
  }
  return entries;
}

export class CMUDictCorpusReader extends CorpusReader {
  entries(): unknown {
    const views = (this.abspaths(null, true) as Array<[PathPointer, string | null]>)
      .map(([fileid, enc]) => new StreamBackedCorpusView(fileid, read_cmudict_block, 0, enc));
    return concat(views);
  }

  words(): string[] {
    const entries = this.entries() as Iterable<[string, string[]]>;
    return [...entries].map(([word]) => word.toLowerCase());
  }

  dict(): Map<string, string[][]> {
    const entries = this.entries() as Iterable<[string, string[]]>;
    const out = new Map<string, string[][]>();
    for (const [word, phones] of entries) {
      if (!out.has(word)) out.set(word, []);
      out.get(word)!.push(phones);
    }
    return out;
  }
}

// { tagged

export class TaggedCorpusView extends StreamBackedCorpusView<unknown> {
  private _tagged: boolean;
  private _group_by_sent: boolean;
  private _group_by_para: boolean;
  private _sep: string;
  private _word_tokenizer: TextTokenizerLike;
  private _sent_tokenizer: TextTokenizerLike;
  private _para_block_reader: BlockReader<string>;
  private _tag_mapping_function: ((t: string) => string) | null;

  constructor(corpusFile: string | PathPointer, encoding: string | null,
    tagged: boolean, groupBySent: boolean, groupByPara: boolean, sep: string,
    wordTokenizer: TextTokenizerLike, sentTokenizer: TextTokenizerLike,
    paraBlockReader: BlockReader<string>, tagMappingFunction: ((t: string) => string) | null = null) {
    super(corpusFile, undefined, 0, encoding);
    this._tagged = tagged;
    this._group_by_sent = groupBySent;
    this._group_by_para = groupByPara;
    this._sep = sep;
    this._word_tokenizer = wordTokenizer;
    this._sent_tokenizer = sentTokenizer;
    this._para_block_reader = paraBlockReader;
    this._tag_mapping_function = tagMappingFunction;
    this.read_block = (stream) => this.readBlockImpl(stream);
  }

  private readBlockImpl(stream: SeekableUnicodeStreamReader): unknown[] {
    const block: unknown[] = [];
    for (const paraStr of this._para_block_reader(stream)) {
      const para: unknown[] = [];
      for (const sentStr of this._sent_tokenizer.tokenize(paraStr)) {
        let sent: Array<[string, string | null]> = this._word_tokenizer.tokenize(sentStr)
          .map((s) => str2tuple(s, this._sep));
        if (this._tag_mapping_function) {
          sent = sent.map(([w, t]) => [w, t === null ? t : this._tag_mapping_function!(t)] as [string, string | null]);
        }
        const outSent: unknown[] = this._tagged ? sent : sent.map(([w]) => w);
        if (this._group_by_sent) para.push(outSent);
        else para.push(...outSent);
      }
      if (this._group_by_para) block.push(para);
      else block.push(...para);
    }
    return block;
  }
}

export class TaggedCorpusReader extends CorpusReader {
  protected _sep: string;
  protected _word_tokenizer: TextTokenizerLike;
  protected _sent_tokenizer: TextTokenizerLike;
  protected _para_block_reader: BlockReader<string>;

  constructor(root: string | PathPointer, fileids: string | string[], sep = "/",
    wordTokenizer: TextTokenizerLike = new WhitespaceTokenizer(),
    sentTokenizer: TextTokenizerLike = regexpAsTokenizer(new RegexpTokenizer("\n", { gaps: true })),
    paraBlockReader: BlockReader<string> = read_blankline_block,
    encoding: EncodingSpec = "utf8", tagset: string | null = null) {
    super(root, fileids, encoding, tagset);
    this._sep = sep;
    this._word_tokenizer = wordTokenizer;
    this._sent_tokenizer = sentTokenizer;
    this._para_block_reader = paraBlockReader;
  }

  private tagMapping(tagset: string | null): ((t: string) => string) | null {
    if (tagset && tagset !== this._tagset) return (t) => mapTag(this._tagset!, tagset, t);
    return null;
  }

  private view(fileid: PathPointer, enc: string | null, tagged: boolean, sent: boolean, para: boolean, tagset: string | null): TaggedCorpusView {
    return new TaggedCorpusView(fileid, enc, tagged, sent, para, this._sep,
      this._word_tokenizer, this._sent_tokenizer, this._para_block_reader, this.tagMapping(tagset));
  }

  words(fileids?: string | string[] | null): unknown {
    return concat((this.abspaths(fileids, true) as Array<[PathPointer, string | null]>)
      .map(([f, e]) => this.view(f, e, false, false, false, null)));
  }

  sents(fileids?: string | string[] | null): unknown {
    return concat((this.abspaths(fileids, true) as Array<[PathPointer, string | null]>)
      .map(([f, e]) => this.view(f, e, false, true, false, null)));
  }

  paras(fileids?: string | string[] | null): unknown {
    return concat((this.abspaths(fileids, true) as Array<[PathPointer, string | null]>)
      .map(([f, e]) => this.view(f, e, false, true, true, null)));
  }

  tagged_words(fileids?: string | string[] | null, tagset: string | null = null): unknown {
    return concat((this.abspaths(fileids, true) as Array<[PathPointer, string | null]>)
      .map(([f, e]) => this.view(f, e, true, false, false, tagset)));
  }

  taggedWords(fileids?: string | string[] | null, tagset: string | null = null): unknown { return this.tagged_words(fileids, tagset); }

  tagged_sents(fileids?: string | string[] | null, tagset: string | null = null): unknown {
    return concat((this.abspaths(fileids, true) as Array<[PathPointer, string | null]>)
      .map(([f, e]) => this.view(f, e, true, true, false, tagset)));
  }

  taggedSents(fileids?: string | string[] | null, tagset: string | null = null): unknown { return this.tagged_sents(fileids, tagset); }

  tagged_paras(fileids?: string | string[] | null, tagset: string | null = null): unknown {
    return concat((this.abspaths(fileids, true) as Array<[PathPointer, string | null]>)
      .map(([f, e]) => this.view(f, e, true, true, true, tagset)));
  }

  taggedParas(fileids?: string | string[] | null, tagset: string | null = null): unknown { return this.tagged_paras(fileids, tagset); }
}

export class CategorizedTaggedCorpusReader extends TaggedCorpusReader {
  constructor(root: string | PathPointer, fileids: string | string[], sep = "/",
    wordTokenizer?: TextTokenizerLike, sentTokenizer?: TextTokenizerLike,
    paraBlockReader?: BlockReader<string>, encoding: EncodingSpec = "utf8",
    tagset: string | null = null, catInit?: CategorizedInit) {
    super(root, fileids, sep, wordTokenizer, sentTokenizer, paraBlockReader, encoding, tagset);
    this._cat = new CategorizedCorpusReaderBase(root, this._fileids, encoding, tagset);
    categorizedInit(this._cat, catInit ?? {});
  }

  private _cat: CategorizedCorpusReaderBase;

  categories(fileids?: string | string[] | null): string[] { return this._cat.categories(fileids); }
  override fileids(categories?: string | string[] | null): string[] {
    if (categories == null) return super.fileids();
    return this._cat.fileids(categories);
  }
  protected resolve(fileids: string | string[] | null | undefined, categories: string | string[] | null | undefined): string | string[] | null | undefined {
    return this._cat._resolve(fileids, categories);
  }

  tagged_words_cats(fileids?: string | string[] | null, categories?: string | string[] | null, tagset: string | null = null): unknown {
    return this.tagged_words(this.resolve(fileids, categories), tagset);
  }
  tagged_sents_cats(fileids?: string | string[] | null, categories?: string | string[] | null, tagset: string | null = null): unknown {
    return this.tagged_sents(this.resolve(fileids, categories), tagset);
  }
  tagged_paras_cats(fileids?: string | string[] | null, categories?: string | string[] | null, tagset: string | null = null): unknown {
    return this.tagged_paras(this.resolve(fileids, categories), tagset);
  }
}

export class MacMorphoCorpusReader extends TaggedCorpusReader {
  constructor(root: string | PathPointer, fileids: string | string[], encoding: EncodingSpec = "utf8", tagset: string | null = null) {
    super(root, fileids, "_", new LineTokenizer(), regexpAsTokenizer(new RegexpTokenizer(".*\n")),
      (stream) => read_regexp_block(stream, ".*", ".*_\\."), encoding, tagset);
  }
}

export class TimitTaggedCorpusReader extends TaggedCorpusReader {
  constructor(root: string | PathPointer, fileids: string | string[], encoding: EncodingSpec = "utf8", tagset: string | null = null) {
    super(root, fileids, "/", new WhitespaceTokenizer(), regexpAsTokenizer(new RegexpTokenizer("\n", { gaps: true })),
      read_timit_block, encoding, tagset);
  }

  override paras(): unknown {
    throw pyError("NotImplementedError", "use sents() instead");
  }
  override tagged_paras(): unknown {
    throw pyError("NotImplementedError", "use tagged_sents() instead");
  }
}

/** nltk.corpus.reader.timit.read_timit_block — one sentence per block. */
export function read_timit_block(stream: SeekableUnicodeStreamReader): string[] {
  const line = stream.readline();
  if (!line) return [];
  return [line];
}

// { dependency

export class DependencyCorpusView extends StreamBackedCorpusView<unknown> {
  static readonly _DOCSTART = "-DOCSTART- -DOCSTART- O\n";
  private _tagged: boolean;
  private _dependencies: boolean;
  private _group_by_sent: boolean;

  constructor(corpusFile: string | PathPointer, tagged: boolean, groupBySent: boolean, dependencies: boolean, _chunkTypes?: unknown, encoding: string | null = "utf8") {
    super(corpusFile, undefined, 0, encoding);
    this._tagged = tagged;
    this._dependencies = dependencies;
    this._group_by_sent = groupBySent;
    this.read_block = (stream) => this.readBlockImpl(stream);
  }

  private readBlockImpl(stream: SeekableUnicodeStreamReader): unknown[] {
    const parts = read_blankline_block(stream);
    let sent = parts[0]!.trim();
    if (sent.startsWith(DependencyCorpusView._DOCSTART)) {
      sent = sent.slice(DependencyCorpusView._DOCSTART.length).replace(/^\s+/, "");
    }
    if (this._dependencies) {
      // NLTK: the block is the raw sentence string for DependencyGraph.
      return this._group_by_sent ? [sent] : [sent];
    }
    const lines = sent.split("\n").map((line) => line.split("\t"));
    let tagged: Array<[string, string]>;
    if (lines[0]!.length === 3 || lines[0]!.length === 4) {
      tagged = lines.map((line) => [line[0]!, line[1]!]);
    } else if (lines[0]!.length === 10) {
      tagged = lines.map((line) => [line[1]!, line[4]!]);
    } else {
      throw pyError("ValueError", "Unexpected number of fields in dependency tree file");
    }
    const out: unknown[] = this._tagged ? tagged : tagged.map(([w]) => w);
    return this._group_by_sent ? [out] : out;
  }
}

export class DependencyCorpusReader extends SyntaxCorpusReader {
  private views(fileids: string | string[] | null | undefined, tagged: boolean, sent: boolean, deps: boolean): StreamBackedCorpusView<unknown>[] {
    return (this.abspaths(fileids, true) as Array<[PathPointer, string | null]>)
      .map(([f, e]) => new DependencyCorpusView(f, tagged, sent, deps, undefined, e));
  }

  override words(fileids?: string | string[] | null): unknown {
    return concat(this.views(fileids, false, false, false));
  }
  override tagged_words(fileids?: string | string[] | null): unknown {
    return concat(this.views(fileids, true, false, false));
  }
  override sents(fileids?: string | string[] | null): unknown {
    return concat(this.views(fileids, false, true, false));
  }
  override tagged_sents(fileids?: string | string[] | null): unknown {
    return concat(this.views(fileids, true, true, false));
  }
  override parsed_sents(fileids?: string | string[] | null): unknown {
    const sents = concat(this.views(fileids, false, true, true)) as Iterable<unknown>;
    return [...sents].map((sent) => new DependencyGraph(sent as string));
  }
}

// { aligned

export class AlignedSentCorpusView extends StreamBackedCorpusView<unknown> {
  private _aligned: boolean;
  private _group_by_sent: boolean;
  private _word_tokenizer: TextTokenizerLike;
  private _sent_tokenizer: TextTokenizerLike;
  private _alignedsent_block_reader: BlockReader<string>;

  constructor(corpusFile: string | PathPointer, encoding: string | null, aligned: boolean,
    groupBySent: boolean, wordTokenizer: TextTokenizerLike, sentTokenizer: TextTokenizerLike,
    alignedsentBlockReader: BlockReader<string>) {
    super(corpusFile, undefined, 0, encoding);
    this._aligned = aligned;
    this._group_by_sent = groupBySent;
    this._word_tokenizer = wordTokenizer;
    this._sent_tokenizer = sentTokenizer;
    this._alignedsent_block_reader = alignedsentBlockReader;
    this.read_block = (stream) => this.readBlockImpl(stream);
  }

  private readBlockImpl(stream: SeekableUnicodeStreamReader): unknown[] {
    const block: unknown[] = [];
    for (const alignedsentStr of this._alignedsent_block_reader(stream)) {
      for (const sentStr of this._sent_tokenizer.tokenize(alignedsentStr)) {
        block.push(this._word_tokenizer.tokenize(sentStr));
      }
    }
    let out: unknown[];
    if (this._aligned) {
      block[2] = Alignment.fromstring((block[2] as string[]).join(" "));
      out = [new AlignedSent(block[0] as string[], block[1] as string[], block[2] as Alignment)];
    } else if (this._group_by_sent) {
      out = [block[0]];
    } else {
      out = [block[0] as unknown[]].flat() as unknown[];
      out = block[0] as unknown[];
    }
    return out;
  }
}

export class AlignedCorpusReader extends CorpusReader {
  constructor(root: string | PathPointer, fileids: string | string[],
    sep = "/", wordTokenizer: TextTokenizerLike = new WhitespaceTokenizer(),
    sentTokenizer: TextTokenizerLike = regexpAsTokenizer(new RegexpTokenizer("\n", { gaps: true })),
    alignedsentBlockReader: BlockReader<string> | null = null, encoding: EncodingSpec = "utf8") {
    super(root, fileids, encoding);
    this._sep = sep;
    this._word_tokenizer = wordTokenizer;
    this._sent_tokenizer = sentTokenizer;
    this._alignedsent_block_reader = alignedsentBlockReader;
  }

  protected _sep: string;
  protected _word_tokenizer: TextTokenizerLike;
  protected _sent_tokenizer: TextTokenizerLike;
  protected _alignedsent_block_reader: BlockReader<string> | null;

  words(fileids?: string | string[] | null): unknown {
    return concat((this.abspaths(fileids, true) as Array<[PathPointer, string | null]>)
      .map(([f, e]) => new AlignedSentCorpusView(f, e, false, false, this._word_tokenizer, this._sent_tokenizer, this._alignedsent_block_reader!)));
  }

  sents(fileids?: string | string[] | null): unknown {
    return concat((this.abspaths(fileids, true) as Array<[PathPointer, string | null]>)
      .map(([f, e]) => new AlignedSentCorpusView(f, e, false, true, this._word_tokenizer, this._sent_tokenizer, this._alignedsent_block_reader!)));
  }

  aligned_sents(fileids?: string | string[] | null): unknown {
    return concat((this.abspaths(fileids, true) as Array<[PathPointer, string | null]>)
      .map(([f, e]) => new AlignedSentCorpusView(f, e, true, true, this._word_tokenizer, this._sent_tokenizer, this._alignedsent_block_reader!)));
  }

  alignedSents(fileids?: string | string[] | null): unknown { return this.aligned_sents(fileids); }
}
