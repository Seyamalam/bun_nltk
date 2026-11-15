"""Differential oracle for nltk.tree.Tree.fromstring on fuzzed strings."""
import json
import sys

from nltk.tree import Tree


def main() -> None:
    texts = json.load(sys.stdin)
    out = []
    for text in texts:
        try:
            out.append(str(Tree.fromstring(text)))
        except Exception as exc:  # noqa: BLE001
            out.append(["__ERR__", type(exc).__name__, str(exc)])
    json.dump(out, sys.stdout, ensure_ascii=True)


if __name__ == "__main__":
    main()
