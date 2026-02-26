#!/usr/bin/env python3
"""Python baseline for ASCII token and n-gram counting."""

from __future__ import annotations

import argparse
import json
import re
import time
from collections import Counter
from pathlib import Path

TOKEN_RE = re.compile(r"[A-Za-z0-9']+")


def tokenize_ascii(text: str) -> list[str]:
    return [m.group(0).lower() for m in TOKEN_RE.finditer(text)]


def run_baseline(text: str, n: int) -> dict[str, float | int]:
    started = time.perf_counter()
    tokens = tokenize_ascii(text)
    tokenized_sec = time.perf_counter() - started

    started = time.perf_counter()
    token_counts = Counter(tokens)
    if n <= 0:
        raise ValueError("n must be positive")
    ngrams = Counter(tuple(tokens[i : i + n]) for i in range(0, max(0, len(tokens) - n + 1)))
    counted_sec = time.perf_counter() - started

    return {
        "tokens": len(tokens),
        "unique_tokens": len(token_counts),
        "ngrams": max(0, len(tokens) - n + 1),
        "unique_ngrams": len(ngrams),
        "tokenize_seconds": tokenized_sec,
        "count_seconds": counted_sec,
        "total_seconds": tokenized_sec + counted_sec,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--n", type=int, default=2)
    args = parser.parse_args()

    text = args.input.read_text(encoding="utf-8")
    result = run_baseline(text, args.n)
    print(json.dumps(result))
