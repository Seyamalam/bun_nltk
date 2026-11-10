"""metrics-extra-differential oracle: NLTK 3.10.3 pins for test/metrics_extra.test.ts"""
import nltk
assert nltk.__version__ == "3.10.3", nltk.__version__
from nltk.metrics.distance import jaro_similarity, jaro_winkler_similarity
from nltk.metrics.segmentation import ghd
from nltk.metrics.scores import approxrand
from nltk.translate.chrf_score import chrf_precision_recall_fscore_support as crf
from fractions import Fraction as F
print(jaro_similarity('dixon','dickson'), jaro_winkler_similarity('dixon','dickson'))
print(jaro_similarity('dwayne','duane'), jaro_winkler_similarity('dwayne','duane'))
print(jaro_similarity('SHACKLEFORD','SHACKELFORD'), jaro_winkler_similarity('SHACKLEFORD','SHACKELFORD'))
print(jaro_similarity('','nonempty'), jaro_similarity('a','b'), jaro_similarity('',''))
print(jaro_winkler_similarity('TANYA','TONYA',p=0.1,max_l=100))
print(ghd('1100100000','1100010000',1.0,1.0,0.5), ghd('1100100000','1100000001',1.0,1.0,0.5))
print(ghd('011','110',1.0,1.0,0.5), ghd('1','0',1.0,1.0,0.5), ghd('111','000',1.0,1.0,0.5), ghd('000','111',1.0,2.0,0.5))
print(ghd('000','000',1.0,1.0,0.5), ghd('100','000',2.0,1.0,0.5))
print(approxrand([1,2],[1,2]))
print(crf(list('abcde'),list('abdfe'),2), crf(list('abc'),list('xyz'),2), crf(list('aaa'),list('aa'),2), crf([],list('ab'),2), crf(list('ab'),[],2))
print(F(3,4), F('5/6'), float(F(7,8)), F(0.5), F(1,3).limit_denominator(10), F(-3,4).numerator, F(-3,4).denominator, F(1,2)+F(1,3), F(2,3).is_integer(), F(4,2).is_integer())
