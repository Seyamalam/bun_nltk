# Current-base compatibility audit (milestone 3 preparation)

## Scope and outcome

Audited base: `6965c57235711cd28b07be4f51f85d59cea18232`. All implementation
findings below refer to that checkout, not concurrent milestone 5–10 work.
This is a route/signature/evidence audit, **not complete NLTK parity**, a release
certificate, or an instruction to replace working APIs.

`scripts/compatibility/next_review.ts` provides a separately validated candidate:
14 existing mapping corrections, a separate canonical wordpunct-helper mapping,
and explicit callable-signature corrections/additions. `proposedNextReview()`
clones the supplied manifest; it has no write mode. The shared
`compatibility/inventory.json` and `compatibility/discovery.json` are unchanged.
The only checker change recognizes exact NLTK assertions with either quote style
and different spacing. This is an anchor check, not proof of oracle execution.

Baseline scope is still 39 selected modules, 397 module-qualified names and 338
unique origin-qualified callables. The baseline has 42 mappings, 31 explicit
signatures, 6 scoped pinned-fixture mappings, 296 unique unreviewed names and
1,710 module-qualified unmapped callable members. The candidate has 43 mappings,
43 explicit signatures, 21 scoped pinned-fixture mappings, 295 unique unreviewed
names and 1,696 unmapped members. These are audit counts, not success percentages.
The 21 include partial mixed-object/sentence-adapter rows; class completeness
does not follow from a kernel differential. Reexports repeat module-qualified
rows and cannot be added up as independent algorithms.

## Source-route corrections

### Helpers, stemmers and tokenizers

- **PorterStemmer:** `src/porter_stemmer.ts` dispatches through
  `src/nltk_compat_runtime.ts` to `rust/src/porter_nltk.rs` and the embedded
  `rust/compat` WASM. All three modes and `stem(token, to_lowercase = true)` are
  already present. It is not the native ASCII `rust/src/porter.rs` route.
  `porterStemAscii` stays exported, but must not inherit the Unicode class review.
  Extra `algorithm = "PORTER"` and JS error types remain adaptations.
- **word_tokenize:** `src/nltk_compat.ts` uses the Rust destructive word tokenizer
  in `rust/src/compat_word_tokenizer.rs`, not Treebank. With `preserve_line=false`
  it also invokes the Rust Punkt inference path. `preserve_line=true` bypasses
  language loading; the sentence-aware path supports bundled English only.
- **sent_tokenize:** `src/punkt_engine.ts` marshals into
  `rust/src/punkt_unicode.rs`. Bundled English parameters and package loading
  are not NLTK's full language/resource-search API.
- **TreebankWordTokenizer / WordPunctTokenizer:**
  `src/tokenizers_treebank.ts` calls `rust/src/tokenizers.rs` via the main WASM
  tokenizer JSON ABI. Token/span algorithms are Rust; sentence batches are TS
  mapping. Treebank parenthesis conversion is supported, while deprecated
  `return_str` still returns arrays and emits no Python warning. Spans count
  code points, not UTF-16 units. JSON input excludes lone surrogates.
- **wordpunct_tokenize:** its canonical NLTK target is
  `nltk.tokenize.regexp.wordpunct_tokenize` (also reexported at `nltk.tokenize`).
  It calls the separate compatibility-WASM u32 ABI and preserves lone surrogates.
  Do not group it with the class/factory JSON route or transfer its evidence.
- **ngrams / ngrams_iter:** `rust/src/compat_ngrams.rs` owns window/padding state.
  TS consumes iterables and interns original payload identity. Eager `ngrams`
  arrays are an intentional legacy contract; the lazy generator is additive.
  Zero order is supported; invalid orders use RangeError. Orders/items are bounded
  to 2,147,483,647 / 4,294,967,294. Abandoned iterators must be returned/closed.
- **Punkt:** training, version-2 inference, version-1 compatibility and debug
  algorithms already execute Rust. TS retains/replays training chunks and options,
  so this is not bounded-memory incremental Rust state. `PunktTrainer.train`
  returns `this`; `get_params` returns package model JSON, not Python parameters.
  Full tuning, custom token/language classes, `train_tokens`, pruning and every
  inherited member are not certified. Version-1 behavior is retained, not upgraded
  by version-2 evidence.
- **RegexpTokenizer:** a bounded Rust adapter exists in
  `src/tokenizers_regexp.ts`, with source tests and unsupported-syntax limits.
  It is absent from current Node/browser roots and the `./tokenize` entrypoint.
  Do not turn source presence or a temporary candidate bundle into packaged-root
  coverage. Tweet/Toktok/MWE still have TS subset algorithms and recorded Unicode,
  entity and expression-key mismatches in `test/tokenizer_remaining_audit.test.ts`.

### Generic probability and evaluation

- **FreqDist:** generic counts, key equality, sample ordering and object behavior
  remain TS in `src/freqdist.ts`. ASCII counting and classifier smoothing evidence
  cannot certify this object contract.
- **MLEProbDist / LidstoneProbDist:** scalar probability/logprob and smoothing
  dispatch through `src/probability.ts` to
  `rust/src/wasm_probability_contracts.rs`. Their FreqDist storage/max/samples and
  some constructor checks are TS. Keep `ts-algorithm/partial` as the conservative
  mixed-object review, with explicit Rust numeric evidence rather than the old
  TS-only-arithmetic claim. Python Counter equality/order/zero-count protocols
  and complete inherited APIs remain gaps. Other distributions need individual
  mappings even though numeric source/tests exist. WittenBell `discount()` still
  explicitly throws; its other kernels do not make that member implemented.
- **Jaccard / precision / windowdiff:** root functions in
  `src/distance_metrics.ts` dispatch to Rust evaluation kernels in
  `rust/src/metrics.rs`. TS marshals labels/code points and adapts None/errors.
  JS Set identity/SameValueZero is not arbitrary Python hashable equality;
  `windowdiff` accepts bounded strings/primitive arrays and safe JS integers.
- **ChrF / NIST:** `src/translation_metrics_extra.ts` invokes
  `rust/src/translation_metrics.rs` for character-ngram and NIST counting,
  information and reference selection. Options objects, string tokens and the
  1,024-order bound are adaptations. `sentenceChrF` wraps the corpus kernel;
  its candidate status remains partial because the cited differential directly
  calls corpusChrF, not the sentence helper independently.
- **Legacy BLEU:** root sentenceBleu/corpusBleu remain TS add-one smoothing with
  fixed four weights. Separate Rust BLEU tests do not establish NLTK-default
  unsmoothed behavior for these root exports.

### Classifiers, parsing, taggers and integrations

- Feature NB/positive NB/tree/IIS/GIS MaxEnt already use Rust WASM cores, but full
  Python feature/equality, estimator, constructor and method domains are not
  certified. Decision-tree oracles control upstream candidate ordering; MaxEnt
  near-tie omissions/tolerances are not exact prediction parity.
- Legacy text vectorizer/NB/positive NB/tree/SGD/IIS also already have Rust
  algorithms at this base (`src/features.ts`, `src/classify.ts`,
  `src/positive_naive_bayes.ts`, `src/decision_tree.ts`, `src/maxent_sgd.ts`,
  `src/maxent_iis.ts`). Frozen pre-migration model/output tests retain their old
  contracts. They are not automatically NLTK feature-dictionary APIs: text
  tokenization, order/tie policies and options are package-specific; sorted-stump
  and ASCII feature preparation in oracles are scoped adaptations.
- Root **CFG / ChartParser / PCFG** still use legacy TS algorithms. Additive
  **RustCFG / Tree / RustEarleyParser / RustPCFG / RustViterbiParser** use
  `src/rust_parse.ts` and the Rust parsing ABI. Earley/PCFG/Viterbi/tree mutation
  source contracts exist, but do not replace NLTK Chart/Edge/Rule or every Tree
  member. Native CYK recognition does not prove chart-tree parity. Root PCFG and
  subpath PCFG are different values; preserving both APIs is intentional.
- **PerceptronTagger** retains TS ASCII retokenization/features and a TS scoring
  fallback alongside native/WASM scoring primitives. An available official model
  does not certify token boundaries or the full trained NLTK API.
- Throwing exports in `classify_wrappers.ts`, `tokenize_wrappers.ts`,
  `tag_wrappers.ts`, `parse_wrappers.ts` and `sem_wrappers.ts` remain
  `gap/unsupported`. No external-integration implementation is established.
- WordNet uses project payloads/records and hybrid dispatch, not complete official
  WordNetCorpusReader/Synset/Lemma contracts. Lesk, VADER, remaining language
  models, collocations, text, tag, parse, semantic, corpus and translation families
  still need individual reviews. Exported aliases/namespaces do not close gaps.

## Explicit signature proposals

The candidate retains all old signature targets and updates four bindings:

```ts
TreebankWordTokenizer.tokenize(text: string, convertParentheses?: boolean, _returnStr?: boolean): string[]
PorterStemmer.stem(token: string, to_lowercase?: boolean): string
jaccardDistance<T>(a: LabelSet<T>, b: LabelSet<T>): number
ngrams<T>(sequence: Iterable<T>, n: number): T[][]
ngrams<T, P>(sequence: Iterable<T>, n: number, options: NgramOptions<P>): Array<Array<T | P | null>>
```

Twelve additions (constructors are callable descriptions, not plain functions):

```ts
new PorterStemmer(mode?: string, algorithm?: string)
// Each of TreebankWordTokenizer and WordPunctTokenizer:
span_tokenize(text: string): TokenSpan[]
tokenize_sents(texts: readonly string[]): string[][]
span_tokenize_sents(texts: readonly string[]): TokenSpan[][]
wordpunct_tokenize(text: string): string[]
new MLEProbDist<T>(freqDistValue: FreqDist<T>)
new LidstoneProbDist<T>(freqdist: FreqDist<T>, gamma: number, bins?: number)
PunktTrainer.train(text: string, options?: PunktTrainingOptions): this
PunktTrainer.get_params(): PunktModelSerialized
```

Exact target/file/anchor bindings are in `next_review.ts`. Retained signatures
are not newly certified as complete. Missing constructors/options, generator
contracts and inherited/dunder methods remain explicit gaps.

## Evidence boundaries

The candidate links existing tests to the correct routes; it adds no NLP kernels.
All claimed differentials assert NLTK **3.10.3**. Inventory reflection also pins
Python **3.14.4**; regexp behavior additionally depends on `regex` **2026.9.29**.

- `test/nltk_compat_oracle.test.ts` / `test/oracles/nltk_compat.py`: Porter modes,
  lowercase and generated Unicode suffixes; destructive helper substitutions;
  411 wordpunct helper outcomes; 384 ngram order/input/padding outcomes. Infinite
  iterators and JS object identity are separate adapter checks.
- The direct sentence/word oracle calls actual NLTK using explicitly reconstructed
  bundled English text parameters. It is not an independently loaded stock-model
  resource test. The training oracle separately compares official English params.
- `test/tokenizers_rust.test.ts` / `test/tokenizer_oracle.py`: actual main-WASM
  token/span kernels, parenthesis conversion and all Unicode scalars for WordPunct.
  No JSON lone-surrogate parity or independent batch corpus is implied.
- `test/punkt_migration.test.ts` / `test/python_punkt_training.py`: 90 multi-chunk
  training corpora and trained inference; private `_reclassify_abbrev_types` is
  wrapped to observe scores. Zero orthographic entries are omitted from comparison;
  scores use ten-decimal-place tolerance, not bitwise equivalence. Frozen legacy
  model checks also canonicalize scores and are not official NLTK differentials.
- `test/probability_rust.test.ts`: independent numeric MLE/Lidstone/live-mutation
  comparisons on string-key counts; samples are sorted and all Python exception
  classes collapse to `error`. This is not generic object ordering/error parity.
- `test/metrics_rust_differential.test.ts` / `test/metrics_oracle.py`: 896 set and
  262 segmentation cases, plus 276 ChrF/NIST cases. Other tested metrics do not
  receive new individual mappings merely because they share the file/kernel.
- Frozen text-model comparisons and exact serialized load/save checks preserve
  working package contracts, not whole-NLTK equivalence. No models, rounding
  policy, aliases, Rust* API, or `float_roundtrip` feature was changed here.

## Built-artifact observations and platform gaps

The current Bun-source and Node-artifact roots expose **951 runtime values**;
the curated browser artifact exposes **72**. Type-only declarations and nested
namespace members are not included. The new regression imports built Node and
browser JS **in Node**: that is export observation, not browser-host execution.

- Both roots expose word/sentence/wordpunct helpers, WordPunctTokenizer,
  RustCFG, Tree, RustEarleyParser and ngrams_iter.
- Node only among the audited roots: PorterStemmer, FreqDist, MLEProbDist,
  jaccardDistance, sentenceChrF, legacy CFG/ChartParser/PCFG,
  BinaryMaxentFeatureEncoding and TypedMaxentFeatureEncoding.
- Neither root: RegexpTokenizer, RustPunktTokenizer, RustPCFG,
  RustViterbiParser or ProbabilisticProduction. The last three are exported by
  built `dist/portable/rust_parse.js`, selected by published `./parse`; its PCFG
  alias is RustPCFG. Source-only `./tokenize` is not a compiled Node subpath.
- Temporary regexp/parsing verifier bundles and historical browser runs do not
  establish current clean-tarball/root coverage. Full native OS/architecture,
  Chromium/Firefox/WebKit, package-installed types and final regenerated artifacts
  were not revalidated in this audit. Native-only APIs are not made portable by
  lazy FFI loading.

## Stale-document corrections for parent integration

Do not replace historical measurements with present-day claims without scope:

- `docs/compatibility-family-coverage.md` describes `405347e`. Its TS-only
  Treebank/WordPunct/helpers/Punkt/metrics/ChrF/NIST and ASCII-only/one-mode Porter
  findings are stale at this base. The generic FreqDist and legacy BLEU/CFG gaps
  remain, while MLE/Lidstone need mixed numeric-kernel wording.
- `docs/compatibility-inventory.md`'s 917 root exports is historical; current
  discovery records 951. Its 42/31/6 counts still describe the untouched baseline,
  not the candidate. Old `PYTHONPATH` commands must not silently select another
  oracle. Semaphore activation is explicitly deferred.
- `docs/RUST_MIGRATION.md`'s generic remaining text-classifier/metric migration
  statement no longer identifies which algorithms remain TS. Source progress is
  broader, but its historical 43-group fidelity/platform results must not be
  represented as a new full-suite or release validation here. MaxEnt encoding
  source additions likewise need precise option/platform scope, not blanket parity.
- `docs/regexp-tokenizer-rust.md` correctly records parent registration gaps.
  `docs/rust-parsing-mutation-pcfg.md` records additive contracts. Their old
  700,000-byte-limit and unoptimized oversized-binary/package failures are
  historical; present unchanged artifacts pass the owner's 1,100,000-byte limit.
  That does not prove every unregistered source API is packaged.
- Live data observation at audit time: WordNet **missing**; English punkt_tab,
  averaged_perceptron_tagger_eng and VADER lexicon **available**. Availability is
  neither a pinned fixture nor a passing official model/sense differential.

## Validation and artifact impact

Use the parent's existing oracle/resources without modifying either:

```sh
export PATH=/home/seyamalam/Desktp/bun_nltk/.venv/bin:$PATH
export NLTK_DATA=/tmp/opencode/bun-nltk-next-data
bun install --frozen-lockfile
bun scripts/compatibility/inventory.ts --check
bun test test/compatibility_inventory.test.ts test/nltk_compat_oracle.test.ts test/tokenizers_rust.test.ts test/metrics_rust_differential.test.ts test/probability_rust.test.ts test/punkt_migration.test.ts --timeout 120000
bun test test/probability_contracts.test.ts test/punkt_unicode_wasm.test.ts test/tokenizer_remaining_audit.test.ts test/rust_parse.test.ts test/text_classifiers_migration.test.ts test/text_nb_migration.test.ts --timeout 120000
node_modules/.bin/tsrs -p compatibility/tsconfig.json --noEmit
node_modules/.bin/oxlint scripts/compatibility test/compatibility_inventory.test.ts
CARGO_TARGET_DIR=/tmp/opencode/bun-nltk-next-audit CARGO_BUILD_JOBS=2 bun scripts/build-nltk-compat.ts --check
bun run wasm:size:check
bun run package:size:check
git diff --check
```

The two focused groups pass: **47 tests / 61,454 assertions** and **45 tests /
45,476 assertions**, with zero failures. The pinned inventory, focused
typecheck/lint, embedded-compat reproducibility and existing size gates pass.
This is not a full-project Rust/Clippy, full-suite, browser or native-matrix
validation. Direct installed TS/lint binaries were used to confirm actual checks,
not just npm notice output.

- Main shipped WASM: **1,055,547 bytes**, SHA256
  `507430234dcd02a69f53cee4edc0791a41191a3378d6d495725fd535e693580b`.
  Budget: **1,100,000**; remaining headroom: **44,453** bytes.
- Embedded compatibility WASM: **91,275 bytes**, SHA256
  `78c2d387dae8aabacfcafa464e3cabe1d5c9ba6057fca7866a9d35e1b71998c2`.
  Isolated locked rebuild matches the checked-in source embedding.
- Package gate: **316 files / 12,895,790 unpacked bytes**, from its rounded
  pack-listing sum; budgets remain **400 / 13,000,000**. Exact JSON dry-run sum
  is **12,846,493 bytes / 316 files**. This host's npm pack command resolves to
  Bun's object-keyed JSON, not npm's usual array; use the proper format when
  reproducing. No gate parser/threshold was changed.
- Shipped optimized-WASM delta: **0 bytes**. Package delta: **0 bytes / 0 files**.
  Only audit tooling/tests and this nonpublished report change; no runtime/Rust
  edits, native prebuilts, generated dist/WASM, model assets or package metadata.

## Remaining integration work

1. Parent reviews/applies candidates and updates shared status/README/inventory.
   Removing the misgrouped wordpunct helper binding and Porter ASCII route is an
   **audit correction**, not API removal. Existing regression gates deliberately
   reject those candidate changes. Approve narrowly scoped corrections explicitly;
   do not weaken all removal/evidence gates or casually run `--write`.
2. Regenerate shared discovery only after final export/build integration. The
   candidate currently validates names/routes/anchors against the base snapshot,
   not newly generated candidate source hashes. Update historical baseline-only
   assertions when adopting the candidate, preserving route/evidence separation.
3. Review/register missing Regexp/Punkt/parser/encoding routes and declarations
   per intended platform, without transferring root evidence to every subpath.
   Then run clean-tarball Node/Bun/types and actual browser/native matrices.
4. Add individual reviews for the remaining 295 unique candidate-unreviewed names
   and 1,696 unmapped members. Mixed generic objects, full Python protocols,
   error classes, corpus/resource loading and sentenceChrF direct differentials
   remain real gaps. Keep unsupported integrations explicit.
5. Parent owns final artifact regeneration and all unchanged size gates. Do not
   remove valid APIs or float roundtrips to make them pass. No Semaphore activation,
   push, PR or delegation was performed in this audit.
