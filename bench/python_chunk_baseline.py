#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json

import nltk


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
    grammar = str(payload["grammar"])
    tagged = [(str(token), str(tag)) for token, tag in payload["tagged"]]

    parser_obj = nltk.RegexpParser(grammar)
    tree = parser_obj.parse(tagged)
    rows = nltk.chunk.tree2conlltags(tree)
    # rows: List[Tuple[token, tag, iob]]
    print(json.dumps({"iob": [[tok, tag, iob] for tok, tag, iob in rows]}))


if __name__ == "__main__":
    main()
