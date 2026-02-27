#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path

TOKEN_RE = re.compile(r"[A-Za-z0-9']+")


def tokenize_ascii(text: str) -> list[str]:
    return [m.group(0) for m in TOKEN_RE.finditer(text)]


def has_digit(token: str) -> bool:
    return any(ch.isdigit() for ch in token)


def feats(tokens: list[str], i: int) -> list[str]:
    tok = tokens[i]
    low = tok.lower()
    prev = tokens[i - 1].lower() if i > 0 else "<BOS>"
    nxt = tokens[i + 1].lower() if i + 1 < len(tokens) else "<EOS>"
    return [
        "bias",
        f"w={low}",
        f"p1={low[:1]}",
        f"p2={low[:2]}",
        f"p3={low[:3]}",
        f"s1={low[-1:]}",
        f"s2={low[-2:]}",
        f"s3={low[-3:]}",
        f"prev={prev}",
        f"next={nxt}",
        f"is_upper={tok.isupper()}",
        f"is_title={tok[:1].isupper() if tok else False}",
        f"has_digit={has_digit(tok)}",
        f"has_hyphen={'-' in tok}",
    ]


def load_model(path: Path) -> dict:
    payload = json.loads(path.read_text(encoding="utf-8"))
    return {
        "tags": payload["tags"],
        "feature_index": payload["feature_index"],
        "feature_count": payload["feature_count"],
        "tag_count": payload["tag_count"],
        "weights": payload["weights"],
    }


def predict_tag_id(model: dict, feature_keys: list[str]) -> int:
    tc = model["tag_count"]
    scores = [0.0] * tc
    for key in feature_keys:
        fid = model["feature_index"].get(key)
        if fid is None:
            continue
        base = fid * tc
        row = model["weights"][base : base + tc]
        for i, w in enumerate(row):
            scores[i] += w
    best = 0
    best_score = scores[0]
    for i in range(1, tc):
        if scores[i] > best_score:
            best = i
            best_score = scores[i]
    return best


def run_baseline(text: str, model_path: Path, rounds: int = 1) -> dict:
    model = load_model(model_path)
    tokens = tokenize_ascii(text)
    tags: list[dict[str, str]] = []

    started = time.perf_counter()
    for _ in range(rounds):
        tags = []
        for i, token in enumerate(tokens):
            tag_id = predict_tag_id(model, feats(tokens, i))
            tags.append({"token": token, "tag": model["tags"][tag_id]})
    elapsed = time.perf_counter() - started

    return {
        "token_count": len(tokens),
        "tags": tags,
        "total_seconds": elapsed,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path)
    parser.add_argument("--text", type=str)
    parser.add_argument("--rounds", type=int, default=1)
    parser.add_argument("--model", type=Path, default=Path("models/perceptron_tagger_ascii.json"))
    args = parser.parse_args()

    if args.text is not None:
        source = args.text
    elif args.input is not None:
        source = args.input.read_text(encoding="utf-8")
    else:
        raise SystemExit("either --text or --input is required")

    print(json.dumps(run_baseline(source, args.model, args.rounds)))
