"""Python NLTK 3.10.3 oracle for load_parser/show_cfg."""
import json
import os
import sys
from io import StringIO

import nltk
assert nltk.__version__ == "3.10.3"
from nltk.parse import load_parser
from nltk.data import show_cfg

GRAMMARS = os.path.join(os.environ["NLTK_DATA"], "grammars")
os.makedirs(GRAMMARS, exist_ok=True)

CFG_PATH = os.path.join(GRAMMARS, "load_parser_test.cfg")
with open(CFG_PATH, "w") as f:
    f.write("S -> NP VP\nNP -> 'John'\nVP -> V NP\nNP -> 'Mary'\nV -> 'sees'\n")

PCFG_PATH = os.path.join(GRAMMARS, "load_parser_test.pcfg")
with open(PCFG_PATH, "w") as f:
    f.write(
        "S -> NP VP [1.0]\nNP -> 'John' [0.5]\nNP -> 'Mary' [0.5]\n"
        "VP -> V NP [1.0]\nV -> 'sees' [1.0]\n"
    )

SHOW_PATH = os.path.join(GRAMMARS, "load_parser_show.cfg")
with open(SHOW_PATH, "w") as f:
    f.write("## comment line\n\nS -> NP VP\n\n## another\nVP -> V\n")

out = {}

def trees_str(trees):
    return sorted(str(t) for t in trees)

p = load_parser("grammars/load_parser_test.cfg")
out["cfg_parser"] = type(p).__name__
out["cfg_trees"] = trees_str(p.parse("John sees Mary".split()))
out["cfg_trace0"] = type(load_parser("grammars/load_parser_test.cfg", trace=0)).__name__

p = load_parser("grammars/load_parser_test.pcfg")
out["pcfg_parser"] = type(p).__name__
tr = [t for t in p.parse("John sees Mary".split())]
out["pcfg_trees"] = [str(t) for t in tr]
out["pcfg_probs"] = [t.prob() for t in tr]

from nltk.parse.chart import TopDownChartParser
p = load_parser("grammars/load_parser_test.cfg", parser=TopDownChartParser)
out["cfg_custom_parser"] = type(p).__name__
out["cfg_custom_trees"] = trees_str(p.parse("John sees Mary".split()))

p = load_parser("grammars/book_grammars/feat0.fcfg")
out["fcfg_parser"] = type(p).__name__
out["fcfg_chart"] = p._chart_class.__name__

try:
    load_parser("grammars/nonexistent_grammar.cfg")
except Exception as e:
    out["missing"] = {"err": type(e).__name__, "msg": str(e)}

try:
    load_parser("grammars/background.fol")
except Exception as e:
    out["fol"] = {"err": type(e).__name__, "msg": str(e)[:120]}

buf = StringIO()
sys_stdout = sys.stdout
sys.stdout = buf
try:
    show_cfg("grammars/load_parser_show.cfg")
finally:
    sys.stdout = sys_stdout
out["show_cfg"] = buf.getvalue()

buf = StringIO()
sys.stdout = buf
try:
    show_cfg("grammars/load_parser_show.cfg", escape="#")
finally:
    sys.stdout = sys_stdout
out["show_cfg_escape"] = buf.getvalue()

print("json:" + json.dumps(out))
