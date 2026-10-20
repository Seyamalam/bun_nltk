#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys

from nltk.stem.snowball import SnowballStemmer


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--payload")
    args = parser.parse_args()

    payload = json.loads(args.payload) if args.payload is not None else json.load(sys.stdin)
    lang_words = payload.get("lang_words", {})

    out = {}
    for lang in sorted(lang_words):
        words = [str(x) for x in lang_words[lang]]
        stemmer = SnowballStemmer(lang)
        out[lang] = [stemmer.stem(w) for w in words]
    print(json.dumps(out))


if __name__ == "__main__":
    main()
