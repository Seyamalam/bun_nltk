import nltk
assert nltk.__version__ == "3.10.3"
from nltk.grammar import CFG, DependencyGrammar, Nonterminal, PCFG, ProbabilisticProduction, Production, induce_pcfg, nonterminals

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

dg = DependencyGrammar.fromstring("'fell' -> 'price' | 'stock'\n'slump' -> 'of' | 'the'")
assert repr(dg) == "Dependency grammar with 4 productions"
assert str(dg) == "Dependency grammar with 4 productions\n  'fell' -> 'price'\n  'fell' -> 'stock'\n  'slump' -> 'of'\n  'slump' -> 'the'"
assert dg.contains("fell", "price") and not dg.contains("fell", "the") and ("price", "of") not in dg
try:
    DependencyGrammar.fromstring("# only comments")
    raise SystemExit("should fail")
except ValueError:
    pass
try:
    PCFG(Nonterminal("S"), [ProbabilisticProduction(Nonterminal("S"), ["x"], prob=0.5)])
    raise SystemExit("should fail")
except ValueError as e:
    assert str(e) == "Productions for S do not sum to 1"
pg = PCFG.fromstring("S -> NP VP [1.0]\nNP -> Det N [0.5]\nNP -> 'dog' [0.5]\nVP -> V [1.0]\nDet -> 'the' [1.0]\nN -> 'cat' [1.0]\nV -> 'saw' [1.0]")
assert repr(pg) == "<Grammar with 7 productions>"
S, NP, VP = Nonterminal("S"), Nonterminal("NP"), Nonterminal("VP")
ind = induce_pcfg(S, [Production(S, [NP, VP]), Production(S, [NP]), Production(S, [NP, VP]), Production(NP, ["dog"])])
assert str(ind) == "Grammar with 3 productions (start state = S)\n    S -> NP VP [0.666667]\n    S -> NP [0.333333]\n    NP -> 'dog' [1.0]"
assert str(ProbabilisticProduction(S, [NP], prob=1e-7)) == "S -> NP [1e-07]"
