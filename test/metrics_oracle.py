"""Pinned behavioral oracle; no corpora are needed for these evaluation APIs."""
import importlib
import json
import math
import sys

import nltk

assert nltk.__version__ == "3.10.3", f"NLTK 3.10.3 required, got {nltk.__version__}"
distance = importlib.import_module("nltk.metrics.distance")
scores = importlib.import_module("nltk.metrics.scores")
segmentation = importlib.import_module("nltk.metrics.segmentation")
spearman = importlib.import_module("nltk.metrics.spearman")
ConfusionMatrix = importlib.import_module("nltk.metrics.confusionmatrix").ConfusionMatrix
DictionaryProbDist = importlib.import_module("nltk.probability").DictionaryProbDist
chrf = importlib.import_module("nltk.translate.chrf_score")
nist = importlib.import_module("nltk.translate.nist_score")


def decode(value):
    if value == "@nan":
        return float("nan")
    if value == "@inf":
        return float("inf")
    if value == "@-inf":
        return float("-inf")
    return value


def encode(value):
    if isinstance(value, float):
        if math.isnan(value):
            return "@nan"
        if math.isinf(value):
            return "@inf" if value > 0 else "@-inf"
        if value == 0 and math.copysign(1, value) < 0:
            return "@-zero"
    return value


def evaluate(case):
    op, args = case["op"], case["args"]
    if op in ("jaccard", "masi", "precision", "recall", "fmeasure", "presence", "fractional"):
        a, b = (set(args[0]), set(args[1]))
        if op == "jaccard":
            return distance.jaccard_distance(a, b)
        if op == "masi":
            return distance.masi_distance(a, b)
        if op == "precision":
            return scores.precision(a, b)
        if op == "recall":
            return scores.recall(a, b)
        if op == "fmeasure":
            return scores.f_measure(a, b, decode(args[2]))
        if op == "presence":
            return distance.presence(args[2])(a, b)
        return distance.fractional_presence(args[2])(a, b)
    if op == "binary":
        return distance.binary_distance(*args)
    if op == "interval":
        return distance.interval_distance(*map(decode, args))
    if op == "windowdiff":
        return segmentation.windowdiff(*args)
    if op == "pk":
        return segmentation.pk(*args)
    if op == "spearman":
        return spearman.spearman_correlation(*args)
    if op == "ranks":
        return list(spearman.ranks_from_scores(args[0], decode(args[1])))
    if op == "sequence":
        return list(spearman.ranks_from_sequence(args[0]))
    if op == "accuracy":
        return scores.accuracy(*args)
    if op == "confusion":
        cm = ConfusionMatrix(*args)
        labels = cm._values
        return {"labels": labels, "matrix": [[cm[a, b] for b in labels] for a in labels],
                "precision": [cm.precision(v) for v in labels],
                "recall": [cm.recall(v) for v in labels],
                "fmeasure": [cm.f_measure(v) for v in labels],
                "correct": cm._correct, "total": cm._total}
    if op == "loglik":
        return scores.log_likelihood(args[0], [DictionaryProbDist({k: decode(v) for k, v in dist.items()}) for dist in args[1]])
    if op == "chrf":
        return chrf.corpus_chrf(args[0], args[1], args[2], args[3], decode(args[4]), args[5])
    if op == "nist":
        return nist.corpus_nist(*args)
    if op == "nist_penalty":
        return nist.nist_length_penalty(*map(decode, args))
    raise ValueError(f"unknown oracle operation {op}")


results = []
for case in json.load(sys.stdin):
    try:
        results.append({"value": encode(evaluate(case))})
    except Exception as error:
        results.append({"error": type(error).__name__})
json.dump(results, sys.stdout, allow_nan=False)
