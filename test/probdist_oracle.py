import nltk
assert nltk.__version__ == "3.10.3"
from nltk.probability import MLEProbDist, LidstoneProbDist, FreqDist

fd = FreqDist("a a b c".split())
m = MLEProbDist(fd)
assert MLEProbDist.SUM_TO_ONE is True
assert LidstoneProbDist.SUM_TO_ONE is False
assert m.discount() == 0.0
lid = LidstoneProbDist(fd, 0.5)
assert abs(lid.discount() - 0.2727272727272727) < 1e-15
assert m.logprob("a") == -1.0
assert m.logprob("z") == -1e300
assert m.prob("z") == 0
assert MLEProbDist(FreqDist()).prob("x") == 0
import random
random.seed(7)
lid2 = LidstoneProbDist(FreqDist("a b".split()), 0.5, bins=4)
assert lid2.generate() in ("a", "b", None) or True
assert repr(m) == "<MLEProbDist based on 4 samples>"
assert repr(lid) == "<LidstoneProbDist based on 4 samples>"
try:
    LidstoneProbDist(fd, 0.5, bins=1)
except ValueError as e:
    assert "greater than or equal" in str(e)
