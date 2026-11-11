import json
import sys

import nltk

assert nltk.__version__ == "3.10.3", nltk.__version__

from nltk.parse.featurechart import (
    FeatureChartParser,
    FeatureTopDownChartParser,
    FeatureBottomUpChartParser,
    FeatureBottomUpLeftCornerChartParser,
    demo_grammar,
)
from nltk.parse.earleychart import (
    FeatureEarleyChartParser,
    FeatureIncrementalTopDownChartParser,
    FeatureIncrementalBottomUpChartParser,
    FeatureIncrementalBottomUpLeftCornerChartParser,
)
from nltk.featstruct import FeatStruct, Variable, unify, find_variables
from nltk.grammar import FeatureGrammar

payload = json.load(sys.stdin)

GRAMMAR_TEXT = """
S  -> NP VP
PP -> Prep NP
NP -> NP PP
VP -> VP PP
VP -> Verb NP
VP -> Verb
NP -> Det[pl=?x] Noun[pl=?x]
NP -> "John"
NP -> "I"
Det -> "the"
Det -> "my"
Det[-pl] -> "a"
Noun[-pl] -> "dog"
Noun[-pl] -> "cookie"
Verb -> "ate"
Verb -> "saw"
Prep -> "with"
Prep -> "under"
"""

PARSERS = {
    "FeatureChartParser": FeatureChartParser,
    "FeatureTopDownChartParser": FeatureTopDownChartParser,
    "FeatureBottomUpChartParser": FeatureBottomUpChartParser,
    "FeatureBottomUpLeftCornerChartParser": FeatureBottomUpLeftCornerChartParser,
    "FeatureEarleyChartParser": FeatureEarleyChartParser,
    "FeatureIncrementalTopDownChartParser": FeatureIncrementalTopDownChartParser,
    "FeatureIncrementalBottomUpChartParser": FeatureIncrementalBottomUpChartParser,
    "FeatureIncrementalBottomUpLeftCornerChartParser": FeatureIncrementalBottomUpLeftCornerChartParser,
}


def norm_tree(t):
    # Labels are FeatStructNonterminals; str() gives 'NP[NUM=?x]' style.
    return str(t).replace(" ", "").replace("\n", "")


def run_parse():
    g = demo_grammar()
    out = {}
    for name, cls in PARSERS.items():
        parser = cls(g)
        trees = list(parser.parse(payload["tokens"]))
        out[name] = {"count": len(trees), "trees": sorted(norm_tree(t) for t in trees)}
    return out


def run_unify():
    cases = []
    for a, b in payload["cases"]:
        fs1 = FeatStruct(a)
        fs2 = FeatStruct(b)
        bindings = {}
        result = unify(fs1, fs2, bindings, rename_vars=True)
        cases.append(
            {
                "result": repr(result) if result is not None else None,
                "bindings": {str(k): repr(v) for k, v in sorted(bindings.items(), key=lambda kv: str(kv[0]))},
            }
        )
    return cases


def run_grammar():
    g = FeatureGrammar.fromstring(GRAMMAR_TEXT)
    from nltk.featstruct import TYPE

    lhs_prods = [str(p) for p in g.productions(lhs=g.start())]
    rhs_prods = [str(p) for p in g.productions(rhs=g.productions()[0].rhs()[0])]
    return {
        "start": repr(g.start()),
        "lhs_prods": lhs_prods,
        "rhs0": repr(g.productions()[0].rhs()[0]),
        "rhs_prods": rhs_prods,
        "n_prods": len(g.productions()),
    }


def run_vars():
    fs = FeatStruct(payload["fstruct"])
    return sorted(str(v) for v in find_variables(fs))


if payload["kind"] == "parse":
    print(json.dumps(run_parse()))
elif payload["kind"] == "unify":
    print(json.dumps(run_unify()))
elif payload["kind"] == "grammar":
    print(json.dumps(run_grammar()))
elif payload["kind"] == "vars":
    print(json.dumps(run_vars()))
