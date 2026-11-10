"""Pinned unmodified NLTK BLEU oracle; needs no corpus data."""
import json
import sys
import nltk
from nltk.translate.bleu_score import sentence_bleu, corpus_bleu, SmoothingFunction

assert sys.version_info[:3] == (3, 14, 4), sys.version
assert nltk.__version__ == "3.10.3", nltk.__version__

chen = SmoothingFunction()
SMOOTHERS = {f"method{i}": getattr(chen, f"method{i}") for i in range(8)}

results = []
for case in json.load(sys.stdin):
    weights = case.get("weights", [0.25, 0.25, 0.25, 0.25])
    smoothing = SMOOTHERS[case["smoothing"]] if case.get("smoothing") else None
    auto_reweigh = case.get("auto_reweigh", False)
    try:
        if case["kind"] == "sentence":
            score = sentence_bleu(case["references"], case["hypothesis"], weights, smoothing, auto_reweigh)
        else:
            score = corpus_bleu(case["list_of_references"], case["hypotheses"], weights, smoothing, auto_reweigh)
        results.append({"score": score})
    except AssertionError as error:
        results.append({"error": str(error)})
json.dump(results, sys.stdout)
