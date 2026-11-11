// corpus readers vs pinned NLTK 3.10.3 oracle on provisioned nltk_data corpora.
// Requires NLTK_DATA with brown/movie_reviews/stopwords/treebank/words packages.
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import {
  CategorizedPlaintextCorpusReader, CategorizedTaggedCorpusReader,
  PlaintextCorpusReader, WordListCorpusReader,
} from "../src/corpus_text_readers";
import { BracketParseCorpusReader, CategorizedBracketParseCorpusReader, ChunkedCorpusReader } from "../src/corpus_readers2";
import { CorpusReader, LazyCorpusLoader } from "../src/corpus_api";
import { tagged_treebank_para_block_reader } from "../src/corpus_view";
import { RegexpTokenizer } from "../src/tokenizers_regexp";
import { find, dataPath } from "../src/data";

const NLTK_DATA = process.env.NLTK_DATA ?? join(process.cwd(), ".cache/nltk-data");
if (!dataPath.includes(NLTK_DATA)) dataPath.push(NLTK_DATA);

/** PathPointer root (bypasses pathsec string check; stays inside nltk_data). */
const root = (rel: string) => find(`corpora/${rel}`);

function oracle(): Record<string, any> | null {
  const res = spawnSync("python3", ["test/corpus_data_oracle.py", NLTK_DATA], { encoding: "utf-8" });
  if (res.status !== 0) return null;
  return JSON.parse(res.stdout.trim().split("\n").pop()!);
}

const o = oracle();
const hasData = o !== null;

describe("corpus readers vs NLTK 3.10.3 on provisioned data", () => {
  test("brown: CategorizedTaggedCorpusReader", () => {
    if (!hasData) return;
    const b = o!.brown;
    const brown = new CategorizedTaggedCorpusReader(
      root("brown"), "c[a-z]\\d\\d", "/",
      undefined, undefined, undefined, "ascii", "brown",
      { cat_file: "cats.txt" });
    expect(brown.fileids().length).toBe(b.n_fileids);
    expect(brown.fileids().slice(0, 6)).toEqual(b.fileids_head);
    expect(brown.categories()).toEqual(b.categories);
    expect(brown.fileids("news").length).toBe(b.news_n);
    expect(brown.fileids("news").slice(0, 5)).toEqual(b.news_head);
    expect(brown.categories("ca01")).toEqual(b.cats_of_ca01);
    expect([...brown.words("ca01") as Iterable<string>].slice(0, 40)).toEqual(b.words_head);
    expect([...brown.sents("ca01") as Iterable<string[]>].slice(0, 3)).toEqual(b.sents_head);
    expect([...brown.tagged_words("ca01") as Iterable<[string,string]>].slice(0, 40)).toEqual(b.tagged_words_head);
    expect([...brown.tagged_sents("ca01") as Iterable<[string,string][]>].slice(0, 2)).toEqual(b.tagged_sents_head);
    expect(brown.raw("ca01").slice(0, 200)).toBe(b.raw_head);
    expect(brown.encoding("ca01")).toBe(b.encoding);
  });

  test("movie_reviews: CategorizedPlaintextCorpusReader", () => {
    if (!hasData) return;
    const m = o!.movie_reviews;
    const fid = "pos/cv000_29590.txt";
    const mr = new CategorizedPlaintextCorpusReader(
      root("movie_reviews"), "(?!\\.).*\\.txt",
      undefined, undefined, undefined, "ascii",
      { cat_pattern: "(neg|pos)/.*" });
    expect(mr.categories()).toEqual(m.categories);
    expect(mr.fileids().length).toBe(m.n_fileids);
    expect(mr.fileids("pos").length).toBe(m.pos_n);
    expect(mr.fileids("neg").length).toBe(m.neg_n);
    expect(mr.fileids("pos").slice(0, 3)).toEqual(m.pos_head);
    expect(mr.categories(fid)).toEqual(m.cats_of_fid);
    expect([...mr.words(fid) as Iterable<string>].slice(0, 40)).toEqual(m.words_head);
    expect([...mr.sents(fid) as Iterable<string[]>].slice(0, 3)).toEqual(m.sents_head);
    expect([...mr.paras(fid) as Iterable<string[][]>].slice(0, 2)).toEqual(m.paras_head);
    expect(mr.raw(fid).slice(0, 200)).toBe(m.raw_head);
    expect(mr.readme().length).toBe(m.readme_len);
  });

  test("stopwords + words: WordListCorpusReader", () => {
    if (!hasData) return;
    const sw = new WordListCorpusReader(root("stopwords"), "(?!README|\\.).*", "utf8");
    expect(sw.fileids()).toEqual(o!.stopwords.fileids);
    expect(sw.words("english")).toEqual(o!.stopwords.english);
    expect(sw.words("french").slice(0, 15)).toEqual(o!.stopwords.french_head);
    const wl = new WordListCorpusReader(root("words"), "(?!README|\\.).*", "ascii");
    expect(wl.fileids()).toEqual(o!.words.fileids);
    expect(wl.words("en").slice(0, 30)).toEqual(o!.words.en_head);
    expect(wl.words("en-basic")).toEqual(o!.words.en_basic);
  });

  test("treebank/combined: BracketParseCorpusReader", () => {
    if (!hasData) return;
    const t = o!.treebank;
    const tb = new BracketParseCorpusReader(root("treebank/combined"), "wsj_.*\\.mrg",
      null, "unindented_paren", "ascii", "wsj");
    expect(tb.fileids().length).toBe(t.n_fileids);
    expect(tb.fileids().slice(0, 4)).toEqual(t.fileids_head);
    const parsed = [...tb.parsed_sents("wsj_0003.mrg") as Iterable<any>].slice(0, 2);
    expect(parsed.map((tr) => tr.pformat())).toEqual(t.parsed);
    expect([...tb.words("wsj_0003.mrg") as Iterable<string>].slice(0, 30)).toEqual(t.words_head);
    expect([...tb.sents("wsj_0003.mrg") as Iterable<string[]>].slice(0, 2)).toEqual(t.sents_head);
    expect([...tb.tagged_sents("wsj_0003.mrg") as Iterable<[string,string][]>].slice(0, 2)).toEqual(t.tagged_sents_head);
  });

  test("treebank/combined: CategorizedBracketParseCorpusReader", () => {
    if (!hasData) return;
    const c = o!.cat_bracket;
    const cbp = new CategorizedBracketParseCorpusReader(root("treebank/combined"), "wsj_.*\\.mrg",
      "ascii", "wsj", { cat_pattern: "wsj_(00..).*" });
    expect(cbp.categories().slice(0, 10)).toEqual(c.categories_head);
    expect([...cbp.tagged_sents(undefined, "0003") as Iterable<[string,string][]>].slice(0, 1)).toEqual(c.tagged_sents_cat);
    expect([...cbp.parsed_sents(undefined, "0003") as Iterable<any>].slice(0, 1).map((tr) => tr.pformat())).toEqual(c.parsed_sents_cat);
  });

  test("treebank/tagged: ChunkedCorpusReader", () => {
    if (!hasData) return;
    const c = o!.treebank_chunk;
    // NLTK uses RegexpTokenizer(r"(?<=/\.)\s*(?![^\[]*\])", gaps=True); our
    // RegexpTokenizer port rejects lookaround, so replicate the gap semantics:
    // split the whitespace token stream after a token ending in "/." unless a
    // "]" follows before the next "[" (i.e. inside an open chunk).
    const treebankSentSplit = (s: string): string[] => {
      const toks = s.match(/\S+/g) ?? [];
      const sents: string[] = [];
      let cur: string[] = [];
      for (let i = 0; i < toks.length; i++) {
        cur.push(toks[i]!);
        if (toks[i]!.endsWith("/.")) {
          const rest = toks.slice(i + 1);
          const insideChunk = rest.indexOf("]") !== -1 && (rest.indexOf("[") === -1 || rest.indexOf("]") < rest.indexOf("["));
          if (!insideChunk && rest.length) { sents.push(cur.join(" ")); cur = []; }
        }
      }
      if (cur.length) sents.push(cur.join(" "));
      return sents;
    };
    const tbc = new ChunkedCorpusReader(root("treebank/tagged"), "wsj_.*\\.pos",
      "",
      undefined,
      { tokenize: treebankSentSplit },
      tagged_treebank_para_block_reader,
      "ascii", "wsj");
    expect(tbc.fileids().length).toBe(c.n_fileids);
    const chunked = [...tbc.chunked_sents("wsj_0001.pos") as Iterable<any>].slice(0, 3);
    expect(chunked.map((tr) => tr.pformat())).toEqual(c.chunked_sents_head);
    expect([...tbc.sents("wsj_0001.pos") as Iterable<string[]>].slice(0, 2)).toEqual(c.sents_head);
    expect([...tbc.tagged_sents("wsj_0001.pos") as Iterable<[string,string][]>].slice(0, 2)).toEqual(c.tagged_sents_head);
    expect([...tbc.words("wsj_0001.pos") as Iterable<string>].slice(0, 30)).toEqual(c.words_head);
  });

  test("treebank/raw: PlaintextCorpusReader", () => {
    if (!hasData) return;
    const r = o!.treebank_raw;
    const tbr = new PlaintextCorpusReader(root("treebank/raw"), "wsj_.*",
      undefined,
      { tokenize: (s: string) => new RegexpTokenizer("\\n", { gaps: true }).tokenize(s) as string[] },
      undefined, "ISO-8859-2");
    expect(tbr.fileids().length).toBe(r.n_fileids);
    expect(tbr.fileids().slice(0, 4)).toEqual(r.fileids_head);
    expect([...tbr.words("wsj_0001") as Iterable<string>].slice(0, 30)).toEqual(r.words_head);
    expect([...tbr.sents("wsj_0001") as Iterable<string[]>].slice(0, 3)).toEqual(r.sents_head);
  });

  test("LazyCorpusLoader materializes via nltk.data.find", () => {
    if (!hasData) return;
    const lazy = new LazyCorpusLoader("stopwords", WordListCorpusReader as any, ["(?!README|\\.).*"], { encoding: "utf8" });
    expect(lazy.repr()).toBe(o!.lazy.repr);
    expect([...lazy.words("english") as Iterable<string>].slice(0, 10)).toEqual(o!.lazy.english_head);
    expect((lazy.fileids() as string[]).length).toBe(o!.lazy.n_fileids);
  });

  test("CorpusReader API surface: abspath/encoding/raw/open", () => {
    if (!hasData) return;
    const a = o!.api;
    const fid = "pos/cv000_29590.txt";
    const api = new CorpusReader(root("movie_reviews"), "(?!\\.).*\\.txt", "ascii");
    expect(api.fileids().length).toBe(a.n_fileids);
    expect(String(api.abspath(fid)).endsWith("corpora/" + a.abspath_tail)).toBe(true);
    expect(api.encoding(fid)).toBe(a.encoding);
    expect(api.raw(fid).length).toBe(a.raw_len);
    expect(api.open(fid).read(60)).toBe(a.open_head);
    expect(() => api.open("/etc/passwd")).toThrow(/relative/);
    expect(a.abs_err).toContain("ValueError");
  });
});
