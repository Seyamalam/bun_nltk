#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from nltk.tokenize.punkt import PunktParameters, PunktSentenceTokenizer

ABBREVIATIONS = {
    "mr",
    "mrs",
    "ms",
    "dr",
    "prof",
    "sr",
    "jr",
    "st",
    "vs",
    "etc",
    "e.g",
    "i.e",
    "u.s",
    "u.k",
    "a.m",
    "p.m",
}


def build_tokenizer() -> PunktSentenceTokenizer:
    params = PunktParameters()
    params.abbrev_types = ABBREVIATIONS
    return PunktSentenceTokenizer(params)


def run_baseline(text: str, rounds: int = 1) -> dict:
    tok = build_tokenizer()
    sentences: list[str] = []
    started = time.perf_counter()
    for _ in range(rounds):
        sentences = tok.tokenize(text)
    elapsed = time.perf_counter() - started
    return {
        "sentence_count": len(sentences),
        "sentences": sentences,
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
