#!/usr/bin/env python3
"""Python baseline for bun_nltk textcat parity checks.

Uses nltk.classify.textcat.TextCat with NLTK's bundled An Crubadan language
n-gram corpus. The corpus is NOT installed in this environment's nltk_data
(only brown/movie_reviews/treebank/wordnet are present), and TextCat cannot be
instantiated without it -- so this script detects that case and exits with
code 3 ("corpus unavailable"), which test/textcat.test.ts documents as the
reason the JS-side parity check is skipped in favor of algorithmic unit tests.

Usage:
    .venv/bin/python bench/python_textcat_baseline.py
"""
import sys

try:
    from nltk.classify.textcat import TextCat  # noqa: F401
except ImportError as exc:
    print(f"NLTK unavailable: {exc}", file=sys.stderr)
    sys.exit(2)


def main() -> int:
    try:
        cat = TextCat()
    except OSError as exc:
        # NLTK raises OSError when the crubadan corpus / regex module is missing.
        print(f"TextCat corpus unavailable: {exc}", file=sys.stderr)
        return 3

    samples = {
        "The quick brown fox jumps over the lazy dog.",
        "This is a short English sentence for classification.",
    }
    results = {}
    for sample in sorted(samples):
        results[sample] = cat.guess_language(sample)
    print(results)
    return 0


if __name__ == "__main__":
    sys.exit(main())
