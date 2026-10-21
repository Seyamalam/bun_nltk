# Probability and MaxEnt encoding contracts (milestone 8)

## Remainder implementation (based on parent `169d004`)

The first slice (`79af67a`, integrated as `7a763c9`) is extended here. This
remainder commits source/tests/docs only; the parent owns artifact regeneration,
shared exports, inventory evidence, and package/build integration.

### Rust algorithms and custom classifier integration

- Existing Dictionary normalization, probability/log conversions, MLE, Lidstone,
  Laplace, ELE, Witten–Bell, Simple Good–Turing regression/switch/renormalization,
  Uniform probability calculation, Mutable conversions/max selection, add/sum
  logs, entropy, and the existing logLikelihood extension now execute in Rust.
  TS retains keys, collections, callbacks, accessors and marshaling.
- Simple Good–Turing freezes fitted parameters but reads live external counts,
  total and count-of-counts on each query. MLE is live. Lidstone/Witten–Bell
  freeze their constructor totals but read live sample counts. These behaviors
  are exercised against NLTK, including mutation that makes probabilities cease
  summing to one.
- `RustMaxentClassifier.train(..., { encoding })` accepts the existing concrete
  Binary/Typed encodings. Weighted IIS and GIS share `categorical_maxent.rs`'s
  optimizer with the default categorical classifier; IIS groups vectors by the
  **sum of feature values**, not the number of ids. Empirical/model expectations
  and logits multiply by those values. Typed int/float/bool quirks, always-on,
  unseen, cutoff shared across labels, and constructor feature ids persist.
- GIS **still requires an encoding `C` property**. Supplying finite nonzero `C`
  on a Binary/Typed encoding follows NLTK's custom-encoding GIS path; it does not
  silently append a correction feature or enforce constant-sum vectors. This
  slice does not add `GISEncoding` or support arbitrary overridden `encode`
  functions (they are explicitly rejected because the JSON format cannot
  preserve them). Default categorical GIS continues using its correction feature.
- Custom models serialize as version 2 with tagged int/float/bool/None mapping
  values and the string `"-Infinity"` for unattested weights. Version 1 default
  models retain their existing format and validation. NaN/+Infinity weights are
  not accepted as serialized models. Caller-supplied encodings remain
  caller-owned and live; loaded encodings are disposed with their classifier.
- Direct and compatibility MaxEnt APIs expose camelCase/snake_case probability
  and batch methods. Compatibility probability output retains Rust's base-2
  logs instead of re-normalizing exponentiated scores in TS. Custom informative
  feature *records* are explicitly unsupported; use `weights()` and the supplied
  encoding's `describe(id)` rather than fabricated empty field values.

### Differential evidence and deliberate API boundaries

`test/custom_maxent.test.ts` covers 48 Binary/Typed x IIS/GIS x 1/5/20 iteration x
0/2 cutoff x always-on configurations, unseen probes, int/integral-float/float,
bool, None, zero and negative prediction values, weight/encoding/prob/logprob
comparisons and exact JSON roundtrips. Unseen ids are compared by descriptions.
The installed oracle is **NLTK 3.10.3 / Python 3.14.4**. Its NumPy 2 environment
lacks `numpy.NINF`; the test restores only that removed constant to `-numpy.inf`
so NLTK's unattested-feature algorithm can execute. It does not patch algorithms.
NLTK's NaN predictions from `0 * -Infinity` are preserved and compared, not
silently sanitized. Nonconvergent training producing NaN/+Infinity weights is
still rejected by the existing Rust optimizer; arbitrary negative/zero-only
weighted training spaces are not certified by this slice.

`test/probability_rust.test.ts` covers distribution probabilities/logs, fitting,
discounts, snapshot copying, external count mutation, Dictionary key equality,
Uniform duplicates and frozen membership under exposed sample-list mutation,
Mutable duplicate samples/default-log updates/unknown-sample rejection/index-
based `max`/live sample-list mutation, helper math and constructor/domain errors.
Validated NLTK corrections include the `-1e300` zero/missing log sentinel,
Witten–Bell's zero-unseen-bin division error, Uniform deduplication, entropy's
zero-probability domain error, and Mutable's default `log=true` and index-based
`max` (not probability-based). These are intentional behavior corrections with
oracle tests, not claims that every generic Python object/exception is supported.

Preserved extensions/gaps:

- Dictionary `max` still resolves ties by insertion order because existing
  classifier adapters depend on it; NLTK instead compares tied sample objects.
  Arbitrary object keys retain the historical structural-key extension.
- `logLikelihood`/`log_likelihood` retains the existing samples()-based API,
  skips nonpositive actual probabilities and clamps test zeros. NLTK's function
  iterates normally non-iterable ProbDistI instances and cannot replace this
  published TS extension without an API decision. It is migrated, not certified
  as identical to NLTK's broken/default iteration contract.
- FreqDist's existing count-sorted keys and separate bool/number keys are outside
  this ownership scope; distribution sample ordering and Python-equivalent
  external FreqDist keys are not fixed. Dictionary/Uniform/Mutable key interning
  does merge Python-equivalent bool/number and null/undefined values.
- Empty Good–Turing retains the prior TS fitted defaults. NLTK lacks fitted
  attributes for empty inputs, so its subsequent smoothing/discount/mutation
  errors are not parity-certified. Warning emission and public fit/check methods,
  ProbDistI.generate, arbitrary Python objects, high-precision integers, and all
  exception classes/messages remain gaps. Previous Heldout/CrossValidation/
  Kneser–Ney external-mutation gaps below remain unchanged.

### Parent integration registrations and validation

No changes to `rust/src/lib.rs`, `src/wasm.ts`, `index.ts`, package metadata or
build scripts are required for the Rust ABI: the already-registered
`bunnltk_wasm_probability_contract` now dispatches ops 20 (weighted training),
21 (prediction), 22 (weights), 23 (load), 30 (numeric probability operations).
The original dedicated runtime handles buffers, status errors and disposal.

Parent follow-up registrations:

1. Rebuild combined WASM with `--locked` in a unique target directory and
   explicitly copy `<CARGO_TARGET_DIR>/wasm32-unknown-unknown/release/bun_nltk.wasm`
   to `native/bun_nltk.wasm`; `scripts/build-wasm.ts` still copies its fixed
   `rust/target` path and omits `--locked`. Do not cherry-pick this worktree's
   uncommitted binary.
2. Root probability alias re-exports (`add_logs`, `sum_logs`, `log_likelihood`)
   are optional shared registration work; aliases already exist in the owning
   `src/probability.ts`. New serialized types are exported from
   `src/feature_maxent.ts`; its dependent types are re-exported there and from
   `src/classifier_compat.ts` to satisfy the declaration bundler without shared
   root edits.
3. The Node **root bundle** rebuild and custom MaxEnt JSON smoke pass.
   `./classify-maxent`'s standalone generated JS now imports
   `maxent_feature_encoding.js`, `probability_abi.js`, and `probability.js` which
   are not in the build script's standalone module list; resolve their transitive
   runtime imports (or bundle the subpath). Browser custom high-level loading is
   not integrated. Rebuilt root declarations also reproduce unrelated metrics
   type imprecision in `test/metrics_types.ts`; retain precise shared generics.
4. Regenerate integration-owned compatibility inventory anchors/discovery rather
   than treating new import/export discovery as behavioral proof.

Validation of this remainder:

- Locked isolated Rust tests: **100 pass** (parent 98).
- Focused probability/MaxEnt tests: **30 pass**, 0 failures, **14,681 assertions**.
- Full `PYTHONPATH=/tmp/opencode/bun-nltk-oracle bun test --timeout 30000 ./test`:
  **570 pass, 2 fail**. Both remaining failures are integration-owned stale
  Treebank signature anchors and stale Bun export-discovery snapshot. No test
  is removed/skipped to hide those failures. A parallel-build run hit benchmark
  timeouts; a later quota-exhausted run hit EDQUOT. After cleaning only this
  agent's isolated Cargo dev artifacts, the final full run has only the two
  inventory failures.
- tsrs whole-project typecheck: pass with checked-in portable declarations.
  Rebuilding portable declarations succeeds but causes unrelated metrics type
  assertions to fail; generated outputs were not committed.
- Changed files Oxlint: no warnings/errors. Whole-repo Oxlint exits successfully
  with existing unrelated warnings. `git diff --check`: pass.
- Fresh locked combined WASM: **1,369,545 bytes**, versus parent committed
  **1,345,655 bytes**. Both exceed the unchanged **700,000**-byte gate; blocker
  remains parent-owned, not weakened here.
- Package gate with checked-in portable outputs plus freshly built WASM:
  **14,403,911 bytes**, exceeding unchanged **13,000,000**-byte limit. The
  regenerated-output gate also fails at **14,114,530 bytes**. No package-size
  threshold or file-count threshold was raised.

The sections below record the first slice; its two "explicitly unfinished"
items for existing probability algorithms and custom classifier integration are
superseded **only within the tested boundaries above**.

## Implemented and behaviorally tested

- Rust `HeldoutProbDist`: count-class estimates, unseen bins, NLTK's `None`
  result represented as `null`, base/heldout accessors, samples, log probabilities,
  constructor errors, live base count-class lookup with frozen estimates.
- Rust `CrossValidationProbDist`: ordered heldout pairs, repeated-object identity
  exclusion, average probabilities, samples, deferred no-pairs/None errors.
  **NLTK 3.10.3 makes this class abstract** (it does not implement `max`). The TS
  class is also abstract; subclass and implement `max` to use the estimates.
- Rust trigram `KneserNeyProbDist`: observed/backoff/unseen probabilities,
  log probabilities, discount updates, cached-probability behavior, samples and
  empty input. `set_discount` intentionally leaves cached probabilities unchanged,
  as NLTK does. Dispose instances after use.
- Rust standalone `BinaryMaxentFeatureEncoding` and
  `TypedMaxentFeatureEncoding`: constructor ids, train-time count cutoff shared
  across labels, encode, descriptions, labels/length, always-on/unseen features,
  numeric/None equality, typed bool behavior, int/float separation and empty spaces.
  Use `pythonFloat(1)` to represent Python `1.0`; plain integral JS numbers mean
  Python ints. Constructor mapping type keys use `PYTHON_INT`, `PYTHON_FLOAT` and
  `PYTHON_BOOL`. Dispose instances after use.
- `DictionaryConditionalProbDist` dictionary/missing-condition contract.
  `ConditionalProbDist` now preserves callback exceptions (does not retry them as
  constructors), merges Python-equivalent conditions, and has typed factory args.

The new differential tests execute the installed **NLTK 3.10.3** oracle rather
than treating imports or wrappers as parity evidence. Unseen feature ids depend
on Python hash-set iteration; those features are compared by semantic description,
not an arbitrary Python process's hash order. Constructor-supplied ids remain exact.

## Integration

New Rust modules: `probability_contracts`, `maxent_encoding`, and
`wasm_probability_contracts`. The single new WASM export is
`bunnltk_wasm_probability_contract`; typed f64 buffers carry interned ids, values,
and explicit status codes. `NaN` in successful estimate output means Python None.
Arithmetic and feature selection live in Rust. TS handles validation, interning,
marshaling, descriptions and API methods. The dedicated runtime loads the built
WASM artifact independently; it does not modify `src/wasm.ts`.

Package-root exports are added in `index.ts`. `scripts/build-portable.ts` adds
precise declaration re-exports for these names rather than new broad `any`
facades. The Node portable bundle and WASM artifact must be regenerated after
cherry-picking; do not cherry-pick competing binary build results from other
milestones. `rust/src/categorical_maxent.rs` and existing model serialization
formats are unchanged. Existing IIS/GIS classifier differential tests still run.

## Explicitly unfinished

1. **Custom encoding classifier training is not integrated.** Passing `encoding`
   to `RustMaxentClassifier.train` throws instead of silently using its default.
   Weighted typed IIS/GIS training, custom binary always-on/unseen training,
   custom-encoding prediction and serialized model formats need a separate
   integration with the classifier engine and differential train/prob/logprob tests.
2. Existing distributions (Dictionary/MLE/Lidstone/WittenBell/GoodTuring/etc.) and
   information-theory helpers remain their existing TS implementations. This round
   does not certify complete NLTK parity or Rust migration for that family.
   General `ProbDistI.generate` and other unimplemented contracts remain.
3. Cross-validation probabilities are precomputed from construction snapshots;
   mutating its input FreqDists afterward is not covered. Kneser–Ney similarly
   retains construction counts; NLTK's partially-live external-FreqDist mutation
   quirks are not covered. Explicit zero/negative/fractional FreqDist counts are
   outside this ABI's nonnegative integral count contract (the existing TS
   FreqDist drops zero-count entries). Arbitrary Python hashable objects, NaN keys,
   nonfinite features/discounts, unrestricted Python integer precision, Python
   numeric repr edge cases, duplicate labels with always-on features, and every
   Python exception class/message are not certified. Python None maps to null or
   undefined; bool and equal numeric values share keys in the new distributions.
4. New high-level APIs are Bun/Node synchronous loaders, not browser entrypoint
   APIs. Browser injection into the dedicated runtime/high-level objects and a
   fully precise generated declaration bundle (rather than shipped TS type
   re-exports) remain packaging work.

No new dependencies were added. Existing Cargo serde dependencies are exact-pinned
to lockfile versions; JS tooling already uses exact pins. Build with `--locked`
and a unique `CARGO_TARGET_DIR` to avoid other agents' rebuild collisions.

Oracle code was available at `/tmp/opencode/bun-nltk-oracle`, version 3.10.3.
Punkt, WordNet, NE-chunker and averaged-perceptron data were not present in the
oracle data search path; these milestone tests do not require those datasets.

## Validation in the isolated milestone worktree

- `PYTHONPATH=/tmp/opencode/bun-nltk-oracle bun test ./test`: **511 pass**, no failures
  (baseline 498, including 13 new tests; existing MaxEnt serialization tests pass).
- `CARGO_TARGET_DIR=/tmp/opencode/bun-nltk-m8-c7ccd862 cargo test --locked --manifest-path rust/Cargo.toml`:
  **68 pass**, no failures (baseline 62).
- Locked `wasm32-unknown-unknown` release build in a separate unique target dir.
- `npx --no-install tsrs -p tsconfig.json --noEmit`: pass. Run frozen dependency
  installation in both root and `examples/js-library` before the whole-project
  typecheck; the example requires its `bun_nltk` local file dependency.
- Oxlint: new/changed modules pass without warnings. Whole-repo Oxlint exits
  successfully with pre-existing warnings in unrelated modules.
- `bun run build:portable`: pass; Node portable probability and encoding behavior
  smoke passes. This smoke is packaging validation, not Python behavioral parity.
