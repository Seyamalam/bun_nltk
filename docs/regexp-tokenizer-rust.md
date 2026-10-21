# RegexpTokenizer implementation slice

Base: `28b0818`. This adds a **bounded** Rust implementation of NLTK 3.10.3
`RegexpTokenizer` / `regexp_tokenize`; it is not arbitrary Python regexp parity.
Oracle: specifically **Python 3.14.4**, NLTK **3.10.3**, `regex` **2026.9.29**,
with `PYTHONPATH=/tmp/opencode/bun-nltk-oracle`. No corpus downloads are needed.

## API and ownership

`src/tokenizers_regexp.ts` exports `RegexpTokenizer`, `regexpTokenize` /
`regexp_tokenize`, `RegexpTokenizerFlags`, and precise option/result types.
Constructors accept Python-style positional arguments or an options object;
`discardEmpty` and `discard_empty` are aliases. Methods include camel/snake
tokenization, scalar-span, and sentence-batch aliases. A `{pattern: string}`
object extracts only the source, like NLTK (compiled-object flags are not used).
Compilation is lazy. Native JS `RegExp` objects are not accepted as Python
compiled patterns. Lone UTF-16 surrogates remain rejected by Rust JSON decoding.

The adapter uses the existing shared `tokenizerRuntime` loader and a small
`WasmNltk.regexpTokenizer` transport method. Matching, syntax translation,
capture selection and gap construction live in `rust/src/regexp_tokenizer.rs`,
included under the existing tokenizer module/JSON ABI. No dependencies or
ABI exports were added. Existing TS tokenizer APIs were not replaced.

**Parent integration remains necessary:** register exports in `src/tokenizers.ts`,
root/entrypoint exports, and portable JS/declaration build inputs; update shared
tokenizer docs and compatibility inventory, pinned specifically to Python
3.14.4. The inventory and discovery snapshot were deliberately not regenerated
in this isolated slice. Shared WASM/portable artifacts are not in this commit.

## Verified contracts and limits

- Supported: literal Unicode scalars; dot/anchors; alternation; ordinary and
  noncapturing groups; Python `(?P<name>...)` captures; greedy/lazy quantifiers;
  classes/ranges; `\w`, `\d`, `\s` and complements; standard character and
  hex/Unicode escapes; `\A` and absolute `\Z`/`\z`.
- Default flags are 56 (UNICODE | MULTILINE | DOTALL). IGNORECASE (2), MULTILINE
  (8), DOTALL (16), UNICODE (32), VERBOSE (64) and backend ASCII (128) are
  supported. Unicode classes and **directed** V0 simple case mappings are pinned
  generated tables, not Rust Unicode/case-folding tables.
- NLTK's docs mention Python `re`, but 3.10.3 compiles caller patterns through
  `nltk.redos`, forwarding numeric flags to **third-party `regex`**. Thus Python
  `re.ASCII` (256) selects `regex.VERSION1`, while backend ASCII is 128 (Python
  `re.DEBUG`). Bit 256 and other unimplemented flags are rejected, not remapped.
  ASCII plus UNICODE is invalid. For example IGNORECASE literal `i` matches
  `i`, `I`, `İ`, but **not** `ı`; literal `I` has a different directed mapping.
- No captures: tokens are full matches. One capture: tokens are capture strings
  (missing captures become `""`). Multiple captures: Python tuples become arrays
  of strings. Verified upstream quirk: repeated single captures with positive
  repetition minima may also return one-element tuples. Split mode includes
  captured separators and represents unmatched captures as `null`; discard-empty
  removes both `null` and `""` in gap mode only.
- Spans use whole matches, not capture spans, and count Unicode code points.
  Gap spans deliberately follow NLTK's asymmetric behavior: internal/leading
  empty spans are absent regardless of discard-empty; the final empty span is
  included only when discard-empty is false. They are not offsets for captured
  separator tokens.
- Empty pattern and standalone `^`, `$`, `\A`, `\Z`/`\z` are supported. Nullable
  consuming and other contextual empty-match patterns explicitly error: Rust
  iteration suppresses a nonempty match immediately following an empty match,
  unlike Python. Non-MULTILINE `$` on final-newline inputs also explicitly errors
  rather than silently applying Rust's different end-anchor behavior.
- Explicitly unsupported: lookaround, inline flags, atomic/conditional/extension
  groups, backreferences, boundaries, octal/named-character/property/regex-only
  escapes, POSIX classes, possessive quantifiers, and captures under repeated
  enclosing groups that can retain earlier participating captures differently.
  Errors identify unsupported constructs; no JS/Python fallback exists.
- Source patterns are capped at 16,384 UTF-8 bytes; expanded patterns at 262,144
  bytes; character classes at 16,384 ranges; compiled regex size at 2 MiB;
  nesting at 64. The Rust cache holds at most 16 compiled patterns. Existing
  WASM input limits apply. Rust uses a non-backtracking engine, **not** NLTK's
  five-second wall-clock `redos` timeout; timeout/error-class parity is not
  claimed. Iterated matching and output allocation are not constant-cost.

## Reproduction and actual validation

Build into an isolated Cargo directory with `--locked` and copy the **actual
output** explicitly (the existing build script does not honor this copy path):

```sh
PYTHONPATH=/tmp/opencode/bun-nltk-oracle python3 scripts/generate-regexp-unicode.py
CARGO_TARGET_DIR=/tmp/opencode/regexp-921aa269-target cargo build --locked --release --target wasm32-unknown-unknown --manifest-path rust/Cargo.toml
cp /tmp/opencode/regexp-921aa269-target/wasm32-unknown-unknown/release/bun_nltk.wasm native/bun_nltk.wasm
PYTHONPATH=/tmp/opencode/bun-nltk-oracle bun test test/regexp_tokenizer.test.ts test/tokenizer_remaining_audit.test.ts test/tokenizers_rust.test.ts test/tokenizer_family.test.ts test/tokenizers.test.ts test/tokenizer_python_parity.test.ts
PYTHONPATH=/tmp/opencode/bun-nltk-oracle bun run scripts/verify-regexp-portable.ts
CARGO_INCREMENTAL=0 CARGO_TARGET_DIR=/tmp/opencode/regexp-921aa269-target CARGO_PROFILE_DEV_DEBUG=0 CARGO_PROFILE_TEST_DEBUG=0 cargo test --locked --manifest-path rust/Cargo.toml
npx --no-install tsrs -p tsconfig.json --noEmit
```

Results on this host:

- 100 Rust tests passed; 23 targeted Bun tests passed (166,858 assertions).
  The regexp suite includes deterministic mixed inputs, Unicode/flag/capture/gap
  combinations, syntax and unsupported-construct errors, all Unicode scalars for
  word/decimal/space classes, and every directed simple-case mapping.
- Dedicated candidate-bundle verifier: 10 oracle cases each passed in Chromium,
  Firefox and Node. This is not proof of parent-owned packaged root exports;
  the verifier intentionally builds only this adapter into temporary output.
  WebKit was not run.
- Root typecheck passed after frozen-lockfile installs at root and
  `examples/js-library`; no lockfile changes. Targeted Oxlint passed with only
  three pre-existing `src/wasm.ts` no-new-array warnings.
- Full suite with `--timeout 30000`: **570 passed / 2 failed**, both pre-existing
  compatibility inventory anchor/export drift. Initially with the default
  timeout: 569 passed / 3 failed. Two failures are pre-existing
  compatibility inventory anchor/export drift; the third was the existing
  5-second model-test timeout. `test/nltk_models.test.ts --timeout 30000` passed
  all three tests separately. Inventory/registration repair belongs to parent.
- Base WASM was already **1,345,655 bytes**; candidate WASM is **1,412,609 bytes**
  (+66,954). `wasm:size:check` fails against the unchanged **700,000** gate.
  Package gate also fails: measured approximately 14.40 MB with base WASM plus
  this source and 14.47 MB with candidate WASM, against unchanged **13,000,000**.
  No 400-file, package-byte, or WASM budgets were raised. The candidate is not a
  releasable artifact under these gates; base binary is restored after validation.

## Remaining-family audit

`test/tokenizer_remaining_audit.test.ts` runs pinned NLTK behavior probes and
records legacy TS outputs. Tweet/Toktok split `café naïve 你好` into ASCII fragments
and scalar punctuation instead of whole Unicode words; Tweet differs on HTML
entities, email addresses and `<3`. MWE trims expression tokens and joins keys,
so `[' a','b ']` unexpectedly matches `['a','b']`, and `['a_b','c']` collides with
`['a','b_c']`. NLTK does neither. Longest-match behavior agrees in the tested
normal case. These families remain TS subsets; replacing them now would change
the existing APIs/behavior before full differentials pass. The destructive helper
already in the Rust compat crate was not duplicated or changed.
