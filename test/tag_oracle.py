"""Oracle pins for the nltk.tag family (NLTK 3.10.3, Python 3.14.4).

Run: .venv/bin/python test/tag_oracle.py
Outputs are pinned verbatim in test/tag.test.ts.
"""
import io
import numpy as np
from contextlib import redirect_stdout

import nltk

assert nltk.__version__ == "3.10.3"

from nltk.tag.util import str2tuple, tuple2str, untag
from nltk.tag.brill import brill24, fntbl37, nltkdemo18, nltkdemo18plus, describe_template_sets, Template, Pos, Word
from nltk.tag.hmm import logsumexp2, HiddenMarkovModelTrainer
from nltk.tag.tnt import basic_sent_chop, TnT
from nltk.metrics import accuracy, ConfusionMatrix

print("== str2tuple ==")
for s in ["fly/NN", "fly/nn", "word", "a/b/c", "x/", "/NN", ""]:
    try:
        print(repr(s), "->", str2tuple(s))
    except Exception as e:
        print(repr(s), "->", type(e).__name__, str(e))
print("with-sep", str2tuple("fly-NN", sep="-"))

print("== tuple2str ==")
for t in [("fly", "NN"), ("word", None)]:
    print(repr(t), "->", tuple2str(t))
try:
    tuple2str(("a", "x/y"))
except AssertionError as e:
    print("('a','x/y') -> AssertionError:", e)

print("== untag ==")
print(untag([("John", "NNP"), ("saw", "VBD"), ("Mary", "NNP")]))

print("== accuracy / ConfusionMatrix ==")
print("accuracy", accuracy(["a", "b", "c"], ["a", "x", "c"]))
cm = ConfusionMatrix(["a", "b", "c"], ["a", "x", "c"])
print("cm.precision('a')", cm.precision("a"))

print("== brill template sets ==")
for fn in (nltkdemo18, nltkdemo18plus, fntbl37, brill24):
    templates = fn()
    print(fn.__name__, len(templates))
    for t in templates[:3]:
        print("  ", repr(t))
print("  last brill24:", repr(brill24()[-1]))

buf = io.StringIO()
with redirect_stdout(buf):
    describe_template_sets()
print("== describe_template_sets ==")
print(repr(buf.getvalue()))

print("== logsumexp2 ==")
for arr in [[0, -1, -2], [0], [-5.0, -5.0]]:
    print(arr, "->", repr(float(logsumexp2(np.array(arr, dtype=float)))))

print("== basic_sent_chop ==")
print(basic_sent_chop(["a", "b", ".", "c", "!", "d", "e"]))
print(basic_sent_chop([("a", "X"), (".", "."), ("b", "Y")], raw=False))

print("== hmm supervised ==")
train = [
    [("the", "DT"), ("cat", "NN"), ("sleeps", "VBZ"), (".", ".")],
    [("a", "DT"), ("dog", "NN"), ("barks", "VBZ"), (".", ".")],
    [("the", "DT"), ("dog", "NN"), ("runs", "VBZ"), ("fast", "RB"), (".", ".")],
    [("she", "PRP"), ("reads", "VBZ"), ("a", "DT"), ("book", "NN"), (".", ".")],
    [("they", "PRP"), ("book", "VB"), ("a", "DT"), ("table", "NN"), (".", ".")],
    [("he", "PRP"), ("will", "MD"), ("book", "VB"), ("flights", "NNS"), (".", ".")],
    [("i", "PRP"), ("read", "VBP"), ("the", "DT"), ("book", "NN"), (".", ".")],
    [("the", "DT"), ("birds", "NNS"), ("sing", "VBP"), ("sweetly", "RB"), (".", ".")],
]
trainer = HiddenMarkovModelTrainer()
tagger = trainer.train_supervised(train)
print("states", tagger._states)
print("symbols", tagger._symbols)
print("tag", tagger.tag(["the", "cat", "sleeps", "."]))
print("tag2", tagger.tag(["she", "will", "book", "."]))
print("accuracy", tagger.accuracy(train))
print("best_path", tagger.best_path(["the", "cat"]))

print("== tnt ==")
tnt = TnT()
tnt.train(train)
print("tnt.tag", tnt.tag(["the", "cat", "sleeps", "."]))
print("tnt.evaluate", tnt.evaluate(train))
