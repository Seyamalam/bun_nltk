# Rust-first implementation plan

The target is a Rust algorithm core shared by Bun, Node.js, and browsers through
native/WASM backends. TypeScript should own types, runtime loading, and marshaling,
not a second copy of each algorithm. Existing working APIs remain available until
their replacement passes differential tests.

## Acceptance criteria

- TypeScript is checked with the pinned Rust TypeScript 7 compiler (`npx tsrs`)
  and linted with Oxlint. Rust is checked with unit tests and Clippy.
- Every migrated feature has version-pinned NLTK differential fixtures, including
  invalid inputs and errors. Import coverage does not establish behavioral parity.
- Node, Bun, and browser tests exercise the same Rust implementation. Native-only
  integrations and upstream external services must be reported as unsupported
  until implemented and tested, not counted as passing.
- Performance reports retain workload sizes, checksums, matched outputs, runtime
  versions, timings, and peak memory. No universal speed or memory claim follows
  from a single benchmark; small inputs, streaming large inputs, and cold starts
  must be measured separately.
- Security is an ongoing verification process, not a promise that all code is
  vulnerability-free. Untrusted inputs need explicit bounds and validation at
  both the public API and Rust boundary.

## Migration order

1. Modernize tooling and make the existing fidelity gate reproducible on Linux.
2. Fix information-losing classifiers, corpus writes, and inconsistent metrics.
3. Make the shared WASM loader portable and staging memory demand-sized.
4. Move classifier/metric/tokenizer algorithms into Rust with typed adapters and
   preserve versioned-model compatibility.
5. Migrate trained models, parsers, semantics, translation, and corpus processing
   family by family; delete duplicate implementations only after verified parity.
6. Run cross-runtime/browser tests, package smoke tests, dependency audits, and
   a size/memory/latency benchmark matrix before release.

Commit completed, tested units frequently; push after every two commits. Record
remaining unsupported features and failing checks rather than marking the plan
complete before all acceptance criteria are verified.

## Verified progress

- Rust NIST accumulates in NLTK Counter order, including tie-sensitive reference
  lengths; the rebuilt WASM artifact passes the BLEU/NIST differential gate.
- Categorical feature-dictionary Naive Bayes training and prediction run in Rust.
  Its typed adapter preserves feature associations, Unicode/case, Python numeric
  equality, and implicit None training values. Differential coverage includes
  614 probes at four smoothing values. NaN is explicitly unsupported.
- Node 24, Bun, Chromium, Firefox, and Playwright WebKit run the same WASM model.
  WebKit on Ubuntu 26.04 was verified with locally extracted distribution libraries
  and `BUN_NLTK_WEBKIT_EXECUTABLE`; CI installs Playwright's host dependencies.
- The current fidelity gate has 40 passing groups and three unsupported integration
  groups. This is fixture coverage, not proof of full NLTK equivalence.

Remaining: other feature-dictionary classifiers still use the lossy text adapter;
text classifiers, metrics, parsers, and many modules still need Rust migration.
The root entrypoint still eagerly loads Bun FFI. Full parity, arbitrary-size input
handling, and universal speed/memory improvements have not been established.
