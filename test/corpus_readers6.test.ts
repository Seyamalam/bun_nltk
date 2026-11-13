// corpus-reader batch-F differential vs pinned NLTK 3.10.3 oracle.
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import {
  TimitCorpusReader, read_timit_block,
  PanLexLiteCorpusReader, PanlexSwadeshCorpusReader,
  Pl196xCorpusReader, BCP47CorpusReader, CrubadanCorpusReader,
  MarkdownCorpusReader, CategorizedMarkdownCorpusReader,
  AttrDict, Future, PrettyDict, PrettyList, SpecialList,
  PrettyLazyConcatenation, PrettyLazyIteratorList, PrettyLazyMap,
  norm, safe_parse, xpath, _annotation_ascii as annotationAsciiLocal,
} from "../src/corpus_readers6";
import { dataPath, FileSystemPathPointer } from "../src/data";
import { SeekableUnicodeStreamReader } from "../src/corpus_stream";

const NLTK_DATA = process.env.NLTK_DATA ?? join(process.cwd(), ".cache/nltk-data");
const ROOT = join(NLTK_DATA, "tmp-synth-corpus6");

// ---------------------------------------------------------------- fixtures

const SPKRINFO = `; speaker info comment line
VMH0 F 1 TRN 03/19/86 12/31/56 5'08" WHT BS Moved to NJ
ABC0 M 2 TRN 01/01/90 06/15/60 6'00" BLK MS
`;

const TIMITDIC = `; timit dictionary
she /sh ix/
had /hv ae dcl d/
`;

const SA1_TXT = "0 7817 She had your dark suit in greasy wash water all year.\n";
const SA1_WRD = `0 7817 h#
7817 10608 She
10608 12320 had
12320 13140 your
13140 14480 dark
14480 15942 suit
15942 16979 in
16979 18240 greasy
18240 20261 wash
20261 21451 water
21451 24485 all
24485 26060 year
26060 26960 h#
`;
const SA1_PHN = `0 7817 h#
7817 9714 sh
9714 10608 ix
10608 11697 hv
11697 12320 ae
12320 12571 dcl
12571 13140 d
13140 13578 ix
13578 14480 jh
14480 14947 axr
14947 15571 dcl
15571 15942 d
15942 16646 aa
16646 16979 r
16979 17400 kcl
17400 18240 s
18240 18700 ux
18700 19120 tcl
19120 20261 t
20261 20640 ix
20640 21451 n
21451 22000 gcl
22000 22900 g
22900 23400 r
23400 23800 ix
23800 24100 z
24100 24485 ix
24485 25000 w
25000 25400 aa
25400 25800 sh
25800 26100 w
26100 26400 aa
26400 26700 dx
26700 27200 axr
27200 27800 ao
27800 28200 l
28200 28700 jh
28700 29200 axr
29200 29600 h#
`;
const SA2_TXT = "0 5120 Don't ask me to carry an oily rag like that.\n";
const SA2_WRD = `0 5120 h#
5120 6020 Don't
6020 7100 ask
7100 8200 me
8200 9000 to
9000 10000 carry
10000 11000 an
11000 12000 oily
12000 13000 rag
13000 14000 like
14000 15200 that
15200 16000 h#
`;
const SA2_PHN = `0 5120 h#
5120 5600 dcl
5600 6020 ow
6020 6500 n
6500 7100 ae
7100 7600 s
7600 8200 kcl
8200 8600 m
8600 9000 ix
9000 9400 tcl
9400 9600 ax
9600 10000 kcl
10000 10400 eh
10400 11000 r
11000 11500 ix
11500 12000 aa
12000 12500 n
12500 13000 ao
13000 13600 r
13600 14000 ae
14000 14600 l
14600 15200 ay
15200 16000 h#
`;
const SI1_TXT = "0 4679 She had just suceeded in borrowing a cookbook.\n";
const SI1_WRD = `0 4679 h#
4679 5400 She
5400 6000 had
6000 6800 just
6800 7600 suceeded
7600 8400 in
8400 9200 borrowing
9200 10000 a
10000 11000 cookbook
11000 12000 h#
`;
const SI1_PHN = `0 4679 h#
4679 5000 sh
5000 5400 ix
5400 5700 hv
5700 6000 ae
6000 6400 jh
6400 6800 ah
6800 7200 s
7200 7600 ix
7600 8000 n
8000 8400 b
8400 8800 aa
8800 9200 r
9200 9600 ax
9600 10000 kcl
10000 10400 k
10400 10800 uh
10800 11200 k
11200 12000 h#
`;

function wavBytes(samples: number[]): Uint8Array {
  // 44-byte canonical PCM WAV header (mono, 16-bit, 16kHz) + data
  const dataLen = samples.length * 2;
  const b = new Uint8Array(44 + dataLen);
  const dv = new DataView(b.buffer);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); };
  str(0, "RIFF"); dv.setUint32(4, 36 + dataLen, true); str(8, "WAVEfmt ");
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, 16000, true); dv.setUint32(28, 32000, true);
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  str(36, "data"); dv.setUint32(40, dataLen, true);
  for (let i = 0; i < samples.length; i++) dv.setInt16(44 + i * 2, samples[i]!, true);
  return b;
}

function setupPanlex(dbPath: string): void {
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS lv (uid TEXT, lv INTEGER, lc TEXT, tt TEXT);
    CREATE TABLE IF NOT EXISTS ex (ex INTEGER, lv INTEGER, tt TEXT);
    CREATE TABLE IF NOT EXISTS dnx (dnx INTEGER, mn INTEGER, ex INTEGER, uq INTEGER, ap INTEGER, ui INTEGER);
    DELETE FROM lv; DELETE FROM ex; DELETE FROM dnx;
    INSERT INTO lv VALUES ('eng0000', 1, 'eng', 'English');
    INSERT INTO lv VALUES ('spa0000', 2, 'spa', 'Spanish');
    INSERT INTO lv VALUES ('fra0000', 3, 'fra', 'French');
    INSERT INTO ex VALUES (1, 1, 'hello');
    INSERT INTO ex VALUES (2, 2, 'hola');
    INSERT INTO ex VALUES (3, 3, 'bonjour');
    INSERT INTO ex VALUES (4, 1, 'world');
    INSERT INTO ex VALUES (5, 2, 'mundo');
    INSERT INTO dnx VALUES (1, 1, 1, 5, 10, 100);
    INSERT INTO dnx VALUES (2, 1, 2, 7, 10, 100);
    INSERT INTO dnx VALUES (3, 1, 3, 3, 20, 200);
    INSERT INTO dnx VALUES (4, 2, 4, 9, 10, 100);
    INSERT INTO dnx VALUES (5, 2, 5, 4, 10, 100);
  `);
  db.close();
}

const LANGS110 = `eng0000\teng\tL\tLatn\tEnglish\teng0000
spa0000\tspa\tL\tLatn\tSpanish\tspa0000
fra0000\tfra\tL\tLatn\tFrench\tfra0000
`;
const SW_ENG = `I\tC0001
you\tC0002
we\tC0003
`;
const SW_SPA = `yo\tC0001
tu\tC0002
nosotros\tC0003
`;
const SW_FRA = `je\tC0001
tu\tC0002
nous\tC0003
`;

const PL_HEADER = "<!--" + "H".repeat(2762) + "-->\n"; // exactly 2770 bytes
const PL_TEXT1 = `<corpus><text id="t1"><p><s><w ana="N">cat</w><c type="pun">.</c></s><s><w ana="V">sat</w></s></p><p><s><w ana="J">black</w><w ana="N">dog</w></s></p></text><text id="t2"><p><s><w ana="N">sun</w></s></p></text></corpus>`;
const PL_TEXT2 = `<corpus><text id="t9"><p><s><w ana="N">fish</w></s></p></text></corpus>`;
const PL_TEXTIDS = "a/text1.xml t1 t2\nb/text2.xml t9\n";

const BCP47_REGISTRY = `File-Date: 2024-05-16
%%
Type: language
Subtag: en
Description: English
%%
Type: language
Subtag: ca
Description: Catalan
%%
Type: language
Subtag: oc
Description: Occitan (post 1500)
%%
Type: language
Subtag: es
Description: Spanish
%%
Type: script
Subtag: Latn
Description: Latin
%%
Type: region
Subtag: ES
Description: Spain
%%
Type: variant
Subtag: valencia
Description: Valencian
%%
Type: variant
Subtag: gascon
Description: Gascon
%%
Type: language
Subtag: art
Description: Artificial languages
Subtag: lojban
Description: Lojban
Deprecated: 2008-04-01
Preferred-Value: jbo
%%
Type: grandfathered
Tag: i-ami
Description: Amis
%%
Type: redundant
Tag: zh-cmn
Description: Mandarin Chinese
`;

const BCP47_SUBDIV = `<?xml version="1.0" encoding="UTF-8"?>
<ldml>
  <localeDisplayNames>
    <subdivisions>
      <subdivision type="fr64">Pyrénées-Atlantiques</subdivision>
      <subdivision type="esvc">Valencia</subdivision>
    </subdivisions>
  </localeDisplayNames>
</ldml>
`;

const BCP47_WIKI = `# entity code table
https://www.wikidata.org/entity/Q79388\ten-GI-spanglis
https://www.wikidata.org/entity/Q33239\toc-gascon
`;

const CRU_TABLE = `por\tpor\tPortuguese
eng\teng\tEnglish
`;
const CRU_POR = `300 o
200 de
100 que
50 os
`;
const CRU_ENG = `400 the
200 ing
100 and
`;

const DOC1 = `---
title: First document
tags: [tech, news]
---

# Introduction

This is the first doc with a [link](https://example.com "Example") and an ![logo](logo.png "Logo").

- alpha
- beta

> quoted text here

\`\`\`python
print("hello")
\`\`\`

# Details

Some *emphasized* and \`inline\` text.
`;

const DOC2 = `---
title: Second document
tags: [news]
---

# Overview

Second document paragraph with <b>bold html</b>.

1. first
2. second
`;

function setup(): string {
  mkdirSync(join(ROOT, "timit", "dr1-fvmh0"), { recursive: true });
  mkdirSync(join(ROOT, "timit", "dr2-mabc0"), { recursive: true });
  mkdirSync(join(ROOT, "panlex_lite"), { recursive: true });
  mkdirSync(join(ROOT, "swadesh110"), { recursive: true });
  mkdirSync(join(ROOT, "a"), { recursive: true });
  mkdirSync(join(ROOT, "b"), { recursive: true });
  mkdirSync(join(ROOT, "iana"), { recursive: true });
  mkdirSync(join(ROOT, "cldr"), { recursive: true });
  if (!dataPath.includes(ROOT)) dataPath.push(ROOT);

  const t = (f: string, c: string) => writeFileSync(join(ROOT, "timit", f), c);
  t("spkrinfo.txt", SPKRINFO);
  t("timitdic.txt", TIMITDIC);
  t("dr1-fvmh0/sa1.txt", SA1_TXT);
  t("dr1-fvmh0/sa1.wrd", SA1_WRD);
  t("dr1-fvmh0/sa1.phn", SA1_PHN);
  t("dr1-fvmh0/sa2.txt", SA2_TXT);
  t("dr1-fvmh0/sa2.wrd", SA2_WRD);
  t("dr1-fvmh0/sa2.phn", SA2_PHN);
  t("dr2-mabc0/si1.txt", SI1_TXT);
  t("dr2-mabc0/si1.wrd", SI1_WRD);
  t("dr2-mabc0/si1.phn", SI1_PHN);
  writeFileSync(
    join(ROOT, "timit", "dr2-mabc0", "si1.wav"),
    wavBytes(Array.from({ length: 32 }, (_, i) => i * 100 - 1600)),
  );

  setupPanlex(join(ROOT, "panlex_lite", "db.sqlite"));

  writeFileSync(join(ROOT, "langs110.txt"), LANGS110);
  writeFileSync(join(ROOT, "swadesh110", "eng0000.txt"), SW_ENG);
  writeFileSync(join(ROOT, "swadesh110", "spa0000.txt"), SW_SPA);
  writeFileSync(join(ROOT, "swadesh110", "fra0000.txt"), SW_FRA);

  writeFileSync(join(ROOT, "a", "text1.xml"), PL_HEADER + PL_TEXT1);
  writeFileSync(join(ROOT, "b", "text2.xml"), PL_HEADER + PL_TEXT2);
  writeFileSync(join(ROOT, "textids.txt"), PL_TEXTIDS);

  writeFileSync(join(ROOT, "iana", "language-subtag-registry.txt"), BCP47_REGISTRY);
  writeFileSync(join(ROOT, "cldr", "common-subdivisions-en.xml"), BCP47_SUBDIV);
  writeFileSync(join(ROOT, "cldr", "tools-cldr-rdf-external-entityToCode.tsv"), BCP47_WIKI);

  writeFileSync(join(ROOT, "table.txt"), CRU_TABLE);
  writeFileSync(join(ROOT, "por-3grams.txt"), CRU_POR);
  writeFileSync(join(ROOT, "eng-3grams.txt"), CRU_ENG);

  writeFileSync(join(ROOT, "doc1.md"), DOC1);
  writeFileSync(join(ROOT, "doc2.md"), DOC2);
  return ROOT;
}

function oracle(root: string): Record<string, any> {
  const res = spawnSync("python3", ["test/corpus_readers6_oracle.py", root], { encoding: "utf-8" });
  if (res.status !== 0) throw new Error(`oracle failed: ${res.stderr}`);
  return JSON.parse(res.stdout.trim().split("\n").pop()!);
}

function iter<T>(x: unknown): T[] { return [...(x as Iterable<T>)]; }
function name(e: unknown): string { return (e as Error).name; }

// ---------------------------------------------------------------- tests

describe("corpus readers batch F vs NLTK 3.10.3 oracle", () => {
  const root = setup();
  const o = oracle(root);

  test("TimitCorpusReader", () => {
    const t = new TimitCorpusReader(new FileSystemPathPointer(join(root, "timit")));
    expect(t.speakers).toEqual(o.timit.speakers);
    expect(t.fileids()).toEqual(o.timit.fileids);
    expect(t.fileids("txt")).toEqual(o.timit.fileids_txt);
    expect(t.fileids("metadata")).toEqual(o.timit.fileids_metadata);
    expect(() => t.fileids("zzz")).toThrowError(expect.objectContaining({ name: "ValueError" }));
    expect(t.utteranceids()).toEqual(o.timit.utteranceids);
    expect(t.utteranceids("1")).toEqual(o.timit.utteranceids_dialect);
    expect(t.utteranceids(null, "f")).toEqual(o.timit.utteranceids_sex);
    expect(t.utteranceids(null, null, "dr1-fvmh0")).toEqual(o.timit.utteranceids_spkrid);
    if (o.timit.utteranceids_sentid_bug.err !== null) {
      expect(o.timit.utteranceids_sentid_bug.err).toContain("TypeError");
      expect(() => t.utteranceids(null, null, null, null, "sa1")).toThrowError(expect.objectContaining({ name: "TypeError" }));
    } else {
      expect(t.utteranceids(null, null, null, null, "sa1")).toEqual(o.timit.utteranceids_sentid_bug.val);
    }
    expect(t.utteranceids(null, null, "sa1", null, "x")).toEqual(o.timit.utteranceids_sentid_spkr);
    expect(t.spkrid("dr1-fvmh0/sa1")).toBe(o.timit.spkrid);
    expect(t.sentid("dr1-fvmh0/sa1")).toBe(o.timit.sentid);
    expect(t.utterance("dr1-fvmh0", "sa1")).toBe(o.timit.utterance);
    expect(t.spkrutteranceids("dr1-fvmh0")).toEqual(o.timit.spkrutteranceids);
    const sp = t.spkrinfo("dr1-fvmh0");
    expect({
      id: sp.id, sex: sp.sex, dr: sp.dr, use: sp.use, recdate: sp.recdate,
      birthdate: sp.birthdate, ht: sp.ht, race: sp.race, edu: sp.edu,
      comments: sp.comments, repr: sp.repr(),
    }).toEqual(o.timit.spkrinfo);
    const sp2 = t.spkrinfo("dr1-fvmh0/sa1");
    expect({ id: sp2.id, repr: sp2.repr() }).toEqual({ id: o.timit.spkrinfo_by_utt.id, repr: o.timit.spkrinfo_by_utt.repr });
    expect(() => t.spkrinfo("dr9-xx99")).toThrowError(expect.objectContaining({ name: "KeyError" }));
    expect(t.transcription_dict()).toEqual(o.timit.transcription_dict);
    expect(t.phones()).toEqual(o.timit.phones);
    expect(t.phones("dr1-fvmh0/sa2")).toEqual(o.timit.phones_one);
    expect(t.phone_times()).toEqual(o.timit.phone_times);
    expect(t.words()).toEqual(o.timit.words);
    expect(t.word_times()).toEqual(o.timit.word_times);
    expect(t.sents()).toEqual(o.timit.sents);
    expect(t.sent_times()).toEqual(o.timit.sent_times);
    expect(t.phone_trees().map((tr) => tr.pformat())).toEqual(o.timit.phone_trees);
    expect(t.audiodata("dr2-mabc0/si1").length).toBe(o.timit.audiodata_len);
    expect([...t.audiodata("dr2-mabc0/si1", 4, 10)]).toEqual(o.timit.audiodata_slice);
    expect([...t.wav("dr2-mabc0/si1").subarray(0, 48)]).toEqual(o.timit.wav_prefix);
    expect(t.wav("dr2-mabc0/si1").length).toBe(o.timit.wav_len);
    expect(read_timit_block(SeekableUnicodeStreamReader.fromString("12 The cat sat.\n"))).toEqual(o.timit.read_timit_block);
    expect(read_timit_block(SeekableUnicodeStreamReader.fromString(""))).toEqual(o.timit.read_timit_block_eof);
    // NLTK quirk: a *string* root constructs fine (find_corpus_fileids wraps
    // it) but _root stays a str, so any open() blows up. Python raises
    // AttributeError on str.join; JS raises TypeError — same contract.
    const strRootReader = new TimitCorpusReader(join(root, "timit"));
    expect(strRootReader.fileids()).toEqual(o.timit.fileids);
    expect(() => strRootReader.words()).toThrowError();
  });

  test("PanLexLiteCorpusReader", () => {
    const pl = new PanLexLiteCorpusReader(join(root, "panlex_lite"));
    expect(pl.language_varieties()).toEqual(o.panlex_lite.language_varieties);
    expect(pl.language_varieties("spa")).toEqual(o.panlex_lite.language_varieties_lc);
    const meanings = pl.meanings("eng0000", "hello").map((m) => ({
      id: m.id(), quality: m.quality(), source: m.source(),
      source_group: m.source_group(), expressions: m.expressions(), dict: m.toObject(),
    }));
    expect(meanings).toEqual(o.panlex_lite.meanings_hello);
    expect(o.panlex_lite.meanings_missing_uid.err).toContain("KeyError");
    expect(() => pl.meanings("zzz9999", "hello")).toThrowError(expect.objectContaining({ name: "KeyError" }));
    expect(pl.meanings("eng0000", "nonsense").map((m) => m.id())).toEqual(
      o.panlex_lite.meanings_missing_expr.map((m: any) => m.id));
    expect(pl.translations("eng0000", "hello", "spa0000")).toEqual(o.panlex_lite.translations);
    expect(pl.translations("spa0000", "hola", "eng0000")).toEqual(o.panlex_lite.translations_back);
    expect(pl.translations("eng0000", "nonsense", "spa0000")).toEqual(o.panlex_lite.translations_missing);
    expect(o.panlex_lite.fileids_attr_err.err).toContain("AttributeError");
    expect(() => pl.fileids()).toThrowError(expect.objectContaining({ name: "AttributeError" }));
  });

  test("PanlexSwadeshCorpusReader", () => {
    const sw = new PanlexSwadeshCorpusReader(
      root, ["swadesh110/eng0000.txt", "swadesh110/spa0000.txt", "swadesh110/fra0000.txt"]);
    expect(sw.swadesh_size).toBe(o.swadesh.swadesh_size);
    expect(sw.language_codes()).toEqual(o.swadesh.language_codes);
    expect([...sw.get_languages()].map((x) => x.repr())).toEqual(o.swadesh.languages);
    const macro: Record<string, string[]> = {};
    for (const [k, v] of [...sw.get_macrolanguages().entries()].sort()) macro[k] = v;
    expect(macro).toEqual(o.swadesh.macrolanguages);
    expect(sw.words_by_lang("eng0000")).toEqual(o.swadesh.words_by_lang);
    expect(sw.words_by_iso639("eng")).toEqual(o.swadesh.words_by_iso639);
    // defaultdict: unknown ISO code yields an empty list, not KeyError.
    expect(o.swadesh.words_by_iso639_missing.err).toBe(null);
    expect(sw.words_by_iso639("zzz")).toEqual(o.swadesh.words_by_iso639_missing.val);
    expect(sw.entries()).toEqual(o.swadesh.entries);
    expect(sw.entries(["swadesh110/eng0000.txt"])).toEqual(o.swadesh.entries_one);
    expect(sw.entries([])).toEqual(o.swadesh.entries_empty);
  });

  test("Pl196xCorpusReader", () => {
    const px = new Pl196xCorpusReader(
      root, "[ab]/text\\d\\.xml", { cat_pattern: "([ab])/.*", textid_file: join(root, "textids.txt") });
    expect(px.categories()).toEqual(o.pl196x.categories);
    expect(px.fileids()).toEqual(o.pl196x.fileids);
    expect(px.textids("a/text1.xml", "a")).toEqual(o.pl196x.textids_both);
    if (o.pl196x.textids_err.err !== null) {
      expect(() => px.textids()).toThrowError(expect.objectContaining({ name: "ValueError" }));
    } else {
      expect(px.textids()).toEqual(o.pl196x.textids_err.val);
    }
    expect(() => [...iter(px.words())]).toThrowError(expect.objectContaining({ name: "ValueError" }));
    expect(() => [...iter(px.words("a/text1.xml"))]).toThrowError(expect.objectContaining({ name: "ValueError" }));
    expect([...iter(px.words("a/text1.xml", "a"))]).toEqual(o.pl196x.words);
    expect([...iter<string[]>(px.sents("a/text1.xml", "a"))].map((s) => [...s])).toEqual(o.pl196x.sents);
    expect([...iter<any>(px.paras("a/text1.xml", "a"))]).toEqual(o.pl196x.paras);
    expect([...iter(px.tagged_words("a/text1.xml", "a"))]).toEqual(o.pl196x.tagged_words);
    expect([...iter<any>(px.tagged_sents("a/text1.xml", "a"))]).toEqual(o.pl196x.tagged_sents);
    expect([...iter<any>(px.tagged_paras("a/text1.xml", "a"))]).toEqual(o.pl196x.tagged_paras);
    expect([...iter(px.words("b/text2.xml", "b"))]).toEqual(o.pl196x.words_cat);
    // NLTK quirk: _resolve requires exactly *two* non-None args, so the
    // textids branch is dead code — words(textids=..) raises ValueError,
    // while categories+textids silently ignores textids.
    expect(o.pl196x.words_by_textids_err.err).toContain("ValueError");
    expect(() => [...iter(px.words(null, null, "t2"))]).toThrowError(expect.objectContaining({ name: "ValueError" }));
    expect([...iter(px.words(null, "a", "t2"))]).toEqual(o.pl196x.words_cat_textids_err.val);
    expect(() => [...iter(px.words("a/text1.xml", "a", "t1"))]).toThrowError(expect.objectContaining({ name: "ValueError" }));
    expect(px.xml(["a/text1.xml"], "a").tag).toBe(o.pl196x.xml_list);
    // NLTK quirk: len("a/text1.xml") is 11, not 1 — a bare string never
    // qualifies as a single file.
    expect(() => px.xml("a/text1.xml", "a")).toThrowError(expect.objectContaining({ name: "TypeError" }));
  });

  test("BCP47CorpusReader", () => {
    const b = new BCP47CorpusReader(root,
      ["iana/language-subtag-registry.txt",
       "cldr/common-subdivisions-en.xml",
       "cldr/tools-cldr-rdf-external-entityToCode.tsv"]);
    expect(b.version).toBe(o.bcp47.version);
    expect(b.parse_tag("ca-Latn-ES-valencia")).toEqual(o.bcp47.parse_tag);
    const checks: Array<[string, any]> = [
      ["ca-Latn-ES-valencia", o.bcp47.name_latn_es],
      ["oc-gascon-u-sd-fr64", o.bcp47.name_gascon],
      ["i-ami", o.bcp47.name_grandfathered],
      ["art-lojban", o.bcp47.name_deprecated],
      ["zzz", o.bcp47.name_unknown],
      ["oc-u-sd-zz99", o.bcp47.name_unknown_subdiv],
      ["en-abcdef-xyz", o.bcp47.name_invalid_ext],
    ];
    for (const [tag, pinned] of checks) {
      const res = (() => { try { return { err: null, val: b.name(tag) }; } catch (e) { return { err: name(e), val: null }; } })();
      if (pinned.err !== null) {
        expect(res.err, tag).toBe(pinned.err.split(":")[0]);
      } else {
        expect(res.val, tag).toBe(pinned.val);
      }
    }
    expect(b.langcode).toEqual(o.bcp47.langcode);
    expect(b.subdiv["fr64"]).toBe(o.bcp47.subdiv_fr64);
    expect(b.val2str(["a", "b"])).toBe(o.bcp47.val2str_list);
    expect(b.val2str("solo")).toBe(o.bcp47.val2str_str);
    expect(b.lang2str({ language: "Catalan", script: "Latin", region: "Spain", variant: "Valencian" }))
      .toBe(o.bcp47.lang2str);
    b.load_wiki_q();
    expect(b.wiki_q["en-GI-spanglis"]).toBe(o.bcp47.wiki_q);
    const sortedWiki = Object.fromEntries(Object.entries(b.wiki_q).sort());
    expect(sortedWiki).toEqual(o.bcp47.wiki_q_full);
  });

  test("CrubadanCorpusReader", () => {
    const cr = new CrubadanCorpusReader(root, ["table.txt", "por-3grams.txt", "eng-3grams.txt"]);
    expect(cr.langs()).toEqual(o.crubadan.langs);
    expect(cr.iso_to_crubadan("por")).toBe(o.crubadan.iso_to_crubadan);
    expect(cr.iso_to_crubadan("POR")).toBe(o.crubadan.iso_to_crubadan_case);
    expect(cr.iso_to_crubadan("zzz")).toBe(o.crubadan.iso_to_crubadan_missing);
    expect(cr.crubadan_to_iso("por")).toBe(o.crubadan.crubadan_to_iso);
    expect(cr.crubadan_to_iso("zzz")).toBe(o.crubadan.crubadan_to_iso_missing);
    const por = cr.lang_freq("por");
    expect(Object.fromEntries(por.mostCommon())).toEqual(o.crubadan.lang_freq_por);
    expect(Object.fromEntries(cr.lang_freq("eng").mostCommon())).toEqual(o.crubadan.lang_freq_eng);
    expect(() => cr.lang_freq("zzz")).toThrowError(expect.objectContaining({ name: "RuntimeError" }));
    expect(cr.lang_freq("por") === por).toBe(o.crubadan.lang_freq_shared);
  });

  test("MarkdownCorpusReader + CategorizedMarkdownCorpusReader", () => {
    const md = new MarkdownCorpusReader(root, ["doc1.md", "doc2.md"]);
    expect([...iter<any>(md.paras())]).toEqual(o.markdown.paras);
    expect([...iter(md.words())]).toEqual(o.markdown.words);

    const cmd = new CategorizedMarkdownCorpusReader(root, ["doc1.md", "doc2.md"]);
    expect(cmd.categories()).toEqual(o.categorized_markdown.categories);
    expect(cmd.fileids()).toEqual(o.categorized_markdown.fileids);
    expect(cmd.fileids("tech")).toEqual(o.categorized_markdown.fileids_tech);
    expect([...iter<any>(cmd.metadata())]).toEqual(o.categorized_markdown.metadata);
    const projBlock = (x: any) => ({
      repr: x.repr(), str: x.toString(), raw: x.raw,
      words: x.words, sents: x.sents, paras: x.paras,
    });
    expect([...iter<any>(cmd.blockquotes())].map(projBlock)).toEqual(o.categorized_markdown.blockquotes);
    expect([...iter<any>(cmd.code_blocks())].map((x) => ({ ...projBlock(x), language: x.language, lines: x.lines })))
      .toEqual(o.categorized_markdown.code_blocks);
    expect([...iter<any>(cmd.images())].map((x) => [...x])).toEqual(o.categorized_markdown.images);
    expect([...iter<any>(cmd.links())].map((x) => [...x])).toEqual(o.categorized_markdown.links);
    expect([...iter<any>(cmd.lists())].map((x) => [x.is_ordered, x.items])).toEqual(o.categorized_markdown.lists);
    expect([...iter<any>(cmd.sections())].map((x) => ({ ...projBlock(x), heading: x.heading, level: x.level })))
      .toEqual(o.categorized_markdown.sections);
    expect([...iter<any>(cmd.paras())]).toEqual(o.categorized_markdown.paras);
    expect([...iter<any>(cmd.paras(null, "tech"))]).toEqual(o.categorized_markdown.paras_tech);
    expect(cmd.raw("doc1.md")).toBe(o.categorized_markdown.raw_doc1);
    expect([...iter(cmd.words(null, ["news"]))]).toEqual(o.categorized_markdown.words_news);
  });

  test("framenet containers", () => {
    const c = o.containers;
    const d = new AttrDict({ a: 1, b: "x", c: null });
    expect({ repr: d.repr(), keys: d.keys(), len: d.size }).toEqual(c.attrdict_plain);
    expect((d as any).b).toBe(c.attrdict_attr);
    expect(() => (d as any).zzz).toThrowError(expect.objectContaining({ name: "KeyError" }));
    expect(new AttrDict({ _type: "frame", ID: 7, name: "F" })._short_repr()).toBe(c.attrdict_short_repr_typed);
    expect(new AttrDict({ _type: "lusubcorpus", name: "S" })._short_repr()).toBe(c.attrdict_short_repr_noid);
    expect(new AttrDict({ _type: "framerelationtype", ID: 1, superFrameName: "A", name: "Inheritance", subFrameName: "B" })._short_repr())
      .toBe(c.attrdict_short_repr_relation);
    expect(new AttrDict({ _type: "odd", ID: 3, name: "N", note: "short" }).repr()).toBe(c.attrdict_any);
    expect(new Future(() => new AttrDict({ x: 1 })).repr()).toBe(c.future_repr.val ?? c.future_repr);
    expect(new SpecialList("bogus").repr()).toBe(c.speciallist_empty);
    expect(() => new SpecialList("bogus", [1]).repr()).toThrowError(expect.objectContaining({ name: "AssertionError" }));
    expect(new PrettyList(Array.from({ length: 5 }, (_, i) => new AttrDict({ _type: "frame", ID: i, name: `f${i}` }))).repr())
      .toBe(c.prettylist);
    expect(new PrettyList().repr()).toBe(c.prettylist_empty);
    expect(new PrettyDict({ k1: new AttrDict({ _type: "frame", ID: 1, name: "a" }), k2: new AttrDict({ _type: "fe", ID: 2, name: "b" }) }).repr())
      .toBe(c.prettydict);
    // Oracle used snake-case break_lines — NOT the breakLines kwarg — so it
    // lands as a regular dict entry, just like Python's dict(**kwargs).
    expect(new PrettyDict({ k1: new AttrDict({ _type: "frame", ID: 1, name: "a" }), break_lines: true }).repr())
      .toBe(c.prettydict_break.val ?? c.prettydict_break);
    expect(new PrettyLazyMap((x: unknown) => new AttrDict({ _type: "frame", ID: x, name: `f${x}` }), [1, 2, 3]).repr())
      .toBe(c.prettylazymap);
    expect(new PrettyLazyMap((x: unknown) => new AttrDict({ _type: "frame", ID: x, name: `framename${x}` }), [0, 1, 2, 3, 4, 5, 6, 7]).repr())
      .toBe(c.prettylazymap_long);
    expect(new PrettyLazyIteratorList(Array.from({ length: 6 }, (_, i) => new AttrDict({ _type: "frame", ID: i, name: `f${i}` }))).repr())
      .toBe(c.prettylazyiterlist);
    expect(new PrettyLazyConcatenation([
      [new AttrDict({ _type: "frame", ID: 1, name: "a" })],
      [new AttrDict({ _type: "frame", ID: 2, name: "b" })],
    ]).repr()).toBe(c.prettylazyconcat);
    expect(new PrettyLazyConcatenation([[new AttrDict({ _type: "frame", ID: 1, name: "a" })]])
      .add([new AttrDict({ _type: "frame", ID: 2, name: "b" })]).repr()).toBe(c.prettylazyconcat_add.val ?? c.prettylazyconcat_add);
  });

  test("framenet _pretty_* reprs", () => {
    const c = o.containers;
    const frameRef = new AttrDict({ _type: "frame", ID: 9, name: "Desiring" });
    const luRef = new AttrDict({ _type: "lu", ID: 55, name: "want.v", frame: frameRef });
    const sent = new AttrDict({
      _type: "lusentence", ID: 100, corpID: 1, docID: 2, paragNo: 0, sentNo: 3, aPos: 4,
      LU: luRef, frame: frameRef,
      annotationSet: [new AttrDict({ x: 1 })],
      POS: [[0, 5, "NN"], [6, 9, "VBP"]],
      POS_tagset: "PENN", GF: [], PT: [[0, 9, "NP"]],
      text: "They want cake.", Target: [[5, 9]],
      FE: [[[0, 5, "Experiencer"], [10, 15, "Theme"]], { F: "NI" }],
    });
    sent.set("_ascii", () => annotationAsciiLocal(sent));
    expect(sent.repr()).toBe(c.lusentence_repr.val ?? c.lusentence_repr);

    const posD = new AttrDict({
      _type: "posannotationset", ID: 77, POS_tagset: "PENN",
      sent: new AttrDict({ _type: "lusentence", ID: 100, text: "They want cake." }),
      POS: [[0, 4, "PRP"], [5, 9, "VBP"], [10, 14, "NNP"], [14, 15, "."]],
    });
    expect(posD.repr()).toBe(c.pos_repr.val ?? c.pos_repr);

    const luD = new AttrDict({
      _type: "lu", ID: 55, name: "want.v",
      definition: "A long-ish definition that is definitely longer than sixty-five characters to trigger wrapping.",
      frame: frameRef, POS: "V", status: "Created", totalAnnotated: 3,
      lexemes: [new AttrDict({ name: "want", POS: "V" })],
      semTypes: [new AttrDict({ name: "State", ID: 1 })],
      URL: "http://x/lu55",
      subCorpus: [new AttrDict({ name: "sub-b" }), new AttrDict({ name: "sub-a" })],
      exemplars: [new AttrDict({ text: "s1" })],
    });
    expect(luD.repr()).toBe(c.lu_repr.val ?? c.lu_repr);

    const feD = new AttrDict({
      _type: "fe", ID: 12, name: "Experiencer", frame: frameRef,
      definition: "The being who desires.", abbrev: "Exp", coreType: "Core",
      requiresFE: null, excludesFE: null,
      semType: new AttrDict({ name: "Sentient", ID: 4 }),
    });
    expect(feD.repr()).toBe(c.fe_repr.val ?? c.fe_repr);

    const frt = new AttrDict({ _type: "framerelationtype", ID: 1, superFrameName: "Desiring", name: "Inheritance", subFrameName: "Needing" });
    const frel = new AttrDict({ _type: "framerelation", type: frt, superFrameName: "Desiring", subFrameName: "Needing" });
    const frameD = new AttrDict({
      _type: "frame", ID: 9, name: "Desiring", URL: "http://x/frame9",
      definition: "An Experiencer desires an Event.",
      semTypes: [new AttrDict({ name: "State", ID: 1 })],
      frameRelations: [frel],
      lexUnit: new AttrDict({
        "want.v": new AttrDict({ _type: "lu", ID: 55 }),
        "desire.v": new AttrDict({ _type: "lu", ID: 56 }),
      }),
      FE: new AttrDict({
        Experiencer: new AttrDict({ _type: "fe", ID: 12, coreType: "Core" }),
        Event: new AttrDict({ _type: "fe", ID: 13, coreType: "Peripheral" }),
      }),
      FEcoreSets: [[new AttrDict({ name: "Experiencer" }), new AttrDict({ name: "Event" })]],
    });
    expect(frameD.repr()).toBe(c.frame_repr.val ?? c.frame_repr);

    const semD = new AttrDict({
      _type: "semtype", ID: 1, name: "State", abbrev: "Sta",
      definition: "A state of affairs.",
      rootType: new AttrDict({ name: "Root", ID: 0 }),
      superType: null,
      subTypes: [new AttrDict({ name: "Sub", ID: 2 })],
    });
    expect(semD.repr()).toBe(c.semtype_repr.val ?? c.semtype_repr);
    expect(new AttrDict({ _type: "semtype" }).repr()).toBe(c.semtype_none);
    expect(frt.repr()).toBe(c.frt_repr);
    expect(frel.repr()).toBe(c.frel_repr);
    const ferel = new AttrDict({ _type: "ferelation", type: frt, frameRelation: frel, superFEName: "Experiencer", subFEName: "Event" });
    expect(ferel.repr()).toBe(c.ferel_repr);

    const exemplars = new SpecialList("luexemplars", [
      new AttrDict({ _type: "lusentence", ID: 1, text: "They want cake.", LU: luD, frame: frameRef }),
      new AttrDict({ _type: "lusentence", ID: 2, text: "I desire rest.", LU: luD }),
    ]);
    expect(exemplars.repr()).toBe(c.exemplars_repr.val ?? c.exemplars_repr);
  });

  test("norm + safe_parse + xpath", () => {
    expect(norm("TRUE")).toBe(o.norm.TRUE);
    expect(norm("false")).toBe(o.norm.false);
    expect(norm("Yes")).toBe(o.norm.Yes);
    expect(norm("no")).toBe(o.norm.no);
    expect(() => norm("maybe")).toThrowError(expect.objectContaining({ name: "KeyError" }));

    const elt = safe_parse("<root><a x='1'>hi<b/></a><a x='2'/></root>");
    expect(elt.getroot().tag).toBe(o.xml.safe_parse_root);
    expect(xpath(elt.getroot(), "a").map((e) => e.attrib.get("x"))).toEqual(o.xml.xpath);
    expect(xpath(elt.getroot(), "a").map((e) => e.text)).toEqual(o.xml.xpath_text);
    expect(o.xml.safe_parse_entity.err).not.toBeNull();
    expect(() => safe_parse("<!DOCTYPE r [<!ENTITY x 'y'>]><r>&x;</r>")).toThrowError(/entity/i);
  });
});
