#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import time
from typing import Any

from nltk.classify import ConditionalExponentialClassifier

TOKEN_RE = re.compile(r"[A-Za-z0-9']+")


def tokenize_ascii(text: str) -> list[str]:
    return [m.group(0).lower() for m in TOKEN_RE.finditer(text)]


def to_features(text: str) -> dict[str, float]:
    feats: dict[str, float] = {}
    for token in tokenize_ascii(text):
        key = f"tok={token}"
        feats[key] = feats.get(key, 0.0) + 1.0
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

    train_rows = payload["train"]
    test_rows = payload["test"]
    max_iter = int(payload.get("max_iter", 12))

    train = [(to_features(str(row["text"])), str(row["label"])) for row in train_rows]
    test = [(to_features(str(row["text"])), str(row["label"])) for row in test_rows]

    started = time.perf_counter()
    classifier = ConditionalExponentialClassifier.train(train, trace=0, max_iter=max_iter)
    elapsed = time.perf_counter() - started

    predictions: list[str] = []
    correct = 0
    for feats, gold in test:
        pred = str(classifier.classify(feats))
        predictions.append(pred)
        if pred == gold:
            correct += 1

    total = len(test)
    accuracy = (correct / total) if total > 0 else 0.0
    print(
        json.dumps(
            {
                "train_size": len(train),
                "test_size": total,
                "accuracy": accuracy,
                "predictions": predictions,
                "total_seconds": elapsed,
            }
        )
    )


if __name__ == "__main__":
    main()
