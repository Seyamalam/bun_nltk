#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json

from nltk.metrics.agreement import AnnotationTask
from nltk.metrics.distance import binary_distance, interval_distance, masi_distance


def normalize(value: float) -> float:
    rounded = round(float(value), 10)
    return 0.0 if rounded == 0 else rounded


def build_task(case: dict) -> AnnotationTask:
    distance_name = case.get("distance", "binary")
    label_kind = case.get("label_kind", "scalar")
    data = []
    for coder, item, label in case["data"]:
        if label_kind == "sets":
            label = frozenset(label)
        elif label_kind == "numbers":
            label = int(label)
        data.append((coder, item, label))
    if distance_name == "masi":
        return AnnotationTask(data=data, distance=masi_distance)
    if distance_name == "interval":
        return AnnotationTask(data=data, distance=interval_distance)
    return AnnotationTask(data=data, distance=binary_distance)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--payload", required=True)
    args = parser.parse_args()
    payload = json.loads(args.payload)

    results: dict[str, dict[str, float]] = {}
    for case in payload["cases"]:
        task = build_task(case)
        case_result: dict[str, float] = {}
        for method in case.get("methods", []):
            case_result[method] = normalize(getattr(task, method)())
        for call in case.get("calls", []):
            case_result[call["name"]] = normalize(
                getattr(task, call["method"])(*call.get("args", []))
            )
        results[case["name"]] = case_result

    print(json.dumps(results))


if __name__ == "__main__":
    main()
