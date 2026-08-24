#!/usr/bin/env python3
"""Python NLTK baseline for all bench tasks (median of 5, warmup 2)."""
from __future__ import annotations

import json
import os
import time

DATA = os.path.join(os.path.dirname(__file__), "data")


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


def main():
    import nltk
    from nltk.tokenize import word_tokenize, punkt
    from nltk.stem import PorterStemmer
    from nltk.collocations import BigramCollocationFinder, BigramAssocMeasures
    from nltk.probability import FreqDist
    from nltk.classify import NaiveBayesClassifier
    from nltk.util import everygrams
    from nltk.lm.preprocessing import padded_everygram_pipeline
    from nltk.lm import KneserNeyInterpolated

    prose = open(os.path.join(DATA, "prose_1mb.txt"), encoding="utf-8").read()
    words100k = open(os.path.join(DATA, "words_100k.txt"), encoding="utf-8").read().split()
    docs_train = [json.loads(l) for l in open(os.path.join(DATA, "docs_train.jsonl"), encoding="utf-8")]
    docs_test = [json.loads(l) for l in open(os.path.join(DATA, "docs_test.jsonl"), encoding="utf-8")]
    lm_raw = json.load(open(os.path.join(DATA, "lm_data.json"), encoding="utf-8"))
    train_sents = lm_raw["train"]
    test_sents = lm_raw["perplexityTokens"]

    out = {}

    # 1. tokenize 1MB
    out["tokenize"] = timeit(lambda: word_tokenize(prose))

    # 2. punkt sentence split
    trainer = punkt.PunktTrainer()
    trainer.train(prose[:200_000], finalize=True, verbose=False)
    tokenizer = punkt.PunktSentenceTokenizer(trainer.get_params())
    out["punkt"] = timeit(lambda: tokenizer.tokenize(prose))

    # 3. porter stem 100k
    stemmer = PorterStemmer()
    out["porter"] = timeit(lambda: [stemmer.stem(w) for w in words100k])

    # 4. collocations PMI top 30
    words_lower = [w for w in prose.lower().split() if len(w.strip(".,!?'\";:")) > 2]
    def collocations():
        finder = BigramCollocationFinder.from_words(words_lower, window_size=2)
        return finder.nbest(BigramAssocMeasures.pmi, 30)
    out["collocations"] = timeit(collocations)

    # 5. FreqDist on tokens
    tokens_lower = word_tokenize(prose.lower())
    out["freqdist"] = timeit(lambda: FreqDist(tokens_lower))

    # 6. Naive Bayes classify
    def featureize(text):
        return {f"has({w})": True for w in set(word_tokenize(text.lower()))}

    train_set = [(featureize(d["text"]), d["label"]) for d in docs_train]
    test_set = [(featureize(d["text"]), d["label"]) for d in docs_test]
    def nb():
        clf = NaiveBayesClassifier.train(train_set)
        return sum(1 for f, l in test_set if clf.classify(f) == l)
    out["naive_bayes"] = timeit(nb, warmup=1, rounds=3)

    # 7. ngrams (everygrams over first 200 sentences)
    def ngrams():
        total = 0
        for sent in train_sents[:200]:
            for _ in everygrams(sent, min_len=1, max_len=3):
                total += 1
        return total
    out["ngrams"] = timeit(ngrams)

    # 8. LM perplexity (Kneser-Ney interpolated bigram)
    train_padded, vocab = padded_everygram_pipeline(3, train_sents)
    lm = KneserNeyInterpolated(3)
    lm.fit(train_padded, vocab)
    # perplexityTokens is a flat token stream; evaluate in chunks of ~20 tokens as pseudo-sentences
    chunk = 20
    streams = [test_sents[i:i + chunk] for i in range(0, min(len(test_sents), 1000), chunk)]
    def lm_eval():
        total = 0.0
        for toks in streams[:50]:
            padded = [g for g in everygrams(["<s>"] + list(toks) + ["</s>"], min_len=1, max_len=2)]
            words = [w if isinstance(w, str) else " ".join(w) for w in padded]
            try:
                total += lm.perplexity(words)
            except Exception:
                pass
        return total / max(len(streams[:50]), 1)
    out["lm_perplexity"] = timeit(lm_eval, warmup=1, rounds=3)

    print(json.dumps(out))


if __name__ == "__main__":
    main()
