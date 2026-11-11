import json
import sys

import nltk

assert nltk.__version__ == "3.10.3", nltk.__version__

from nltk import CFG
from nltk.parse.chart import demo_grammar
from nltk.parse.generate import generate

GRAMMAR = """
S -> NP VP
NP -> Det N
NP -> 'John'
VP -> V NP
Det -> 'the' | 'a'
N -> 'man' | 'dog'
V -> 'saw' | 'walked'
"""


def main():
    kind = sys.argv[1]
    g = CFG.fromstring(GRAMMAR)
    if kind == "generate":
        print(json.dumps({
            "depth3": [" ".join(s) for s in generate(g, depth=3)],
            "n3": [" ".join(s) for s in generate(g, depth=5, n=3)],
            "n0": [" ".join(s) for s in generate(g, depth=5, n=0)],
        }))
    elif kind == "demo_grammar":
        dg = demo_grammar()
        print(json.dumps({
            "start": str(dg.start()),
            "productions": [str(p) for p in dg.productions()],
        }))


if __name__ == "__main__":
    main()
