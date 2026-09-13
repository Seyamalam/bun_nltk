#!/usr/bin/env python3
"""Regenerate statistical regressions with pinned NLTK, without bun_nltk imports."""
import json
import random
import sys
from pathlib import Path
import nltk
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'bench'))
from python_lm_baseline import build_model, perplexity_from_scores
from python_classifier_baseline import to_features
from python_decision_tree_baseline import to_features as tree_features
from nltk.classify import DecisionTreeClassifier, MaxentClassifier, NaiveBayesClassifier
assert nltk.__version__ == '3.10.3', nltk.__version__
rng = random.Random(1337)
lm = []
unsupported = []
unsupported_perplexities = []
corpora = [[['a']], [['a','b'],['a','b'],['x','b']], [['A','b','c'],['b','c','a'],['c','x'],[]]]
for order in range(1,6):
    for name in ['mle','lidstone','kneser_ney_interpolated','stupid_backoff','witten_bell_interpolated','absolute_discounting_interpolated']:
        if order == 1 and name == 'kneser_ney_interpolated':
            continue  # NLTK requires at least order 2.
        for corpus in corpora:
            for left,right in [(True,True),(False,False),(True,False),(False,True)]:
                options = dict(order=order,model=name,gamma=.3,discount=.6,alpha=.4,padLeft=left,padRight=right,startToken='<BOS>',endToken='<EOS>')
                model = build_model(dict(options,sentences=corpus))
                contexts = [[]] + [[token]*length for length in range(1,order) for token in ['a','b','unknown','<BOS>','<EOS>']]
                try:
                    probes = [dict(word=word,context=context,score=model.score(word,context)) for context in contexts for word in ['a','b','unknown','<EOS>']]
                except ZeroDivisionError:
                    unsupported.append(dict(options=options,sentences=corpus,reason='NLTK has no continuation counts and raises ZeroDivisionError'))
                    continue
                perplexities = []
                for tokens in [[],['a','b']]:
                    try:
                        value = perplexity_from_scores(model,dict(options,perplexityTokens=tokens))
                    except ZeroDivisionError:
                        unsupported_perplexities.append(dict(options=options,sentences=corpus,tokens=tokens,reason="NLTK raises ZeroDivisionError for this sparse unpadded context"))
                        continue
                    perplexities.append(dict(tokens=tokens,value=value if value != float('inf') else None))
                lm.append(dict(options=options,sentences=corpus,probes=probes,perplexities=perplexities))
classifiers = []
for scenario in range(12):
    labels=['A','B','C'][:2+scenario%2]
    train=[dict(label=labels[i%len(labels)],text=' '.join(rng.choices(['a','b','c',"don't",'d'],k=rng.randrange(0,9)))) for i in range(5+scenario)]
    test=['','unknown','a a a','a b',"don't",'a unknown c'] + [' '.join(rng.choices(['a','b','c','d'],k=5)) for _ in range(8)]
    gamma=[.5,1,.3][scenario%3];epochs=3+scenario%5
    rows=[(to_features(row['text']),row['label']) for row in train]
    nb=NaiveBayesClassifier.train(rows,estimator=lambda fd,bins=None:nltk.LidstoneProbDist(fd,gamma,bins))
    me=MaxentClassifier.train(rows,algorithm='iis',trace=0,max_iter=epochs,labels=sorted(labels))
    dt=DecisionTreeClassifier.train([(tree_features(row['text']),row['label']) for row in train],depth_cutoff=5,support_cutoff=2)
    expected=[]
    for text in test:
        feats=to_features(text)
        expected.append(dict(text=text,nb=nb.classify(feats),maxent=me.classify(feats),tree=dt.classify(tree_features(text)),nbProb={l:nb.prob_classify(feats).prob(l) for l in labels},maxentProb={l:me.prob_classify(feats).prob(l) for l in labels}))
    classifiers.append(dict(train=train,smoothing=gamma,epochs=epochs,expected=expected))
out=Path(__file__).resolve().parents[1]/'test/fixtures/statistical-parity.json'
out.write_text(json.dumps(dict(nltk_version=nltk.__version__,lm=lm,classifiers=classifiers,unsupported=unsupported,unsupported_perplexities=unsupported_perplexities),separators=(',',':'))+'\n')
print(f'Wrote {len(lm)} LM configurations and {len(classifiers)} classifier scenarios to {out}')
