"""Oracle for nltk.sem.cooper_storage (NLTK 3.10.3).

Pins CooperStore init/s_retrieve (trace, permutations, error paths) and
parse_with_bindops end-to-end on the real book_grammars/storage.fcfg, which
exercises FeatureValueConcat, FeatureValueTuple, <> logic values, and
InstantiateVarsChart @var renaming inside expressions.
"""

import io
import json
import os
import sys

import nltk

assert nltk.__version__ == "3.10.3"

from nltk.sem.cooper_storage import CooperStore
from nltk.sem.logic import Expression
from nltk.featstruct import FeatStruct

OUT = {}

# Real book_grammars/storage.fcfg (nltk_data), embedded so the test is
# self-contained — the TS side embeds the same text.
STORAGE_FCFG = r"""
## Natural Language Toolkit: storage.fcfg
##
## Feature-based grammar that implements Cooper storage by dividing the
## semantics for each phrase into two pieces: the core semantics
## ('SEM','CORE') and a sequence of binding operators ('SEM','STORE').
## Each binding operator is encoded as a logic term <bo(quant, var)>,
## where <quant> is a quantifier expression and the individual variable
## <@var> specifies the 'address' of the quantifier in the core
## semantics.  and <predicate> is a predicate describing that variable.

## In order for this grammar to generate the correct results, all
## variables of the form <@var> must be instantiated (i.e., replaced
## by unique new variables) whenever they are used.  This can be
## accomplished by using the InstantiateVarsChart class when parsing.
## 
## Author: Edward Loper <edloper@gradient.cis.upenn.edu>,
##         Ewan Klein <ewan@inf.ed.ac.uk>
##         Robin Cooper <robin.cooper@ling.gu.se>
## URL: <http://nltk.sourceforge.net>
## For license information, see LICENSE.TXT

%start S

S[SEM=[CORE=<?vp(?subj)>, STORE=(?b1+?b2)]] -> NP[SEM=[CORE=?subj, STORE=?b1]] VP[SEM=[CORE=?vp, STORE=?b2]]

VP[SEM=?s] -> IV[SEM=?s]
VP[SEM=[CORE=<?v(?obj)>, STORE=(?b1+?b2)]] -> TV[SEM=[CORE=?v, STORE=?b1]] NP[SEM=[CORE=?obj, STORE=?b2]]
VP[SEM=[CORE=<?v(?pp)(?obj)>, STORE=(?b1+?b2+?b3)]] -> DTV[SEM=[CORE=?v, STORE=?b1]] NP[SEM=[CORE=?obj, STORE=?b2]] PP[+TO, SEM=[CORE=?pp, STORE=?b3]]  

NP[SEM=[CORE=<@x>, STORE=((<bo(?det(?n),@x)>)+?b1+?b2)]] -> Det[SEM=[CORE=?det, STORE=?b1]] N[SEM=[CORE=?n, STORE=?b2]]

PP[+TO, SEM=[CORE=?np, STORE=?b1]] -> P NP[SEM=[CORE=?np, STORE=?b1]]

# Lexical items:
Det[SEM=[CORE=<\Q P.exists x.(Q(x) & P(x))>, STORE=(/)]] -> 'a'
Det[SEM=[CORE=<\Q P.all x.(Q(x) implies P(x))>, STORE=(/)]] -> 'every'

N[SEM=[CORE=<dog>, STORE=(/)]] -> 'dog' 
N[SEM=[CORE=<bone>, STORE=(/)]] -> 'bone' 
N[SEM=[CORE=<girl>, STORE=(/)]] -> 'girl' 
N[SEM=[CORE=<man>, STORE=(/)]] -> 'man'

IV[SEM=[CORE=<\x.smile(x)>, STORE=(/)]] -> 'smiles' 
IV[SEM=[CORE=<\x.walk(x)>, STORE=(/)]] -> 'walks'

TV[SEM=[CORE=<\y x.feed(x,y)>, STORE=(/)]] -> 'feeds' 
TV[SEM=[CORE=<\y x.chase(x,y)>, STORE=(/)]] -> 'chases'

DTV[SEM=[CORE=<\z y x.give(x,y,z)>, STORE=(/)]] -> 'gives' 

NP[SEM=[CORE=<@x>, STORE=(<bo(\P.P(angus),@x)>)]] -> 'Angus' 
NP[SEM=[CORE=<@x>, STORE=(<bo(\P.P(cyril),@x)>)]] -> 'Cyril'

P[+TO] -> 'to'
"""

CORE = Expression.fromstring("chase(g,d)")
B1 = Expression.fromstring(r"bo(\P.all x.(man(x) -> P(x)),z1)")
B2 = Expression.fromstring(r"bo(\P.exists y.(dog(y) & P(y)),z2)")
B3 = Expression.fromstring(r"bo(\P.exists w.(bone(w) & P(w)),z3)")


def capture(fn):
    buf = io.StringIO()
    old = sys.stdout
    sys.stdout = buf
    try:
        fn()
    finally:
        sys.stdout = old
    return buf.getvalue()


def cs_case(core, store, trace=False):
    fs = FeatStruct({"CORE": core, "STORE": store})
    cs = CooperStore(fs)
    if trace:
        out = capture(lambda: cs.s_retrieve(trace=True))
        return {"readings": [str(r) for r in cs.readings], "trace": out.splitlines()}
    cs.s_retrieve()
    return {"readings": [str(r) for r in cs.readings]}


# Direct CooperStore cases (plain-list STORE — the sliceable kind).
OUT["two"] = cs_case(CORE, [B1, B2])
OUT["two_trace"] = cs_case(CORE, [B1, B2], trace=True)
OUT["one"] = cs_case(CORE, [B1])
OUT["three"] = cs_case(CORE, [B1, B2, B3])
OUT["empty"] = cs_case(CORE, [])

# FeatList STORE: oracle _permute slices -> TypeError.
from nltk.featstruct import FeatStructReader
fs_flist = FeatStructReader().fromstring("[CORE=<chase(g,d)>, STORE=[<bo(P,z1)>]]")
cs_flist = CooperStore(fs_flist)
OUT["featlist_err"] = None
try:
    cs_flist.s_retrieve()
except TypeError as e:
    OUT["featlist_err"] = str(e)

# Non-storage structure: constructor prints diagnostic; s_retrieve -> AttributeError.
OUT["diag"] = capture(lambda: CooperStore(FeatStruct({"CORE": CORE}))).strip()
cs_bad = CooperStore(FeatStruct({"CORE": CORE}))
OUT["attr_err"] = None
try:
    cs_bad.s_retrieve()
except AttributeError as e:
    OUT["attr_err"] = str(e)

# parse_with_bindops end-to-end on the real storage.fcfg.
data_dir = os.environ.get(
    "NLTK_DATA", os.path.join(os.path.dirname(__file__), "..", ".cache", "nltk-data")
)
data_dir = os.path.abspath(data_dir)
os.makedirs(os.path.join(data_dir, "grammars"), exist_ok=True)
gpath = os.path.join(data_dir, "grammars", "cooper_storage_test.fcfg")
with open(gpath, "w") as f:
    f.write(STORAGE_FCFG)

from nltk.sem.cooper_storage import parse_with_bindops

OUT["bindops"] = {}
for sent in ("every girl chases a dog", "a man gives a bone to every dog", "Angus smiles"):
    trees = parse_with_bindops(sent, grammar="grammars/cooper_storage_test.fcfg")
    entry = {"num_trees": len(trees), "analyses": []}
    for t in trees:
        cs = CooperStore(t.label()["SEM"])
        cs.s_retrieve()
        entry["analyses"].append({
            "core": str(cs.core),
            "store": str(cs.store),
            "readings": [str(r) for r in cs.readings],
        })
    OUT["bindops"][sent] = entry

OUT["nltk"] = nltk.__version__
print(json.dumps(OUT))
