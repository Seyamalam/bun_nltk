// corpus-reader batch-D (XML-backed) differential vs pinned NLTK 3.10.3 oracle.
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import {
  XMLCorpusReader, BNCCorpusReader, BNCWordView, CHILDESCorpusReader,
  VerbnetCorpusReader, MTECorpusReader, MTETagConverter, IPIPANCorpusReader,
  NKJPCorpusReader, NPSChatCorpusReader, FramenetCorpusReader, AttrDict,
  ElementWrapper, framenetProj,
} from "../src/corpus_readers4";
import { dataPath } from "../src/data";

const NLTK_DATA = process.env.NLTK_DATA ?? join(process.cwd(), ".cache/nltk-data");
const ROOT = join(NLTK_DATA, "tmp-synth-corpus4");

function oracle(root: string): Record<string, any> {
  const res = spawnSync("python3", ["test/corpus_readers4_oracle.py", root], { encoding: "utf-8" });
  if (res.status !== 0) throw new Error(`oracle failed: ${res.stderr}`);
  return JSON.parse(res.stdout.trim().split("\n").pop()!);
}

function errName(f: () => unknown): string {
  try {
    f();
    throw new Error("expected exception");
  } catch (e) {
    const err = e as Error;
    if (err.message === "expected exception") throw e;
    return `${err.name}:${err.message.slice(0, 160)}`;
  }
}

function seq(x: unknown): unknown[] {
  return [...(x as Iterable<unknown>)].map((v) => (Array.isArray(v) ? [...v] : v));
}

/** Mirror the oracle's bounded-depth framenet projection. */
function fnproj(v: unknown, depth = 0): unknown {
  if (depth > 2) return "...";
  if (v instanceof AttrDict || (v !== null && typeof v === "object" && !(v instanceof Map) && !Array.isArray(v) && !(v instanceof Date) && !(v instanceof RegExp))) {
    if (v instanceof AttrDict) {
      const out: Record<string, unknown> = {};
      for (const k of v.keys()) out[k] = fnproj((v as Record<string, unknown>)[k], depth + 1);
      return out;
    }
    return v;
  }
  if (Array.isArray(v)) return v.map((x) => fnproj(x, depth + 1));
  return v;
}

function docproj(d: AttrDict): unknown {
  const out: Record<string, unknown> = {};
  for (const k of d.keys()) {
    if (k === "sentence") continue;
    out[k] = ["ID", "name", "filename", "corpname", "corpid"].includes(k) ? fnproj(d[k]) : null;
  }
  out["sents"] = (d["sentence"] as AttrDict[]).map((s) => ({
    ID: s["ID"], text: s["text"], POS: s.get("POS"), POS_tagset: s.get("POS_tagset"),
    targets: (s.get("targets") as unknown[] ?? []).map((t) => fnproj(t)),
    n_asets: (s["annotationSet"] as AttrDict[]).length,
  }));
  return out;
}

function sentproj(s: AttrDict): unknown {
  return {
    ID: s["ID"], text: s["text"], POS: s.get("POS"), POS_tagset: s.get("POS_tagset"),
    targets: (s.get("targets") as unknown[] ?? []).map((t) => fnproj(t)),
    asets: (s["annotationSet"] as AttrDict[]).map((a) => {
      const out: Record<string, unknown> = {};
      for (const k of a.keys()) {
        if (["ID", "status", "luName", "luID", "frameName", "frameID", "Target", "FE"].includes(k)) {
          out[k] = fnproj(a[k]);
        }
      }
      return out;
    }),
  };
}

describe("corpus_readers4 (XML readers) vs NLTK 3.10.3", () => {
  const root = ROOT;
  const o = (() => {
    if (!dataPath.includes(ROOT)) dataPath.push(ROOT);
    return oracle(ROOT);
  })();

  test("XMLCorpusReader words/xml", () => {
    const xr = new XMLCorpusReader(join(root, "bnc"), "BNC1.xml");
    expect(xr.fileids()).toEqual(o.xml.fileids);
    expect(seq(xr.words())).toEqual(o.xml.words);
    expect((xr.xml() as { tag: string }).tag).toBe(o.xml.xml_tag);
  });

  test("BNCCorpusReader words/tagged/sents/header", () => {
    const b = new BNCCorpusReader(join(root, "bnc"), "BNC1.xml");
    expect(b.fileids()).toEqual(o.bnc.fileids);
    expect(seq(b.words())).toEqual(o.bnc.words);
    expect(seq(b.words(null, false))).toEqual(o.bnc.words_strip_f);
    expect(seq(b.words(null, true, true))).toEqual(o.bnc.words_stem);
    expect(seq(b.tagged_words())).toEqual(o.bnc.tagged_words);
    expect(seq(b.tagged_words(null, true))).toEqual(o.bnc.tagged_words_c5);
    const sents = [...(b.sents() as Iterable<any>)];
    expect(sents.map((s) => [...s])).toEqual(o.bnc.sents);
    expect(sents.map((s) => s.num)).toEqual(o.bnc.sents_num);
    expect([...(b.tagged_sents() as Iterable<any>)].map((s) => s.map((x: any) => [...x]))).toEqual(o.bnc.tagged_sents);
    const eager = new BNCCorpusReader(join(root, "bnc"), "BNC1.xml", false);
    expect(seq(eager.words())).toEqual(o.bnc.eager_words);

    const bw = new BNCWordView(join(root, "bnc", "BNC1.xml"), false, false, true, false);
    expect(bw.title).toBe(o.bnc.title);
    expect(bw.author).toBe(o.bnc.author);
    expect(bw.editor).toBe(o.bnc.editor);
    expect(bw.resps).toBe(o.bnc.resps);
  });

  test("CHILDESCorpusReader words/tagging/metadata", () => {
    const c = new CHILDESCorpusReader(join(root, "childes"), "c1.xml");
    expect(c.fileids()).toEqual(o.childes.fileids);
    expect(seq(c.words())).toEqual(o.childes.words);
    expect(seq(c.words(null, "CHI"))).toEqual(o.childes.words_chi);
    expect(seq(c.words(null, "MOT"))).toEqual(o.childes.words_mot);
    expect(seq(c.words(null, "ALL", true))).toEqual(o.childes.words_stem);
    expect(seq(c.tagged_words())).toEqual(o.childes.tagged_words);
    expect(seq(c.sents())).toEqual(o.childes.sents);
    expect(seq(c.sents(null, "CHI"))).toEqual(o.childes.sents_chi);
    expect(seq(c.tagged_sents())).toEqual(o.childes.tagged_sents);
    expect(seq(c.sents(null, "ALL", false, true))).toEqual(o.childes.sents_relation);
    expect(seq(c.corpus())).toEqual(o.childes.corpus);
    expect(seq(c.participants())).toEqual(o.childes.participants);
    expect(seq(c.age())).toEqual(o.childes.age);
    expect(seq(c.age(null, "CHI", true))).toEqual(o.childes.age_month);
    expect(seq(c.MLU())).toEqual(o.childes.mlu);
    expect(errName(() => c.convert_age("bad"))).toBe(o.childes.convert_age);
  });

  test("VerbnetCorpusReader indexes/frames/pprint", () => {
    const vn = new VerbnetCorpusReader(join(root, "verbnet"), ".*\\.xml");
    expect(vn.fileids()).toEqual(o.verbnet.fileids);
    expect(vn.lemmas()).toEqual(o.verbnet.lemmas_all);
    expect(vn.lemmas("hit-18.1")).toEqual(o.verbnet.lemmas_hit);
    expect(vn.lemmas("18.1")).toEqual(o.verbnet.lemmas_short);
    expect(vn.wordnetids("hit-18.1")).toEqual(o.verbnet.wordnetids);
    expect(vn.classids()).toEqual(o.verbnet.classids);
    expect(vn.classids({ lemma: "hit" })).toEqual(o.verbnet.classids_lemma);
    expect(vn.classids({ fileid: "hit-18.1.xml" })).toEqual(o.verbnet.classids_fileid);
    expect(vn.classids({ classid: "hit-18.1" })).toEqual(o.verbnet.classids_classid);
    expect((vn.vnclass("hit-18.1-1") as any).get("ID")).toBe(o.verbnet.vnclass_sub);
    expect(vn.frames("hit-18.1")).toEqual(o.verbnet.frames);
    expect(vn.subclasses("hit-18.1")).toEqual(o.verbnet.subclasses);
    expect(vn.themroles("hit-18.1")).toEqual(o.verbnet.themroles);
    expect(vn.longid("18.1")).toBe(o.verbnet.longid);
    expect(vn.shortid("hit-18.1")).toBe(o.verbnet.shortid);
    expect(vn.pprint("hit-18.1")).toBe(o.verbnet.pprint);
    expect(errName(() => new VerbnetCorpusReader(join(root, "verbnet"), ".*\\.xml", false, "9.9")))
      .toBe(o.verbnet.bad_version);
  });

  test("MTECorpusReader words/sents/lemmas/tagged", () => {
    const m = new MTECorpusReader(join(root, "mte"), "oana-en.xml");
    expect(m.fileids()).toEqual(o.mte.fileids);
    expect(seq(m.words())).toEqual(o.mte.words);
    expect(seq(m.sents())).toEqual(o.mte.sents);
    expect(seq(m.paras())).toEqual(o.mte.paras);
    expect(seq(m.lemma_words())).toEqual(o.mte.lemma_words);
    expect(seq(m.lemma_sents())).toEqual(o.mte.lemma_sents);
    expect(seq(m.lemma_paras())).toEqual(o.mte.lemma_paras);
    expect(seq(m.tagged_words(null, "msd"))).toEqual(o.mte.tagged_words_msd);
    expect(seq(m.tagged_words(null, "universal"))).toEqual(o.mte.tagged_words_uni);
    expect(seq(m.tagged_words(null, "universal", "N"))).toEqual(o.mte.tagged_words_uni_n);
    expect(seq(m.tagged_sents(null, "msd"))).toEqual(o.mte.tagged_sents_msd);
    expect(seq(m.tagged_paras(null, "universal"))).toEqual(o.mte.tagged_paras_uni);
    expect(MTETagConverter.msd_to_universal("Ncmsn")).toBe(o.mte.msd2u_N);
    expect(MTETagConverter.msd_to_universal("Vm-p")).toBe(o.mte.msd2u_V);
    expect(MTETagConverter.msd_to_universal("Zzz")).toBe(o.mte.msd2u_unk);
  });

  test("IPIPANCorpusReader headers + broken view quirk", () => {
    const ip = new IPIPANCorpusReader(join(root, "ipipan"), "d1/morph.xml");
    expect(ip.fileids()).toEqual(o.ipipan.fileids);
    expect(ip.channels()).toEqual(o.ipipan.channels);
    expect(ip.domains()).toEqual(o.ipipan.domains);
    expect(ip.categories()).toEqual(o.ipipan.categories);
    expect(ip.fileids("press")).toEqual(o.ipipan.fileids_channel);
    expect(ip.fileids(null, "economy")).toEqual(o.ipipan.fileids_domain);
    // NLTK 3.10.3 on Python 3 opens a binary stream -> TypeError on any read.
    expect(errName(() => seq(ip.words()))).toBe(o.ipipan.words);
    expect(errName(() => seq(ip.sents()))).toBe(o.ipipan.sents);
    expect(errName(() => seq(ip.paras()))).toBe(o.ipipan.paras);
    expect(errName(() => seq(ip.tagged_words()))).toBe(o.ipipan.tagged_words);
    expect(errName(() => seq(ip.tagged_sents()))).toBe(o.ipipan.tagged_sents);
    expect(errName(() => ip.tagged_words(null, { tags: false, one_tag: false, disamb_only: false })))
      .toBe(o.ipipan.bad_opts);
    expect(errName(() => ip.tagged_words(null, { one_tag: false, disamb_only: false })))
      .toBe(o.ipipan.bad_opts2);
  });

  test("NKJPCorpusReader header + broken preprocessing quirk", () => {
    const nk = new NKJPCorpusReader(join(root, "nkjp"), "d1");
    expect(nk.fileids()).toEqual(o.nkjp.fileids);
    expect(seq(nk.header())).toEqual(o.nkjp.header);
    expect(errName(() => seq(nk.words()))).toBe(o.nkjp.words);
    expect(errName(() => seq(nk.sents()))).toBe(o.nkjp.sents);
    expect(errName(() => seq(nk.raw()))).toBe(o.nkjp.raw);
    expect(errName(() => seq(nk.tagged_words(null, ["subst"])))).toBe(o.nkjp.tagged_words);
  });

  test("NPSChatCorpusReader posts/words/tagged", () => {
    const n = new NPSChatCorpusReader(join(root, "nps"), "chat1.xml");
    expect(n.fileids()).toEqual(o.nps.fileids);
    expect(seq(n.posts())).toEqual(o.nps.posts);
    expect(seq(n.tagged_posts())).toEqual(o.nps.tagged_posts);
    expect(seq(n.words())).toEqual(o.nps.words);
    expect(seq(n.tagged_words())).toEqual(o.nps.tagged_words);
    const posts = [...(n.xml_posts() as Iterable<any>)];
    expect(posts.map((p) => (p instanceof ElementWrapper ? p.tag : p.tag))).toEqual(o.nps.xml_posts_tag);
  });

  test("FramenetCorpusReader frame/LU/relations/docs", () => {
    const fn = new FramenetCorpusReader(join(root, "framenet"), ".*");
    const f = fn.frame(1);
    expect(f["ID"]).toBe(o.framenet.frame_id);
    expect(f["name"]).toBe(o.framenet.frame_name);
    expect(f["_type"]).toBe(o.framenet.frame_type);
    expect(f["definition"]).toBe(o.framenet.frame_def);
    expect(f["URL"]).toBe(o.framenet.frame_url);
    const fes = Object.fromEntries((f["FE"] as AttrDict).entries().map(([k, fe]: [string, any]) => [k, {
      ID: fe["ID"], coreType: fe["coreType"], definition: fe["definition"],
      semType: fe["semType"] ? (fe["semType"] as AttrDict)["name"] : null,
    }]));
    expect(fes).toEqual(o.framenet.frame_fes);
    const lus = Object.fromEntries((f["lexUnit"] as AttrDict).entries().map(([k, lu]: [string, any]) => [k, {
      ID: lu["ID"], status: lu["status"], lexemes: (lu["lexemes"] as any[]).map((lx: any) => lx["name"]),
      def: lu["definition"],
    }]));
    expect(lus).toEqual(o.framenet.frame_lus);
    expect(fn.frame("Test_frame")["ID"]).toBe(o.framenet.frame_by_name_id);
    expect((fn.frames() as unknown[]).length).toBe(o.framenet.frames_len);
    expect(Object.fromEntries(fn.frame_ids_and_names())).toEqual(o.framenet.frame_ids);

    const lb = fn.lu_basic(10);
    const lbProj: Record<string, unknown> = {};
    for (const k of lb.keys()) {
      if (["ID", "name", "status", "lexemes"].includes(k)) lbProj[k] = fnproj(lb[k]);
    }
    expect(lbProj).toEqual(o.framenet.lu_basic);
    const exs = fn.lu(10)["exemplars"] as AttrDict[];
    expect(exs.map((s) => s["text"])).toEqual(o.framenet.lu_exemplar_texts);
    expect(exs.map((s) => s.get("Target"))).toEqual(o.framenet.lu_exemplar_targets);
    expect(exs.map((s) => s.get("FE"))).toEqual(o.framenet.lu_exemplar_fes);
    expect(Object.fromEntries(fn.lu_ids_and_names())).toEqual(o.framenet.lus_names);
    expect((fn.frame_relation_types() as AttrDict[]).map((r) => [r["ID"], r["name"]])).toEqual(o.framenet.frame_rel_types);
    expect((fn.frame_relations() as AttrDict[]).map((r) => [r["ID"], r["superFrameName"], r["subFrameName"]]))
      .toEqual(o.framenet.frame_rels);
    expect((fn.fe_relations() as AttrDict[]).map((r) => [r["ID"], r["superFEName"], r["subFEName"]]))
      .toEqual(o.framenet.fe_rels);
    const st: Record<string, unknown> = {};
    for (const s of fn.semtypes() as AttrDict[]) st[String(s["ID"])] = s["name"];
    expect(st).toEqual(o.framenet.semtypes);
    expect(fn.semtype_inherits(2, 1)).toBe(o.framenet.semtype_inherits);
    expect(docproj(fn.doc(1))).toEqual(o.framenet.doc);
    expect([...(fn.ft_sents() as Iterable<AttrDict>)].map(sentproj)).toEqual(o.framenet.ft_sents);
    expect([...(fn.sents() as Iterable<AttrDict>)].length).toBe(o.framenet.sents);
    expect([...(fn.docs_metadata() as Iterable<AttrDict>)].map((d) => framenetProj(d)))
      .toEqual(o.framenet.docs_meta);
    expect(errName(() => fn.frame("No_such_frame"))).toBe(o.framenet.bad_frame);
    expect(errName(() => fn.lu(999))).toBe(o.framenet.bad_lu);
    expect(errName(() => fn.frame("../escape"))).toBe(o.framenet.unsafe);
  });
});
