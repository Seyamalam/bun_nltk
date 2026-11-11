import json
import sys

import nltk

assert nltk.__version__ == "3.10.3", nltk.__version__

from nltk.grammar import PCFG
from nltk.parse.pchart import (
    InsideChartParser,
    LongestChartParser,
    RandomChartParser,
    UnsortedChartParser,
)

TOY_PCFG1 = """
S -> NP VP [1.0]
NP -> Det N [0.5] | NP PP [0.25] | 'John' [0.1] | 'I' [0.15]
Det -> 'the' [0.8] | 'my' [0.2]
N -> 'man' [0.5] | 'telescope' [0.5]
VP -> VP PP [0.1] | V NP [0.7] | V [0.2]
V -> 'ate' [0.35] | 'saw' [0.65]
PP -> P NP [1.0]
P -> 'with' [0.61] | 'under' [0.39]
"""

TOY_PCFG2 = """
S    -> NP VP         [1.0]
VP   -> V NP          [.59]
VP   -> V             [.40]
VP   -> VP PP         [.01]
NP   -> Det N         [.41]
NP   -> Name          [.28]
NP   -> NP PP         [.31]
PP   -> P NP          [1.0]
V    -> 'saw'         [.21]
V    -> 'ate'         [.51]
V    -> 'ran'         [.28]
N    -> 'boy'         [.11]
N    -> 'cookie'      [.12]
N    -> 'table'       [.13]
N    -> 'telescope'   [.14]
N    -> 'hill'        [.5]
Name -> 'Jack'        [.52]
Name -> 'Bob'         [.48]
P    -> 'with'        [.61]
P    -> 'under'       [.39]
Det  -> 'the'         [.41]
Det  -> 'a'           [.31]
Det  -> 'my'          [.28]
"""

GRAMMARS = {"toy1": TOY_PCFG1, "toy2": TOY_PCFG2}
SENTS = {
    "toy1": "I saw John with my telescope",
    "toy2": "the boy saw Jack with Bob under the table with a telescope",
}


def run(kind, grammar_name, beam_size=0, seed=None):
    grammar = PCFG.fromstring(GRAMMARS[grammar_name])
    tokens = SENTS[grammar_name].split()
    if kind == "inside":
        parser = InsideChartParser(grammar, beam_size=beam_size)
    elif kind == "longest":
        parser = LongestChartParser(grammar, beam_size=beam_size)
    elif kind == "unsorted":
        parser = UnsortedChartParser(grammar, beam_size=beam_size)
    elif kind == "random":
        if seed is not None:
            import random

            random.seed(seed)
        parser = RandomChartParser(grammar, beam_size=beam_size)
    else:
        raise ValueError(kind)
    parses = [
        {"tree": p.pformat(margin=1e9), "prob": p.prob()}
        for p in parser.parse(tokens)
    ]
    return parses


if __name__ == "__main__":
    payload = json.loads(sys.stdin.read() or "{}")
    out = {}
    for name, call in payload.items():
        out[name] = run(
            call["kind"],
            call["grammar"],
            call.get("beam_size", 0),
            call.get("seed"),
        )
    print(json.dumps(out))
