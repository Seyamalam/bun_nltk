#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json

from nltk.metrics.distance import edit_distance
from nltk.translate.bleu_score import corpus_bleu, sentence_bleu, SmoothingFunction


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--payload", required=True)
    args = parser.parse_args()
    payload = json.loads(args.payload)

    edits = payload.get("edits", []) or []
    refs = payload.get("refs", []) or []
    hyp = payload.get("hyp", []) or []
    corpus_refs = payload.get("corpus_refs", []) or []
    corpus_hyps = payload.get("corpus_hyps", []) or []

    smoother = SmoothingFunction().method1

    out = {
        "edit": [
            edit_distance(
                str(row.get("left", "")),
                str(row.get("right", "")),
                substitution_cost=int(row.get("substitution_cost", 1)),
                transpositions=bool(row.get("transpositions", False)),
            )
            for row in edits
        ],
        "sentence_bleu": sentence_bleu(refs, hyp, smoothing_function=smoother) if refs and hyp else 0.0,
        "corpus_bleu": corpus_bleu(corpus_refs, corpus_hyps, smoothing_function=smoother) if corpus_refs and corpus_hyps else 0.0,
    }
    print(json.dumps(out))


if __name__ == "__main__":
    main()

