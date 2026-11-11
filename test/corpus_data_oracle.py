"""Pinned oracle for corpus readers against provisioned NLTK data (NLTK 3.10.3).

Exercises the real corpora locked in scripts/nltk-data-lock.json:
brown, movie_reviews, stopwords, treebank (combined/tagged/raw), words.
Prints deterministic slices so the TS side can compare without shipping the data.
"""
import json
import os
import sys

import nltk

assert nltk.__version__ == "3.10.3", "oracle requires NLTK 3.10.3"
from nltk.corpus.reader.api import CorpusReader
from nltk.corpus.reader.plaintext import PlaintextCorpusReader, CategorizedPlaintextCorpusReader
from nltk.corpus.reader.tagged import TaggedCorpusReader, CategorizedTaggedCorpusReader
from nltk.corpus.reader.wordlist import WordListCorpusReader
from nltk.corpus.reader.bracket_parse import BracketParseCorpusReader, CategorizedBracketParseCorpusReader
from nltk.corpus.reader.chunked import ChunkedCorpusReader
from nltk.corpus.reader.util import tagged_treebank_para_block_reader
from nltk.tokenize import RegexpTokenizer
from nltk.corpus.util import LazyCorpusLoader

DATA = sys.argv[1]  # NLTK data dir (e.g. .cache/nltk-data)
nltk.data.path[:] = [DATA]
CORPORA = os.path.join(DATA, "corpora")

out = {}

# --- brown: CategorizedTaggedCorpusReader (cat_file, tagset=brown) ------------
brown_root = os.path.join(CORPORA, "brown")
brown = CategorizedTaggedCorpusReader(
    brown_root, r"c[a-z]\d\d", cat_file="cats.txt", tagset="brown", encoding="ascii")
out["brown"] = {
    "n_fileids": len(brown.fileids()),
    "fileids_head": brown.fileids()[:6],
    "categories": brown.categories(),
    "news_n": len(brown.fileids("news")),
    "news_head": brown.fileids("news")[:5],
    "cats_of_ca01": brown.categories("ca01"),
    "words_head": list(brown.words("ca01"))[:40],
    "sents_head": [list(s) for s in brown.sents("ca01")][:3],
    "tagged_words_head": [list(t) for t in brown.tagged_words("ca01")][:40],
    "tagged_sents_head": [[list(t) for t in s] for s in brown.tagged_sents("ca01")][:2],
    "raw_head": brown.raw("ca01")[:200],
    "encoding": brown.encoding("ca01"),
}

# --- movie_reviews: CategorizedPlaintextCorpusReader --------------------------
mr_root = os.path.join(CORPORA, "movie_reviews")
mr = CategorizedPlaintextCorpusReader(
    mr_root, r"(?!\.).*\.txt", cat_pattern=r"(neg|pos)/.*", encoding="ascii")
fid = "pos/cv000_29590.txt"
out["movie_reviews"] = {
    "categories": mr.categories(),
    "n_fileids": len(mr.fileids()),
    "pos_n": len(mr.fileids("pos")),
    "neg_n": len(mr.fileids("neg")),
    "pos_head": mr.fileids("pos")[:3],
    "cats_of_fid": mr.categories(fid),
    "words_head": list(mr.words(fid))[:40],
    "sents_head": [list(s) for s in mr.sents(fid)][:3],
    "paras_head": [[list(s) for s in p] for p in mr.paras(fid)][:2],
    "raw_head": mr.raw(fid)[:200],
    "readme_len": len(mr.readme()),
}

# --- stopwords / words: WordListCorpusReader ----------------------------------
sw = WordListCorpusReader(os.path.join(CORPORA, "stopwords"), r"(?!README|\.).*", encoding="utf8")
out["stopwords"] = {
    "fileids": sw.fileids(),
    "english": sw.words("english"),
    "french_head": sw.words("french")[:15],
}
wl = WordListCorpusReader(os.path.join(CORPORA, "words"), r"(?!README|\.).*", encoding="ascii")
out["words"] = {
    "fileids": wl.fileids(),
    "en_head": wl.words("en")[:30],
    "en_basic": wl.words("en-basic"),
}

# --- treebank/combined: BracketParseCorpusReader ------------------------------
tb = BracketParseCorpusReader(
    os.path.join(CORPORA, "treebank/combined"), r"wsj_.*\.mrg", tagset="wsj", encoding="ascii")
parsed = list(tb.parsed_sents("wsj_0003.mrg"))[:2]
out["treebank"] = {
    "n_fileids": len(tb.fileids()),
    "fileids_head": tb.fileids()[:4],
    "parsed": [t.pformat() for t in parsed],
    "words_head": list(tb.words("wsj_0003.mrg"))[:30],
    "sents_head": [list(s) for s in tb.sents("wsj_0003.mrg")][:2],
    "tagged_sents_head": [[list(t) for t in s] for s in tb.tagged_sents("wsj_0003.mrg")][:2],
}

# --- treebank/combined: CategorizedBracketParseCorpusReader -------------------
cbp = CategorizedBracketParseCorpusReader(
    os.path.join(CORPORA, "treebank/combined"), r"wsj_.*\.mrg",
    cat_pattern=r"wsj_(00..).*", tagset="wsj", encoding="ascii")
out["cat_bracket"] = {
    "categories_head": cbp.categories()[:10],
    "tagged_sents_cat": [[list(t) for t in s] for s in cbp.tagged_sents(categories="0003")][:1],
    "parsed_sents_cat": [t.pformat() for t in cbp.parsed_sents(categories="0003")][:1],
}

# --- treebank/tagged: ChunkedCorpusReader (treebank_chunk) --------------------
tbc = ChunkedCorpusReader(
    os.path.join(CORPORA, "treebank/tagged"), r"wsj_.*\.pos",
    sent_tokenizer=RegexpTokenizer(r"(?<=/\.)\s*(?![^\[]*\])", gaps=True),
    para_block_reader=tagged_treebank_para_block_reader,
    tagset="wsj", encoding="ascii")
out["treebank_chunk"] = {
    "n_fileids": len(tbc.fileids()),
    "chunked_sents_head": [t.pformat() for t in tbc.chunked_sents("wsj_0001.pos")][:3],
    "sents_head": [list(s) for s in tbc.sents("wsj_0001.pos")][:2],
    "tagged_sents_head": [[list(t) for t in s] for s in tbc.tagged_sents("wsj_0001.pos")][:2],
    "words_head": list(tbc.words("wsj_0001.pos"))[:30],
}

# --- treebank/raw: PlaintextCorpusReader (line sent tokenizer) ----------------
tbr = PlaintextCorpusReader(
    os.path.join(CORPORA, "treebank/raw"), r"wsj_.*",
    sent_tokenizer=RegexpTokenizer(r"\n", gaps=True), encoding="ISO-8859-2")
out["treebank_raw"] = {
    "n_fileids": len(tbr.fileids()),
    "fileids_head": tbr.fileids()[:4],
    "words_head": list(tbr.words("wsj_0001"))[:30],
    "sents_head": [list(s) for s in tbr.sents("wsj_0001")][:3],
}

# --- LazyCorpusLoader against provisioned stopwords ---------------------------
lazy = LazyCorpusLoader("stopwords", WordListCorpusReader, r"(?!README|\.).*", encoding="utf8")
out["lazy"] = {
    "repr": repr(lazy),
    "english_head": list(lazy.words("english"))[:10],
    "n_fileids": len(lazy.fileids()),
}

# --- CorpusReader API surface on movie_reviews --------------------------------
api = CorpusReader(mr_root, r"(?!\.).*\.txt", encoding="ascii")
out["api"] = {
    "n_fileids": len(api.fileids()),
    "abspath_tail": str(api.abspath(fid)).split("corpora/")[-1],
    "encoding": api.encoding(fid),
    "raw_len": len(api.raw(fid)),
    "open_head": api.open(fid).read(60),
}
try:
    api.open("/etc/passwd")
    out["api"]["abs_err"] = None
except ValueError as e:
    out["api"]["abs_err"] = f"ValueError:{e}"

print(json.dumps(out, sort_keys=True))
