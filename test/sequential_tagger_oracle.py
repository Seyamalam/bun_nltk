import nltk
assert nltk.__version__ == "3.10.3"
from nltk.tag import UnigramTagger, DefaultTagger

train = [[("the", "DT"), ("dog", "NN"), ("runs", "VB")], [("a", "DT"), ("dog", "NN"), ("sleeps", "VB")]]
gold = [[("the", "DT"), ("dog", "NN")]]
t = UnigramTagger(train)
assert t.accuracy(gold) == 1.0
assert dict(t.precision(gold)) == {"DT": 1.0, "NN": 1.0}
assert dict(t.recall(gold)) == {"DT": 1.0, "NN": 1.0}
assert dict(t.f_measure(gold)) == {"DT": 1.0, "NN": 1.0}
assert " DT | 1.0000 | 1.0000 | 1.0000" in t.evaluate_per_tag(gold)
assert t.size() == 5
assert dict(t._context_to_tag) == {"runs": "VB", "a": "DT", "the": "DT", "sleeps": "VB", "dog": "NN"}
try:
    UnigramTagger()
except ValueError:
    pass
try:
    UnigramTagger(train, model={"dog": "NN"})
except ValueError:
    pass
assert UnigramTagger(train, backoff=DefaultTagger("NN")).tag(["x"]) == [("x", "NN")]
