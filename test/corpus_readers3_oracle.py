"""Pinned oracle for batch-A corpus readers (NLTK 3.10.3)."""
import json
import os
import sys

import nltk

assert nltk.__version__ == "3.10.3", "oracle requires NLTK 3.10.3"
from nltk.corpus.reader.conll import ConllCorpusReader
from nltk.corpus.reader.bracket_parse import AlpinoCorpusReader
from nltk.corpus.reader.sinica_treebank import SinicaTreebankCorpusReader
from nltk.corpus.reader.knbc import KNBCorpusReader
from nltk.corpus.reader.chasen import ChasenCorpusReader
from nltk.corpus.reader.lin import LinThesaurusCorpusReader
from nltk.corpus.reader.toolbox import ToolboxCorpusReader
from nltk.corpus.reader.ycoe import YCOECorpusReader, YCOEParseCorpusReader, YCOETaggedCorpusReader
from nltk.corpus.reader.switchboard import SwitchboardCorpusReader
from nltk.tree import sinica_parse

ROOT = sys.argv[1]
nltk.data.path.append(ROOT)

out = {}


def err(f):
    try:
        return {"err": None, "val": f()}
    except Exception as e:
        return {"err": f"{type(e).__name__}:{str(e)[:120]}"}


def proj_tree(t):
    return t.pformat() if t is not None else None


# --- ConllCorpusReader: words/pos/chunk corpus
c = ConllCorpusReader(ROOT, r"conll3\.txt", ("words", "pos", "chunk"))
out["conll"] = {
    "words": list(c.words()),
    "sents": [list(s) for s in c.sents()],
    "tagged_words": [list(x) for x in c.tagged_words()],
    "tagged_sents": [[list(x) for x in s] for s in c.tagged_sents()],
    "iob_words": [list(x) for x in c.iob_words()],
    "iob_sents": [[list(x) for x in s] for s in c.iob_sents()],
    "chunked_sents": [t.pformat() for t in c.chunked_sents()],
    "chunked_words": [x.pformat() if hasattr(x, "pformat") else list(x) for x in c.chunked_words()],
    "bad_column": err(lambda: list(c.parsed_sents())),
}

# --- ConllCorpusReader: words/pos/tree/srl corpus
cs = ConllCorpusReader(ROOT, r"conll_srl\.txt", ("words", "pos", "tree", "srl"))
out["conll_srl"] = {
    "parsed_sents": [t.pformat() for t in cs.parsed_sents()],
    "parsed_pos": [t.pformat() for t in cs.parsed_sents(pos_in_tree=True)],
    "srl_spans": [[[(list(sp), tag) for (sp, tag) in sl] for sl in grid] for grid in cs.srl_spans()],
}
insts = list(cs.srl_instances())
out["conll_srl"]["srl_instances"] = [
    {
        "repr": repr(i), "verb": i.verb, "verb_head": i.verb_head,
        "verb_stem": i.verb_stem, "roleset": i.roleset,
        "arguments": [[list(a[0]), a[1]] for a in i.arguments],
        "pprint": i.pprint(),
    }
    for i in insts
]

# --- AlpinoCorpusReader
al = AlpinoCorpusReader(ROOT)
out["alpino"] = {
    "words": list(al.words()),
    "tagged_words": [list(x) for x in al.tagged_words()],
    "sents": [list(s) for s in al.sents()],
    "parsed_sents": [proj_tree(t) for t in al.parsed_sents()],
}

# --- SinicaTreebankCorpusReader
st = SinicaTreebankCorpusReader(ROOT, r"sinica\.txt")
out["sinica"] = {
    "words": list(st.words()),
    "sents": [list(s) for s in st.sents()],
    "tagged_sents": [[list(x) for x in s] for s in st.tagged_sents()],
    "parsed_sents": [proj_tree(t) for t in st.parsed_sents()],
    "sinica_parse": sinica_parse(
        "S(agent:NP(Head:Nhaa:X)|Head:VV2:Y|theme:NP(Head:Nac:Z))"
    ).pformat(),
}

# --- KNBCorpusReader (root-only parse works; non-root raises)
kn = KNBCorpusReader(ROOT, r"knbc1\.txt")
out["knbc"] = {
    "words": list(kn.words()),
    "sents": [list(s) for s in kn.sents()],
    "tagged_words": [list(x) for x in kn.tagged_words()],
    "parsed_sents": [proj_tree(t) for t in kn.parsed_sents()],
}
kn2 = KNBCorpusReader(ROOT, r"knbc2\.txt")
out["knbc"]["parsed_err"] = err(lambda: [proj_tree(t) for t in kn2.parsed_sents()])

# --- ChasenCorpusReader
ch = ChasenCorpusReader(ROOT, r"chasen\.txt")
out["chasen"] = {
    "words": list(ch.words()),
    "tagged_words": [list(x) for x in ch.tagged_words()],
    "sents": [list(s) for s in ch.sents()],
    "tagged_sents": [[list(x) for x in s] for s in ch.tagged_sents()],
    "paras": [[list(s) for s in p] for p in ch.paras()],
    "tagged_paras": [[[list(x) for x in s] for s in p] for p in ch.tagged_paras()],
}

# --- LinThesaurusCorpusReader
lin = LinThesaurusCorpusReader(ROOT)
out["lin"] = {
    "fileids": lin.fileids(),
    "similarity": lin.similarity("business", "enterprise"),
    "similarity_same": lin.similarity("business", "business"),
    "similarity_fid": lin.similarity("business", "enterprise", fileid="simN.lsp"),
    "similarity_missing": lin.similarity("business", "zzzz", fileid="simN.lsp"),
    "synonyms": list(lin.synonyms("business", fileid="simN.lsp")),
    "scored_synonyms": [[s, v] for s, v in lin.scored_synonyms("business", fileid="simN.lsp")],
    "contains": "business" in lin,
    "not_contains": "zzzz" in lin,
}

# --- ToolboxCorpusReader
tb = ToolboxCorpusReader(ROOT, r"toolbox\.db")
from nltk.toolbox import ToolboxData  # noqa: E402

out["toolbox"] = {
    "words": list(tb.words("toolbox.db")),
    "entries": [[e[0], [list(x) for x in e[1]]] for e in tb.entries("toolbox.db")],
    "fields": [list(f) for f in tb.fields("toolbox.db")],
    "xml": tb.xml("toolbox.db").find("record/lx").text,
}

# --- YCOE readers
y = YCOECorpusReader(ROOT)
out["ycoe"] = {
    "documents": y.documents(),
    "fileids": y.fileids(),
    "words": list(y.words()),
    "tagged_words": [list(x) for x in y.tagged_words()],
    "tagged_sents": [[list(x) for x in s] for s in y.tagged_sents()],
    "parsed_sents": [proj_tree(t) for t in y.parsed_sents()],
}

# --- SwitchboardCorpusReader
sb = SwitchboardCorpusReader(ROOT)
out["switchboard"] = {
    "words": list(sb.words()),
    "tagged_words": [list(x) for x in sb.tagged_words()],
    "turns": [{"speaker": t.speaker, "id": t.id, "words": list(t), "repr": repr(t)} for t in sb.turns()],
    "tagged_turns": [{"speaker": t.speaker, "id": t.id, "words": [list(x) for x in t]} for t in sb.tagged_turns()],
    "discourses": [[{"speaker": t.speaker, "id": t.id, "words": list(t)} for t in d] for d in sb.discourses()],
}

print(json.dumps(out, sort_keys=True))
