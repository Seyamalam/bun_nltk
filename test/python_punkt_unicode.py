"""Behavioral oracle: NLTK 3.10.3 inference with explicitly supplied parameters."""
import json
import sys
import nltk
from nltk.tokenize.punkt import PunktParameters, PunktSentenceTokenizer

assert nltk.__version__ == "3.10.3", nltk.__version__
request = json.load(sys.stdin)
model = request["model"]
params = PunktParameters()
params.abbrev_types = set(model["abbreviations"])
params.collocations = set(map(tuple, model["collocations"]))
params.sent_starters = set(model["sentenceStarters"])
params.ortho_context.update(model.get("orthoContext", {}))
tokenizer = PunktSentenceTokenizer(params)
rows = []
for text in request["texts"]:
    row = {}
    for realign in (True, False):
        spans = list(tokenizer.span_tokenize(text, realign))
        row["aligned" if realign else "raw"] = {
            "sentences": [text[s:e] for s, e in spans],
            "bytes": [[len(text[:s].encode()), len(text[:e].encode())] for s, e in spans],
            "utf16": [[len(text[:s].encode("utf-16-le")) // 2,
                       len(text[:e].encode("utf-16-le")) // 2] for s, e in spans],
        }
    rows.append(row)
json.dump(rows, sys.stdout, ensure_ascii=False)
