# Handwritten source and generated-output hygiene

The 600-line guard and its existing shrinking legacy list remain unchanged in
scope for handwritten algorithms. No new legacy exception was added. Parsing is
split into Tree operations/formatting, typed CFG syntax/coverage, and the packed
Earley chart/forest. Categorical maxent's row validation/encoding/stopping policy
is a private child module; IIS/GIS updates and its public API are unchanged.
Tokenizer unit tests are a separate child module, not a source-limit exception.

`scripts/loc-guard.sh` runs `scripts/audit-generated.ts` **before** skipping the
following exact generator-owned outputs:

- `rust/src/tokenizer_unicode.rs`: only Unicode range constants. Python 3.14.4,
  Unicode 16.0.0 and regex 2026.9.29 are enforced by
  `scripts/generate-tokenizer-unicode.py --check`; its complete output must match.
- `rust/src/compat_unicode_data.rs`: range and lowercase-mapping constants only.
  `scripts/export-compat-unicode.py --check` enforces the same Python/Unicode/regex
  pins and the existing SHA256-locked Unicode 16 DerivedCoreProperties download.
  Lowercase lookups and predicates remain in the handwritten, LOC-checked
  `rust/src/compat_unicode.rs`. A mismatched cached UCD file is rejected, not used.
- `dist/portable/**/*.d.ts` (including root declarations): emitted/linked by the
  frozen tsrs/Rollup toolchain in `scripts/build-portable.ts`. The audit parses
  them with TypeScript and rejects runtime bodies, nonliteral initializers, static blocks
  and expression statements. CI's portable lane then rebuilds and requires
  `git diff --exit-code -- dist/portable`; installed-package type checks verify
  consumers and negative assertions. Renaming handwritten source to `.d.ts`
  outside this build-owned directory does not gain an exception.
  Ambient constant literal initializers emitted by the compiler (string/number/
  boolean/bigint and signed numeric literals) are permitted; calls, property
  access, arrays and object construction are not.

Unicode checks are byte-for-byte generator audits, not Unicode parity claims.
Declaration shape checks alone do not establish provenance: regeneration and
consumer checks are required as well. Existing `_data` exceptions are not widened.
The generator scripts and handwritten lookup/API code themselves remain guarded.
Regeneration does not authorize increasing the 700,000-byte WASM or
400-file/13,000,000-byte unpacked package budgets.

## Integration boundaries

The parent owns shared export/WASM registration, portable generation, inventory
refresh and migration-document integration. The split keeps `parsing::*` and
categorical maxent's public paths stable, but concurrent edits to
`rust/src/parsing.rs`, `rust/src/categorical_maxent.rs`, tokenizer tests, Unicode
generators, the CI scripts and this doc can conflict. Reapply algorithm changes
to their new cohesive modules rather than restoring a monolithic file. The
Unicode-data split changes helper binary layout: rebuild/check the embedded
`src/data/nltk-compat-wasm.ts` only after parent integration. Never accept a stale
embedded helper as source parity. No TS algorithm or alias is removed here.
