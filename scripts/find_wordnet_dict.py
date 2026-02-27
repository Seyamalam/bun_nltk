#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
import zipfile

import nltk


def main() -> None:
    nltk.download("wordnet", quiet=True)
    candidates = [Path(base) / "corpora" for base in nltk.data.path]
    for corpora_dir in candidates:
        path = corpora_dir / "wordnet"
        if (path / "data.noun").exists():
            print(json.dumps({"dict_dir": str(path.resolve())}))
            return
        zpath = corpora_dir / "wordnet.zip"
        if zpath.exists():
            with zipfile.ZipFile(zpath, "r") as zf:
                zf.extractall(corpora_dir)
            if (path / "data.noun").exists():
                print(json.dumps({"dict_dir": str(path.resolve())}))
                return
    raise SystemExit("wordnet dict directory not found after nltk.download('wordnet')")


if __name__ == "__main__":
    main()
