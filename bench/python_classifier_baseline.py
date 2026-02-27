#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import time
from typing import Any

import nltk

TOKEN_RE = re.compile(r"[A-Za-z0-9']+")


def tokenize_ascii(text: str) -> list[str]:
    return [m.group(0).lower() for m in TOKEN_RE.finditer(text)]


def to_features(text: str) -> dict[str, int]:
    feats: dict[str, int] = {}
    for token in tokenize_ascii(text):
        key = f"tok={token}"
        feats[key] = feats.get(key, 0) + 1
    return feats


def parse_payload(args: argparse.Namespace) -> dict[str, Any]:
    if args.payload_file:
        return json.loads(open(args.payload_file, "r", encoding="utf-8").read())
    if args.payload:
        return json.loads(args.payload)
    raise SystemExit("either --payload or --payload-file is required")


def run(payload: dict[str, Any]) -> dict[str, Any]:
    train_rows = payload["train"]
    test_rows = payload["test"]
    rounds = int(payload.get("rounds", 1))

    train = [(to_features(str(row["text"])), str(row["label"])) for row in train_rows]
    test_feats = [(to_features(str(row["text"])), str(row["label"])) for row in test_rows]

    started = time.perf_counter()
    classifier = None
    for _ in range(max(1, rounds)):
        classifier = nltk.NaiveBayesClassifier.train(train)
    assert classifier is not None
    elapsed = time.perf_counter() - started

    predictions: list[str] = []
    correct = 0
    for feats, gold in test_feats:
        pred = str(classifier.classify(feats))
        predictions.append(pred)
        if pred == gold:
            correct += 1

    total = len(test_feats)
    accuracy = (correct / total) if total > 0 else 0.0
    return {
        "rounds": max(1, rounds),
        "train_size": len(train),
        "test_size": total,
        "accuracy": accuracy,
        "predictions": predictions,
        "total_seconds": elapsed,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--payload")
    parser.add_argument("--payload-file")
    args = parser.parse_args()
    payload = parse_payload(args)
    print(json.dumps(run(payload)))


if __name__ == "__main__":
    main()

