"""Oracle evidence for LancasterStemmer parity (NLTK 3.10.3)."""
import nltk

assert nltk.__version__ == "3.10.3", nltk.__version__

from nltk.stem.lancaster import LancasterStemmer

st = LancasterStemmer()
# NLTK doctest values
assert st.stem("maximum") == "maxim"
assert st.stem("presumably") == "presum"
assert st.stem("multiply") == "multiply"
assert st.stem("provision") == "provid"
assert st.stem("owed") == "ow"
assert st.stem("ear") == "ear"
assert st.stem("saying") == "say"
assert st.stem("crying") == "cry"
assert st.stem("string") == "string"
assert st.stem("meant") == "meant"
assert st.stem("cement") == "cem"
assert st.stem("running") == "run"
assert st.stem("happiness") == "happy"
assert st.stem("test2x") == "test2x"
assert st.stem("123abc") == "123abc"

# strip_prefix_flag and custom rule tuples
assert LancasterStemmer(strip_prefix_flag=True).stem("kilometer") == "met"
assert LancasterStemmer(rule_tuple=("ssen4>", "s1t.")).stem("ness") == "nest"

# parseRules validation and defaults
assert len(LancasterStemmer.default_rule_tuple) == 115
try:
    st.parseRules(("bad!rule",))
except ValueError as e:
    assert str(e) == "The rule bad!rule is invalid"
else:
    raise AssertionError("invalid rule accepted")
assert repr(st) == "<LancasterStemmer>"

print("lancaster oracle OK")
