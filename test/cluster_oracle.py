"""Oracle pins for nltk.cluster (NLTK 3.10.3)."""

import nltk

assert nltk.__version__ == "3.10.3", nltk.__version__

import numpy

from nltk.cluster.gaac import GAAClusterer
from nltk.cluster.util import cosine_distance, euclidean_distance

vectors = [numpy.array(v) for v in [[2, 1], [5, 3], [1, 3], [2, 1.5], [6, 4]]]
_c = GAAClusterer(3)
_c.cluster(vectors, True)

GAA_CLUSTER_NAMES = [_c.cluster_name(v).tolist() for v in vectors]
GAA_CLASSIFY = (
    _c.classify(numpy.array([2, 2])),
    _c.classify(numpy.array([5.5, 3.5])),
    _c.classify(numpy.array([1, 3.1])),
)
_d = _c.dendrogram()
DENDROGRAM_GROUPS = [[leaf.tolist() for leaf in grp] for grp in _d.groups(3)]
DENDROGRAM_REPR = str(_d)

DISTANCES = (
    euclidean_distance(numpy.array([0, 0]), numpy.array([3, 4])),
    cosine_distance(numpy.array([1, 0]), numpy.array([0, 1])),
    cosine_distance(numpy.array([1, 0]), numpy.array([1, 0])),
)

if __name__ == "__main__":
    for name in list(globals()):
        if name.isupper():
            print(f"{name} = {globals()[name]!r}")
