"""Pinned, resource-free NLTK lifecycle baseline; task bytes supplied by JS runner."""
import hashlib
import json
import platform
import resource
import sys
import time


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()


def memory():
    return {"peakRssBytes": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * (1 if sys.platform == "darwin" else 1024)}


def main():
    started = time.perf_counter()
    before = memory()
    import_start = time.perf_counter()
    import nltk
    from nltk.metrics.distance import edit_distance
    from nltk.tokenize import WordPunctTokenizer, RegexpTokenizer
    assert nltk.__version__ == "3.10.3", nltk.__version__
    assert platform.python_version() == "3.14.4", platform.python_version()
    import_seconds = time.perf_counter() - import_start
    payload = json.load(sys.stdin)
    tasks = payload["tasks"]
    tokenizer = WordPunctTokenizer()
    # Match the project's explicitly ASCII aggregate contract, not word_tokenize.
    ascii_tokenizer = RegexpTokenizer(r"[A-Za-z0-9']+")

    def run(task):
        if task["kind"] == "wordpunct":
            return tokenizer.tokenize(task["text"])
        if task["kind"] == "distance":
            return [edit_distance(a, b) for a, b in task["pairs"]]
        tokens = [t.lower() for t in ascii_tokenizer.tokenize(task["text"])]
        grams = list(nltk.ngrams(tokens, task["order"]))
        return [len(tokens), len(nltk.FreqDist(tokens)), len(grams), len(nltk.FreqDist(grams))]

    first_start = time.perf_counter()
    first = run(tasks[0])
    first_seconds = time.perf_counter() - first_start
    cold_seconds = time.perf_counter() - started
    print(json.dumps({"phase": "cold-ready"}), flush=True)
    after_first = memory()
    rows = []
    for i, task in enumerate(tasks):
        expected = first if i == 0 else run(task)
        output_hash = digest(expected)
        run(task)
        samples = []
        for _ in range(payload["rounds"]):
            start = time.perf_counter()
            for _ in range(payload["repetitions"]):
                output = run(task)
            samples.append(time.perf_counter() - start)
            assert digest(output) == output_hash, task["id"]
        rows.append({"id": task["id"], "inputSha256": digest(task), "outputSha256": output_hash,
                     "samplesSeconds": samples, "repetitions": payload["repetitions"]})
    print(json.dumps({"phase": "result", "runtime": sys.version, "pythonVersion": platform.python_version(), "nltk": nltk.__version__,
                      "importSeconds": import_seconds, "fetchSeconds": None, "initSeconds": None,
                      "firstCallSeconds": first_seconds, "coldSeconds": cold_seconds,
                      "peakRssBytes": memory()["peakRssBytes"],
                      "memory": {"before": before, "afterFirst": after_first, "afterSteady": memory(),
                                 "afterDispose": None, "wasmLinearMemoryBytes": None}, "results": rows}), flush=True)


if __name__ == "__main__":
    main()
