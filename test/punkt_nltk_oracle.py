"""Oracle for the punkt object-model port (NLTK 3.10.3)."""
import nltk
assert nltk.__version__ == "3.10.3", nltk.__version__
from nltk.tokenize.punkt import (
    PunktLanguageVars, PunktParameters, PunktSentenceTokenizer, PunktToken,
    PunktTokenizer, PunktTrainer, format_debug_decision,
)

lv = PunktLanguageVars()
print("word_tokenize:", lv.word_tokenize("Good muffins cost $3.88 in N.Y."))
print("token Mr:", (PunktToken("Mr.").type, PunktToken("Mr.").period_final, PunktToken("Mr.").is_initial))
print("token J:", PunktToken("J.").is_initial)
print("token num:", PunktToken("3.14").type)
print("ell a..:", bool(PunktToken("a..").is_ellipsis), "ell ..:", bool(PunktToken("..").is_ellipsis))
print("str:", str(PunktToken("x.", abbr=True, sentbreak=True)))

pst = PunktSentenceTokenizer()
print("untrained:", pst.tokenize("See example 1. It is a test."))
tr = PunktTrainer(); tr.INCLUDE_ALL_COLLOCS = True
tr.train("Mr. Smith bought several books. Mrs. Jones went home. He ran.")
p = tr.get_params()
print("abbrs:", sorted(p.abbrev_types))
print("ortho:", p.ortho_context["smith"], p.ortho_context["mr"])
print("trained:", PunktSentenceTokenizer(p).tokenize("Mr. Smith went. He left."))
print("csb:", pst.text_contains_sentbreak("Mr. Smith"))
