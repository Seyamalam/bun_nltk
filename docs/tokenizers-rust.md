# Rust tokenizer family

> **Budget update (2026-10-21):** the browser WASM budget is now 1,100,000
> bytes by explicit owner decision. Figures below that compare against the
> former 700,000-byte limit are historical measurements.

`TreebankWordTokenizer`, `WordPunctTokenizer`, and their existing functions now
run Rust/WASM. The JavaScript algorithm copies were removed only after the
NLTK 3.10.3 differential suite passed. The ASCII/tweet/Toktok/MWE subset APIs
are unchanged; those families are not included in this parity claim.

## Contracts

- Added `WhitespaceTokenizer`, `BlanklineTokenizer`, `SpaceTokenizer`,
  `TabTokenizer`, `LineTokenizer`, `TreebankWordDetokenizer`, `line_tokenize`,
  and `blankline_tokenize`, with camel-case aliases for the functions.
- Tokenizers provide `tokenize`, `spanTokenize` / `span_tokenize`,
  `tokenizeSents` / `tokenize_sents`, and span batch variants.
- Spans are **Python Unicode code-point indices**, not UTF-16 offsets. Use
  `Array.from(text).slice(start, end).join("")`, not `text.slice(start, end)`.
- Treebank supports optional `convertParentheses` on tokenization and
  detokenization. Its spans restore converted quotes before post-hoc alignment,
  including NLTK's alignment failures on malformed quote sequences.
- Detokenization is NLTK's ordered reverse substitutions, not restoration of
  original whitespace. No detokenizer or span contract is invented for classes
  where NLTK does not define it.
- Space/Tab tokens retain all empty split fields; their spans intentionally
  preserve NLTK's different leading/trailing-empty behavior.
- Line tokens use Python `splitlines()` boundaries. Span behavior is deliberately
  different: `keep` splits on the literal two-character `\\n` (NLTK passes a raw
  string to `string_span_tokenize`), while `discard` and `discard-eof` use the same
  regexp-gap spans, including an empty final span. These are upstream quirks.
- Treebank uses Python `re` classes (Unicode 16, including U+001C..001F
  whitespace); WordPunct/Whitespace/Blankline use NLTK's `regex` 2026.9.29
  classes. WordPunct's newer-script table is generated from that pinned backend.
- Lone UTF-16 surrogates are rejected by Rust JSON decoding; parity is scoped to
  valid Unicode scalar strings. Python warning categories and exception classes
  are not reproduced; deprecated `return_str` still returns a token array.

## Runtime and integration

Dedicated core: `rust/src/tokenizers.rs`; ABI: `rust/src/wasm_tokenizers.rs`.
The ABI consumes JSON requests and retains one encoded response until released.
`src/wasm.ts` only stages bytes and decodes outputs. Adapters live in
`src/tokenizers_treebank.ts` and `src/tokenizers_basic.ts`.

Node/Bun public APIs lazily instantiate the packaged WASM. Browser imports await
one WASM load, then retain synchronous tokenizer methods. Explicit runtimes can
also be passed to constructors or used through `WasmNltk.tokenize`,
`tokenizerSpans`, and `treebankDetokenize`. Portable root declarations are
precise for this family; no new `any` facades were added.

Integration touchpoints: two module declarations in `rust/src/lib.rs`; dedicated
export signatures and three methods in `src/wasm.ts`; public exports in
`index.ts` and `src/entrypoints/tokenize.ts`; module/declaration registrations in
`scripts/build-portable.ts`. Rebuild WASM and portable JS after resolving merges
instead of retaining a stale binary or generated root bundle. No native platform
binaries were changed. `src/nltk_compat.ts` was not edited: its `word_tokenize`
still calls Treebank, not NLTK's distinct `NLTKWordTokenizer` algorithm, and must
not be claimed to have full NLTK `word_tokenize` parity by this work.

Only `regex = 1.13.1` (std feature) was added as an algorithm dependency; serde
and serde_json are now exactly pinned and enabled for WASM JSON marshaling.
No backtracking engine or user-supplied regexp is linked. Fixed Treebank
lookarounds are handled in Rust, and Python's special ASCII IGNORECASE mappings
are expanded explicitly rather than importing a full case-folding table.

## Verification

```sh
PYTHONPATH=/tmp/opencode/bun-nltk-oracle python3 scripts/generate-tokenizer-unicode.py
CARGO_TARGET_DIR=rust/target bun run build:wasm
CARGO_TARGET_DIR=rust/target cargo test --locked --manifest-path rust/Cargo.toml
PYTHONPATH=/tmp/opencode/bun-nltk-oracle bun test ./test
bun run build:portable
PYTHONPATH=/tmp/opencode/bun-nltk-oracle bun run scripts/verify-tokenizers-portable.ts
npx --no-install tsrs -p tsconfig.json --noEmit
npx --no-install oxlint src test bench scripts index.ts
bun run wasm:size:check
```

Oracle prerequisites are Python 3.14 / Unicode 16.0.0 and
`test/tokenizer-oracle-requirements.txt`. Tests fail, rather than silently skip,
when the oracle versions differ. No corpus data is needed. Differential coverage
includes hundreds of deterministic mixed-punctuation/contraction strings, every
Python whitespace character, Unicode word/case boundaries, empty inputs,
parenthesis conversion, nested quotes, detokenization, and every Unicode scalar
for WordPunct. A separate portable verifier compares Chromium, Firefox, and
Node WASM tokens/spans against the same pinned oracle.

Milestone validation result: 504 Bun tests, 66 Rust tests; typecheck and Oxlint
passed (Oxlint retains unrelated baseline warnings). The dedicated portability
verifier passed 120 behavioral cases each in Chromium, Firefox and Node. The
rebuilt WASM is 695,768 bytes and passes the unchanged 700,000-byte size gate.
Root typecheck requires installing the existing `examples/js-library` local
dependency (`bun install` there); no example dependency or lockfile changes
were needed.

## Remaining scope

- General `RegexpTokenizer` / `regexp_tokenize` is not implemented: Python regexp
  syntax, flags, captures, empty matches and NLTK's timeout contract need a
  separate design; fixed tokenizers are not presented as a substitute.
- `NLTKWordTokenizer` / sentence-aware `word_tokenize`, `CharTokenizer`, and
  other tokenizer families remain separate work.
- No generic detokenization API is claimed beyond Treebank; it cannot reconstruct
  whitespace lost during tokenization.
- WebKit verification is blocked on this host by missing `libevent-2.1.so.7`.
- The expanded WASM is close to the unchanged 700,000-byte gate; other milestones
  may need a reviewed artifact-size budget rather than weakening this gate here.
