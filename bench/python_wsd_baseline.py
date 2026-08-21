#!/usr/bin/env python3
"""WSD (Lesk) parity baseline.

Runs the real ``nltk.wsd.lesk`` implementation. Because the JS side uses the
repo's bundled WordNet payload (not the full nltk corpus), each case ships its
own candidate synset list extracted from that payload; the baseline wraps them
in lightweight objects exposing ``definition()`` / ``pos()`` — exactly the two
attributes nltk's lesk reads — so the genuine NLTK lesk code path scores them.
"""
from __future__ import annotations

import argparse
import json
import re


class PayloadSynset:
    def __init__(self, row: dict):
        self._row = row

    def definition(self) -> str:
        # Mirror nltk's gloss parsing: drop quoted examples, strip "; ".
        without_examples = re.sub(r'["].*?["]', "", str(self._row.get("gloss", "")))
        return without_examples.strip().strip("; ").strip()

    def pos(self) -> str:
        return str(self._row.get("pos", ""))

    def name(self) -> str:
        return str(self._row["id"])


def run_real_wordnet_sanity() -> dict:
    try:
        from nltk.wsd import lesk as nltk_lesk

        bank = ["I", "went", "to", "the", "bank", "to", "deposit", "money", "."]
        able = "people should be able to marry a person of their choice".split()
        return {
            "bank_n": str(nltk_lesk(bank, "bank", "n")),
            "bank_any": str(nltk_lesk(bank, "bank")),
            "able_any": str(nltk_lesk(able, "able")),
            "able_a": str(nltk_lesk(able, "able", "a")),
            "empty_synsets": (
                str(nltk_lesk("John loves Mary".split(), "loves", synsets=[]))
                if nltk_lesk("John loves Mary".split(), "loves", synsets=[]) is not None
                else None
            ),
        }
    except Exception as exc:  # noqa: BLE001 - report availability instead of failing
        return {"unavailable": f"{type(exc).__name__}: {exc}"}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--payload", required=True)
    parser.add_argument("--sanity", action="store_true")
    args = parser.parse_args()

    payload = json.loads(args.payload)
    from nltk.wsd import lesk as nltk_lesk

    results = []
    for case in payload.get("cases", []):
        context = [str(token) for token in case["context"]]
        word = str(case["word"])
        pos = case.get("pos")
        synsets = [PayloadSynset(row) for row in case.get("synsets", [])]
        sense = nltk_lesk(context, word, pos=pos, synsets=synsets)
        results.append({"id": case.get("id"), "sense": None if sense is None else sense.name()})

    out = {"results": results}
    if args.sanity:
        out["real_wordnet_sanity"] = run_real_wordnet_sanity()
    print(json.dumps(out))


if __name__ == "__main__":
    main()
