// corpus-reader differential vs pinned NLTK 3.10.3 oracle.
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  PlaintextCorpusReader, TaggedCorpusReader, DependencyCorpusReader,
  WordListCorpusReader, CMUDictCorpusReader, AlignedCorpusReader,
} from "../src/corpus_text_readers";
import { BracketParseCorpusReader, CategorizedSentencesCorpusReader, ChunkedCorpusReader } from "../src/corpus_readers2";
import { CorpusReader as NLTKCorpusReader } from "../src/corpus_api";
import { WhitespaceTokenizer } from "../src/tokenizers";
import { RegexpTokenizer } from "../src/tokenizers_regexp";
import { SeekableUnicodeStreamReader } from "../src/corpus_stream";
import { find, dataPath, FileSystemPathPointer } from "../src/data";
import { read_alignedsent_block, read_whitespace_block, tagged_treebank_para_block_reader, ConcatenatedCorpusView, StreamBackedCorpusView } from "../src/corpus_view";

const NLTK_DATA = process.env.NLTK_DATA ?? join(process.cwd(), ".cache/nltk-data");
const ROOT = join(NLTK_DATA, "tmp-synth-corpus");

function setup(): string {
  mkdirSync(ROOT, { recursive: true });
  if (!dataPath.includes(ROOT)) dataPath.push(ROOT);
  writeFileSync(join(ROOT, "plain.txt"), "the quick brown fox .\njumps over the dog .\n\nsecond para here .\n");
  writeFileSync(join(ROOT, "tagged.txt"), "the/AT quick/JJ fox/NN\njumps/VBZ\n");
  writeFileSync(join(ROOT, "dep.tsv"), "The\tdet\t2\tDET\nfox\tnsubj\t0\tROOT\n\nRuns\tverb\t0\tROOT\n");
  writeFileSync(join(ROOT, "words.txt"), "apple\nbanana\n# comment\ncherry\n");
  writeFileSync(join(ROOT, "cmudict"), "AARDVARK  AA1 R D V AA2 R K\nABACK  AH0 B AE1 K\n");
  writeFileSync(join(ROOT, "trees.mrg"), "(S (NP (DT the) (JJ little) (NN dog)) (VP (VBD barked)))\n(S (NP (NNP Fido)) (VP (VBZ barks)))\n");
  writeFileSync(join(ROOT, "chunks.txt"), "[the/DT dog/NN] chased/VBD [the/DT cat/NN]\n");
  writeFileSync(join(ROOT, "aligned.txt"), "hello world ||| hola mundo ||| 0-0 1-1 2-2\n");
  writeFileSync(join(ROOT, "treebank_para.txt"), "one/NN two/JJ\n\n==============================\nmore/NN stuff/VB here/RB\n");
  writeFileSync(join(ROOT, "pol.neg"), "bad movie , really dull .\n\nworst film ever .\n");
  writeFileSync(join(ROOT, "pol.pos"), "great movie , truly fun .\nwonderful acting here .\n");
  return ROOT;
}

function oracle(root: string): Record<string, any> {
  const res = spawnSync("python3", ["test/corpus_readers_oracle.py", root], { encoding: "utf-8" });
  if (res.status !== 0) throw new Error(`oracle failed: ${res.stderr}`);
  return JSON.parse(res.stdout.trim().split("\n").pop()!);
}

describe("corpus readers vs NLTK 3.10.3 oracle", () => {
  const root = setup();
  const o = oracle(root);
  const hasData = root !== null && o !== null;

  test("SeekableUnicodeStreamReader char offsets", () => {
    if (!hasData) return;
    const s = new SeekableUnicodeStreamReader(new Uint8Array(new TextEncoder().encode("the quick brown fox .\njumps over the dog .\n\nsecond para here .\n")), "utf-8");
    expect(s.tell()).toBe(o!.susr.tell0);
    expect(s.read(5)).toBe(o!.susr.read5);
    expect(s.tell()).toBe(o!.susr.tell5);
    s.seek(0);
    expect(s.readline()).toBe(o!.susr.readline);
    s.seek(0);
    expect(s.read()).toBe(o!.susr.readall);
  });

  test("PlaintextCorpusReader words/sents/paras/raw", () => {
    if (!hasData) return;
    const p = new PlaintextCorpusReader(root!, "plain\\.txt", new WhitespaceTokenizer(), new RegexpTokenizer("\n", { gaps: true }) as any);
    expect([...p.words() as Iterable<string>]).toEqual(o!.plain.words);
    expect([...p.sents() as Iterable<string[]>]).toEqual(o!.plain.sents);
    expect([...p.paras() as Iterable<string[][]>]).toEqual(o!.plain.paras);
    expect(p.raw("plain.txt")).toBe(o!.plain.raw);
    expect(p.fileids()).toEqual(o!.plain.fileids);
  });

  test("TaggedCorpusReader words/tagged/sents", () => {
    if (!hasData) return;
    const t = new TaggedCorpusReader(root!, "tagged\\.txt");
    expect([...t.words() as Iterable<string>]).toEqual(o!.tagged.words);
    expect([...t.tagged_words() as Iterable<[string,string]>]).toEqual(o!.tagged.tagged_words);
    expect([...t.sents() as Iterable<string[]>]).toEqual(o!.tagged.sents);
    expect([...t.tagged_sents() as Iterable<[string,string][]>]).toEqual(o!.tagged.tagged_sents);
  });

  test("DependencyCorpusReader words/sents/parsed", () => {
    if (!hasData) return;
    const d = new DependencyCorpusReader(root!, "dep\\.tsv");
    expect([...d.words() as Iterable<string>]).toEqual(o!.dep.words);
    expect([...d.tagged_words() as Iterable<[string,string]>]).toEqual(o!.dep.tagged_words);
    expect([...d.sents() as Iterable<string[]>]).toEqual(o!.dep.sents);
    expect([...d.tagged_sents() as Iterable<[string,string][]>]).toEqual(o!.dep.tagged_sents);
    const dg = [...(d.parsed_sents() as Iterable<any>)];
    expect(dg.map((g) => String(g.root?.address ?? g.root?.["address"]))).toEqual(o!.dep.parsed_root);
  });

  test("WordListCorpusReader", () => {
    if (!hasData) return;
    const w = new WordListCorpusReader(root!, "words\\.txt");
    expect(w.words()).toEqual(o!.wordlist.words);
  });

  test("CMUDictCorpusReader entries", () => {
    if (!hasData) return;
    const c = new CMUDictCorpusReader(root!, "cmudict");
    const entries = [...(c.entries() as Iterable<[string, string[]]>)];
    expect(entries.slice(0, 3).map(([w2, ph]) => [w2, ph])).toEqual(o!.cmudict.entries_head);
  });

  test("BracketParseCorpusReader parsed_sents", () => {
    if (!hasData) return;
    const b = new BracketParseCorpusReader(root!, "trees\\.mrg");
    const trees = [...(b.parsed_sents() as Iterable<any>)];
    expect(trees.length).toBe(2);
    expect((trees[0] as any).label ?? (trees[0] as any).label()).toBe("S");
    expect([...b.words() as Iterable<string>]).toEqual(o!.bracket.words);
    expect([...b.tagged_sents() as Iterable<any>]).toEqual(o!.bracket.tagged_sents);
  });

  test("ChunkedCorpusReader chunked_sents", () => {
    if (!hasData) return;
    const ch = new ChunkedCorpusReader(root!, "chunks\\.txt");
    const trees = [...(ch.chunked_sents() as Iterable<any>)];
    expect(trees.length).toBe(1);
    const t = trees[0] as any;
    expect((t.label ?? t.label())).toBe("S");
    expect(t.children.length).toBe(3); // NP, chased leaf, NP
  });

  test("read_alignedsent_block IndexError quirk pinned", () => {
    if (!hasData) return;
    const al = new AlignedCorpusReader(root!, "aligned\\.txt", "|||", new WhitespaceTokenizer(),
      { tokenize: (s: string) => s.split(" ||| ") }, read_alignedsent_block);
    try {
      const _sents = [...(al.aligned_sents() as Iterable<unknown>)];
      expect(o!.aligned.err).toBeNull();
    } catch (e: any) {
      expect(e.name).toBe("IndexError");
      expect(o!.aligned.err).toContain("IndexError");
    }
  });

  test("ConcatenatedCorpusView joins views across files", () => {
    if (!hasData) return;
    const v1 = new StreamBackedCorpusView<string>(join(root!, "plain.txt"), read_whitespace_block, 0, "utf-8");
    const v2 = new StreamBackedCorpusView<string>(join(root!, "tagged.txt"), read_whitespace_block, 0, "utf-8");
    const ccv = new ConcatenatedCorpusView([v1, v2]);
    expect(ccv.length).toBe(o!.concat.len);
    expect([...ccv.iterate_from(0)]).toEqual(o!.concat.all);
    expect(ccv.get(3)).toBe(o!.concat.get3);
    expect(ccv.get(-1)).toBe(o!.concat.getneg);
    expect([...ccv.iterate_from(2)].slice(0, 3)).toEqual(o!.concat.slice);
  });

  test("tagged_treebank_para_block_reader splits on ===== rules", () => {
    if (!hasData) return;
    const stream = new FileSystemPathPointer(join(root!, "treebank_para.txt")).open("utf-8");
    const blocks: string[][] = [];
    for (;;) {
      const block = tagged_treebank_para_block_reader(stream);
      if (!block.length) break;
      blocks.push(block);
    }
    expect(blocks).toEqual(o!.ttb_blocks);
  });

  test("CategorizedSentencesCorpusReader categories/sents/words + blank-line quirk", () => {
    if (!hasData) return;
    const cs = new CategorizedSentencesCorpusReader(root!, "pol\\.(neg|pos)", null, null,
      "utf8", { cat_pattern: "pol\\.(neg|pos)" });
    expect(cs.categories()).toEqual(o!.catsents.categories);
    expect([...cs.sents() as Iterable<string[]>]).toEqual(o!.catsents.sents);
    expect([...cs.sents(undefined, "neg") as Iterable<string[]>]).toEqual(o!.catsents.sents_neg);
    expect([...cs.words(undefined, "pos") as Iterable<string>]).toEqual(o!.catsents.words_pos);
    expect(cs.fileids("pos")).toEqual(o!.catsents.fileids_pos);
  });

  test("pathsec ENFORCE blocks out-of-root corpus", () => {
    expect(() => new NLTKCorpusReader("/tmp/definitely-not-allowed", ".*")).toThrow(/Security Violation/);
    expect(o!.pathsec.err).toBe("PermissionError");
  });

  test("data.find LookupError for missing resource", () => {
    try {
      find("corpora/definitely-missing-xyz");
      expect.unreachable();
    } catch (e: any) {
      expect(e.name).toBe("LookupError");
    }
  });
});
