# Text Naive Bayes Rust migration (milestone 9 family slice)

`CategoricalNaiveBayes`, `MultinomialNaiveBayesTextClassifier`, and
`PositiveNaiveBayesTextClassifier` now train and score in Rust/WASM. TS retains
typed serialized state, option normalization, transport, serialization ordering,
and evaluation. Public factories and versions 1/2 are unchanged. Training remains
incremental for categorical/multinomial; positive training replaces the model.
Feature-dictionary APIs and their interned lossless encodings are untouched.

## Behavioral evidence

`test/text_nb_migration.test.ts` compares complete serialized models and prediction
rows against frozen `test/fixtures/text_nb_405347e.json` from original TS commit
`405347e`, reproducible with `test/fixtures/text_nb_golden.capture.ts --base`.
Normal tests need no git history. This includes token counts,
insertion order, Unicode text boundaries, prototype-like labels, empty/OOV
queries, incremental training, positive retraining and custom options. The
comparison uses exact strings, array order, fields and integers; transcendental
float outputs use relative/absolute tolerance `2e-14`. **Bit-exact float parity
is not claimed.** Round trips within the new runtime are exact.

Randomized categorical text tests compare 144 queries, across 12 training sets
and four smoothing values, to NLTK **3.10.3** probabilities and classifications.
No corpus data is needed for those tests; the version is asserted. Neither the
multinomial extension nor the Bernoulli positive/unlabeled extension is claimed
to implement NLTK's categorical feature classifier contract.

The legacy multinomial all-OOV fallback is preserved: all unknown tokens are
smoothed when there are no known tokens; mixed known/unknown queries ignore the
unknown tokens. This was observable through Bun's zero-length FFI buffer error.
Rust implements the policy directly without exceptions or a TS algorithm.

Malformed payloads now reject nonfinite/invalid counts, duplicate categorical
labels or features, malformed token/count pairs, and unequal positive probability
array lengths rather than allowing corrupt or NaN results.

## Integration

- Core: `rust/src/text_naive_bayes.rs`.
- Dedicated ABI: `rust/src/wasm_text_naive_bayes.rs` exports request/copy/clear.
- `rust/src/lib.rs` adds only the two module declarations.
- `src/wasm.ts` adds those three signatures, one transport method, and cleanup.
- `src/text_nb_transport.ts` exposes discriminated, typed overloads; only legacy
  text model payloads use JSON. No feature dictionary is stringified.
- `src/sync_wasm.ts` resolves the packaged WASM location when bundled into
  `dist/portable`, using the same layout detection as `WasmNltk`.
- Existing serde/serde_json dependencies are pinned to the lockfile versions
  and enabled for WASM, including round-trip-safe JSON float parsing. No new
  third-party dependency is added.
- The WASM artifact is rebuilt locally from this source; no platform-native
  binary is supplied. Generated portable JS/WASM declarations are refreshed
  using the existing build script.

Build with a worktree-local Cargo target or explicitly copy the isolated target
artifact, since existing build scripts assume `rust/target` when copying output:

```sh
CARGO_TARGET_DIR=/tmp/opencode/bun-nltk-m9-55914fe3 cargo build --locked --release --target wasm32-unknown-unknown --manifest-path rust/Cargo.toml
cp /tmp/opencode/bun-nltk-m9-55914fe3/wasm32-unknown-unknown/release/bun_nltk.wasm native/bun_nltk.wasm
bun run build:portable
PYTHONPATH=/tmp/opencode/bun-nltk-oracle bun test ./test
```

This intentionally uses a stateless transport, reparsing the serialized model
for prediction, to preserve synchronous mutable/serializable APIs without model
handle ownership changes. It is **not** a speed improvement claim. A retained
Rust model and typed binary snapshots could reduce transport cost in later work.

Local checks: **505 Bun tests / 67 Rust tests**, `npx --no-install tsrs -p
tsconfig.json --noEmit`, full Oxlint (only pre-existing warnings), portable build,
and WASM size gate pass. The artifact is 524,619 bytes (gate: 700,000). The baseline
was 206,367 bytes; enabling serde JSON on WASM accounts for the size tradeoff.
The generated minified `dist/portable/index.node.js` contains a pre-existing
literal whitespace string which `git diff --check` flags after rebundling;
source/Rust/tests/docs whitespace checks pass. Do not trim the literal.

## Remaining milestone 9 work

**Follow-up:** the legacy text vectorizer/tree and MaxEnt SGD/IIS items below
are now implemented by the completion slice in `text-classifiers-rust.md`.
That document records the preserved contracts, differential fixtures, shared
registrations, and unresolved combined artifact/package/inventory gates. The
list below describes the state at the original NB-only slice.

1. Legacy text decision tree and `TextFeatureVectorizer` are still TS algorithms.
   Rust categorical-tree feature mode is not a text/v1 serialization replacement.
2. `src/maxent_sgd.ts` remains TS. Existing native `text_linear` uses batch
   one-vs-rest updates, not the legacy per-document multiclass softmax SGD; a
   dedicated faithful core plus version-1 weight/bias fixtures is still needed.
3. `src/maxent_iis.ts` remains TS. The existing Rust categorical IIS/GIS core
   and feature adapters are available but legacy text logits/encoding/version-2
   snapshots have not been integrated or differentially verified here.
4. Text GIS is not an existing option in `src/maxent.ts`; feature GIS already
   uses Rust. A new text GIS contract needs explicit API/serialization design,
   not an unsupported stub or relabeling existing IIS.
5. Semaphore execution and cross-platform artifact verification remain parent
   integration tasks. This round only executes local checks and creates a local
   commit; it changes no CI configuration and creates no remote artifacts/PRs.
