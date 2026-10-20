#!/usr/bin/env python3
"""Bounded-memory NLTK token/bigram distributions with the ASCII API contract."""
import argparse
import hashlib
import json
import platform
import re
import time
import nltk
from nltk import FreqDist, bigrams

TOKEN = re.compile(r"[a-z0-9']+")
TAIL = re.compile(r"[a-z0-9']+$")


def hash_token(token):
    value = 14695981039346656037
    for byte in token.encode("ascii"):
        value = ((value ^ byte) * 1099511628211) & ((1 << 64) - 1)
    return value


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input")
    parser.add_argument("--chunk", type=int, default=1024 * 1024)
    args = parser.parse_args()
    assert nltk.__version__ == "3.10.3", nltk.__version__
    started = time.perf_counter()
    tokens, grams = FreqDist(), FreqDist()
    previous, carry = None, ""
    with open(args.input, "r", encoding="ascii") as source:
        while chunk := source.read(args.chunk):
            chunk = carry + chunk.lower()
            tail = TAIL.search(chunk)
            carry = tail.group(0) if tail else ""
            complete = chunk[:tail.start()] if tail else chunk
            words = TOKEN.findall(complete)
            tokens.update(words)
            if words:
                if previous is not None:
                    grams[(previous, words[0])] += 1
                grams.update(bigrams(words))
                previous = words[-1]
        if carry:
            tokens[carry] += 1
            if previous is not None:
                grams[(previous, carry)] += 1
    token_rows = sorted((hash_token(word), count) for word, count in tokens.items())
    gram_rows = sorted((hash_token(a), hash_token(b), count) for (a, b), count in grams.items())
    payload = "".join(f"{h}:{n}\n" for h, n in token_rows) + "".join(f"{a}:{b}:{n}\n" for a, b, n in gram_rows)
    print(json.dumps({
        "seconds": time.perf_counter() - started,
        "tokens": tokens.N(), "ngrams": grams.N(),
        "uniqueTokens": tokens.B(), "uniqueNgrams": grams.B(),
        "countsSha256": hashlib.sha256(payload.encode()).hexdigest(),
        "runtime": platform.python_version(), "nltk": nltk.__version__,
    }))


if __name__ == "__main__":
    main()
