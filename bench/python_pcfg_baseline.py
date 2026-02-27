#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import time
from typing import Any

import nltk


def parse_payload(args: argparse.Namespace) -> dict[str, Any]:
    if args.payload_file:
        return json.loads(open(args.payload_file, "r", encoding="utf-8").read())
    if args.payload:
        return json.loads(args.payload)
    raise SystemExit("either --payload or --payload-file is required")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--payload")
    parser.add_argument("--payload-file")
    args = parser.parse_args()
    payload = parse_payload(args)

    grammar_text = str(payload["grammar"])
    cases = payload.get("cases")
    if cases is None:
      cases = [payload["tokens"]]
    rounds = int(payload.get("rounds", 1))

    grammar = nltk.PCFG.fromstring(grammar_text)
    parser_obj = nltk.ViterbiParser(grammar)

    first = None
    parse_count_total = 0
    started = time.perf_counter()
    for _ in range(max(1, rounds)):
        for raw in cases:
            tokens = [str(tok) for tok in raw]
            trees = list(parser_obj.parse(tokens))
            parse_count_total += len(trees)
            if first is None:
                first = trees[0] if trees else None
    elapsed = time.perf_counter() - started

    if first is None:
        print(json.dumps({"parse_count": 0, "parse_count_total": parse_count_total, "tree": None, "prob": 0.0, "total_seconds": elapsed}))
        return

    print(
        json.dumps(
            {
                "parse_count": 1,
                "parse_count_total": parse_count_total,
                "tree": first.pformat(margin=1000000),
                "prob": float(first.prob()),
                "total_seconds": elapsed,
            }
        )
    )


if __name__ == "__main__":
    main()

