# bun_nltk

Fast NLP primitives in Zig with Bun bindings (Cycle 1).

## Package docs

- API reference: [docs/API.md](/C:/Users/user/Desktop/bun/bun_nltk/docs/API.md)
- Versioning policy: [docs/VERSIONING.md](/C:/Users/user/Desktop/bun/bun_nltk/docs/VERSIONING.md)
- Publishing guide: [docs/PUBLISHING.md](/C:/Users/user/Desktop/bun/bun_nltk/docs/PUBLISHING.md)
- Changelog: [CHANGELOG.md](/C:/Users/user/Desktop/bun/bun_nltk/CHANGELOG.md)
- Release workflow: [.github/workflows/release.yml](/C:/Users/user/Desktop/bun/bun_nltk/.github/workflows/release.yml)

## Implemented in this milestone

- ASCII token counting
- ASCII unique-token counting (`FreqDist`-style cardinality)
- ASCII n-gram counting
- ASCII unique n-gram counting
- Hashed frequency distributions for tokens and n-grams
- Native token materialization and n-gram materialization APIs
- Top-K bigram PMI collocation scoring (native, with `window_size >= 2`)
- Collision-free token ID frequency distribution API (`id <-> token`)
- Native windowed bigram stats API (`left_id`, `right_id`, `count`, `pmi`)
- Native Porter stemmer (ASCII, lowercasing)
- Tokenizer parity layer (`wordTokenizeSubset`, `tweetTokenizeSubset`)
- Sentence tokenizer parity subset (`sentenceTokenizeSubset`) + Python parity harness
- Trainable Punkt tokenizer/model APIs (`trainPunktModel`, `sentenceTokenizePunkt`)
- NLTK-style Punkt wrapper APIs (`PunktTrainerSubset`, `PunktSentenceTokenizerSubset`)
- Native Zig Punkt sentence-splitting fast path (`sentenceTokenizePunktAsciiNative`) with WASM equivalent
- Native normalization pipeline (ASCII fast path with optional stopword filtering)
- Unicode normalization fallback pipeline (`normalizeTokensUnicode`)
- Native POS regex/heuristic tagger baseline (`posTagAsciiNative`)
- Native streaming `FreqDist`/`ConditionalFreqDist` builder with JSON export (`NativeFreqDistStream`)
- Mini WordNet reader with synset lookup, relation traversal, and morphy-style inflection recovery
- WordNet graph helpers (`hypernymPaths`, `lowestCommonHypernyms`, `shortestPathDistance`, `pathSimilarity`)
- Native Zig morphy accelerator (`wordnetMorphyAsciiNative`) with WASM equivalent
- Packed WordNet corpus pipeline (`wordnet:pack`) with binary loader (`loadWordNetPacked`)
- Default WordNet runtime loader (`loadWordNet`) that uses packed official corpus when present
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
- Perceptron text classifier APIs (`PerceptronTextClassifier`)
- Conditional Exponential classifier compatibility APIs (`ConditionalExponentialTextClassifier`)
- Positive Naive Bayes classifier APIs (`PositiveNaiveBayesTextClassifier`)
- Corpus reader framework (`CorpusReader`) with bundled mini corpora
- Optional external corpus bundle loader + tagged/chunked corpus readers (`parseConllTagged`, `parseBrownTagged`, `parseConllChunked`)
- Corpus registry manifest loader/downloader with checksum validation (`loadCorpusRegistryManifest`, `downloadCorpusRegistry`)
- SIMD token counting fast path (`x86_64` vectorized path + scalar fallback)
- Shared Zig perceptron inference core used by both native and WASM runtimes
- Browser-focused WASM API wrapper with memory pool reuse (`WasmNltk`)
- WASM target for browser/runtime usage with parity benchmarks
- Browser WASM benchmark harness (Chromium/Firefox in CI strict mode)
- Performance regression gate script + CI workflow
- SLA gate script (p95 latency + memory delta) and NLTK parity tracker artifacts
- Global parity suite on PRs across tokenizer, punkt, lm, chunk, wordnet, parser, classifier, and tagger
- Python baseline comparison on the same dataset

## Benchmark results (64MB synthetic dataset)

All benchmarks below use `bench/datasets/synthetic.txt` on this machine.

| Workload | Zig/Bun median sec | Python sec | Faster side | Speedup | Percent faster |
|---|---:|---:|---|---:|---:|
| Token + unique + ngram + unique ngram (`bench:compare`) | 2.767 | 10.071 | Zig native | 3.64x | 263.93% |
| Top-K PMI collocations (`bench:compare:collocations`) | 2.090 | 23.945 | Zig native | 11.46x | 1045.90% |
| Porter stemming (`bench:compare:porter`) | 11.942 | 120.101 | Zig native | 10.06x | 905.70% |
| WASM token/ngram path (`bench:compare:wasm`) | 4.150 | 13.241 | Zig WASM | 3.19x | 219.06% |
| Native vs Python in wasm suite (`bench:compare:wasm`) | 1.719 | 13.241 | Zig native | 7.70x | 670.48% |
| Sentence tokenizer subset (`bench:compare:sentence`) | 1.680 | 16.580 | Zig/Bun subset | 9.87x | 886.70% |
| Perceptron POS tagger (`bench:compare:tagger`) | 19.880 | 82.849 | Zig native | 4.17x | 316.75% |
| Streaming FreqDist + ConditionalFreqDist (`bench:compare:freqdist`) | 3.206 | 20.971 | Zig native | 6.54x | 554.17% |

Notes:
- Sentence tokenizer is a Punkt-compatible subset, not full Punkt parity on arbitrary corpora.
- Full WordNet corpus binaries are prepared at build/release time via `bun run wordnet:prepare:default`; npm still does not bundle raw upstream dict files.
- Runtime `loadWordNet()` prefers packed official corpus when available, then falls back to extended JSON corpus.
- Fixture parity harnesses are available via `bench:parity:sentence` and `bench:parity:tagger`.
- SIMD fast path benchmark (`bench:compare:simd`) shows `countTokensAscii` at `1.22x` and normalization no-stopword path at `2.73x` over scalar baseline.

## Extended benchmark results (8MB gate dataset)

| Workload | Zig/Bun median sec | Python sec | Faster side | Speedup | Percent faster |
|---|---:|---:|---|---:|---:|
| Punkt tokenizer default path (`bench:compare:punkt`) | 0.0848 | 1.3463 | Zig native | 15.87x | 1487.19% |
| N-gram LM (Kneser-Ney) score+perplexity (`bench:compare:lm`) | 0.1324 | 2.8661 | Zig/Bun | 21.64x | 2064.19% |
| Regexp chunk parser (`bench:compare:chunk`) | 0.0024 | 1.5511 | Zig/Bun | 643.08x | 64208.28% |
| WordNet lookup + morphy workload (`bench:compare:wordnet`) | 0.0009 | 0.0835 | Zig/Bun | 91.55x | 9054.67% |
| CFG chart parser subset (`bench:compare:parser`) | 0.0088 | 0.3292 | Zig/Bun | 37.51x | 3651.05% |
| Naive Bayes text classifier (`bench:compare:classifier`) | 0.0081 | 0.0112 | Zig/Bun | 1.38x | 38.40% |
| PCFG Viterbi chart parser (`bench:compare:pcfg`) | 0.0191 | 0.4153 | Zig/Bun | 21.80x | 2080.00% |
| MaxEnt text classifier (`bench:compare:maxent`) | 0.0244 | 0.1824 | Zig/Bun | 7.46x | 646.00% |
| Sparse linear logits hot loop (`bench:compare:linear`) | 0.0024 | 2.0001 | Zig native | 840.54x | 83954.04% |
| Decision tree text classifier (`bench:compare:decision-tree`) | 0.0725 | 0.5720 | Zig/Bun | 7.89x | 688.55% |
| Earley parser workload (`bench:compare:earley`) | 0.1149 | 4.6483 | Zig/Bun | 40.47x | 3947.07% |
| Left-corner parser workload (`bench:compare:leftcorner`) | 0.0197 | 0.5359 | Zig/Bun | 27.27x | 2626.82% |
| Feature parser workload (`bench:compare:feature-parser`) | 0.0110 | 1.1432 | Zig/Bun | 104.38x | 10338.21% |
| Feature Earley parser workload (`bench:compare:feature-earley`) | 0.0117 | 0.1592 | Zig/Bun | 13.64x | 1263.62% |
| Conditional Exponential classifier (`bench:compare:condexp`) | 0.0111 | 0.1685 | Zig/Bun | 15.15x | 1414.67% |
| Positive Naive Bayes classifier (`bench:compare:positive-nb`) | 0.0199 | 0.0416 | Zig/Bun | 2.09x | 108.63% |

## Build native Zig library

```bash
bun run build:zig
```

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
bun run bench:parity:tagger
bun run bench:parity:condexp
bun run bench:parity:positive-nb
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

## Notes

- Native library output path is `native/bun_nltk.{dll|so|dylib}`.
- npm package ships prebuilt native binaries for `linux-x64` and `win32-x64`, plus `native/bun_nltk.wasm`.
- Runtime native loading is prebuilt-first with no implicit local native fallback.
- No install-time lifecycle scripts are used, so `bun pm trust` is not required for install.
- Current tokenizer rule is `[A-Za-z0-9']+` (lowercased ASCII).
- This is the first optimization loop and intentionally scoped.
