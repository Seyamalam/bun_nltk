#!/usr/bin/env python3
"""Python baseline for top-k bigram PMI over ASCII tokenization."""

from __future__ import annotations

import argparse
import json
import math
import re
import time
from collections import Counter
from pathlib import Path

TOKEN_RE = re.compile(r"[A-Za-z0-9']+")
FNV_OFFSET_BASIS = 14695981039346656037
FNV_PRIME = 1099511628211
MASK_64 = (1 << 64) - 1


def hash_token(token: str) -> int:
    h = FNV_OFFSET_BASIS
    for ch in token:
        h ^= ord(ch)
        h = (h * FNV_PRIME) & MASK_64
    return h


def tokenize_ascii(text: str) -> list[str]:
    return [m.group(0).lower() for m in TOKEN_RE.finditer(text)]


def run_baseline(text: str, top_k: int) -> dict:
    started = time.perf_counter()
    tokens = tokenize_ascii(text)
    hashes = [hash_token(token) for token in tokens]

    word_counts = Counter(hashes)
    bigram_counts: Counter[tuple[int, int]] = Counter(
        (hashes[i], hashes[i + 1]) for i in range(max(0, len(hashes) - 1))
    )

    scored = []
    token_total = len(hashes)
    for (left, right), count in bigram_counts.items():
        left_count = word_counts[left]
        right_count = word_counts[right]
        score = math.log2((count * token_total) / (left_count * right_count))
        scored.append((left, right, score))

    scored.sort(key=lambda x: (-x[2], x[0], x[1]))
    out = scored[:top_k]
    elapsed = time.perf_counter() - started

    top_serialized = [[str(left), str(right), score] for left, right, score in out]

    return {
        "total_seconds": elapsed,
        "top": top_serialized,
        "token_count": token_total,
        "unique_bigram_count": len(bigram_counts),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--top-k", type=int, default=50)
    args = parser.parse_args()

    text = args.input.read_text(encoding="utf-8")
    result = run_baseline(text, args.top_k)
    print(json.dumps(result))
