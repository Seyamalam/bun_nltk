#!/usr/bin/env python3
"""Generate a reproducible synthetic NLP corpus with mixed token patterns."""

from __future__ import annotations

import argparse
import random
from pathlib import Path

EMOJI = [
    "😀",
    "😂",
    "🤖",
    "📚",
    "🚀",
    "🧠",
    "🔥",
    "👨‍👩‍👧‍👧",
    "👩🏾‍🎓",
    "🙅🏽",
]

MULTILINGUAL = [
    "resumé",
    "España",
    "München",
    "français",
    "東京",
    "العربية",
    "हिन्दी",
    "português",
    "naïve",
    "façade",
]

HASHTAGS = ["#nlp", "#research", "#ai", "#ziglang", "#bun", "#nodejs"]
HANDLES = ["@alice", "@bob", "@ml_lab", "@nlp_team", "@dev"]
URLS = [
    "https://example.com/paper/123",
    "https://doi.org/10.1000/182",
    "https://arxiv.org/abs/1706.03762",
]

SYLLABLES = [
    "al",
    "be",
    "con",
    "de",
    "ex",
    "for",
    "gen",
    "hyp",
    "in",
    "jor",
    "ka",
    "lin",
    "micro",
    "neo",
    "op",
    "pre",
    "qua",
    "re",
    "syn",
    "tri",
]

PUNCT = [",", ".", "!", "?", ";", ":"]


def make_word(rng: random.Random) -> str:
    syll_count = rng.choices([1, 2, 3, 4], weights=[5, 10, 6, 2], k=1)[0]
    word = "".join(rng.choice(SYLLABLES) for _ in range(syll_count))
    if rng.random() < 0.08:
        word += "'s"
    if rng.random() < 0.05:
        word = word.capitalize()
    return word


def make_token(rng: random.Random) -> str:
    branch = rng.random()
    if branch < 0.62:
        return make_word(rng)
    if branch < 0.72:
        return str(rng.randint(0, 999_999_999))
    if branch < 0.79:
        return rng.choice(MULTILINGUAL)
    if branch < 0.85:
        return rng.choice(HASHTAGS)
    if branch < 0.90:
        return rng.choice(HANDLES)
    if branch < 0.95:
        return rng.choice(URLS)
    return rng.choice(EMOJI)


def make_sentence(rng: random.Random) -> str:
    token_count = rng.randint(10, 44)
    tokens = [make_token(rng) for _ in range(token_count)]

    for i in range(1, len(tokens), rng.randint(4, 9)):
        tokens[i] += rng.choice(PUNCT)

    if rng.random() < 0.35:
        insert_at = rng.randint(0, len(tokens) - 1)
        tokens.insert(insert_at, f"{rng.randint(100,999)}-{rng.randint(100,999)}-{rng.randint(1000,9999)}")

    sentence = " ".join(tokens)
    if sentence[-1] not in ".!?":
        sentence += rng.choice([".", "!", "?"])
    return sentence


def generate(size_mb: int, seed: int, output: Path) -> None:
    rng = random.Random(seed)
    target_bytes = size_mb * 1024 * 1024

    output.parent.mkdir(parents=True, exist_ok=True)
    written = 0
    with output.open("w", encoding="utf-8") as f:
        while written < target_bytes:
            sentence = make_sentence(rng)
            f.write(sentence)
            f.write("\n")
            written += len(sentence.encode("utf-8")) + 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--size-mb", type=int, default=64)
    parser.add_argument("--seed", type=int, default=1337)
    parser.add_argument("--out", type=Path, default=Path("bench/datasets/synthetic.txt"))
    args = parser.parse_args()

    generate(args.size_mb, args.seed, args.out)
    print(f"generated: {args.out} ({args.size_mb} MB target)")
