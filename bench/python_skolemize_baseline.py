#!/usr/bin/env python3
"""Python NLTK baseline for bench/python_skolemize_baseline.py."""
from __future__ import annotations
import argparse, json
from nltk.sem.logic import LogicParser, _counter
from nltk.sem.skolemize import skolemize

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--payload", required=True)
    args = parser.parse_args()
    payload = json.loads(args.payload)
    lp = LogicParser()
    out = []
    for case in payload["cases"]:
        expr = case["expression"]
        entry = {"expression": expr}
        try:
            _counter._value = 0
            e = lp.parse(expr)
            sk = skolemize(e)
            entry["skolemize"] = str(sk)
        except Exception as ex:
            entry["error"] = type(ex).__name__ + ": " + str(ex)
        out.append(entry)
    print(json.dumps(out))

if __name__ == "__main__":
    main()
