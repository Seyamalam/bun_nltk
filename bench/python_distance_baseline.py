#!/usr/bin/env python3
"""Python baseline for distance-metrics parity (real nltk 3.10.3 functions)."""
from __future__ import annotations

import argparse
import json

from nltk.metrics.distance import (
    binary_distance,
    edit_distance_align,
    interval_distance,
    jaccard_distance,
    masi_distance,
)
from nltk.metrics.scores import f_measure, log_likelihood, precision, recall
from nltk.metrics.segmentation import pk, windowdiff
from nltk.metrics.spearman import spearman_correlation
from nltk.probability import DictionaryProbDist


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--payload", required=True)
    args = parser.parse_args()
    p = json.loads(args.payload)

    out: dict = {}
    out["jaccard"] = [jaccard_distance(set(a), set(b)) for a, b in p["jaccard_pairs"]]
    out["masi"] = [masi_distance(set(a), set(b)) for a, b in p["masi_pairs"]]
    out["binary"] = [binary_distance(a, b) for a, b in p["binary_pairs"]]
    out["interval"] = [interval_distance(a, b) for a, b in p["interval_pairs"]]
    out["align"] = [
        [[int(i), int(j)] for i, j in edit_distance_align(s1, s2)]
        for s1, s2 in p["align_pairs"]
    ]
    out["precision"] = [precision(set(r), set(t)) for r, t in p["prf_pairs"]]
    out["recall"] = [recall(set(r), set(t)) for r, t in p["prf_pairs"]]
    out["f_measure"] = [
        f_measure(set(r), set(t), alpha=alpha)
        for r, t, alpha in p["prf_alpha_cases"]
    ]

    loglik = []
    for reference, dists in p["loglik_cases"]:
        pdists = [DictionaryProbDist(d) for d in dists]
        loglik.append(log_likelihood(reference, pdists))
    out["loglik"] = loglik

    out["windowdiff"] = [
        windowdiff(seg1, seg2, k, boundary, weighted)
        for seg1, seg2, k, boundary, weighted in p["windowdiff_cases"]
    ]
    out["pk"] = [
        pk(ref, hyp, None if k is None else int(k), boundary)
        for ref, hyp, k, boundary in p["pk_cases"]
    ]
    out["spearman"] = [
        spearman_correlation(ranks1, ranks2) for ranks1, ranks2 in p["spearman_cases"]
    ]

    print(json.dumps(out))


if __name__ == "__main__":
    main()
