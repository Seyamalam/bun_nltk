# bun_nltk

Fast NLP primitives in Zig with Bun bindings (Cycle 1).

## Implemented in this milestone

- ASCII token counting
- ASCII unique-token counting (`FreqDist`-style cardinality)
- ASCII n-gram counting
- ASCII unique n-gram counting
- Hashed frequency distributions for tokens and n-grams
- Native token materialization and n-gram materialization APIs
- Top-K bigram PMI collocation scoring (native)
- Python baseline comparison on the same dataset

## Build native Zig library

```bash
bun run build:zig
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

## Notes

- Native library output path is `native/bun_nltk.{dll|so|dylib}`.
- Current tokenizer rule is `[A-Za-z0-9']+` (lowercased ASCII).
- This is the first optimization loop and intentionally scoped.
