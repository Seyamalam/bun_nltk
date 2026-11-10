"""Oracle evidence for RegexpStemmer parity (NLTK 3.10.3)."""
import nltk

assert nltk.__version__ == "3.10.3", nltk.__version__

import re

from nltk.stem import RegexpStemmer

st = RegexpStemmer("ing$|s$|e$|able$", min=4)
assert st.stem("cars") == "car"
assert st.stem("mass") == "mas"
assert st.stem("was") == "was"
assert st.stem("bee") == "bee"
assert st.stem("compute") == "comput"
assert st.stem("advisable") == "advis"
assert st.stem("CARS") == "CARS"

# Global substitution and min boundary
assert RegexpStemmer("s").stem("ses") == "e"
assert RegexpStemmer("s", 3).stem("yes") == "ye"
assert RegexpStemmer("s", 4).stem("yes") == "yes"

# Compiled-pattern passthrough honors its flags
assert RegexpStemmer(re.compile("s", re.I)).stem("CARS") == "CAR"
assert repr(RegexpStemmer("ing$|s$|e$|able$", 4)) == "<RegexpStemmer: 'ing$|s$|e$|able$'>"

print("regexp_stemmer oracle OK")
