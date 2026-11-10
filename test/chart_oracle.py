import nltk
assert nltk.__version__ == "3.10.3"
from nltk.parse.chart import ChartParser, TD_STRATEGY, LC_STRATEGY, BU_STRATEGY

g = nltk.CFG.fromstring(
    """S -> NP VP
NP -> Det N | Det N PP
VP -> V NP | V NP PP
PP -> P NP
Det -> 'the' | 'a'
N -> 'man' | 'park' | 'dog'
V -> 'saw' | 'walked'
P -> 'in' | 'with'"""
)
toks = ["the", "man", "saw", "a", "dog", "in", "the", "park"]
chart = ChartParser(g).chart_parse(toks)
assert chart.num_edges() == 44
assert len(list(chart.parses(g.start()))) == 2
assert len(list(chart.select(start=0, end=8, lhs=g.start()))) == 1
e = list(chart.select(start=0, end=8, lhs=g.start()))[0]
assert len(list(chart.child_pointer_lists(e))) == 2
g2 = nltk.CFG.fromstring("S -> A B\nA -> 'a' |\nB -> 'b'")
assert ChartParser(g2).chart_parse(["a", "b"]).num_edges() == 13
assert ChartParser(g2, use_agenda=False).chart_parse(["a", "b"]).num_edges() == 13
assert ChartParser(g2, strategy=TD_STRATEGY).chart_parse(["a", "b"]).num_edges() == 11
assert ChartParser(g2, strategy=LC_STRATEGY).chart_parse(["a", "b"]).num_edges() == 6
