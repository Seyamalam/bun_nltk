"""Unmodified, pinned NLTK behavioral oracle; no corpus downloads required."""
import json
import sys
import unicodedata

import nltk
import regex
from nltk.tokenize import (
    BlanklineTokenizer,
    LineTokenizer,
    SpaceTokenizer,
    TabTokenizer,
    TreebankWordDetokenizer,
    TreebankWordTokenizer,
    WhitespaceTokenizer,
    WordPunctTokenizer,
)

assert nltk.__version__ == "3.10.3", nltk.__version__
assert sys.version_info[:2] == (3, 14), sys.version
assert unicodedata.unidata_version == "16.0.0", unicodedata.unidata_version
assert regex.__version__ == "2026.9.29", regex.__version__

factories = {
    "treebank": TreebankWordTokenizer,
    "wordpunct": WordPunctTokenizer,
    "whitespace": WhitespaceTokenizer,
    "blankline": BlanklineTokenizer,
    "space": SpaceTokenizer,
    "tab": TabTokenizer,
}

results = []
for case in json.load(sys.stdin):
    kind = case["kind"]
    if kind == "all-scalars-wordpunct":
        text = "".join(chr(cp) for cp in range(0x110000) if not 0xD800 <= cp <= 0xDFFF)
        tokenizer = WordPunctTokenizer()
    else:
        text = case.get("text", "")
        tokenizer = (
            LineTokenizer(case.get("blanklines", "discard"))
            if kind == "line"
            else factories.get(kind, TreebankWordDetokenizer)()
        )
    if kind == "treebank-detokenize":
        results.append(tokenizer.detokenize(case["tokens"], case.get("convertParentheses", False)))
        continue
    tokens = (
        tokenizer.tokenize(text, case.get("convertParentheses", False))
        if kind == "treebank" else tokenizer.tokenize(text)
    )
    try:
        spans = list(tokenizer.span_tokenize(text))
    except (ValueError, IndexError):
        spans = None
    results.append({"tokens": tokens, "spans": spans})

json.dump(results, sys.stdout, ensure_ascii=True)
