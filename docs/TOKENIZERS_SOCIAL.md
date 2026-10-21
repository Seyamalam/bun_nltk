# Tweet, Toktok and MWE Rust migration

Baseline: `6965c57`, Python 3.14.4 / NLTK 3.10.3 / regex 2026.9.29.
No corpus data or shared environment modifications are required.

Final optimized candidate: **1,085,371 bytes**, **+29,824** versus the shipped
1,055,547-byte baseline; 14,629 bytes below the unchanged 1,100,000-byte cap.
Package delta is not certified: two new packaged TS source files, additional
public declarations, regenerated bundle sizes and final unpacked tarball must
be measured by the parent (no package budget edits).

## Contracts

- Existing `TweetTokenizer`, `ToktokTokenizer`, `MWETokenizer`, `tweetTokenize`,
  `toktokTokenize`, and `mweTokenize` now marshal to Rust using the existing
  retained-output WASM tokenizer ABI. `RustTweetTokenizer`, `RustToktokTokenizer`
  and `RustMWETokenizer` are identical portable class exports with an optional
  explicit `WasmNltk` constructor argument (last argument).
- Tweet accepts camelCase and snake_case options, exposes mutable properties
  under both spellings, and implements NLTK's entity/handle/lengthening order,
  URL/email/emoticon precedence, Unicode words, phone toggle, flags and ZWJ
  sequences. Lowercasing preserves tokens containing an emoticon, not only
  tokens that are exactly an emoticon. `casual_tokenize` accepts NLTK's positional
  booleans; `tweet_tokenize` accepts the existing options object.
- Toktok uses all 24 ordered pinned rules (including historical URL-rule quirks,
  HTML escaping, quote padding and final-period behavior). `tokenize(text, true)`
  returns the transformed string without normalizing non-space whitespace.
- MWE uses collision-safe exact string-token trie edges and longest terminal
  matching with backtracking. Whitespace/empty/single-token expressions are
  preserved. Empty expressions do not consume input. `addMwe`/`add_mwe` and the
  extension `removeMwe`/`remove_mwe` marshal ordered updates; mutation and matching
  are Rust-owned. Removal clears only that exact terminal, retaining descendants;
  repeated additions are removed together. The flat arena avoids recursive drop
  for very long phrases. NLTK 3.10.3 itself has no remove method.
- `tokenizeSents`/`tokenize_sents` are typed batch adapters. Span methods and batch
  span aliases report unsupported behavior, matching NLTK's unimplemented span
  contracts. Existing input-buffer bounds and regexp pattern bounds remain.

## Reviewed legacy escape hatch

`LegacyTweetTokenizer`, `LegacyToktokTokenizer`, `LegacyMWETokenizer`, and
`legacyTweetTokenize`, `legacyToktokTokenize`, `legacyMweTokenize` retain the old
working subsets pending parent review. In particular, legacy Toktok keeps
`isn't` whole; legacy MWE trims tokens and can collide on joined separator keys.
`tweetTokenizeSubset` and `wordTokenizeSubset` remain explicitly historical APIs.
Only this legacy module retains the old JS algorithms; migrated implementations
are typed loaders/marshaling. Do not remove the legacy module without reviewing
the documented behavior changes.

## Verification without generated artifact changes

```sh
export CARGO_BUILD_JOBS=2
export CARGO_TARGET_DIR=/tmp/opencode/bun-nltk-next-tokenizers
export BUN_NLTK_PYTHON=/home/seyamalam/Desktp/bun_nltk/.venv/bin/python3
cargo test --locked --manifest-path rust/Cargo.toml tokenizers
cargo build --locked --profile wasm --target wasm32-unknown-unknown --manifest-path rust/Cargo.toml
bun node_modules/binaryen/bin/wasm-opt -Oz --converge --enable-bulk-memory \
  --enable-nontrapping-float-to-int --enable-sign-ext --enable-mutable-globals \
  "$CARGO_TARGET_DIR/wasm32-unknown-unknown/wasm/bun_nltk.wasm" \
  -o "$CARGO_TARGET_DIR/candidate.wasm"
export BUN_NLTK_TOKENIZER_WASM="$CARGO_TARGET_DIR/candidate.wasm"
bun test test/tokenizer_social.test.ts test/tokenizer_remaining_audit.test.ts
bun test --preload ./test/tokenizer_family_candidate_preload.ts \
  test/tokenizer_family.test.ts test/tokenizers.test.ts test/nltk-fixtures.test.ts
bun scripts/verify-social-tokenizers-candidate.ts
bun x --no-install tsrs -p tsconfig.portable.json \
  --outDir /tmp/opencode/bun-nltk-next-tokenizers/declarations
```

The cross-runtime verifier builds disposable source bundles under
`/tmp/opencode`, copies only the candidate there, and checks both explicit Rust*
adapters and default synchronous public APIs. It fails on unavailable browser
hosts instead of reporting them as passes. Its default targets are Bun, Node,
Chromium, Firefox and WebKit. `BUN_NLTK_TOKENIZER_BROWSERS` can select a subset;
that is a subset run, not evidence for omitted hosts.

Recorded results: 2,628 pinned cases passed on **all five** targets, 9 focused
Rust tokenizer tests passed, 4 social/legacy Bun tests passed (2,662 assertions),
and 13 existing family/subset/fixture Bun tests passed (30 assertions) using the
candidate preload. Portable declaration compilation and focused Oxlint passed.
The whole-repository `bun run typecheck` is **blocked**, not passed: this clean
isolated checkout lacks the example's installed `bun_nltk/wasm` and
`bun_nltk/classify-tree` dependency declarations (two TS2307 errors in
`examples/js-library/feature-tree.ts`). No unrelated example setup was changed.

Differentials cover all 16 Tweet option combinations, seeded mixed inputs,
Unicode block probes, HTML4 named/numeric/CP1252 entities, emails, URL boundaries,
emoji/emoticons, Toktok punctuation/return-string behavior and exact MWE keys.
Additional checks exercise add/remove/re-add, long phrases, a 40 KB digit input,
input bounds, error propagation and output recovery. Generated fixed rule/entity
tables are source inputs reproducible via `scripts/generate-social-tokenizer-data.py`.
No full regex dependency is added; Unicode classes reuse the existing translator
and tables, with small pinned differences for Tweet normalization.

## Remaining limits and integration

- Numeric HTML entities yielding U+D800..U+DFFF cause an explicit non-scalar
  surrogate error. Python can emit lone surrogates; Rust strings/the UTF-8 ABI
  cannot. Literal lone-surrogate JSON inputs likewise fail serde validation.
  Supporting these requires a deliberate non-scalar string ABI, not silent loss.
- NLTK's raw `WORD_RE`/`PHONE_WORD_RE` Python regex object properties are not
  JS regex exports. Python bytes input/coercions are outside typed string APIs.
  NLTK's wall-clock regex timeout is not replicated; bounded regex-lite and
  linear digit-run guards are used instead. The finite differential matrix is
  evidence for these contracts, not proof for every adversarial Unicode string.
- Mutation is replayed into a fresh Rust arena per MWE call; very long-lived
  update histories can hit the existing input cap. No persistent WASM handles
  or new memory-management contracts were introduced.
- No `lib.rs` changes or new exported ABI symbols. `tokenizers.rs` moves request
  serde fields/defaults into `tokenizer_request.rs` (keeping files <=600 LOC),
  dispatches three additional kinds; the shared regexp translator is made
  sibling-visible. `src/wasm.ts` adds only the typed social request transport.
- Parent owns final WASM/portable regeneration, package-size measurement and
  compatibility inventory/docs integration. Source adapters require that new
  candidate; old shipped WASM does not recognize the new request kinds.
