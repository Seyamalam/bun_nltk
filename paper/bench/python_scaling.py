#!/usr/bin/env python3
"""Python NLTK side of the scaling study (Part A sizes + Part B real corpora).

Median of 5 after 2 warmups. Prints one JSON object to stdout.
Run: .venv/bin/python3 paper/bench/python_scaling.py
"""
from __future__ import annotations

import json
import os
import re
import time

DATA = os.path.join(os.path.dirname(__file__), "data")
NLTK_DATA = os.path.expanduser("~/nltk_data/corpora")

SIZES_KB = [10, 100, 1024, 10240]
SIZE_FILES = {10: "prose_10kb.txt", 100: "prose_100kb.txt", 1024: "prose_1000kb.txt", 10240: "prose_10000kb.txt"}


def median(values):
    s = sorted(values)
    m = len(s) // 2
    return s[m] if len(s) % 2 else (s[m - 1] + s[m]) / 2


def timeit(fn, warmup=2, rounds=5):
    for _ in range(warmup):
        fn()
    times = []
    for _ in range(rounds):
        start = time.perf_counter()
        fn()
        times.append((time.perf_counter() - start) * 1000)
    return median(times)


def load_size_files():
    out = {}
    for kb in SIZES_KB:
        path = os.path.join(DATA, SIZE_FILES[kb])
        with open(path, encoding="utf-8") as fh:
            out[kb] = fh.read()
    return out


def main():
    from nltk.tokenize import word_tokenize, punkt
    from nltk.probability import FreqDist
    from nltk.collocations import BigramCollocationFinder, BigramAssocMeasures

    result: dict = {"size_scaling": {}, "real_datasets": {}}
    errors: list[str] = []

    texts = load_size_files()

    # Punkt model trained once on a fixed 200KB prefix (same as run_bench.ts).
    trainer = punkt.PunktTrainer()
    trainer.train(texts[1024][:200_000], finalize=True, verbose=False)
    params = trainer.get_params()

    # ---- Part A: size scaling -------------------------------------------
    size_res: dict = {}
    for kb in SIZES_KB:
        text = texts[kb]
        row: dict = {}

        row["word_tokenize"] = timeit(lambda t=text: word_tokenize(t))

        tokenizer = punkt.PunktSentenceTokenizer(params)
        row["punkt_sentence"] = timeit(lambda t=text: tokenizer.tokenize(t))

        def bigrams(t=text):
            words = [w for w in re.findall(r"[a-z']+", t.lower()) if len(w) > 2]
            finder = BigramCollocationFinder.from_words(words, window_size=2)
            return finder.nbest(BigramAssocMeasures.pmi, 30)

        row["bigrams"] = timeit(bigrams)

        size_res[str(kb)] = {f"python_ms": v for v in [row["word_tokenize"]]} | {}
        # store flat per-task values; assembler merges with JS side
        size_res[str(kb)] = {
            "tokenize_python_ms": row["word_tokenize"],
            "punkt_python_ms": row["punkt_sentence"],
            "bigrams_python_ms": row["bigrams"],
        }
        print(
            f"[py] {kb}KB tokenize={row['word_tokenize']:.1f}ms "
            f"punkt={row['punkt_sentence']:.1f}ms bigrams={row['bigrams']:.1f}ms",
            flush=True,
        )
    result["size_scaling"] = size_res

    # ---- Part B: real corpora --------------------------------------------
    def bench_corpus(name, text):
        entry: dict = {"name": name, "chars": len(text)}
        try:
            entry["token_count"] = len(word_tokenize(text))
        except Exception as e:  # pragma: no cover
            errors.append(f"{name}: word_tokenize count failed: {e}")
            entry["token_count"] = None

        try:
            entry["tokenize_ms"] = timeit(lambda: word_tokenize(text))
        except Exception as e:
            errors.append(f"{name}: tokenize failed: {e}")
            entry["tokenize_ms"] = None

        try:
            tok = punkt.PunktSentenceTokenizer(params)
            entry["punkt_ms"] = timeit(lambda: tok.tokenize(text))
        except Exception as e:
            errors.append(f"{name}: punkt failed: {e}")
            entry["punkt_ms"] = None

        def topk():
            words = [w for w in re.findall(r"[a-z']+", text.lower()) if len(w) > 2]
            fd = FreqDist(words)
            return fd.most_common(10)

        try:
            topk()
            entry["freqdist_ms"] = timeit(topk)
        except Exception as e:
            errors.append(f"{name}: freqdist failed: {e}")
            entry["freqdist_ms"] = None

        print(f"[py] {name}: {entry}", flush=True)
        return entry

    # Brown corpus (~1M words, genre-balanced)
    try:
        brown_dir = os.path.join(NLTK_DATA, "brown")
        parts = []
        for fn in sorted(os.listdir(brown_dir)):
            if fn.startswith("c"):
                with open(os.path.join(brown_dir, fn), encoding="latin-1") as fh:
                    parts.append(fh.read())
        brown_text = "\n".join(parts)
        result["real_datasets"]["brown"] = bench_corpus("brown", brown_text)
    except Exception as e:
        errors.append(f"brown corpus load failed: {e}")

    # Gutenberg: milton-paradise + austen-emma + melville-moby_dick (literary canon)
    try:
        gutenberg_files = ["milton-paradise.txt", "austen-emma.txt", "melville-moby_dick.txt"]
        parts = []
        for fn in gutenberg_files:
            with open(os.path.join(NLTK_DATA, "gutenberg", fn), encoding="utf-8-sig", errors="replace") as fh:
                parts.append(fh.read())
        gutenberg_text = "\n".join(parts)
        result["real_datasets"]["gutenberg"] = bench_corpus("gutenberg", gutenberg_text)
    except Exception as e:
        errors.append(f"gutenberg corpus load failed: {e}")

    # Reuters: only if present locally (do not download)
    reuters_dir = os.path.join(NLTK_DATA, "reuters")
    if os.path.isdir(reuters_dir):
        try:
            parts = []
            for root, _dirs, files in os.walk(reuters_dir):
                for fn in sorted(files):
                    if fn.endswith(".txt") or "." not in fn:
                        with open(os.path.join(root, fn), encoding="latin-1") as fh:
                            parts.append(fh.read())
            reuters_text = "\n".join(parts)
            result["real_datasets"]["reuters"] = bench_corpus("reuters", reuters_text)
        except Exception as e:
            errors.append(f"reuters corpus load failed: {e}")
    else:
        result["real_datasets"]["reuters"] = {
            "name": "reuters",
            "skipped": True,
            "reason": f"not present in {NLTK_DATA}; not downloaded per instructions",
        }

    result["errors"] = errors
    print(json.dumps(result))


if __name__ == "__main__":
    main()
