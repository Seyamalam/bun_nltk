# Rust Punkt training and versioned inference

> **Budget update (2026-10-21):** the browser WASM budget is now 1,100,000
> bytes by explicit owner decision. Figures below that compare against the
> former 700,000-byte limit are historical measurements.

`sentenceTokenizePunkt` and the `PunktSentenceTokenizer` classes now use Rust/WASM
for the bundled English model and all version-2 custom models. The parameters
are the NLTK English `punkt_tab` abbreviations, collocations, sentence starters,
and orthographic context bits, without normalization or lossy truncation.
The bundled model was checked against NLTK 3.10.3 official English data.

The core in `rust/src/punkt_unicode.rs` implements the default English word
tokenizer, first/second-pass annotation, potential-boundary overlap suppression,
and quote/parenthesis realignment. It is not the existing ASCII heuristic.
`rust/src/wasm_punkt.rs` exports model load/free/clear and interleaved byte spans.
The version-1 ABI payload consists of little-endian u32 lengths followed by UTF-8
strings; model inference uses version-2 parameters. TS only marshals models,
loads the module, converts offsets, and slices the original text.

`PunktSentenceTokenizer.spanTokenize(text, realignBoundaries = true)` returns
UTF-16 start/end offsets for JavaScript slicing. `tokenize` also accepts the
realignment flag. `RustPunktTokenizer` from `src/punkt_wasm.ts` accepts an explicit
`WasmNltk` instance and version-2 model, exposes byte spans as well as UTF-16 spans,
and owns an immutable WASM model snapshot; call `dispose()` when finished.
The synchronous facade loads a fresh snapshot per call so mutations to parameters
are observed. Browser ESM imports asynchronously load the WASM before the existing
synchronous API can be used. Hostless consumers can instantiate the explicit class.

## Validation

```sh
CARGO_TARGET_DIR=/tmp/opencode/bun-nltk-m6-9a8fa657 cargo test --manifest-path rust/Cargo.toml --locked
CARGO_TARGET_DIR=/tmp/opencode/bun-nltk-m6-9a8fa657 cargo build --release --target wasm32-unknown-unknown --manifest-path rust/Cargo.toml --locked
cp /tmp/opencode/bun-nltk-m6-9a8fa657/wasm32-unknown-unknown/release/bun_nltk.wasm native/bun_nltk.wasm
PYTHONPATH=/tmp/opencode/bun-nltk-oracle bun test ./test --timeout 30000
bun run build:portable
bun run scripts/verify-punkt-portable.ts
npx --no-install tsrs -p tsconfig.json --noEmit
npx --no-install oxlint src test bench scripts index.ts
```

The differential oracle asserts NLTK **3.10.3**, not an arbitrary installed
version. It compares actual sentences and raw/aligned byte/UTF-16 spans using the
same explicit parameters. No downloader is needed for these tests. Official
model verification additionally needs English `punkt_tab` installed. The full
typecheck requires `bun install --ignore-scripts` in `examples/js-library` so its
declared local package dependency resolves.

## Remaining scope and integration notes

- Training now runs in `rust/src/punkt_training.rs`, sharing the inference word
  tokenizer and preserving version-2 model fields, minimum-count options, scores,
  cached/defensive snapshots, and incremental chunk replay. TS retains chunks and
  options; this is not a persistent bounded-memory Rust trainer. Frozen model
  digests were captured from parent `169d004` before removing the TS algorithms.
- Actual NLTK 3.10.3 / Python 3.14.4 training parameters, abbreviation scores, and
  trained inference are compared on ten targeted and eighty seeded multi-chunk
  corpora. The official English model is loaded from `nltk.data.path` and compared
  field-by-field. NLTK's inserted zero-valued `defaultdict` orthographic entries
  are omitted by the existing serialized contract. One old TS discrepancy is
  deliberately corrected: NLTK non-punctuation excludes decimal digits.
- Legacy version-1 inference now runs in `rust/src/punkt_legacy.rs`, preserving
  the package heuristic rather than claiming NLTK parity. The control ABI takes
  UTF-16 units to preserve lone surrogates, ASCII lookahead, ECMAScript whitespace,
  score/context normalization and insertion-order collisions. Raw/public spans
  still explicitly require version 2, as before.
- `debugDecisions` / `debug_decisions` run the shared Rust context and second-pass
  routines for version 2. Fields use NLTK names; `period_index` is UTF-16 rather
  than Python code points, and orthographic contexts are arrays rather than sets.
  NLTK's nullable `break_decision` is preserved. A context with fewer than two
  tokens produces an explicit error (NLTK itself raises `IndexError`). Version 1
  debug is explicitly unsupported. Added camelCase/snake_case aliases for existing
  trainer/tokenizer parameter, load-text, and span methods.
- Custom language regexes/token classes and the rest of NLTK's trainer tuning,
  `train_tokens`, frequency pruning, and debug-formatting APIs remain unsupported.
- Minimum-count options are package extensions, not NLTK's tuning API. Only typed
  finite JSON-serializable model/options inputs are supported; invalid model values
  or non-finite JS options are not promised identical coercion behavior.
- General categories are pinned to Unicode 16.0 (`unicode-general-category
  =1.1.0`). Case conversion/properties use the Rust standard library; exhaustive
  parity across every Unicode scalar or other Python Unicode database versions
  is not established. Tests cover accents, titlecase, Greek, Turkic case,
  non-decimal numeric initials, astral letters, emoji, and Python whitespace.
- Unpaired JS surrogates use TextEncoder replacement for version-2 inference, with output
  slicing preserving the original string; this is not a Python UTF-8 differential.
- Inference is batch, not a bounded-memory streaming interface. Large-text
  throughput, repeated default-model loading, and worst-case contexts are not
  benchmarked here.
- Integration registrations: two module lines (`punkt_training`, `punkt_legacy`)
  in `rust/src/lib.rs`; two exports (`bunnltk_wasm_punkt_request`,
  `bunnltk_wasm_punkt_copy`) and `punktRequest` in `src/wasm.ts`. Existing Punkt
  clear releases the control-result buffer. No new runtime instance, root-index,
  shared build-script, package setting, or `src/nltk_compat.ts` edits are needed.
  Parent must regenerate `native/bun_nltk.wasm` and `dist/portable` after combining
  changes; these locally generated artifacts are intentionally not committed.
- WebKit validation is blocked on this host by missing `libevent-2.1.so.7`.

## Milestone 6 validation / release blockers

Combined source built with `--locked` and isolated
`CARGO_TARGET_DIR=/tmp/opencode/bun-nltk-m6-9a8fa657`; output copied explicitly.
Rust: 100 tests pass. TS: tsrs passes after installing declared example dependency;
changed Punkt TS/test/script files have zero Oxlint warnings. Full Oxlint has
pre-existing warnings outside Punkt. Node, Chromium and Firefox portable checks
cover default inference, Rust-trained models, version 1 and debug.
All 22 Punkt tests pass (16,847 assertions), including 128 orthographic bit values,
90 training corpora, frozen version-1/default-option/threshold-option contracts,
Unicode spans, official English model parameters, and debug/error boundaries.
`PYTHONPATH=/tmp/opencode/bun-nltk-oracle bun test ./test --timeout 30000`:
572 pass, 2 inventory failures. The default 5-second timeout can intermittently
time out the inherited NLTK model-export test under concurrent builds/browsers.

The 700000-byte WASM gate remains unchanged and fails: combined WASM is 1,486,779
bytes (parent artifact 1,345,655). The package 400-file / 13000000-byte gates also
remain unchanged: 313 files pass the count gate, but unpacked size fails (~14.5 MB
from the rounded pack listing). These are integration/release blockers, not passed
size gates. Full suite has two pre-existing compatibility-inventory
failures (stale Treebank signature anchor and discovered-export snapshot drift);
parent owns inventory regeneration specifically against Python 3.14.4.

Training uses deterministic sorted object keys (JSON property order is not the
old TS insertion order) and Rust libm scores (oracle tolerance 1e-10, not bitwise
JS double serialization). Lone-surrogate training/debug strings are rejected by
Rust's JSON decoder; version-2 inference still uses TextEncoder replacement and
legacy inference preserves UTF-16 units. A future root type-only re-export of
`PunktDebugDecision` is optional; its definition is currently in `src/punkt.ts`.
