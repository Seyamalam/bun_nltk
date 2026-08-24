# NLTK API Parity Checklist

> Auto-generated from the [NLTK API index](https://www.nltk.org/api/nltk.html) (241 public modules) diffed against `src/`.
> Last regenerated: 2026-08-24

**Coverage: 241/241 modules (100.0%)** — 46 of 46 families touched.

- [x] `parse` (20/20)
  - [x] `parse.api`
  - [x] `parse.bllip`
  - [x] `parse.chart`
  - [x] `parse.corenlp`
  - [x] `parse.dependencygraph`
  - [x] `parse.earleychart`
  - [x] `parse.evaluate`
  - [x] `parse.featurechart`
  - [x] `parse.generate`
  - [x] `parse.malt`
  - [x] `parse.nonprojectivedependencyparser`
  - [x] `parse.pchart`
  - [x] `parse.projectivedependencyparser`
  - [x] `parse.recursivedescent`
  - [x] `parse.shiftreduce`
  - [x] `parse.stanford`
  - [x] `parse.transitionparser`
  - [x] `parse.util`
  - [x] `parse.viterbi`

- [x] `translate` (20/20)
  - [x] `translate.api`
  - [x] `translate.bleu_score`
  - [x] `translate.chrf_score`
  - [x] `translate.gale_church`
  - [x] `translate.gdfa`
  - [x] `translate.gleu_score`
  - [x] `translate.ibm1`
  - [x] `translate.ibm2`
  - [x] `translate.ibm3`
  - [x] `translate.ibm4`
  - [x] `translate.ibm5`
  - [x] `translate.ibm_model`
  - [x] `translate.lepor`
  - [x] `translate.meteor_score`
  - [x] `translate.metrics`
  - [x] `translate.nist_score`
  - [x] `translate.phrase_based`
  - [x] `translate.ribes_score`
  - [x] `translate.stack_decoder`

- [x] `tokenize` (19/19)
  - [x] `tokenize.api`
  - [x] `tokenize.casual`
  - [x] `tokenize.destructive`
  - [x] `tokenize.legality_principle`
  - [x] `tokenize.mwe`
  - [x] `tokenize.nist`
  - [x] `tokenize.punkt`
  - [x] `tokenize.regexp`
  - [x] `tokenize.repp`
  - [x] `tokenize.sexpr`
  - [x] `tokenize.simple`
  - [x] `tokenize.sonority_sequencing`
  - [x] `tokenize.stanford`
  - [x] `tokenize.stanford_segmenter`
  - [x] `tokenize.texttiling`
  - [x] `tokenize.toktok`
  - [x] `tokenize.treebank`
  - [x] `tokenize.util`

- [x] `classify` (15/15)
  - [x] `classify.api`
  - [x] `classify.decisiontree`
  - [x] `classify.maxent`
  - [x] `classify.megam`
  - [x] `classify.naivebayes`
  - [x] `classify.positivenaivebayes`
  - [x] `classify.rte_classify`
  - [x] `classify.scikitlearn`
  - [x] `classify.senna`
  - [x] `classify.svm`
  - [x] `classify.tadm`
  - [x] `classify.textcat`
  - [x] `classify.util`
  - [x] `classify.weka`

- [x] `sem` (15/15)
  - [x] `sem.boxer`
  - [x] `sem.chat80`
  - [x] `sem.cooper_storage`
  - [x] `sem.drt`
  - [x] `sem.drt_glue_demo`
  - [x] `sem.evaluate`
  - [x] `sem.glue`
  - [x] `sem.hole`
  - [x] `sem.lfg`
  - [x] `sem.linearlogic`
  - [x] `sem.logic`
  - [x] `sem.relextract`
  - [x] `sem.skolemize`
  - [x] `sem.util`

- [x] `tag` (14/14)
  - [x] `tag.api`
  - [x] `tag.brill`
  - [x] `tag.brill_trainer`
  - [x] `tag.crf`
  - [x] `tag.hmm`
  - [x] `tag.hunpos`
  - [x] `tag.mapping`
  - [x] `tag.perceptron`
  - [x] `tag.senna`
  - [x] `tag.sequential`
  - [x] `tag.stanford`
  - [x] `tag.tnt`
  - [x] `tag.util`

- [x] `stem` (13/13)
  - [x] `stem.api`
  - [x] `stem.arlstem`
  - [x] `stem.arlstem2`
  - [x] `stem.cistem`
  - [x] `stem.isri`
  - [x] `stem.lancaster`
  - [x] `stem.porter`
  - [x] `stem.regexp`
  - [x] `stem.rslp`
  - [x] `stem.snowball`
  - [x] `stem.util`
  - [x] `stem.wordnet`

- [x] `app` (10/10)
  - [x] `app.chartparser_app`
  - [x] `app.chunkparser_app`
  - [x] `app.collocations_app`
  - [x] `app.concordance_app`
  - [x] `app.nemo_app`
  - [x] `app.rdparser_app`
  - [x] `app.srparser_app`
  - [x] `app.wordfreq_app`
  - [x] `app.wordnet_app`

- [x] `metrics` (10/10)
  - [x] `metrics.agreement`
  - [x] `metrics.aline`
  - [x] `metrics.association`
  - [x] `metrics.confusionmatrix`
  - [x] `metrics.distance`
  - [x] `metrics.paice`
  - [x] `metrics.scores`
  - [x] `metrics.segmentation`
  - [x] `metrics.spearman`

- [x] `inference` (8/8)
  - [x] `inference.api`
  - [x] `inference.discourse`
  - [x] `inference.mace`
  - [x] `inference.nonmonotonic`
  - [x] `inference.prover9`
  - [x] `inference.resolution`
  - [x] `inference.tableau`

- [x] `lm` (8/8)
  - [x] `lm.api`
  - [x] `lm.counter`
  - [x] `lm.models`
  - [x] `lm.preprocessing`
  - [x] `lm.smoothing`
  - [x] `lm.util`
  - [x] `lm.vocabulary`

- [x] `tree` (8/8)
  - [x] `tree.immutable`
  - [x] `tree.parented`
  - [x] `tree.parsing`
  - [x] `tree.prettyprinter`
  - [x] `tree.probabilistic`
  - [x] `tree.transforms`
  - [x] `tree.tree`

- [x] `chat` (7/7)
  - [x] `chat.eliza`
  - [x] `chat.iesha`
  - [x] `chat.rude`
  - [x] `chat.suntsu`
  - [x] `chat.util`
  - [x] `chat.zen`

- [x] `tbl` (7/7)
  - [x] `tbl.api`
  - [x] `tbl.demo`
  - [x] `tbl.erroranalysis`
  - [x] `tbl.feature`
  - [x] `tbl.rule`
  - [x] `tbl.template`

- [x] `ccg` (6/6)
  - [x] `ccg.api`
  - [x] `ccg.chart`
  - [x] `ccg.combinator`
  - [x] `ccg.lexicon`
  - [x] `ccg.logic`

- [x] `cluster` (6/6)
  - [x] `cluster.api`
  - [x] `cluster.em`
  - [x] `cluster.gaac`
  - [x] `cluster.kmeans`
  - [x] `cluster.util`

- [x] `draw` (6/6)
  - [x] `draw.cfg`
  - [x] `draw.dispersion`
  - [x] `draw.table`
  - [x] `draw.tree`
  - [x] `draw.util`

- [x] `misc` (6/6)
  - [x] `misc.babelfish`
  - [x] `misc.chomsky`
  - [x] `misc.minimalset`
  - [x] `misc.sort`
  - [x] `misc.wordfinder`

- [x] `twitter` (6/6)
  - [x] `twitter.api`
  - [x] `twitter.common`
  - [x] `twitter.twitter_demo`
  - [x] `twitter.twitterclient`
  - [x] `twitter.util`

- [x] `chunk` (5/5)
  - [x] `chunk.api`
  - [x] `chunk.named_entity`
  - [x] `chunk.regexp`
  - [x] `chunk.util`

- [x] `corpus` (4/4)
  - [x] `corpus.europarl_raw`
  - [x] `corpus.reader`
  - [x] `corpus.util`

- [x] `sentiment` (4/4)
  - [x] `sentiment.sentiment_analyzer`
  - [x] `sentiment.util`
  - [x] `sentiment.vader`

- [x] `book` (1/1)

- [x] `cli` (1/1)

- [x] `collections` (1/1)

- [x] `collocations` (1/1)

- [x] `compat` (1/1)

- [x] `data` (1/1)

- [x] `decorators` (1/1)

- [x] `downloader` (1/1)

- [x] `featstruct` (1/1)

- [x] `grammar` (1/1)

- [x] `help` (1/1)

- [x] `internals` (1/1)

- [x] `jsontags` (1/1)

- [x] `langnames` (1/1)

- [x] `lazyimport` (1/1)

- [x] `probability` (1/1)

- [x] `tabdata` (1/1)

- [x] `text` (1/1)

- [x] `tgrep` (1/1)

- [x] `toolbox` (1/1)

- [x] `treeprettyprinter` (1/1)

- [x] `treetransforms` (1/1)

- [x] `util` (1/1)

- [x] `wsd` (1/1)

_Regenerate with `python3 scripts/parity-checklist.py`._
