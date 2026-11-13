"""Pinned oracle for the final-gaps batch (NLTK 3.10.3).

Covers: nltk.sem.boxer pure DRS family (parsers + interpreters +
_parse_to_drs_dict), nltk.sem.chat80 (records/cities2table/sql_query/
sql_demo/main/vocab + sql0.fcfg English->SQL), nltk.parse stepping
parsers (trace strings + step sequences), TestGrammar, and the pure
nltk.parse.corenlp.transform.
"""
import contextlib
import io
import json
import os
import sqlite3
import sys
import tempfile

import nltk

assert nltk.__version__ == "3.10.3", "oracle requires NLTK 3.10.3"
from nltk import CFG
from nltk.parse.corenlp import transform
from nltk.parse.recursivedescent import SteppingRecursiveDescentParser
from nltk.parse.shiftreduce import SteppingShiftReduceParser
from nltk.parse.util import TestGrammar
from nltk.sem import chat80
from nltk.sem import boxer as bx

out = {}


def err(f):
    try:
        return {"err": None, "val": f()}
    except Exception as e:
        return {"err": f"{type(e).__name__}:{str(e)[:200]}", "val": None}


def canon(d):
    """Deterministic serialization of an AbstractBoxerDrs (set-order-free)."""
    if isinstance(d, bx.BoxerDrs):
        return [
            "imp" if d.consequent is not None else "drs",
            sorted(str(r) for r in d.refs),
            [canon(c) for c in d.conds],
            canon(d.consequent) if d.consequent is not None else None,
        ]
    if isinstance(d, bx.BoxerNot):
        return ["not", canon(d.drs)]
    disc = str(d.discourse_id)
    si = repr(d.sent_index)
    wi = list(d.word_indices)
    if isinstance(d, bx.BoxerWhq):
        return ["whq", disc, si, wi, list(d.ans_types), canon(d.drs1), str(d.variable), canon(d.drs2)]
    if isinstance(d, bx.BoxerOr):
        return ["or", disc, si, wi, canon(d.drs1), canon(d.drs2)]
    if isinstance(d, bx.BoxerProp):
        return ["prop", disc, si, wi, str(d.var), canon(d.drs)]
    if isinstance(d, bx.BoxerPred):
        return ["pred", disc, si, wi, str(d.var), d.name, d.pos, d.sense]
    if isinstance(d, bx.BoxerNamed):
        return ["named", disc, si, wi, str(d.var), d.name, d.type, str(d.sense)]
    if isinstance(d, bx.BoxerRel):
        return ["rel", disc, si, wi, str(d.var1), str(d.var2), d.rel, d.sense]
    if isinstance(d, bx.BoxerEq):
        return ["eq", disc, si, wi, str(d.var1), str(d.var2)]
    if isinstance(d, bx.BoxerCard):
        return ["card", disc, si, wi, str(d.var), d.value, d.type]
    return ["??", repr(d)]


# ---------------------------------------------------------------------------
# boxer
# ---------------------------------------------------------------------------
BOXER_INPUTS = [
    "drs([[1000,1001]:x1, [1002]:e2], [[1000,1001]:pred(x1, dog, n, 0), [1002]:rel(e2, x1, agent, 0)])",
    "drs([[1001]:x1], [[10001,2001,15001]:pred(x1, run, v, 0)])",
    "drs([[1001]:x1, [1002]:x2], [[1001]:named(x1, john, per, 0), [1002]:pred(x2, dog, n, 0), [1003]:eq(x1, x2), [1004]:card(x2, 2, ge), [1005]:prop(p1, drs([[1006]:x3], [[1006]:pred(x3, cat, n, 0)])), [1007]:not(drs([[1008]:x4], [[1008]:pred(x4, fish, n, 0)]))])",
    "merge(drs([[1001]:x1], [[1001]:pred(x1, dog, n, 0)]), drs([[1002]:x2], [[1002]:pred(x2, cat, n, 0)]))",
    "drs([[1001]:x1], [[1002]:or(drs([[1003]:x2], [[1003]:pred(x2, dog, n, 0)]), drs([[1004]:x3], [[1004]:pred(x3, cat, n, 0)])), [1005]:imp(drs([[1006]:x4], [[1006]:pred(x4, dog, n, 0)]), drs([[1007]:x5], [[1007]:pred(x5, animal, n, 0)]))])",
    "drs([[1001]:x1], [[1001]:timex(x1, date([]: (+), []:'XXXX', [1004]:'04', []:'XX'))])",
    "drs([[1001]:x1], [[1001]:whq([des:wh num:cou], drs([[1002]:x2], [[1002]:pred(x2, dog, n, 0)]), x2, drs([[1003]:x3], [[1003]:pred(x3, run, v, 0)]))])",
    "drs([[-1]:x1], [[-1]:pred(x1, dog, n, 0)])",
    "alfa(def, drs([[1001]:x1], [[1001]:pred(x1, dog, n, 0)]), drs([[1002]:x2], [[1002]:pred(x2, cat, n, 0)]))",
    "drs([[1001]:x1], [[1001]:duplex(whq, drs([[1002]:x2], [[1002]:pred(x2, dog, n, 0)]), x2, drs([[1003]:x3], [[1003]:pred(x3, run, v, 0)]))])",
]


def parse_case(s):
    parsed = bx.BoxerOutputDrsParser().parse(s)
    return {
        "canon": err(lambda: canon(parsed)),
        "variables": err(lambda: [sorted(str(v) for v in t) for t in parsed.variables()]),
        "variable_types": err(lambda: sorted((k, v) for k, v in parsed.variable_types().items())),
        "atoms": err(lambda: sorted(repr(a) for a in parsed.atoms())),
        "interpret": err(lambda: str(bx.NltkDrtBoxerDrsInterpreter().interpret(parsed))),
        "interpret_occur": err(lambda: str(bx.NltkDrtBoxerDrsInterpreter(occur_index=True).interpret(parsed))),
        "passthrough": err(lambda: canon(bx.PassthroughBoxerDrsInterpreter().interpret(parsed))),
        "clean": err(lambda: canon(parsed.clean())),
        "renumber": err(lambda: canon(parsed.renumber_sentences(lambda i: i + 10 if i is not None else None))),
        "reparse": err(lambda: canon(bx.BoxerDrsParser().parse(repr(parsed)))),
        "reparse_disc": err(lambda: canon(bx.BoxerDrsParser("doc7").parse(repr(parsed)))),
    }


out["boxer"] = [err(lambda s=s: parse_case(s)) for s in BOXER_INPUTS]
out["boxer_errors"] = [
    err(lambda: bx.BoxerOutputDrsParser().parse("drs([[1001]:x1], [[1001]:bogus(x1, dog, n, 0)])")),
    err(lambda: bx.BoxerOutputDrsParser().parse("drs([[1001]:x1], [[1001]:timex(x1, time([1018]:'18', []:'XX', []:'XX'))])")),
    err(lambda: bx.BoxerOutputDrsParser().parse("drs([[1001]:q1], [[1001]:pred(q1, dog, n, 0)])")),
    err(lambda: bx.BoxerOutputDrsParser().parse("bogus")),
    err(lambda: bx.BoxerDrsParser().parse("bogus(x)")),
]

# _parse_to_drs_dict (pure reader; interpreter attached like Boxer does)
def drs_dict_case(boxer_out, use_disc_id):
    b = bx.Boxer.__new__(bx.Boxer)
    b._boxer_drs_interpreter = bx.NltkDrtBoxerDrsInterpreter()
    d = b._parse_to_drs_dict(boxer_out, use_disc_id)
    return sorted((k, str(v)) for k, v in d.items())


out["drs_dict"] = [
    err(lambda: drs_dict_case(
        b"id('wsj.1',1).\nsem(1,[x1],drs([[1001,1002]:x1, [1003]:e2], [[1001,1002]:pred(x1, dog, n, 0), [1003]:rel(e2, x1, agent, 0)])).\n",
        False)),
    err(lambda: drs_dict_case(
        b"id(doc5,2).\nsem(2,[],drs([[1001]:x1],[[1001]:named(x1, john, per, 0)])).\n",
        True)),
]

# ---------------------------------------------------------------------------
# chat80
# ---------------------------------------------------------------------------
records = chat80._str2records("cities.pl", "city")
out["chat80_records"] = {"n": len(records), "first": records[0], "last": records[-1], "sample": records[10:13]}

tmpdir = tempfile.mkdtemp(prefix="chat80-")
dbpath = os.path.join(tmpdir, "city.db")
buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    chat80.cities2table("cities.pl", "city", dbpath, verbose=True, setup=True)
out["cities2table_verbose"] = buf.getvalue().splitlines()[:4] + [buf.getvalue().splitlines()[-1]]

con = sqlite3.connect(dbpath)
out["city_table_rows"] = list(con.execute("SELECT * FROM city_table ORDER BY City"))[:5]
out["city_table_count"] = con.execute("SELECT count(*) FROM city_table").fetchone()[0]
out["city_query_china"] = list(con.execute("SELECT City, Population FROM city_table WHERE Country=\"china\""))
con.close()

out["sql_query"] = err(lambda: [list(r) for r in chat80.sql_query("corpora/city_database/city.db", "SELECT City, Population FROM city_table WHERE Population > 3000 ORDER BY Population DESC")])
out["sql_query_err"] = err(lambda: chat80.sql_query("corpora/city_database/city.db", "SELECT bogus FROM nope_table"))

buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    chat80.sql_demo()
out["sql_demo"] = buf.getvalue().splitlines()

cmap = chat80.process_bundle(chat80.rels)
out["concepts_vocab"] = sorted((c.arity, c.prefLabel) for c in cmap.values())
out["concept_city"] = str(cmap["city"])
out["concept_border"] = str(cmap["border"])

buf = io.StringIO()
_argv = sys.argv
try:
    sys.argv = ["chat80.py", "-v"]
    with contextlib.redirect_stdout(buf):
        try:
            chat80.main()
        except SystemExit as e:
            out["main_exit_code"] = e.code
finally:
    sys.argv = _argv
out["main_vocab_lines"] = buf.getvalue().splitlines()

# English -> SQL via the book's sql0.fcfg
cp = chat80  # silence linter; real parser below
from nltk import load_parser as _lp

_sql_cp = _lp("grammars/book_grammars/sql0.fcfg")


def en2sql(q):
    trees = list(_sql_cp.parse(q.split()))
    if not trees:
        return None
    answer = [s for s in trees[0].label()["SEM"] if s]
    return " ".join(answer)


out["en2sql"] = {q: err(lambda q=q: en2sql(q)) for q in [
    "What cities are located in China",
    "What cities are in China",
    "Which cities are in Greece",
    "What countries are in Europe",
]}

# rows those SQL strings produce on city.db
def run_sql(q):
    try:
        trees = list(_sql_cp.parse(q.split()))
        if not trees:
            return None
        sql = " ".join(s for s in trees[0].label()["SEM"] if s)
        return [list(r) for r in chat80.sql_query("corpora/city_database/city.db", sql)]
    except Exception as e:
        return f"{type(e).__name__}:{str(e)[:80]}"


out["en2sql_rows"] = {q: run_sql(q) for q in ["What cities are located in China", "Which cities are in Greece"]}

# ---------------------------------------------------------------------------
# stepping parsers
# ---------------------------------------------------------------------------
RD_GRAMMAR = """S -> NP VP
NP -> Det N | Det N PP
VP -> V NP | V NP PP
PP -> P NP
NP -> 'I'
N -> 'man' | 'park' | 'telescope' | 'dog'
Det -> 'the' | 'a'
P -> 'in' | 'with'
V -> 'saw'"""

SR_GRAMMAR = """S -> NP VP
NP -> 'I' | Det N
Det -> 'a'
N -> 'man'
VP -> V NP
V -> 'saw'"""

SENT = "I saw a man".split()


def rd_case(trace):
    g = CFG.fromstring(RD_GRAMMAR)
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        p = SteppingRecursiveDescentParser(g, trace=trace)
        p.initialize(list(SENT))
        steps = []
        while True:
            r = p.step()
            steps.append(str(r) if not isinstance(r, bool) else str(r))
            if r is None:
                break
        parses = [str(t) for t in p.parses()]
    return {"trace": buf.getvalue(), "steps": steps, "parses": parses}


out["rd"] = {str(t): rd_case(t) for t in (1, 2, 3)}

# interactive accessors mid-run
def rd_state():
    g = CFG.fromstring(RD_GRAMMAR)
    p = SteppingRecursiveDescentParser(g)
    p.initialize(list(SENT))
    p.expand()
    return {
        "frontier": [list(f) for f in p.frontier()],
        "tree": str(p.tree()),
        "remaining": list(p.remaining_text()),
        "expandable": [str(x) for x in p.expandable_productions()],
        "untried": [str(x) for x in p.untried_expandable_productions()],
        "untried_match": p.untried_match(),
        "complete": p.currently_complete(),
    }


out["rd_state"] = rd_state()


def sr_case(trace):
    g = CFG.fromstring(SR_GRAMMAR)
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        p = SteppingShiftReduceParser(g, trace=trace)
        p.initialize(list(SENT))
        steps = []
        while True:
            r = p.step()
            steps.append(str(r) if not isinstance(r, bool) else str(r))
            if r is False:
                break
        parses = [str(t) for t in p.parses()]
    return {"trace": buf.getvalue(), "steps": steps, "parses": parses}


out["sr"] = {str(t): sr_case(t) for t in (1, 2)}


def sr_trace3():
    g = CFG.fromstring(SR_GRAMMAR)
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        p = SteppingShiftReduceParser(g, trace=3)
        p.initialize(list(SENT))
        while True:
            r = p.step()
            if r is False:
                break
    return buf.getvalue()


out["sr_trace3"] = err(sr_trace3)


def sr_undo():
    g = CFG.fromstring(SR_GRAMMAR)
    p = SteppingShiftReduceParser(g)
    p.initialize(list(SENT))
    p.shift()
    p.reduce()
    stack1 = [str(x) for x in p.stack()]
    red = [str(x) for x in p.reducible_productions()]
    p.undo()
    stack2 = [str(x) for x in p.stack()]
    return {"after_reduce": stack1, "reducible": red, "after_undo": stack2, "remaining": list(p.remaining_text())}


out["sr_state"] = sr_undo()

# ---------------------------------------------------------------------------
# TestGrammar
# ---------------------------------------------------------------------------
with tempfile.NamedTemporaryFile("w", suffix=".cfg", delete=False, dir=nltk.data.path[0]) as f:
    f.write(SR_GRAMMAR)
    tgrammar_path = f.name


def tg_case(suite, show=False):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        tg = TestGrammar("file://" + tgrammar_path, suite)
        tg.run(show_trees=show)
    return buf.getvalue()


out["testgrammar_ok"] = err(lambda: tg_case([
    {"doc": "grammar tests", "accept": ["I saw a man"], "reject": ["man saw", "saw"]},
]))
out["testgrammar_show"] = err(lambda: tg_case([
    {"doc": "show", "accept": ["I saw a man"], "reject": ["man"]},
], show=True))
out["testgrammar_fail_accept"] = err(lambda: tg_case([
    {"doc": "bad", "accept": ["I saw"], "reject": ["man"]},
]))
out["testgrammar_fail_reject"] = err(lambda: tg_case([
    {"doc": "bad", "accept": ["I saw a man"], "reject": ["I saw a man"]},
]))
out["testgrammar_unbound"] = err(lambda: tg_case([
    {"doc": "nobind", "accept": ["I saw a man"], "reject": []},
]))

# ---------------------------------------------------------------------------
# corenlp.transform (pure)
# ---------------------------------------------------------------------------
SENTENCE = {
    "basicDependencies": [
        {"dep": "ROOT", "governor": 0, "dependent": 2},
        {"dep": "nsubj", "governor": 2, "dependent": 1},
        {"dep": "dobj", "governor": 2, "dependent": 4},
        {"dep": "det", "governor": 4, "dependent": 3},
    ],
    "tokens": [
        {"index": 1, "word": "Dogs", "lemma": "dog", "pos": "NNS", "characterOffsetBegin": 0},
        {"index": 2, "word": "run", "lemma": "run", "pos": "VBP"},
        {"index": 3, "word": "the", "lemma": "the", "pos": "DT"},
        {"index": 4, "word": "park", "lemma": "park", "pos": "NN"},
    ],
}
out["transform"] = [list(t) for t in transform(SENTENCE)]

os.unlink(tgrammar_path)
print(json.dumps(out, sort_keys=True))
