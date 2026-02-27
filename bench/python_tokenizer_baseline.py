#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re

TOKEN_RE = re.compile(r"[A-Za-z0-9']+")


def tokenize_ascii(text: str) -> list[str]:
    return [m.group(0).lower() for m in TOKEN_RE.finditer(text)]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--text", required=True)
    args = parser.parse_args()
    print(json.dumps({"tokens": tokenize_ascii(args.text)}))


if __name__ == "__main__":
    main()

