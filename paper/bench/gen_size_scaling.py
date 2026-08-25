#!/usr/bin/env python3
"""Generate size-scaled prose files for the scaling study.

Builds data/prose_{10,100,1024,10240}kb.txt deterministically from the nltk
movie_reviews corpus (fixed seed 1337, same pattern as gen_datasets.py).
"""
from __future__ import annotations

import os
import random

DATA = os.path.join(os.path.dirname(__file__), "data")
SIZES = [10_000, 100_000, 1_000_000, 10_000_000]


def main() -> None:
    from nltk.corpus import movie_reviews

    rng = random.Random(1337)
    fileids = list(movie_reviews.fileids())
    rng.shuffle(fileids)

    # Concatenate the whole shuffled stream, repeating deterministically if the
    # corpus is too small for the largest target.
    full: list[str] = []
    total = 0
    passes = 0
    while total < max(SIZES) * 1.05:
        rng.shuffle(fileids)
        for fid in fileids:
            text = movie_reviews.raw(fid)
            full.append(text)
            total += len(text)
        passes += 1
        if passes > 10:
            break
    stream = "\n".join(full)
    print(f"movie_reviews stream: {len(stream)} chars")

    for target in SIZES:
        kb = target // 1000
        piece = stream[:target]
        last_stop = max(piece.rfind("."), piece.rfind("!"), piece.rfind("?"))
        if last_stop > target - 5000:
            piece = piece[: last_stop + 1]
        path = os.path.join(DATA, f"prose_{kb}kb.txt")
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(piece)
        print(f"prose_{kb}kb.txt: {len(piece)} chars")


if __name__ == "__main__":
    main()
