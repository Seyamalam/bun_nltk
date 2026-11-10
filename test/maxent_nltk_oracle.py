"""maxent-differential oracle: NLTK 3.10.3 values pinned in test/maxent_nltk.test.ts"""
import nltk
assert nltk.__version__ == "3.10.3", nltk.__version__
import io, numpy
import nltk.classify.maxent as m
from nltk.classify.maxent import (
    BinaryMaxentFeatureEncoding, GISEncoding, TadmEventMaxentFeatureEncoding,
    FunctionBackedMaxentFeatureEncoding, ConditionalExponentialClassifier,
    CutoffChecker, calculate_deltas, calculate_empirical_fcount,
    calculate_estimated_fcount, calculate_nfmap,
    train_maxent_classifier_with_gis, train_maxent_classifier_with_iis,
    write_megam_file, write_tadm_file, parse_megam_weights, parse_tadm_weights,
)

train = [
    ({"a": 1, "b": 1, "c": 1}, "y"),
    ({"a": 1, "b": 1, "c": 0}, "x"),
    ({"a": 1, "b": 1, "c": 1}, "y"),
    ({"a": 0, "b": 1, "c": 1}, "x"),
]
train2 = [({"a": 1, "b": 1}, "y"), ({"a": 0, "b": 1}, "x"),
          ({"a": 1, "b": 1}, "y"), ({"a": 0, "b": 1}, "x")]

enc = GISEncoding.train(train)
print("gis:", enc.C, enc.length(), enc.labels(), enc.encode({"a": 1, "b": 1, "c": 0}, "x"))
mc = train_maxent_classifier_with_gis(train, trace=0, encoding=enc, max_iter=10)
print("w:", [round(w, 6) for w in mc.weights()])
pd = mc.prob_classify({"a": 1, "b": 1, "c": 1})
print("pd:", sorted((l, round(pd.prob(l), 6)) for l in pd.samples()))
print("cls:", mc.classify({"a": 1, "b": 1, "c": 1}), mc.most_informative_features(3), repr(mc))

enc2 = BinaryMaxentFeatureEncoding.train(train)
mc2 = train_maxent_classifier_with_iis(train, trace=0, encoding=enc2, max_iter=10)
pd2 = mc2.prob_classify({"a": 1, "b": 1, "c": 1})
print("pd2:", sorted((l, round(pd2.prob(l), 6)) for l in pd2.samples()))

emp = m.calculate_empirical_fcount(train, enc2) / len(train)
nfmap = m.calculate_nfmap(train, enc2)
nfarr = numpy.array(sorted(nfmap, key=nfmap.__getitem__), "d")
nft = numpy.reshape(nfarr, (len(nfarr), 1))
unatt = set(numpy.nonzero(emp == 0)[0])
w0 = numpy.zeros(len(emp), "d")
for f in unatt:
    w0[f] = numpy.NINF
mc3 = ConditionalExponentialClassifier(enc2, w0)
d = m.calculate_deltas(train, mc3, unatt, emp, nfmap, nfarr, nft, enc2)
print("deltas:", [round(x, 6) for x in d])

s = io.StringIO()
write_megam_file(train, enc2, s)
print("megam:", repr(s.getvalue()))

te = TadmEventMaxentFeatureEncoding.train(train2)
print("tadm:", te.length(), te.labels(), te.encode({"a": 1, "b": 1}, "x"), te.describe(0), te.describe(3))
s2 = io.StringIO()
write_tadm_file(train2, te, s2)
print("tadmfile:", repr(s2.getvalue()))

fe = FunctionBackedMaxentFeatureEncoding(lambda fs, l: [(0, 1), (1, 2)], 2, ["y", "x"])
print("func:", fe.encode({"a": 1}, "y"), fe.length(), fe.labels(), fe.describe(0))

cc = CutoffChecker({"max_iter": 5})
print("cut:", cc.iter, cc.check(mc, train), cc.iter)
print("tadmw:", parse_tadm_weights(iter(["1.5\n", "-2.0\n", "3.25"])))
print("megamw:", parse_megam_weights("0 0.5\n2 -1.25\n", 4))

# GIS explain on a dataset without near-zero weight residuals.
mc4 = train_maxent_classifier_with_gis(
    [({"a": 1, "b": 1}, "y"), ({"a": 0, "b": 0}, "x"), ({"a": 1, "b": 0}, "y"), ({"a": 0, "b": 0}, "x")],
    trace=0, max_iter=5)
print("explain:")
mc4.explain({"a": 1, "b": 1}, 2)
print("mifshow:")
mc4.show_most_informative_features(3, "all")

# train() classmethod dispatch
mct = ConditionalExponentialClassifier.train(train2, "gis", trace=0, max_iter=8)
print("traincls:", mct.classify({"a": 1, "b": 1}))
try:
    ConditionalExponentialClassifier.train(train2, "iis", trace=0, bogus=1)
except TypeError as e:
    print("kwerr:", e)
try:
    GISEncoding(["y"], {("f", 1, "y"): 0}, C=0).encode({"f": 1}, "y")
except ValueError as e:
    print("correrr:", e)
