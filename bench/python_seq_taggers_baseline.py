#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from typing import Any

from nltk.tag import (
    BigramTagger,
    DefaultTagger,
    RegexpTagger,
    TrigramTagger,
    UnigramTagger,
)


def build_tagger(steps: list[dict[str, Any]], train: list[list[tuple[str, str]]]):
    tagger = None
    for step in reversed(steps):
        kind = str(step["type"])
        backoff = tagger
        if kind == "default":
            tagger = DefaultTagger(str(step["tag"]))
        elif kind == "regexp":
            rules = [(str(rule[0]), str(rule[1])) for rule in step["rules"]]
            tagger = RegexpTagger(rules, backoff=backoff)
        elif kind == "unigram":
            tagger = UnigramTagger(
                train=train, backoff=backoff, cutoff=int(step.get("cutoff", 0))
            )
        elif kind == "bigram":
            tagger = BigramTagger(
                train=train, backoff=backoff, cutoff=int(step.get("cutoff", 0))
            )
        elif kind == "trigram":
            tagger = TrigramTagger(
                train=train, backoff=backoff, cutoff=int(step.get("cutoff", 0))
            )
        else:
            raise ValueError(f"unsupported tagger type: {kind}")
    if tagger is None:
        raise ValueError("empty chain")
    return tagger


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

    train = [
        [(str(token), str(tag)) for token, tag in sentence]
        for sentence in payload["train"]
    ]
    test_sents = [[str(token) for token in sentence] for sentence in payload["test"]]
    gold = [
        [(str(token), str(tag)) for token, tag in sentence]
        for sentence in payload.get("gold", [])
    ]

    chains = []
    for chain_spec in payload["chains"]:
        name = str(chain_spec["name"])
        tagger = build_tagger(chain_spec["steps"], train)
        tagged_sents = [
            [[token, tag] for token, tag in sent] for sent in tagger.tag_sents(test_sents)
        ]
        if isinstance(tagger, DefaultTagger):
            size = 1
        elif isinstance(tagger, RegexpTagger):
            size = len(tagger._regexps)
        else:
            size = int(tagger.size())
        chains.append(
            {
                "name": name,
                "size": size,
                "tagged": tagged_sents,
                "eval": round(float(tagger.evaluate(gold)), 12) if gold else None,
            }
        )

    print(json.dumps({"chains": chains}))


if __name__ == "__main__":
    main()
