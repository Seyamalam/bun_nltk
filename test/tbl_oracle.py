import nltk

assert nltk.__version__ == "3.10.3"

import json

from nltk.tag.brill import Pos, Word
from nltk.tbl.demo import corpus_size, postag
from nltk.tbl.erroranalysis import error_list
from nltk.tbl.rule import Rule
from nltk.tbl.template import Template

out = {}

# Feature construction / ordering quirks
out["word_positions"] = list(Word([2, -1, -1]).positions)
out["pos_interval"] = list(Pos(-3, -1).positions)
try:
    Pos(2, 1)
except ValueError as e:
    out["pos_interval_error"] = str(e)
out["word_expand"] = [repr(f) for f in Word.expand([-3, -2, -1], [1, 2])]
out["word_expand_nozero"] = [repr(f) for f in Word.expand([-2, -1, 0], [1, 2], excludezero=True)]
try:
    Word.expand([-2, -1], [0])
except ValueError as e:
    out["expand_winlen_error"] = str(e)
out["issuperset"] = [
    Word([-3, -2, -1]).issuperset(Word([-3, -2])),
    Word([-3, -2, -1]).issuperset(Word([-3, -2, 0])),
    Word([-3, -2, -1]).issuperset(Pos([-3, -2])),
]
out["intersects"] = [
    Word([-3, -2, -1]).intersects(Word([-3, -2])),
    Word([-3, -2, -1]).intersects(Word([0])),
    Word([-3, -2, -1]).intersects(Pos([-3, -2])),
]
out["feature_lt_quirk"] = [
    Word([0]) < Pos([5]),
    Pos([0]) < Word([5]),
    Word([5]) < Pos([0]),
    Pos([5]) < Word([0]),
]
out["feature_json"] = Word([-2, -1]).encode_json_obj()
out["feature_decode"] = repr(Word.decode_json_obj([-2, -1]))

# Rule formats + apply/applies
r = Rule("023", "VB", "NN", [(Pos([-2, -1]), "DT")])
out["rule_repr"] = repr(r)
out["rule_str"] = str(r)
out["rule_verbose"] = r.format("verbose")
try:
    r.format("bogus")
except ValueError as e:
    out["rule_format_error"] = str(e)
toks = [("the", "DT"), ("dog", "NN"), ("sat", "VB")]
out["rule_applies"] = [r.applies(toks, i) for i in range(3)]
sent = [list(t) for t in toks]
out["rule_apply"] = [r.apply(sent), [tuple(t) for t in sent]]
r_empty = Rule("001", "NN", "VB", [])
out["rule_str_empty"] = str(r_empty)
out["rule_repr_empty"] = repr(r_empty)
out["rule_verbose_empty"] = r_empty.format("verbose")
out["rule_json"] = r.encode_json_obj()
decoded = Rule.decode_json_obj(r.encode_json_obj())
out["rule_json_roundtrip"] = repr(decoded)
try:
    from nltk.tbl.rule import TagRule

    TagRule("A", "B") == TagRule("A", "B")
except TypeError as e:
    out["tagrule_eq_error"] = str(e)

# Template: registry ids, applicable_rules, get_neighborhood, expand
Template._cleartemplates()
t = Template(Pos([-1]), Pos([1]))
out["template_repr"] = repr(t)
out["template_id"] = t.id
out["template_nb"] = sorted(t.get_neighborhood(toks, 1))
out["applicable_rules"] = [repr(x) for x in t.applicable_rules(toks, 1, "JJ")]
out["applicable_rules_correct"] = list(t.applicable_rules(toks, 1, "NN"))

wd_0, wd_01 = Word([0]), Word([0, 1])
pos_m2 = Pos([-2])
Template._cleartemplates()
out["expand_small"] = [repr(x) for x in Template.expand([[wd_0], [pos_m2]])]
Template._cleartemplates()
out["expand_small2"] = [repr(x) for x in Template.expand([[wd_0, wd_01], [pos_m2]])]

# deprecated ctor form
Template._cleartemplates()
out["template_deprecated"] = repr(Template(Word, (-2, -1), (0, 0)))
try:
    Template(Word, (-2, -1), Pos, (0, 0))
except TypeError as e:
    out["template_ctor_error"] = str(e)

# demo module
out["corpus_size"] = corpus_size([[1, 2, 3], [4, 5]])
gold = [[("a", "X"), ("b", "Y")], [("c", "Z")]]
test = [[("a", "X"), ("b", "Q")], [("c", "R")]]
out["error_list"] = error_list(gold, test)

# postag end-to-end on a small inline corpus (deterministic; no corpus needed)
train_data = [
    [("the", "DT"), ("cat", "NN"), ("sleeps", "VBZ"), (".", ".")],
    [("a", "DT"), ("dog", "NN"), ("barks", "VBZ"), (".", ".")],
    [("the", "DT"), ("dog", "NN"), ("runs", "VBZ"), ("fast", "RB"), (".", ".")],
    [("she", "PRP"), ("reads", "VBZ"), ("a", "DT"), ("book", "NN"), (".", ".")],
    [("they", "PRP"), ("book", "VB"), ("a", "DT"), ("table", "NN"), (".", ".")],
    [("he", "PRP"), ("will", "MD"), ("book", "VB"), ("flights", "NNS"), (".", ".")],
    [("i", "PRP"), ("read", "VBP"), ("the", "DT"), ("book", "NN"), (".", ".")],
    [("we", "PRP"), ("dance", "VBP"), ("every", "DT"), ("night", "NN"), (".", ".")],
    [("music", "NN"), ("makes", "VBZ"), ("people", "NNS"), ("dance", "VB"), (".", ".")],
]
import io
import contextlib

buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    tagger = postag(
        templates=[Template(Pos([-1])), Template(Pos([1])), Template(Pos([-2, -1])), Template(Pos([1, 2]))],
        tagged_data=train_data,
        num_sents=9,
        train=0.8,
        max_rules=10,
        min_score=2,
        trace=1,
    )
out["postag_stdout"] = buf.getvalue()
out["postag_type"] = type(tagger).__name__

print(json.dumps(out, indent=1, default=str))
