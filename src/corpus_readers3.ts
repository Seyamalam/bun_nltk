// nltk.corpus.reader.* — third tier: conll (grid readers + SRL),
// sinica_treebank, knbc, chasen, lin, toolbox, ycoe, switchboard, alpino.
// Originals: nltk/corpus/reader/{conll,sinica_treebank,knbc,chasen,lin,
// toolbox,ycoe,switchboard,bracket_parse}.py, nltk/tree/parsing.py

import { pyError } from "./internals";
import { PathPointer, FileSystemPathPointer } from "./data";
import { SeekableUnicodeStreamReader } from "./corpus_stream";
import {
  StreamBackedCorpusView, concat,
  read_blankline_block, read_regexp_block,
} from "./corpus_view";
import { CorpusReader, SyntaxCorpusReader, LazyCorpusLoader } from "./corpus_api";
import type { EncodingSpec } from "./corpus_api";
import { AbstractLazySequence, LazyConcatenation, LazyMap } from "./collections";
import { mapTag } from "./tag_mapping";
import { str2tuple } from "./tag_util";
import { SimpleTree, pyRepr } from "./corpus_tree";
import { BracketParseCorpusReader } from "./corpus_readers2";
import { TaggedCorpusReader } from "./corpus_text_readers";
import { WhitespaceTokenizer } from "./tokenizers";
import { ToolboxData } from "./toolbox";

// { conll

/** nltk ``LazyConcatenation(LazyMap(f, grids))``: the lazy map is itself the
 * outer sequence of sequences, so iteration flattens one level into each
 * element's contents. ``LazyConcatenation`` here takes an eager array of
 * sequences, so the elements are materialized once. */
function flattenLazy<T>(seq: AbstractLazySequence<T[] | ArrayLike<T>>): LazyConcatenation<T> {
  return new LazyConcatenation(
    Array.from({ length: seq.length }, (_, i) => seq.get(i) as T[]));
}

export class ConllCorpusReader extends CorpusReader {
  static WORDS = "words";
  static POS = "pos";
  static TREE = "tree";
  static CHUNK = "chunk";
  static NE = "ne";
  static SRL = "srl";
  static IGNORE = "ignore";
  static COLUMN_TYPES = ["words", "pos", "tree", "chunk", "ne", "srl", "ignore"];

  protected _chunk_types: string[] | null;
  protected _colmap: Record<string, number>;
  protected _pos_in_tree: boolean;
  protected _root_label: string;
  protected _srl_includes_roleset: boolean;
  protected _tree_class: typeof SimpleTree;
  sep: string | null;

  constructor(root: string | PathPointer, fileids: string | string[], columntypes: string[],
    chunkTypes: string | string[] | null = null, rootLabel = "S", posInTree = false,
    srlIncludesRoleset = true, encoding: EncodingSpec = "utf8",
    treeClass: typeof SimpleTree = SimpleTree, tagset: string | null = null,
    separator: string | null = null) {
    for (const columntype of columntypes) {
      if (!ConllCorpusReader.COLUMN_TYPES.includes(columntype)) {
        throw pyError("ValueError", `Bad column type ${pyRepr(columntype)}`);
      }
    }
    super(root, fileids, encoding);
    this._chunk_types = typeof chunkTypes === "string" ? [chunkTypes] : chunkTypes;
    this._colmap = {};
    columntypes.forEach((c, i) => { this._colmap[c] = i; });
    this._pos_in_tree = posInTree;
    this._root_label = rootLabel;
    this._srl_includes_roleset = srlIncludesRoleset;
    this._tree_class = treeClass;
    this._tagset = tagset;
    this.sep = separator;
  }

  private _grids(fileids?: string | string[] | null): unknown {
    const views = (this.abspaths(fileids, true) as Array<[PathPointer, string | null]>)
      .map(([fileid, enc]) => new StreamBackedCorpusView<string[][]>(fileid, (s) => this._readGridBlock(s), 0, enc));
    return concat(views);
  }

  private _readGridBlock(stream: SeekableUnicodeStreamReader): string[][][] {
    const grids: string[][][] = [];
    for (const block0 of read_blankline_block(stream)) {
      const block = block0.trim();
      if (!block) continue;
      const grid = block.split("\n").map((line) =>
        this.sep === null ? line.split(/\s+/).filter((x) => x !== "") : line.split(this.sep));
      if (grid[0]![this._colmap["words"] ?? 0] === "-DOCSTART-") grid.shift();
      for (const row of grid) {
        if (row.length !== grid[0]!.length) {
          throw pyError("ValueError", `Inconsistent number of columns:\n${block}`);
        }
      }
      grids.push(grid);
    }
    return grids;
  }

  private _require(...columntypes: string[]): void {
    for (const columntype of columntypes) {
      if (!(columntype in this._colmap)) {
        throw pyError("ValueError", `This corpus does not contain a ${columntype} column.`);
      }
    }
  }

  private _getColumn(grid: string[][], columnIndex: number): string[] {
    return grid.map((row) => row[columnIndex]!);
  }

  private _posTags(grid: string[][], tagset: string | null): string[] {
    let posTags = this._getColumn(grid, this._colmap["pos"]!);
    if (tagset && tagset !== this._tagset) {
      posTags = posTags.map((t) => mapTag(this._tagset!, tagset, t));
    }
    return posTags;
  }

  private _getWords(grid: string[][]): string[] {
    return this._getColumn(grid, this._colmap["words"]!);
  }

  private _getTaggedWords(grid: string[][], tagset: string | null): Array<[string, string]> {
    const words = this._getColumn(grid, this._colmap["words"]!);
    const posTags = this._posTags(grid, tagset);
    return words.map((w, i) => [w, posTags[i]!]);
  }

  private _getIobWords(grid: string[][], tagset: string | null): Array<[string, string, string]> {
    const words = this._getColumn(grid, this._colmap["words"]!);
    const posTags = this._posTags(grid, tagset);
    const chunkTags = this._getColumn(grid, this._colmap["chunk"]!);
    return words.map((w, i) => [w, posTags[i]!, chunkTags[i]!]);
  }

  private _getChunkedWords(grid: string[][], chunkTypes: string[] | null, tagset: string | null): SimpleTree {
    const words = this._getColumn(grid, this._colmap["words"]!);
    const posTags = this._posTags(grid, tagset);
    const chunkTags = this._getColumn(grid, this._colmap["chunk"]!);
    const stack: SimpleTree[] = [new SimpleTree(this._root_label, [])];
    for (let i = 0; i < words.length; i++) {
      const word = words[i]!, posTag = posTags[i]!, chunkTag = chunkTags[i]!;
      let state: string, chunkType: string;
      if (chunkTag === "O") {
        state = "O"; chunkType = "";
      } else {
        const parts = chunkTag.split("-");
        state = parts[0]!;
        chunkType = parts.length === 2 ? parts[1]! : parts.slice(1).join("-");
        if ((state !== "B" && state !== "I") || !chunkType) {
          throw pyError("ValueError",
            `Malformed chunk tag ${pyRepr(chunkTag)}: expected 'O' or '<B|I>-<type>' (e.g. 'B-NP')`);
        }
      }
      if (chunkTypes !== null && !chunkTypes.includes(chunkType)) state = "O";
      if (state === "I" && chunkType !== stack[stack.length - 1]!.label) state = "B";
      if ((state === "B" || state === "O") && stack.length === 2) stack.pop();
      if (state === "B") {
        const newChunk = new SimpleTree(chunkType, []);
        stack[stack.length - 1]!.children.push(newChunk);
        stack.push(newChunk);
      }
      stack[stack.length - 1]!.children.push([word, posTag] as [string, string]);
    }
    return stack[0]!;
  }

  private _getParsedSent(grid: string[][], posInTree: boolean, tagset: string | null = null): SimpleTree {
    const words = this._getColumn(grid, this._colmap["words"]!);
    const posTags = this._posTags(grid, tagset);
    const parseTags = this._getColumn(grid, this._colmap["tree"]!);
    let treestr = "";
    for (let i = 0; i < words.length; i++) {
      let word = words[i]!, posTag = posTags[i]!;
      const parseTag = parseTags[i]!;
      if (word === "(") word = "-LRB-";
      if (word === ")") word = "-RRB-";
      if (posTag === "(") posTag = "-LRB-";
      if (posTag === ")") posTag = "-RRB-";
      const parts = parseTag.split("*");
      if (parts.length !== 2) {
        throw pyError("ValueError",
          `Malformed parse tag ${pyRepr(parseTag)}: expected exactly one '*' word placeholder (e.g. '(NP*' or '*)')`);
      }
      const left = parts[0]!;
      const right = ")".repeat((parts[1]!.match(/\)/g) ?? []).length);
      treestr += `${left} (${posTag} ${word}) ${right}`;
    }
    let tree: SimpleTree;
    try {
      tree = this._tree_class.fromstring(treestr);
    } catch {
      tree = this._tree_class.fromstring(`(${this._root_label} ${treestr})`);
    }
    if (!posInTree) {
      for (const subtree of subtrees(tree)) {
        for (const [i, child] of subtree.children.entries()) {
          if (child instanceof SimpleTree && child.children.length === 1 && typeof child.children[0] === "string") {
            subtree.children[i] = [child.children[0], child.label] as [string, string];
          }
        }
      }
    }
    return tree;
  }

  private _getSrlSpans(grid: string[][]): Array<Array<[[number, number], string]>> {
    let predicates: string[], startCol: number;
    if (this._srl_includes_roleset) {
      predicates = this._getColumn(grid, this._colmap["srl"]! + 1);
      startCol = this._colmap["srl"]! + 2;
    } else {
      predicates = this._getColumn(grid, this._colmap["srl"]!);
      startCol = this._colmap["srl"]! + 1;
    }
    const numPreds = predicates.filter((p) => p !== "-").length;
    const spanlists: Array<Array<[[number, number], string]>> = [];
    for (let i = 0; i < numPreds; i++) {
      const col = this._getColumn(grid, startCol + i);
      const spanlist: Array<[[number, number], string]> = [];
      const stack: Array<[string, number]> = [];
      for (const [wordnum, srlTag] of col.entries()) {
        const parts = srlTag.split("*");
        if (parts.length !== 2) {
          throw pyError("ValueError",
            `Malformed SRL tag ${pyRepr(srlTag)}: expected exactly one '*' word placeholder (e.g. '(A0*' or '*)')`);
        }
        const [left, right] = parts as [string, string];
        for (const tag of left.split("(")) if (tag) stack.push([tag, wordnum]);
        for (let j = 0; j < (right.match(/\)/g) ?? []).length; j++) {
          const [tag, start] = stack.pop()!;
          spanlist.push([[start, wordnum + 1], tag]);
        }
      }
      spanlists.push(spanlist);
    }
    return spanlists;
  }

  private _getSrlInstances(grid: string[][], posInTree: boolean): ConllSRLInstanceList {
    const tree = this._getParsedSent(grid, posInTree);
    const spanlists = this._getSrlSpans(grid);
    let predicates: string[], rolesets: Array<string | null>;
    if (this._srl_includes_roleset) {
      predicates = this._getColumn(grid, this._colmap["srl"]! + 1);
      rolesets = this._getColumn(grid, this._colmap["srl"]!);
    } else {
      predicates = this._getColumn(grid, this._colmap["srl"]!);
      rolesets = predicates.map(() => null);
    }
    const instances = new ConllSRLInstanceList(tree);
    for (const [wordnum, predicate] of predicates.entries()) {
      if (predicate === "-") continue;
      let spanlist: Array<[[number, number], string]> | null = null;
      outer: for (const sl of spanlists) {
        for (const [[start, end], tag] of sl) {
          if (wordnum >= start && wordnum < end && (tag === "V" || tag === "C-V")) {
            spanlist = sl;
            break outer;
          }
        }
      }
      if (spanlist === null) {
        throw pyError("ValueError", `No srl column found for ${pyRepr(predicate)}`);
      }
      instances.push(new ConllSRLInstance(tree, wordnum, predicate, rolesets[wordnum]!, spanlist));
    }
    return instances;
  }

  words(fileids?: string | string[] | null): unknown {
    this._require(ConllCorpusReader.WORDS);
    return flattenLazy(new LazyMap((g: string[][]) => this._getWords(g), this._grids(fileids) as never));
  }

  sents(fileids?: string | string[] | null): unknown {
    this._require(ConllCorpusReader.WORDS);
    return new LazyMap((g: string[][]) => this._getWords(g), this._grids(fileids) as never);
  }

  tagged_words(fileids?: string | string[] | null, tagset: string | null = null): unknown {
    this._require(ConllCorpusReader.WORDS, ConllCorpusReader.POS);
    return flattenLazy(new LazyMap((g: string[][]) => this._getTaggedWords(g, tagset), this._grids(fileids) as never));
  }
  taggedWords(fileids?: string | string[] | null, tagset: string | null = null): unknown { return this.tagged_words(fileids, tagset); }

  tagged_sents(fileids?: string | string[] | null, tagset: string | null = null): unknown {
    this._require(ConllCorpusReader.WORDS, ConllCorpusReader.POS);
    return new LazyMap((g: string[][]) => this._getTaggedWords(g, tagset), this._grids(fileids) as never);
  }
  taggedSents(fileids?: string | string[] | null, tagset: string | null = null): unknown { return this.tagged_sents(fileids, tagset); }

  chunked_words(fileids?: string | string[] | null, chunkTypes: string[] | null = null, tagset: string | null = null): unknown {
    this._require(ConllCorpusReader.WORDS, ConllCorpusReader.POS, ConllCorpusReader.CHUNK);
    const ct = chunkTypes ?? this._chunk_types;
    // NLTK LazyConcatenation over trees iterates each tree's children.
    return flattenLazy(new LazyMap(
      (g: string[][]) => [...this._getChunkedWords(g, ct, tagset).children] as unknown as never[],
      this._grids(fileids) as never));
  }
  chunkedWords(fileids?: string | string[] | null, chunkTypes: string[] | null = null, tagset: string | null = null): unknown { return this.chunked_words(fileids, chunkTypes, tagset); }

  chunked_sents(fileids?: string | string[] | null, chunkTypes: string[] | null = null, tagset: string | null = null): unknown {
    this._require(ConllCorpusReader.WORDS, ConllCorpusReader.POS, ConllCorpusReader.CHUNK);
    const ct = chunkTypes ?? this._chunk_types;
    return new LazyMap((g: string[][]) => this._getChunkedWords(g, ct, tagset), this._grids(fileids) as never);
  }
  chunkedSents(fileids?: string | string[] | null, chunkTypes: string[] | null = null, tagset: string | null = null): unknown { return this.chunked_sents(fileids, chunkTypes, tagset); }

  parsed_sents(fileids?: string | string[] | null, posInTree: boolean | null = null, tagset: string | null = null): unknown {
    this._require(ConllCorpusReader.WORDS, ConllCorpusReader.POS, ConllCorpusReader.TREE);
    const pit = posInTree ?? this._pos_in_tree;
    return new LazyMap((g: string[][]) => this._getParsedSent(g, pit, tagset), this._grids(fileids) as never);
  }
  parsedSents(fileids?: string | string[] | null, posInTree: boolean | null = null, tagset: string | null = null): unknown { return this.parsed_sents(fileids, posInTree, tagset); }

  srl_spans(fileids?: string | string[] | null): unknown {
    this._require(ConllCorpusReader.SRL);
    return new LazyMap((g: string[][]) => this._getSrlSpans(g), this._grids(fileids) as never);
  }
  srlSpans(fileids?: string | string[] | null): unknown { return this.srl_spans(fileids); }

  srl_instances(fileids?: string | string[] | null, posInTree: boolean | null = null, flatten = true): unknown {
    this._require(ConllCorpusReader.WORDS, ConllCorpusReader.POS, ConllCorpusReader.TREE, ConllCorpusReader.SRL);
    const pit = posInTree ?? this._pos_in_tree;
    const result = new LazyMap((g: string[][]) => this._getSrlInstances(g, pit), this._grids(fileids) as never);
    return flatten ? flattenLazy(result) : result;
  }
  srlInstances(fileids?: string | string[] | null, posInTree: boolean | null = null, flatten = true): unknown { return this.srl_instances(fileids, posInTree, flatten); }

  iob_words(fileids?: string | string[] | null, tagset: string | null = null): unknown {
    this._require(ConllCorpusReader.WORDS, ConllCorpusReader.POS, ConllCorpusReader.CHUNK);
    return flattenLazy(new LazyMap((g: string[][]) => this._getIobWords(g, tagset), this._grids(fileids) as never));
  }
  iobWords(fileids?: string | string[] | null, tagset: string | null = null): unknown { return this.iob_words(fileids, tagset); }

  iob_sents(fileids?: string | string[] | null, tagset: string | null = null): unknown {
    this._require(ConllCorpusReader.WORDS, ConllCorpusReader.POS, ConllCorpusReader.CHUNK);
    return new LazyMap((g: string[][]) => this._getIobWords(g, tagset), this._grids(fileids) as never);
  }
  iobSents(fileids?: string | string[] | null, tagset: string | null = null): unknown { return this.iob_sents(fileids, tagset); }
}

function* subtrees(tree: SimpleTree): Generator<SimpleTree> {
  yield tree;
  for (const c of tree.children) {
    if (c instanceof SimpleTree) yield* subtrees(c);
  }
}

export class ConllSRLInstance {
  verb: number[] = [];
  verb_head: number;
  verb_stem: string;
  roleset: string | null;
  arguments: Array<[[number, number], string]> = [];
  tagged_spans: Array<[[number, number], string]>;
  tree: SimpleTree;
  words: Array<string | [string, string | null]>;

  constructor(tree: SimpleTree, verbHead: number, verbStem: string, roleset: string | null,
    taggedSpans: Array<[[number, number], string]>) {
    this.verb_head = verbHead;
    this.verb_stem = verbStem;
    this.roleset = roleset;
    this.tagged_spans = taggedSpans;
    this.tree = tree;
    this.words = tree.leaves();
    for (const [[start, end], tag] of taggedSpans) {
      if (tag === "V" || tag === "C-V") {
        for (let i = start; i < end; i++) this.verb.push(i);
      } else {
        this.arguments.push([[start, end], tag]);
      }
    }
  }

  repr(): string {
    const plural = this.arguments.length !== 1 ? "s" : "";
    return `<ConllSRLInstance for ${pyRepr(this.verb_stem)} with ${this.arguments.length} argument${plural}>`;
  }
  toString(): string { return this.repr(); }

  pprint(): string {
    const wordAt = (i: number): string => {
      const w = this.words[i]!;
      return Array.isArray(w) ? w[0] : w;
    };
    const verbstr = this.verb.map((i) => wordAt(i)).join(" ");
    const hdr = `SRL for ${pyRepr(verbstr)} (stem=${pyRepr(this.verb_stem)}):\n`;
    let s = "";
    for (let i = 0; i < this.words.length; i++) {
      let word = wordAt(i);
      for (const [[start, end], argid] of this.arguments) {
        if (i === start) s += `[${argid} `;
        if (i === end) s += "] ";
      }
      if (this.verb.includes(i)) word = `<<${word}>>`;
      s += word + " ";
    }
    return hdr + textwrapFill(s.replace(/ \]/g, "]"), { initialIndent: "    ", subsequentIndent: "    " });
  }
}

export class ConllSRLInstanceList extends Array<ConllSRLInstance> {
  tree: SimpleTree;
  constructor(tree: SimpleTree, instances: ConllSRLInstance[] = []) {
    super(...instances);
    this.tree = tree;
  }

  pprint(includeTree = false): string {
    for (const inst of this) {
      if (inst.tree !== this.tree) throw pyError("ValueError", "Tree mismatch!");
    }
    let words: Array<string | [string, string | null]> = [];
    let pos: Array<string | null> = [];
    let synt: string[] = [];
    if (includeTree) {
      words = this.tree.leaves();
      pos = words.map(() => null);
      synt = words.map(() => "*");
      this._tree2conll(this.tree, 0, words, pos, synt);
    }
    let s = "";
    for (let i = 0; i < words.length; i++) {
      if (includeTree) {
        s += `${String(words[i]).padEnd(20)} `;
        s += `${String(pos[i]).padEnd(8)} `;
        const parts = synt[i]!.split("*");
        s += `${(parts[0] ?? "").padStart(15)}*${(parts[1] ?? "").padEnd(8)} `;
      }
      let found = false;
      for (const inst of this) {
        if (i === inst.verb_head) { s += `${inst.verb_stem.padEnd(20)} `; found = true; break; }
      }
      if (!found) s += `${"-".padEnd(20)} `;
      for (const inst of this) {
        let argstr = "*";
        for (const [[start, end], argid] of inst.tagged_spans) {
          if (i === start) argstr = `(${argid}${argstr}`;
          if (i === end - 1) argstr += ")";
        }
        s += `${argstr.padEnd(12)} `;
      }
      s += "\n";
    }
    return s;
  }
  override toString(): string { return this.pprint(); }

  private _tree2conll(tree: SimpleTree, wordnum: number, words: unknown[], pos: Array<string | null>, synt: string[]): number {
    const first = tree.children[0];
    if (tree.children.length === 1 && typeof first === "string") {
      pos[wordnum] = tree.label;
      return wordnum + 1;
    } else if (tree.children.length === 1 && Array.isArray(first)) {
      pos[wordnum] = first[1];
      return wordnum + 1;
    } else {
      synt[wordnum] = `(${tree.label}${synt[wordnum]}`;
      let wn = wordnum;
      for (const child of tree.children) {
        if (child instanceof SimpleTree) wn = this._tree2conll(child, wn, words, pos, synt);
      }
      synt[wn - 1] += ")";
      return wn;
    }
  }
}

// { sinica_treebank

/** nltk.tree.sinica_parse — Sinica ICG notation → bracketed tree. */
export function sinica_parse(s: string): SimpleTree {
  const tokens = s.split(/([()| ])/);
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === "(") {
      const tmp = tokens[i - 1]!;
      tokens[i - 1] = tokens[i]!;
      tokens[i] = tmp;
    } else if (tokens[i]!.includes(":")) {
      const fields = tokens[i]!.split(":");
      if (fields.length === 2) tokens[i] = fields[1]!;
      else tokens[i] = `(${fields[fields.length - 2]} ${fields[fields.length - 1]})`;
    } else if (tokens[i] === "|") {
      tokens[i] = "";
    }
  }
  return SimpleTree.fromstring(tokens.join(" "), { remove_empty_top_bracketing: true });
}
export const sinicaParse = sinica_parse;

const SINICA_IDENTIFIER = /^#\S+\s/;
const SINICA_APPENDIX = /(?<=\))#.*$/;
const SINICA_TAGWORD = /:([^:()|]+):([^:()|]+)/g;
const SINICA_WORD = /:[^:()|]+:([^:()|]+)/g;

export class SinicaTreebankCorpusReader extends SyntaxCorpusReader {
  protected override _read_block(stream: SeekableUnicodeStreamReader): unknown[] {
    let sent = stream.readline();
    sent = sent.replace(SINICA_IDENTIFIER, "").replace(SINICA_APPENDIX, "");
    return [sent];
  }
  protected override _parse(sent: unknown): SimpleTree {
    return sinica_parse(sent as string);
  }
  protected override _tag(sent: unknown, tagset: string | null = null): Array<[string, string | null]> {
    const text = sent as string;
    let taggedSent: Array<[string, string | null]> = [];
    SINICA_TAGWORD.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = SINICA_TAGWORD.exec(text)) !== null) taggedSent.push([m[2]!, m[1]!]);
    if (tagset && tagset !== this._tagset) {
      taggedSent = taggedSent.map(([w, t]) => [w, t === null ? t : mapTag(this._tagset!, tagset, t)]);
    }
    return taggedSent;
  }
  protected override _word(sent: unknown): string[] {
    const text = sent as string;
    const out: string[] = [];
    SINICA_WORD.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = SINICA_WORD.exec(text)) !== null) out.push(m[1]!);
    return out;
  }
}

// { knbc

const _morphs2str_default = (morphs: Array<[string, string]>): string =>
  morphs.filter((m) => m[0] !== "EOS").map((m) => m[0]).join("/");

/** Python str.splitlines() — drops the trailing empty element split("\n") keeps. */
function splitlines(s: string): string[] {
  const lines = s.split(/\r\n|\r|\n/);
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** Python ``str.split(sep, maxsplit)`` — the remainder stays in the last
 * element (JS split's limit parameter drops it instead). */
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

interface KnbNode { address: number | null; rel: string | null; word: Array<[string, string]> | string | null }

export class KNBCorpusReader extends SyntaxCorpusReader {
  morphs2str: ((morphs: Array<[string, string]>) => string) | null;

  constructor(root: string | PathPointer, fileids: string | string[], encoding: EncodingSpec = "utf8",
    morphs2str: ((morphs: Array<[string, string]>) => string) | null = _morphs2str_default) {
    super(root, fileids, encoding);
    this.morphs2str = morphs2str;
  }

  protected override _read_block(stream: SeekableUnicodeStreamReader): unknown[] {
    return read_blankline_block(stream);
  }

  protected override _word(t: unknown): string[] {
    const res: string[] = [];
    for (const line of splitlines(t as string)) {
      if (!/^(?:EOS|\*|#|\+)/.test(line)) {
        const cells = line.trim().split(" ");
        res.push(cells[0]!);
      }
    }
    return res;
  }

  protected override _tag(t: unknown, _tagset: string | null = null): Array<[string, string]> {
    const res: Array<[string, string]> = [];
    for (const line of splitlines(t as string)) {
      if (!/^(?:EOS|\*|#|\+)/.test(line)) {
        const cells = line.trim().split(" ");
        res.push([cells[0]!, cells.slice(1).join(" ")]);
      }
    }
    return res;
  }

  protected override _parse(t: unknown): SimpleTree {
    // Mirrors NLTK's DependencyGraph-backed parse: dg.nodes is a defaultdict
    // (auto-vivifies on access) and node["deps"] is a defaultdict(list), so
    // ``dg.nodes[dep_parent]["deps"].append(i)`` raises AttributeError for any
    // non-root bunsetsu in NLTK 3.10.3.
    const nodes = new Map<number, KnbNode>();
    const node = (i: number): KnbNode => {
      let n = nodes.get(i);
      if (!n) { n = { address: null, rel: null, word: null }; nodes.set(i, n); }
      return n;
    };
    node(0); // dg.__init__ creates the TOP node at index 0
    let root: KnbNode | null = null;
    let i = 0;
    for (const line of splitlines(t as string)) {
      if (line === "") throw pyError("IndexError", "string index out of range");
      if (line[0] === "*" || line[0] === "+") {
        // start of bunsetsu or tag
        const cells = splitMax(line.trim(), " ", 3);
        const cell1 = cells[1];
        if (cell1 === undefined) throw pyError("IndexError", "list index out of range");
        const m = /^([-0-9]*)([ADIP])/.exec(cell1);
        if (m === null) throw pyError("AssertionError", "");
        const n = node(i);
        n.address = i; n.rel = m[2]!; n.word = [];
        if (!/^[+-]?\d+$/.test(m[1]!)) {
          throw pyError("ValueError",
            `invalid literal for int() with base 10: ${pyRepr(m[1])}`);
        }
        const depParent = parseInt(m[1]!, 10);
        if (depParent === -1) {
          root = n;
        } else {
          node(depParent); // defaultdict auto-vivification side effect
          throw pyError("AttributeError", "'collections.defaultdict' object has no attribute 'append'");
        }
        i += 1;
      } else if (line[0] !== "#") {
        // normal morph
        const cells = line.trim().split(" ");
        const morph: [string, string] = [cells[0]!, cells.slice(1).join(" ")];
        const n = node(i - 1);
        if (n.word === null) n.word = [];
        (n.word as Array<[string, string]>).push(morph);
      }
    }
    if (this.morphs2str) {
      for (const n of nodes.values()) {
        if (n.word === null) throw pyError("TypeError", "'NoneType' object is not iterable");
        n.word = this.morphs2str(n.word as Array<[string, string]>);
      }
    }
    // dg.tree(): Tree(word, children from root node["deps"]) — deps is always
    // the empty defaultdict here since appends raise AttributeError above.
    if (root === null) throw pyError("TypeError", "'NoneType' object is not subscriptable");
    const rootNode = node(root.address!);
    return new SimpleTree(rootNode.word as string ?? "", []);
  }
}

export function knbc_test(): void {
  const knbc = new LazyCorpusLoader("knbc/corpus1", KNBCorpusReader as never, [".*/KN.*"], { encoding: "euc-jp" });
  const w = knbc.words() as Iterable<unknown>;
  const s = knbc.sents() as Iterable<unknown>;
  const tw = knbc.call("tagged_words") as Iterable<unknown>;
  const ts = knbc.call("tagged_sents") as Iterable<unknown>;
  for (const _x of [w, s, tw, ts]) void _x;
}

// { chasen

export class ChasenCorpusView extends StreamBackedCorpusView<unknown> {
  private _tagged: boolean;
  private _group_by_sent: boolean;
  private _group_by_para: boolean;
  private _sent_splitter: ((w: [string, string]) => boolean) | null;

  constructor(corpusFile: string | PathPointer, encoding: string | null, tagged: boolean,
    groupBySent: boolean, groupByPara: boolean,
    sentSplitter: ((w: [string, string]) => boolean) | null = null) {
    super(corpusFile, undefined, 0, encoding);
    this._tagged = tagged;
    this._group_by_sent = groupBySent;
    this._group_by_para = groupByPara;
    this._sent_splitter = sentSplitter;
    this.read_block = (stream) => this.readBlock(stream);
  }

  readBlock(stream: SeekableUnicodeStreamReader): unknown[] {
    const block: unknown[] = [];
    for (const paraStr of read_regexp_block(stream, ".", "^EOS\n")) {
      const para: unknown[] = [];
      let sent: Array<[string, string]> = [];
      for (const line of splitlines(paraStr)) {
        const eos = line.trim() === "EOS";
        const cells = line.split("\t");
        const w: [string, string] = [cells[0]!, cells.slice(1).join("\t")];
        if (!eos) sent.push(w);
        if (eos || (this._sent_splitter && this._sent_splitter(w))) {
          const sentOut: unknown[] = this._tagged ? sent.map((x) => x) : sent.map((x) => x[0]);
          if (this._group_by_sent) para.push(sentOut);
          else para.push(...sentOut);
          sent = [];
        }
      }
      if (sent.length > 0) {
        const sentOut: unknown[] = this._tagged ? sent.map((x) => x) : sent.map((x) => x[0]);
        if (this._group_by_sent) para.push(sentOut);
        else para.push(...sentOut);
      }
      if (this._group_by_para) block.push(para);
      else block.push(...para);
    }
    return block;
  }
}

export class ChasenCorpusReader extends CorpusReader {
  private _sent_splitter: ((w: [string, string]) => boolean) | null;

  constructor(root: string | PathPointer, fileids: string | string[], encoding: EncodingSpec = "utf8",
    sentSplitter: ((w: [string, string]) => boolean) | null = null) {
    super(root, fileids, encoding);
    this._sent_splitter = sentSplitter;
  }

  private view(tagged: boolean, sent: boolean, para: boolean, fileids?: string | string[] | null): unknown {
    const views = (this.abspaths(fileids, true) as Array<[PathPointer, string | null]>)
      .map(([fileid, enc]) => new ChasenCorpusView(fileid, enc, tagged, sent, para, this._sent_splitter));
    return concat(views);
  }

  words(fileids?: string | string[] | null): unknown { return this.view(false, false, false, fileids); }
  tagged_words(fileids?: string | string[] | null): unknown { return this.view(true, false, false, fileids); }
  taggedWords(fileids?: string | string[] | null): unknown { return this.tagged_words(fileids); }
  sents(fileids?: string | string[] | null): unknown { return this.view(false, true, false, fileids); }
  tagged_sents(fileids?: string | string[] | null): unknown { return this.view(true, true, false, fileids); }
  taggedSents(fileids?: string | string[] | null): unknown { return this.tagged_sents(fileids); }
  paras(fileids?: string | string[] | null): unknown { return this.view(false, true, true, fileids); }
  tagged_paras(fileids?: string | string[] | null): unknown { return this.view(true, true, true, fileids); }
  taggedParas(fileids?: string | string[] | null): unknown { return this.tagged_paras(fileids); }
}

export function chasen_test(): void {
  const jeita = new LazyCorpusLoader("jeita", ChasenCorpusReader as never, [".*chasen"], { encoding: "utf-8" });
  const tw = jeita.call("tagged_words") as Iterable<unknown>;
  void tw;
}

// { lin (Lin's thesaurus)

export class LinThesaurusCorpusReader extends CorpusReader {
  static _key_re = /\("?([^"]+)"? \(desc [0-9.]+\).+/;
  private _thesaurus: Map<string, Map<string, Map<string, number>>> = new Map();
  private _badscore: number;

  constructor(root: string | PathPointer, badscore = 0.0) {
    super(root, "sim[A-Z]\\.lsp");
    this._badscore = badscore;
    for (const [path, enc, fileid] of this.abspaths(undefined, true, true) as Array<[PathPointer, string | null, string]>) {
      let fileMap = this._thesaurus.get(fileid);
      if (!fileMap) { fileMap = new Map(); this._thesaurus.set(fileid, fileMap); }
      const text = path.open(enc ?? "utf-8").read();
      let first = true;
      let key = "";
      for (const rawLine of text.split("\n")) {
        const line = rawLine.trim();
        if (first) {
          key = line.replace(LinThesaurusCorpusReader._key_re, "$1");
          first = false;
        } else if (line === "))") {
          first = true;
        } else {
          const splitLine = line.split("\t");
          if (splitLine.length === 2) {
            const [ngram, score] = splitLine as [string, string];
            let entry = fileMap.get(key);
            if (!entry) { entry = new Map(); fileMap.set(key, entry); }
            entry.set(ngram.replace(/^"|"$/g, ""), parseFloat(score));
          }
        }
      }
    }
  }

  similarity(ngram1: string, ngram2: string, fileid: string | null = null): number | Array<[string, number]> {
    if (ngram1 === ngram2) {
      if (fileid) return 1.0;
      return this._fileids.map((fid) => [fid, 1.0] as [string, number]);
    }
    const scoreFor = (fid: string): number => {
      const v = this._thesaurus.get(fid)?.get(ngram1)?.get(ngram2);
      return v === undefined ? this._badscore : v;
    };
    if (fileid) return scoreFor(fileid);
    return this._fileids.map((fid) => [fid, scoreFor(fid)] as [string, number]);
  }

  scored_synonyms(ngram: string, fileid: string | null = null): Array<[string, number]> | Array<[string, Array<[string, number]>]> {
    const items = (fid: string): Array<[string, number]> => [...(this._thesaurus.get(fid)?.get(ngram)?.entries() ?? [])];
    if (fileid) return items(fileid);
    return this._fileids.map((fid) => [fid, items(fid)] as [string, Array<[string, number]>]);
  }
  scoredSynonyms(ngram: string, fileid: string | null = null): unknown { return this.scored_synonyms(ngram, fileid); }

  synonyms(ngram: string, fileid: string | null = null): string[] | Array<[string, string[]]> {
    const keys = (fid: string): string[] => [...(this._thesaurus.get(fid)?.get(ngram)?.keys() ?? [])];
    if (fileid) return keys(fileid);
    return this._fileids.map((fid) => [fid, keys(fid)] as [string, string[]]);
  }

  contains(ngram: string): boolean {
    return this._fileids.some((fid) => this._thesaurus.get(fid)?.has(ngram));
  }
}

// { toolbox

export class ToolboxCorpusReader extends CorpusReader {
  xml(fileids: string | string[], key: string | null = null): unknown {
    return concat((this.abspaths(fileids, true) as Array<[PathPointer, string | null]>)
      .map(([path, enc]) => new ToolboxData(path, enc).parse({ key })));
  }

  fields(fileids: string | string[], options: { strip?: boolean; unwrap?: boolean; encoding?: string | null; errors?: string; unicode_fields?: string[] | null } = {}): unknown {
    const { strip = true, unwrap = true, encoding = "utf8", errors = "strict", unicode_fields = null } = options;
    void errors;
    return concat((this.abspaths(fileids, true) as Array<[PathPointer, string | null]>)
      .map(([fileid, enc]) => [...new ToolboxData(fileid, enc)
        .fields({ strip, unwrap, encoding, unicode_fields })]));
  }

  entries(fileids: string | string[], options: Record<string, unknown> = {}): Array<[string, Array<[string, string]>]> {
    const kwargs = { ...options };
    const key = ("key" in kwargs ? kwargs["key"] : "lx") as string;
    delete kwargs["key"];
    const fields = this.fields(fileids, kwargs) as Array<[string, string]>;
    const entries: Array<[string, Array<[string, string]>]> = [];
    for (const [marker, contents] of fields) {
      if (marker === key) entries.push([contents, []]);
      else if (entries.length > 0) entries[entries.length - 1]![1].push([marker, contents]);
    }
    return entries;
  }

  words(fileids: string | string[], key = "lx"): string[] {
    const fields = this.fields(fileids) as Array<[string, string]>;
    return fields.filter(([marker]) => marker === key).map(([, contents]) => contents);
  }
}

// { ycoe

export class YCOEParseCorpusReader extends BracketParseCorpusReader {
  // NLTK returns None for documents that are empty after CODE/ID stripping;
  // parsed_sents() then yields null elements.
  protected override _parse(t: string): SimpleTree {
    const stripped = t.replace(/\((CODE|ID)[^)]*\)/g, "");
    if (/^\s*\(\s*\)\s*$/.test(stripped)) return null as unknown as SimpleTree;
    return super._parse(stripped);
  }
}

export class YCOETaggedCorpusReader extends TaggedCorpusReader {
  constructor(root: string | PathPointer, items: string | string[], encoding: EncodingSpec = "utf8") {
    const gapsRe = /(?<=\/\.)\s+|\s*\S*_CODE\s*|\s*\S*_ID\s*/g;
    super(root, items, "_", new WhitespaceTokenizer(),
      { tokenize: (s: string) => s.split(gapsRe).filter((x) => x !== "") },
      read_blankline_block, encoding);
  }
}

export class YCOECorpusReader extends CorpusReader {
  private _psd_reader: YCOEParseCorpusReader;
  private _pos_reader: YCOETaggedCorpusReader;
  private _documents: string[];

  constructor(root: string | PathPointer, encoding: EncodingSpec = "utf8") {
    const rootPtr = typeof root === "string" ? new FileSystemPathPointer(root) : root;
    const psdReader = new YCOEParseCorpusReader(rootPtr.join("psd"), ".*", ".psd", "unindented_paren", encoding);
    const posReader = new YCOETaggedCorpusReader(rootPtr.join("pos"), ".*");
    const documents = new Set(psdReader.fileids().map((f) => f.slice(0, -4)));
    const posDocs = new Set(posReader.fileids().map((f) => f.slice(0, -4)));
    if (posDocs.size !== documents.size || ![...posDocs].every((d) => documents.has(d))) {
      throw pyError("ValueError", 'Items in "psd" and "pos" subdirectories do not match.');
    }
    const fileids = [...documents].map((d) => `${d}.psd`).concat([...documents].map((d) => `${d}.pos`)).sort();
    super(rootPtr, fileids, encoding);
    this._psd_reader = psdReader;
    this._pos_reader = posReader;
    this._documents = [...documents].sort();
  }

  documents(fileids?: string | string[] | null): string[] {
    if (fileids === undefined || fileids === null) return this._documents;
    const ids = typeof fileids === "string" ? [fileids] : fileids;
    for (const f of ids) {
      if (!this._fileids.includes(f)) throw pyError("KeyError", `File id ${JSON.stringify(ids)} not found`);
    }
    return [...new Set(ids.map((f) => f.slice(0, -4)))].sort();
  }

  override fileids(documents?: string | string[] | null): string[] {
    if (documents === undefined || documents === null) return this._fileids;
    const docs = typeof documents === "string" ? [documents] : documents;
    return [...new Set(docs.map((d) => `${d}.pos`).concat(docs.map((d) => `${d}.psd`)))].sort();
  }

  private _getfileids(documents: string | string[] | null | undefined, subcorpus: string): string[] {
    let docs: string[];
    if (documents === undefined || documents === null) docs = this._documents;
    else {
      docs = typeof documents === "string" ? [documents] : documents;
      for (const document of docs) {
        if (!this._documents.includes(document)) {
          if (document.endsWith(".pos") || document.endsWith(".psd")) {
            throw pyError("ValueError", "Expected a document identifier, not a file identifier.  (Use corpus.documents() to get a list of document identifiers.");
          }
          throw pyError("ValueError", `Document identifier ${document} not found`);
        }
      }
    }
    return docs.map((d) => `${d}.${subcorpus}`);
  }

  words(documents?: string | string[] | null): unknown {
    return this._pos_reader.words(this._getfileids(documents, "pos"));
  }
  sents(documents?: string | string[] | null): unknown {
    return this._pos_reader.sents(this._getfileids(documents, "pos"));
  }
  paras(documents?: string | string[] | null): unknown {
    return this._pos_reader.paras(this._getfileids(documents, "pos"));
  }
  tagged_words(documents?: string | string[] | null): unknown {
    return this._pos_reader.tagged_words(this._getfileids(documents, "pos"));
  }
  tagged_sents(documents?: string | string[] | null): unknown {
    return this._pos_reader.tagged_sents(this._getfileids(documents, "pos"));
  }
  tagged_paras(documents?: string | string[] | null): unknown {
    return this._pos_reader.tagged_paras(this._getfileids(documents, "pos"));
  }
  taggedParas(documents?: string | string[] | null): unknown { return this.tagged_paras(documents); }
  parsed_sents(documents?: string | string[] | null): unknown {
    return this._psd_reader.parsed_sents(this._getfileids(documents, "psd"));
  }
  parsedSents(documents?: string | string[] | null): unknown { return this.parsed_sents(documents); }
}

// { switchboard

export class SwitchboardTurn extends Array<unknown> {
  speaker: string;
  id: number;
  constructor(words: unknown[], speaker: string, id: string | number) {
    super(...words);
    this.speaker = speaker;
    this.id = typeof id === "number" ? id : parseInt(id, 10);
  }
  repr(): string {
    let text: string;
    if (this.length === 0) text = "";
    else if (Array.isArray(this[0])) {
      text = this.map((w) => `${(w as [string, string])[0]}/${(w as [string, string])[1]}`).join(" ");
    } else {
      text = this.join(" ");
    }
    return `<${this.speaker}.${this.id}: ${pyRepr(text)}>`;
  }
  override toString(): string { return this.repr(); }
}

export class SwitchboardCorpusReader extends CorpusReader {
  static _FILES = ["tagged"];
  private static _UTTERANCE_RE = /^(\w+)\.(\d+):\s*(.*)/;
  private static _SEP = "/";

  constructor(root: string | PathPointer, tagset: string | null = null) {
    super(root, SwitchboardCorpusReader._FILES);
    this._tagset = tagset;
  }

  private _parseUtterance(utterance: string, includeTag: boolean, tagset: string | null = null): SwitchboardTurn {
    const m = SwitchboardCorpusReader._UTTERANCE_RE.exec(utterance);
    if (m === null) throw pyError("ValueError", `Bad utterance ${pyRepr(utterance)}`);
    const [, speaker, id, text] = m;
    let words: unknown[] = text!.split(/\s+/).filter((x) => x !== "").map((s) => str2tuple(s, SwitchboardCorpusReader._SEP));
    if (!includeTag) words = (words as Array<[string, string | null]>).map(([w]) => w);
    else if (tagset && tagset !== this._tagset) {
      words = (words as Array<[string, string | null]>).map(([w, t]) => [w, t === null ? t : mapTag(this._tagset!, tagset, t)]);
    }
    return new SwitchboardTurn(words, speaker!, id!);
  }

  private _discoursesBlockReader(stream: SeekableUnicodeStreamReader, tagged: boolean, tagset: string | null): unknown[] {
    return [
      read_blankline_block(stream)
        .flatMap((b) => b.split("\n"))
        .filter((u) => u.trim())
        .map((u) => this._parseUtterance(u, tagged, tagset)),
    ];
  }

  words(): unknown {
    return new StreamBackedCorpusView(this.abspath("tagged"),
      (s) => ((this._discoursesBlockReader(s, false, null)[0]) as SwitchboardTurn[]).flat() as unknown[], 0);
  }
  tagged_words(tagset: string | null = null): unknown {
    return new StreamBackedCorpusView(this.abspath("tagged"),
      (s) => ((this._discoursesBlockReader(s, true, tagset)[0]) as SwitchboardTurn[]).flat() as unknown[], 0);
  }
  taggedWords(tagset: string | null = null): unknown { return this.tagged_words(tagset); }
  turns(): unknown {
    return new StreamBackedCorpusView(this.abspath("tagged"),
      (s) => this._discoursesBlockReader(s, false, null)[0] as unknown[], 0);
  }
  tagged_turns(tagset: string | null = null): unknown {
    return new StreamBackedCorpusView(this.abspath("tagged"),
      (s) => this._discoursesBlockReader(s, true, tagset)[0] as unknown[], 0);
  }
  taggedTurns(tagset: string | null = null): unknown { return this.tagged_turns(tagset); }
  discourses(): unknown {
    return new StreamBackedCorpusView(this.abspath("tagged"),
      (s) => this._discoursesBlockReader(s, false, null), 0);
  }
  tagged_discourses(tagset: string | null = null): unknown {
    return new StreamBackedCorpusView(this.abspath("tagged"),
      (s) => this._discoursesBlockReader(s, true, tagset), 0);
  }
  taggedDiscourses(tagset: string | null = null): unknown { return this.tagged_discourses(tagset); }
}

// { alpino

const ALPINO_NODE = /^[ \t]*<node ([^>\n]*?)(\/?)>/gm;
const ALPINO_ATTR = /(\w+)="([^"]*)"/g;
const ALPINO_DIGITS = /^\d+$/;
const ALPINO_WORD = /^\w+$/;
const SORTTAGWRD = /\((\d+) ([^\s()]+) ([^\s()]+)\)/g;

function alpinoNodeToSexpr(body: string, selfclose: string, wholeMatch: string, ordered: boolean): string {
  const attrs: Record<string, string> = {};
  ALPINO_ATTR.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ALPINO_ATTR.exec(body)) !== null) attrs[m[1]!] = m[2]!;
  if (selfclose) {
    const pos = attrs["pos"], word = attrs["word"];
    if (!word || !pos || !ALPINO_WORD.test(pos)) return wholeMatch;
    if (ordered) {
      const begin = attrs["begin"];
      if (!begin || !ALPINO_DIGITS.test(begin)) return wholeMatch;
      return `(${begin} ${pos} ${word})`;
    }
    return `(${pos} ${word})`;
  }
  const cat = attrs["cat"];
  if (!cat || !ALPINO_WORD.test(cat)) return wholeMatch;
  return `(${cat}`;
}

export class AlpinoCorpusReader extends BracketParseCorpusReader {
  constructor(root: string | PathPointer, encoding: EncodingSpec = "ISO-8859-1", tagset: string | null = null) {
    super(root, "alpino\\.xml", null, "blankline", encoding, tagset);
  }

  protected override _normalize(t: string, ordered = false): string {
    if (t.slice(0, 10) !== "<alpino_ds") return "";
    let out = t.replace(ALPINO_NODE, (whole, body: string, selfclose: string) => alpinoNodeToSexpr(body, selfclose, whole, ordered));
    out = out.replace(/  <\/node>/g, ")");
    out = out.replace(/<sentence>.*<\/sentence>/g, "");
    out = out.replace(/<\/?alpino_ds.*>/g, "");
    return out;
  }

  protected override _tag(t: string, tagset: string | null = null): Array<[string, string | null]> {
    const normalized = this._normalize(t, true);
    const tagged: Array<[number, string, string]> = [];
    SORTTAGWRD.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = SORTTAGWRD.exec(normalized)) !== null) {
      tagged.push([parseInt(m[1]!, 10), m[3]!, m[2]!]);
    }
    tagged.sort((a, b) => a[0] - b[0]);
    if (tagset && tagset !== this._tagset) {
      return tagged.map(([, w, p]) => [w, mapTag(this._tagset!, tagset, p)]);
    }
    return tagged.map(([, w, p]) => [w, p]);
  }

  protected override _word(t: string): string[] {
    return this._tag(t).map(([w]) => w);
  }
}

// { shared textwrap.fill used by ConllSRLInstance.pprint

function textwrapFill(s: string, options: { width?: number; initialIndent?: string; subsequentIndent?: string } = {}): string {
  const width = options.width ?? 70;
  const initial = options.initialIndent ?? "";
  const subsequent = options.subsequentIndent ?? "";
  const words = s.split(/\s+/).filter((w) => w.length > 0);
  const lines: string[] = [];
  let cur = initial;
  let first = true;
  for (const w of words) {
    const sep = cur === initial || cur === subsequent ? "" : " ";
    if ((cur + sep + w).length > width && cur !== (first ? initial : subsequent)) {
      lines.push(cur);
      cur = subsequent + w;
      first = false;
    } else {
      cur = cur + sep + w;
    }
  }
  lines.push(cur);
  return lines.join("\n");
}
