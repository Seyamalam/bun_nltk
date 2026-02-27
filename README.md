# bun_nltk

Fast NLP primitives in Zig with Bun bindings (Cycle 1).

## Package docs

- API reference: [docs/API.md](/C:/Users/user/Desktop/bun/bun_nltk/docs/API.md)
- Versioning policy: [docs/VERSIONING.md](/C:/Users/user/Desktop/bun/bun_nltk/docs/VERSIONING.md)
- Publishing guide: [docs/PUBLISHING.md](/C:/Users/user/Desktop/bun/bun_nltk/docs/PUBLISHING.md)
- Changelog: [CHANGELOG.md](/C:/Users/user/Desktop/bun/bun_nltk/CHANGELOG.md)

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
- Native normalization pipeline (ASCII fast path with optional stopword filtering)
- Unicode normalization fallback pipeline (`normalizeTokensUnicode`)
- Native POS regex/heuristic tagger baseline (`posTagAsciiNative`)
- Browser-focused WASM API wrapper with memory pool reuse (`WasmNltk`)
- WASM target for browser/runtime usage with parity benchmarks
- Performance regression gate script + CI workflow
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
| POS tagger baseline (`bench:compare:tagger`) | 2.702 | 69.979 | Zig native | 25.90x | 2489.55% |

Notes:
- Sentence tokenizer is a Punkt-compatible subset, not full Punkt parity on arbitrary corpora.
- Fixture parity harnesses are available via `bench:parity:sentence` and `bench:parity:tagger`.

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

## Run parity harnesses

```bash
bun run bench:parity:sentence
bun run bench:parity:tagger
```

## Run regression gate

```bash
bun run bench:gate
```

## Release readiness check

```bash
bun run release:check
```

## Notes

- Native library output path is `native/bun_nltk.{dll|so|dylib}`.
- Current tokenizer rule is `[A-Za-z0-9']+` (lowercased ASCII).
- This is the first optimization loop and intentionally scoped.
