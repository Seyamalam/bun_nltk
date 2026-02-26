#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path

from nltk.stem import PorterStemmer

TOKEN_RE = re.compile(r"[A-Za-z0-9']+")


def tokenize_ascii(text: str) -> list[str]:
    return [m.group(0).lower() for m in TOKEN_RE.finditer(text)]


def run_baseline(text: str) -> dict:
    stemmer = PorterStemmer()
    tokens = tokenize_ascii(text)

    started = time.perf_counter()
    stems = [stemmer.stem(token) for token in tokens]
    elapsed = time.perf_counter() - started

    return {
        "token_count": len(tokens),
        "sample": stems[:50],
        "total_seconds": elapsed,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    args = parser.parse_args()

    text = args.input.read_text(encoding="utf-8")
    result = run_baseline(text)
    print(json.dumps(result))
