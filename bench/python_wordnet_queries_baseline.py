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


def build_by_id(payload: dict[str, Any]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for syn in payload["synsets"]:
        out[str(syn["id"])] = syn
    return out


def load_payload(path: Path) -> dict[str, Any]:
    raw = path.read_bytes()
    if raw.startswith(b"BNWN1"):
        if len(raw) < 9:
            raise ValueError("invalid BNWN1 payload: truncated header")
        payload_len = int.from_bytes(raw[5:9], byteorder="little", signed=False)
        start = 9
        end = start + payload_len
        if end > len(raw):
            raise ValueError("invalid BNWN1 payload: length out of range")
        return json.loads(raw[start:end].decode("utf-8"))
    return json.loads(raw.decode("utf-8"))


def hypernyms(by_id: dict[str, dict[str, Any]], syn_id: str) -> list[str]:
    syn = by_id.get(syn_id)
    if syn is None:
        return []
    out = [str(i) for i in syn.get("hypernyms", []) if str(i) in by_id]
    out.sort()
    return out


def hyponyms(by_id: dict[str, dict[str, Any]], syn_id: str) -> list[str]:
    syn = by_id.get(syn_id)
    if syn is None:
        return []
    out = [str(i) for i in syn.get("hyponyms", []) if str(i) in by_id]
    out.sort()
    return out


def similar_to(by_id: dict[str, dict[str, Any]], syn_id: str) -> list[str]:
    syn = by_id.get(syn_id)
    if syn is None:
        return []
    out = [str(i) for i in syn.get("similarTo", []) if str(i) in by_id]
    out.sort()
    return out


def antonyms(by_id: dict[str, dict[str, Any]], syn_id: str) -> list[str]:
    syn = by_id.get(syn_id)
    if syn is None:
        return []
    out = [str(i) for i in syn.get("antonyms", []) if str(i) in by_id]
    out.sort()
    return out


def hypernym_paths(by_id: dict[str, dict[str, Any]], syn_id: str, max_depth: int = 32) -> list[list[str]]:
    if syn_id not in by_id:
        return []
    out: list[list[str]] = []

    def visit(node_id: str, path: list[str], seen: set[str], depth: int) -> None:
        next_path = [*path, node_id]
        parents = [p for p in hypernyms(by_id, node_id) if p not in seen]
        if len(parents) == 0 or depth >= max_depth:
            out.append(next_path)
            return
        for parent in parents:
            visit(parent, next_path, {*seen, parent}, depth + 1)

    visit(syn_id, [], {syn_id}, 0)
    return out


def shortest_distance(by_id: dict[str, dict[str, Any]], left: str, right: str, max_depth: int = 64) -> int | None:
    if left not in by_id or right not in by_id:
        return None
    if left == right:
        return 0

    queue: list[tuple[str, int]] = [(left, 0)]
    head = 0
    seen: set[str] = {left}
    while head < len(queue):
        node_id, depth = queue[head]
        head += 1
        if depth >= max_depth:
            continue
        neighbors = sorted(set(hypernyms(by_id, node_id) + hyponyms(by_id, node_id)))
        for nxt in neighbors:
            if nxt == right:
                return depth + 1
            if nxt in seen:
                continue
            seen.add(nxt)
            queue.append((nxt, depth + 1))
    return None


def lch(by_id: dict[str, dict[str, Any]], left: str, right: str, max_depth: int = 64) -> list[str]:
    if left not in by_id or right not in by_id:
        return []

    def ancestors(start: str) -> dict[str, int]:
        out: dict[str, int] = {}
        queue: list[tuple[str, int]] = [(start, 0)]
        head = 0
        while head < len(queue):
            node_id, depth = queue[head]
            head += 1
            prev = out.get(node_id)
            if prev is not None and prev <= depth:
                continue
            out[node_id] = depth
            if depth >= max_depth:
                continue
            for parent in hypernyms(by_id, node_id):
                queue.append((parent, depth + 1))
        return out

    l = ancestors(left)
    r = ancestors(right)
    best = None
    ids: list[str] = []
    for syn_id, ld in l.items():
        rd = r.get(syn_id)
        if rd is None:
            continue
        score = ld + rd
        if best is None or score < best:
            best = score
            ids = [syn_id]
        elif score == best:
            ids.append(syn_id)
    ids.sort()
    return ids


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--payload", required=True, type=Path)
    parser.add_argument("--queries", required=True)
    args = parser.parse_args()

    payload = load_payload(args.payload)
    queries = json.loads(args.queries)
    index = build_index(payload)
    by_id = build_by_id(payload)

    out = []
    for row in queries:
        word = str(row["word"])
        pos = row.get("pos")
        root = morphy(word, pos)
        rows = index.get(root, [])
        if pos:
            rows = [item for item in rows if item.get("pos") == pos]
        first_id = str(rows[0]["id"]) if len(rows) > 0 and "id" in rows[0] else None
        first_hypernyms = hypernyms(by_id, first_id) if first_id else []
        first_hyponyms = hyponyms(by_id, first_id) if first_id else []
        first_similar = similar_to(by_id, first_id) if first_id else []
        first_antonyms = antonyms(by_id, first_id) if first_id else []
        first_paths = hypernym_paths(by_id, first_id, 16) if first_id else []
        out.append(
            {
                "word": word,
                "pos": pos,
                "root": root,
                "count": len(rows),
                "first_id": first_id,
                "first_hypernyms": first_hypernyms,
                "first_hyponyms": first_hyponyms,
                "first_similar": first_similar,
                "first_antonyms": first_antonyms,
                "first_path_depth": (len(first_paths[0]) - 1) if len(first_paths) > 0 else None,
            }
        )

    dog = next((r for r in out if r.get("word") == "dog"), None)
    cat = next((r for r in out if r.get("word") == "cat"), None)
    dog_id = str(dog["first_id"]) if dog and dog.get("first_id") else None
    cat_id = str(cat["first_id"]) if cat and cat.get("first_id") else None
    dist = shortest_distance(by_id, dog_id, cat_id) if dog_id and cat_id else None
    sim = (1.0 / (dist + 1)) if dist is not None else None
    common = lch(by_id, dog_id, cat_id) if dog_id and cat_id else []
    print(
        json.dumps(
            {
                "results": out,
                "relations": {
                    "dog_cat_distance": dist,
                    "dog_cat_similarity": sim,
                    "dog_cat_lch": common,
                },
            }
        )
    )


if __name__ == "__main__":
    main()
