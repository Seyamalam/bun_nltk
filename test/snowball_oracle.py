"""Pinned unmodified NLTK SnowballStemmer oracle; needs the stopwords corpus."""
import json
import sys
import nltk
from nltk.stem import SnowballStemmer

assert sys.version_info[:3] == (3, 14, 4), sys.version
assert nltk.__version__ == "3.10.3", nltk.__version__

results = []
for case in json.load(sys.stdin):
    try:
        stemmer = SnowballStemmer(case["language"], ignore_stopwords=case.get("ignore_stopwords", False))
        results.append({"stem": stemmer.stem(case["word"]), "stopwords": len(stemmer.stopwords)})
    except ValueError as error:
        results.append({"error": str(error)})
json.dump(results, sys.stdout)
