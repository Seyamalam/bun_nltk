# Legacy text classifiers: milestone 9 completion slice

> **Budget update (2026-10-21):** the browser WASM budget is now 1,100,000
> bytes by explicit owner decision. Figures below that compare against the
> former 700,000-byte limit are historical measurements.

`TextFeatureVectorizer`, `DecisionTreeTextClassifier`, legacy MaxEnt SGD (v1),
and legacy text IIS (v2) now use Rust/WASM algorithms. Their public factories,
camelCase APIs, existing snake_case factory aliases, option defaults/clamping,
serialized layouts, and prediction shapes remain intact. No text GIS option was
introduced or substituted for IIS. Feature-dictionary classifiers are untouched.

## Preserved contracts and evidence

- Vectorization uses ASCII letters/digits/apostrophes, lowercase tokens, U+0001
  ngram separators, frequency ranking with code-unit lexical ties, binary/count
  sparse vectors, sorted indices, truncation, and **replacement** fitting.
- Text trees preserve first-seen majority ties, lexically ordered candidates,
  strictly error-improving stumps, and stump selection **before** support/depth
  refinement cutoffs. Refinement uses entropy > 0.05. V1 leaf counts, feature IDs,
  feature names, topology, labels and one-hot prediction order are retained.
- SGD preserves per-document multiclass softmax updates in input order, counted
  features, bias updates, sparse-only L2 updates, natural logits, vocabulary
  ordering, OOV bias scoring, and stable probability ties. It is not the native
  `text_linear` batch/one-vs-rest algorithm.
- IIS preserves first-seen `(word, count, label)` binary encodings, base-2 raw
  logits and weights (not normalized log probabilities), global Newton stopping,
  the long-document overflow-safe initial delta, count-sensitive OOV encoding,
  descending code-unit label ties, and `max(1, epochs - 1)` outer iterations.
  Direct IIS fractional/negative finite epoch behavior is retained; the public
  MaxEnt wrapper continues to normalize epochs to positive integers.
- All four fits/train calls replace prior state. None is an incremental-training
  API. Reloaded models also retrain by replacement; Naive Bayes incremental APIs
  remain as documented in `text-naive-bayes-rust.md`.

`test/fixtures/text_classifiers_405347e.json` is captured from the original TS
algorithms at `405347e`, including their original TS dependencies (not a migrated
vectorizer). Normal regression tests do not require git history. Regenerate only
with `bun test/fixtures/text_classifiers_golden.capture.ts --base`. Fixtures cover
complete vector/tree/weight/bias snapshots, predictions, retraining, prototype-like
labels, Unicode separators, numbers/apostrophes, empty/OOV text, depth/candidate
options, truncation, one-label/empty-feature IIS, fractional/negative direct IIS
epochs, and a 905-feature IIS document. Rust unit tests also load these fixtures.

Comparisons retain exact strings, array order, integer fields, shapes, and full
snapshots. Floating-point outputs use absolute/relative tolerance `2e-12` for
accumulated exp/Newton differences. Bit-exact JS/Rust float parity is not claimed.
Reloads within the new runtime preserve snapshots exactly. Returned snapshots
are detached, including tree nodes (the old tree returned its internal node).

NLTK **3.10.3**, Python **3.14.4**: tests compare IIS feature mappings, complete
weights and probability rows at 2/5/9 epochs, and decision-tree topology and
classifications across three support/depth configurations. Tree candidate order
is explicitly sorted in the oracle; arbitrary Python hash-set tie order is not
claimed. SGD is a project extension, not an NLTK IIS/GIS equivalence claim.

## Typed transport and parent integration

- Core: `rust/src/text_classifiers.rs`.
- ABI: `rust/src/wasm_text_classifiers.rs` exports
  `bunnltk_wasm_text_classifiers`, `_copy`, and `_clear`.
- **Shared registrations:** two module declarations in `rust/src/lib.rs`; three
  export signatures, `textClassifiers(request)` transport, and disposal cleanup
  in `src/wasm.ts`. No package/build/export-map/CI/inventory edits are needed for
  this slice. Existing root bundles include the new TS transport automatically.
- `src/text_classifier_transport.ts` provides discriminated typed overloads;
  legacy text snapshots alone use JSON. Feature dictionaries are never
  stringified/flattened. TS owns API state, option normalization, evaluation,
  detached snapshots, and ICU-dependent `localeCompare` sorting for SGD labels
  and tied vocabulary counts/tree label lists. Token counting, vectorization,
  tree construction/traversal and optimizer/scoring loops are Rust.
- `src/classifier_features.ts` retains its importable helper API but delegates
  counting to Rust, removing the unused duplicate tokenizer/count loop.
- Snapshot validation now rejects malformed dimensions, duplicate vocabulary/
  encoding entries, invalid count/feature IDs, nonfinite weights/options and
  unsupported algorithms instead of undefined/NaN scoring. Valid legacy models
  retain v1/v2 layouts. General invalid-option JS quirks are not promised.

The stateless ABI reparses snapshots on each call, matching the prior text NB
transport's ownership model. This is a Rust migration, **not a speed claim**.
Deep snapshots remain subject to serde JSON's recursion limit. Unpaired UTF-16
surrogate strings are not losslessly supported by serde JSON; normal Unicode
and the ASCII tokenizer's Unicode boundary behavior are covered. Retained Rust
handles/typed binary snapshots and resource limits are future transport work.

Build explicitly from locked Rust source and copy isolated output:

```sh
CARGO_TARGET_DIR=/tmp/opencode/bun-nltk-m9-ff7c1fd7 cargo build --locked --release --target wasm32-unknown-unknown --manifest-path rust/Cargo.toml
cp /tmp/opencode/bun-nltk-m9-ff7c1fd7/wasm32-unknown-unknown/release/bun_nltk.wasm native/bun_nltk.wasm
bun run build:portable
PYTHONPATH=/tmp/opencode/bun-nltk-oracle bun test ./test
```

The existing `build:wasm` script ignores external Cargo target output. The local
source/tests/docs commit intentionally excludes generated WASM/portable files;
the parent must rebuild its final combined artifact after integration.

## Validation and unfinished integration gates

- Focused Bun tests: **9 pass**, full tree/vector/SGD/IIS fixture comparison,
  NLTK differential checks, ABI errors/disposal, aliases and packaged Node root.
- Rust: **104 pass**, including direct frozen vectorizer/tree/SGD/IIS/long-IIS
  core tests. Builds/tests use `--locked` and worktree-isolated targets.
- Full Bun suite: first run **573 pass / 2 fail**; final run **572 pass / 3 fail**
  includes an unrelated 5-second NLTK-model timeout during concurrent Rust tests
  (that file subsequently passes alone: **3 pass**). Existing inventory fails on the stale
  `TreebankWordTokenizer` signature anchor and pre-existing export discovery
  drift. Inventory is parent-owned and unchanged here.
- Full tsrs, portable tsrs/build, and full Oxlint pass (pre-existing warnings).
  Full tsrs needs `bun install --frozen-lockfile` in `examples/js-library` for its
  declared `file:../..` example dependency, as well as the root install.
- WASM gate **fails**: parent `169d004` artifact is already **1,345,655 bytes**;
  this slice's combined artifact is **1,612,807 bytes**, versus **700,000**.
  No threshold was changed, no isolated smaller artifact replaces the combined
  build, and no size-pass claim is made.
- Package gate **fails**: local combined portable/native package is
  **14,624,196 bytes**, versus **13,000,000 bytes**. File count **316 / 400** passes;
  both gates are unchanged.
  Parent must resolve combined size budgets and regenerate the Python 3.14.4
  compatibility inventory; this slice does not edit those shared files.
- Cross-platform artifact checks, Semaphore, final package budgets and shared
  inventory updates remain parent integration tasks. No remote settings, push,
  PR, or delegation is performed.
