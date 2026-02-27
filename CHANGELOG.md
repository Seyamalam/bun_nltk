# Changelog

All notable changes to this project are documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic Versioning.

## [Unreleased]

### Added
- (no entries yet)

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
