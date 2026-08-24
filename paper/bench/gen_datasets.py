#!/usr/bin/env python3
"""Generate benchmark datasets for the paper bench suite.

Sources: nltk movie_reviews corpus (plain-text English prose, ~10MB) for the
1MB prose sample, 100k word list, LM data and classification docs.

Deterministic: fixed seed. Outputs into paper/bench/data/.
"""
from __future__ import annotations

import argparse
import json
import os
import random
import re

TOKEN_RE = re.compile(r"[A-Za-z0-9']+")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default=os.path.join(os.path.dirname(__file__), "data"))
    args = ap.parse_args()
    os.makedirs(args.out_dir, exist_ok=True)

    from nltk.corpus import movie_reviews

    rng = random.Random(1337)
    fileids = list(movie_reviews.fileids())
    rng.shuffle(fileids)

    # ---- 1MB prose sample -------------------------------------------------
    buf: list[str] = []
    size = 0
    target = 1_000_000
    for fid in fileids:
        text = movie_reviews.raw(fid)
        buf.append(text)
        size += len(text)
        if size >= target * 1.2:
            break
    prose = "\n".join(buf)[:target]
    # trim to a sentence boundary so punkt sees clean text
    last_stop = max(prose.rfind("."), prose.rfind("!"), prose.rfind("?"))
    if last_stop > target - 5000:
        prose = prose[: last_stop + 1]
    with open(os.path.join(args.out_dir, "prose_1mb.txt"), "w", encoding="utf-8") as fh:
        fh.write(prose)
    print(f"prose_1mb.txt: {len(prose)} chars")

    tokens = [m.group(0).lower() for m in TOKEN_RE.finditer(prose)]
    with open(os.path.join(args.out_dir, "words_100k.txt"), "w", encoding="utf-8") as fh:
        fh.write(" ".join(tokens[:100_000]))
    print(f"tokens in prose: {len(tokens)}")

    # ---- LM data (pre-tokenized so runners skip tokenization) -------------
    SENT_LEN = 14
    N_TRAIN = 2500
    lm_tokens = tokens[: N_TRAIN * SENT_LEN + 400]
    train_sents = [
        lm_tokens[i : i + SENT_LEN] for i in range(0, N_TRAIN * SENT_LEN, SENT_LEN)
    ]
    probes = [
        {"context": s[0], "word": s[1]} for s in train_sents[:20] if len(s) >= 3
    ]
    ppl_tokens = lm_tokens[N_TRAIN * SENT_LEN : N_TRAIN * SENT_LEN + 200]
    with open(os.path.join(args.out_dir, "lm_data.json"), "w", encoding="utf-8") as fh:
        json.dump({"train": train_sents, "probes": probes, "perplexityTokens": ppl_tokens}, fh)
    print(f"lm train sentences: {len(train_sents)}, ppl tokens: {len(ppl_tokens)}")

    # ---- Classification docs (paragraphs of reviews, pos/neg labels) ------
    docs: list[dict] = []
    for fid in fileids:
        label = movie_reviews.categories(fid)[0]
        raw = movie_reviews.raw(fid)
        paras = [p.strip() for p in re.split(r"\n\s*\n", raw) if len(p.strip()) > 40]
        for p in paras[:30]:
            docs.append({"text": " ".join(p.split()), "label": label})
    rng.shuffle(docs)
    by_label: dict[str, list[dict]] = {"pos": [], "neg": []}
    for d in docs:
        by_label[d["label"]].append(d)
    n_min = min(len(v) for v in by_label.values())
    half = n_min // 2
    train, test = [], []
    for lbl in ("pos", "neg"):
        train.extend(by_label[lbl][:half])
        test.extend(by_label[lbl][half : min(n_min, half + 1500)])
    rng.shuffle(train)
    rng.shuffle(test)
    for name, rows in (("docs_train.jsonl", train), ("docs_test.jsonl", test)):
        with open(os.path.join(args.out_dir, name), "w", encoding="utf-8") as fh:
            for row in rows:
                fh.write(json.dumps(row) + "\n")
    print(f"classification docs: {len(train)} train / {len(test)} test")


if __name__ == "__main__":
    main()
