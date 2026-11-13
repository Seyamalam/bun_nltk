"""Pinned oracle for batch-F corpus readers (NLTK 3.10.3)."""
import io
import json
import os
import sys
import warnings

import nltk

assert nltk.__version__ == "3.10.3", "oracle requires NLTK 3.10.3"

from functools import partial

from nltk.corpus.reader.timit import TimitCorpusReader, read_timit_block
from nltk.corpus.reader.panlex_lite import PanLexLiteCorpusReader
from nltk.corpus.reader.panlex_swadesh import PanlexSwadeshCorpusReader
from nltk.corpus.reader.pl196x import Pl196xCorpusReader
from nltk.corpus.reader.bcp47 import BCP47CorpusReader
from nltk.corpus.reader.crubadan import CrubadanCorpusReader
from nltk.corpus.reader.markdown import (
    MarkdownCorpusReader,
    CategorizedMarkdownCorpusReader,
    MarkdownBlock,
    CodeBlock,
    MarkdownSection,
    read_parse_blankline_block,
)
from nltk.corpus.reader.framenet import (
    AttrDict,
    Future,
    PrettyDict,
    PrettyList,
    PrettyLazyConcatenation,
    PrettyLazyIteratorList,
    PrettyLazyMap,
    SpecialList,
    _annotation_ascii,
)
from nltk.corpus.reader.rte import norm
from nltk.corpus.reader.mte import xpath
from nltk.corpus.reader.xmldocs import XMLCorpusReader
from nltk.xmlsec import parse as safe_parse
from nltk.util import acyclic_breadth_first
from nltk.corpus.reader.util import concat
from itertools import chain

ROOT = sys.argv[1]
nltk.data.path.append(ROOT)

out = {}


def err(f):
    try:
        return {"err": None, "val": f()}
    except Exception as e:
        return {"err": f"{type(e).__name__}:{str(e)[:150]}"}


def proj_meaning(m):
    return {
        "id": m.id(),
        "quality": m.quality(),
        "source": m.source(),
        "source_group": m.source_group(),
        "expressions": m.expressions(),
        "dict": dict(m),
    }


def proj_spk(s):
    return {
        "id": s.id, "sex": s.sex, "dr": s.dr, "use": s.use,
        "recdate": s.recdate, "birthdate": s.birthdate, "ht": s.ht,
        "race": s.race, "edu": s.edu, "comments": s.comments,
        "repr": repr(s),
    }


# --- TimitCorpusReader -------------------------------------------------------
from nltk.data import FileSystemPathPointer

timit_root = FileSystemPathPointer(f"{ROOT}/timit")
with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    t = TimitCorpusReader(timit_root)

out["timit"] = {
    "speakers": t.speakers,
    "fileids": t.fileids(),
    "fileids_txt": t.fileids("txt"),
    "fileids_metadata": t.fileids("metadata"),
    "fileids_bad": err(lambda: t.fileids("zzz")),
    "utteranceids": t.utteranceids(),
    "utteranceids_dialect": t.utteranceids(dialect="1"),
    "utteranceids_sex": t.utteranceids(sex="f"),
    "utteranceids_spkrid": t.utteranceids(spkrid="dr1-fvmh0"),
    "utteranceids_sentid_bug": err(lambda: t.utteranceids(sentid="sa1")),
    "utteranceids_sentid_spkr": t.utteranceids(spkrid="sa1", sentid="x"),
    "spkrid": t.spkrid("dr1-fvmh0/sa1"),
    "sentid": t.sentid("dr1-fvmh0/sa1"),
    "utterance": t.utterance("dr1-fvmh0", "sa1"),
    "spkrutteranceids": t.spkrutteranceids("dr1-fvmh0"),
    "spkrinfo": proj_spk(t.spkrinfo("dr1-fvmh0")),
    "spkrinfo_by_utt": proj_spk(t.spkrinfo("dr1-fvmh0/sa1")),
    "spkrinfo_missing": err(lambda: t.spkrinfo("dr9-xx99")),
    "transcription_dict": t.transcription_dict(),
    "phones": t.phones(),
    "phones_one": t.phones("dr1-fvmh0/sa2"),
    "phone_times": [list(row) for row in t.phone_times()],
    "words": t.words(),
    "word_times": [list(row) for row in t.word_times()],
    "sents": [list(s) for s in t.sents()],
    "sent_times": [list(row) for row in t.sent_times()],
    "phone_trees": [tr.pformat() for tr in t.phone_trees()],
    "audiodata_len": len(t.audiodata("dr2-mabc0/si1")),
    "audiodata_slice": list(t.audiodata("dr2-mabc0/si1", 4, 10)),
    "wav_prefix": list(t.wav("dr2-mabc0/si1")[:48]),
    "wav_len": len(t.wav("dr2-mabc0/si1")),
    "read_timit_block": read_timit_block(io.StringIO("12 The cat sat.\n")),
    "read_timit_block_eof": read_timit_block(io.StringIO("")),
}

# --- PanLexLiteCorpusReader --------------------------------------------------
pl = PanLexLiteCorpusReader(f"{ROOT}/panlex_lite")
out["panlex_lite"] = {
    "language_varieties": [list(x) for x in pl.language_varieties()],
    "language_varieties_lc": [list(y) for y in pl.language_varieties("spa")],
    "meanings_hello": [proj_meaning(m) for m in pl.meanings("eng0000", "hello")],
    "meanings_missing_uid": err(lambda: [proj_meaning(m) for m in pl.meanings("zzz9999", "hello")]),
    "meanings_missing_expr": [proj_meaning(m) for m in pl.meanings("eng0000", "nonsense")],
    "translations": [list(t_) for t_ in pl.translations("eng0000", "hello", "spa0000")],
    "translations_back": [list(t_) for t_ in pl.translations("spa0000", "hola", "eng0000")],
    "translations_missing": [list(t_) for t_ in pl.translations("eng0000", "nonsense", "spa0000")],
    "fileids_attr_err": err(lambda: pl.fileids()),
}

# --- PanlexSwadeshCorpusReader -----------------------------------------------
sw = PanlexSwadeshCorpusReader(
    ROOT, ["swadesh110/eng0000.txt", "swadesh110/spa0000.txt", "swadesh110/fra0000.txt"]
)
out["swadesh"] = {
    "swadesh_size": sw.swadesh_size,
    "language_codes": list(sw.language_codes()),
    "languages": [repr(x) for x in sw.get_languages()],
    "macrolanguages": {k: v for k, v in sorted(sw.get_macrolanguages().items())},
    "words_by_lang": [list(e) for e in sw.words_by_lang("eng0000")],
    "words_by_iso639": [list(e) for e in sw.words_by_iso639("eng")],
    "words_by_iso639_missing": err(lambda: [list(e) for e in sw.words_by_iso639("zzz")]),
    "entries": [list(e) for e in sw.entries()],
    "entries_one": [list(e) for e in sw.entries(["swadesh110/eng0000.txt"])],
    "entries_empty": [list(e) for e in sw.entries([])],
}

# --- Pl196xCorpusReader -------------------------------------------------------
px = Pl196xCorpusReader(
    ROOT, r"[ab]/text\d\.xml", cat_pattern=r"([ab])/.*",
    textid_file=os.path.join(ROOT, "textids.txt"),
)
out["pl196x"] = {
    "categories": px.categories(),
    "fileids": px.fileids(),
    "textids_both": px.textids("a/text1.xml", "a"),
    "textids_err": err(lambda: px.textids()),
    "words_err": err(lambda: list(px.words())),
    "words_one_err": err(lambda: list(px.words("a/text1.xml"))),
    "words": list(px.words("a/text1.xml", "a")),
    "sents": [list(s) for s in px.sents("a/text1.xml", "a")],
    "paras": [[list(s) for s in p] for p in px.paras("a/text1.xml", "a")],
    "tagged_words": [list(w) for w in px.tagged_words("a/text1.xml", "a")],
    "tagged_sents": [[list(w) for w in s] for s in px.tagged_sents("a/text1.xml", "a")],
    "tagged_paras": [[[list(w) for w in s] for s in p] for p in px.tagged_paras("a/text1.xml", "a")],
    "words_cat": list(px.words("b/text2.xml", "b")),
    "words_by_textids_err": err(lambda: list(px.words(textids="t2"))),
    "words_cat_textids_err": err(lambda: list(px.words(categories="a", textids="t2"))),
    "words_textids_err": err(lambda: list(px.words("a/text1.xml", "a", "t1"))),
    "xml_list": px.xml(["a/text1.xml"], "a").tag,
    "xml_err": err(lambda: px.xml("a/text1.xml", "a")),
}

# --- BCP47CorpusReader --------------------------------------------------------
with warnings.catch_warnings(record=True) as caught:
    warnings.simplefilter("always")
    b = BCP47CorpusReader(ROOT, ["iana/language-subtag-registry.txt",
                               "cldr/common-subdivisions-en.xml",
                               "cldr/tools-cldr-rdf-external-entityToCode.tsv"])

def warnwrap(f):
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        try:
            val = f()
            return {"err": None, "val": val, "warns": [str(x.message) for x in w]}
        except Exception as e:
            return {"err": f"{type(e).__name__}:{str(e)[:150]}", "warns": [str(x.message) for x in w]}

out["bcp47"] = {
    "version": b.version,
    "name_latn_es": warnwrap(lambda: b.name("ca-Latn-ES-valencia")),
    "name_gascon": warnwrap(lambda: b.name("oc-gascon-u-sd-fr64")),
    "name_grandfathered": warnwrap(lambda: b.name("i-ami")),
    "name_deprecated": warnwrap(lambda: b.name("art-lojban")),
    "name_unknown": warnwrap(lambda: b.name("zzz")),
    "name_unknown_subdiv": warnwrap(lambda: b.name("oc-u-sd-zz99")),
    "name_invalid_ext": warnwrap(lambda: b.name("en-abcdef-xyz")),
    "parse_tag": b.parse_tag("ca-Latn-ES-valencia"),
    "langcode_sample": {k: b.langcode[k] for k in sorted(b.langcode)[:5]},
    "db_keys": sorted(b.db.keys()),
    "langcode": dict(sorted(b.langcode.items())),
    "wiki_q": err(lambda: b.wiki_q["en-GI-spanglis"]),
}
b.load_wiki_q()
out["bcp47"]["wiki_q"] = b.wiki_q["en-GI-spanglis"]
out["bcp47"]["wiki_q_full"] = dict(sorted(b.wiki_q.items()))
out["bcp47"]["subdiv_fr64"] = b.subdiv["fr64"]
out["bcp47"]["val2str_list"] = b.val2str(["a", "b"])
out["bcp47"]["val2str_str"] = b.val2str("solo")
out["bcp47"]["lang2str"] = b.lang2str(
    {"language": "Catalan", "script": "Latin", "region": "Spain", "variant": "Valencian"}
)

# --- CrubadanCorpusReader -----------------------------------------------------
cr = CrubadanCorpusReader(ROOT, ["table.txt", "por-3grams.txt", "eng-3grams.txt"])
out["crubadan"] = {
    "langs": cr.langs(),
    "iso_to_crubadan": cr.iso_to_crubadan("por"),
    "iso_to_crubadan_case": cr.iso_to_crubadan("POR"),
    "iso_to_crubadan_missing": cr.iso_to_crubadan("zzz"),
    "crubadan_to_iso": cr.crubadan_to_iso("por"),
    "crubadan_to_iso_missing": cr.crubadan_to_iso("zzz"),
    "lang_freq_por": dict(cr.lang_freq("por").most_common()),
    "lang_freq_eng": dict(cr.lang_freq("eng").most_common()),
    "lang_freq_missing": err(lambda: dict(cr.lang_freq("zzz"))),
    "lang_freq_shared": cr.lang_freq("por") is cr.lang_freq("por"),
}

# --- MarkdownCorpusReader / CategorizedMarkdownCorpusReader -------------------
md = MarkdownCorpusReader(ROOT, ["doc1.md", "doc2.md"])
cmd = CategorizedMarkdownCorpusReader(ROOT, ["doc1.md", "doc2.md"])

def proj_block(b):
    return {
        "repr": repr(b),
        "str": str(b),
        "raw": b.raw,
        "words": b.words,
        "sents": [list(x) for x in b.sents],
        "paras": [[list(x) for x in s] for s in b.paras],
    }

def proj_section(s):
    d = proj_block(s)
    d["heading"] = s.heading
    d["level"] = s.level
    return d

def proj_code(c):
    d = proj_block(c)
    d["language"] = c.language
    d["lines"] = c.lines
    return d

def proj_nt(x):
    return list(x)

out["markdown"] = {
    "paras": [[list(s) for s in p] for p in md.paras()],
    "words": list(md.words()),
    "blockquotes": [proj_block(x) for x in md.paras()[:0]] ,
}
# Categorized reader is the only one with the block readers.
out["categorized_markdown"] = {
    "categories": cmd.categories(),
    "fileids": cmd.fileids(),
    "fileids_tech": cmd.fileids("tech"),
    "metadata": [m for m in cmd.metadata()],
    "blockquotes": [proj_block(x) for x in cmd.blockquotes()],
    "code_blocks": [proj_code(x) for x in cmd.code_blocks()],
    "images": [list(img) for img in cmd.images()],
    "links": [list(lnk) for lnk in cmd.links()],
    "lists": [[lst.is_ordered, lst.items] for lst in cmd.lists()],
    "sections": [proj_section(x) for x in cmd.sections()],
    "paras": [[list(s) for s in p] for p in cmd.paras()],
    "paras_tech": [[list(s) for s in p] for p in cmd.paras(categories="tech")],
    "raw_doc1": cmd.raw("doc1.md"),
    "words_news": list(cmd.words(categories=["news"])),
}

# --- framenet value/lazy containers ------------------------------------------
def proj_ad(d):
    return {"repr": repr(d), "keys": list(d.keys()), "len": len(d)}

plain = AttrDict({"a": 1, "b": "x", "c": None})
out["containers"] = {
    "attrdict_plain": proj_ad(plain),
    "attrdict_attr": plain.b,
    "attrdict_missing": err(lambda: plain.zzz),
    "attrdict_short_repr_typed": AttrDict(
        {"_type": "frame", "ID": 7, "name": "F"}
    )._short_repr(),
    "attrdict_short_repr_noid": AttrDict(
        {"_type": "lusubcorpus", "name": "S"}
    )._short_repr(),
    "attrdict_short_repr_relation": AttrDict(
        {"_type": "framerelationtype", "ID": 1, "superFrameName": "A",
         "name": "Inheritance", "subFrameName": "B"}
    )._short_repr(),
    "attrdict_any": repr(AttrDict({"_type": "odd", "ID": 3, "name": "N", "note": "short"})),
    "future_repr": err(lambda: repr(Future(lambda: AttrDict({"x": 1})))),
    "speciallist_empty": repr(SpecialList("bogus")),
    "speciallist_bogus": err(lambda: repr(SpecialList("bogus", [1]))),
    "prettylist": repr(
        PrettyList([AttrDict({"_type": "frame", "ID": i, "name": f"f{i}"}) for i in range(5)])
    ),
    "prettylist_empty": repr(PrettyList()),
    "prettydict": repr(PrettyDict({"k1": AttrDict({"_type": "frame", "ID": 1, "name": "a"}),
                                    "k2": AttrDict({"_type": "fe", "ID": 2, "name": "b"})})),
    "prettydict_break": repr(
        PrettyDict({"k1": AttrDict({"_type": "frame", "ID": 1, "name": "a"})},
                   **{"break_lines": True})
    ) if False else "skip",
}
# PrettyDict break_lines kwarg name check:
out["containers"]["prettydict_break"] = err(
    lambda: repr(
        PrettyDict({"k1": AttrDict({"_type": "frame", "ID": 1, "name": "a"})}, break_lines=True)
    )
)
out["containers"]["prettylazymap"] = repr(
    PrettyLazyMap(lambda x: AttrDict({"_type": "frame", "ID": x, "name": f"f{x}"}), [1, 2, 3])
)
out["containers"]["prettylazymap_long"] = repr(
    PrettyLazyMap(lambda x: AttrDict({"_type": "frame", "ID": x, "name": f"framename{x}"}), list(range(8)))
)
out["containers"]["prettylazyiterlist"] = repr(
    PrettyLazyIteratorList(
        iter([AttrDict({"_type": "frame", "ID": i, "name": f"f{i}"}) for i in range(6)])
    )
)
out["containers"]["prettylazyconcat"] = repr(
    PrettyLazyConcatenation(
        [
            [AttrDict({"_type": "frame", "ID": 1, "name": "a"})],
            [AttrDict({"_type": "frame", "ID": 2, "name": "b"})],
        ]
    )
)
out["containers"]["prettylazyconcat_add"] = err(
    lambda: repr(
        PrettyLazyConcatenation([[AttrDict({"_type": "frame", "ID": 1, "name": "a"})]])
        + [AttrDict({"_type": "frame", "ID": 2, "name": "b"})]
    )
)

# AttrDict _str for annotation-ish types (exercise _pretty_* paths)
sent_d = AttrDict(
    {
        "_type": "lusentence",
        "ID": 100,
        "corpID": 1,
        "docID": 2,
        "paragNo": 0,
        "sentNo": 3,
        "aPos": 4,
        "LU": AttrDict(
            {
                "_type": "lu",
                "ID": 55,
                "name": "want.v",
                "frame": AttrDict({"_type": "frame", "ID": 9, "name": "Desiring"}),
            }
        ),
        "frame": AttrDict({"_type": "frame", "ID": 9, "name": "Desiring"}),
        "annotationSet": [AttrDict({"x": 1})],
        "POS": [(0, 5, "NN"), (6, 9, "VBP")],
        "POS_tagset": "PENN",
        "GF": [],
        "PT": [(0, 9, "NP")],
        "text": "They want cake.",
        "Target": [(5, 9)],
        "FE": ([(0, 5, "Experiencer"), (10, 15, "Theme")], {"F": "NI"}),
        "_ascii": None,
    }
)
sent_d["_ascii"] = partial(_annotation_ascii, sent_d)
out["containers"]["lusentence_repr"] = err(lambda: repr(sent_d))

pos_d = AttrDict(
    {
        "_type": "posannotationset",
        "ID": 77,
        "POS_tagset": "PENN",
        "sent": AttrDict({"_type": "lusentence", "ID": 100, "text": "They want cake."}),
        "POS": [(0, 4, "PRP"), (5, 9, "VBP"), (10, 14, "NNP"), (14, 15, ".")],
    }
)
out["containers"]["pos_repr"] = err(lambda: repr(pos_d))

lu_d = AttrDict(
    {
        "_type": "lu",
        "ID": 55,
        "name": "want.v",
        "definition": "A long-ish definition that is definitely longer than sixty-five characters to trigger wrapping.",
        "frame": AttrDict({"_type": "frame", "ID": 9, "name": "Desiring"}),
        "POS": "V",
        "status": "Created",
        "totalAnnotated": 3,
        "lexemes": [AttrDict({"name": "want", "POS": "V"})],
        "semTypes": [AttrDict({"name": "State", "ID": 1})],
        "URL": "http://x/lu55",
        "subCorpus": [AttrDict({"name": "sub-b"}), AttrDict({"name": "sub-a"})],
        "exemplars": [AttrDict({"text": "s1"})],
    }
)
out["containers"]["lu_repr"] = err(lambda: repr(lu_d))

fe_d = AttrDict(
    {
        "_type": "fe",
        "ID": 12,
        "name": "Experiencer",
        "frame": AttrDict({"_type": "frame", "ID": 9, "name": "Desiring"}),
        "definition": "The being who desires.",
        "abbrev": "Exp",
        "coreType": "Core",
        "requiresFE": None,
        "excludesFE": None,
        "semType": AttrDict({"name": "Sentient", "ID": 4}),
    }
)
out["containers"]["fe_repr"] = err(lambda: repr(fe_d))

frame_d = AttrDict(
    {
        "_type": "frame",
        "ID": 9,
        "name": "Desiring",
        "URL": "http://x/frame9",
        "definition": "An Experiencer desires an Event.",
        "semTypes": [AttrDict({"name": "State", "ID": 1})],
        "frameRelations": [
            AttrDict(
                {
                    "_type": "framerelation",
                    "type": AttrDict(
                        {
                            "_type": "framerelationtype",
                            "ID": 1,
                            "superFrameName": "Desiring",
                            "name": "Inheritance",
                            "subFrameName": "Needing",
                        }
                    ),
                    "superFrameName": "Desiring",
                    "subFrameName": "Needing",
                }
            )
        ],
        "lexUnit": AttrDict(
            {
                "want.v": AttrDict({"_type": "lu", "ID": 55}),
                "desire.v": AttrDict({"_type": "lu", "ID": 56}),
            }
        ),
        "FE": AttrDict(
            {
                "Experiencer": AttrDict({"_type": "fe", "ID": 12, "coreType": "Core"}),
                "Event": AttrDict({"_type": "fe", "ID": 13, "coreType": "Peripheral"}),
            }
        ),
        "FEcoreSets": [[AttrDict({"name": "Experiencer"}), AttrDict({"name": "Event"})]],
    }
)
out["containers"]["frame_repr"] = err(lambda: repr(frame_d))

sem_d = AttrDict(
    {
        "_type": "semtype",
        "ID": 1,
        "name": "State",
        "abbrev": "Sta",
        "definition": "A state of affairs.",
        "rootType": AttrDict({"name": "Root", "ID": 0}),
        "superType": None,
        "subTypes": [AttrDict({"name": "Sub", "ID": 2})],
    }
)
out["containers"]["semtype_repr"] = err(lambda: repr(sem_d))
out["containers"]["semtype_none"] = repr(AttrDict({"_type": "semtype"}))

frt = AttrDict(
    {
        "_type": "framerelationtype",
        "ID": 1,
        "superFrameName": "Desiring",
        "name": "Inheritance",
        "subFrameName": "Needing",
    }
)
out["containers"]["frt_repr"] = repr(frt)

frel = AttrDict(
    {
        "_type": "framerelation",
        "type": frt,
        "superFrameName": "Desiring",
        "subFrameName": "Needing",
    }
)
out["containers"]["frel_repr"] = repr(frel)

ferel = AttrDict(
    {
        "_type": "ferelation",
        "type": frt,
        "frameRelation": frel,
        "superFEName": "Experiencer",
        "subFEName": "Event",
    }
)
out["containers"]["ferel_repr"] = repr(ferel)

exemplars = SpecialList(
    "luexemplars",
    [
        AttrDict(
            {
                "_type": "lusentence",
                "ID": 1,
                "text": "They want cake.",
                "LU": lu_d,
                "frame": lu_d["frame"],
            }
        ),
        AttrDict({"_type": "lusentence", "ID": 2, "text": "I desire rest.", "LU": lu_d}),
    ],
)
out["containers"]["exemplars_repr"] = err(lambda: repr(exemplars))

# norm (rte)
out["norm"] = {
    "TRUE": norm("TRUE"),
    "false": norm("false"),
    "Yes": norm("Yes"),
    "no": norm("no"),
    "bad": err(lambda: norm("maybe")),
}

# safe_parse / xpath / XMLCorpusReader
elt = safe_parse(io.StringIO("<root><a x='1'>hi<b/></a><a x='2'/></root>"))
out["xml"] = {
    "safe_parse_root": elt.getroot().tag,
    "xpath": [e.attrib.get("x") for e in xpath(elt.getroot(), "a", None)],
    "xpath_text": [e.text for e in xpath(elt.getroot(), "a", None)],
    "safe_parse_entity": err(lambda: safe_parse(io.StringIO(
        "<!DOCTYPE r [<!ENTITY x 'y'>]><r>&x;</r>"))),
}

print(json.dumps(out, sort_keys=True, default=str))
