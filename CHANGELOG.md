# Changelog

All notable changes to this project are documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic Versioning.

## [Unreleased]

### Added
- Recursive-descent CFG parser APIs (`recursiveDescentParse`, `parseTextWithRecursiveDescent`) with parser tests.
- NLTK-style Punkt wrapper classes (`PunktTrainerSubset`, `PunktSentenceTokenizerSubset`) for trainer/tokenizer workflows.
- WordNet graph traversal/similarity APIs (`hypernymPaths`, `lowestCommonHypernyms`, `shortestPathDistance`, `pathSimilarity`).
- Perceptron text classifier family (`PerceptronTextClassifier`, train/load helpers) with serialization and tests.

## [0.9.0] - 2026-02-28

### Added
- Earley recognizer/parser APIs for CFG grammars (`earleyRecognize`, `earleyParse`, `parseTextWithEarley`).
- Dependency parser APIs (`dependencyParse`, `dependencyParseText`) for lightweight arc generation.
- Sparse text feature vectorizer (`TextFeatureVectorizer`) and sparse-batch flattener (`flattenSparseBatch`).
- Decision tree and linear text classifier APIs (`DecisionTreeTextClassifier`, `LogisticTextClassifier`, `LinearSvmTextClassifier`).
- Native Zig sparse linear scoring hot loop (`bunnltk_linear_scores_sparse_ids`) with Bun binding (`linearScoresSparseIdsNative`).
- Corpus registry manifest loader/downloader with SHA256 validation (`loadCorpusRegistryManifest`, `downloadCorpusRegistry`).
- Python-vs-native sparse linear scorer benchmark (`bench:compare:linear`, `python_linear_scores_baseline.py`).
- Earley parser parity/benchmark harnesses (`bench:parity:earley`, `bench:compare:earley`) with Python NLTK baseline.
- Decision tree parity/benchmark harnesses (`bench:parity:decision-tree`, `bench:compare:decision-tree`) with Python NLTK baseline.
- Imported corpus subset fixture pipeline from NLTK Brown/Treebank (`corpus_subsets_fixture.json`) and parity check (`bench:parity:corpus-imported`).

### Changed
- CI/release Python dependencies now include `numpy` to keep MaxEnt parity baselines stable.
- Linear model training now uses native sparse scoring in batch SGD loops (with JS fallback toggle `useNativeScoring`).
- Benchmark gates/trend checks now read shared config (`bench/trend-config.json`) and include linear scorer thresholds.
- Dashboard artifacts now include linear, decision-tree, and earley benchmark tracks plus new parity checks.

## [0.8.0] - 2026-02-27

### Added
- Native Zig LM ID-evaluation hot loop (`bunnltk_lm_eval_ids`) with Bun bindings (`evaluateLanguageModelIdsNative`) and WASM equivalent.
- Native Zig chunk IOB hot loop (`bunnltk_chunk_iob_ids`) with Bun bindings (`chunkIobIdsNative`) and WASM equivalent.
- Packed WordNet corpus pipeline script (`wordnet:pack`) and packed bundle loader (`loadWordNetPacked`).
- CFG parser and chart parser subset APIs (`parseCfgGrammar`, `chartParse`, `parseTextWithCfg`) with Python parity tests and benchmarks.
- Naive Bayes text classifier APIs (`NaiveBayesTextClassifier`) with train/predict/evaluate/serialize support and Python parity tests/benchmarks.
- Global Python parity suite (`bench:parity:all`) covering tokenizer, punkt, lm, chunk, wordnet, parser, classifier, and tagger.
- Official WordNet deterministic pack workflow (`wordnet:pack:official`) with SHA256 manifest and verification script (`wordnet:verify:pack`).

### Changed
- Browser WASM benchmark expanded for Punkt, LM, chunk, and WordNet workloads plus per-workload browser thresholds.
- Cross-feature SLA gate (`sla:gate`) is now part of `bench:gate`.
- CI now runs global parity suite and uploads official WordNet packed artifacts for validation.

## [0.7.0] - 2026-02-27

### Added
- Trainable Punkt tokenizer APIs with model serialization/parsing support.
- Mini WordNet dataset and lookup API (`synsets`, `morphy`, relation traversal).
- N-gram language model stack with `MLE`, `Lidstone`, and interpolated `Kneser-Ney`.
- Regexp chunk parser primitives with IOB conversion helper.
- Corpus reader framework with bundled mini corpora (`news`, `science`, `fiction`).
- Python baseline harnesses for Punkt, LM, and chunk parser parity checks.
- Zig native Punkt sentence splitting exports + WASM Punkt sentence splitting exports.
- Zig native WordNet morphy exports + WASM WordNet morphy exports.
- Extended WordNet bundle (`models/wordnet_extended.json`) and loader (`loadWordNetExtended`).
- Optional external corpus bundle loader (`loadCorpusBundleFromIndex`).
- Tagged/chunked corpus format parsers (`parseConllTagged`, `parseBrownTagged`, `parseConllChunked`).
- Benchmark compare scripts for Punkt, LM, chunk parser, and WordNet.

## [0.6.2] - 2026-02-27

### Added
- Native streaming `FreqDist`/`ConditionalFreqDist` builder APIs with JSON export.
- Python comparison benchmark for streaming distributions (`bench:compare:freqdist`).
- SIMD/scalar comparison benchmark for tokenizer and normalization fast paths (`bench:compare:simd`).
- Shared Zig perceptron inference core reused by native and WASM runtimes.
- NLTK coverage-slice fixture suite and parity report generator (`parity:report`).
- Browser WASM benchmark harness and WASM size budget check scripts.

### Changed
- `countTokensAscii` now uses an x86_64 SIMD fast path with scalar fallback.
- `countNormalizedTokensAscii(..., false)` now uses a direct token-count/offset fast path.
- `posTagPerceptronAscii` now uses native Zig inference by default (JS path retained via `useNative: false`).
- CI now uploads parity and browser-WASM benchmark artifacts and enforces WASM size budget.
- WASM build uses `ReleaseSmall` + stripped output for browser-focused footprint.

## [0.6.1] - 2026-02-27

### Added
- npm package now ships prebuilt native binaries for:
  - `linux-x64` (`native/prebuilt/linux-x64/bun_nltk.so`)
  - `win32-x64` (`native/prebuilt/win32-x64/bun_nltk.dll`)
- Added cross-target prebuilt build script: `bun run build:prebuilt`.
- Added package payload verification script: `bun run pack:verify:prebuilt`.
- Added post-publish smoke workflow matrix on Linux + Windows to validate npm package install/runtime behavior without build steps.

### Changed
- Native runtime now resolves packaged prebuilt binary by platform/arch first.
- Native runtime no longer falls back implicitly to local build outputs.
- Release and CI workflows now build/verify prebuilt binaries as part of pipeline.
- npm package file allowlist now includes only required prebuilt binaries and wasm file.

## [0.6.0] - 2026-02-27

### Added
- First stable npm release line for `bun_nltk`.
- Automated tag-based CI + release workflow with provenance publishing and benchmark dashboard artifacts.

### Changed
- Package metadata aligned with npm provenance validation (`repository`, `homepage`, `bugs`).

## [0.5.1-beta.2] - 2026-02-27

### Changed
- Added npm provenance-required package metadata (`repository`, `homepage`, `bugs`) to enable GitHub Actions publish with `--provenance`.

## [0.5.1-beta.1] - 2026-02-27

### Added
- Tag-based npm publish workflow with prerelease channel mapping (`alpha`, `beta`, `rc`, `next`).
- Release metadata validator script (`release:validate`) that checks semver, tag/version match, and changelog section presence.
- Manual `workflow_dispatch` trigger for CI workflow.

### Changed
- CI and Release workflows now use a reliable Zig setup action.
- Publishing and versioning docs updated with automated release flow details.

## [0.5.0] - 2026-02-27

### Added
- Trained averaged perceptron POS tagger with generated model artifact.
- JS and WASM perceptron inference paths with batch prediction support.
- Perceptron parity and benchmark harnesses against Python baseline.
- Sentence tokenizer improvements: abbreviation learning and orthographic heuristics.
- Benchmark dashboard generator (JSON + Markdown artifacts) with throughput and memory metrics.
- CI artifact upload for benchmark dashboard.

### Changed
- `bench:compare:tagger` now benchmarks the trained perceptron path.
- Package metadata now includes semantic version, publish fields, and release check script.

## [0.4.0] - 2026-02-27

### Added
- Sentence tokenizer subset and parity fixtures.
- Normalization pipeline (ASCII fast path + Unicode fallback) with optional stopword removal.
- Rule-based POS tagger baseline and parity tests.
- Browser-focused WASM wrapper with pooled memory blocks.
- Performance gate script and CI workflow integration.
- Benchmark results table in README.

## [0.3.0] - 2026-02-27

### Added
- Native everygrams/skipgrams APIs.
- Batch ASCII metrics API (`tokens`, `uniqueTokens`, `ngrams`, `uniqueNgrams`).
- Fixture-driven parity tests for tokenizers, collocations, and Porter stemming.

## [0.2.0] - 2026-02-27

### Added
- Windowed collocation scoring with PMI.
- Collision-free token-id frequency distribution APIs.
- Native Porter stemmer.
- Tokenizer subset APIs.
- WASM build and comparison benchmarks.

## [0.1.0] - 2026-02-27

### Added
- Zig native token and n-gram counting primitives.
- Unique token/ngram counting and hashed frequency distributions.
- Native token/ngram materialization APIs.
- Python comparison benchmarks and synthetic dataset generation.
