"""Pinned oracle for corpus reader infrastructure (NLTK 3.10.3)."""
import json
import os
import sys

import nltk

assert nltk.__version__ == "3.10.3", "oracle requires NLTK 3.10.3"
from nltk.corpus.reader.plaintext import PlaintextCorpusReader
from nltk.corpus.reader.tagged import TaggedCorpusReader
from nltk.corpus.reader.dependency import DependencyCorpusReader
from nltk.corpus.reader.wordlist import WordListCorpusReader
from nltk.corpus.reader.cmudict import CMUDictCorpusReader
from nltk.corpus.reader.bracket_parse import BracketParseCorpusReader
from nltk.corpus.reader.chunked import ChunkedCorpusReader
from nltk.corpus.reader.aligned import AlignedCorpusReader
from nltk.corpus.reader.categorized_sents import CategorizedSentencesCorpusReader
from nltk.corpus.reader.ppattach import PPAttachmentCorpusReader
from nltk.corpus.reader.pros_cons import ProsConsCorpusReader
from nltk.corpus.reader.ieer import IEERCorpusReader
from nltk.corpus.reader.comparative_sents import ComparativeSentencesCorpusReader
from nltk.corpus.reader.reviews import ReviewsCorpusReader
from nltk.corpus.reader.indian import IndianCorpusReader
from nltk.corpus.reader.twitter import TwitterCorpusReader
from nltk.corpus.reader.api import CorpusReader
from nltk.corpus.reader.util import (
    read_alignedsent_block,
    read_whitespace_block,
    tagged_treebank_para_block_reader,
    ConcatenatedCorpusView,
    StreamBackedCorpusView,
)
from nltk.tokenize import WhitespaceTokenizer
from nltk.data import SeekableUnicodeStreamReader, FileSystemPathPointer
from nltk import pathsec

ROOT = sys.argv[1]

# Authorize the synthetic corpus root for pathsec ENFORCE mode regardless of
# the ambient NLTK_DATA environment.
nltk.data.path.append(ROOT)

out = {}

# --- SeekableUnicodeStreamReader semantics
susr = SeekableUnicodeStreamReader(open(os.path.join(ROOT, "plain.txt"), "rb"), "utf-8")
out["susr"] = {
    "tell0": susr.tell(),
    "read5": susr.read(5),
    "tell5": susr.tell(),
}
susr.seek(0)
out["susr"]["readline"] = susr.readline()
susr.seek(0)
out["susr"]["readall"] = susr.read()

# --- PlaintextCorpusReader (explicit whitespace word tokenizer; sent tokenizer = line)
from nltk.tokenize import RegexpTokenizer
p = PlaintextCorpusReader(ROOT, "plain\\.txt", WhitespaceTokenizer(), RegexpTokenizer("\n", gaps=True))
out["plain"] = {
    "words": list(p.words()),
    "sents": list(p.sents()),
    "paras": list(p.paras()),
    "raw": p.raw("plain.txt"),
    "fileids": p.fileids(),
}

# --- TaggedCorpusReader
t = TaggedCorpusReader(ROOT, "tagged\\.txt")
out["tagged"] = {
    "words": list(t.words()),
    "tagged_words": [list(x) for x in t.tagged_words()],
    "sents": list(t.sents()),
    "tagged_sents": [[list(x) for x in s] for s in t.tagged_sents()],
}

# --- DependencyCorpusReader (3-col format)
d = DependencyCorpusReader(ROOT, "dep\\.tsv")
out["dep"] = {
    "words": list(d.words()),
    "tagged_words": [list(x) for x in d.tagged_words()],
    "sents": list(d.sents()),
    "tagged_sents": [[[w, tg] for w, tg in s] for s in d.tagged_sents()],
}
dg = list(d.parsed_sents())
out["dep"]["parsed_root"] = [str(g.root["address"]) for g in dg]

# --- WordListCorpusReader
w = WordListCorpusReader(ROOT, "words\\.txt")
out["wordlist"] = {"words": w.words()}

# --- CMUDictCorpusReader
c = CMUDictCorpusReader(ROOT, "cmudict")
out["cmudict"] = {"entries_head": [list(e) for e in list(c.entries())[:3]]}

# --- BracketParseCorpusReader
b = BracketParseCorpusReader(ROOT, "trees\\.mrg")
out["bracket"] = {
    "parsed": [tr.pformat() if hasattr(tr, "pformat") else str(tr) for tr in b.parsed_sents()],
    "words": list(b.words()),
    "tagged_sents": [[list(x) for x in s] for s in b.tagged_sents()],
}

# --- ChunkedCorpusReader
ch = ChunkedCorpusReader(ROOT, "chunks\\.txt")
out["chunked"] = {
    "chunked_sents": [tr.pformat() for tr in ch.chunked_sents()],
    "words": list(ch.words()),
    "tagged_words": [list(x) for x in ch.tagged_words()],
}

# --- AlignedCorpusReader: read_alignedsent_block IndexError at EOF (pinned quirk)
al = AlignedCorpusReader(ROOT, "aligned\\.txt")
try:
    list(al.aligned_sents())
    out["aligned"] = {"err": None}
except IndexError as e:
    out["aligned"] = {"err": f"IndexError:{e}"}

# --- ConcatenatedCorpusView across two corpus files
v1 = StreamBackedCorpusView(os.path.join(ROOT, "plain.txt"), read_whitespace_block, encoding="utf-8")
v2 = StreamBackedCorpusView(os.path.join(ROOT, "tagged.txt"), read_whitespace_block, encoding="utf-8")
ccv = ConcatenatedCorpusView([v1, v2])
out["concat"] = {
    "len": len(ccv),
    "all": list(ccv),
    "get3": ccv[3],
    "getneg": ccv[-1],
    "slice": list(ccv[2:5]),
}

# --- tagged_treebank_para_block_reader on =====-separated file
tb = open(os.path.join(ROOT, "treebank_para.txt"), "rb")
tbs = SeekableUnicodeStreamReader(tb, "utf-8")
out["ttb_blocks"] = []
while True:
    block = tagged_treebank_para_block_reader(tbs)
    if not block:
        break
    out["ttb_blocks"].append(block)
tbs.close()

# --- CategorizedSentencesCorpusReader (default tokenizers; blank line pins the
# empty-sentence quirk: WhitespaceTokenizer().tokenize("\n") -> [] appended)
cs = CategorizedSentencesCorpusReader(
    ROOT, r"pol\.(neg|pos)", cat_pattern=r"pol\.(neg|pos)", encoding="utf-8"
)
out["catsents"] = {
    "categories": cs.categories(),
    "sents": [list(s) for s in cs.sents()],
    "sents_neg": [list(s) for s in cs.sents(categories="neg")],
    "words_pos": list(cs.words(categories="pos")),
    "fileids_pos": cs.fileids(categories="pos"),
}

# --- PPAttachmentCorpusReader: tuples + PPAttachment objects
pp = PPAttachmentCorpusReader(ROOT, "pp\\.txt")
out["ppattach"] = {
    "tuples": [list(t) for t in pp.tuples("pp.txt")],
    "attachments": [
        {"sent": a.sent, "verb": a.verb, "noun1": a.noun1, "prep": a.prep,
         "noun2": a.noun2, "attachment": a.attachment, "repr": repr(a)}
        for a in pp.attachments("pp.txt")
    ],
}

# --- ProsConsCorpusReader (categorized, WordPunctTokenizer default)
pc = ProsConsCorpusReader(
    ROOT, r"Integrated(Cons|Pros)\.txt", cat_pattern=r"Integrated(Cons|Pros)\.txt",
    encoding="ISO-8859-2"
)
out["pros_cons"] = {
    "categories": pc.categories(),
    "sents": [list(s) for s in pc.sents()],
    "sents_cons": [list(s) for s in pc.sents(categories="Cons")],
    "words_pros": list(pc.words(categories="Pros")),
}

# --- IEERCorpusReader: docs() raw <DOC> blocks
ie = IEERCorpusReader(ROOT, "ieer\\.txt")
out["ieer"] = {"docs": list(ie.docs())}

# --- ComparativeSentencesCorpusReader
cmp_reader = ComparativeSentencesCorpusReader(ROOT, "comp\\.txt")
out["comparative"] = {
    "comparisons": [
        {"text": c.text, "comp_type": c.comp_type, "entity_1": c.entity_1,
         "entity_2": c.entity_2, "feature": c.feature, "keyword": c.keyword}
        for c in cmp_reader.comparisons()
    ],
    "keywords": sorted(cmp_reader.keywords()),
    "keywords_readme": cmp_reader.keywords_readme(),
    "sents": [list(s) for s in cmp_reader.sents()],
    "words": list(cmp_reader.words()),
}

# --- ReviewsCorpusReader (WordPunctTokenizer default)
rv = ReviewsCorpusReader(ROOT, "reviews\\.txt")
out["reviews"] = {
    "features": [list(f) for f in rv.features()],
    "reviews": [
        {"title": r.title,
         "lines": [{"sent": rl.sent, "features": [list(f) for f in rl.features],
                    "notes": rl.notes} for rl in r.review_lines]}
        for r in rv.reviews()
    ],
    "sents": [list(s) for s in rv.sents()],
    "words": list(rv.words()),
}

# --- IndianCorpusReader (tagset='unknown', sep '_')
ind = IndianCorpusReader(ROOT, "indian\\.pos", tagset="unknown", encoding="utf8")
out["indian"] = {
    "words": list(ind.words()),
    "tagged_words": [list(t) for t in ind.tagged_words()],
    "sents": [list(s) for s in ind.sents()],
    "tagged_sents": [[list(t) for t in s] for s in ind.tagged_sents()],
}

# --- TwitterCorpusReader (TweetTokenizer default)
tw = TwitterCorpusReader(ROOT, "tweets\\.json")
out["twitter"] = {
    "docs": list(tw.docs()),
    "strings": list(tw.strings()),
    "tokenized": [list(t) for t in tw.tokenized()],
}
try:
    TwitterCorpusReader(ROOT, "empty\\.json")
    out["twitter_empty"] = {"err": None}
except ValueError as e:
    out["twitter_empty"] = {"err": str(e).split(":")[-1].strip()[:20]}

# --- pathsec: out-of-root corpus raises PermissionError
try:
    CorpusReader("/tmp/definitely-not-allowed", ".*")
    out["pathsec"] = {"err": None}
except PermissionError as e:
    out["pathsec"] = {"err": "PermissionError"}
except Exception as e:
    out["pathsec"] = {"err": type(e).__name__}

# --- data.find on existing resource
try:
    ptr = nltk.data.find("corpora")
    out["find_corpora"] = {"type": type(ptr).__name__}
except LookupError:
    out["find_corpora"] = {"type": "LookupError"}

print(json.dumps(out, sort_keys=True))
