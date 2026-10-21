# Rust parsing slice

> **Budget update (2026-10-21):** the browser WASM budget is now 1,100,000
> bytes by explicit owner decision. Figures below that compare against the
> former 700,000-byte limit are historical measurements.

This is a tested parsing **slice**, not the whole NLTK parsing package. Existing
`CFG`, `ChartParser`, feature/PCFG and plain `ParseTree` APIs are unchanged.

```ts
import { ParsingRuntime, Tree, CFG, RustEarleyParser } from "bun_nltk/parse";
const runtime = await ParsingRuntime.load();
const tree = Tree.fromstring(runtime, "(S (NP café) (VP runs))");
const grammar = CFG.fromstring(runtime, "S -> S S | 'a'");
const parser = new RustEarleyParser(grammar);
const parses = parser.parse(["a", "a", "a"]); // two trees
runtime.dispose();
```

The root exports `RustCFG` instead of replacing the legacy root `CFG`. The
dedicated subpath exports `CFG` as an alias for `RustCFG`. All string tree parsing,
formatting, structural queries, CFG reading/filtering/leftcorner closure, and
Earley prediction/scanning/completion/forest extraction run in Rust. TypeScript
loads WASM, marshals JSON, and exposes live tree views. Tree/grammar text needs no
NLTK data files. Tests require the actual NLTK 3.10.3 oracle; they do not substitute
wrapper/import tests for behavioral differentials.

## Supported contracts

- String-valued `Nonterminal`: symbol, equality, slash composition; production
  LHS/RHS, length, lexical/nonlexical distinction, equality, Python-style rendering.
- `CFG.fromstring`: quoted terminals (including spaces/pipes), nonterminal
  distinction even when names equal terminals, alternatives/empty alternatives,
  comments on their own lines, `%start`, continued lines, malformed-input rejection.
- CFG start, filtered productions (RHS means **first** RHS symbol), coverage,
  grammar-form predicates, min/max rule length, leftcorners/parents/membership.
- String-label/string-leaf `Tree`: fromstring, alternate bracket pairs, escaped
  brackets kept verbatim, optional empty top removal, pformat with strict margin
  comparison/indent/nodesep/parens/quotes, leaves, height, all four position orders,
  negative child indexing, leaf positions, spanning leaves, POS, productions,
  subtrees, live indexed mutation/deletion, flatten and deep copy.
- Packed Earley CFG parsing/recognition: arbitrary RHS length and mixed terminals,
  epsilon rules/empty inputs, direct/indirect left recursion, ambiguity, original
  production-shaped trees (no synthetic CNF nodes). Parse sets, not NLTK's incidental
  iteration order, are compared in ambiguous cases.

## Explicit limits and remaining gaps

- This Tree contract intentionally only accepts string labels/leaves, not arbitrary
  Python objects, tuple leaves, custom regex/read callbacks, Python list slicing,
  all list methods, shallow-copy semantics, tree equality/order/hash contracts,
  visualization or the full mutable/parented/immutable/probabilistic tree subclasses.
  Transform functions and existing parented-tree APIs have **not** been migrated.
  Error classes/messages are idiomatic JS errors, not byte-for-byte Python
  exceptions. String rendering covers tested printable Unicode/control characters,
  not every Python Unicode non-printable classification. Nonterminal identifier
  scanning uses Rust Unicode alphanumeric classification, not every Python `\w`
  category. Alternate brackets must be distinct.
- Same-span grammar cycles can have infinitely many derivations. Recognition is
  supported. `parseResult` reports `cyclic` and enumerates cycle-free derivations;
  `parse` throws rather than presenting these as complete parses. `parseResult`
  reports `truncated` when maxTrees cuts ambiguity; `parse` throws in that case.
- Defaults: 1,000 trees and 100,000 chart state/path records; hard caps: 10,000 trees,
  2,000,000 state/path records, 512 input tokens, 16 MiB request JSON, 256 traversal/
  parse depth. Serde's JSON nesting bound can reject deep serialized trees earlier.
  Forest expansion also has a 1,000,000-call work cap. Bounds fail explicitly.
  This is not an unbounded/lazy NLTK forest iterator.
- Full Chart/Edge/ChartRule public APIs, bottom-up/leftcorner strategies, recursive
  descent and stepping parsers, shift-reduce, PCFG/Viterbi/inside, feature unification,
  chunk grammar/rules, dependency graph/projective/nonprojective parsing, and CCG
  remain outside this Rust slice. Existing implementations are preserved, not claimed
  as Rust replacements. No external/Java integrations are provided.

## Build and integration

`rust/src/parsing.rs` is the algorithm module; `parsing_abi.rs` owns independent
request/result/release exports. `src/parsing_runtime.ts` is independent of the shared
`src/wasm.ts`. Serde 1.0.229 and serde_json 1.0.151 are exactly pinned and compile for
both host and wasm32. The included WASM is rebuilt locally from this source, not a
claimed cross-platform native binary.

Use a unique Cargo target directory, then copy the actual built WASM into `native`:

```sh
CARGO_TARGET_DIR=/tmp/opencode/bun-nltk-parsing-target cargo test --locked --manifest-path rust/Cargo.toml
CARGO_TARGET_DIR=/tmp/opencode/bun-nltk-parsing-target cargo build --locked --release --target wasm32-unknown-unknown --manifest-path rust/Cargo.toml
cp /tmp/opencode/bun-nltk-parsing-target/wasm32-unknown-unknown/release/bun_nltk.wasm native/bun_nltk.wasm
bun run build:portable
PYTHONPATH=/tmp/opencode/bun-nltk-oracle bun test ./test
npx --no-install tsrs -p tsconfig.parsing.json --noEmit
npx --no-install oxlint src/rust_parse.ts src/parsing_runtime.ts test/rust_parse.test.ts scripts/verify-parsing-portable.ts
bun run scripts/verify-parsing-portable.ts
```

The portable verifier defaults to all three Playwright engines. To explicitly
select installed engines, set `BUN_NLTK_PARSING_BROWSERS=chromium,firefox` (omitted
engines are not verified or reported as passing).

Integration requires the two Rust module declarations, root/browser exports, parse
package subpath, and two modules/precise parsing declaration names in the portable
builder. Rebuild the final integrated WASM and portable artifacts after cherry-picking;
do not combine binary diffs from concurrent agents. No existing native/prebuilt
platform libraries need to be overwritten for this independently loaded WASM ABI.

## Validation in this implementation worktree

- NLTK **3.10.3** oracle and Treebank corpus were available locally.
- **506 Bun tests**, **69 Rust tests**, including 8 dedicated parsing tests with
  1,002 assertions: 51 synthetic tree cases, 40 real Treebank trees, 11 grammar
  contract cases, 10 invalid grammars, 29 hand-selected parse cases, and 240 generated
  acyclic nullable CFG/input cases. Ambiguous parses compare complete tree sets.
- Full `npx --no-install tsrs -p tsconfig.json --noEmit` passes after installing the
  existing `examples/js-library` local package dependency. No example source changes.
  Oxlint passes for changed files; full-repository lint has existing warnings only.
- Browser behavioral verification passes in Chromium and Firefox; Node 24 passes.
  Packaged subpath/root behavioral checks and precise declarations pass in Node and
  Bun. These small platform probes are not additional NLTK algorithm parity claims.
- WebKit is unverified: its installed executable fails before launch because the
  host lacks `libevent-2.1.so.7`. No workflow or CI settings were changed.
- Locally rebuilt WASM: **534,977 bytes**, within the existing 700,000-byte gate;
  SHA-256 `e744f05cca8428785d153231b70616aa03909d8665614d6899a1467c2eac3112`.
- Rustfmt and source diff checks pass. Generated minified root bundles retain
  whitespace inside existing template literals, which `git diff --check` flags;
  do not trim these literals, since doing so changes tokenizer behavior.
