"""Pinned oracle for batch-E corpus readers (NLTK 3.10.3).

Generates the synthetic fixtures under ROOT (argv[1]), then pins
propbank/nombank/semcor/senseval/rte reader outputs."""
import json
import os
import sys

import nltk

assert nltk.__version__ == "3.10.3", "oracle requires NLTK 3.10.3"
from nltk.data import FileSystemPathPointer
from nltk.corpus.reader.bracket_parse import BracketParseCorpusReader
from nltk.corpus.reader.propbank import (
    PropbankCorpusReader, PropbankInstance, PropbankTreePointer, PropbankInflection,
)
from nltk.corpus.reader.nombank import (
    NombankCorpusReader, NombankInstance, NombankTreePointer,
)
from nltk.corpus.reader.semcor import SemcorCorpusReader
from nltk.corpus.reader.senseval import SensevalCorpusReader
from nltk.corpus.reader.rte import RTECorpusReader, norm
from nltk.corpus.reader.xmldocs import XMLCorpusReader
from defusedxml.ElementTree import fromstring as safe_fromstring

ROOT = sys.argv[1]
nltk.data.path.append(ROOT)

# ---------------------------------------------------------------- fixtures

FIXTURES = {
    "mrg/wsj_0001.mrg": """( (S (NP-SBJ (NNP John))
    (VP (VBD sold)
      (NP (DT the) (NN car))
      (PP-CLR (TO to) (NP (NNP Mary))))
    (. .)))
( (S (NP-SBJ (PRP He))
    (VP (VBZ runs)
      (ADVP (RB fast)))))
""",
    "mrg/wsj_0002.mrg": """( (S (NP-SBJ (NNP Jane))
    (VP (VBD took)
      (NP (DT a) (NN nap)))))
""",
    "propbank/wsj.gold": """wsj/00/wsj_0001.mrg 0 3 gold run.02 vp--a 1:1-ARG0 4:0-rel 5:1-ARG1
wsj/00/wsj_0001.mrg 0 6 gold jump.01 ----- 2:1-ARGM-LOC 6:0-rel
wsj/00/wsj_0002.mrg 0 2 gold take.01 vn-3a 0:0-ARG1 2:0-rel 1:1*3:0-ARG0
""",
    "propbank/verbs.txt": "run\njump\ntake\n",
    "propbank/frames/run.xml": """<?xml version="1.0"?>
<frameset>
<predicate lemma="run">
<roleset id="run.01" name="move quickly">
<roles><role n="0" descr="runner"/><role n="1" descr="course"/></roles>
</roleset>
<roleset id="run.02" name="operate">
<roles><role n="0" descr="operator"/></roles>
</roleset>
</predicate>
</frameset>
""",
    "nombank/nombank.1.0": """wsj/00/wsj_0001.mrg 0 2 sale 1 1:0-ARG0 2:0-rel 3:1-ARG1
wsj/00/wsj_0001.mrg 0 6 drop 2 5:0*2:0-ARGM-TMP 6:0-rel
""",
    "nombank/nombank.1.0.words": "sale\ndrop\n",
    "nombank/frames/sale.xml": """<?xml version="1.0"?>
<frameset>
<predicate lemma="sale">
<roleset id="sale.01" name="act of selling">
<roles><role n="0" descr="seller"/><role n="1" descr="thing sold"/></roles>
</roleset>
</predicate>
</frameset>
""",
    "semcor/sem1.xml": """<?xml version="1.0" encoding="UTF-8"?>
<corpus>
<contextfile filename="test" context="1">
<paragraphs>
<p snum="1">
<s snum="1">
<wf pos="NNP" lemma="person" wnsn="1" lexsn="5:00:00:individual:00" pn="person">John_M._Smith</wf>
<wf pos="VB" lemma="run" wnsn="2" lexsn="2:30:00::">ran</wf>
<punc>.</punc>
</s>
<s snum="2">
<wf pos="NN">dog</wf>
<wf pos="NN" lemma="reach" wnsn="2;1" lexsn="4:00:00::">reach</wf>
</s>
</p>
</paragraphs>
</contextfile>
</corpus>
""",
    # <ms> nested inside <s> is invisible to the lazy ".*/s/(punc|wf)" view
    # (words still work) but makes handle_sent raise "Unexpected element".
    "semcor/sem2.xml": """<?xml version="1.0"?>
<corpus><contextfile><paragraphs><p snum="1">
<s snum="3"><ms><wf pos="IN" lemma="be" wnsn="1" lexsn="2:42:00::">was</wf></ms><wf pos="JJ">good</wf><punc>.</punc></s>
</p></paragraphs></contextfile></corpus>
""",
    "senseval/hard.pos": """<corpus>
<lexelt item="hard.a">
<instance id="hard.a.bnc.0001">
<answer instance="hard.a.bnc.0001" senseid="HARD1"/>
<context>
It was a <head>hard</head> job .
</context>
</instance>
<instance id="hard.a.bnc.0002">
<answer instance="hard.a.bnc.0002" senseid="HARD2"/>
<answer instance="hard.a.bnc.0002" senseid="HARD3"/>
<context>
<wf pos="AT">The</wf> <head> <wf pos="JJ">hard</wf></head> <wf pos="NN">rock</wf> fell <s snum=5> and <s snum=6> rolled .
</context>
</instance>
</lexelt>
<lexelt item="serve.v">
<instance id="serve.v.0001">
<answer instance="serve.v.0001" senseid="SERVE1"/>
<context>
They <head>serve</head> dinner & drinks <{tonight}> .
</context>
</instance>
</lexelt>
</corpus>
""",
    "rte/rte1_dev.xml": """<?xml version="1.0"?>
<entailment-corpus challenge="1">
<pair id="1" value="TRUE" task="IE" length="short">
<t>Text one here.</t>
<h>Hyp one.</h>
</pair>
<pair id="2" value="FALSE" task="IE">
<t>Text two.</t>
<h>Hyp two.</h>
</pair>
</entailment-corpus>
""",
    "rte/rte3_test.xml": """<?xml version="1.0"?>
<entailment-corpus challenge="3">
<pair id="7" entailment="YES" task="QA">
<t>Text three.</t>
<h>Hyp three.</h>
</pair>
<pair id="8" task="QA">
<t>Text four.</t>
<h>Hyp four.</h>
</pair>
</entailment-corpus>
""",
}

for rel, content in FIXTURES.items():
    path = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

out = {}


def err(f):
    try:
        return {"err": None, "val": f()}
    except Exception as e:
        return {"err": f"{type(e).__name__}:{str(e)[:160]}"}


def proj(v):
    """JSON-friendly projection: tuples -> lists, everything else as-is."""
    if isinstance(v, tuple):
        return [proj(x) for x in v]
    if isinstance(v, list):
        return [proj(x) for x in v]
    return v


def proj_tree(t):
    return {"tree": t.pformat(), "label": str(t.label())}


# ---------------------------------------------------------------- propbank

pc = BracketParseCorpusReader(os.path.join(ROOT, "mrg"), r".*\.mrg")
xform = lambda f: f.split("/")[-1]  # noqa: E731
pb = PropbankCorpusReader(
    FileSystemPathPointer(os.path.join(ROOT, "propbank")), "wsj.gold",
    r"frames/.*\.xml", "verbs.txt", lambda f: f.split("/")[-1], pc)
pb2 = PropbankCorpusReader(
    FileSystemPathPointer(os.path.join(ROOT, "propbank")), "wsj.gold",
    r"frames/.*\.xml")

out["pb"] = {
    "fileids": pb.fileids(),
    "pb2_fileids": pb2.fileids(),
    "lines": list(pb.lines()),
    "verbs": list(pb.verbs()),
    "pc_fileids": pc.fileids(),
}


def proj_inst(i):
    args = []
    for loc, argid in i.arguments:
        e = {"loc": str(loc), "locrepr": repr(loc), "argid": argid}
        if i.tree is not None:
            e["sel"] = proj_tree(loc.select(i.tree))
            if hasattr(loc, "treepos"):
                e["treepos"] = list(loc.treepos(i.tree))
        args.append(e)
    sel_err = err(lambda: i.predicate.select(None))
    return {
        "repr": repr(i),
        "str": str(i),
        "fileid": i.fileid,
        "sentnum": i.sentnum,
        "wordnum": i.wordnum,
        "tagger": i.tagger,
        "roleset": i.roleset,
        "baseform": i.baseform,
        "sensenumber": i.sensenumber,
        "predid": i.predid,
        "inflection": str(i.inflection),
        "predicate": repr(i.predicate),
        "arguments": args,
        "tree": i.tree.pformat() if i.tree is not None else None,
        "pred_sel": proj_tree(i.predicate.select(i.tree)),
        "sel_none": sel_err,
    }


insts = list(pb.instances())
out["pb"]["instances"] = [proj_inst(i) for i in insts]
out["pb"]["inst_run"] = [i.roleset for i in pb.instances("run")]
out["pb"]["inst_sprint"] = [i.roleset for i in pb.instances("sprint")]
out["pb"]["pb2_tree0"] = list(pb2.instances())[0].tree is None

rs = pb.roleset("run.02")
out["pb"]["roleset"] = {
    "tag": rs.tag,
    "id": rs.attrib["id"],
    "name": rs.attrib["name"],
    "children": [[ch.tag, dict(ch.attrib)] for ch in rs[0]],
}
out["pb"]["roleset_err"] = err(lambda: pb.roleset("jump.01"))
out["pb"]["roleset_err2"] = err(lambda: pb.roleset("run.99"))
out["pb"]["rolesets"] = [r.attrib["id"] for r in pb.rolesets()]
out["pb"]["rolesets_run"] = [r.attrib["id"] for r in pb.rolesets("run")]
out["pb"]["rolesets_err"] = err(lambda: pb.rolesets("jump"))

# pointer parsing + reprs
out["pb"]["ptrs"] = [
    err(lambda s=s: {"str": str(PropbankTreePointer.parse(s)), "repr": repr(PropbankTreePointer.parse(s))})
    for s in ["3:1*5:0", "1:0,2:1", "x", "1:2:3", ":", "1,a:2"]
]

# inflections
out["pb"]["infl"] = [
    err(lambda s=s: {
        "str": str(PropbankInflection.parse(s)),
        "repr": repr(PropbankInflection.parse(s)),
        "form": PropbankInflection.parse(s).form,
        "tense": PropbankInflection.parse(s).tense,
        "aspect": PropbankInflection.parse(s).aspect,
        "person": PropbankInflection.parse(s).person,
        "voice": PropbankInflection.parse(s).voice,
    })
    for s in ["vp--a", "-----", "vn-3a", "vv-p3", "xxxxx", "vp--", None]
]

# instance parsing errors / no-xform fileid
bad = [
    "wsj_0001.mrg 0 3 gold run.02 vp--a 4:0-rel 5:0-ARG1-extra",
    "wsj_0001.mrg 0 3 gold run.02 vp--a 4:0-rel 5:0-rel",
    "wsj_0001.mrg 0 3 gold run.02 vv-p3 4:0-rel",
    "short",
]
out["pb"]["bad"] = [
    err(lambda s=s: {
        "fileid": PropbankInstance.parse(s, xform).fileid,
        "str": str(PropbankInstance.parse(s, xform)),
    })
    for s in bad
]
out["pb"]["bad_noxform"] = err(lambda: PropbankInstance.parse(bad[0]).fileid)

# ---------------------------------------------------------------- nombank

nb = NombankCorpusReader(
    FileSystemPathPointer(os.path.join(ROOT, "nombank")), "nombank.1.0",
    r"frames/.*\.xml", "nombank.1.0.words", lambda f: f.split("/")[-1], pc)

out["nb"] = {
    "fileids": nb.fileids(),
    "lines": list(nb.lines()),
    "nouns": list(nb.nouns()),
}


def proj_ninst(i):
    args = []
    for loc, argid in i.arguments:
        e = {"loc": str(loc), "locrepr": repr(loc), "argid": argid}
        if i.tree is not None:
            e["sel"] = proj_tree(loc.select(i.tree))
        args.append(e)
    return {
        "repr": repr(i),
        "str": str(i),
        "fileid": i.fileid,
        "sentnum": i.sentnum,
        "wordnum": i.wordnum,
        "baseform": i.baseform,
        "sensenumber": i.sensenumber,
        "predid": i.predid,
        "roleset": i.roleset,
        "predicate": repr(i.predicate),
        "arguments": args,
        "tree": i.tree.pformat() if i.tree is not None else None,
        "pred_sel": proj_tree(i.predicate.select(i.tree)),
    }


out["nb"]["instances"] = [proj_ninst(i) for i in nb.instances()]
out["nb"]["inst_sale"] = [i.roleset for i in nb.instances("sale")]

nrs = nb.roleset("sale.01")
out["nb"]["roleset"] = {
    "tag": nrs.tag,
    "id": nrs.attrib["id"],
    "name": nrs.attrib["name"],
}
out["nb"]["roleset_err"] = err(lambda: nb.roleset("nosuch.01"))
out["nb"]["roleset_err2"] = err(lambda: nb.roleset("nosuch"))
out["nb"]["rolesets"] = [r.attrib["id"] for r in nb.rolesets()]
out["nb"]["rolesets_err"] = err(lambda: nb.rolesets("nosuch"))

nb_bad = [
    "wsj_0001.mrg 0 2 sale 1 2:0-rel 1:0-rel",
    "wsj_0001.mrg 0 2 sale",
    "wsj_0001.mrg 0 2 sale 1 badloc-rel",
    "wsj_0001.mrg 0 2 sale 1 2:0-rel nohyphen",
    "wsj_0001.mrg 0 x sale 1 2:0-rel",
    "f 0 0 sale 1 0:0-relX 1:0-rel",
]
out["nb"]["bad"] = [
    err(lambda s=s: {
        "str": str(NombankInstance.parse(s, xform)),
        "predid": NombankInstance.parse(s, xform).predid,
        "roleset": NombankInstance.parse(s, xform).roleset,
    })
    for s in nb_bad
]
out["nb"]["roleset_norm"] = [
    err(lambda b=b: NombankInstance.parse(
        f"f 0 0 {b} 1 0:0-rel", lambda f: f).roleset)
    for b in ["10%", "1/10"]
]
out["nb"]["ptr"] = err(lambda: repr(NombankTreePointer.parse("3:1*5:0")))

# ---------------------------------------------------------------- semcor


class FakeWN:
    def lemma_from_key(self, key):
        raise KeyError(key)


sc = SemcorCorpusReader(FileSystemPathPointer(os.path.join(ROOT, "semcor")), r"sem1\.xml", FakeWN())
sc2 = SemcorCorpusReader(FileSystemPathPointer(os.path.join(ROOT, "semcor")), r"sem2\.xml", FakeWN())


def proj_el(e):
    if hasattr(e, "pformat"):
        return proj_tree(e)
    if isinstance(e, (list, tuple)):
        return [proj_el(x) for x in e]
    return e


def proj_item(x):
    # Tree is a list subclass, so check pformat first to keep labels.
    if hasattr(x, "pformat"):
        return proj_tree(x)
    if isinstance(x, list):
        return {"sent": [proj_el(e) for e in x], "num": getattr(x, "num", None)}
    return {"words": list(x)}


out["sc"] = {
    "fileids": sc.fileids(),
    "words": list(sc.words()),
    "chunks": [proj_item(c) for c in sc.chunks()],
    "sents": [proj_item(s) for s in sc.sents()],
    "chunk_sents": [proj_item(s) for s in sc.chunk_sents()],
    "tagged_chunks_pos": [proj_item(c) for c in sc.tagged_chunks(tag="pos")],
    "tagged_chunks_sem": [proj_item(c) for c in sc.tagged_chunks(tag="sem")],
    "tagged_chunks_both": [proj_item(c) for c in sc.tagged_chunks(tag="both")],
    "tagged_sents_pos": [proj_item(s) for s in sc.tagged_sents(tag="pos")],
    "tagged_sents_sem": [proj_item(s) for s in sc.tagged_sents(tag="sem")],
    "tagged_sents_both": [proj_item(s) for s in sc.tagged_sents(tag="both")],
    "words_sem2": list(sc2.words()),
    "sents_sem2": err(lambda: [proj_item(s) for s in sc2.sents()]),
    "chunk_sents_sem2": err(lambda: [proj_item(s) for s in sc2.chunk_sents()]),
    "chunks_sem2": [proj_item(c) for c in sc2.chunks()],
    "xml_tag": sc.xml("sem1.xml").tag,
    "words_fid": list(sc.words("sem1.xml")),
}

sc_eager = SemcorCorpusReader(
    FileSystemPathPointer(os.path.join(ROOT, "semcor")), r"sem1\.xml", FakeWN(), lazy=False)
out["sc"]["eager"] = {
    "words": err(lambda: sc_eager.words()),
    "sents": err(lambda: sc_eager.sents()),
    "chunks": err(lambda: sc_eager.chunks()),
    "chunk_sents": err(lambda: sc_eager.chunk_sents()),
    "tagged_chunks": err(lambda: sc_eager.tagged_chunks()),
    "tagged_sents": err(lambda: sc_eager.tagged_sents()),
}

# ---------------------------------------------------------------- senseval

se = SensevalCorpusReader(FileSystemPathPointer(os.path.join(ROOT, "senseval")), r".*\.pos")


def proj_sinst(i):
    return {
        "word": i.word,
        "position": i.position,
        "context": proj(i.context),
        "senses": proj(i.senses),
        "repr": repr(i),
    }


out["se"] = {
    "fileids": se.fileids(),
    "instances": [proj_sinst(i) for i in se.instances()],
    "instances_fid": [proj_sinst(i) for i in se.instances("hard.pos")],
}
entry_doc = safe_fromstring(
    "<corpus><lexelt item='x.y'><instance id='i1'>"
    "<answer senseid='S1'/><context>"
    "<wf pos='NN'>a</wf><wf pos='VB'>b</wf></context></instance>"
    "</lexelt></corpus>")
out["se"]["entry"] = proj(se._entry(entry_doc))

# ---------------------------------------------------------------- rte

rt = RTECorpusReader(FileSystemPathPointer(os.path.join(ROOT, "rte")), r".*\.xml")


def proj_pair(p):
    return {
        "challenge": p.challenge,
        "id": p.id,
        "gid": p.gid,
        "text": p.text,
        "hyp": p.hyp,
        "value": p.value,
        "task": p.task,
        "length": p.length,
        "repr": repr(p),
    }


out["rt"] = {
    "fileids": rt.fileids(),
    "pairs": [proj_pair(p) for p in rt.pairs(rt.fileids())],
    "pairs_dev": [proj_pair(p) for p in rt.pairs("rte1_dev.xml")],
    "pairs_both": [proj_pair(p) for p in rt.pairs(["rte1_dev.xml", "rte3_test.xml"])],
    "xml_tag": rt.xml("rte1_dev.xml").tag,
    "xml_attrib": dict(rt.xml("rte1_dev.xml").attrib),
    "words": rt.words("rte1_dev.xml"),
    "xml_none": err(lambda: rt.xml()),
    "norm": [err(lambda v=v: norm(v)) for v in ["TRUE", "FALSE", "yes", "No", "maybe"]],
}

print(json.dumps(out, sort_keys=True, default=str))
