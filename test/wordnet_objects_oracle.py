import nltk

assert nltk.__version__ == "3.10.3"
nltk.data.path.insert(0, ".cache/nltk-data")
from nltk.corpus import wordnet as wn

dog = wn.synset("dog.n.01")
cat = wn.synset("cat.n.01")
assert dog.name() == "dog.n.01"
assert dog.pos() == "n"
assert dog.offset() == 2084071
assert dog.lexname() == "noun.animal"
assert dog.lemma_names() == ["dog", "domestic_dog", "Canis_familiaris"]
assert [s.name() for s in dog.hypernyms()] == ["domestic_animal.n.01", "canine.n.02"]
assert [s.name() for s in dog.lowest_common_hypernyms(cat)] == ["carnivore.n.01"]
assert len(dog.hypernym_paths()) == 2
assert [s.name() for s in dog.hypernym_paths()[0]] == [
    "entity.n.01", "physical_entity.n.01", "object.n.01", "whole.n.02",
    "living_thing.n.01", "organism.n.01", "animal.n.01",
    "domestic_animal.n.01", "dog.n.01",
]
assert dog.shortest_path_distance(cat) == 4
assert dog.path_similarity(cat) == 0.2
assert round(dog.wup_similarity(cat), 6) == 0.857143
assert round(dog.lch_similarity(cat), 6) == 2.028148
assert (dog.max_depth(), dog.min_depth()) == (13, 8)
assert [s.name() for s in dog.root_hypernyms()] == ["entity.n.01"]
assert [s.name() for s in wn.synsets("dog", pos="n")][:5] == [
    "dog.n.01", "frump.n.01", "dog.n.03", "cad.n.01", "frank.n.02",
]
assert [l.name() for l in wn.lemma("good.a.01.good").antonyms()] == ["bad"]
assert wn.lemma("dog.n.01.dog").key() == "dog%1:05:00::"
assert repr(wn.lemma("dog.n.01.dog")) == "Lemma('dog.n.01.dog')"

print("wordnet objects oracle ok")

# wordnet-ic-differential: simulate_root / IC similarity pins (ic-brown.dat)
bark = wn.synset("bark.v.01")
hungry = wn.synset("hungry.a.01")
walk = wn.synset("walk.v.01")
run = wn.synset("run.v.02")
assert [s.name() for s in dog.lowest_common_hypernyms(bark)] == []
assert [s.name() for s in dog.lowest_common_hypernyms(bark, simulate_root=True)] == ["*ROOT*"]
assert dog.shortest_path_distance(bark) is None
assert dog.shortest_path_distance(bark, simulate_root=True) == 14
assert [d for s, d in dog.hypernym_distances(simulate_root=True) if s.name() == "*ROOT*"] == [14]
assert sorted(d for s, d in dog.hypernym_distances() if s.name() == "entity.n.01") == [8, 13]
assert dog.wup_similarity(bark) == 0.125
assert dog.wup_similarity(hungry) == 1 / 6
assert round(walk.lch_similarity(run), 6) == 1.648659
assert dog.lch_similarity(dog) == 3.6375861597263857
try:
    dog.lch_similarity(bark)
    raise AssertionError("lch cross-pos did not raise")
except Exception as e:
    assert "to have the same part of speech" in str(e)

from nltk.corpus import wordnet_ic
from nltk.corpus.reader.wordnet import (
    information_content,
    path_similarity as ps,
    lch_similarity as lcs,
    wup_similarity as ws,
    res_similarity as rs,
    jcn_similarity as js,
    lin_similarity as ls,
)

ic = wordnet_ic.ic("ic-brown.dat")
assert information_content(dog, ic) == 9.006014398918229
assert information_content(cat, ic) == 9.040649895580986
assert dog.res_similarity(cat, ic) == 7.911666509036577
assert dog.jcn_similarity(cat, ic) == 0.4497755285516739
assert dog.lin_similarity(cat, ic) == 0.8768009843733973
assert dog.lin_similarity(dog, ic) == 1.0
assert dog.jcn_similarity(dog, ic) == 1e300
assert ps(dog, cat) == 0.2
assert lcs(dog, cat) == 2.0281482472922856
assert ws(dog, cat) == 0.8571428571428571
assert rs(dog, cat, ic) == 7.911666509036577
assert js(dog, cat, ic) == 0.4497755285516739
assert ls(dog, cat, ic) == 0.8768009843733973
try:
    information_content(dog, {"v": ic["v"]})
    raise AssertionError("missing pos did not raise")
except Exception as e:
    assert "no entries for part-of-speech: n" in str(e)
try:
    dog.res_similarity(bark, ic)
    raise AssertionError("res cross-pos did not raise")
except Exception as e:
    assert "least common subsumer" in str(e)

print("wordnet ic oracle ok")
