"""Pinned oracle outputs for the nltk.inference family (NLTK 3.10.3)."""
import nltk

assert nltk.__version__ == "3.10.3"

from nltk.sem import Expression
from nltk.inference.prover9 import convert_to_prover9
from nltk.inference.resolution import clausify, most_general_unification
from nltk.inference.mace import decode_result
from nltk.inference.nonmonotonic import (
    ClosedDomainProver,
    ClosedWorldProver,
    SetHolder,
    PredHolder,
    get_domain,
)
from nltk.inference.prover9 import Prover9Command
from nltk.sem.logic import Variable

lexpr = Expression.fromstring

print("=== convert_to_prover9 ===")
for e in [
    "P(x)",
    "-P(x)",
    "P(x) & Q(x)",
    "P(x) | Q(x)",
    "P(x) -> Q(x)",
    "P(x) <-> Q(x)",
    "exists x.P(x)",
    "all x.P(x)",
    "x = y",
    "walk(john,mary)",
]:
    print(e, "=>", convert_to_prover9(lexpr(e)))

print("=== decode_result ===")
for v in [True, False, None]:
    print(repr(v), "=>", repr(decode_result(v)))

print("=== nonmonotonic ===")
p = Prover9Command(
    lexpr("walk(Bill)"),
    [
        lexpr("walk(Socrates)"),
        lexpr("all x.(ostrich(x) -> bird(x))"),
        lexpr("bird(Tweety)"),
    ],
)
cdp = ClosedDomainProver(p)
for a in cdp.assumptions():
    print("CD", a)
print("CDG", cdp.goal())
cwp = ClosedWorldProver(p)
for a in cwp.assumptions()[3:]:
    print("CW", a)
sh = SetHolder()
v1, v2 = Variable("a"), Variable("b")
sh[v1].add(v2)
print("SH", sorted(str(v) for v in sh[v1]), sh[v2] is sh[v1])
ph = PredHolder()
ph.append_sig(("x",))
print("PH", ph.signature_len, len(ph.signatures))
try:
    ph.append_sig(("x", "y"))
except Exception as e:
    print("PHE", e)
print("GD", sorted(str(v) for v in get_domain(lexpr("walk(Bill)"), [lexpr("walk(Socrates)")])))

print("=== clausify (structure only; var numbering is counter-dependent) ===")
for e in ["man(x)", "(man(x) -> man(x))"]:
    cls = clausify(lexpr(e))
    print(e, "=>", len(cls), [sorted(str(l) for l in c) for c in cls])

print("=== most_general_unification ===")
bd = most_general_unification(lexpr("P(x)"), lexpr("P(john)"))
print("MGU", bd)
