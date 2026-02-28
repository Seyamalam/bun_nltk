#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import time
from typing import Any

from nltk.classify import PositiveNaiveBayesClassifier

TOKEN_RE = re.compile(r"[A-Za-z0-9']+")


def tokenize_ascii(text: str) -> list[str]:
    return [m.group(0).lower() for m in TOKEN_RE.finditer(text)]


def to_features(text: str) -> dict[str, bool]:
    feats: dict[str, bool] = {}
    for token in tokenize_ascii(text):
        feats[f"tok={token}"] = True
    return feats


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

    positive_rows = payload["positive"]
    unlabeled_rows = payload["unlabeled"]
    test_rows = payload["test"]
    rounds = int(payload.get("rounds", 1))
    prior = float(payload.get("positive_prior", 0.5))
    positive_label = str(payload.get("positive_label", "pos"))
    negative_label = str(payload.get("negative_label", "neg"))

    positive = [to_features(str(row["text"]) if isinstance(row, dict) else str(row)) for row in positive_rows]
    unlabeled = [to_features(str(row["text"]) if isinstance(row, dict) else str(row)) for row in unlabeled_rows]
    test = [(to_features(str(row["text"])), str(row["label"])) for row in test_rows]

    classifier = None
    started = time.perf_counter()
    for _ in range(max(1, rounds)):
        classifier = PositiveNaiveBayesClassifier.train(positive, unlabeled, positive_prob_prior=prior)
    elapsed = time.perf_counter() - started
    assert classifier is not None

    predictions: list[str] = []
    correct = 0
    for feats, gold in test:
        pred_bool = bool(classifier.classify(feats))
        pred = positive_label if pred_bool else negative_label
        predictions.append(pred)
        if pred == gold:
            correct += 1
    total = len(test)
    accuracy = (correct / total) if total > 0 else 0.0

    print(
        json.dumps(
            {
                "positive_size": len(positive),
                "unlabeled_size": len(unlabeled),
                "test_size": total,
                "accuracy": accuracy,
                "predictions": predictions,
                "total_seconds": elapsed,
            }
        )
    )


if __name__ == "__main__":
    main()
