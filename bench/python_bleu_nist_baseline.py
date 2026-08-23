#!/usr/bin/env python3
"""Python NLTK baseline for BLEU/NIST wasm parity.

Reads --payload JSON: [{id, references: [[[tok,...],...],...], hypotheses: [[tok,...],...], max_order}]
Prints ONE JSON line: {"bleu": [...], "nist": [...]} using unsmoothed corpus BLEU
(closest ref length) and corpus NIST with n=5, matching nltk defaults.
"""
from __future__ import annotations

import argparse
import json
import math

from nltk.translate.bleu_score import corpus_bleu
from nltk.translate.nist_score import corpus_nist


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--payload", required=True)
    args = parser.parse_args()
    cases = json.loads(args.payload)

    bleu_scores = []
    nist_scores = []
    for case in cases:
        references = case["references"]
        hypotheses = case["hypotheses"]
        max_order = int(case.get("max_order", 4))

        # Unsmoothed corpus BLEU with weights up to max_order.
        weights = tuple([1.0 / max_order] * max_order)
        try:
            bleu = corpus_bleu(references, hypotheses, weights=weights)
        except ZeroDivisionError:
            bleu = 0.0
        # NLTK emits a warning and returns 0 for zero n-gram overlaps; align JS.
        if math.isnan(bleu):
            bleu = 0.0
        bleu_scores.append(bleu)

        try:
            nist = corpus_nist(references, hypotheses, n=5)
        except ZeroDivisionError:
            nist = 0.0
        if isinstance(nist, complex):
            nist = nist.real
        nist_scores.append(nist)

    print(json.dumps({"bleu": bleu_scores, "nist": nist_scores}))


if __name__ == "__main__":
    main()
