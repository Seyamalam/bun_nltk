#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json

from nltk.stem import LancasterStemmer, RegexpStemmer, SnowballStemmer


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--payload", required=True)
    args = parser.parse_args()

    payload = json.loads(args.payload)
    words = [str(x) for x in payload.get("words", [])]
    regex_pattern = str(payload.get("regex_pattern", "ing$"))
    regex_min = int(payload.get("regex_min", 0))

    lancaster = LancasterStemmer()
    snowball = SnowballStemmer("english")
    regexp = RegexpStemmer(regex_pattern, min=regex_min)

    out = {
      "lancaster": [lancaster.stem(w) for w in words],
      "snowball": [snowball.stem(w) for w in words],
      "regexp": [regexp.stem(w) for w in words],
    }
    print(json.dumps(out))


if __name__ == "__main__":
    main()

