# Rust language models

`NgramLanguageModel(sentences, options)` and `trainNgramLanguageModel` now use the
shared Rust/WASM kernel for vocabulary membership, padding, everygram counting,
scoring, smoothing, log scores and sequence perplexity. The old TypeScript count
maps and smoothing loops are removed. TypeScript only normalizes/interns string
tokens and marshals typed buffers. Counts stay in Rust across scalar/batch calls.
There is no additional WASM artifact and no native-only dependency in this family.

Supported model names: `mle`, `lidstone`, `laplace` (gamma fixed to 1),
`witten_bell_interpolated`, `absolute_discounting_interpolated`,
`kneser_ney_interpolated`, and `stupid_backoff`. Existing defaults are unchanged:
gamma .1, discount .75, alpha .4, both padding directions enabled. Constructors,
`score`, `logScore`, `perplexity`, `evaluateBatch`, and the
`train_ngram_language_model` alias remain. `logscore` is an additional NLTK-style
alias. No LM versioned serialization API existed at the migration base; this
change does not introduce a new serialized format or change other model formats.

## Portable ownership

```ts
import { WasmNltk, RustNgramLanguageModel } from "bun_nltk";
const runtime = await WasmNltk.init();
const model = new RustNgramLanguageModel(runtime, [["a", "b", "c", "d"]], {
  order: 4, model: "witten_bell_interpolated",
});
model.score("d", ["a", "b", "c"]);
model.dispose();
runtime.dispose();
```

`RustNgramLanguageModel` borrows its supplied runtime; disposal frees only its
model. The ordinary constructor uses the existing lazy synchronous shared
runtime (browser imports await initialization). Use `dispose()` for predictable
release; a finalizer also releases unreachable models. Disposing a runtime frees
all its LM handles and invalidates subsequent scoring. Disposing a model is
idempotent while the runtime is live.

## Explicit resource contract

- Integer orders **1–64**, without special bigram/trigram scoring paths.
- At most **1,000,000** sentences, prepared tokens, probes, or evaluation tokens.
- Training at most **1,000,000 everygram occurrences** and **8,000,000 total
  token-ID units across those occurrences**. Padding is included in these bounds;
  the key-unit bound limits order-dependent memory/work even on repeated text.
- Batch context transport at most **8,000,000 IDs** and **64 MiB** request bytes.
- Gamma and alpha finite/nonnegative; discount finite and in **[0,1]**.
- Invalid bounds/offsets/buffer dimensions fail explicitly, never silently
  downgrade order, skip malformed sentences, or truncate training data.

The existing stateless `evaluateLanguageModelIdsNative` and
`WasmNltk.evaluateLanguageModelIds` keep their ABI/model contracts (MLE, Lidstone,
KN) but reuse the generic kernel and accept orders up to 64. Their input sentences
are already prepared; the stateful constructor performs padding in Rust.

## Established semantics and limitations

This is the library's normalized-token/sequence contract, **not full NLTK LM
object parity**. Training lowercases sentence tokens; scoring preserves exact
configured padding symbols and otherwise lowercases. Vocabulary includes
`<UNK>`, OOV IDs are masked, and contexts keep only the last `order - 1` tokens.
Vocabulary remains sorted with the existing JavaScript string ordering.
Training adds `order - 1` padding symbols in each enabled direction; perplexity
evaluates **one** end symbol, matching the existing library/Python baseline.
Empty unpadded evaluation returns infinity. Zero/nonfinite probabilities clamp to
1e-12 only for log score/perplexity; Lidstone gamma=0 on empty counts returns NaN
as the previous scalar implementation did. StupidBackoff scores are weights, not
a normalized distribution; its perplexity is pseudo-perplexity.

NLTK 3.10.3 can raise `ZeroDivisionError` for sparse KN lower-order continuation
denominators and KN order 1. The library deliberately preserves the previous
finite-backoff/zero-base behavior instead. The differential records these oracle
exceptions separately; it does not count them as successful comparisons. The
empty-corpus MLE/WB/absolute/KN zero base is likewise the library contract rather
than Python division-error parity. No incremental `fit`, arbitrary NLTK
Vocabulary/NgramCounter objects, custom estimator objects, NLTK entropy over
ngram iterators, generation, or NLTK pickle format is claimed.

## Migration validation (base 6965c57)

Use an existing pinned Python interpreter without changing its environment:

```sh
CARGO_TARGET_DIR=/tmp/opencode/bun-nltk-next-lm CARGO_BUILD_JOBS=2 cargo test --locked --manifest-path rust/Cargo.toml lm::
CARGO_TARGET_DIR=/tmp/opencode/bun-nltk-next-lm CARGO_BUILD_JOBS=2 cargo build --locked --profile wasm --target wasm32-unknown-unknown --manifest-path rust/Cargo.toml
CARGO_TARGET_DIR=/tmp/opencode/bun-nltk-next-lm CARGO_BUILD_JOBS=2 cargo build --locked --release --manifest-path rust/Cargo.toml
PATH=/home/seyamalam/Desktp/bun_nltk/.venv/bin:$PATH BUN_NLTK_PYTHON=/home/seyamalam/Desktp/bun_nltk/.venv/bin/python3 NLTK_DATA=/tmp/opencode/bun-nltk-next-data BUN_NLTK_NATIVE_LIB=/tmp/opencode/bun-nltk-next-lm/release/libbun_nltk.so bun test test/lm.test.ts test/lm_models.test.ts test/lm_strict.test.ts test/lm_rust.test.ts test/wasm.test.ts test/statistical_parity.test.ts
BUN_NLTK_NATIVE_LIB=/tmp/opencode/bun-nltk-next-lm/release/libbun_nltk.so bun test test/native.test.ts --test-name-pattern 'native lm id evaluator'
bun run build:portable
bunx --no-install tsrs -p tsconfig.portable.json --noEmit
bun run scripts/verify-lm-portable.ts
bun run bench/compare_lm_rust.ts
bun run wasm:size:check
bun run package:size:check
```

Results: 3 focused Rust tests; 21 Bun tests / 40,369 assertions; one focused
native-host LM test. Differential: **241 cases, 2,439 numeric score comparisons,
229 perplexity comparisons, 70 separately recorded Python exceptions**. Orders
1/2/3/4/5/8/16/64, all four padding modes, empty/padded-empty, unseen/terminal and
overlong contexts, OOV, Unicode, repeated predecessors, discount 0/1 and custom
padding symbols are covered. Scores use 12-decimal tolerance; perplexity uses
relative comparison. Node v24.21.0 and real Chromium/Firefox/WebKit passed.

Pinned Binaryen 132 `-Oz --converge` candidate: **1,058,620 bytes**, **+3,073** over
the 1,055,547-byte shipped baseline; 41,380 bytes remain under the unchanged
1,100,000-byte budget. Candidate regenerated portable package: **317 files /
12,886,112 unpacked bytes**, under 400 / 13,000,000. These measurements include
local candidate regeneration, not committed generated artifacts or rebuilt
cross-platform prebuilts. Integration must regenerate and remeasure jointly.

The microbenchmark separates count construction from reuse: 1,000 × 14-token
sentences, 100 probes/batch, 100 repeated batches, orders 3/5/8 across six families.
Observed warm reused batch times were .08–.74 ms on this host; not an SLA or a
controlled before/after speedup claim. The original `compare_lm.ts` still runs,
and now explicitly disposes each temporary model.

Portable/source typechecks passed. The unmodified repository-wide `bun run
typecheck` was attempted but fails on existing example self-package resolution
for `bun_nltk/wasm` and `bun_nltk/classify-tree` in
`examples/js-library/feature-tree.ts`; it is **not reported as passing**.

Integration registrations are minimal: `rust/src/lib.rs` registers `lm_model`
and `wasm_lm`; `src/wasm.ts` exposes typed LM exports, clears handles on runtime
disposal, and validates legacy ID inputs. `index.ts`/`src/index_browser.ts` expose
the portable class/types without changing package metadata or shared inventory.
