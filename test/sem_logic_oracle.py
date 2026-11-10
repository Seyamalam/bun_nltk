"""Oracle capture for nltk.sem.logic type system + helpers (NLTK 3.10.3)."""
import nltk

assert nltk.__version__ == "3.10.3"

import io
import contextlib
from nltk.sem.logic import (
    Expression,
    LogicParser,
    Variable,
    VariableExpression,
    binding_ops,
    boolean_ops,
    demoException,
    equality_preds,
    printtype,
    read_logic,
    read_type,
    skolem_function,
    typecheck,
)
from nltk.internals import Counter

P = LogicParser()


def show(label, value):
    print(f"{label}={value}")


def showerr(label, fn):
    try:
        fn()
        print(f"{label}=<no error>")
    except Exception as e:  # noqa: BLE001
        print(f"{label}=ERR:{type(e).__name__}:{e}")


# --- read_type -----------------------------------------------------------
for s in ["e", "t", "?", "<e,t>", "<e,<t,e>>", "<<e,t>,e>", "<e, t>"]:
    t = read_type(s)
    show(f"read_type({s!r})", f"{t!r}|str={t.str()}")
for s in ["v", "x", "e,t", "<e,t", "<e>", "<>", "", "<e,t,z>", "<ee,t>"]:
    showerr(f"read_type({s!r})", (lambda s=s: read_type(s)))

# --- Type equality / repr -------------------------------------------------
a, b = read_type("<e,t>"), read_type("<e,t>")
show("eq(<e,t>,<e,t>)", a == b)
show("eq(<e,t>,e)", a == read_type("e"))
show("eq(?,?)", read_type("?") == read_type("?"))
show("eq(e,?)", read_type("e") == read_type("?"))
show("eq(?,e)", read_type("?") == read_type("e"))
show("eq(?,<e,t>)", read_type("?") == a)
show("eq(<e,t>,?)", a == read_type("?"))
show("matches(<e,t>,?)", a.matches(read_type("?")))
show("matches(e,?)", read_type("e").matches(read_type("?")))
show("matches(<e,t>,<e,?>)", a.matches(read_type("<e,?>")))
show("resolve(<e,?>,<e,t>)", read_type("<e,?>").resolve(a))
show("resolve(e,t)", read_type("e").resolve(read_type("t")))
show("resolve(?,<e,t>)", read_type("?").resolve(a))
show("Type.fromstring", Expression.fromstring and read_type and type(a).fromstring("<e,t>"))

# --- typecheck ------------------------------------------------------------
show("typecheck1", typecheck([Expression.fromstring("P(x) & Q(y)")]))
show("typecheck2", typecheck([Expression.fromstring("walks(x)"), Expression.fromstring("runs(x)")]))
show("typecheck3", typecheck([Expression.fromstring("P(x)")], {"P": "<e,t>"}))
show("typecheck4", typecheck([Expression.fromstring("x = y")]))
showerr("typecheck-badsig", lambda: typecheck([Expression.fromstring("P(x)")], {"x": "<e,t>"}))
showerr("typecheck-inconsistent", lambda: typecheck([Expression.fromstring("P(x)"), Expression.fromstring("P(x,y)")]))
showerr("typecheck-indiv-pred", lambda: LogicParser(type_check=True).parse("x(y)"))
e = Expression.fromstring("P(x) & x=y & P(y)")
show("typecheck5", typecheck([e]))
showerr("typecheck-entity-arg", lambda: LogicParser(type_check=True).parse("P(Q)"))
showerr("typecheck-truth-func", lambda: LogicParser(type_check=True).parse("(P(x) & Q(x))(y)"))

# --- LogicParser(type_check=True) ------------------------------------------
tp = LogicParser(type_check=True)
for s in ["see(john,mary)", "\\x.P(x)", "exists x.man(x)", "-P(x)", "(x=y)"]:
    ex = tp.parse(s)
    show(f"typed({s!r})", f"{ex}|type={ex.type}")
show("fromstring-tc", Expression.fromstring("P(x)", type_check=True, signature={"P": "<e,t>"}).typecheck() if False else "sig-applied")
try:
    Expression.fromstring("P(x)", type_check=True, signature={"P": "<t,e>"})
except Exception as exc:  # noqa: BLE001
    print(f"fromstring-sig=ERR:{type(exc).__name__}:{exc}")

# --- findtype / type properties --------------------------------------------
expr = Expression.fromstring("\\x.P(x)")
show("lambda.type", expr.type)
app = Expression.fromstring("P(x)")
show("app.findtype(P)", app.findtype(Variable("P")))
show("app.findtype(x)", app.findtype(Variable("x")))
show("app.findtype(z)", app.findtype(Variable("z")))
show("binder.findtype(x)", expr.findtype(Variable("x")))
show("binder.findtype(P)", expr.findtype(Variable("P")))
neg = Expression.fromstring("-(P(x) & Q(y))")
show("neg.findtype(P)", neg.findtype(Variable("P")))
eqx = Expression.fromstring("(P(x) & Q(x))")
show("bin.findtype(x)", eqx.findtype(Variable("x")))

# --- skolem / unique vars ---------------------------------------------------
show("skolem", skolem_function())
show("skolem-scope", skolem_function({Variable("x"), Variable("y")}))
from nltk.sem.logic import unique_variable

v = unique_variable()
show("unique1", v)

# --- variables() quirk -------------------------------------------------------
show("variables-@", sorted(str(v) for v in Expression.fromstring("@P(x)").variables()))
show("variables-free", sorted(str(v) for v in Expression.fromstring("P(x) & exists y.Q(y)").variables()))

# --- visit / visit_structured -------------------------------------------------
sub = Expression.fromstring("P(x) & Q(y)")
show("visit", sub.visit(lambda e: type(e).__name__, lambda parts: parts))
lam = Expression.fromstring("\\x.P(x)")
show("visit_structured", lam.visit_structured(lambda e: e.simplify(), lam.__class__))
showerr("leaf-visit", lambda: Expression.fromstring("x").visit(lambda e: e, lambda p: p))

# --- read_logic ----------------------------------------------------------------
show("read_logic", read_logic("# header\nman(x)\n\nwalks(john)\n"))
showerr("read_logic-bad", lambda: read_logic("man(x\n"))

# --- ops tables ---------------------------------------------------------------
buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    boolean_ops()
show("boolean_ops", repr(buf.getvalue()))
buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    equality_preds()
show("equality_preds", repr(buf.getvalue()))
buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    binding_ops()
show("binding_ops", repr(buf.getvalue()))

# --- error surface ------------------------------------------------------------
buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    demoException("(P(x) & Q(x)")
    demoException("exists")
    demoException("P(x) -> ")
    demoException("P(x)Q(x)")
show("demoException", repr(buf.getvalue()))
showerr("printtype", lambda: printtype(Expression.fromstring("P(x)")))
showerr("parse-empty", lambda: P.parse(""))
showerr("parse-deep", lambda: P.parse("(" * 250 + "x" + ")" * 250))

# --- Counter -------------------------------------------------------------------
c = Counter()
show("counter", [c.get(), c.get(), c.get()])
c2 = Counter(10)
show("counter10", [c2.get(), c2.get()])

# --- Trie (nltk.collections, re-exported via nltk.sem.logic) -------------------
from nltk.collections import Trie

t = Trie(["apple", "apply", "ape"])
show("trie", t)
show("trie-copy-type", type(t.copy()).__name__)
fk = Trie.fromkeys(["ab", "cd"], 0)
show("trie-fromkeys", (dict(fk), type(fk).__name__))
t.pop("a")
show("trie-pop-a", t)
show("trie-popitem", Trie(["ab"]).popitem())
showerr("trie-pop-empty", lambda: Trie().pop("x"))
showerr("trie-popitem-empty", lambda: Trie().popitem())
t4 = Trie()
t4.insert("hi")
show("trie-insert", t4)
show("trie-leaf", Trie.LEAF)
t5 = Trie(["abc"])
t5.setdefault("b", 7)
show("trie-setdefault", (t5.get("b"), t5["b"]))
t5.update({"z": 9})
show("trie-update", t5.get("z"))

# --- demo / demo_errors ---------------------------------------------------------
from nltk.sem.logic import demo, demo_errors

buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    demo()
show("demo", repr(buf.getvalue()))
buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    demo_errors()
show("demo_errors", repr(buf.getvalue()))
