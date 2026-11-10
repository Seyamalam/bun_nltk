"""Oracle pins for nltk.translate.api / gale_church helpers / metrics (NLTK 3.10.3)."""

import nltk

assert nltk.__version__ == "3.10.3", nltk.__version__

from nltk.translate import Alignment, AlignedSent, gale_church, metrics
from nltk.translate.ribes_score import position_of_ngram

a = Alignment([(0, 0), (1, 2), (2, 1), (4, 3)])
ALIGNMENT_STR = str(a)
ALIGNMENT_REPR = repr(a)
ALIGNMENT_INVERT = repr(a.invert())
ALIGNMENT_GET = (a[0], a[1], a[3])
ALIGNMENT_RANGE = a.range()
ALIGNMENT_RANGE_POS = a.range([1, 4])
ALIGNMENT_FROMSTRING = repr(Alignment.fromstring("0-0 1-2 2-1"))

sent = AlignedSent(["the", "house"], ["das", "Haus"], Alignment([(0, 0), (1, 1)]))
ALIGNED_SENT_STR = str(sent)
ALIGNED_SENT_INVERT = str(sent.invert())

ERFCC = (gale_church.erfcc(1.7), gale_church.erfcc(-0.5))
NORM_CDF = (gale_church.norm_cdf(0.0), gale_church.norm_cdf(2.5))
NORM_LOGSF = (gale_church.norm_logsf(1.0), gale_church.norm_logsf(-3.0))

ALIGN_TEXTS = gale_church.align_texts([[5, 5]], [[5, 6]])
try:
    gale_church.align_texts([[1, 2]], [[1], [2]])
    ALIGN_TEXTS_ERROR = None
except ValueError as e:
    ALIGN_TEXTS_ERROR = str(e)

ref = Alignment([(0, 0), (1, 1), (2, 2)])
hyp = Alignment([(0, 0), (1, 2), (2, 1)])
AER = metrics.alignment_error_rate(ref, hyp)
poss = Alignment([(0, 0), (1, 1), (1, 2), (2, 1), (2, 2)])
AER_POSSIBLE = metrics.alignment_error_rate(ref, hyp, poss)

POSITION_OF_NGRAM = (
    position_of_ngram(("b", "c"), ["a", "b", "c", "d"]),
    position_of_ngram(("z",), ["a", "b"]),
)

if __name__ == "__main__":
    for name in list(globals()):
        if name.isupper():
            print(f"{name} = {globals()[name]!r}")
