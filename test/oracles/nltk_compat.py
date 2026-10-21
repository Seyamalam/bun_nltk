"""Live NLTK 3.10.3 behavior, with safe English params from the bundled asset.

No pickles, downloads, monkeypatches or bun_nltk-derived expected tokens/stems.
"""
import json
import pathlib
import sys
import tempfile

import nltk
import regex
from nltk.stem.porter import PorterStemmer
from nltk.tokenize.punkt import PunktParameters, save_punkt_params
from nltk.util import ngrams

assert nltk.__version__ == "3.10.3", nltk.__version__
assert regex.__version__ == "2026.9.29", regex.__version__
request = json.load(sys.stdin)

def outcome(fn):
    try:
        return {"value": fn()}
    except Exception as error:
        return {"error": type(error).__name__, "message": str(error)}

if request["kind"] == "porter":
    result = [PorterStemmer(row["mode"]).stem(row["word"], to_lowercase=row["lowercase"]) for row in request["cases"]]
elif request["kind"] == "wordpunct":
    result = [outcome(lambda text=text: nltk.wordpunct_tokenize(text)) for text in request["cases"]]
elif request["kind"] == "word":
    result = [outcome(lambda text=text: nltk.word_tokenize(text, language="unavailable", preserve_line=True)) for text in request["cases"]]
elif request["kind"] == "ngrams":
    result = [outcome(lambda row=row: list(ngrams(iter(row["sequence"]), row["n"], **row.get("options", {})))) for row in request["cases"]]
elif request["kind"] == "tokenize":
    model_path = pathlib.Path(__file__).resolve().parents[2] / "src/data/punkt-english.json"
    model = json.loads(model_path.read_text())
    params = PunktParameters()
    params.abbrev_types = set(model["abbreviations"])
    params.collocations = set(map(tuple, model["collocations"]))
    params.sent_starters = set(model["sentenceStarters"])
    params.ortho_context.update(model["orthoContext"])
    # Python's safe text data loader, not deserialization of executable pickles.
    with tempfile.TemporaryDirectory(prefix="nltk-compat-oracle-", dir="/tmp/opencode") as root:
        out = pathlib.Path(root) / "tokenizers/punkt_tab/english"
        out.mkdir(parents=True)
        save_punkt_params(params, str(out))
        nltk.data.path = [root]
        result = []
        for row in request["cases"]:
            result.append({
                "sent": outcome(lambda: nltk.sent_tokenize(row["text"], row.get("language", "english"))),
                "word": outcome(lambda: nltk.word_tokenize(row["text"], row.get("language", "english"), row.get("preserve_line", False))),
            })
else:
    raise ValueError(request["kind"])
print(json.dumps(result, ensure_ascii=True))
