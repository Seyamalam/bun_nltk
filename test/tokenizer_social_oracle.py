"""Pinned unmodified NLTK social-tokenizer oracle; needs no corpus data."""
import json
import sys
import nltk
import regex
from nltk.tokenize import TweetTokenizer, ToktokTokenizer, MWETokenizer

assert sys.version_info[:3] == (3, 14, 4), sys.version
assert nltk.__version__ == "3.10.3", nltk.__version__
assert regex.__version__ == "2026.9.29", regex.__version__
results = []
for case in json.load(sys.stdin):
    kind = case["kind"]
    if kind == "tweet":
        tokenizer = TweetTokenizer(**{key: case[key] for key in (
            "preserve_case", "reduce_len", "strip_handles", "match_phone_numbers"
        ) if key in case})
        results.append(tokenizer.tokenize(case["text"]))
    elif kind == "toktok":
        results.append(ToktokTokenizer().tokenize(case["text"], case.get("return_str", False)))
    else:
        results.append(MWETokenizer(case.get("mwes", []), case.get("separator", "_")).tokenize(case["tokens"]))
json.dump(results, sys.stdout, ensure_ascii=True)
