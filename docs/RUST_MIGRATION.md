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

- Sparse linear, perceptron and Euclidean k-means boundaries validate dimensions,
  offsets, capacities and finite numeric inputs before processing. Dense Rust workspace
  allocations are fallible; generated numeric overflow is rejected. Oversized
  k-means storage leaves its unused tail unchanged instead of panicking. The WASM
  perceptron ABI now receives an explicit weight length; older artifacts must be
  rebuilt. Raw native pointers and fabricated WASM offsets are not made safe by
  these logical buffer checks.
- HMM validates matrix/backtracking dimensions, symbol IDs and log scores while
  preserving valid negative infinity for impossible events. Text training validates
  labels/options before feature building, bounds ngram loops to document length,
  and checks dense-model/output-size arithmetic. Version-pinned differential tests
  cover 120 HMM paths and 60 seeded k-means models with/without empty-cluster
  avoidance. This does not establish invalid-input error-class parity with NLTK.
  Sparse/string/hash allocations
  elsewhere remain targets for further memory hardening.
- Strict Clippy passes for native (including tests) and WASM, and Rust formatting
  is checked. CI now blocks on these checks and Rust unit tests. Native raw-pointer
  functions document buffer alignment, lifetime and nonaliasing requirements;
  pointer-backed handle operations are marked unsafe for Rust callers. This does
  not validate arbitrary C pointers or make stale native handles safe.
- Rust NIST accumulates in NLTK Counter order, including tie-sensitive reference
  lengths; the rebuilt WASM artifact passes the BLEU/NIST differential gate.
- Categorical feature-dictionary Naive Bayes training and prediction run in Rust.
  Its typed adapter preserves feature associations, Unicode/case, Python numeric
  equality, and implicit None training values. Differential coverage includes
  614 probes at four smoothing values. NaN is explicitly unsupported.
- Positive/unlabeled feature Naive Bayes also runs in Rust, with 818 NLTK
  differential probes covering priors, smoothing, zero probabilities, empty groups,
  unseen values, and missing None. It reuses the typed feature marshaler and model
  lifecycle. Invalid priors and lossy maxFeatures truncation are explicitly rejected.
- Feature-dictionary decision trees use lossless Rust categorical stumps, binary
  defaults and entropy/support/depth refinement through `bun_nltk/classify-tree`.
  They match NLTK 3.10.3's last-training-label fallback for unseen branches. Split
  ties use first-seen names/values rather than Python's randomized set order;
  differential tie cases control only upstream candidate ordering. The compatibility
  API retains a one-hot probability extension (NLTK does not implement tree
  probabilities). Legacy text-model constructors remain supported. Depth is bounded
  to 100, nodes to one million; lossy feature truncation is rejected. Formatting,
  explicit feature-value domains and full error-class parity remain unimplemented.
- Node 24, Bun, Chromium, Firefox, and Playwright WebKit run the same WASM model.
  WebKit on Ubuntu 26.04 was verified with locally extracted distribution libraries
  and `BUN_NLTK_WEBKIT_EXECUTABLE`; CI installs Playwright's host dependencies.
- Levenshtein distance and weighted alignment run in Rust over Unicode code points,
  including unrestricted Damerau transpositions, 762 exact differential cases,
  and NLTK's 2,000-code-point input bound. Ordinary distance uses two rows instead
  of a quadratic matrix. Nonfinite substitution costs are explicitly rejected.
- Exact ASCII metrics now stream in WASM with arbitrary byte boundaries and
  explicit token/key capacity limits. A 129 MiB regression verifies two-token
  vocabulary processing with less than 8 MiB of WASM linear memory. Node and
  Chromium/Firefox/WebKit smoke tests exercise the same implementation.
- The current fidelity gate has 43 passing groups and three unsupported integration
  groups. This is fixture coverage, not proof of full NLTK equivalence.

Remaining: feature-dictionary MaxEnt still uses the lossy text adapter;
text classifiers, metrics, parsers, and many modules still need Rust migration.
The root entrypoint still eagerly loads Bun FFI. Full parity, arbitrary-size input
handling, and universal speed/memory improvements have not been established.

Aggregate ASCII metrics use exact keys after a scale workload exposed two bigram
hash collisions. Explicit hash-returning APIs retain their legacy representation.
Corpus BLEU and confusion-matrix APIs now reject mismatched sequence lengths.
See [benchmark methodology](BENCHMARKING.md) for the cold-process scale matrix.
