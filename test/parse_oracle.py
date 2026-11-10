import json
import nltk
assert nltk.__version__ == "3.10.3", nltk.__version__
from nltk.parse.util import taggedsent_to_conll, taggedsents_to_conll
from nltk.parse.dependencygraph import DependencyGraph
from nltk.parse.evaluate import DependencyEvaluator

out = {}
sent = [("This", "DT"), ("is", "VBZ"), ("a", "DT"), ("foobar", "JJ"), ("sentence", "NN"), (".", ".")]
out["conll_one"] = list(taggedsent_to_conll(sent))
out["conll_many"] = list(taggedsents_to_conll([sent[:2], sent[2:4]]))

conll = """1	This	_	DT	DT	_	2	a	_	_
2	is	_	VBZ	VBZ	_	0	ROOT	_	_
3	a	_	DT	DT	_	4	a	_	_
4	foobar	_	JJ	JJ	_	2	a	_	_
"""
dg = DependencyGraph(conll)
out["dg_roundtrip"] = dg.to_conll(10)
out["dg_4"] = dg.to_conll(4)
out["dg_3"] = dg.to_conll(3)
out["dg_triples"] = [(w, r, d) for w, r, d in dg.triples()]
out["dg_cycle"] = dg.contains_cycle()
cyclic = "1\ta\t_\tX\tX\t_\t2\tx\t_\t_\n2\tb\t_\tX\tX\t_\t1\tx\t_\t_"
dg2 = DependencyGraph(cyclic)
out["dg_cycle2"] = dg2.contains_cycle()

# DependencyEvaluator: NLTK takes parsed/gold DependencyGraph lists
parsed = DependencyGraph(conll)
gold = DependencyGraph(conll)
ev = DependencyEvaluator([parsed], [gold])
out["eval_perfect"] = ev.eval()
c1 = DependencyGraph(conll)
c2txt = """1	This	_	DT	DT	_	4	a	_	_
2	is	_	VBZ	VBZ	_	0	ROOT	_	_
3	a	_	DT	DT	_	4	a	_	_
4	foobar	_	JJ	JJ	_	2	a	_	_
"""
c2 = DependencyGraph(c2txt)
out["eval_mismatch"] = DependencyEvaluator([c2], [c1]).eval()
print(json.dumps(out, default=str))
