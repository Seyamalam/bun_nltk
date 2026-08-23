#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from typing import Any

from nltk.tag import DefaultTagger, RegexpTagger
from nltk.tag.brill import Pos, Word
from nltk.tag.brill_trainer import BrillTaggerTrainer
from nltk.tbl.template import Template

REGEXP_RULES: list[tuple[str, str]] = [
    (r"^-?[0-9]+(\.[0-9]+)?$", "CD"),
    (r"(The|the|A|a|An|an)$", "AT"),
    (r".*ing$", "VBG"),
    (r".*ed$", "VBD"),
    (r".*ly$", "RB"),
    (r".*s$", "NNS"),
    (r".*", "NN"),
]


def build_initial_tagger() -> RegexpTagger:
    return RegexpTagger(REGEXP_RULES, backoff=DefaultTagger("NN"))


def build_templates(spec: list[list[dict[str, Any]]]) -> list[Template]:
    features_per_template = []
    for feature_specs in spec:
        features = []
        for fs in feature_specs:
            cls = Pos if str(fs["kind"]) == "Pos" else Word
            features.append(cls([int(p) for p in fs["positions"]]))
        features_per_template.append(features)
    return [Template(*features) for features in features_per_template]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--payload")
    args = parser.parse_args()
    if not args.payload:
        raise SystemExit("--payload is required")

    payload = json.loads(args.payload)
    train = [
        [(str(token), str(tag)) for token, tag in sentence]
        for sentence in payload["train"]
    ]
    test_sents = [[str(token) for token in sentence] for sentence in payload["test"]]
    gold = [
        [(str(token), str(tag)) for token, tag in sentence]
        for sentence in payload.get("gold", [])
    ]

    results = []
    for config in payload["configs"]:
        templates = build_templates(config["templates"])
        trainer = BrillTaggerTrainer(
            build_initial_tagger(), templates, deterministic=True
        )
        tagger = trainer.train(
            train,
            max_rules=int(config.get("max_rules", 200)),
            min_score=int(config.get("min_score", 2)),
        )
        rules = [
            {
                "templateid": r.templateid,
                "original": r.original_tag,
                "replacement": r.replacement_tag,
                "repr": repr(r),
            }
            for r in tagger.rules()
        ]
        tagged = [
            [[token, tag] for token, tag in sent]
            for sent in tagger.tag_sents(test_sents)
        ]
        accuracy = round(float(tagger.evaluate(gold)), 12) if gold else None
        stats = tagger.train_stats()
        results.append(
            {
                "name": str(config["name"]),
                "rules": rules,
                "tagged": tagged,
                "accuracy": accuracy,
                "initialerrors": int(stats["initialerrors"]),
                "finalerrors": int(stats["finalerrors"]),
                "rulescores": [int(s) for s in stats["rulescores"]],
            }
        )

    print(json.dumps({"configs": results}))


if __name__ == "__main__":
    main()
