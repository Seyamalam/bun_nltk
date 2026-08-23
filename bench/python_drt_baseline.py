#!/usr/bin/env python3
"""Python NLTK baseline for bench/python_drt_baseline.py."""
from __future__ import annotations
import argparse, json
from nltk.sem.drt import DrtParser

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--payload", required=True)
    args = parser.parse_args()
    payload = json.loads(args.payload)
    p = DrtParser()
    out = []
    for case in payload["cases"]:
        expr = case["expression"]
        entry = {"expression": expr}
        try:
            e = p.parse(expr)
        except Exception as ex:
            entry["error"] = type(ex).__name__ + ": " + str(ex)
            out.append(entry)
            continue
        res = {}
        for op in case.get("operations", []):
            if op == "str":
                res["str"] = str(e)
            elif op == "fol":
                try:
                    res["fol"] = str(e.fol())
                except Exception as ex:
                    res["fol_error"] = type(ex).__name__ + ": " + str(ex)
            elif op == "simplify":
                try:
                    res["simplify"] = str(e.simplify())
                except Exception as ex:
                    res["simplify_error"] = type(ex).__name__ + ": " + str(ex)
            elif op == "getRefs":
                try:
                    res["getRefs"] = sorted(str(v) for v in e.get_refs())
                    res["getRefs_recursive"] = sorted(str(v) for v in e.get_refs(True))
                except Exception as ex:
                    res["getRefs_error"] = str(ex)
        entry["results"] = res
        out.append(entry)
    print(json.dumps(out))

if __name__ == "__main__":
    main()
