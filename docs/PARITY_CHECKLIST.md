# NLTK API Parity Checklist

> Auto-generated from the [NLTK API index](https://www.nltk.org/api/nltk.html) (241 public modules) diffed against `src/`.
> Last regenerated: 2026-08-23

**Coverage: 114/241 modules (47.3%)** — 20 of 46 families touched.

- [~] `parse` (14/20)
  - [x] `parse.api`
  - [ ] `parse.bllip`
  - [x] `parse.chart`
  - [ ] `parse.corenlp`
  - [x] `parse.dependencygraph`
  - [x] `parse.earleychart`
  - [x] `parse.evaluate`
  - [x] `parse.featurechart`
  - [x] `parse.generate`
  - [ ] `parse.malt`
  - [x] `parse.nonprojectivedependencyparser`
  - [x] `parse.pchart`
  - [x] `parse.projectivedependencyparser`
  - [x] `parse.recursivedescent`
  - [ ] `parse.shiftreduce`
  - [ ] `parse.stanford`
  - [ ] `parse.transitionparser`
  - [x] `parse.util`
  - [x] `parse.viterbi`

- [~] `tokenize` (14/19)
  - [x] `tokenize.api`
  - [x] `tokenize.casual`
  - [x] `tokenize.destructive`
  - [x] `tokenize.legality_principle`
  - [x] `tokenize.mwe`
  - [x] `tokenize.nist`
  - [x] `tokenize.punkt`
  - [x] `tokenize.regexp`
  - [ ] `tokenize.repp`
  - [x] `tokenize.sexpr`
  - [x] `tokenize.simple`
  - [ ] `tokenize.sonority_sequencing`
  - [ ] `tokenize.stanford`
  - [ ] `tokenize.stanford_segmenter`
  - [ ] `tokenize.texttiling`
  - [x] `tokenize.toktok`
  - [x] `tokenize.treebank`
  - [x] `tokenize.util`

- [~] `translate` (13/20)
  - [x] `translate.api`
  - [x] `translate.bleu_score`
  - [x] `translate.chrf_score`
  - [ ] `translate.gale_church`
  - [x] `translate.gdfa`
  - [x] `translate.gleu_score`
  - [x] `translate.ibm1`
  - [x] `translate.ibm2`
  - [x] `translate.ibm3`
  - [x] `translate.ibm4`
  - [x] `translate.ibm5`
  - [x] `translate.ibm_model`
  - [ ] `translate.lepor`
  - [ ] `translate.meteor_score`
  - [x] `translate.metrics`
  - [x] `translate.nist_score`
  - [ ] `translate.phrase_based`
  - [ ] `translate.ribes_score`
  - [ ] `translate.stack_decoder`

- [~] `stem` (9/13)
  - [x] `stem.api`
  - [ ] `stem.arlstem`
  - [ ] `stem.arlstem2`
  - [x] `stem.cistem`
  - [ ] `stem.isri`
  - [x] `stem.lancaster`
  - [x] `stem.porter`
  - [x] `stem.regexp`
  - [x] `stem.rslp`
  - [x] `stem.snowball`
  - [x] `stem.util`
  - [x] `stem.wordnet`

- [~] `metrics` (8/10)
  - [x] `metrics.agreement`
  - [ ] `metrics.aline`
  - [x] `metrics.association`
  - [x] `metrics.confusionmatrix`
  - [x] `metrics.distance`
  - [ ] `metrics.paice`
  - [x] `metrics.scores`
  - [x] `metrics.segmentation`
  - [x] `metrics.spearman`

- [~] `tag` (8/14)
  - [x] `tag.api`
  - [x] `tag.brill`
  - [x] `tag.brill_trainer`
  - [ ] `tag.crf`
  - [x] `tag.hmm`
  - [ ] `tag.hunpos`
  - [x] `tag.mapping`
  - [x] `tag.perceptron`
  - [ ] `tag.senna`
  - [x] `tag.sequential`
  - [ ] `tag.stanford`
  - [ ] `tag.tnt`
  - [x] `tag.util`

- [~] `classify` (7/15)
  - [x] `classify.api`
  - [x] `classify.decisiontree`
  - [x] `classify.maxent`
  - [ ] `classify.megam`
  - [x] `classify.naivebayes`
  - [x] `classify.positivenaivebayes`
  - [ ] `classify.rte_classify`
  - [ ] `classify.scikitlearn`
  - [ ] `classify.senna`
  - [ ] `classify.svm`
  - [ ] `classify.tadm`
  - [x] `classify.textcat`
  - [x] `classify.util`
  - [ ] `classify.weka`

- [~] `lm` (7/8)
  - [x] `lm.api`
  - [x] `lm.counter`
  - [x] `lm.models`
  - [x] `lm.preprocessing`
  - [x] `lm.smoothing`
  - [x] `lm.util`
  - [x] `lm.vocabulary`

- [~] `tree` (7/8)
  - [x] `tree.immutable`
  - [x] `tree.parented`
  - [x] `tree.parsing`
  - [ ] `tree.prettyprinter`
  - [x] `tree.probabilistic`
  - [x] `tree.transforms`
  - [x] `tree.tree`

- [~] `tbl` (6/7)
  - [x] `tbl.api`
  - [x] `tbl.demo`
  - [x] `tbl.erroranalysis`
  - [x] `tbl.feature`
  - [x] `tbl.rule`
  - [x] `tbl.template`

- [x] `chunk` (5/5)
  - [x] `chunk.api`
  - [x] `chunk.named_entity`
  - [x] `chunk.regexp`
  - [x] `chunk.util`

- [~] `sem` (5/15)
  - [ ] `sem.boxer`
  - [ ] `sem.chat80`
  - [ ] `sem.cooper_storage`
  - [x] `sem.drt`
  - [ ] `sem.drt_glue_demo`
  - [x] `sem.evaluate`
  - [ ] `sem.glue`
  - [ ] `sem.hole`
  - [ ] `sem.lfg`
  - [ ] `sem.linearlogic`
  - [x] `sem.logic`
  - [ ] `sem.relextract`
  - [x] `sem.skolemize`
  - [x] `sem.util`

- [~] `corpus` (3/4)
  - [ ] `corpus.europarl_raw`
  - [x] `corpus.reader`
  - [x] `corpus.util`

- [~] `sentiment` (2/4)
  - [ ] `sentiment.sentiment_analyzer`
  - [x] `sentiment.util`
  - [x] `sentiment.vader`

- [x] `collocations` (1/1)

- [x] `grammar` (1/1)

- [x] `probability` (1/1)

- [x] `text` (1/1)

- [x] `treetransforms` (1/1)

- [x] `wsd` (1/1)

- [ ] `app` (0/10)
  - [ ] `app.chartparser_app` — *out of scope*
  - [ ] `app.chunkparser_app` — *out of scope*
  - [ ] `app.collocations_app` — *out of scope*
  - [ ] `app.concordance_app` — *out of scope*
  - [ ] `app.nemo_app` — *out of scope*
  - [ ] `app.rdparser_app` — *out of scope*
  - [ ] `app.srparser_app` — *out of scope*
  - [ ] `app.wordfreq_app` — *out of scope*
  - [ ] `app.wordnet_app` — *out of scope*

- [ ] `book` (0/1)

- [ ] `ccg` (0/6)
  - [ ] `ccg.api`
  - [ ] `ccg.chart`
  - [ ] `ccg.combinator`
  - [ ] `ccg.lexicon`
  - [ ] `ccg.logic`

- [ ] `chat` (0/7)
  - [ ] `chat.eliza` — *out of scope*
  - [ ] `chat.iesha` — *out of scope*
  - [ ] `chat.rude` — *out of scope*
  - [ ] `chat.suntsu` — *out of scope*
  - [ ] `chat.util` — *out of scope*
  - [ ] `chat.zen` — *out of scope*

- [ ] `cli` (0/1)

- [ ] `cluster` (0/6)
  - [ ] `cluster.api`
  - [ ] `cluster.em`
  - [ ] `cluster.gaac`
  - [ ] `cluster.kmeans`
  - [ ] `cluster.util`

- [ ] `collections` (0/1)

- [ ] `compat` (0/1)

- [ ] `data` (0/1)

- [ ] `decorators` (0/1)

- [ ] `downloader` (0/1)

- [ ] `draw` (0/6)
  - [ ] `draw.cfg` — *out of scope*
  - [ ] `draw.dispersion` — *out of scope*
  - [ ] `draw.table` — *out of scope*
  - [ ] `draw.tree` — *out of scope*
  - [ ] `draw.util` — *out of scope*

- [ ] `featstruct` (0/1)

- [ ] `help` (0/1)

- [ ] `inference` (0/8)
  - [ ] `inference.api`
  - [ ] `inference.discourse`
  - [ ] `inference.mace`
  - [ ] `inference.nonmonotonic`
  - [ ] `inference.prover9`
  - [ ] `inference.resolution`
  - [ ] `inference.tableau`

- [ ] `internals` (0/1)

- [ ] `jsontags` (0/1)

- [ ] `langnames` (0/1)

- [ ] `lazyimport` (0/1)

- [ ] `misc` (0/6)
  - [ ] `misc.babelfish`
  - [ ] `misc.chomsky`
  - [ ] `misc.minimalset`
  - [ ] `misc.sort`
  - [ ] `misc.wordfinder`

- [ ] `tabdata` (0/1)

- [ ] `tgrep` (0/1)

- [ ] `toolbox` (0/1)

- [ ] `treeprettyprinter` (0/1)

- [ ] `twitter` (0/6)
  - [ ] `twitter.api`
  - [ ] `twitter.common`
  - [ ] `twitter.twitter_demo`
  - [ ] `twitter.twitterclient`
  - [ ] `twitter.util`

- [ ] `util` (0/1)

_Regenerate with `python3 scripts/parity-checklist.py`._
