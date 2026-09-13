#!/usr/bin/env python3
"""Reproduce differential fixtures with NLTK 3.10.3 and its standard data."""
import json, random
from pathlib import Path
import nltk
from nltk.corpus import brown, gutenberg
from nltk.sentiment.vader import SentimentIntensityAnalyzer
from nltk.tokenize import TreebankWordTokenizer, WordPunctTokenizer
from nltk.tokenize.punkt import PunktTokenizer, PunktTrainer, PunktSentenceTokenizer
assert nltk.__version__ == '3.10.3'
root=Path(__file__).resolve().parents[1]
v=SentimentIntensityAnalyzer()
texts=['', 'a', 'good', 'bad', 'not good', 'not bad', 'This is VERY good!!!', 'I never thought this was so good.', 'I never so loved this.', 'I am not very happy.', 'good but bad', 'bad but good', 'good good not good', 'This is the shit.', 'That is a bad ass movie.', 'This was kind of good.', 'At least it was good.', 'very least good', 'The book was good????', ':) :( :D <3', 'meh', 'I love café ☕', 'I LOVE this café!', '#happy #sad', 'It is GOOD but not GREAT.', 'okay but good good but bad', 'toString constructor __proto__']
# Every lexicon entry plus deterministic combinations exercise rules and rounding.
texts += list(v.lexicon)
rng=random.Random(1337)
for _ in range(1200): texts.append(' '.join(rng.choices(['not','never','so','this','but','very','really','kind','of','at','least','good','bad','LOVE','hate','okay',':)'],k=rng.randrange(2,14)))+'!'*rng.randrange(5))
sentences=['', '  ', ' Hello. World.  ', 'Dr. Smith works in the U.S. He arrived at 9 a.m. It was late.', '“Hello.” She smiled. «Why?» he asked.', 'Wait... what?! Really!!! Yes.', 'J. S. Bach met A. Jones. They left.', 'Café prices rose 3.5%. Él salió. বাংলা বাক্য। Next.', 'One.\n\nTwo.\nThree.', '(Done.) Next. [Okay!] Fine.', 'Cannot gonna wanna gimme gotta lemme more\'n d\'ye \'tis \'twas.', '"They\'ll say, \'HELLO\'." CAN\'T WON\'T I\'M.', 'He paid $3.88 in New York. Thanks.', 'Naïve façade résumé; 東京 বাংলা हिन्दी.', 'Foo.\u00a0Bar. Foo.\tBar.', 'co-operate -- really---yes... no....']
unicode_edges = ['good\u0085bad', 'good\u001cbad', 'good\ufeffbad', 'Good.\u0085Next.', 'Good.\ufeffNext.', '  Good.\u001c', '² Ⅲ ＿ café a\u200cb', '𝐀𝐁 is GOOD but ǅ is bad', 'É東京 met Ⅷ. They left.', 'He said “yes.”\u0085Next.', 'wanna\u0085go.']
texts += unicode_edges
sentences += unicode_edges
# Original corpus excerpts retain whitespace, quote and document boundaries.
for file in ['austen-emma.txt','carroll-alice.txt','melville-moby_dick.txt']:
    raw=gutenberg.raw(file)
    for offset in range(0,30000,1500): sentences.append(raw[offset:offset+1500])
for file in brown.fileids()[:20]: sentences.append(' '.join(brown.words(file)[:250]))
punkt=PunktTokenizer('english'); tb=TreebankWordTokenizer(); wp=WordPunctTokenizer()
training=[]
for text in sentences[-80:-60]:
    trainer=PunktTrainer(text); params=trainer.get_params()
    training.append({'text':text,'abbreviations':sorted(params.abbrev_types),'collocations':sorted(params.collocations),'sentenceStarters':sorted(params.sent_starters),'orthoContext':dict(params.ortho_context),'sentences':PunktSentenceTokenizer(params).tokenize(text)})
ners=[ [('Barack','NNP'),('Obama','NNP'),('met','VBD'),('Apple','NNP'),('executives','NNS'),('in','IN'),('California','NNP')], [('France','NNP')], [], [('toString','NNP'),('constructor','NN'),('__proto__','NNP')], [('東京','NNP'),('visited','VBD'),('São','NNP'),('Paulo','NNP'),('.','.')]]
ners += [nltk.pos_tag(list(sent)) for sent in brown.sents()[:150]]
from nltk.chunk import tree2conlltags
from nltk.chunk.named_entity import Maxent_NE_Chunker
multiclass = Maxent_NE_Chunker("multiclass")
binary = Maxent_NE_Chunker("binary")
out={'nltk':nltk.__version__,'sentiment':[{'text':t,'scores':v.polarity_scores(t)} for t in texts], 'tokenizers':[{'text':t,'punkt':punkt.tokenize(t),'treebank':tb.tokenize(t),'wordpunct':wp.tokenize(t)} for t in sentences], 'training':training,'ner':[{'tokens':s,'multiclass':tree2conlltags(multiclass.parse(s)),'binary':tree2conlltags(binary.parse(s))} for s in ners]}
(root/'test/fixtures/nltk-model-parity.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':'))+'\n')
print({k:len(v) for k,v in out.items() if isinstance(v,list)})
