"""Live NLTK 3.10.3 oracle for pure dependency-parse internals.

Deterministic surfaces only: transition-parser configurations/transitions,
projective span cells, nonprojective scorers, test-sentence extraction,
resource-url normalization and gzip text reads. No downloads or pickles.
"""
import contextlib
import gzip
import io
import json
import sys
import tempfile
import os

import nltk
from nltk.parse.dependencygraph import DependencyGraph
from nltk.parse.transitionparser import Configuration, Transition
from nltk.parse.projectivedependencyparser import ChartCell, DependencySpan
from nltk.parse.nonprojectivedependencyparser import (
    DemoScorer,
    DependencyScorerI,
    NaiveBayesDependencyScorer,
)
from nltk.parse.util import extract_test_sentences
from nltk.data import normalize_resource_url
from nltk.classify.maxent import gzip_open_unicode

assert nltk.__version__ == "3.10.3", nltk.__version__

request = json.load(sys.stdin)


def outcome(fn):
    try:
        return {"value": fn()}
    except Exception as error:
        return {"error": type(error).__name__, "message": str(error)}


CONLL = "1\tCathy\t_\tN\t_\t_\t2\tsu\t_\t_\n2\tzag\t_\tV\t_\t_\t0\tROOT\t_\t_\n3\them\t_\tPron\t_\t_\t2\tobj1\t_\t_\n4\tzwaaien\t_\tAdj\t_\t_\t2\tvc\t_\t_\n5\t.\t_\tPunc\t_\t_\t4\tpunct\t_\t_"


def run_transition(case):
    graph = DependencyGraph(CONLL)
    conf = Configuration(graph)
    transition = Transition(case["algorithm"])
    states = [str(conf)]
    for op in case["ops"]:
        result = getattr(transition, op["name"])(conf, *op.get("args", []))
        states.append({"op": op["name"], "result": result if result is not None else None,
                       "stack": list(conf.stack), "buffer": list(conf.buffer), "arcs": [list(a) for a in conf.arcs]})
    return {"states": states, "features": conf.extract_features()}


kind = request["kind"]
if kind == "transition":
    result = [outcome(lambda c=case: run_transition(c)) for case in request["cases"]]
elif kind == "transition_ctor":
    result = [outcome(lambda a=alg: Transition(a)._algo) for alg in request["algorithms"]]
elif kind == "spans":
    def span_case(case):
        span = DependencySpan(*case["args"])
        other = DependencySpan(*case["other"]) if "other" in case else None
        row = {"repr": repr(span), "str": str(span), "head_index": span.head_index()}
        if other is not None:
            row["eq"] = span == other
            row["ne"] = span != other
            row["lt"] = outcome(lambda: span < other)
            row["hash_eq"] = hash(span) == hash(other)
        return row
    result = [outcome(lambda c=case: span_case(c)) for case in request["cases"]]
elif kind == "chartcell":
    cell = ChartCell(request["x"], request["y"])
    for args in request["spans"]:
        cell.add(DependencySpan(*args))
    result = {"str": str(cell), "size": len(cell._entries),
              "entries": sorted(repr(span) for span in cell._entries)}
elif kind == "scorers":
    out = {}
    out["ctor"] = outcome(lambda: DependencyScorerI())
    scorer = DemoScorer()
    with contextlib.redirect_stdout(io.StringIO()):
        out["demo_train"] = outcome(lambda: scorer.train([]))
    out["demo_score"] = outcome(lambda: scorer.score(None))
    out["abstract_train"] = outcome(lambda: DependencyScorerI.train(object.__new__(DependencyScorerI), []))
    graphs = [DependencyGraph(entry) for entry in CONLL.split("\n\n") if entry.strip()]
    nb = NaiveBayesDependencyScorer()
    out["nb_train"] = outcome(lambda: nb.train(graphs))
    out["nb_score"] = outcome(lambda: nb.score(graphs[0]))
    result = out
elif kind == "test_sentences":
    result = [outcome(lambda c=case: extract_test_sentences(c["text"], **c.get("kwargs", {}))) for case in request["cases"]]
elif kind == "resource_url":
    result = [outcome(lambda u=url: normalize_resource_url(u)) for url in request["urls"]]
elif kind == "gzip_text":
    fd, path = tempfile.mkstemp(suffix=".gz")
    os.close(fd)
    try:
        with gzip.open(path, "wb") as fh:
            fh.write(request["text"].encode("utf-8"))
        with gzip_open_unicode(path) as fh:
            result = fh.read()
    finally:
        os.unlink(path)
else:
    raise RuntimeError(f"unknown kind {kind}")

print(json.dumps(result))
