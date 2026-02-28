#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from typing import Any

import nltk
from nltk import CFG
from nltk.parse import EarleyChartParser


def parse_payload(args: argparse.Namespace) -> dict[str, Any]:
    if args.payload_file:
        with open(args.payload_file, "r", encoding="utf-8") as f:
            return json.load(f)
    if args.payload:
        return json.loads(args.payload)
    raise SystemExit("either --payload or --payload-file is required")


def one_case(parser: EarleyChartParser, tokens: list[str]) -> dict[str, Any]:
    trees = list(parser.parse(tokens))
    return {
        "tokens": tokens,
        "parse_count": len(trees),
        "first_tree": str(trees[0]) if trees else None,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--payload")
    parser.add_argument("--payload-file")
    args = parser.parse_args()
    payload = parse_payload(args)
    grammar_text = str(payload["grammar"])
    cases = payload["cases"]

    grammar = CFG.fromstring(grammar_text)
    earley = EarleyChartParser(grammar)
    results = [one_case(earley, [str(tok) for tok in row]) for row in cases]
    print(json.dumps({"ok": True, "results": results}))


if __name__ == "__main__":
    main()
