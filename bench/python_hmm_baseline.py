#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from typing import Any

from nltk.tag.hmm import HiddenMarkovModelTagger


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

    models = []
    for spec in payload["models"]:
        name = str(spec["name"])
        smoothing = float(spec.get("smoothing", 0.1))

        def estimator(fd, bins, gamma=smoothing):
            from nltk.probability import LidstoneProbDist

            return LidstoneProbDist(fd, gamma, bins)

        tagger = HiddenMarkovModelTagger.train(train, estimator=estimator)
        tagged_sents = [
            [[token, tag] for token, tag in sent] for sent in tagger.tag_sents(test_sents)
        ]
        transitions = {
            sj: {
                si: round(float(tagger._transitions[sj].prob(si)), 10)
                for si in tagger._states
            }
            for sj in tagger._states
        }
        emissions = {
            sj: {
                sym: round(float(tagger._outputs[sj].prob(sym)), 10)
                for sym in tagger._symbols
            }
            for sj in tagger._states
        }
        priors = {
            si: round(float(tagger._priors.prob(si)), 10) for si in tagger._states
        }
        models.append(
            {
                "name": name,
                "num_states": len(tagger._states),
                "num_symbols": len(tagger._symbols),
                "repr": repr(tagger),
                "tagged": tagged_sents,
                "eval": round(float(tagger.evaluate(gold)), 12) if gold else None,
                "transitions": transitions,
                "emissions": emissions,
                "priors": priors,
            }
        )

    print(json.dumps({"models": models}))


if __name__ == "__main__":
    main()
