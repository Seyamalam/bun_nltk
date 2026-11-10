import nltk
assert nltk.__version__ == "3.10.3"
from nltk.collocations import BigramCollocationFinder
from nltk.metrics import BigramAssocMeasures as BAM

words = "the quick brown fox jumps over the lazy dog the dog barks".split()
f = BigramCollocationFinder.from_words(words)
assert f.N == 12 and f.word_fd["dog"] == 2 and f.window_size == 2
assert f.score_ngram(BAM.pmi, "the", "dog") == 1.0
top = f.score_ngrams(BAM.raw_freq)[:3]
assert top[0][0] == ("brown", "fox") and abs(top[0][1] - 1 / 12) < 1e-12
assert f.nbest(BAM.raw_freq, 3) == [("brown", "fox"), ("dog", "barks"), ("dog", "the")]
assert list(f.above_score(BAM.raw_freq, 1)) == []
f3 = BigramCollocationFinder.from_words(words, window_size=3)
assert f3.ngram_fd[("brown", "fox")] == 1
assert f3.ngram_fd[("brown", "jumps")] == 1
assert f3.ngram_fd[("dog", "dog")] == 1
assert f3.ngram_fd[("the", "dog")] == 2
f.apply_freq_filter(2)
assert dict(f.ngram_fd.items()) == {}
