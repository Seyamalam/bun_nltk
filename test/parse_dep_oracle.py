import json
import sys

import nltk

assert nltk.__version__ == "3.10.3", nltk.__version__

from nltk.grammar import DependencyGrammar
from nltk.parse.dependencygraph import DependencyGraph, conll_data2
from nltk.parse.nonprojectivedependencyparser import (
    DemoScorer,
    NonprojectiveDependencyParser,
    ProbabilisticNonprojectiveParser,
)
from nltk.parse.projectivedependencyparser import (
    ProbabilisticProjectiveDependencyParser,
    ProjectiveDependencyParser,
)


def graph_snapshot(g):
    nodes = []
    for addr in sorted(g.nodes):
        n = g.nodes[addr]
        deps = [[str(k), list(v)] for k, v in n["deps"].items()]
        nodes.append([n["address"], n["word"], n["tag"], n["head"], n["rel"], deps])
    return {
        "root": g.root["address"] if g.root else None,
        "nodes": nodes,
    }


def outcome(fn):
    try:
        return {"value": fn()}
    except Exception as e:  # noqa: BLE001 - pin the oracle's error surface
        return {"error": type(e).__name__, "message": str(e)}


def main():
    payload = json.load(sys.stdin)
    kind = payload["kind"]

    if kind == "load":
        out = []
        for case in payload["cases"]:
            tree_str = case["conll"]
            opts = {}
            if "cell_separator" in case:
                opts["cell_separator"] = case["cell_separator"]
            if "zero_based" in case:
                opts["zero_based"] = case["zero_based"]
            if "top_relation_label" in case:
                opts["top_relation_label"] = case["top_relation_label"]
            out.append(outcome(lambda ts=tree_str, o=opts: graph_snapshot(DependencyGraph(ts, **o))))
        print(json.dumps(out))
        return

    if kind == "pdp":
        grammar = DependencyGrammar.fromstring(payload["grammar"])
        pdp = ProjectiveDependencyParser(grammar)
        print(json.dumps([str(t) for t in pdp.parse(payload["tokens"])]))
        return

    if kind == "ppdp":
        conll2 = [DependencyGraph(e) for e in conll_data2.split("\n\n") if e]
        ppdp = ProbabilisticProjectiveDependencyParser()
        ppdp.train(conll2)
        print(json.dumps([str(t) for t in ppdp.parse(payload["tokens"])]))
        return

    if kind == "npdp":
        ndp = NonprojectiveDependencyParser(
            DependencyGrammar.fromstring(payload["grammar"]), max_time=None
        )
        print(json.dumps([graph_snapshot(g) for g in ndp.parse(payload["tokens"])]))
        return

    if kind == "npp":
        npp = ProbabilisticNonprojectiveParser()
        npp.train([], DemoScorer())
        # DemoScorer.train prints "Training..." — keep stdout JSON clean.
        import io
        import contextlib

        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            graphs = [graph_snapshot(g) for g in npp.parse(payload["tokens"], payload["tags"])]
        print(json.dumps(graphs))
        return

    raise SystemExit(f"unknown kind {kind}")


main()
