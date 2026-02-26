#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path

from nltk.tag import RegexpTagger

TOKEN_RE = re.compile(r"[A-Za-z0-9']+")

PATTERNS = [
    (r"^\d+$", "CD"),
    (r"(?i)^(i|you|he|she|it|we|they|me|him|her|us|them)$", "PRP"),
    (r"(?i)^(a|an|the|this|that|these|those)$", "DT"),
    (r"(?i)^(and|or|but|yet|nor)$", "CC"),
    (r"(?i)^(is|am|are|was|were|be|been|being|do|does|did|have|has|had)$", "VB"),
    (r"(?i).+ing$", "VBG"),
    (r"(?i).+ed$", "VBD"),
    (r"(?i).+ly$", "RB"),
    (r"^[A-Z].+", "NNP"),
    (r".*", "NN"),
]


def tokenize_ascii(text: str) -> list[str]:
    return [m.group(0) for m in TOKEN_RE.finditer(text)]


def run_baseline(text: str, rounds: int = 1) -> dict:
    tagger = RegexpTagger(PATTERNS)
    tokens = tokenize_ascii(text)
    tagged: list[tuple[str, str]] = []

    started = time.perf_counter()
    for _ in range(rounds):
        tagged = tagger.tag(tokens)
    elapsed = time.perf_counter() - started

    return {
        "token_count": len(tokens),
        "tags": [{"token": token, "tag": tag} for token, tag in tagged],
        "total_seconds": elapsed,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path)
    parser.add_argument("--text", type=str)
    parser.add_argument("--rounds", type=int, default=1)
    args = parser.parse_args()

    if args.text is not None:
        source = args.text
    elif args.input is not None:
        source = args.input.read_text(encoding="utf-8")
    else:
        raise SystemExit("either --text or --input is required")

    print(json.dumps(run_baseline(source, args.rounds)))
