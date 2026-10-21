"""Actual NLTK training params and trained inference, never expected TS output."""
import json
import sys
import nltk
from nltk.tokenize.punkt import PunktTrainer, PunktSentenceTokenizer, PunktTokenizer

assert sys.version_info[:3] == (3, 14, 4), sys.version
assert nltk.__version__ == "3.10.3", nltk.__version__
request = json.load(sys.stdin)
rows = []
for chunks in request["chunks"]:
    trainer = PunktTrainer()
    scores = {}
    original_reclassify = trainer._reclassify_abbrev_types

    def record_scores(types):
        for abbr, score, is_add in original_reclassify(types):
            scores[abbr] = score
            yield abbr, score, is_add

    trainer._reclassify_abbrev_types = record_scores
    for chunk in chunks:
        if chunk.strip():
            trainer.train(chunk, finalize=False)
    params = trainer.get_params()
    tokenizer = PunktSentenceTokenizer(params)
    rows.append({
        "params": {
            "abbreviations": sorted(params.abbrev_types),
            "collocations": sorted(map(list, params.collocations)),
            "sentenceStarters": sorted(params.sent_starters),
            "orthoContext": dict(params.ortho_context),
            "abbreviationScores": scores,
        },
        "sentences": [tokenizer.tokenize(text) for text in request["texts"]],
    })
official = PunktTokenizer("english")._params
json.dump({"rows": rows, "official": {
    "abbreviations": sorted(official.abbrev_types),
    "collocations": sorted(map(list, official.collocations)),
    "sentenceStarters": sorted(official.sent_starters),
    "orthoContext": dict(official.ortho_context),
}}, sys.stdout, ensure_ascii=False)
