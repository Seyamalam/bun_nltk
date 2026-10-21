# Milestone 3: NLTK compatibility helpers and Porter

## Implemented and behaviorally tested

- `PorterStemmer`: ORIGINAL_ALGORITHM, MARTIN_EXTENSIONS and NLTK_EXTENSIONS
  (default), class mode constants, `stem(word, to_lowercase=true)`, irregular
  forms, Unicode lowercase including final sigma and dotted I, and code-point
  lengths. The legacy optional `algorithm="PORTER"` argument is retained;
  other algorithm names remain explicit errors. The old ASCII Porter API and
  its Rust algorithm are untouched.
- `wordpunct_tokenize`: Rust token grouping using the **actual NLTK 3.10.3
  redos/regex engine** character classes. This release does not use stdlib
  Python `re` here: combining marks/joiners are word characters, superscript
  numbers are not, and U+001C is punctuation rather than whitespace.
- `word_tokenize`: Rust port of NLTK's destructive word tokenizer, including
  curly/chevron quotes, apostrophes, arbitrary dot runs, Unicode dashes,
  asterisks, Unicode digit/boundary behavior, and contractions. `preserve_line`
  correctly bypasses **all** language/Punkt loading, even for an unavailable
  language or empty input. Sentence splitting still delegates to the existing
  English Punkt implementation.
- `ngrams`, `bigrams`, `trigrams`: Rust-owned sliding windows and padding,
  including short/empty inputs, default null pads and custom object/zero pads.
  Input may be any synchronous JS iterable. Zero order correctly yields
  `length+1` empty windows; negative/fractional/nonfinite orders reject.
- `ngrams_iter`: additive lazy generator for infinite/one-shot input, delayed
  validation/errors, reentrant iterators, bounded JS identity marshaling,
  and Rust handle cleanup on completion or explicit `.return()`.

`test/nltk_compat_oracle.test.ts` invokes `test/oracles/nltk_compat.py` and
asserts NLTK **3.10.3**, rather than generating expected outputs with bun_nltk.
The earlier wrapper-only tests remain smoke tests, not parity evidence.

## Oracle data and reproducibility

Python 3.14.4 / Unicode 16.0.0 and regex 2026.9.29 are the tested oracle.
Dependencies are recorded in `test/oracles/compat-requirements.txt`.
The English Punkt data was absent. NLTK's downloader rejects `/tmp/opencode`
because an ancestor is writable. The oracle instead creates temporary **text**
Punkt parameter files in `/tmp/opencode` from the existing
`src/data/punkt-english.json` (abbreviations, collocations, sentence starters,
and orthographic contexts), then calls actual `nltk.sent_tokenize` and
`nltk.word_tokenize`. No pickle loading, executable model deserialization,
monkeypatch or missing-data skip is used. These tests validate against the
bundled model, **not an independently downloaded stock model**.

Algorithms are dedicated Rust files compiled by dependency-free
`rust/compat/Cargo.toml`; `src/nltk_compat_runtime.ts` only marshals code points,
object IDs, and output windows/tokens. The embedded WASM is built on this
checkout, portable across platforms, and carries a SHA-256. No new platform
native binaries are supplied. Unicode tables pin Python Unicode 16 and
regex 2026.9.29; contextual lowercase properties come from a SHA-256-checked
Unicode 16 UCD file. Generation never executes downloaded content.

```sh
PYTHONPATH=/tmp/opencode/bun-nltk-oracle python3 scripts/export-compat-unicode.py
bun run scripts/build-nltk-compat.ts --check
CARGO_TARGET_DIR=rust/target/nltk-compat cargo test --locked --manifest-path rust/compat/Cargo.toml
PYTHONPATH=/tmp/opencode/bun-nltk-oracle bun test ./test
npx --no-install tsrs -p tsconfig.json --noEmit
npx --no-install oxlint src test bench scripts index.ts
```

WASM reproducibility pins rustc 1.97.1 (install the
`wasm32-unknown-unknown` target). The compatibility build uses the worktree-local
`rust/target/nltk-compat`, independently of shared native/WASM builds.
Source paths are remapped to `/bun_nltk` so checkout locations do not enter
the generated artifact. `--check` rebuilds and verifies the embedded bytes.
Full tsrs checking also needs the existing example's local package installed:
`bun install --cwd examples/js-library` (no source/lock changes).

## Exact remaining limitations and integration notes

1. `ngrams`/`bigrams`/`trigrams` intentionally **still return arrays**, not Python
   generators or tuples, to preserve working consumers. Use `ngrams_iter` for
   lazy behavior. Separate lazy `bigrams_iter`/`trigrams_iter` aliases are not
   added; `ngrams_iter(sequence, 2|3, options)` provides that behavior.
2. JS `number` cannot distinguish Python integer `2` from float `2.0`.
   Invalid n raises JS `RangeError`, not Python ValueError/TypeError. Accepted
   order is 0..2147483647; one iterator supports at most 4294967294 source
   items. Arrays inherently cannot consume infinite inputs. Call `.return()`
   when abandoning lazy iterators; Python/JS garbage-collection semantics are
   not interchangeable.
3. Non-English sentence tokenization remains unavailable. It explicitly errors
   even on empty input; JS errors do not reproduce Python's LookupError/OSError
   class hierarchy or resource-search messages. `preserve_line` works for any
   language because it needs no model.
4. Existing `src/punkt*.ts`, `rust/src/punkt.rs`, `src/tokenizers.ts`, and the
   legacy Treebank/WordPunct class APIs were **not changed**. Punkt/tokenizer
   agents own those files. They can reuse `wordTokenizeNltk`/`wordpunctNltk`
   from the new bridge if integrating class APIs. This work does not claim
   broad Punkt training or language-model parity.
5. All added Rust tests live in the separate compatibility crate: run its test
   command in Semaphore in addition to the existing main Rust crate tests.
   Merge into the main WASM ABI later if desired; this round deliberately
   avoids `rust/src/lib.rs`, `src/wasm.ts`, and shared build scripts.
6. The only shared export edit is one line in `index.ts`, adding `ngrams_iter`
   and `NgramOptions` to the existing compatibility export. Portable root
   bundles require regeneration during parent integration; no generated root
   declarations or shared packaging files are changed here.

No Semaphore configuration, remote settings, pushes, PRs or other agents were
created in this implementation round.

Validation in this isolated worktree: 504 Bun tests / 65,509 assertions, 62
existing Rust tests plus 4 compatibility-crate tests, full tsrs, full Oxlint
(existing warnings only; changed files have none), WASM reproducibility check,
and browser-target bundling of both compatibility and Porter entrypoints.
Those browser-target bundles also pass five Node behavioral smoke assertions
without Bun APIs (not counted as additional Python parity tests).
