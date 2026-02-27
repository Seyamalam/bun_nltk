#!/usr/bin/env python3
"""Python baseline for streaming-like FreqDist/ConditionalFreqDist workload."""

from __future__ import annotations

import argparse
import json
import re
import time
from collections import Counter
from pathlib import Path

TOKEN_RE = re.compile(r"[A-Za-z0-9']+")
FNV_OFFSET_BASIS = 14695981039346656037
FNV_PRIME = 1099511628211
MASK_64 = (1 << 64) - 1

PRONOUNS = {"i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them"}
DETERMINERS = {"a", "an", "the", "this", "that", "these", "those"}
CONJUNCTIONS = {"and", "or", "but", "yet", "nor"}
VERB_BASE = {"is", "am", "are", "was", "were", "be", "been", "being", "do", "does", "did", "have", "has", "had"}


def hash_token(token: str) -> int:
    h = FNV_OFFSET_BASIS
    for ch in token:
        c = ord(ch)
        if 65 <= c <= 90:
            c += 32
        h ^= c
        h = (h * FNV_PRIME) & MASK_64
    return h


def classify_tag_id(token: str, token_hash: int) -> int:
    lower = token.lower()
    if token.isdigit():
        return 2
    if lower in PRONOUNS:
        return 8
    if lower in DETERMINERS:
        return 6
    if lower in CONJUNCTIONS:
        return 7
    if lower in VERB_BASE:
        return 9
    if lower.endswith("ing"):
        return 3
    if lower.endswith("ed"):
        return 4
    if lower.endswith("ly"):
        return 5
    if len(token) > 1 and token[0].isupper():
        return 1
    return 0


def run_baseline(text: str, chunk_size: int) -> dict:
    tokens = [m.group(0) for m in TOKEN_RE.finditer(text)]

    started = time.perf_counter()
    token_counts: Counter[int] = Counter()
    bigram_counts: Counter[tuple[int, int]] = Counter()
    conditional_counts: Counter[tuple[int, int]] = Counter()
    prev_hash: int | None = None

    for i in range(0, len(tokens), max(1, chunk_size)):
        chunk = tokens[i : i + max(1, chunk_size)]
        for token in chunk:
            token_hash = hash_token(token)
            token_counts[token_hash] += 1
            if prev_hash is not None:
                bigram_counts[(prev_hash, token_hash)] += 1
            tag_id = classify_tag_id(token, token_hash)
            conditional_counts[(tag_id, token_hash)] += 1
            prev_hash = token_hash

    elapsed = time.perf_counter() - started

    return {
        "token_unique": len(token_counts),
        "token_total": sum(token_counts.values()),
        "bigram_unique": len(bigram_counts),
        "bigram_total": sum(bigram_counts.values()),
        "conditional_unique": len(conditional_counts),
        "conditional_total": sum(conditional_counts.values()),
        "total_seconds": elapsed,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--chunk-size", type=int, default=2048)
    args = parser.parse_args()

    source = args.input.read_text(encoding="utf-8")
    print(json.dumps(run_baseline(source, args.chunk_size)))
