# Probability and MaxEnt encoding contracts (milestone 8)

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
