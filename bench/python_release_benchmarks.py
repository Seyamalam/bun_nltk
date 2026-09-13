#!/usr/bin/env python3
"""Matched in-process workloads; imports, JSON I/O and warmup are not timed."""
import json
import sys
import time
import nltk
from nltk.classify import NaiveBayesClassifier, MaxentClassifier, ConditionalExponentialClassifier, DecisionTreeClassifier
from nltk.tokenize.punkt import PunktTokenizer
from nltk.sentiment.vader import SentimentIntensityAnalyzer
from nltk.chunk import Maxent_NE_Chunker
from python_classifier_baseline import to_features
from python_decision_tree_baseline import to_features as tree_features
from python_lm_baseline import build_model, perplexity_from_scores

payload = json.load(open(sys.argv[1]))
kind = payload['kind']
rounds = payload['rounds']
punkt = PunktTokenizer('english') if kind == 'punkt' else None
sentiment = SentimentIntensityAnalyzer() if kind == 'sentiment' else None
ner = Maxent_NE_Chunker() if kind == 'ner' else None

def run():
    if kind in ('nb', 'maxent', 'condexp', 'decision_tree'):
        feature_fn = tree_features if kind == 'decision_tree' else to_features
        train = [(feature_fn(row['text']), row['label']) for row in payload['train']]
        if kind == 'nb':
            model = NaiveBayesClassifier.train(train, estimator=lambda fd, bins=None: nltk.LidstoneProbDist(fd, .5, bins))
        elif kind == 'decision_tree':
            model = DecisionTreeClassifier.train(train, depth_cutoff=100, support_cutoff=10)
        else:
            cls = MaxentClassifier if kind == 'maxent' else ConditionalExponentialClassifier
            model = cls.train(train, algorithm='iis', trace=0, max_iter=12, labels=sorted({row['label'] for row in payload['train']}))
        return [model.classify(feature_fn(row['text'])) for row in payload['test']]
    if kind == 'lm':
        model = build_model(payload)
        return dict(scores=[model.score(probe['word'], tuple(probe['context'])) for probe in payload['probes']], perplexity=perplexity_from_scores(model, payload))
    if kind == 'punkt':
        return punkt.tokenize(payload['text'])
    if kind == 'sentiment':
        return [sentiment.polarity_scores(text) for text in payload['texts']]
    if kind == 'ner':
        return [nltk.chunk.tree2conlltags(ner.parse([tuple(pair) for pair in sentence])) for sentence in payload['sentences']]
    if kind == 'pcfg':
        grammar = nltk.PCFG.fromstring(payload['grammar'])
        parser = nltk.ViterbiParser(grammar)
        result=[]
        for tokens in payload['sentences']:
            trees=list(parser.parse(tokens))
            result.append(None if not trees else dict(tree=trees[0].pformat(margin=1000000),prob=trees[0].prob()))
        return result
    raise ValueError(kind)

run()
samples=[]
for _ in range(rounds):
    start=time.perf_counter()
    result=run()
    samples.append(time.perf_counter()-start)
print(json.dumps(dict(nltk=nltk.__version__,python=sys.version.split()[0],samples_seconds=samples,result=result)))
