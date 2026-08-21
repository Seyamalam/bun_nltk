#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json

from nltk.translate.chrf_score import sentence_chrf
from nltk.translate.nist_score import sentence_nist


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--payload", required=True)
    args = parser.parse_args()

    payload = json.loads(args.payload)

    chrf = []
    for case in payload.get("chrf", []):
        score = sentence_chrf(
            case["reference"],
            case["hypothesis"],
            min_len=int(case.get("min_len", 1)),
            max_len=int(case.get("max_len", 6)),
            beta=float(case.get("beta", 3.0)),
            ignore_whitespace=bool(case.get("ignore_whitespace", True)),
        )
        chrf.append(score)

    nist = []
    for case in payload.get("nist", []):
        score = sentence_nist(
            case["references"],
            case["hypothesis"],
            n=int(case.get("n", 5)),
        )
        nist.append(score)

    print(json.dumps({"chrf": chrf, "nist": nist}))


if __name__ == "__main__":
    main()
