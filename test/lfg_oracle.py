#!/usr/bin/env python3
"""Oracle pins for nltk.sem.lfg.FStructure (NLTK 3.10.3).

Reads a JSON request on stdin: {"depgraph": "<conll>"}.
Emits JSON pins for read_depgraph pretty/repr/pred/label and to_depgraph nodes.
"""
import json
import sys
import warnings

import nltk

assert nltk.__version__ == "3.10.3"
warnings.filterwarnings("ignore")
from nltk.parse.dependencygraph import DependencyGraph
from nltk.sem.lfg import FStructure

req = json.loads(sys.stdin.read())
out = {"cases": []}
for data in req["depgraphs"]:
    dg = DependencyGraph(data)
    fs = FStructure.read_depgraph(dg)
    rec = {
        "pretty": fs.pretty_format(),
        "repr": repr(fs),
        "pred": list(fs.pred) if fs.pred else None,
        "label": fs.label,
        "keys": sorted(fs.keys()),
        "features": {k: [
            ({"type": "fs", "pretty": i.pretty_format()} if isinstance(i, FStructure)
             else {"type": "tuple", "v": list(i)} if isinstance(i, tuple)
             else {"type": "list", "n": len(i)})
            for i in fs[k]
        ] for k in sorted(fs.keys())},
    }
    dg2 = fs.to_depgraph()
    rec["to_depgraph"] = {
        str(a): {k: n[k] for k in ("address", "word", "tag", "head", "rel", "deps")}
        for a, n in dg2.nodes.items()
    }
    rec["to_depgraph_root"] = dg2.root["address"]
    out["cases"].append(rec)
print(json.dumps(out))
