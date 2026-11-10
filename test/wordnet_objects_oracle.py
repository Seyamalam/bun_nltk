import nltk

assert nltk.__version__ == "3.10.3"
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
