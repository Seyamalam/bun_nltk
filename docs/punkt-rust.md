# Unicode Punkt inference

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
PYTHONPATH=/tmp/opencode/bun-nltk-oracle bun test ./test
CARGO_TARGET_DIR=/tmp/opencode/bun-nltk-punkt-063598c0 cargo test --manifest-path rust/Cargo.toml --locked
CARGO_TARGET_DIR=/tmp/opencode/bun-nltk-punkt-063598c0 cargo build --release --target wasm32-unknown-unknown --manifest-path rust/Cargo.toml --locked
cp /tmp/opencode/bun-nltk-punkt-063598c0/wasm32-unknown-unknown/release/bun_nltk.wasm native/bun_nltk.wasm
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

- Training is **not migrated**. `src/punkt_trainer.ts` and
  `src/punkt_training_tokens.ts` retain the working TS training algorithm.
- Legacy version-1 inference remains unchanged TS behavior. It is not claimed
  as NLTK behavioral parity; byte/raw spans explicitly require version 2.
- Custom language regexes/token classes, decision-debug APIs, and incremental
  Rust training are not implemented by this inference API.
- General categories are pinned to Unicode 16.0 (`unicode-general-category
  =1.1.0`). Case conversion/properties use the Rust standard library; exhaustive
  parity across every Unicode scalar or other Python Unicode database versions
  is not established. Tests cover accents, titlecase, Greek, Turkic case,
  non-decimal numeric initials, astral letters, emoji, and Python whitespace.
- Unpaired JS surrogates use TextEncoder replacement for inference, with output
  slicing preserving the original string; this is not a Python UTF-8 differential.
- Inference is batch, not a bounded-memory streaming interface. Large-text
  throughput, repeated default-model loading, and worst-case contexts are not
  benchmarked here.
- Merge `punkt_unicode`/`wasm_punkt` module registrations into `rust/src/lib.rs`
  and the four Punkt methods/exports into `src/wasm.ts`. No root-index, shared
  build-script, native-platform artifact, or `src/nltk_compat.ts` edits are needed.
  Regenerate `native/bun_nltk.wasm` and `dist/portable` after combining agents'
  changes; the checked-in binary here is built only from this isolated branch.
- WebKit validation is blocked on this host by missing `libevent-2.1.so.7`.
