# bun_nltk

Fast NLP primitives in Rust with Bun bindings.

![module surfaces 241/241](https://img.shields.io/badge/module_surfaces-241%2F241-blue)
![version 1.0.0](https://img.shields.io/badge/version-1.0.0-blue)

## NLTK module coverage

**241 of 241 public `nltk.*` module names have TypeScript surfaces — 46/46 families** — see the auto-generated
[docs/PARITY_CHECKLIST.md](docs/PARITY_CHECKLIST.md), which diffs the
[NLTK API index](https://www.nltk.org/api/nltk.html) against this repo.
Regenerate after adding modules: `bun run parity:checklist`. This counts importable
surfaces, including partial implementations and shims; it is not a behavioral
parity percentage.

`bun run fidelity:gate` writes `artifacts/fidelity-report.json`, including failed
runs. It reports **passed, failed, skipped, and unsupported** separately. Missing
required fixtures fail the gate. Prediction checks require exact label agreement;
numerical checks state their tolerances. Benchmark speed does not affect correctness
or implementation status. GUI and external-service shims are explicitly unsupported.

The full NLTK 3.10.3 VADER lexicon, trained English Punkt parameters, and binary /
multiclass named-entity models are bundled. `bun run bench:parity:nltk-models` checks
all four VADER fields, Treebank/WordPunct tokens, Punkt boundaries and training
parameters, and NE IOB labels against versioned Python outputs. Passing these cases
does not establish equivalence on every possible input. Other algorithms may still
fail the strict global gate even when their older quality-floor checks passed.
See [behavioral validation](docs/BEHAVIORAL_PARITY.md) and
[model provenance](THIRD_PARTY_NOTICES.md).

| Family | Modules | Status | Notes |
|---|---:|---|---|
| `parse` | 20/20 | ✅ real port | cfg/chart/earley/feature/pcfg + wrappers for bllip/corenlp/malt/stanford |
| `translate` | 20/20 | ✅ real port | bleu/chrf/gleu/ribes/meteor + IBM1–5, phrase/stack/GDFA/Gale-Church |
| `tokenize` | 19/19 | ✅ real port | punkt/treebank/toktok/mwe/casual/nist/sexpr + Stanford/REPP shims |
| `classify` | 15/15 | ✅ real port | NB/MaxEnt/DT/Perceptron + megam/tadm/weka/sklearn/senna shims |
| `sem` | 15/15 | ✅ real port | logic/DRT/skolemize/Glue/Hole/Cooper/Boxer/LFG/Chat80 |
| `tag` | 14/14 | ✅ real port | perceptron/brill/hmm/tnt/crf + Stanford/HunPos/Senna shims |
| `stem` | 13/13 | ✅ real port | porter/snowball/lancaster/regexp/rslp/cistem/arlstem/isri/wordnet |
| `app` | 10/10 | ⚠️ shim | GUI (Tkinter) — throws with programmatic alternative hint |
| `metrics` | 10/10 | ✅ real port | distance/confusionmatrix/agreement/paice/aline/spearman/segmentation |
| `inference` | 8/8 | ✅ real port | resolution/tableau/prover9/mace/discourse + API/demonstration |
| `lm` | 8/8 | ✅ real port | MLE/Lidstone/Kneser-Ney + counter/vocab/preprocessing |
| `tree` | 8/8 | ✅ real port | Tree/Immutable/Parented/Probabilistic + transforms/prettyprinter |
| `chat` | 7/7 | ⚠️ shim | eliza/iesha/rude/suntsu/zen — re-exports `Chat` from `chat_util` (real) |
| `tbl` | 7/7 | ✅ real port | Brill TBL — rule/template/feature/demo/erroranalysis |
| `ccg` | 6/6 | ✅ real port | cat/lexicon/combinator/chart/logic + CCGChartParser |
| `cluster` | 6/6 | ✅ real port | kmeans/EM/GAAC + api/util |
| `draw` | 6/6 | ⚠️ shim | cfg/dispersion/table/tree — throws (requires Tk/matplotlib) |
| `misc` | 6/6 | ✅ real port | chomsky/babelfish/minimalset/sort/wordfinder |
| `twitter` | 6/6 | ⚠️ shim | twitterclient/util/demo — throws (requires network/API keys) |
| `chunk` | 5/5 | ✅ real port | regexp/named_entity + api/util |
| *roots & shims* | — | ⚠️ shim | `collections`/`compat`/`data`/`decorators`/`internals`/`jsontags`/`lazyimport`/`tabdata`/`langnames`/`cli`/`corpus.europarl_raw` — thin re-exports/compat helpers |

> **Shim vs real port:** “real port” = TypeScript implementation, with the tested behavioral scope varying by module; “shim” = API surface present (importable, parity checklist passes) but runtime throws a descriptive error directing to the programmatic alternative or explains the missing native dependency (Tkinter, network, Java subprocess, etc.). A present module is not necessarily behaviorally complete.

Quick start examples:

```bash
bun run examples/ccg_quickstart.ts      # CCG chart: I sleep → S
bun run examples/inference_resolution.ts # FOL resolution: Socrates is mortal
```

Standalone example projects:

- [`examples/js-library`](examples/js-library) is a tested Bun document-analysis API and CLI with validation, batch processing, sentence-level sentiment, keyword frequency, and configurable n-grams.
- [`examples/wasm-browser`](examples/wasm-browser) is a local-first browser workbench with file import, JavaScript/WASM parity and benchmarking, token search, ranked terms, sentence inspection, and JSON export.

Try the [live browser playground](https://bun-nltk-playground.seyamalam41.workers.dev), or see [`examples/README.md`](examples/README.md) for clone-and-run commands.

## Package docs

- API reference: [docs/API.md](docs/API.md)
- Versioning policy: [docs/VERSIONING.md](docs/VERSIONING.md)
- Publishing guide: [docs/PUBLISHING.md](docs/PUBLISHING.md)
- Linux and Windows native-host validation: [docs/NATIVE_HOST_VALIDATION.md](docs/NATIVE_HOST_VALIDATION.md)
- Changelog: [CHANGELOG.md](CHANGELOG.md)

## Validate on a real Linux or Windows host

The release binaries are committed, so testers do not need a compiler toolchain.

```bash
# Linux x64
bash scripts/verify-linux.sh
```

```powershell
# Windows x64
.\scripts\verify-windows.cmd
```

Each command installs the locked JavaScript dependencies, tests the native library on that operating system, compares native Rust with the TypeScript fallback on the same machine, and writes a JSON report under `artifacts/`. See [the native-host guide](docs/NATIVE_HOST_VALIDATION.md) for Bun installation commands and the 15-round paper run.


## Implemented in this milestone

- ASCII token counting
- ASCII unique-token counting (`FreqDist`-style cardinality)
- ASCII n-gram counting
- ASCII unique n-gram counting
- Hashed frequency distributions for tokens and n-grams
- Native token materialization and n-gram materialization APIs
- Top-K bigram PMI collocation scoring (native, with `window_size >= 2`)
- NLTK-style bigram collocation compatibility layer (`BigramAssocMeasures`, `BigramCollocationFinder`)
- Higher-order collocation compatibility (`TrigramAssocMeasures`, `QuadgramAssocMeasures`, `TrigramCollocationFinder`, `QuadgramCollocationFinder`)
- Text exploration compatibility layer (`ConcordanceIndex`, `ContextIndex`, `Text`)
- Core `nltk.probability` compatibility layer (`ProbDistI`, `MLEProbDist`, `Lidstone` family, `ConditionalProbDist`)
- Advanced smoothing distributions (`WittenBellProbDist`, `SimpleGoodTuringProbDist`)
- NLTK-style feature-dict classifier wrappers (`NaiveBayesClassifier`, `DecisionTreeClassifier`, `MaxentClassifier`, `PositiveNaiveBayesClassifier`)
- NLTK-style parser/tagger wrappers (`CFG`, `PCFG`, `ChartParser`, `EarleyChartParser`, `ViterbiParser`, `PerceptronTagger`, `pos_tag`)
- Collision-free token ID frequency distribution API (`id <-> token`)
- Native windowed bigram stats API (`left_id`, `right_id`, `count`, `pmi`)
- Native Porter stemmer (ASCII, lowercasing)
- Tokenizer parity layer (`wordTokenizeSubset`, `tweetTokenizeSubset`)
- Expanded tokenizer family (`TreebankWordTokenizer`, `WordPunctTokenizer`, `ToktokTokenizer`, `MWETokenizer`, `TweetTokenizer`)
- Sentence tokenizer parity subset (`sentenceTokenizeSubset`) + Python parity harness
- Trainable Punkt tokenizer/model APIs (`trainPunktModel`, `sentenceTokenizePunkt`)
- NLTK-style Punkt wrapper APIs (`PunktTrainer`, `PunktSentenceTokenizer`, plus subset wrappers)
- Native Punkt sentence-splitting fast path (`sentenceTokenizePunktAsciiNative`) with WASM equivalent
- Native normalization pipeline (ASCII fast path with optional stopword filtering)
- Unicode normalization fallback pipeline (`normalizeTokensUnicode`)
- Native POS regex/heuristic tagger baseline (`posTagAsciiNative`)
- Native streaming `FreqDist`/`ConditionalFreqDist` builder with JSON export (`NativeFreqDistStream`)
- NLTK-style `FreqDist` / `ConditionalFreqDist` compatibility classes with native-backed ASCII builders
- NLTK-style probability distribution layer (`MLEProbDist`, `Lidstone`, `Laplace`, `ELE`, `ConditionalProbDist`)
- Mini WordNet reader with synset lookup, relation traversal, and morphy-style inflection recovery
- WordNet compatibility helpers (`lemmaNames`, `synsetFromPosAndOffset`, `senseKeys`, `synsetFromSenseKey`)
- WordNet graph helpers (`hypernymPaths`, `lowestCommonHypernyms`, `shortestPathDistance`, `pathSimilarity`)
- Native morphy accelerator (`wordnetMorphyAsciiNative`) with WASM equivalent
- Packed WordNet corpus pipeline (`wordnet:pack`) with binary loader (`loadWordNetPacked`)
- Stateful native WordNet loader with batched lookup and lazy JavaScript row materialization
- Default WordNet runtime loader (`loadWordNet`) that uses an explicit packed corpus when present
- N-gram language model stack (`MLE`, `Lidstone`, `Kneser-Ney Interpolated`) with Python comparison harness
- Native/WASM LM ID-evaluation hot loop for batched score + perplexity paths
- Regexp chunk parser primitives with IOB conversion and Python parity harness
- Native/WASM chunk IOB hot loop for compiled grammar matching
- CFG grammar parser + chart parser subset with Python parity harness
- Earley recognizer/parser API for non-CNF grammar recognition (`earleyRecognize`, `earleyParse`, `parseTextWithEarley`)
- Recursive-descent CFG parser API (`recursiveDescentParse`, `parseTextWithRecursiveDescent`)
- Left-corner CFG parser API (`leftCornerParse`, `parseTextWithLeftCorner`)
- Feature-chart parser subset APIs (`parseFeatureCfgGrammar`, `featureChartParse`, `parseTextWithFeatureCfg`)
- Lightweight dependency parser API (`dependencyParse`, `dependencyParseText`)
- Naive Bayes text classifier with train/predict/evaluate/serialize APIs and Python parity harness
- Shared sparse text vectorizer (`TextFeatureVectorizer`) + sparse batch flattening utility
- Decision tree text classifier APIs (`DecisionTreeTextClassifier`)
- Linear text models (`LogisticTextClassifier`, `LinearSvmTextClassifier`) with native sparse scoring fast path
- Native text vectorization and optimization for logistic regression and linear SVM training
- Native Viterbi decoding for hidden Markov model taggers
- Native Euclidean K-means convergence loop with TypeScript fallback for custom distance functions
- Perceptron text classifier APIs (`PerceptronTextClassifier`)
- Conditional Exponential classifier compatibility APIs (`ConditionalExponentialTextClassifier`)
- Positive Naive Bayes classifier APIs (`PositiveNaiveBayesTextClassifier`)
- Stemming and lemmatization suite (`RegexpStemmer`, `LancasterStemmer`, `SnowballStemmer`, `WordNetLemmatizer`)
- Real Snowball (Porter2) stemmers for 12+ languages with Python NLTK parity (`snowballStem`, `SNOWBALL_LANGUAGES`)
- Brill transformation-based tagging (`BrillTagger`, `BrillTaggerTrainer`, templates/rules) with Python NLTK parity
- Supervised Hidden Markov Model POS tagger (training + Viterbi decoding) with Python NLTK parity
- Inter-annotator agreement metrics (`AnnotationTask`: avg Ao, kappa family, Krippendorff's alpha) with Python NLTK parity
- First-order logic semantics subset (`SemLogicParser` + model evaluation/satisfaction) with Python NLTK parity
- Full NLTK VADER sentiment analyzer (`SentimentIntensityAnalyzer`) with exact differential score tests
- Statistical NLTK named-entity chunking (`neChunk`, `neChunkIob`) with lazily loaded binary/multiclass models
- Translation/eval metrics helpers (`sentenceBleu`, `corpusBleu`, `editDistance`, `confusionMatrix`)
- Corpus reader framework (`CorpusReader`) with bundled mini corpora
- Optional external corpus bundle loader + tagged/chunked corpus readers (`parseConllTagged`, `parseBrownTagged`, `parseConllChunked`)
- Corpus registry manifest loader/downloader with checksum validation (`loadCorpusRegistryManifest`, `downloadCorpusRegistry`)
- SIMD token counting fast path (`x86_64` vectorized path + scalar fallback)
- Shared perceptron inference core used by both native and WASM runtimes
- Browser-focused WASM API wrapper with memory pool reuse (`WasmNltk`)
- WASM target for browser/runtime usage with parity benchmarks
- Browser WASM benchmark harness (Chromium/Firefox in CI strict mode)
- Performance regression gate script + CI workflow
- SLA gate script (p95 latency + memory delta) and NLTK parity tracker artifacts
- Global parity suite on PRs across tokenizer, punkt, lm, chunk, wordnet, parser, classifier, and tagger
- Python baseline comparison on the same dataset

## Benchmark results (64MB synthetic dataset)

All benchmarks below use `bench/datasets/synthetic.txt` on this machine.

These timings predate the statistical-model corrections. NB, MaxEnt, decision-tree,
conditional-exponential and language-model timings below do not describe the current defaults;
rerun their comparison scripts to measure current performance.

| Workload | Rust/Bun median sec | Python sec | Faster side | Speedup | Percent faster |
|---|---:|---:|---|---:|---:|
| Token + unique + ngram + unique ngram (`bench:compare`) | 2.767 | 10.071 | Rust native | 3.64x | 263.93% |
| Top-K PMI collocations (`bench:compare:collocations`) | 2.090 | 23.945 | Rust native | 11.46x | 1045.90% |
| Porter stemming (`bench:compare:porter`) | 11.942 | 120.101 | Rust native | 10.06x | 905.70% |
| WASM token/ngram path (`bench:compare:wasm`) | 4.150 | 13.241 | Rust WASM | 3.19x | 219.06% |
| Native vs Python in wasm suite (`bench:compare:wasm`) | 1.719 | 13.241 | Rust native | 7.70x | 670.48% |
| Sentence tokenizer subset (`bench:compare:sentence`) | 1.680 | 16.580 | Rust/Bun subset | 9.87x | 886.70% |
| Perceptron POS tagger (`bench:compare:tagger`) | 19.880 | 82.849 | Rust native | 4.17x | 316.75% |
| Streaming FreqDist + ConditionalFreqDist (`bench:compare:freqdist`) | 3.206 | 20.971 | Rust native | 6.54x | 554.17% |

Notes:
- These native/WASM sentence benchmarks measure explicit ASCII subsets. The default `sentenceTokenizePunkt` now uses trained English Punkt inference in TypeScript; historical native speedups do not describe that path.
- The core npm package omits the 30 MB full WordNet payload. Set `BUN_NLTK_WORDNET_PATH` or pass a packed path to `loadWordNetPacked()` to opt in.
- Runtime `loadWordNet()` uses an explicit packed corpus when available, then falls back to the bundled extended JSON corpus.
- Fixture parity harnesses are available via `bench:parity:sentence` and `bench:parity:tagger`.
- SIMD fast path benchmark (`bench:compare:simd`) shows `countTokensAscii` at `1.22x` and normalization no-stopword path at `2.73x` over scalar baseline.

## Current release benchmarks (1.0.0)

Apple M5 Pro / macOS arm64, Bun 1.4.0 versus NLTK 3.10.3. Medians of five
in-process runs after warmup, with matched workloads and passing output comparisons.

| Workload | Bun median (ms) | Python median (ms) | Python / Bun |
|---|---:|---:|---:|
| Categorical Naive Bayes | 2.56 | 8.30 | 3.24× |
| Decision tree | 6.08 | 18.17 | 2.99× |
| IIS MaxEnt | 4.83 | 74.37 | 15.39× |
| Conditional exponential (IIS) | 4.39 | 85.28 | 19.42× |
| Kneser–Ney LM | 111.71 | 410.90 | 3.68× |
| Trained English Punkt | 1.97 | 5.33 | 2.70× |
| Full VADER | 37.18 | 59.52 | 1.60× |
| Multiclass named entities | 97.96 | 156.72 | 1.60× |
| PCFG best parse | 30.95 | 1337.38 | 43.21× |

Classifier inputs are synthetic short documents with a small vocabulary. These
ratios describe the measured workloads on this host. See the [benchmark methodology
and raw samples](docs/BENCHMARKS.md) for input sizes, timing boundaries and reproduction.

## Build native Rust library

```bash
bun run build:rust
```

## Focused package entrypoints

Use focused imports when the root compatibility barrel is unnecessary:

```ts
import { tokenizeAscii } from "bun_nltk/tokenize";
import { KMeansClusterer } from "bun_nltk/cluster";
import { loadWordNetPacked } from "bun_nltk/wordnet";
```

Other entrypoints include `bun_nltk/native`, `bun_nltk/wasm`, `bun_nltk/reference`,
`bun_nltk/classify`, `bun_nltk/linear-models`, and `bun_nltk/metrics`.

## Build WASM library

```bash
bun run build:wasm
```

## Run tests

```bash
bun run test
```

## Generate synthetic dataset

```bash
bun run bench:generate
```

## Benchmark vs Python baseline

```bash
bun run bench:compare
```

## Benchmark collocations vs Python baseline

```bash
bun run bench:compare:collocations
```

## Benchmark Porter stemmer vs Python NLTK

```bash
bun run bench:compare:porter
```

## Benchmark Native vs WASM vs Python

```bash
bun run bench:compare:wasm
```

## Benchmark sentence tokenizer vs Python

```bash
bun run bench:compare:sentence
```

## Benchmark POS tagger vs Python

```bash
bun run bench:compare:tagger
```

## Benchmark streaming FreqDist vs Python

```bash
bun run bench:compare:freqdist
```

## Benchmark SIMD fast path vs scalar baseline

```bash
bun run bench:compare:simd
```

## Benchmark parser vs Python

```bash
bun run bench:compare:parser
```

## Benchmark decision tree classifier vs Python

```bash
bun run bench:compare:decision-tree
```

## Benchmark Earley parser vs Python

```bash
bun run bench:compare:earley
```

## Benchmark left-corner parser vs Python

```bash
bun run bench:compare:leftcorner
```

## Benchmark feature parser vs Python

```bash
bun run bench:compare:feature-parser
```

## Benchmark feature Earley parser vs Python

```bash
bun run bench:compare:feature-earley
```

## Benchmark classifier vs Python

```bash
bun run bench:compare:classifier
```

## Benchmark sparse linear scorer vs Python

```bash
bun run bench:compare:linear
```

## Benchmark linear-model training native scoring vs JS scoring

```bash
bun run bench:compare:linear-train
```

## Benchmark conditional exponential classifier vs Python

```bash
bun run bench:compare:condexp
```

## Benchmark positive naive bayes vs Python

```bash
bun run bench:compare:positive-nb
```

## Run parity harnesses

```bash
bun run fixtures:import:nltk
bun run bench:parity:sentence
bun run bench:parity:punkt
bun run bench:parity:punkt-extended
bun run bench:parity:tokenizer
bun run bench:parity:tokenizer-family
bun run bench:parity:stemmers
bun run bench:parity:metrics
bun run bench:parity:sentiment
bun run bench:parity:parser
bun run bench:parity:classifier
bun run bench:parity:pcfg
bun run bench:parity:maxent
bun run bench:parity:decision-tree
bun run bench:parity:earley
bun run bench:parity:leftcorner
bun run bench:parity:feature-parser
bun run bench:parity:feature-earley
bun run bench:parity:corpus-imported
bun run bench:parity:imported
bun run bench:parity:wordnet
bun run bench:parity:wordnet-compat
bun run bench:parity:tagger
bun run bench:parity:condexp
bun run bench:parity:positive-nb
bun run bench:parity:snowball
bun run bench:parity:brill
bun run bench:parity:hmm-tagger
bun run bench:parity:agreement
bun run bench:parity:sem
bun run bench:parity:all
bun run parity:report
```

## Benchmark trend tracking

```bash
bun run bench:trend:check
bun run bench:trend:record
```

## Browser/WASM checks

```bash
bun run wasm:size:check
bun run bench:browser:wasm
```

## Pack WordNet corpus

```bash
bun run wordnet:pack
```

## Prepare default packed WordNet runtime dataset

```bash
bun run wordnet:prepare:default
```

## Pack Official WordNet + Verify

```bash
bun run wordnet:pack:official
bun run wordnet:verify:pack
```

## Run regression gate

```bash
bun run bench:gate
```

## Run SLA gate only

```bash
bun run sla:gate
```

## Generate parity tracker

```bash
bun run parity:tracker
```

## Release readiness check

```bash
bun run release:check
```

## Environment

Optional environment variables (see `.env.example` for the full annotated list):

| Variable | Purpose | Default |
|---|---|---|
| `BUN_NLTK_NATIVE_LIB` | Path to the compiled Rust native library | prebuilt path under `native/` |
| `BUN_NLTK_CARGO_BIN` | cargo binary for build scripts | `cargo` on PATH |
| `BUN_NLTK_WORDNET_PATH` | WordNet data dir overriding the bundled mini corpus | bundled mini |
| `BENCH_TREND_MAX_REGRESSION_PCT` | Max regression percent for bench trend checks | repo default |
| `GIT_TAG` | Tag injected into release builds (set by CI) | — |

## Docker

One-command reproducible environment (Bun + Rust + Python/nltk):

```bash
docker compose run --rm test     # full test suite in a container
docker compose run --rm verify   # typecheck + tests
```

Or directly:

```bash
docker build -t bun_nltk . && docker run --rm bun_nltk
```

## Project hygiene

- **CI** (`.github/workflows/ci.yml`): typecheck fast-fail → lint → tests (+ Rust fmt/clippy) on every push and PR. `bun install --frozen-lockfile` enforces `bun.lock`.
- **Lint**: `bun run lint` (Biome). Zero errors enforced; warnings tracked.
- **LOC guard**: `bash scripts/loc-guard.sh 600` fails if any non-grandfathered `.ts`/`.rs` file exceeds 600 lines. Legacy files over the limit are listed inside the script and shrink over time.

## Notes

- Native library output path is `native/bun_nltk.{dll|so|dylib}`.
- npm package ships prebuilt native binaries for `darwin-arm64`, `linux-x64`, and `win32-x64`, plus `native/bun_nltk.wasm`.
- Runtime native loading is prebuilt-first with no implicit local native fallback.
- No install-time lifecycle scripts are used, so `bun pm trust` is not required for install.
- Current tokenizer rule is `[A-Za-z0-9']+` (lowercased ASCII).
- This is the first optimization loop and intentionally scoped.
