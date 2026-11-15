"""Seeded differential oracle: tokenizes adversarial strings with NLTK.

Reads a JSON array of strings on stdin and prints, for each input, the
word_tokenize / sent_tokenize / wordpunct_tokenize results (or a
["__ERR__", type, message] marker when NLTK raises).
"""
import json
import sys

from nltk.tokenize import sent_tokenize, word_tokenize, wordpunct_tokenize


def run(fn, text):
    try:
        return fn(text)
    except Exception as exc:  # noqa: BLE001 - record, don't fail
        return ["__ERR__", type(exc).__name__, str(exc)]


def main() -> None:
    texts = json.load(sys.stdin)
    out = []
    for text in texts:
        out.append(
            {
                "word": run(word_tokenize, text),
                "sent": run(sent_tokenize, text),
                "wp": run(wordpunct_tokenize, text),
            }
        )
    json.dump(out, sys.stdout, ensure_ascii=True)


if __name__ == "__main__":
    main()
