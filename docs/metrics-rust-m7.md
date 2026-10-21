# Milestone 7 evaluation kernels

Implemented in `rust/src/metrics.rs`, `rust/src/translation_metrics.rs`, and
`rust/src/wasm_metrics.rs`. TypeScript handles types, label/token interning,
packet construction, loading, and output shape conversion. No new dependencies.

## Migrated and behaviorally tested

- Jaccard, MASI, precision, recall, F-measure, presence, fractional presence.
- Binary and numeric interval distances; canonical Dice extension (not an NLTK
  3.10.3 API, so its tests are not claimed as NLTK parity).
- WindowDiff and Pk, including Python codepoint lengths, half-even default
  windows, boundary-free references, zero/negative/oversize windows, and string
  `.count()` behavior for empty/multi-character boundaries.
- Spearman correlation and score-to-rank conversion; sequence-to-rank is an
  enumeration adapter. Duplicate rank keys retain first position/last value.
- Accuracy, sparse confusion counts, codepoint/numeric label sorting, and
  per-label precision/recall/F-measure.
- Probability-map log-likelihood; zero/missing probabilities use NLTK's
  `-1e300` log-probability sentinel.
- Sentence/corpus ChrF and NIST, including NIST orders beyond five and Python
  whitespace removal (U+001C and U+0085 removed; U+FEFF retained).

`test/metrics_oracle.py` asserts NLTK **3.10.3** and never silently skips.
`test/metrics_rust_differential.test.ts` has 1,875 randomized/edge behavioral
oracle evaluations: sets 899, segmentation 262, ranking 258, confusion/accuracy
164, likelihood/scalars 16, translation 276. JS identity tests, ABI validation,
sparse-scale tests, and Node execution checks are separate from those counts.
These families require no downloaded NLTK corpora. The checked environment has
the oracle source but no stopwords corpus.

## Explicit differences and unfinished APIs

- Set/ranking/confusion interning uses JS Map/Set SameValueZero and object/symbol
  identity. `1` and `"1"` remain distinct. Python structural object equality and
  `True == 1` do not apply to generic JS labels. Binary distance retains strict
  JS equality. Positional accuracy also treats NaN as unequal to itself.
  Segmentation bool/int boundary comparisons do follow Python.
- Confusion strings and numbers sort in Rust. Heterogeneous/object labels use
  first-seen identity order (Python would usually reject sorting these).
- `ConfusionMatrix` implements numeric lookup/scoring only. Python formatting,
  `evaluate`, and `sort_by_count` are **not implemented**; no stubs are exposed.
- Existing `confusionMatrix([], [])` still returns an empty matrix and accuracy
  zero. New standalone `accuracy([], [])` raises `ZeroDivisionError`, like NLTK.
- Dense conversion explicitly rejects more than 2,048 labels; sparse lookup
  remains available. ChrF/NIST have an explicit 1,024-order resource limit.
- Non-numeric interval inputs retain the existing TS TypeError (Python prints a
  diagnostic and returns None). Float arithmetic cannot emulate Python's
  arbitrary-size integer ranks/distances.
- `customDistance` remains a JS string-label TSV adapter, not the Python
  singleton-frozenset contract. Its old separator-collision lookup is fixed,
  but Rust migration/exact file parsing remains unfinished.
- Existing edit-distance/alignment Rust implementations are reused unchanged.
  Jaro/Jaro-Winkler and segmentation GHD are still absent.
- Legacy sentence/corpus BLEU remains TS with its historical add-one smoothing;
  it is not NLTK default BLEU parity. Agreement, ALINE, Paice, GLEU, METEOR,
  RIBES, and LEPOR are not migrated in this round.

## Integration

Shared edits are three module declarations in `rust/src/lib.rs`, the typed
`MetricsExports` intersection and `evaluationMetrics()` accessor in
`src/wasm.ts`, root exports in `index.ts`, and module/precise-type additions in
`scripts/build-portable.ts` / `tsconfig.portable.json`. The `sync_wasm.ts` loader
now resolves both source and generated portable module paths. Existing aliases
continue to use replaced functions without editing generated alias files.

Rebuild WASM from source after cherry-picking; the committed WASM is a locally
built and tested portable artifact, not a claimed new native-platform binary:

```sh
CARGO_TARGET_DIR=/tmp/opencode/bun-nltk-m7-433bc606 cargo build --release --target wasm32-unknown-unknown --manifest-path rust/Cargo.toml --locked
cp /tmp/opencode/bun-nltk-m7-433bc606/wasm32-unknown-unknown/release/bun_nltk.wasm native/bun_nltk.wasm
bun run build:portable
PYTHONPATH=/tmp/opencode/bun-nltk-oracle bun test ./test
```

The existing build-wasm script's copy step ignores `CARGO_TARGET_DIR`, so use
the explicit build/copy above. No other platform binaries were modified.
Root portable declarations for migrated metrics are precise; existing broad
facades for unrelated APIs are untouched. Full typechecking also requires
installing `examples/js-library`'s existing local dependency.

The general browser verification passes Chromium/Firefox but WebKit cannot
launch in this environment (`libevent-2.1.so.7` missing). The family-specific
`scripts/verify-metrics-portable.ts` additionally executes the new kernels in
Chromium/Firefox. These are portable execution checks, not Python oracle parity.

## Local validation

- `PYTHONPATH=/tmp/opencode/bun-nltk-oracle bun test ./test`: **511 passed**
  (baseline 498; 13 new family test blocks).
- `CARGO_TARGET_DIR=/tmp/opencode/bun-nltk-m7-433bc606 cargo test --manifest-path rust/Cargo.toml --locked`:
  **71 passed** (baseline 62; nine new Rust unit tests).
- `npx --no-install tsrs -p tsconfig.json --noEmit`: passed, including generic
  portable metric type assertions and rejected invalid types.
- Changed-file `npx --no-install oxlint`: no diagnostics. Full repository
  Oxlint exits successfully with existing unrelated warnings.
- `bun run build:portable`: passed; generated JS/declarations are included.
- `bun run scripts/verify-metrics-portable.ts`: Chromium and Firefox passed.
- `bun run verify:portable`: Chromium/Firefox passed, WebKit launch blocked
  by the missing shared library above, so the whole command did not pass.
