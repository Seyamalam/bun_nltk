# bun_nltk

Rust-first NLP for Bun, Node.js, and browsers. Migrated algorithms live in Rust
behind a shared native/WASM core; TypeScript provides the typed API, loading,
marshaling, and remaining legacy algorithms. The target is Python NLTK 3.10.3.

![module surfaces 241/241](https://img.shields.io/badge/module_surfaces-241%2F241-blue)
![fidelity 43 passed](https://img.shields.io/badge/fidelity-43_passed-blue)
![version 1.0.0](https://img.shields.io/badge/version-1.0.0-blue)

## Status

- **241 of 241 public `nltk.*` module names** have TypeScript surfaces — 46/46
  families. The [parity checklist](docs/PARITY_CHECKLIST.md) diffs the
  [NLTK API index](https://www.nltk.org/api/nltk.html) against this repo.
  Importable surfaces include partial implementations and shims; this is not a
  behavioral-parity percentage. Regenerate with `bun run parity:checklist`.
- The fidelity gate reports **43 passed, 0 failed, 0 skipped, and 3 unsupported**
  of 46 groups in the current Linux x64 run (Bun 1.4.2, Python 3.14.4,
   NLTK 3.10.3, 2026-10-21). Missing required fixtures fail the gate; unsupported
  GUI, Java, and network integrations are reported separately and never counted
  as passed.
- The integrated Rust crate passes **112 tests**, plus **4 compatibility-crate
  tests**. The Bun suite has **601 passes and 1 failure**: the shipped WASM is
  **1,055,427 bytes** against the unchanged 700,000-byte gate.
- The package gate passes at **12,894,700 unpacked bytes** across **316 files**
  (limits: 13,000,000 bytes / 400 files). NE chunker models ship as Brotli.
- The WASM gate is the remaining release blocker. Exact float round-tripping
  (required for model snapshots) already consumes most of the old margin, and
  the recovered Punkt training, regexp tokenizer, Tree/PCFG, and legacy text
  classifier kernels add the rest. No gate is relaxed or bypassed.
- [Semaphore pipelines](docs/semaphore-ci.md) are prepared, not activated.
  Account authorization and a genuine Windows self-hosted runner remain required.
- Passing fixtures establishes agreement for those cases and tolerances, not
  complete NLTK equivalence. See [behavioral validation](docs/BEHAVIORAL_PARITY.md).

The full NLTK 3.10.3 VADER lexicon, trained English Punkt parameters, and binary /
multiclass named-entity models are bundled. `bun run bench:parity:nltk-models`
checks all four VADER fields, Treebank/WordPunct tokens, Punkt boundaries and
training parameters, and NE IOB labels against versioned Python outputs.

## Install

```bash
bun add bun_nltk
# or
npm install bun_nltk
```

The root entry point resolves per runtime. Bun uses the Rust FFI library; Node.js
24+ uses a bundled root where WASM-backed APIs work and native-only calls throw a
descriptive error; browsers use a bundled WASM/tokenization root. The `wasm`,
`classify-features`, `classify-tree`, `classify-maxent`, and `parse` subpaths also ship
plain JavaScript and TypeScript declarations for Node.js 24+ and browsers. Root
Node/browser declarations are source-derived and precisely typed, not root-wide
`any` facades. The curated browser surface is intentionally smaller than Node's.

### Quick start (Bun)

```ts
import { countTokensAscii, sentenceTokenizePunkt } from "bun_nltk";

console.log(countTokensAscii("Hello world"));        // 2
console.log(sentenceTokenizePunkt("One. Two!"));      // ["One.", "Two!"]
```

### Portable WASM (Node, Bun, browsers)

```ts
import { WasmNltk } from "bun_nltk/wasm";

const nltk = await WasmNltk.init(); // Node/Bun: packaged artifact
// Browser: WasmNltk.init({ wasmUrl: "/bun_nltk.wasm" })
try {
  console.log(nltk.tokenizeAscii("Hello world"));
} finally {
  nltk.dispose();
}
```

Run `node examples/portable-wasm.ts` or `bun examples/portable-wasm.ts`.
`bun run verify:portable` exercises the same wrapper in Chromium, Firefox,
WebKit, and Node after `bunx playwright install chromium firefox webkit`.
These checks cover the exposed WASM algorithms, not every NLTK module.

To verify the published package shape from a clean tarball:

```bash
bun run build:portable
bun pm pack --destination /tmp/opencode
bun run verify:packaged-portable /tmp/opencode/bun_nltk-1.0.0.tgz
```

This installs with npm and Bun, runs Node/Bun execution checks, and type-checks
the installed declarations with `tsrs`.

### Focused entry points

Use focused imports when the root compatibility barrel is unnecessary:

```ts
import { tokenizeAscii } from "bun_nltk/tokenize";
import { KMeansClusterer } from "bun_nltk/cluster";
import { loadWordNetPacked } from "bun_nltk/wordnet";
```

Other entry points: `bun_nltk/native`, `bun_nltk/wasm`, `bun_nltk/reference`,
`bun_nltk/classify`, `bun_nltk/classify-features`, `bun_nltk/classify-tree`,
`bun_nltk/linear-models`, and `bun_nltk/metrics`.

## What is implemented

| Area | Highlights |
|---|---|
| Tokens & metrics | ASCII token/ngram/unique counts, exact aggregate keys, streaming metrics, PMI collocations, `FreqDist`/`ConditionalFreqDist`, SIMD fast path |
| Tokenizers | Punkt (train + bundled model), Treebank, WordPunct, Toktok, MWE, Tweet, NIST, casual, S-expression |
| Classification | Feature-dictionary Naive Bayes, positive NB, decision trees, and lossless MaxEnt in Rust/WASM; text NB, DT, MaxEnt, Perceptron, logistic/linear SVM, conditional exponential |
| Tagging | Perceptron, Brill TBL, HMM, TnT, CRF; regex/heuristic POS baseline |
| Stemming | Porter, Snowball (12+ languages), Lancaster, Regexp, RSLP, Cistem, ISRI, ARLSTem, WordNet lemmatizer |
| Parsing & chunking | CFG, Earley, left-corner, feature chart/Earley, recursive descent, PCFG, dependency; regexp/named-entity chunking |
| Semantics & translation | First-order logic, DRT, Glue semantics, model evaluation; BLEU, NIST, chrF, GLEU, RIBES, METEOR, IBM models |
| Corpora & WordNet | Corpus reader framework, ConLL/Brown readers, mini and packed WordNet, sense keys, graph similarity |
| Infrastructure | Shared native/WASM ABI, browser wrapper with memory reuse, portable packaging, Docker, release checks |

A “real port” in the [API reference](docs/API.md) means TypeScript/Rust logic
with a tested behavioral scope that varies by module. **Shims** expose an
importable API but throw a descriptive error for GUI, network, or Java
dependencies (`app`, `draw`, `twitter`, chatbot demos). They count toward import
coverage only.

## Behavioral validation

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install nltk==3.10.3 numpy scipy
bun install --frozen-lockfile
bun run fixtures:import:nltk
bun run fidelity:gate
```

The gate writes `artifacts/fidelity-report.json` before returning nonzero for a
required failure or skip. Prediction checks require exact label agreement;
numeric checks state explicit tolerances. `bun run bench:parity:all` runs the
per-family parity harnesses; `bun run bench:parity:nltk-models` runs the bundled
model checks without Python. See [behavioral parity](docs/BEHAVIORAL_PARITY.md)
and [model provenance](THIRD_PARTY_NOTICES.md).

## Benchmarks

Retained evidence is workload-specific; it is not a universal speed or memory
claim. The maintained methodology, raw artifacts, and caveats are in
[docs/BENCHMARKING.md](docs/BENCHMARKING.md).

| Workload | Result | Evidence |
|---|---|---|
| Native token counting, 1.3 MB / 225k tokens | 1.67 ms native vs 16.83 ms TypeScript median (10.06×; 95% CI 7.74–12.94×) | `artifacts/native-host-linux-x64.json` |
| 1 GiB bounded-vocabulary ASCII stream | Bun WASM 11.73 s / 45.72 MiB RSS vs NLTK 119.00 s / 81.02 MiB; Node WASM 11.63 s / 81.82 MiB | `artifacts/large-stream-scale-matrix.json` |
| Feature decision tree, 12,000 training rows | Train: 28.71 ms Bun, 24.22 ms Node, 73.41 ms Python. Predict 3,000: 5.63 / 6.35 / 0.30 ms. Peak RSS: 69.42 / 91.35 / 59.63 MiB | `artifacts/feature-tree-benchmark.json` |

The 1 GiB stream uses a repeated bounded vocabulary; native streaming also
computes conditional tags, so the operations are similar but not identical.
The feature-tree workload is balanced and low-cardinality, and prediction
marshaling plus RSS remain optimization targets. Small native cases can be
slower than TypeScript.

Reproduce the main suites:

```bash
bun run bench:compare:feature-tree   # NLTK feature decision tree
bun run bench:scale                  # 1 KiB → 1 GiB scale matrix
bun run bench:compare                # legacy token/ngram diagnostics
bun run bench:gate                   # regression + SLA + parity gate
```

Additional `bench:compare:*` commands cover tokenizers, stemmers, taggers,
parsers, classifiers, language models, WordNet, and streaming distributions.
See `package.json` for the full list.

## Validate on a real Linux, Windows, or macOS host

Release binaries are committed, so testers do not need a compiler toolchain.

```bash
# Linux x64
bash scripts/verify-linux.sh
```

```powershell
# Windows x64
.\scripts\verify-windows.cmd
```

On macOS arm64, run `bun run verify:native-host -- --rounds 7` after
`bun run build:rust`. Each validator tests the native library, compares native
Rust with the TypeScript fallback on the same machine where applicable, installs
and runs the packed tarball, and writes a JSON report under `artifacts/`. The
current 7-round Linux run passed on 2026-10-21 and is retained as
`artifacts/native-host-linux-x64.json`. The manual **Native artifacts** GitHub
Actions workflow builds and validates the macOS arm64, Linux x64, and Windows x64
libraries on their native runners; download those artifacts and commit them
under `native/prebuilt/` when refreshing release binaries. See the
[native-host guide](docs/NATIVE_HOST_VALIDATION.md) for Bun installation and the
15-round paper run.

## Build

```bash
bun run build:rust      # native library for this host
bun run build:wasm      # native/bun_nltk.wasm
bun run build:portable  # dist/portable JS + declarations
bun run build:prebuilt  # all committed platform binaries (macOS host)
```

Portable entry points grow WASM input staging on demand instead of reserving
128 MiB at startup. The WASM batch APIs still enforce an input-byte limit;
exact streaming metrics accept larger corpora in chunks. Node and browser root
bundles are produced by `bun run build:portable`; native-only calls still require
Bun.

### Classifiers in Rust/WASM

```ts
import { WasmNltk } from "bun_nltk/wasm";
import { RustNaiveBayesClassifier } from "bun_nltk/classify-features";

const runtime = await WasmNltk.init();
const classifier = RustNaiveBayesClassifier.train(runtime, [
  [{ color: "red", shape: "round" }, "apple"],
  [{ color: "yellow", shape: "long" }, "banana"],
]);
try {
  console.log(classifier.classify({ color: "red", shape: "round" }));
} finally {
  classifier.dispose();
  runtime.dispose();
}
```

Feature names and string values remain case-sensitive. `null`/`undefined` map
to NLTK’s `None`; booleans match equal numeric values as in Python. NaN feature
values are rejected. The synchronous Bun `NaiveBayesClassifier.train` API uses
the same Rust model; call `dispose()` when finished. See
[`examples/feature-classifier.ts`](examples/feature-classifier.ts).

Positive/unlabeled training and feature-dictionary decision trees use the same
typed encoding:

```ts
import { RustPositiveNaiveBayesClassifier } from "bun_nltk/classify-features";
import { RustDecisionTreeClassifier } from "bun_nltk/classify-tree";

const positive = RustPositiveNaiveBayesClassifier.train(runtime,
  [{ color: "red" }], [{ color: "red" }, { color: "blue" }],
  { positivePrior: 0.5 });
const tree = RustDecisionTreeClassifier.train(runtime, [
  [{ color: "Red" }, "upper"], [{ color: "red" }, "lower"],
]);
try {
  console.log(positive.classify({ color: "red" }));
  console.log(tree.classifyMany([{ color: "Red" }, { color: "red" }, {}]));
} finally {
  positive.dispose();
  tree.dispose();
}
```

Priors must be finite and in `[0, 1)`; zero is supported. Tree split ties use
first-seen feature/value order, unseen branches match NLTK 3.10.3’s
last-training-label fallback, depth is bounded to 100, and lossy feature
truncation is rejected. See [`examples/js-library/feature-tree.ts`](examples/js-library/feature-tree.ts).

Feature-dictionary maximum entropy is lossless and Rust-backed. It uses NLTK's
`BinaryMaxentFeatureEncoding`, IIS or GIS training, the same cutoff semantics,
label ordering, typed values, and serialization:

```ts
import { RustMaxentClassifier } from "bun_nltk/classify-maxent";

const maxent = RustMaxentClassifier.train(runtime, [
  [{ color: "red", shape: "round" }, "apple"],
  [{ color: "yellow", shape: "long" }, "banana"],
], { algorithm: "iis", maxIter: 100 });
try {
  const rows = maxent.predict({ color: "red", shape: "round" });
  console.log(maxent.classify({ color: "red", shape: "round" }), rows[0]?.probability);
  const restored = RustMaxentClassifier.fromJSON(runtime, maxent.toJSON());
  restored.dispose();
} finally {
  maxent.dispose();
}
```

`MaxentClassifier.train` uses the same Rust model by default. Its legacy text
options (`epochs`, `learningRate`, `l2`, `maxFeatures`, or `algorithm: "sgd"`)
continue to select the older text adapter. NLTK accepts `count_cutoff` but its
default encoding ignores it; the Rust model matches that behavior.

`WasmNltk.editDistance` and `editDistanceAlign` share the Rust Unicode
implementation with the synchronous metric APIs, including unrestricted Damerau
transpositions and NLTK’s 2,000-code-point input bound. Ordinary distance uses
linear auxiliary memory; transpositions and alignment still use a quadratic
matrix.

### Streaming large inputs

`WasmNltk.createAsciiMetricsStream(n)` accepts `Uint8Array` chunks without
keeping the whole corpus in memory. Token boundaries may cross chunks; `finish()`
counts the final token and closes the stream.

```ts
const stream = runtime.createAsciiMetricsStream(2);
try {
  stream.update(new TextEncoder().encode("hel"));
  stream.update(new TextEncoder().encode("lo world hello"));
  console.log(stream.finish()); // 3 tokens, 2 unique tokens, 2 unique bigrams
} finally {
  stream.dispose();
}
```

Each chunk obeys the runtime input-byte limit; the corpus may exceed it.
Streaming orders are bounded to 1–64; tokens default to 1 MiB each and distinct
token/ngram keys to one million each, configurable with `maxTokenBytes`,
`maxUniqueTokens`, and `maxUniqueNgrams`. Memory grows with vocabulary and
distinct n-grams. Capacity failures invalidate the stream instead of returning
partial success. See [`examples/streaming-metrics.ts`](examples/streaming-metrics.ts).

## Tests and hygiene

```bash
bun install --frozen-lockfile
bun run test          # TypeScript suite
bun run typecheck     # npx --no-install tsrs
bun run lint          # Oxlint
```

Rust checks:

```bash
cargo test --locked --manifest-path rust/Cargo.toml
cargo clippy --locked --manifest-path rust/Cargo.toml --all-targets -- -D warnings
cargo fmt --manifest-path rust/Cargo.toml --check
```

Additional checks:

```bash
bun run native:artifacts:check
bun run package:size:check
bun run wasm:size:check
bun run release:check
bash scripts/loc-guard.sh 600
```

The npm package currently contains 265 files / 12,247,492 unpacked bytes, below
the 400-file and 13 MB limits. The LOC guard rejects non-grandfathered `.ts` and
`.rs` files above 600 lines.

## Environment

See [`.env.example`](.env.example) for the annotated list.

| Variable | Purpose | Default |
|---|---|---|
| `BUN_NLTK_NATIVE_LIB` | Path to a compiled Rust native library | prebuilt path under `native/` |
| `BUN_NLTK_CARGO_BIN` | `cargo` binary for build scripts | `cargo` on `PATH` |
| `BUN_NLTK_WORDNET_PATH` | WordNet data directory overriding the bundled corpus | bundled mini corpus |
| `BENCH_TREND_MAX_REGRESSION_PCT` | Maximum regression for bench trend checks | repo default |
| `GIT_TAG` | Tag injected into release builds | set by release tooling |

## Docker

```bash
docker compose run --rm test     # full test suite in a container
docker compose run --rm verify   # typecheck + tests
```

Or directly:

```bash
docker build -t bun_nltk . && docker run --rm bun_nltk
```

## Limitations

- The root entry point is importable on Node.js and browsers, but native-only
  APIs still require Bun. The browser root exposes the Rust/WASM classifiers plus
  tokenization, sentence splitting, Punkt, and reference metrics; it is not the
  full native API surface. Use the `wasm` and classifier subpaths for portable
  code.
- Committed native binaries cover `darwin-arm64`, `linux-x64`, and `win32-x64`.
  The Linux x64 binary and WASM artifact were rebuilt and validated on this host;
  the macOS and Windows binaries were not rebuilt in the latest Linux run.
- No implicit fallback to a locally built native library exists. Set
  `BUN_NLTK_NATIVE_LIB` for development; there are no install-time scripts.
- GUI, external Java integrations, and credential-dependent network services are
  shims that throw descriptive errors.
- MaxEnt supports NLTK's default binary encoding with IIS and GIS. Custom
  `encoding=` objects, `explicit`/`bernoulli` encodings, and exact Python
  formatting of `most_informative_features` are not exposed. Very large feature
  sets remain bounded by WASM memory.
- WASM batch inputs are capped at 128 MiB. Streaming supports large ASCII
  aggregates, not every large-input API.
- Raw native pointers and fabricated WASM offsets are outside the logical buffer
  validation performed by the adapters.
- The full WordNet payload is not in the core package. Set
  `BUN_NLTK_WORDNET_PATH` or pass a packed path to `loadWordNetPacked()`.
- No complete NLTK parity, universal speedup, universal memory reduction, or
  comprehensive security guarantee is claimed.

## Documentation

- [API reference](docs/API.md)
- [Behavioral parity](docs/BEHAVIORAL_PARITY.md)
- [Benchmark methodology](docs/BENCHMARKING.md)
- [Native-host validation](docs/NATIVE_HOST_VALIDATION.md)
- [Rust-first migration plan](docs/RUST_MIGRATION.md)
- [Parity checklist](docs/PARITY_CHECKLIST.md)
- [Versioning](docs/VERSIONING.md)
- [Publishing](docs/PUBLISHING.md)
- [Changelog](CHANGELOG.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)
