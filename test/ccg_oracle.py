"""Oracle pins for the nltk.ccg family (NLTK 3.10.3, Python 3.14.4).

Run: .venv/bin/python test/ccg_oracle.py
Outputs are pinned verbatim in test/ccg.test.ts.
"""

import io
import warnings
from contextlib import redirect_stdout, redirect_stderr

import nltk

assert nltk.__version__ == "3.10.3"

from nltk.ccg.lexicon import fromstring, parseLexicon
from nltk.ccg.api import CCGVar, Direction, PrimitiveCategory, FunctionalCategory
from nltk.ccg.combinator import (
    ForwardApplication, BackwardApplication, ForwardComposition, BackwardComposition,
    BackwardBx, ForwardSubstitution, BackwardSx, ForwardT, BackwardT,
    forwardOnly, backwardOnly, bothForward, bothBackward, crossedDirs,
    backwardBxConstraint, forwardSConstraint, backwardSxConstraint,
    forwardTConstraint, backwardTConstraint, innermostFunction,
)
from nltk.ccg.chart import (
    CCGChartParser, ApplicationRuleSet, DefaultRuleSet, demo, printCCGDerivation,
)


def capture(fn, *args, **kw):
    buf = io.StringIO()
    with redirect_stdout(buf):
        fn(*args, **kw)
    return buf.getvalue()


DEMO_LEX = """
:- S,NP,N
I => NP {I}
you => NP {you}
cook => S\\NP {\\x.cook(x)}
eat => (S\\NP)/NP {\\x y.eat(x,y)}
mushrooms => NP {mushrooms}
"""

print("== categories ==")
lex = fromstring(DEMO_LEX, include_semantics=True)
for w in ["I", "cook", "eat"]:
    print([str(t) for t in lex.categories(w)])
print(str(lex.categories("I")[0].categ()), lex.categories("I")[0].semantics())

print("== semantic derivations ==")
p = CCGChartParser(lex, ApplicationRuleSet)
for t in p.parse("I cook".split()):
    printCCGDerivation(t)
for t in p.parse("I eat mushrooms".split()):
    printCCGDerivation(t)

print("== combinator results (on demo categories) ==")
NP = PrimitiveCategory("NP")
S = PrimitiveCategory("S")
N = PrimitiveCategory("N")
snp = FunctionalCategory(S, NP, Direction("\\", ["_"]))
vpn = FunctionalCategory(snp, NP, Direction("/", ["_"]))
nn = FunctionalCategory(N, N, Direction("\\", ["_"]))
print("fwd>", [str(c) for c in ForwardApplication.combine(vpn, NP)])
print("fwd.can", ForwardApplication.can_combine(vpn, NP), ForwardApplication.can_combine(NP, vpn))
print("bwd<", [str(c) for c in BackwardApplication.combine(NP, snp)])
print(">B", [str(c) for c in ForwardComposition.combine(vpn, nn)])
print("<B", [str(c) for c in BackwardComposition.combine(nn, snp)])
print(">S", [str(c) for c in ForwardSubstitution.combine(vpn, FunctionalCategory(NP, N, Direction("/", ["_"])))])
print(">T", [str(c) for c in ForwardT.combine(NP, snp)])
print("<T", [str(c) for c in BackwardT.combine(NP, snp)])

def try_(fn, *a):
    try:
        return repr(fn(*a))
    except Exception as e:
        return f"{type(e).__name__}: {e}"


print("== constraints ==")
print("forwardOnly", try_(forwardOnly, vpn, NP), try_(forwardOnly, snp, NP))
print("backwardOnly", try_(backwardOnly, vpn, NP), try_(backwardOnly, snp, NP))
print("bothForward", try_(bothForward, vpn, vpn), try_(bothForward, vpn, snp), try_(bothForward, NP, vpn))
print("bothBackward", try_(bothBackward, snp, snp), try_(bothBackward, snp, vpn))
print("crossedDirs", try_(crossedDirs, vpn, snp), try_(crossedDirs, vpn, vpn))
print("backwardBx", try_(backwardBxConstraint, snp, nn))
print("forwardS", try_(forwardSConstraint, vpn, NP), try_(forwardSConstraint, vpn, vpn))
print("backwardSx", try_(backwardSxConstraint, snp, NP))
print("forwardT", try_(forwardTConstraint, vpn, NP))
print("backwardT", try_(backwardTConstraint, snp, NP))
print("innermost", innermostFunction(vpn), try_(innermostFunction, NP))

print("== api reprs ==")
print(str(PrimitiveCategory("NP", ["sg"])))
print(str(Direction("/", ["_"])), str(Direction("\\", [".", ","])))
v = CCGVar()
print(v, v.is_var(), v.is_primitive(), v.is_function())
print(PrimitiveCategory("NP").can_unify(PrimitiveCategory("NP")))
print(PrimitiveCategory("NP").can_unify(PrimitiveCategory("N")))

print("== lexicon helpers ==")
from nltk.ccg.lexicon import matchBrackets, nextCategory, parseSubscripts, parseApplication, augParseCategory
print(matchBrackets("(a(b)c)rest"))
print(nextCategory("NP[sg]/x"))
print(nextCategory("(S\\NP)/NP rest"))
print(parseSubscripts("[sg,pl]"))
print(parseApplication(["\\", ".", ","]))
print(augParseCategory("(S\\NP)/NP", {"S", "NP", "N"}, {}))

print("== parseLexicon deprecation ==")
with warnings.catch_warnings(record=True) as w:
    warnings.simplefilter("always")
    lex2 = parseLexicon(":- S\na => S")
    print([str(t) for t in lex2.categories("a")])
    print(repr(str(w[0].message)))

print("== errors ==")
try:
    fromstring("a => S")
except Exception as e:
    print(type(e).__name__, e)
try:
    augParseCategory("X", {"S"}, {})
except Exception as e:
    print(type(e).__name__, e)

print("== demo (line count) ==")
out = capture(demo)
print(len(out.splitlines()))
