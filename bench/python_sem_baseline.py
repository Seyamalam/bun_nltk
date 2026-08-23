#!/usr/bin/env python3
"""Python NLTK baseline for the sem_logic parity harness.

Reads --payload JSON: {"cases": [{expression, operations, model?, assignment?, variable?}]}
Prints ONE JSON line: list of per-case entries.
"""
from __future__ import annotations

import argparse
import json

from nltk.sem.evaluate import Assignment, Model, Valuation
from nltk.sem.logic import LogicParser


def build_model(spec):
    dom = set(spec["domain"])
    items = []
    for sym, val in spec["valuations"].items():
        if isinstance(val, list):
            if all(isinstance(el, list) for el in val):
                val = set(tuple(el) for el in val)
            else:
                val = set(val)
        items.append((sym, val))
    return Model(dom, Valuation(items))


def run_case(lp, case):
    entry = {"expression": case["expression"]}
    try:
        e = lp.parse(case["expression"])
    except Exception as ex:  # noqa: BLE001
        entry["error"] = type(ex).__name__
        return entry
    results = {}
    model = None
    g = None
    for op in case.get("operations", []):
        if op == "str":
            results["str"] = str(e)
        elif op == "simplify":
            results["simplify"] = str(e.simplify())
        elif op == "free":
            results["free"] = sorted(v.name for v in e.free())
        elif op == "variables":
            results["variables"] = sorted(v.name for v in e.variables())
        elif op == "constants":
            results["constants"] = sorted(v.name for v in e.constants())
        elif op == "predicates":
            results["predicates"] = sorted(v.name for v in e.predicates())
        elif op == "normalize":
            results["normalize"] = str(e.normalize())
        elif op in ("evaluate", "satisfiers"):
            if model is None:
                model = build_model(case["model"])
                assign = case.get("assignment", {})
                g = Assignment(set(case["model"]["domain"]), list(assign.items()))
            if op == "evaluate":
                results["evaluate"] = model.evaluate(case["expression"], g)
            else:
                results["satisfiers"] = sorted(model.satisfiers(e, case["variable"], g))
    entry["results"] = results
    return entry


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--payload", required=True)
    args = parser.parse_args()

    payload = json.loads(args.payload)
    lp = LogicParser()
    out = [run_case(lp, case) for case in payload["cases"]]
    print(json.dumps(out))


if __name__ == "__main__":
    main()
