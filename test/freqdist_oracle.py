"""Oracle evidence for FreqDist Counter protocols (NLTK 3.10.3)."""
import nltk

assert nltk.__version__ == "3.10.3", nltk.__version__

import contextlib
import io

from nltk.probability import FreqDist

fd = FreqDist("abbbc")
assert fd.setdefault("a", 9) is None and fd["a"] == 1
fd.setdefault("z", 7)
assert fd["z"] == 7
assert fd.pop("a") == 1
assert fd.pop("q", -1) == -1
try:
    fd.pop("q")
except KeyError:
    pass
else:
    raise AssertionError("missing pop did not raise")
assert fd.popitem() == ("z", 7)
assert sorted(FreqDist("abbbc").elements()) == ["a", "b", "b", "b", "c"]
assert list(FreqDist("abbbc")._cumulative_frequencies(["b", "a", "c"])) == [3, 4, 5]
assert (FreqDist("abbb") < FreqDist("abbbc")) is True
assert (FreqDist("abbb") < FreqDist("abbb")) is False
assert (FreqDist("abbbc") > FreqDist("abbb")) is True
assert dict(FreqDist("abbbc") - FreqDist("bccd")) == {"a": 1, "b": 2}
assert dict(FreqDist("abbb") | FreqDist("bcc")) == {"a": 1, "b": 3, "c": 2}
assert dict(FreqDist("abbb") & FreqDist("bcc")) == {"b": 1}
assert dict(FreqDist("abbb") + FreqDist("bcc")) == {"a": 1, "b": 4, "c": 2}

buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    FreqDist("a" * 10 + "bc").tabulate()
assert buf.getvalue() == " a  b  c \n10  1  1 \n", repr(buf.getvalue())
buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    FreqDist("abbbc").tabulate(cumulative=True)
assert buf.getvalue() == "b a c \n3 4 5 \n", repr(buf.getvalue())
buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    FreqDist("abbbc").tabulate(2)
assert buf.getvalue() == "b a \n3 1 \n", repr(buf.getvalue())
try:
    FreqDist().tabulate()
except ValueError:
    pass
else:
    raise AssertionError("empty tabulate did not raise")

print("freqdist oracle OK")
