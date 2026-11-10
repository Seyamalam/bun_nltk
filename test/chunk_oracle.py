import nltk

assert nltk.__version__ == "3.10.3"
from nltk import RegexpParser, RegexpChunkParser, ChunkScore, Tree
from nltk.chunk.regexp import (
    tag_pattern2re_pattern,
    ChunkRule,
    UnChunkRule,
    SplitRule,
    MergeRule,
    ExpandLeftRule,
    ExpandRightRule,
)

sent = [
    ("the", "DT"), ("little", "JJ"), ("yellow", "JJ"), ("dog", "NN"),
    ("barked", "VBD"), ("at", "IN"), ("the", "DT"), ("cat", "NN"),
]

p = nltk.RegexpParser("NP: {<DT>?<JJ>*<NN>}")
assert str(p.parse(sent)) == (
    "(S\n  (NP the/DT little/JJ yellow/JJ dog/NN)\n"
    "  barked/VBD\n  at/IN\n  (NP the/DT cat/NN))"
)

chinked = nltk.RegexpParser("NP: {<.*>+}\n      }<VBD|IN>+{")
assert str(chinked.parse(sent)) == str(p.parse(sent))

r = RegexpChunkParser([ChunkRule("<.*>+", ""), SplitRule("<NN.*>", "<VB.*>", "")])
assert str(r.parse([("a", "DT"), ("b", "JJ"), ("c", "NN"), ("d", "VB")])) == (
    "(S (NP a/DT b/JJ c/NN) (NP d/VB))"
)

r = RegexpChunkParser([ChunkRule("<JJ.*>", ""), ChunkRule("<NN.*>", ""), MergeRule("<JJ.*>", "<NN.*>", "")])
assert str(r.parse([("a", "JJ"), ("b", "NN")])) == "(S (NP a/JJ b/NN))"

r = RegexpChunkParser([ChunkRule("<NN.*>", ""), ExpandLeftRule("<DT>", "<NN.*>", "")])
assert str(r.parse([("a", "DT"), ("b", "NN")])) == "(S (NP a/DT b/NN))"

r = RegexpChunkParser([ChunkRule("<JJ.*>", ""), ExpandRightRule("<JJ.*>", "<NN.*>", "")])
assert str(r.parse([("a", "JJ"), ("b", "NN")])) == "(S (NP a/JJ b/NN))"

r = RegexpChunkParser([ChunkRule("<DT>", ""), ChunkRule("<NN>", ""), UnChunkRule("<DT>", "")])
assert str(r.parse([("a", "DT"), ("b", "NN")])) == "(S a/DT (NP b/NN))"

assert tag_pattern2re_pattern("<DT>?<JJ>*<NN>") == "(<(DT)>)?(<(JJ)>)*(<(NN)>)"

gold = Tree("S", [("the", "DT"), ("little", "JJ"), Tree("NP", [("dog", "NN"), ("barked", "VBD")])])
guess = Tree("S", [("the", "DT"), Tree("NP", [("little", "JJ"), ("dog", "NN")]), ("barked", "VBD")])
score = ChunkScore()
score.score(gold, guess)
assert score.accuracy() == 0.25
assert score.precision() == 0.0
assert score.recall() == 0.0
assert score.f_measure() == 0
assert len(score) == 1
assert repr(score) == "<ChunkScoring of 1 chunks>"
assert str(score) == (
    "ChunkParse score:\n    IOB Accuracy:  25.0%\n"
    "    Precision:      0.0%\n    Recall:         0.0%\n    F-Measure:      0.0%"
)

print("chunk oracle ok")
