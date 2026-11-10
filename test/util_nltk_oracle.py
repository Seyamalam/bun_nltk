"""util-differential oracle: NLTK 3.10.3 values pinned in test/util_nltk.test.ts"""
import nltk
assert nltk.__version__ == "3.10.3", nltk.__version__
from nltk.util import everygrams, skipgrams, ngrams, pad_sequence, choose, edge_closure, flatten, unique_list, acyclic_depth_first, acyclic_branches_depth_first, cut_string, tokenwrap, unweighted_minimum_spanning_tree, unweighted_minimum_spanning_dict, Index, invert_dict
g = lambda n: {'A':['B','C'],'B':['C'],'C':['B']}[n]
print("every:", list(everygrams('a b c'.split())))
print("every2:", list(everygrams('a b c'.split(), max_len=2)))
print("skip22:", list(skipgrams("Insurgents killed in ongoing fighting".split(), 2, 2)))
print("skip32:", list(skipgrams("Insurgents killed in ongoing fighting".split(), 3, 2)))
print("ngrams3:", list(ngrams([1,2,3,4,5], 3)))
print("pad:", list(pad_sequence([1,2,3], 2, pad_left=True, pad_right=True, left_pad_symbol='<s>', right_pad_symbol='</s>')))
print("ngpad:", list(ngrams([1,2,3,4,5], 2, pad_right=True)))
print("choose:", choose(4,2), choose(6,2), choose(10,3), choose(5,0), choose(3,7))
print("edges:", list(edge_closure('A', g)))
print("mst:", unweighted_minimum_spanning_tree('A', g))
print("mstd:", unweighted_minimum_spanning_dict('A', g))
print("adf:", acyclic_depth_first('A', g, cut_mark='...'))
print("abdf:", acyclic_branches_depth_first('A', g, cut_mark='...'))
print("flat:", flatten(1,2,['b','a',['c','d']],3))
print("uniq:", unique_list([1,2,1,3,2,4]))
print("cut:", repr(cut_string('abc def ghi', 5)), repr(cut_string('abc def ghi', -4)))
print("tw:", repr(tokenwrap(['the','quick','brown','fox','jumps'], width=10)))
print("idx:", dict(Index([('a',1),('b',2),('a',3)])))
print("inv:", dict(invert_dict({'a':['x','y'],'b':['x'],'c':3})))
