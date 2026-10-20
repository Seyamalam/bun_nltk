"""Version-pinned, unmodified NLTK oracle for matched feature-tree workloads."""
import hashlib
import json
import platform
import sys
import time

import nltk
from nltk.classify import DecisionTreeClassifier

assert nltk.__version__ == "3.10.3", nltk.__version__
with open(sys.argv[1], encoding="utf-8") as source:
    data = json.load(source)
options = data["options"]
started = time.perf_counter()
model = DecisionTreeClassifier.train(
    data["train"],
    binary=options["binary"],
    entropy_cutoff=options["entropyCutoff"],
    depth_cutoff=options["depthCutoff"],
    support_cutoff=options["supportCutoff"],
)
train_seconds = time.perf_counter() - started
started = time.perf_counter()
predictions = [model.classify(features) for features in data["probes"]]
predict_seconds = time.perf_counter() - started
print(json.dumps({
    "runtime": platform.python_version(),
    "nltk": nltk.__version__,
    "trainSeconds": train_seconds,
    "predictSeconds": predict_seconds,
    "predictionCount": len(predictions),
    "predictionsSha256": hashlib.sha256("\n".join(predictions).encode()).hexdigest(),
    "labels": sorted(model.labels()),
}))
