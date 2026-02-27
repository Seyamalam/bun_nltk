#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json

import nltk


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--payload", required=True)
    args = parser.parse_args()

    payload = json.loads(args.payload)
    grammar = str(payload["grammar"])
    tagged = [(str(token), str(tag)) for token, tag in payload["tagged"]]

    parser_obj = nltk.RegexpParser(grammar)
    tree = parser_obj.parse(tagged)
    rows = nltk.chunk.tree2conlltags(tree)
    # rows: List[Tuple[token, tag, iob]]
    print(json.dumps({"iob": [[tok, tag, iob] for tok, tag, iob in rows]}))


if __name__ == "__main__":
    main()
