import nltk
assert nltk.__version__ == "3.10.3"

"""Oracle for NLTKWordTokenizer (NLTK 3.10.3)."""
from nltk.tokenize import NLTKWordTokenizer
t = NLTKWordTokenizer()
s = "Good muffins cost $3.88\nin New (York).  Please (buy) me\ntwo of them.\n(Thanks)."
print(t.tokenize("a (b) c", convert_parentheses=True))
print(list(t.span_tokenize(s)))
