"""sequential-extra-differential oracle: NLTK 3.10.3 pins for test/sequential_extra.test.ts"""
import nltk
assert nltk.__version__ == "3.10.3", nltk.__version__
from nltk.tag.sequential import AffixTagger, ClassifierBasedPOSTagger
from nltk.tag import DefaultTagger
train = [[('the','DT'),('quick','JJ'),('brown','JJ'),('fox','NN'),('jumps','VBZ')],
         [('a','DT'),('slow','JJ'),('dog','NN'),('barks','VBZ')],
         [('running','VBG'),('quickly','RB')]]
t = AffixTagger(train, affix_length=-3)
print('tag:', t.tag(['the','slow','running','xyz']))
t2 = AffixTagger(train, affix_length=2, backoff=DefaultTagger('NN'))
print('tag2:', t2.tag(['the','slow','running','xyz']))
print('ctx:', t2.context(['abcdef'],0,[]), t2.context(['ab'],0,[]))
cb = ClassifierBasedPOSTagger(train=train)
print('cbtag:', cb.tag(['the','slow','running','xyz','a']))
fd = ClassifierBasedPOSTagger(classifier=cb._classifier).feature_detector(['The','quick','Fox'],1,['DT'])
print('fd:', fd)
