import json
import nltk
assert nltk.__version__ == "3.10.3", nltk.__version__
from nltk.sem.evaluate import read_valuation, is_rel, set2rel, arity
from nltk.sem import logic

val_s = """john => b1
mary => g1
# comment
girl => {g1, g2}
boy => {b1, b2}
chase => {(b1, g1), (b2, g1), (g2, d2)}
walk => True
"""
v = read_valuation(val_s)
out = {}
out["domain"] = sorted(v.domain)
out["john"] = v["john"]
out["girl"] = sorted(tuple(x) for x in v["girl"])
out["chase"] = sorted(tuple(x) for x in v["chase"])
out["walk"] = v["walk"]
out["is_rel_empty"] = is_rel(set())
out["is_rel_tuples"] = is_rel({("a",), ("b",)})
try:
    is_rel({("a",), ("b", "c")})
    out["is_rel_mixed"] = "no-error"
except ValueError:
    out["is_rel_mixed"] = "ValueError"
out["set2rel"] = sorted(tuple(x) for x in set2rel({"a", "b"}))
out["set2rel_int"] = sorted(tuple(x) for x in set2rel({3, 27}))
out["arity_empty"] = arity(set())
out["arity_2"] = arity({("b1", "g1"), ("g2", "d2")})
# read_valuation error path
try:
    read_valuation("bad_line_no_arrow")
    out["read_val_err"] = "no-error"
except ValueError as e:
    out["read_val_err"] = "ValueError:" + str(e)
except IndexError:
    out["read_val_err"] = "IndexError"
# demo_model0 evaluation
from nltk.sem.util import demo_model0
from nltk.sem.evaluate import Model, Assignment
demo_model0()
import nltk.sem.util as u
m0, g0 = u.m0, u.g0
out["m0_eval_1"] = m0.evaluate("chase(john,mary)", g0)
out["m0_eval_2"] = m0.evaluate("chase(mary,john)", g0)
out["m0_eval_3"] = m0.evaluate("exists x. girl(x) & walk(x)", g0)
out["m0_domain"] = sorted(m0.domain)
# skolemize round trip
from nltk.sem.skolemize import skolemize, to_cnf
e = logic.Expression.fromstring("exists x. (dog(x) & bark(x))")
out["skolemize"] = str(skolemize(e))
out["to_cnf"] = str(to_cnf(logic.Expression.fromstring("(P | Q)"), logic.Expression.fromstring("R")))
# hole Constants
from nltk.sem.hole import Constants
out["hole_labels"] = sorted(Constants.ALL_LABELS) if hasattr(Constants, "ALL_LABELS") else None
# linearlogic parse
from nltk.sem.linearlogic import LinearLogicParser
p = LinearLogicParser()
out["llp"] = str(p.parse("f -o (g -o h)"))
# relextract
from nltk.sem.relextract import list2sym, class_abbrev, rtuple, clause
out["class_abbrev_LOC"] = class_abbrev("LOCATION")
out["list2sym"] = list2sym(["New", "York"])
reld = {"lcon": False, "rcon": False, "untagged_filler": "X", "subjclass": "PER", "subjtext": "John", "subjsym": "john", "objclass": "LOC", "objtext": "York", "objsym": "york", "filler": "in"}
out["rtuple"] = rtuple(reld)
print(json.dumps(out, default=str))
