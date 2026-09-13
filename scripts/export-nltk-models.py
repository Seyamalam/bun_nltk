#!/usr/bin/env python3
"""Export safe, versioned data from NLTK 3.10.3. No pickle input or runtime Python."""
import gzip
import hashlib
import json
from pathlib import Path
import nltk
from nltk.chunk.named_entity import Maxent_NE_Chunker
from nltk.corpus import words
from nltk.sentiment.vader import SentimentIntensityAnalyzer, VaderConstants
from nltk.tokenize.punkt import PunktTokenizer

ROOT = Path(__file__).resolve().parents[1]
if nltk.__version__ != "3.10.3":
    raise SystemExit("Use NLTK 3.10.3 to reproduce these exports")
manifest = {"nltk": nltk.__version__, "files": {}}

def write(relative, value, compress=False):
    content = (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
    if compress:
        content = gzip.compress(content, mtime=0)
    target = ROOT / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)
    manifest["files"][relative] = {"bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()}
    print(relative, len(content))

v = VaderConstants()
write("src/data/vader.json", {"lexicon": SentimentIntensityAnalyzer().lexicon, "boosters": v.BOOSTER_DICT,
    "negations": sorted(v.NEGATE), "idioms": v.SPECIAL_CASE_IDIOMS, "punctuation": v.PUNC_LIST})
p = PunktTokenizer("english")._params
write("src/data/punkt-english.json", {"version": 2, "abbreviations": sorted(p.abbrev_types),
    "collocations": sorted(p.collocations), "sentenceStarters": sorted(p.sent_starters),
    "orthoContext": dict(sorted(p.ortho_context.items()))})
for mode in ["multiclass", "binary"]:
    classifier = Maxent_NE_Chunker(mode)._tagger._classifier
    encoding = classifier._encoding
    # Keep feature iteration order at inference; weights remain IEEE-754 doubles.
    mapping = [[name, value, label, int(index)] for (name,value,label),index in encoding._mapping.items()]
    write(f"models/ne-chunker-{mode}.json.gz", {"version": 1, "nltk": nltk.__version__, "mode": mode,
        "labels": encoding._labels, "mapping": mapping, "weights": list(classifier._weights),
        "alwaysOn": encoding._alwayson, "wordlist": sorted(set(words.words("en-basic")))}, True)
(ROOT / "models/nltk-models.manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
