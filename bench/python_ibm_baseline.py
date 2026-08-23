#!/usr/bin/env python3
"""Python NLTK baseline for IBM Model 1/2 parity.

Reads --payload JSON: {bitext: [{mots, words}], iterations, probes: [[t, s]],
models: ["ibm1", "ibm2"]}
Prints ONE JSON line: {"translations": {"ibm1|t|s": float, ...}}
"""
from __future__ import annotations

import argparse
import json
import warnings

from nltk.translate.ibm1 import IBMModel1
from nltk.translate.ibm2 import IBMModel2
from nltk.translate import AlignedSent


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--payload", required=True)
    args = parser.parse_args()
    payload = json.loads(args.payload)

    bitext = [AlignedSent(mots=p["mots"], words=p["words"]) for p in payload["bitext"]]
    iterations = int(payload["iterations"])
    probes = [tuple(p) for p in payload["probes"]]

    out = {}
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        for model_name in payload.get("models", ["ibm1", "ibm2"]):
            if model_name == "ibm1":
                model = IBMModel1(bitext, iterations)
            else:
                model = IBMModel2(bitext, iterations)
            for t, s in probes:
                key = f"{model_name}|{t}|{s}"
                s_key = None if s == "NULL" else s
                value = model.translation_table[t][s_key]
                out[key] = float(value)

    print(json.dumps({"translations": out}))


if __name__ == "__main__":
    main()
