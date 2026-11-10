"""Oracle pins for nltk.translate.meteor_score / ribes_score (NLTK 3.10.3)."""

import nltk

assert nltk.__version__ == "3.10.3", nltk.__version__

from nltk.translate.meteor_score import meteor_score
from nltk.translate.ribes_score import (
    corpus_ribes,
    kendall_tau,
    sentence_ribes,
    spearman_rho,
    word_rank_alignment,
)

ref1a = "It is a guide to action that ensures that the military will forever heed Party commands".split()
hyp1 = "It is a guide to action which ensures that the military always obeys the commands of the party".split()

SENTENCE_RIBES = sentence_ribes([ref1a], hyp1)
WORD_RANK_ALIGNMENT = word_rank_alignment(
    "he was interested in world history because he read the book".split(),
    "he read the book because he was interested in world history".split(),
)
WORD_RANK_ALIGNMENT2 = word_rank_alignment(
    "John hit Bob yesterday".split(), "Bob hit John yesterday".split()
)
_worder = [7, 8, 9, 10, 6, 0, 1, 2, 3, 4, 5]
KENDALL_TAU = (kendall_tau(_worder, normalize=False), kendall_tau(_worder))
SPEARMAN_RHO = (spearman_rho(_worder, normalize=False), spearman_rho(_worder))
CORPUS_RIBES = corpus_ribes(
    [[ref1a], ["he was interested in world history because he read the book".split()]],
    [hyp1, "he read the book because he was interested in world history".split()],
)
METEOR = meteor_score([["this", "is", "a", "test"]], ["this", "is", "a", "test"])

if __name__ == "__main__":
    for name in list(globals()):
        if name.isupper():
            print(f"{name} = {globals()[name]!r}")
