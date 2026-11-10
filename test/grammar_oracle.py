import nltk
assert nltk.__version__ == "3.10.3"
from nltk.grammar import CFG, Nonterminal, Production, nonterminals

g = CFG.fromstring("S -> NP VP | 'a' \nNP -> 'det' 'n' \nVP -> V \nV -> 'x'")
assert repr(g) == "<Grammar with 5 productions>"
assert g.start() == Nonterminal("S")
assert [str(p) for p in g.productions(lhs=Nonterminal("NP"))] == ["NP -> 'det' 'n'"]
assert (g.is_lexical(), g.is_nonlexical(), g.is_binarised()) == (False, False, True)
assert (g.min_len(), g.max_len()) == (1, 2)

cnf = CFG.fromstring("S -> NP VP P | 'x'").chomsky_normal_form()
assert cnf.is_chomsky_normal_form()
assert sorted(str(p) for p in cnf.productions()) == sorted(
    ["S -> NP S@$@NP", "S@$@NP -> VP P", "S -> 'x'"]
)

lc = CFG.fromstring("S -> NP VP\nNP -> D N\nD -> 'a'\nN -> 'n'\nVP -> V\nV -> 'v'")
assert sorted(str(n) for n in lc.leftcorners(Nonterminal("S"))) == ["D", "NP", "S"]
assert lc.is_leftcorner(Nonterminal("S"), "a") is True
assert lc.is_leftcorner(Nonterminal("VP"), "a") is False
assert [str(n) for n in lc.leftcorner_parents(Nonterminal("N"))] == ["N"]
try:
    lc.check_coverage(["a", "b"])
    raise SystemExit("coverage should fail")
except ValueError as e:
    assert "input words" in str(e)

assert [n.symbol() for n in nonterminals("S, NP, VP")] == ["S", "NP", "VP"]
p = Production(Nonterminal("S"), [Nonterminal("NP"), "a"])
assert str(p) == "S -> NP 'a'" and p.is_lexical() and len(p) == 2
