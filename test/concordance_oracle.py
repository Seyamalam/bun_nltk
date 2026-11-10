import nltk
assert nltk.__version__ == "3.10.3"
from nltk.text import ConcordanceIndex
import io, contextlib

toks = "the quick brown dog jumps over the lazy dog".split()
ci = ConcordanceIndex(toks)
assert ci.offsets("dog") == [3, 8]
assert ci.offsets("missing") == []
assert repr(ci) == "<ConcordanceIndex for 9 tokens (8 types)>"
lines = ci.find_concordance("dog", width=40)
assert lines[0].line == "  the quick brown dog jumps over the la"
assert lines[0].offset == 3
assert lines[0].left == ["the", "quick", "brown"]
assert lines[0].right == ["jumps", "over", "the", "lazy", "dog"]
assert lines[1].line == "mps over the lazy dog "
buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    ci.print_concordance("dog", width=40, lines=1)
assert buf.getvalue() == "Displaying 1 of 2 matches:\n  the quick brown dog jumps over the la\n"
buf2 = io.StringIO()
with contextlib.redirect_stdout(buf2):
    ci.print_concordance("zebra", width=40)
assert buf2.getvalue() == "no matches\n"
assert ci.find_concordance(["the", "lazy"], width=40)[0].line == " dog jumps over the lazy dog"
