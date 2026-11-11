// corpus-reader batch-A differential vs pinned NLTK 3.10.3 oracle.
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ConllCorpusReader, AlpinoCorpusReader, SinicaTreebankCorpusReader,
  KNBCorpusReader, ChasenCorpusReader, LinThesaurusCorpusReader,
  ToolboxCorpusReader, YCOECorpusReader, SwitchboardCorpusReader,
  sinica_parse,
} from "../src/corpus_readers3";
import { dataPath } from "../src/data";

const NLTK_DATA = process.env.NLTK_DATA ?? join(process.cwd(), ".cache/nltk-data");
const ROOT = join(NLTK_DATA, "tmp-synth-corpus3");

const CONLL3 = `He PRP B-NP
ran VBD B-VP
fast RB I-VP
. . O

-DOCSTART- -X- -X-

She PRP B-NP
sat VBD B-VP
`;

const CONLL_SRL = `The DT (S(NP*      arrive.01 -      (A0*
cat NN *)          arrive.01 -      *)
sat VBD (VP*       arrive.01 sat    (V*)
on  IN  (PP*       arrive.01 -      (A1*
the DT  (NP*       arrive.01 -      *
mat NN  *)))       arrive.01 -      *)
.   .   *)         arrive.01 -      *
`;

const ALPINO = `<alpino_ds>
<sentence>The cat sat</sentence>
<node cat="smain" begin="0" end="3">
  <node cat="np" begin="0" end="2">
    <node pos="det" word="The" begin="0" end="1"/>
    <node pos="n" word="cat" begin="1" end="2"/>
  </node>
  <node pos="v" word="sat" begin="2" end="3"/>
</node>
</alpino_ds>
`;

const SINICA = `#1 S(agent:NP(Head:Nhaa:X)|Head:VV2:Y|theme:NP(Head:Nac:Z))#0(PERIODCATEGORY)\n`;

const KNBC1 = `# S-ID=1 KNB:1
* -1D
+ -1D
hon hon hon meishi 6 futsuu 1 * 0 * 0 NIL
wo wo wo joshi 9 kaku 1 * 0 * 0 NIL
EOS
`;

const KNBC2 = `# S-ID=2 KNB:2
* 1D
hashi hashi hashi meishi 6 futsuu 1 * 0 * 0 NIL
* -1D
ta ta ta jodoshi 4 tokushu 6 * 0 * 0 NIL
EOS
`;

const CHASEN = `hashi\thashi\thashiru\tdoushi\tgodan
ta\tta\tta\tjodoushi\ttokushu
EOS
tsugi\ttsugi\ttsugi\tmeishi\tippan
EOS
`;

const SIM_N = `("business" (desc 1.0) (
"enterprise"\t0.5
"company"\t0.3
))
("enterprise" (desc 2.0) (
"business"\t0.4
))
`;

const SIM_V = `("run" (desc 1.0) (
"jog"\t0.2
))
`;

const TOOLBOX = `\\_sh records
\\lx word1
\\ps n
\\ge gloss1

\\lx word2
\\ps v
\\ge gloss2
`;

const SWITCHBOARD = `A.1: hi/NN there/UH ./.
B.2: hello/UH you/PRP !/.

A.3: next/NN turn/NN
`;

const YCOE_PSD = `( (IP-MAT (NP-SBJ (PRO he)) (VBD saa)) (CODE <P_1>))
( (CODE <P_2>) )
`;

const YCOE_POS = `he_PRO saa_VBD ./.
next_PRO line_N _CODE extra_ID more_J ./.
`;

function setup(): string {
  mkdirSync(ROOT, { recursive: true });
  mkdirSync(join(ROOT, "psd"), { recursive: true });
  mkdirSync(join(ROOT, "pos"), { recursive: true });
  if (!dataPath.includes(ROOT)) dataPath.push(ROOT);
  writeFileSync(join(ROOT, "conll3.txt"), CONLL3);
  writeFileSync(join(ROOT, "conll_srl.txt"), CONLL_SRL);
  writeFileSync(join(ROOT, "alpino.xml"), ALPINO);
  writeFileSync(join(ROOT, "sinica.txt"), SINICA);
  writeFileSync(join(ROOT, "knbc1.txt"), KNBC1);
  writeFileSync(join(ROOT, "knbc2.txt"), KNBC2);
  writeFileSync(join(ROOT, "chasen.txt"), CHASEN);
  writeFileSync(join(ROOT, "simN.lsp"), SIM_N);
  writeFileSync(join(ROOT, "simV.lsp"), SIM_V);
  writeFileSync(join(ROOT, "toolbox.db"), TOOLBOX);
  writeFileSync(join(ROOT, "tagged"), SWITCHBOARD);
  writeFileSync(join(ROOT, "psd", "doc1.psd"), YCOE_PSD);
  writeFileSync(join(ROOT, "pos", "doc1.pos"), YCOE_POS);
  return ROOT;
}

function oracle(root: string): Record<string, any> {
  const res = spawnSync("python3", ["test/corpus_readers3_oracle.py", root], { encoding: "utf-8" });
  if (res.status !== 0) throw new Error(`oracle failed: ${res.stderr}`);
  return JSON.parse(res.stdout.trim().split("\n").pop()!);
}

function treeStrings(xs: Iterable<any>): Array<string | null> {
  return [...xs].map((t) => (t === null ? null : t.pformat()));
}

describe("corpus readers batch A vs NLTK 3.10.3 oracle", () => {
  const root = setup();
  const o = oracle(root);

  test("ConllCorpusReader words/pos/chunk grid", () => {
    const c = new ConllCorpusReader(root, "conll3\\.txt", ["words", "pos", "chunk"]);
    expect([...c.words() as Iterable<string>]).toEqual(o.conll.words);
    expect([...c.sents() as Iterable<string[]>]).toEqual(o.conll.sents);
    expect([...c.tagged_words() as Iterable<[string, string]>]).toEqual(o.conll.tagged_words);
    expect([...c.tagged_sents() as Iterable<[string, string][]>]).toEqual(o.conll.tagged_sents);
    expect([...c.iob_words() as Iterable<string[]>]).toEqual(o.conll.iob_words);
    expect([...c.iob_sents() as Iterable<string[][]>]).toEqual(o.conll.iob_sents);
    const chunked = [...c.chunked_sents() as Iterable<any>].map((t) => t.pformat());
    expect(chunked).toEqual(o.conll.chunked_sents);
    const cw = [...c.chunked_words() as Iterable<any>].map((x) =>
      x.pformat ? x.pformat() : [...x]);
    expect(cw).toEqual(o.conll.chunked_words);
    try {
      void [...c.parsed_sents() as Iterable<unknown>];
      expect(o.conll.bad_column.err).toBeNull();
    } catch (e: any) {
      expect(e.name).toBe("ValueError");
      expect(o.conll.bad_column.err).toContain("ValueError");
    }
  });

  test("ConllCorpusReader words/pos/tree/srl grid + SRL instances", () => {
    const cs = new ConllCorpusReader(root, "conll_srl\\.txt", ["words", "pos", "tree", "srl"]);
    const parsed = [...cs.parsed_sents() as Iterable<any>].map((t) => t.pformat());
    expect(parsed).toEqual(o.conll_srl.parsed_sents);
    const parsedPos = [...cs.parsed_sents(null, true) as Iterable<any>].map((t) => t.pformat());
    expect(parsedPos).toEqual(o.conll_srl.parsed_pos);
    const spans = [...cs.srl_spans() as Iterable<any>].map((grid: any) =>
      grid.map((sl: any) => sl.map((x: any) => [[x[0][0], x[0][1]], x[1]])));
    expect(spans).toEqual(o.conll_srl.srl_spans);
    const insts = [...cs.srl_instances() as Iterable<any>].map((i: any) => ({
      repr: i.repr(), verb: i.verb, verb_head: i.verb_head, verb_stem: i.verb_stem,
      roleset: i.roleset, arguments: i.arguments.map((a: any) => [[a[0][0], a[0][1]], a[1]]),
      pprint: i.pprint(),
    }));
    expect(insts).toEqual(o.conll_srl.srl_instances);
  });

  test("AlpinoCorpusReader words/tagged/parsed", () => {
    const al = new AlpinoCorpusReader(root);
    expect([...al.words() as Iterable<string>]).toEqual(o.alpino.words);
    expect([...al.tagged_words() as Iterable<[string, string]>]).toEqual(o.alpino.tagged_words);
    expect([...al.sents() as Iterable<string[]>]).toEqual(o.alpino.sents);
    expect(treeStrings(al.parsed_sents() as Iterable<any>)).toEqual(o.alpino.parsed_sents);
  });

  test("SinicaTreebankCorpusReader + sinica_parse", () => {
    const st = new SinicaTreebankCorpusReader(root, "sinica\\.txt");
    expect([...st.words() as Iterable<string>]).toEqual(o.sinica.words);
    expect([...st.sents() as Iterable<string[]>]).toEqual(o.sinica.sents);
    expect([...st.tagged_sents() as Iterable<[string, string][]>]).toEqual(o.sinica.tagged_sents);
    expect(treeStrings(st.parsed_sents() as Iterable<any>)).toEqual(o.sinica.parsed_sents);
    expect(sinica_parse("S(agent:NP(Head:Nhaa:X)|Head:VV2:Y|theme:NP(Head:Nac:Z))").pformat())
      .toBe(o.sinica.sinica_parse);
  });

  test("KNBCorpusReader words/tagged + parse AttributeError quirk", () => {
    const kn = new KNBCorpusReader(root, "knbc1\\.txt");
    expect([...kn.words() as Iterable<string>]).toEqual(o.knbc.words);
    expect([...kn.sents() as Iterable<string[]>]).toEqual(o.knbc.sents);
    expect([...kn.tagged_words() as Iterable<[string, string]>]).toEqual(o.knbc.tagged_words);
    expect(treeStrings(kn.parsed_sents() as Iterable<any>)).toEqual(o.knbc.parsed_sents);
    const kn2 = new KNBCorpusReader(root, "knbc2\\.txt");
    if (o.knbc.parsed_err.err !== null) {
      expect(() => [...kn2.parsed_sents() as Iterable<unknown>]).toThrow(/defaultdict|append/);
    } else {
      expect(treeStrings(kn2.parsed_sents() as Iterable<any>)).toEqual(o.knbc.parsed_err.val);
    }
  });

  test("ChasenCorpusReader words/tagged/sents/paras", () => {
    const ch = new ChasenCorpusReader(root, "chasen\\.txt");
    expect([...ch.words() as Iterable<string>]).toEqual(o.chasen.words);
    expect([...ch.tagged_words() as Iterable<[string, string]>]).toEqual(o.chasen.tagged_words);
    expect([...ch.sents() as Iterable<string[]>]).toEqual(o.chasen.sents);
    expect([...ch.tagged_sents() as Iterable<[string, string][]>]).toEqual(o.chasen.tagged_sents);
    expect([...ch.paras() as Iterable<string[][]>]).toEqual(o.chasen.paras);
    expect([...ch.tagged_paras() as Iterable<[string, string][][]>]).toEqual(o.chasen.tagged_paras);
  });

  test("LinThesaurusCorpusReader similarity/synonyms", () => {
    const lin = new LinThesaurusCorpusReader(root);
    expect(lin.fileids()).toEqual(o.lin.fileids);
    expect(lin.similarity("business", "enterprise")).toEqual(o.lin.similarity);
    expect(lin.similarity("business", "business")).toEqual(o.lin.similarity_same);
    expect(lin.similarity("business", "enterprise", "simN.lsp")).toEqual(o.lin.similarity_fid);
    expect(lin.similarity("business", "zzzz", "simN.lsp")).toEqual(o.lin.similarity_missing);
    expect(lin.synonyms("business", "simN.lsp")).toEqual(o.lin.synonyms);
    expect(lin.scored_synonyms("business", "simN.lsp")).toEqual(o.lin.scored_synonyms);
    expect(lin.contains("business")).toBe(o.lin.contains);
    expect(lin.contains("zzzz")).toBe(o.lin.not_contains);
  });

  test("ToolboxCorpusReader words/entries/fields/xml", () => {
    const tb = new ToolboxCorpusReader(root, "toolbox\\.db");
    expect(tb.words("toolbox.db")).toEqual(o.toolbox.words);
    expect(tb.entries("toolbox.db")).toEqual(o.toolbox.entries);
    expect([...tb.fields("toolbox.db") as Iterable<[string, string]>]).toEqual(o.toolbox.fields);
    const xml = tb.xml("toolbox.db") as any;
    expect(xml.find("record/lx")?.text).toBe(o.toolbox.xml);
  });

  test("YCOECorpusReader documents/words/tagged/parsed", () => {
    const y = new YCOECorpusReader(root);
    expect(y.documents()).toEqual(o.ycoe.documents);
    expect(y.fileids()).toEqual(o.ycoe.fileids);
    expect([...y.words() as Iterable<string>]).toEqual(o.ycoe.words);
    expect([...y.tagged_words() as Iterable<[string, string]>]).toEqual(o.ycoe.tagged_words);
    expect([...y.tagged_sents() as Iterable<[string, string][]>]).toEqual(o.ycoe.tagged_sents);
    expect(treeStrings(y.parsed_sents() as Iterable<any>)).toEqual(o.ycoe.parsed_sents);
  });

  test("SwitchboardCorpusReader words/turns/discourses", () => {
    const sb = new SwitchboardCorpusReader(root);
    expect([...sb.words() as Iterable<string>]).toEqual(o.switchboard.words);
    expect([...sb.tagged_words() as Iterable<[string, string]>]).toEqual(o.switchboard.tagged_words);
    const turns = [...sb.turns() as Iterable<any>].map((t: any) => ({
      speaker: t.speaker, id: t.id, words: [...t], repr: t.repr(),
    }));
    expect(turns).toEqual(o.switchboard.turns);
    const tturns = [...sb.tagged_turns() as Iterable<any>].map((t: any) => ({
      speaker: t.speaker, id: t.id, words: [...t].map((x: any) => [...x]),
    }));
    expect(tturns).toEqual(o.switchboard.tagged_turns);
    const discs = [...sb.discourses() as Iterable<any>].map((d: any) =>
      [...d].map((t: any) => ({ speaker: t.speaker, id: t.id, words: [...t] })));
    expect(discs).toEqual(o.switchboard.discourses);
  });
});
