import nltk

assert nltk.__version__ == "3.10.3"
from nltk.lm import (
    MLE,
    Lidstone,
    Laplace,
    StupidBackoff,
    WittenBellInterpolated,
    AbsoluteDiscountingInterpolated,
    KneserNeyInterpolated,
    Vocabulary,
    NgramCounter,
)
from nltk.lm.preprocessing import padded_everygram_pipeline

train = [
    [
        ("<s>",), ("<s>", "a"), ("a",), ("a", "b"), ("b",), ("b", "c"),
        ("c",), ("c", "d"), ("d",), ("d", "</s>"), ("</s>",),
    ]
]
vocab = ["<s>", "a", "b", "c", "d", "</s>"]

expected = {
    "MLE": (1.0, 0.166667, 1.0),
    "Lidstone": (0.647059, 0.164179, 1.545455),
    "Laplace": (0.25, 0.153846, 4.0),
    "StupidBackoff": (1.0, 0.166667, 1.0),
    "WittenBellInterpolated": (0.583333, 0.166667, 1.714286),
    "AbsoluteDiscountingInterpolated": (0.375, 0.166667, 2.666667),
    "KneserNeyInterpolated": (0.92, 0.2, 1.086957),
}
for lm in (
    MLE(2), Lidstone(0.1, 2), Laplace(2), StupidBackoff(0.4, 2),
    WittenBellInterpolated(2), AbsoluteDiscountingInterpolated(2), KneserNeyInterpolated(2),
):
    lm.fit(train, vocab)
    got = (
        round(lm.score("b", ["a"]), 6),
        round(lm.score("b"), 6),
        round(lm.perplexity([("a", "b"), ("b", "c")]), 6),
    )
    assert got == expected[type(lm).__name__], (type(lm).__name__, got)

m = MLE(2)
m.fit(train, vocab)
assert m.generate(3, text_seed=["<s>"], random_seed=3) == ["a", "b", "c"]
assert m.counts.N() == 11
assert m.counts.unigrams["a"] == 1
assert dict(m.counts[2][("<s>",)]) == {"a": 1}
assert m.logscore("a", ["<s>"]) == 0.0
assert m.score("d", ["a", "b", "c", "d"]) == 0
assert m.entropy([("<s>", "a"), ("a", "b")]) == -0.0

v = Vocabulary(["a", "c", "-", "d", "c", "a", "b", "r", "a", "c", "d"], unk_cutoff=2)
assert v["c"] == 3 and "c" in v
assert v["b"] == 1 and "b" not in v
assert sorted(v) == ["<UNK>", "a", "c", "d"]
assert len(v) == 4
assert str(v) == "<Vocabulary with cutoff=2 unk_label='<UNK>' and 4 items>"
assert v.lookup("a") == "a"
assert v.lookup("aliens") == "<UNK>"
assert v.lookup(["p", "a", "r", "d", "b", "c"]) == ("<UNK>", "a", "<UNK>", "d", "<UNK>", "c")

nc = NgramCounter([[("a", "b"), ("c",), ("d", "e")]])
assert nc.N() == 3
assert nc[2][("a",)]["b"] == 1
assert nc["c"] == 1
assert str(nc) == "<NgramCounter with 2 ngram orders and 3 ngrams>"

print("lm oracle ok")
