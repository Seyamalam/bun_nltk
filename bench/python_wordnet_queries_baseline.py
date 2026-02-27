#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
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


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--payload", required=True, type=Path)
    parser.add_argument("--queries", required=True)
    args = parser.parse_args()

    payload = json.loads(args.payload.read_text(encoding="utf-8"))
    queries = json.loads(args.queries)
    index = build_index(payload)

    out = []
    for row in queries:
        word = str(row["word"])
        pos = row.get("pos")
        root = morphy(word, pos)
        rows = index.get(root, [])
        if pos:
            rows = [item for item in rows if item.get("pos") == pos]
        out.append({"word": word, "pos": pos, "root": root, "count": len(rows)})

    print(json.dumps({"results": out}))


if __name__ == "__main__":
    main()
