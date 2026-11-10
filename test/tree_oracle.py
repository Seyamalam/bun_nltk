"""Pinned NLTK 3.10.3 oracle for the nltk.tree.tree.Tree member surface."""

import nltk
from nltk.tree import Tree

assert nltk.__version__ == "3.10.3", nltk.__version__

t = Tree.fromstring("(S (NP a b c) (VP (V d) (NP e f)))")
t.chomsky_normal_form()
assert str(t) == "(S (NP a (NP|<b-c> b c)) (VP (V d) (NP e f)))", t
t.un_chomsky_normal_form()
assert str(t) == "(S (NP a b c) (VP (V d) (NP e f)))", t

t = Tree.fromstring("(S (NP a b c) (VP (V d) (NP e f g)))")
t.chomsky_normal_form(factor="left")
assert str(t) == "(S (NP (NP|<a-b> a b) c) (VP (V d) (NP (NP|<e-f> e f) g)))", t

t = Tree.fromstring("(S (NP a b c) (VP (V d) (NP e f)))")
t.chomsky_normal_form(vertMarkov=2)
assert str(t) == "(S (NP a (NP|<b-c> b c)) (VP^<S> (V d) (NP e f)))", t

t = Tree.fromstring("(S (NP a b c d) (VP x))")
t.chomsky_normal_form(horzMarkov=1)
assert str(t) == "(S (NP a (NP|<b> b (NP|<c> c d))) (VP x))", t

t = Tree.fromstring("(A (B (C (D x))))")
t.collapse_unary()
assert str(t) == "(A (B+C (D x)))", t

t = Tree.fromstring("(A (B (C (D x))))")
t.collapse_unary(collapsePOS=True)
assert str(t) == "(A (B+C+D x))", t

t = Tree.fromstring("(TOP (S (NP x)))")
t.collapse_unary(collapseRoot=True)
assert str(t) == "(TOP+S (NP x))", t

t = Tree.fromstring("(S (NP the dog) (VP chased))")
assert t.pformat_latex_qtree() == "\\Tree [.S [.NP the dog ] [.VP chased ] ]"
assert t.pformat_latex_forest() == (
    "\\begin{forest}\n  [S [NP [the] [dog] ] [VP [chased] ] ]\n\\end{forest}"
)

t = Tree.fromstring("(S (B x) (A y) (C z))")
t.sort()
assert str(t) == "(S (A y) (B x) (C z))", t
t.sort(reverse=True)
assert str(t) == "(S (C z) (B x) (A y))", t

t = Tree.fromstring("(S a b)")
t.append("c")
assert str(t) == "(S a b c)"
assert t.index("b") == 1 and t.count("a") == 1
t.remove("a")
assert str(t) == "(S b c)"

built = Tree.fromlist([["A", "B"], "c", "d"])
assert built.label() == "['A', 'B']" and len(built) == 2 and built.leaves() == [None, None]

if __name__ == "__main__":
    print("tree oracle ok")
