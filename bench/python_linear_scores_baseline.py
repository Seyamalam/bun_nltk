#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import time
from typing import Any


def parse_payload(args: argparse.Namespace) -> dict[str, Any]:
    if args.payload_file:
        with open(args.payload_file, "r", encoding="utf-8") as f:
            return json.load(f)
    if args.payload:
        return json.loads(args.payload)
    raise SystemExit("either --payload or --payload-file is required")


def linear_scores(
    doc_offsets: list[int],
    feature_ids: list[int],
    feature_values: list[float],
    class_count: int,
    feature_count: int,
    weights: list[float],
    bias: list[float],
) -> list[float]:
    doc_count = max(0, len(doc_offsets) - 1)
    out = [0.0] * (doc_count * class_count)
    for d in range(doc_count):
        start = int(doc_offsets[d])
        end = int(doc_offsets[d + 1])
        base = d * class_count
        for c in range(class_count):
            out[base + c] = float(bias[c])
        for i in range(start, end):
            fid = int(feature_ids[i])
            if fid < 0 or fid >= feature_count:
                continue
            value = float(feature_values[i])
            for c in range(class_count):
                out[base + c] += weights[c * feature_count + fid] * value
    return out


def checksum(values: list[float]) -> float:
    acc = 0.0
    for i, value in enumerate(values):
        acc += value * ((i % 97) + 1)
    return acc


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--payload")
    parser.add_argument("--payload-file")
    args = parser.parse_args()
    payload = parse_payload(args)

    doc_offsets = [int(v) for v in payload["doc_offsets"]]
    feature_ids = [int(v) for v in payload["feature_ids"]]
    feature_values = [float(v) for v in payload["feature_values"]]
    class_count = int(payload["class_count"])
    feature_count = int(payload["feature_count"])
    weights = [float(v) for v in payload["weights"]]
    bias = [float(v) for v in payload["bias"]]
    rounds = max(1, int(payload.get("rounds", 1)))

    out: list[float] = []
    started = time.perf_counter()
    for _ in range(rounds):
        out = linear_scores(
            doc_offsets,
            feature_ids,
            feature_values,
            class_count,
            feature_count,
            weights,
            bias,
        )
    elapsed = time.perf_counter() - started

    print(
        json.dumps(
            {
                "rounds": rounds,
                "doc_count": max(0, len(doc_offsets) - 1),
                "nnz": len(feature_ids),
                "class_count": class_count,
                "feature_count": feature_count,
                "total_seconds": elapsed,
                "checksum": checksum(out),
            }
        )
    )


if __name__ == "__main__":
    main()
