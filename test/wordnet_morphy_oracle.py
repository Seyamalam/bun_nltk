"""Oracle evidence for WordNetLemmatizer/_morphy parity (NLTK 3.10.3)."""
import nltk

assert nltk.__version__ == "3.10.3", nltk.__version__

from nltk.corpus import wordnet as wn
from nltk.stem import WordNetLemmatizer as wnl

l = wnl()

# lemmatize: shortest lemma, no input normalization
assert l.lemmatize("us", "n") == "u"
assert l.lemmatize("better", "a") == "good"
assert l.lemmatize("mice", "n") == "mouse"
assert l.lemmatize("Dogs", "n") == "Dogs"
assert l.lemmatize("  dogs  ") == "  dogs  "
assert l.lemmatize("teeth", "n") == "teeth"
assert l.lemmatize("went", "v") == "go"
assert l.lemmatize("lives", "n") == "life"
assert l.lemmatize("lives", "v") == "live"
assert l.lemmatize("worse", "a") == "bad"
assert l.lemmatize("quickly", "r") == "quickly"
assert l.lemmatize("catss") == "catss"

# _morphy: full filtered list, exceptions + substitution rules
assert wn._morphy("us", "n") == ["us", "u"]
assert wn._morphy("better", "a") == ["better", "good", "well"]
assert wn._morphy("axes", "n") == ["ax", "axis"]
assert wn._morphy("better", "s") == ["better", "good", "well"]
assert wn._morphy("catss", "n") == []
assert wn._morphy("Dogs", "n") == []
assert wn._morphy("went", "v") == ["go"]
assert wn._morphy("went", "v", False) == []
assert wn._morphy("us", "n", False) == ["us", "u"]

# morphy: first analysis across POS order n,v,a,r, or None
assert wn.morphy("us", "n") == "us"
assert wn.morphy("dogs") == "dog"
assert wn.morphy("book", "a") is None
assert wn.morphy("lives") == "life"
assert wn.morphy("mice", "n", False) is None

print("wordnet_morphy oracle OK")
