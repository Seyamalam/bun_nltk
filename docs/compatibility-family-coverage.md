# Selected-family compatibility findings

These are code-reviewed routes at `405347e`, not pass/fail coverage certificates.
The authoritative names/signatures/evidence are in `compatibility/inventory.json`
and `compatibility/discovery.json`. Every unreviewed name resolves to an inventory
gap. Counts emitted by the checker are module-qualified and include reexports.

## Tokenize

Reviewed Treebank, WordPunct, MWE, Tweet, Toktok and top-level word/sentence
helpers run TS algorithms. Treebank lacks parenthesis/string-return and span
options. WordPunct's Unicode regex differs from Python `re` word categories.
MWE trims tokens, ignores single-token expressions and lacks removal. Tweet and
Toktok use simplified regexes; their example tests do not establish full NLTK
casual/Toktok behavior. Top-level wrapper tests compare project implementations
to themselves. `word_tokenize` uses Treebank instead of NLTKWordTokenizer and
only supports English. NLTKWordTokenizer, detokenizers, simple/regexp tokenizers,
Punkt parameter/language/token APIs, utilities and many members remain gaps.
Punkt training and sentence logic have real TS code but incomplete signatures.
Stanford/REPP tokenizer exports are throwing facades, not integrations.

## Stem

Porter facade calls real Rust native Porter code, but only supports the
NLTK_EXTENSIONS mode, omits `to_lowercase` and has an ASCII input contract.
Two wrapper examples do not constitute a version-pinned stem corpus.
Lancaster is explicitly a compact inspired suffix subset, not the full iterative
NLTK rule engine. RegexpStemmer uses JS flags/replacement semantics and a
different minimum-length boundary. Snowball has real TS language implementations
but no `ignore_stopwords` facade option. Individual language classes and full
language corpora remain unreviewed. WordNetLemmatizer normalizes input and uses
project morphy dispatch, not the complete shortest-lemma NLTK/data contract.

## Probability and language models

FreqDist, MLE and Lidstone generic counts/probabilities are TS algorithms, not
Rust merely because ASCII convenience methods can accelerate counting. Python
Counter equality, indexing/operators, zero-count behavior and printing/plotting
are not fully mapped. Other exported distributions have real TS code but still
need individual signature, error and differential fixture review; source presence
does not satisfy their inventory gaps. WittenBell `discount()` explicitly throws.

NgramLanguageModel is a different constructor/count/vocabulary API from NLTK MLE.
Its count construction/scoring is TS with optional native batch evaluation for
selected model types at order <=3. It is not classified wholesale Rust. NLTK
Vocabulary, NgramCounter, model/smoothing classes and most method contracts remain
unreviewed. Existing LM example tests do not close these signature gaps.

## Classify

Default feature NaiveBayes, PositiveNaiveBayes, DecisionTree and IIS/GIS MaxEnt
training use Rust WASM cores through typed marshaling. Existing pinned differential
tests cover the Rust feature APIs, not every legacy/root wrapper constructor or
method. Primitive categorical features and numeric smoothing are supported; custom
Python estimators/arbitrary hashable features are not. Positive NB labels adapt
booleans to project strings. DecisionTree candidate iteration is patched in the
oracle to first-seen order; unmodified Python hash-order tie parity is not claimed.
MaxEnt near-tie prediction assertions are intentionally omitted, and legacy SGD
options retain a distinct TS text path. Custom encodings, stump helpers, printing
and many constructors/members remain gaps. SklearnClassifier discards its
constructor estimator and throws on operations: `gap/unsupported`, not an
external integration. Other classifier external wrappers are similarly not
validated implementations.

## Metrics and translation scores

Edit distance/alignment run Rust WASM DP with pinned Unicode/cost/transposition
fixtures over 762 combinations, bounded to 2,000 code points. JS string/options
contracts are adaptations; non-string sequences and unbounded NLTK inputs remain
excluded. Jaccard/precision/windowdiff run TS; generic JS equality, segmentation
domains and signature details need pinned fixtures. Adjacent distance/score
functions, Jaro/Jaro-Winkler, `ghd`, `accuracy` and approximation helpers remain
unreviewed inventory gaps.

Root sentenceBleu/corpusBleu use TS add-one smoothing and fixed four weights;
they are **not NLTK's default unsmoothed BLEU**. Separate Rust/WASM score methods
do not replace those exports. SmoothingFunction/helper members remain gaps.
ChrF/NIST root scoring runs TS with example tests; all option/default/Unicode and
reference-selection contracts require a pinned fixture review. IBM/alignment,
METEOR/RIBES/LEPOR and decoder modules are explicitly outside the selected score
inventory and must be audited independently.

## Grammar, parsing, chunk and trees

CFG and ChartParser are TS project grammar/tree adapters, not complete NLTK
grammar/chart/edge/rule objects. CFG.fromstring and ChartParser.parse are reviewed
signature adaptations; most constructors/options, production access, chart_parse,
strategies/traces and inherited methods remain gaps. Native CYK recognition is a
different primitive and cannot establish the chart parse tree contract.
Functional regexpChunkParse is a real TS grammar subset, not RegexpParser's
rule/stage/trace API. NLTK Tree and its full member/dunder/probabilistic behavior
remain unreviewed; existing project parse-tree objects do not establish Tree parity.
Other parser families and their throwing external facades require separate audits.

## Tag and text

UnigramTagger has real TS context/backoff training. Other sequential classes,
training/model dictionary domains and inherited methods still need review.
PerceptronTagger dispatches to Rust native batch prediction but extracts features
and joins/re-tokenizes input in TS. A TS scoring fallback also exists; supplied
token boundaries and model features are not NLTK's full trained tagger contract.
Official English model comparison is blocked by missing data. Brill/HMM/TnT/CRF
and external taggers are explicitly outside this round's selected module audit.

ConcordanceIndex has real TS indexing, but printing/custom keys/line object and
Unicode formatting contracts remain incomplete. Text/ContextIndex, association
measure classes and most collocation filters/factories need individual audit;
reviewed BigramCollocationFinder runs TS generic counts/scoring. Rust ASCII
statistics are distinct optimized primitives, not the entire object API.

## WordNet, WSD and sentiment data

WordNet is a TS/native hybrid over project payloads and record objects, not
WordNetCorpusReader/Synset/Lemma signatures. Native packed dispatch does not turn
mini/extended bundled data into official complete WordNet coverage. Project Python
payload baseline tests are not NLTK oracle evidence. Lesk uses TS definition
overlap over project records and needs official sense-selection fixtures.
VADER has TS rules and bundled lexicon examples, but resource-loading/member and
full official lexicon behavior remain unreviewed.

At the final check, English `punkt_tab` data was available (it became available in
the shared host during work); **WordNet, averaged_perceptron_tagger_eng and VADER
lexicon were missing**. Availability is reported live, not pinned as fixture
coverage. Do not download silently or treat missing data as a passing test.

## Explicitly unreviewed families and platforms

Semantic/DRT/glue, inference, CCG, clustering, TBL, other corpus readers, standalone
language stemmers, remaining translation/tag/parse families, misc, GUI/chat/draw,
Twitter/network integration and helper/root modules have exclusions in the
manifest. Exported namespaces, aliases and throwing shims do not close those
exclusions. Type-only declarations, Python dunder protocols, nested namespace
members and Node/browser built-artifact entrypoints need separate inventories.
No external-integration implementation has been established by this review.
