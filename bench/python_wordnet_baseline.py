#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path
from typing import Any


def normalize(lemma: str) -> str:
    return lemma.lower().replace(" ", "_")


def noun_morph(word: str) -> str:
    if word.endswith("ies") and len(word) > 3:
        return word[:-3] + "y"
    if word.endswith("ves") and len(word) > 3:
        return word[:-3] + "f"
    if word.endswith("es") and len(word) > 2:
        return word[:-2]
    if word.endswith("s") and len(word) > 1:
        return word[:-1]
    return word


def verb_morph(word: str) -> str:
    if word.endswith("ies") and len(word) > 3:
        return word[:-3] + "y"
    if word.endswith("ing") and len(word) > 4:
        return word[:-3]
    if word.endswith("ed") and len(word) > 3:
        return word[:-2]
    if word.endswith("s") and len(word) > 1:
        return word[:-1]
    return word


def adjective_morph(word: str) -> str:
    if word.endswith("est") and len(word) > 3:
        return word[:-3]
    if word.endswith("er") and len(word) > 2:
        return word[:-2]
    return word


def morphy(word: str, pos: str | None) -> str:
    w = normalize(word)
    if pos == "n":
        return noun_morph(w)
    if pos == "v":
        return verb_morph(w)
    if pos == "a":
        return adjective_morph(w)
    if pos == "r":
        return w
    return noun_morph(w)


def build_index(payload: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    out: dict[str, list[dict[str, Any]]] = {}
    for syn in payload["synsets"]:
        for lemma in syn["lemmas"]:
            key = normalize(str(lemma))
            out.setdefault(key, []).append(syn)
    return out


def run(payload_path: Path, rounds: int) -> dict[str, Any]:
    payload = json.loads(payload_path.read_text(encoding="utf-8"))
    index = build_index(payload)

    queries = []
    for lemma in sorted(index.keys()):
        queries.append((lemma, None))
        queries.append((f"{lemma}s", "n"))
        queries.append((f"{lemma}ed", "v"))
        if len(queries) >= 1200:
            break

    checksum = 0
    started = time.perf_counter()
    for _ in range(rounds):
        checksum = 0
        for word, pos in queries:
            root = morphy(word, pos)
            rows = index.get(root, [])
            if pos:
                rows = [row for row in rows if row.get("pos") == pos]
            checksum += len(root) + len(rows)
            if rows:
                first = rows[0]
                checksum += len(first.get("hypernyms", [])) + len(first.get("hyponyms", []))
    elapsed = time.perf_counter() - started
    return {"operations": len(queries), "checksum": checksum, "total_seconds": elapsed}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--payload", required=True, type=Path)
    parser.add_argument("--rounds", type=int, default=8)
    args = parser.parse_args()
    print(json.dumps(run(args.payload, args.rounds)))

