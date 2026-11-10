"""Oracle pins for nltk.translate.gdfa/gleu/lepor/phrase_based (NLTK 3.10.3)."""

import nltk

assert nltk.__version__ == "3.10.3", nltk.__version__

from nltk.translate import Alignment
from nltk.translate.gdfa import grow_diag_final_and
from nltk.translate.gleu_score import sentence_gleu, corpus_gleu
from nltk.translate.lepor import (
    alignment,
    corpus_lepor,
    harmonic,
    length_penalty,
    ngram_positional_penalty,
    sentence_lepor,
)
from nltk.translate.phrase_based import phrase_extraction

GDFA = [
    grow_diag_final_and(2, 2, "1-1", "1-1 2-2"),
    grow_diag_final_and(2, 2, "0-0", "0-0 1-1"),
    grow_diag_final_and(3, 3, "0-0 2-2", "0-0 1-1 2-1"),
]

_ref = [["the", "cat", "sat"], ["on", "the", "mat"]]
_hyp = ["the", "cat", "sat", "on", "the", "mat"]
GLEU = (sentence_gleu(_ref, _hyp), corpus_gleu([_ref], [_hyp]))

LEPOR_LENGTH_PENALTY = length_penalty(["a", "b", "c"], ["a", "b"])
LEPOR_ALIGNMENT = (alignment(["a", "b"], ["a", "b"]), alignment(["the", "cat", "sat"], ["a", "cat", "x"]))
LEPOR_HARMONIC = (harmonic(2, 3, 2, 0.9, 0.3), harmonic(2, 2, 2, 0.9, 0.3))
LEPOR_NPP = (ngram_positional_penalty(["a", "b", "c"], ["a", "b", "c"]), ngram_positional_penalty(["the", "cat"], ["cat", "the"]))
LEPOR_SENTENCE = (sentence_lepor(["a b c"], "a b c"), sentence_lepor(["the cat"], "a cat"))
LEPOR_CORPUS = corpus_lepor([["a b"]], ["a b"])

PHRASE_EXTRACTION = sorted(
    phrase_extraction("a b c", "a b c", Alignment([(0, 0)]))
)
PHRASE_EXTRACTION2 = sorted(
    phrase_extraction("ich gehe ja", "i go", Alignment([(0, 0), (1, 1)]))
)

if __name__ == "__main__":
    for name in list(globals()):
        if name.isupper():
            print(f"{name} = {globals()[name]!r}")
