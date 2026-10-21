# Tree mutation and PCFG/Viterbi extension

This additive slice starts from `28b0818` and extends the contract described in
`docs/rust-parsing.md`. Existing legacy `src/parse.ts` algorithms and root exports
are unchanged. No duplicate legacy implementation has been removed; broad parser
replacement gates have not passed. Shared inventory, package/build registration,
generated declarations/bundles, and final binary integration belong to the parent.

## Supported additions

```ts
import { ParsingRuntime, Tree, PCFG, RustViterbiParser } from "bun_nltk/parse";
const runtime = await ParsingRuntime.load(); // requires rebuilt integrated WASM
const token = { text: "a" };
const tree = new Tree<object>(runtime, "S", [token]);
tree.extend([token]);
tree.set_slice({ step: -1 }, [token, token]);
tree.leaves()[0] === token; // identity preserved, not a JSON clone
const grammar = PCFG.fromString(runtime,
  "S -> A [.2] | B [.8]\nA -> 'a' [1]\nB -> 'a' [1]");
const best = new RustViterbiParser(grammar).parse_result(["a"]);
// best.tree = (S (B a)), best.prob = 0.8, best.logProb = natural log(0.8)
runtime.dispose();
```

- `Tree<L = string>` preserves the existing string-tree signatures and adds
  arbitrary leaf payloads. Internal tree/leaf slots are explicitly tagged; an
  object with `label`/`children` properties remains a leaf unless it is a `Tree`.
  Rust structural requests use distinct numeric leaf slots. Object/string
  coercion never determines equality or structure. Leaves, POS, indexed access,
  subtrees, flatten, slicing and mutations retain original leaf references,
  including cyclic objects, symbols, bigints, undefined, NaN and negative zero.
- `append`, `extend`, `insert`, `pop`, `reverse`, `clear`, `slice`, `setSlice` /
  `set_slice`, `deleteSlice` / `delete_slice`: Rust computes Python's clipped and
  negative index/slice plans, including negative steps and fixed-size extended
  assignments. TS applies slot moves without copying payloads. Failed extended
  assignments do not mutate the tree. List edits cap children at 1,000,000 and
  reject non-safe-integer indices. Replacements may share live subtrees.
- `copy(false)` shares subtree nodes; `copy(true)` copies tree structure but
  shares leaves, as NLTK does. Existing no-argument `copy()` retains its published
  **deep-tree-copy** default, unlike NLTK's shallow default. `toPlain()` copies
  structure and preserves leaf references. String parsing still copies structure.
- `ProbabilisticProduction` adds `prob()`, base-2 `logprob()`, typed equality and
  Rust Python-style probability rendering. `RustPCFG` / subpath `PCFG` extends
  CFG with probability-bearing productions, Rust reading/validation/filtering,
  missing-probability zero defaults, and NLTK's strict per-LHS 0.99–1.01 sum
  interval. Quoted brackets/pipes are not interpreted as probability syntax.
- `RustViterbiParser`: Rust sparse span chart, repeated unary closure,
  production/split-order tie retention, arbitrary bounded RHS length, mixed
  terminals, terminal/nonterminal name distinction, left recursion and unary
  cycles, zero-probability trees and probability underflow. Original productions
  determine the returned tree; no synthetic CNF labels. `parseResult` /
  `parse_result` returns `{tree, prob, logProb}` or null; `parse` returns zero or
  one ordinary `Tree`. Work defaults to 1,000,000 records, hard cap 2,000,000,
  counting recursive matching, split/candidate visits and copied tree nodes.
  Inputs cap at 512 tokens, RHS/tree depth at 256; resource exhaustion throws.
- Camel-case conveniences are additive: grammar form/coverage/leftcorner
  methods, `fromString`, `setLabel`, `treePositions`, `leafTreeposition`,
  `treepositionSpanningLeaves`. Earley accepts snake-case resource options and
  `parse_result`; Viterbi accepts `maxWork` / `max_work`.

## Explicit remainder

- Opaque leaves support structural operations, **not** generic Python repr,
  generic equality/order/hash, nonstring grammar terminals, callback leaf readers,
  arbitrary labels or full tree subclasses. Formatting and productions reject
  nonstring leaves explicitly, rather than stringifying them. `fromPlain` stays
  string-only; plain JSON cannot unambiguously distinguish arbitrary object leaves
  from subtrees. Tree structure cycles are rejected by structural/query/copy
  operations; opaque cyclic leaf values are fine.
- List `remove`, `index`, `count`, sort and list comparison/concatenation are not
  implemented. Slice results are JS arrays of live views/leaves, not trees.
- NLTK Viterbi itself never inserts zero-span constituents. This parser deliberately
  matches that: empty inputs and grammars requiring epsilon inference yield no
  Viterbi tree. CFG Earley remains the nullable parser.
- Results are not `ProbabilisticTree` subclasses and do not expose every node's
  probability. No inside/n-best/beam parser, public Chart/Edge/ChartRule API,
  feature parser, existing parser replacement, trace, lazy iterator or wall-clock
  timeout support is claimed. Natural-log result scores are `-Infinity` for
  zero/underflowed probabilities; this is not log-domain underflow avoidance.
- New algorithms are cohesive modules included under `parsing_abi.rs`;
  `rust/src/parsing.rs` and shared Rust module registration were not restructured.

## Actual validation and integration blockers

Oracle: **Python 3.14.4**, **NLTK 3.10.3**, loaded with
`PYTHONPATH=/tmp/opencode/bun-nltk-oracle`; the dedicated tests assert both versions.

- 100 Rust tests pass with `--locked` and an isolated Cargo target directory.
- Dedicated parsing differentials: **12 tests, 3,088 assertions**, preserving all
  prior string Tree/CFG/Earley tests and adding 448 Python slice cases, 9 list
  insert/pop index cases, opaque-leaf identity and NLTK copy-sharing behavior,
  11 PCFG contract cases, 12 invalid grammars and **142 Viterbi grammar/input
  cases** (all binary strings through length four across four grammars, hand-picked
  ambiguity/ties/cycles/mixed/Unicode/epsilon cases, and probability underflow).
- Full suite before the final four invalid-index assertions: **568 pass, 2 fail**,
  123,747 assertions. Both failures are shared compatibility inventory checks:
  stale Treebank tokenizer signature anchor and export snapshot drift across
  previously integrated modules plus the new subpath exports. Inventory was not
  regenerated by this implementation agent.
- Full repository TS check passes after installing the example's existing
  `file:../..` dependency with `bun install --no-save`. Focused TS check and the
  standalone probe's strict TS check pass. Oxlint and source diff checks pass.
- Isolated source-bundle behavioral probes pass in **Chromium, Firefox and
  Node v24.21.0**; these are platform behavior probes, not extra NLTK parity claims.
  WebKit launch fails because the host lacks `libevent-2.1.so.7`.
- Final locked release WASM: **1,473,268 bytes**, SHA-256
  `6aa013029c13544eb9322361c406d9021036f3cdc5a2771c11f24821050f2048`.
  **The 700,000-byte gate fails.** The base's checked-in WASM already measures
  1,345,655 bytes. No threshold was increased. The new test binary is not committed.
- Package size gate on the final rebuild fails at **14,535,781
  unpacked bytes** against the unchanged 13,000,000-byte/400-file budgets. No
  portable build, package manifest, shared inventory or budget edits were made.
  Final regenerated portable/package artifacts remain unverified and require
  parent-owned size reduction and integration before release.

Reproduce from source (copy the actual isolated output explicitly):

```sh
CARGO_TARGET_DIR=/tmp/opencode/bun-nltk-m10-5b654627 cargo test --locked --manifest-path rust/Cargo.toml
CARGO_TARGET_DIR=/tmp/opencode/bun-nltk-m10-5b654627 cargo build --locked --release --target wasm32-unknown-unknown --manifest-path rust/Cargo.toml
cp /tmp/opencode/bun-nltk-m10-5b654627/wasm32-unknown-unknown/release/bun_nltk.wasm native/bun_nltk.wasm
PYTHONPATH=/tmp/opencode/bun-nltk-oracle bun test --timeout 60000 test/rust_parse.test.ts
BUN_NLTK_PARSING_BROWSERS=chromium,firefox bun run scripts/verify-parsing-mutation-pcfg.ts
npx --no-install tsrs -p tsconfig.json --noEmit
npx --no-install oxlint src/rust_parse.ts test/rust_parse.test.ts scripts/verify-parsing-mutation-pcfg.ts
```

The longer test timeout avoids Python-oracle import latency exceeding Bun's
five-second default under host load; it does not change parser resource budgets.
