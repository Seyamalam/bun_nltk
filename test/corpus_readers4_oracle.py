"""Pinned oracle for batch-D (XML-backed) corpus readers (NLTK 3.10.3).

Generates synthetic fixtures under the root passed as argv[1], runs the
Python readers, and prints normalized JSON for differential testing.
"""
import json
import os
import sys

import nltk

assert nltk.__version__ == "3.10.3", "oracle requires NLTK 3.10.3"
from nltk.corpus.reader.bnc import BNCCorpusReader
from nltk.corpus.reader.childes import CHILDESCorpusReader
from nltk.corpus.reader.verbnet import VerbnetCorpusReader
from nltk.corpus.reader.mte import MTECorpusReader, MTETagConverter
from nltk.corpus.reader.ipipan import IPIPANCorpusReader
from nltk.corpus.reader.nkjp import NKJPCorpusReader
from nltk.corpus.reader.nps_chat import NPSChatCorpusReader
from nltk.corpus.reader.framenet import FramenetCorpusReader
from nltk.corpus.reader.xmldocs import XMLCorpusReader

ROOT = sys.argv[1]
nltk.data.path.append(ROOT)


def w(path, text):
    p = os.path.join(ROOT, *path.split("/"))
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(text)


def err(f):
    try:
        return {"err": None, "val": f()}
    except Exception as e:
        return {"err": f"{type(e).__name__}:{str(e)[:160]}"}


def tup(x):
    if isinstance(x, tuple):
        return [tup(v) for v in x]
    if isinstance(x, list):
        return [tup(v) for v in x]
    return x


def seq(x):
    return [tup(v) for v in x]


# ============================================================ fixtures

# --- BNC
w("bnc/BNC1.xml", """<?xml version="1.0"?>
<bncDoc xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<teiHeader><titleStmt><title>Test Title</title><author>Jane Author</author></titleStmt></teiHeader>
<wtext><body><div>
<s n="1"><w c5="AT0" pos="DET" hw="the">The </w><w c5="NN1" pos="SUBST" hw="cat">cat </w><mw c5="AV0"><w c5="AV0" pos="ADV" hw="slow">slow </w></mw><c c5="PUN" pos="PUN">.</c><pb n="1"/></s>
<s n="2"><w c5="VVD" pos="VERB" hw="run">Ran</w><gap/><w c5="UNC" pos="UNC" hw="um"></w><c c5="PUN" pos="PUN">!</c></s>
</div></body></wtext>
</bncDoc>
""")

# --- CHILDES
w("childes/c1.xml", """<?xml version="1.0"?>
<CHAT xmlns="http://www.talkbank.org/ns/talkbank" Date="1990-01-01" Lang="eng">
<Participants>
<participant id="CHI" role="Target_Child" age="P2Y10M" sex="male"/>
<participant id="MOT" role="Mother" age="P30Y"/>
</Participants>
<u who="CHI" uID="u1">
<w>the<mor><mw><pos><c>det</c></pos><stem>the</stem></mw></mor></w>
<w>dog<mor><mw><pos><c>n</c><s>prop</s></pos><stem>dog</stem></mw><gra type="gr" index="2" head="0" relation="SUBJ"/></mor></w>
</u>
<u who="MOT" uID="u2">
<w>yes<mor><mw><pos><c>co</c></pos><stem>yes</stem></mw></mor></w>
</u>
</CHAT>
""")

# --- VerbNet
w("verbnet/hit-18.1.xml", """<?xml version="1.0"?>
<VNCLASS ID="hit-18.1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="vn_class-3.xsd">
<MEMBERS>
<MEMBER name="hit" wn="hit%2:35:00 hit%2:35:01"/>
<MEMBER name="kick" wn=""/>
</MEMBERS>
<THEMROLES>
<THEMROLE type="Agent"><SELRESTRS><SELRESTR Value="+" type="animate"/></SELRESTRS></THEMROLE>
<THEMROLE type="Theme"><SELRESTRS/></THEMROLE>
</THEMROLES>
<FRAMES>
<FRAME>
<DESCRIPTION primary="NP V NP" secondary="Basic Transitive"/>
<EXAMPLES><EXAMPLE>The cat hit the ball.</EXAMPLE></EXAMPLES>
<SYNTAX><NP value="Agent"><SYNRESTRS/></NP><VERB/><NP value="Theme"><SYNRESTRS/></NP></SYNTAX>
<SEMANTICS><PRED bool="!" value="cause"><ARGS><ARG type="Event" value="e"/><ARG type="Themrole" value="Agent"/></ARGS></PRED></SEMANTICS>
</FRAME>
</FRAMES>
<SUBCLASSES><VNSUBCLASS ID="hit-18.1-1"/></SUBCLASSES>
</VNCLASS>
""")

# --- MTE (root tag must literally be <TEI> for the tag paths)
w("mte/oana-en.xml", """<?xml version="1.0"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0" xml:lang="en">
<text><body><div><div>
<p>
<s><w lemma="cat" ana="Ncmsn">Cat</w><w lemma="sit" ana="Vmma">sat</w><c ana="SENT">.</c></s>
<s><w lemma="run" ana="Vm-p">Ran</w><w ana="Xxx">Q</w></s>
</p>
</div></div></body></text>
</TEI>
""")

# --- IPIPAN
w("ipipan/d1/header.xml", """<cesHeader>
<channel>press</channel>
<domain>politics&gt;economy</domain>
<keyTerm>economics</keyTerm>
</cesHeader>
""")
w("ipipan/d1/morph.xml", """<cesAna version="1.0" type="lex disamb">
<chunkList>
<chunk type="p" id="p1">
<chunk type="s" id="s1">
<tok>
<orth>Ala</orth>
<lex disamb="1"><base>ala</base><ctag>subst:sg:nom:f</ctag></lex>
<lex><base>ala2</base><ctag>subst:sg:acc:f</ctag></lex>
</tok>
<ns/>
<tok>
<orth>ma</orth>
<lex disamb="1"><base>ma</base><ctag>fin:sg:ter:imperf</ctag></lex>
</tok>
<tok>
<orth>&quot;kota&quot;</orth>
<lex disamb="1"><base>kot</base><ctag>subst:sg:acc:m2</ctag></lex>
</tok>
</chunk>
</chunk>
</chunkList>
</cesAna>
""")

# --- NKJP
w("nkjp/d1/header.xml", """<teiHeader>
<fileDesc><sourceDesc><bibl>
<title>T1</title>
</bibl></sourceDesc></fileDesc>
</teiHeader>
""")
w("nkjp/d1/ann_segmentation.xml", """<teiCorpus><body><p><s><seg corresp="morph_1-seg(0,4)"/></s></p></body></teiCorpus>""")
w("nkjp/d1/ann_morphosyntax.xml", """<teiCorpus><body><p><s><seg><fs><f name="orth"><string>Kot</string></f><f name="interps"><symbol type="lex"><fs><f name="ctag"><symbol value="subst"/></fs></symbol></f></fs></seg></s></p></body></teiCorpus>""")
w("nkjp/d1/text.xml", """<teiCorpus><body><div><ab xml:id="txt1">Kot siedzi</ab></div></body></teiCorpus>""")

# --- NPS Chat
w("nps/chat1.xml", """<?xml version="1.0"?>
<Session>
<Posts>
<Post class="Emphatic" user="11-9-20sUser6" time="2001-01-01">
<terminals>
<t pos="NN" word="11-9-20sUser6"/><t pos="VBZ" word="is"/><t pos="JJ" word="back"/>
</terminals>
</Post>
<Post class="Statement" user="10-19-40sUser2" time="2001-01-01">
<terminals>
<t pos="RB" word="then"/><t pos="NN" word="dog"/><t pos="." word="."/>
</terminals>
</Post>
</Posts>
</Session>
""")

# --- FrameNet
w("framenet/frameIndex.xml", """<?xml version="1.0"?>
<frameIndex xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<frame ID="1" name="Test_frame"/>
</frameIndex>
""")
w("framenet/luIndex.xml", """<?xml version="1.0"?>
<luIndex xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<lu ID="10" name="hit.v" frameID="1" frameName="Test_frame" status="Created" totalAnnotated="1"/>
</luIndex>
""")
w("framenet/frRelation.xml", """<?xml version="1.0"?>
<frameRelations xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<frameRelationType ID="1" name="Inheritance" superFrameName="Parent" subFrameName="Child">
<frameRelation ID="11" supID="1" subID="2" superFrameName="Test_frame" subFrameName="Sub_frame">
<FERelation ID="21" feID="5" superFEName="Agent" subFEName="Agent"/>
</frameRelation>
</frameRelationType>
</frameRelations>
""")
w("framenet/semTypes.xml", """<?xml version="1.0"?>
<semTypes xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<semType ID="1" name="Root_type" abbrev="r" xmlns=""><definition>root</definition></semType>
<semType ID="2" name="Lexical_type" abbrev="L"><superType supID="1"/></semType>
</semTypes>
""")
w("framenet/frame/Test_frame.xml", """<?xml version="1.0"?>
<frame ID="1" name="Test_frame" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="frame.xsd" cBy="Me" cDate="01/01/2001" mBy="Me" mDate="01/01/2001">
<definition>&lt;def-root&gt;A test frame.&lt;/def-root&gt;</definition>
<FE ID="5" name="Agent" abbrev="ag" coreType="Core" cBy="Me" cDate="01/01/2001">
<definition>&lt;def-root&gt;The doer.&lt;/def-root&gt;</definition>
<semType ID="2" name="Lexical_type"/>
</FE>
<FE ID="6" name="Theme" abbrev="th" coreType="Core" cBy="Me" cDate="01/01/2001">
<definition/>
</FE>
<lexUnit ID="10" name="hit.v" POS="V" status="Created" totalAnnotated="1" incorporateFE="" lemmaID="10">
<definition>&lt;def-root&gt;to hit&lt;/def-root&gt;</definition>
<sentenceCount annotated="1" total="1"/>
<lexeme name="hit" POS="V" order="1" headword="0" breakBefore="0"/>
</lexUnit>
</frame>
""")
w("framenet/lu/lu10.xml", """<?xml version="1.0"?>
<lexUnit xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" status="Created" POS="V" ID="10" name="hit.v" frame="Test_frame" frameID="1" totalAnnotated="1">
<header><frame><FE/></frame></header>
<definition>to hit</definition>
<lexeme name="hit" POS="V" order="1" headword="0" breakBefore="0"/>
<semType ID="2" name="Lexical_type"/>
<valences/>
<subCorpus name="01">
<sentence ID="101" aPos="1" paragNo="1" sentNo="1" corpID="1" docID="1">
<text>The cat hit the ball.</text>
<annotationSet status="UNANN" ID="201" luID="10" luName="hit.v" frameID="1" frameName="Test_frame">
<layer rank="1" name="BNC"><label end="2" start="0" name="The"/><label end="6" start="4" name="cat"/><label end="10" start="8" name="hit"/><label end="14" start="12" name="the"/><label end="20" start="16" name="ball."/></layer>
</annotationSet>
<annotationSet status="MANUAL" ID="202" luID="10" luName="hit.v" frameID="1" frameName="Test_frame" cDate="01/01/2001">
<layer rank="1" name="Target"><label end="10" start="8" name="Target"/></layer>
<layer rank="1" name="FE"><label feID="5" end="6" start="0" name="Agent"/><label feID="6" name="Theme" itype="DNI"/></layer>
<layer rank="1" name="GF"><label end="6" start="0" name="Ext"/></layer>
<layer rank="1" name="PT"><label end="6" start="0" name="NP"/></layer>
</annotationSet>
</sentence>
</subCorpus>
</lexUnit>
""")
w("framenet/fulltextIndex.xml", """<?xml version="1.0"?>
<fulltextIndex xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<corpus ID="1" name="ANC"><document ID="1" name="doc1" description="Doc one"/></corpus>
</fulltextIndex>
""")
w("framenet/fulltext/ANC__doc1.xml", """<?xml version="1.0"?>
<fullTextAnnotation xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<header><corpus ID="1" name="ANC"><document ID="1" name="doc1"/></corpus></header>
<sentence ID="1" aPos="1" paragNo="1" sentNo="1" docID="1" corpID="1">
<text>John hit the ball.</text>
<annotationSet status="UNANN" ID="1">
<layer rank="1" name="PENN"><label end="3" start="0" name="NNP"/><label end="7" start="5" name="VBD"/><label end="11" start="9" name="DT"/><label end="16" start="13" name="NN"/><label end="17" start="16" name="."/></layer>
</annotationSet>
<annotationSet status="MANUAL" ID="2" luID="10" luName="hit.v" frameID="1" frameName="Test_frame">
<layer rank="1" name="Target"><label end="7" start="5" name="Target"/></layer>
<layer rank="1" name="FE"><label feID="5" end="3" start="0" name="Agent"/><label feID="6" end="17" start="9" name="Theme"/></layer>
</annotationSet>
</sentence>
</fullTextAnnotation>
""")

# ============================================================ run readers

out = {}

# --- XMLCorpusReader basics
xr = XMLCorpusReader(os.path.join(ROOT, "bnc"), "BNC1.xml")
out["xml"] = {
    "fileids": xr.fileids(),
    "words": list(xr.words()),
    "xml_tag": xr.xml().tag,
}

# --- BNC
b = BNCCorpusReader(os.path.join(ROOT, "bnc"), "BNC1.xml")
bnc_sents = list(b.sents())
out["bnc"] = {
    "fileids": b.fileids(),
    "words": list(b.words()),
    "words_strip_f": list(b.words(strip_space=False)),
    "words_stem": list(b.words(stem=True)),
    "tagged_words": [list(x) for x in b.tagged_words()],
    "tagged_words_c5": [list(x) for x in b.tagged_words(c5=True)],
    "sents": [list(s) for s in bnc_sents],
    "sents_num": [s.num for s in bnc_sents],
    "tagged_sents": [[list(x) for x in s] for s in b.tagged_sents()],
    "eager_words": list(BNCCorpusReader(os.path.join(ROOT, "bnc"), "BNC1.xml", lazy=False).words()),
}

# header metadata via a direct view
from nltk.corpus.reader.bnc import BNCWordView  # noqa: E402
bw = BNCWordView(os.path.join(ROOT, "bnc", "BNC1.xml"), False, False, True, False)
out["bnc"]["title"] = bw.title
out["bnc"]["author"] = bw.author
out["bnc"]["editor"] = bw.editor
out["bnc"]["resps"] = bw.resps

# --- CHILDES
c = CHILDESCorpusReader(os.path.join(ROOT, "childes"), "c1.xml")
out["childes"] = {
    "fileids": c.fileids(),
    "words": seq(c.words()),
    "words_chi": seq(c.words(speaker="CHI")),
    "words_mot": seq(c.words(speaker="MOT")),
    "words_stem": seq(c.words(stem=True)),
    "tagged_words": seq(c.tagged_words()),
    "sents": seq(c.sents()),
    "sents_chi": seq(c.sents(speaker="CHI")),
    "tagged_sents": seq(c.tagged_sents()),
    "sents_relation": seq(c.sents(relation=True)),
    "corpus": seq(c.corpus()),
    "participants": seq(c.participants()),
    "age": seq(c.age()),
    "age_month": seq(c.age(month=True)),
    "mlu": seq(c.MLU()),
    "convert_age": err(lambda: c.convert_age("bad"))["err"],
}

# --- VerbNet
vn = VerbnetCorpusReader(os.path.join(ROOT, "verbnet"), ".*\\.xml")
out["verbnet"] = {
    "fileids": vn.fileids(),
    "lemmas_all": vn.lemmas(),
    "lemmas_hit": vn.lemmas("hit-18.1"),
    "lemmas_short": vn.lemmas("18.1"),
    "wordnetids": vn.wordnetids("hit-18.1"),
    "classids": vn.classids(),
    "classids_lemma": vn.classids(lemma="hit"),
    "classids_fileid": vn.classids(fileid="hit-18.1.xml"),
    "classids_classid": vn.classids(classid="hit-18.1"),
    "vnclass_sub": vn.vnclass("hit-18.1-1").get("ID"),
    "frames": vn.frames("hit-18.1"),
    "subclasses": vn.subclasses("hit-18.1"),
    "themroles": vn.themroles("hit-18.1"),
    "longid": vn.longid("18.1"),
    "shortid": vn.shortid("hit-18.1"),
    "pprint": vn.pprint("hit-18.1"),
    "bad_version": err(lambda: VerbnetCorpusReader(os.path.join(ROOT, "verbnet"), ".*\\.xml", version="9.9"))["err"],
}

# --- MTE
m = MTECorpusReader(os.path.join(ROOT, "mte"), "oana-en.xml")
out["mte"] = {
    "fileids": m.fileids(),
    "words": seq(m.words()),
    "sents": seq(m.sents()),
    "paras": seq(m.paras()),
    "lemma_words": seq(m.lemma_words()),
    "lemma_sents": seq(m.lemma_sents()),
    "lemma_paras": seq(m.lemma_paras()),
    "tagged_words_msd": seq(m.tagged_words(tagset="msd")),
    "tagged_words_uni": seq(m.tagged_words(tagset="universal")),
    "tagged_words_uni_n": seq(m.tagged_words(tagset="universal", tags="N")),
    "tagged_sents_msd": seq(m.tagged_sents(tagset="msd")),
    "tagged_paras_uni": seq(m.tagged_paras(tagset="universal")),
    "msd2u_N": MTETagConverter.msd_to_universal("Ncmsn"),
    "msd2u_V": MTETagConverter.msd_to_universal("Vm-p"),
    "msd2u_unk": MTETagConverter.msd_to_universal("Zzz"),
}

# --- IPIPAN
# NB: in NLTK 3.10.3 on Python 3 the IPIPAN view opens a *binary* stream
# (encoding=None), so every read_block() raises TypeError — pinned verbatim.
ip = IPIPANCorpusReader(os.path.join(ROOT, "ipipan"), "d1/morph.xml")
out["ipipan"] = {
    "fileids": ip.fileids(),
    "channels": ip.channels(),
    "domains": ip.domains(),
    "categories": ip.categories(),
    "fileids_channel": ip.fileids(channels="press"),
    "fileids_domain": ip.fileids(domains="economy"),
    "words": err(lambda: seq(ip.words()))["err"],
    "sents": err(lambda: seq(ip.sents()))["err"],
    "paras": err(lambda: seq(ip.paras()))["err"],
    "tagged_words": err(lambda: seq(ip.tagged_words()))["err"],
    "tagged_sents": err(lambda: seq(ip.tagged_sents()))["err"],
    "bad_opts": err(lambda: ip.tagged_words(tags=False, one_tag=False, disamb_only=False))["err"],
    "bad_opts2": err(lambda: ip.tagged_words(one_tag=False, disamb_only=False))["err"],
}

# --- NKJP
nk = NKJPCorpusReader(os.path.join(ROOT, "nkjp"), "d1")
out["nkjp"] = {
    "fileids": nk.fileids(),
    "header": seq(nk.header()),
    "words": err(lambda: seq(nk.words()))["err"],
    "sents": err(lambda: seq(nk.sents()))["err"],
    "raw": err(lambda: seq(nk.raw()))["err"],
    "tagged_words": err(lambda: seq(nk.tagged_words(tags=["subst"])))["err"],
}

# --- NPS Chat
np_ = NPSChatCorpusReader(os.path.join(ROOT, "nps"), "chat1.xml")
out["nps"] = {
    "fileids": np_.fileids(),
    "posts": seq(np_.posts()),
    "tagged_posts": seq(np_.tagged_posts()),
    "words": seq(np_.words()),
    "tagged_words": seq(np_.tagged_words()),
    "xml_posts_tag": [p.tag for p in np_.xml_posts()],
}

# --- FrameNet
fn = FramenetCorpusReader(os.path.join(ROOT, "framenet"), ".*")


def fnproj(v, depth=0):
    """Bounded projection (dicts may contain cyclic back-references)."""
    if depth > 2:
        return "..."
    if isinstance(v, dict):
        return {k: fnproj(x, depth + 1) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [fnproj(x, depth + 1) for x in v]
    return v


def docproj(d):
    return {
        k: (fnproj(v) if k in ("ID", "name", "filename", "corpname", "corpid") else None)
        for k, v in d.items() if k != "sentence"
    } | {
        "sents": [
            {"ID": s["ID"], "text": s["text"], "POS": s.get("POS"), "POS_tagset": s.get("POS_tagset"),
             "targets": [fnproj(t) for t in s.get("targets", [])],
             "n_asets": len(s["annotationSet"])}
            for s in d["sentence"]
        ]
    }


def sentproj(s):
    return {"ID": s["ID"], "text": s["text"], "POS": s.get("POS"), "POS_tagset": s.get("POS_tagset"),
            "targets": [fnproj(t) for t in s.get("targets", [])],
            "asets": [
                {k: fnproj(v) for k, v in a.items()
                 if k in ("ID", "status", "luName", "luID", "frameName", "frameID", "Target", "FE")}
                for a in s["annotationSet"]
            ]}


f = fn.frame(1)
out["framenet"] = {
    "frame_id": f["ID"],
    "frame_name": f["name"],
    "frame_type": f["_type"],
    "frame_def": f["definition"],
    "frame_fes": {k: {"ID": fe["ID"], "coreType": fe["coreType"], "definition": fe["definition"],
                      "semType": fe["semType"]["name"] if fe["semType"] else None}
                  for k, fe in f["FE"].items()},
    "frame_lus": {k: {"ID": lu["ID"], "status": lu["status"], "lexemes": [lx["name"] for lx in lu["lexemes"]],
                      "def": lu["definition"]} for k, lu in f["lexUnit"].items()},
    "frame_url": f["URL"],
    "frame_by_name_id": fn.frame("Test_frame")["ID"],
    "frames_len": len(fn.frames()),
    "frame_ids": dict(fn.frame_ids_and_names()),
    "lu_basic": {k: fnproj(v) for k, v in fn.lu_basic(10).items() if k in ("ID", "name", "status", "lexemes")},
    "lu_exemplar_texts": [s["text"] for s in fn.lu(10)["exemplars"]],
    "lu_exemplar_targets": [s.get("Target") for s in fn.lu(10)["exemplars"]],
    "lu_exemplar_fes": [s.get("FE") for s in fn.lu(10)["exemplars"]],
    "lus_names": dict(fn.lu_ids_and_names()),
    "frame_rel_types": [(r["ID"], r["name"]) for r in fn.frame_relation_types()],
    "frame_rels": [(r["ID"], r["superFrameName"], r["subFrameName"]) for r in fn.frame_relations()],
    "fe_rels": [(r["ID"], r["superFEName"], r["subFEName"]) for r in fn.fe_relations()],
    "semtypes": {st["ID"]: st["name"] for st in fn.semtypes()},
    "semtype_inherits": fn.semtype_inherits(2, 1),
    "doc": err(lambda: docproj(fn.doc(1)))["val"],
    "ft_sents": [sentproj(s) for s in fn.ft_sents()],
    "sents": err(lambda: len(list(fn.sents())))["val"],
    "docs_meta": [fnproj(d) for d in fn.docs_metadata()],
    "bad_frame": err(lambda: fn.frame("No_such_frame"))["err"],
    "bad_lu": err(lambda: fn.lu(999))["err"],
    "unsafe": err(lambda: fn.frame("../escape"))["err"],
}

print(json.dumps(out, sort_keys=True, default=str))
