"""Differential oracle for nltk.grammar.CFG.fromstring on fuzzed grammars."""
import json
import sys

from nltk.grammar import CFG


def main() -> None:
    texts = json.load(sys.stdin)
    out = []
    for text in texts:
        try:
            out.append(str(CFG.fromstring(text)))
        except Exception as exc:  # noqa: BLE001
            out.append(["__ERR__", type(exc).__name__, str(exc)])
    json.dump(out, sys.stdout, ensure_ascii=True)


if __name__ == "__main__":
    main()
