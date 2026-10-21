"""Behavioral oracle for NLTK's actual redos backend, not stdlib re."""
import json
import sys
import unicodedata

import nltk
import regex
from nltk.tokenize import RegexpTokenizer, regexp_tokenize

assert sys.version_info[:3] == (3, 14, 4), sys.version
assert nltk.__version__ == "3.10.3", nltk.__version__
assert regex.__version__ == "2026.9.29", regex.__version__
assert unicodedata.unidata_version == "16.0.0", unicodedata.unidata_version

results = []
for case in json.load(sys.stdin):
    if case.get("all_scalars"):
        case["text"] = "".join(chr(cp) for cp in range(0x110000) if not 0xD800 <= cp <= 0xDFFF)
    tokenizer = RegexpTokenizer(case["pattern"], case.get("gaps", False), case.get("discard_empty", True), case.get("flags", 56))
    text = case["text"]
    try:
        tokens = tokenizer.tokenize(text)
        assert tokens == regexp_tokenize(text, case["pattern"], case.get("gaps", False), case.get("discard_empty", True), case.get("flags", 56))
        results.append({"tokens": tokens, "spans": list(tokenizer.span_tokenize(text))})
    except Exception as error:
        results.append({"error": type(error).__name__})
json.dump(results, sys.stdout, ensure_ascii=True)
