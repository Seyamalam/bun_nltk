#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import time

from nltk.grammar import FeatureGrammar
from nltk.parse import FeatureChartParser


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--payload")
    parser.add_argument("--payload-file")
    args = parser.parse_args()

    if args.payload_file:
        payload = json.loads(open(args.payload_file, "r", encoding="utf-8").read())
    elif args.payload:
        payload = json.loads(args.payload)
    else:
        raise SystemExit("either --payload or --payload-file is required")

    grammar_text = str(payload["grammar"])
    grammar = FeatureGrammar.fromstring(grammar_text)
    parser_obj = FeatureChartParser(grammar)

    cases = payload.get("cases")
    rounds = int(payload.get("rounds", 1))
    if cases is None:
        cases = [payload["tokens"]]

    first_trees = []
    total_parses = 0
    started = time.perf_counter()
    for _ in range(max(1, rounds)):
        for raw in cases:
            tokens = [str(tok) for tok in raw]
            trees = list(parser_obj.parse(tokens))
            total_parses += len(trees)
            if not first_trees:
                first_trees = trees
    elapsed = time.perf_counter() - started

    print(
        json.dumps(
            {
                "parse_count": len(first_trees),
                "parse_count_total": total_parses,
                "trees": [tree.pformat(margin=1000000) for tree in first_trees[:8]],
                "total_seconds": elapsed,
            }
        )
    )


if __name__ == "__main__":
    main()
