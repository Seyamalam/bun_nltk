import nltk
assert nltk.__version__ == "3.10.3"
from nltk.tag.perceptron import PerceptronTagger

t = PerceptronTagger(load=False)
t.train([[("today", "NN"), ("is", "VBZ"), ("good", "JJ"), ("day", "NN")],
         [("yes", "NNS"), ("it", "PRP"), ("beautiful", "JJ")]])
assert sorted(t.classes) == ["JJ", "NN", "NNS", "PRP", "VBZ"]
assert t.tag("today is a beautiful day".split()) == [
    ("today", "NN"), ("is", "PRP"), ("a", "PRP"), ("beautiful", "JJ"), ("day", "NN")]
assert [t.normalize(w) for w in ["word", "Word", "has-hyphen", "-lead", "1999", "12x", "x12", ""]] == \
    ["word", "word", "!HYPHEN", "-lead", "!YEAR", "!DIGITS", "x12", ""]
assert list(t.param_files("eng")) == [
    "averaged_perceptron_tagger_eng.weights.json",
    "averaged_perceptron_tagger_eng.tagdict.json",
    "averaged_perceptron_tagger_eng.classes.json"]
gold = [[("today", "NN"), ("is", "VBZ")]]
assert t.accuracy(gold) == 0.5
assert dict(t.precision(gold)) == {"NN": 1.0, "PRP": 0.0, "VBZ": 0.0}
assert dict(t.recall(gold)) == {"NN": 1.0, "PRP": 0.0, "VBZ": 0.0}
assert "PRP | 0.0000" in t.evaluate_per_tag(gold)
try:
    PerceptronTagger(load=False).tag(["x"])
except ValueError:
    pass
weights, tagdict, classes = t.encode_json_obj()
t2 = PerceptronTagger(load=False)
t2.decode_json_params([weights, tagdict, classes])
assert t2.classes == t.classes
assert t2.tag("today is a beautiful day".split()) == t.tag("today is a beautiful day".split())
