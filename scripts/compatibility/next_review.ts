/** Review proposals for 6965c57 only; never writes the shared inventory/snapshot. */
import { loadManifest, type Evidence, type Manifest, type Mapping } from "./inventory.ts";

export const nextReviewBase = "6965c57235711cd28b07be4f51f85d59cea18232";

const evidence: Evidence[] = [
  { id: "next-compat-porter", kind: "differential", files: ["test/nltk_compat_oracle.test.ts", "test/oracles/nltk_compat.py"], anchor: "Porter modes and lowercase flag match live NLTK 3.10.3", oracleVersion: "3.10.3", scope: "Three modes, both lowercase flags, suffix/generated Unicode words; PorterStemmer only, not porterStemAscii." },
  { id: "next-compat-word", kind: "differential", files: ["test/nltk_compat_oracle.test.ts", "test/oracles/nltk_compat.py"], anchor: "word_tokenize preserve_line matches NLTK destructive tokenizer", oracleVersion: "3.10.3", scope: "Destructive word-tokenizer substitutions and Unicode; sentence-aware helper cases use bundled English params, not independently loaded stock data." },
  { id: "next-compat-sentence", kind: "differential", files: ["test/nltk_compat_oracle.test.ts", "test/oracles/nltk_compat.py"], anchor: "sentence/word compatibility helpers use actual NLTK English params", oracleVersion: "3.10.3", scope: "Direct sent_tokenize/word_tokenize helper cases with actual NLTK and explicit bundled English text params; language/error adaptations." },
  { id: "next-compat-wordpunct", kind: "differential", files: ["test/nltk_compat_oracle.test.ts", "test/oracles/nltk_compat.py"], anchor: "wordpunct Python Unicode categories", oracleVersion: "3.10.3", scope: "411 helper outcomes including controls, combining marks/joiners, generated strings and lone surrogates; helper's u32 ABI only." },
  { id: "next-compat-ngrams", kind: "differential", files: ["test/nltk_compat_oracle.test.ts", "test/oracles/nltk_compat.py"], anchor: "ngrams arrays and lazy iterators match NLTK padding", oracleVersion: "3.10.3", scope: "384 order/input/padding outcomes for arrays and lazy iterators; JS-only object identity/infinite consumption checks are separate, not Python differential evidence." },
  { id: "next-tokenizers", kind: "differential", files: ["test/tokenizers_rust.test.ts", "test/tokenizer_oracle.py"], anchor: "actual Rust WASM tokenizers and scalar spans match pinned NLTK 3.10.3", oracleVersion: "3.10.3", scope: "Token/span kernels, public Treebank/WordPunct functions, parenthesis conversion and every Unicode scalar for WordPunct; no lone-surrogate JSON parity." },
  { id: "next-punkt-training", kind: "differential", files: ["test/punkt_migration.test.ts", "test/python_punkt_training.py"], anchor: "Rust Punkt training params and trained inference match actual NLTK 3.10.3/Python 3.14.4", oracleVersion: "3.10.3", scope: "90 multi-chunk corpora, parameters and 1e-10 score comparisons; oracle wraps _reclassify_abbrev_types to observe scores; official English params compared separately and require punkt_tab." },
  { id: "next-probability-numeric", kind: "differential", files: ["test/probability_rust.test.ts"], anchor: "Rust MLE/Lidstone/Laplace/ELE/WittenBell/GoodTuring probabilities and live mutation match NLTK", oracleVersion: "3.10.3", scope: "MLE/Lidstone prob/logprob and live mutation on string-key count dictionaries; samples sorted for comparison, error classes collapsed to error; not generic FreqDist equality/order parity." },
  { id: "next-evaluation", kind: "differential", files: ["test/metrics_rust_differential.test.ts", "test/metrics_oracle.py"], anchor: "Rust sets: 896 pinned NLTK behavioral cases", oracleVersion: "3.10.3", scope: "Primitive-label Jaccard/precision plus other set operations; segmentation cases include weighted windows and empty/multi-character boundaries. Object identity checks are JS adaptations, not Python structural-equality parity." },
  { id: "next-translation", kind: "differential", files: ["test/metrics_rust_differential.test.ts", "test/metrics_oracle.py"], anchor: "Rust ChrF/NIST: 276 pinned NLTK behavioral cases", oracleVersion: "3.10.3", scope: "corpusChrF/corpusNist and NIST penalty, Unicode whitespace and orders 0..7; sentenceChrF is a one-pair adapter, not independently called in this differential block." },
];

type Correction = {
  target: string;
  exports?: string[];
  category: Mapping["category"];
  source: Mapping["source"];
  members?: string[];
  evidence: string[];
  gaps: string[];
  notes: string;
};

const corrections: Correction[] = [
  { target: "nltk.tokenize.word_tokenize", category: "rust-wasm", source: [
    { file: "src/nltk_compat.ts", anchor: "export function word_tokenize" },
    { file: "src/nltk_compat_runtime.ts", anchor: "export function wordTokenizeNltk" },
    { file: "rust/src/compat_word_tokenizer.rs", anchor: "pub fn tokenize" },
    { file: "src/punkt_engine.ts", anchor: "export function punktSentences" },
    { file: "rust/src/punkt_unicode.rs", anchor: "pub fn" },
  ], evidence: ["next-compat-word", "next-compat-sentence"], gaps: ["English bundled params only when preserve_line is false; preserve_line bypasses language loading. JS errors are adaptations; no full resource-search API."], notes: "Rust destructive word tokenizer, NOT Treebank; Rust Punkt inference on sentence-aware path. Compatibility tokenizer uses existing embedded compat WASM; Punkt uses main WASM." },
  { target: "nltk.tokenize.sent_tokenize", category: "rust-wasm", source: [
    { file: "src/nltk_compat.ts", anchor: "export function sent_tokenize" },
    { file: "src/punkt_engine.ts", anchor: "export function punktSentences" },
    { file: "rust/src/punkt_unicode.rs", anchor: "pub fn" },
  ], evidence: ["next-compat-sentence"], gaps: ["English bundled params only; no Python data-search or language-loader contract. Direct helper oracle reconstructs text params from bundled asset."], notes: "Rust inference through Punkt marshaling, not a TS sentence algorithm; resource availability never creates evidence." },
  { target: "nltk.tokenize.treebank.TreebankWordTokenizer", category: "rust-wasm", source: [
    { file: "src/tokenizers_treebank.ts", anchor: "export class TreebankWordTokenizer" },
    { file: "rust/src/tokenizers.rs", anchor: "pub fn" },
    { file: "rust/src/wasm_tokenizers.rs", anchor: "bunnltk_wasm_tokenizer" },
  ], members: ["tokenize", "span_tokenize", "tokenize_sents", "span_tokenize_sents"], evidence: ["next-tokenizers"], gaps: ["Optional runtime constructor is an extension; convertParentheses is camelCase; deprecated return_str still returns arrays without Python warnings. Spans are code-point indices; scalar strings only."], notes: "Rust ordered substitutions and span alignment. TS maps batch outputs; batch marshaling alone is not an independent Rust algorithm or differential corpus." },
  { target: "nltk.tokenize.regexp.WordPunctTokenizer", exports: ["WordPunctTokenizer", "wordPunctTokenize"], category: "rust-wasm", source: [
    { file: "src/tokenizers_treebank.ts", anchor: "export class WordPunctTokenizer" },
    { file: "rust/src/tokenizers.rs", anchor: "pub fn" },
  ], members: ["tokenize", "span_tokenize", "tokenize_sents", "span_tokenize_sents"], evidence: ["next-tokenizers"], gaps: ["Optional runtime constructor is an extension; scalar strings only through JSON. wordpunct_tokenize is a different ABI route and reviewed separately."], notes: "Rust token/span kernel; class/factory do NOT inherit helper's lone-surrogate behavior." },
  { target: "nltk.stem.porter.PorterStemmer", exports: ["PorterStemmer"], category: "rust-wasm", source: [
    { file: "src/porter_stemmer.ts", anchor: "stem(token: string, to_lowercase = true)" },
    { file: "src/nltk_compat_runtime.ts", anchor: "export function porterNltk" },
    { file: "rust/src/porter_nltk.rs", anchor: "pub fn stem" },
    { file: "rust/compat/src/lib.rs", anchor: "compat_porter" },
  ], evidence: ["next-compat-porter"], gaps: ["Three modes and to_lowercase supported; extra legacy algorithm=PORTER option is an adaptation; errors use JS types. porterStemAscii remains separate native ASCII convenience and is NOT covered by this differential."], notes: "Facade uses embedded compatibility WASM, not native porter.rs. Removing a reviewed export binding is an audit correction, not API deletion; existing regression policy needs explicit route-level review before applying." },
  { target: "nltk.tokenize.punkt.PunktTrainer", category: "rust-wasm", source: [
    { file: "src/punkt.ts", anchor: "export class PunktTrainer" },
    { file: "src/punkt_trainer.ts", anchor: "punktRequest" },
    { file: "rust/src/punkt_training.rs", anchor: "pub fn" },
  ], members: ["train", "get_params"], evidence: ["next-punkt-training"], gaps: ["TS retains/replays chunks and options; not bounded-memory incremental Rust state. train returns this; options object is package-specific. Custom languages/tokens, train_tokens, pruning and full trainer tuning absent. Zero orthographic entries omitted; scores tolerance 1e-10, not bitwise roundtrips."], notes: "Rust training core already present at base. This does not certify Python constructor/finalize_training or every inherited member; official model comparison is resource-dependent." },
  { target: "nltk.probability.MLEProbDist", category: "ts-algorithm", source: [
    { file: "src/probability.ts", anchor: "export class MLEProbDist" },
    { file: "src/freqdist.ts", anchor: "export class FreqDist" },
    { file: "rust/src/wasm_probability_contracts.rs", anchor: "6 =>" },
  ], evidence: ["next-probability-numeric"], gaps: ["Rust numerical prob/logprob; TS FreqDist max/samples/count storage. Generic equality/order/zero counts and inherited methods remain incomplete; no wholesale Rust object claim."], notes: "Not the previous TS-only arithmetic finding: scalar probabilities now execute Rust. Conservative mixed-object classification remains TS because counts/max/sample algorithms still reside there." },
  { target: "nltk.probability.LidstoneProbDist", category: "ts-algorithm", source: [
    { file: "src/probability.ts", anchor: "export class LidstoneProbDist" },
    { file: "src/freqdist.ts", anchor: "export class FreqDist" },
    { file: "rust/src/wasm_probability_contracts.rs", anchor: "7 =>" },
  ], evidence: ["next-probability-numeric"], gaps: ["Rust smoothing/divisor/logprob/discount kernels but TS counts/max/samples and bins checks. Python equality/order and full constructor/error-class domains not certified."], notes: "Independent distribution differential exists; it is not borrowed from classifier smoothing. Preserve mixed-object classification rather than claiming full Rust FreqDist ownership." },
  { target: "nltk.metrics.distance.jaccard_distance", category: "rust-wasm", source: [
    { file: "src/distance_metrics.ts", anchor: "export function jaccardDistance" },
    { file: "src/metrics_wasm.ts", anchor: "setScore(" },
    { file: "rust/src/metrics.rs", anchor: "pub fn" },
  ], evidence: ["next-evaluation"], gaps: ["JS Set SameValueZero/object identity, not Python structural equality/True==1. Empty union raises named ZeroDivisionError via RangeError adapter."], notes: "Rust set cardinality/score algorithm; TS interns labels, not an ASCII convenience path." },
  { target: "nltk.metrics.scores.precision", category: "rust-wasm", source: [
    { file: "src/distance_metrics.ts", anchor: "export function precision" },
    { file: "rust/src/metrics.rs", anchor: "pub fn" },
  ], evidence: ["next-evaluation"], gaps: ["JS Set equality adaptation; empty test returns null for Python None. General hashable equality and non-Set inputs not equivalent."], notes: "Rust scoring over interned IDs, not TS arithmetic." },
  { target: "nltk.metrics.segmentation.windowdiff", category: "rust-wasm", source: [
    { file: "src/distance_metrics.ts", anchor: "export function windowdiff" },
    { file: "rust/src/metrics.rs", anchor: "pub fn" },
  ], evidence: ["next-evaluation"], gaps: ["Strings or primitive arrays only; safe JS integers, not arbitrary Python integers. Boundary bool/int adaptation implemented; invalid-window JS errors differ."], notes: "Rust windows/counts/weighted scoring; TS marshals code points and Python bool/int boundary equality." },
  { target: "nltk.translate.chrf_score.sentence_chrf", category: "rust-wasm", source: [
    { file: "src/translation_metrics_extra.ts", anchor: "export function sentenceChrF" },
    { file: "rust/src/translation_metrics.rs", anchor: "pub fn" },
  ], evidence: ["next-translation"], gaps: ["Sentence path wraps corpusChrF with one pair; existing pinned block calls corpusChrF, not sentence helper independently. Options object, string-array joining and 1024-order bound are adaptations."], notes: "Rust character-ngram kernel with scoped corpus evidence; do not claim an independently exercised sentence differential." },
  { target: "nltk.translate.nist_score.corpus_nist", category: "rust-wasm", source: [
    { file: "src/translation_metrics_extra.ts", anchor: "export function corpusNist" },
    { file: "rust/src/translation_metrics.rs", anchor: "pub fn" },
  ], evidence: ["next-translation"], gaps: ["String token arrays only; options object rather than positional n. 1024-order bound; arbitrary Python hashable tokens and unbounded order excluded."], notes: "Rust counts/information/reference selection kernel; current root corpusNist really dispatches here, unlike legacy BLEU which remains TS." },
  { target: "nltk.util.ngrams", exports: ["ngrams", "ngrams_iter"], category: "rust-wasm", source: [
    { file: "src/nltk_compat.ts", anchor: "export function ngrams" },
    { file: "src/nltk_compat_runtime.ts", anchor: "export function* ngramsIterator" },
    { file: "rust/src/compat_ngrams.rs", anchor: "compat_ngram_next" },
  ], evidence: ["next-compat-ngrams"], gaps: ["Legacy ngrams returns eager arrays; ngrams_iter is additive. n=0 supported; RangeError for invalid n; max order 2147483647/max source items 4294967294. JS identity marshaling; caller must return abandoned iterator."], notes: "Rust owns sliding window/padding state; TS consumes iterables and interns object identity. Not normalized ASCII ngram APIs." },
];

const bindings: Manifest["signatureBindings"] = [
  { target: "nltk.stem.porter.PorterStemmer", callable: "PorterStemmer", signature: "(mode?: string, algorithm?: string) => PorterStemmer", file: "src/porter_stemmer.ts", anchor: "constructor(mode = \"NLTK_EXTENSIONS\", algorithm = \"PORTER\")" },
  { target: "nltk.stem.porter.PorterStemmer.stem", callable: "PorterStemmer.stem", signature: "(token: string, to_lowercase?: boolean) => string", file: "src/porter_stemmer.ts", anchor: "stem(token: string, to_lowercase = true)" },
  { target: "nltk.tokenize.treebank.TreebankWordTokenizer.tokenize", callable: "TreebankWordTokenizer.tokenize", signature: "(text: string, convertParentheses?: boolean, _returnStr?: boolean) => string[]", file: "src/tokenizers_treebank.ts", anchor: "tokenize(text: string, convertParentheses = false, _returnStr = false)" },
  ...["TreebankWordTokenizer", "WordPunctTokenizer"].flatMap((name) => {
    const target = name === "WordPunctTokenizer" ? "nltk.tokenize.regexp" : "nltk.tokenize.treebank";
    return [
      { target: `${target}.${name}.span_tokenize`, callable: `${name}.span_tokenize`, signature: "(text: string) => TokenSpan[]", file: "src/tokenizers_treebank.ts", anchor: "span_tokenize(text: string): TokenSpan[]" },
      { target: `${target}.${name}.tokenize_sents`, callable: `${name}.tokenize_sents`, signature: "(texts: readonly string[]) => string[][]", file: "src/tokenizers_treebank.ts", anchor: "tokenize_sents(texts: readonly string[]): string[][]" },
      { target: `${target}.${name}.span_tokenize_sents`, callable: `${name}.span_tokenize_sents`, signature: "(texts: readonly string[]) => TokenSpan[][]", file: "src/tokenizers_treebank.ts", anchor: "span_tokenize_sents(texts: readonly string[]): TokenSpan[][]" },
    ];
  }),
  { target: "nltk.tokenize.regexp.wordpunct_tokenize", callable: "wordpunct_tokenize", signature: "(text: string) => string[]", file: "src/nltk_compat.ts", anchor: "export function wordpunct_tokenize" },
  { target: "nltk.probability.MLEProbDist", callable: "MLEProbDist", signature: "<T>(freqDistValue: FreqDist<T>) => MLEProbDist<T>", file: "src/probability.ts", anchor: "constructor(freqDistValue: FreqDist<T>)" },
  { target: "nltk.probability.LidstoneProbDist", callable: "LidstoneProbDist", signature: "<T>(freqdist: FreqDist<T>, gamma: number, bins?: number) => LidstoneProbDist<T>", file: "src/probability.ts", anchor: "constructor(freqdist: FreqDist<T>, gamma: number, bins?: number)" },
  { target: "nltk.tokenize.punkt.PunktTrainer.train", callable: "PunktTrainer.train", signature: "(text: string, options?: PunktTrainingOptions) => this", file: "src/punkt.ts", anchor: "train(text: string, options: PunktTrainingOptions = {}): this" },
  { target: "nltk.tokenize.punkt.PunktTrainer.get_params", callable: "PunktTrainer.get_params", signature: "() => PunktModelSerialized", file: "src/punkt.ts", anchor: "get_params(): PunktModelSerialized" },
  { target: "nltk.metrics.distance.jaccard_distance", callable: "jaccardDistance", signature: "<T>(a: LabelSet<T>, b: LabelSet<T>) => number", file: "src/distance_metrics.ts", anchor: "export function jaccardDistance<T>(a: LabelSet<T>, b: LabelSet<T>)" },
  { target: "nltk.util.ngrams", callable: "ngrams", signature: "<T>(sequence: Iterable<T>, n: number) => T[][]; <T, P>(sequence: Iterable<T>, n: number, options: NgramOptions<P>) => Array<Array<T | P | null>>", file: "src/nltk_compat.ts", anchor: "export function ngrams<T, P>" },
];

/** Independent candidate view; applying it requires parent review, not --write. */
export function proposedNextReview(base: Manifest = loadManifest()): Manifest {
  const manifest = structuredClone(base);
  manifest.reviewBase = nextReviewBase;
  manifest.evidence.push(...structuredClone(evidence));
  for (const correction of corrections) {
    const mapping = manifest.mappings.find((mapping) => mapping.target === correction.target);
    if (!mapping) throw new Error(`missing base mapping: ${correction.target}`);
    mapping.category = correction.category;
    mapping.exports = correction.exports ?? mapping.exports;
    mapping.source = correction.source;
    mapping.evidence = correction.evidence;
    mapping.signatures.members = correction.members ?? mapping.signatures.members;
    mapping.signatures.status = "partial";
    mapping.signatures.gaps = correction.gaps;
    mapping.notes = correction.notes;
    // Mixed distribution objects and sentence ChrF retain partial status despite
    // real kernel evidence; this is not a class-wide or direct-sentence claim.
    mapping.status = correction.category === "ts-algorithm" || correction.target.endsWith("sentence_chrf") ? "partial" : "implemented-subset";
    mapping.fixtures = { status: "pinned-differential", gaps: correction.gaps };
  }
  manifest.mappings.push({
    target: "nltk.tokenize.regexp.wordpunct_tokenize", exports: ["wordpunct_tokenize"], category: "rust-wasm", status: "implemented-subset",
    source: [{ file: "src/nltk_compat_runtime.ts", anchor: "export function wordpunctNltk" }, { file: "rust/compat/src/lib.rs", anchor: "compat_wordpunct" }],
    signatures: { status: "adapted", members: [], gaps: ["Function only, not the class's inherited methods; separate u32 ABI preserves lone surrogates."] },
    evidence: ["next-compat-wordpunct"], fixtures: { status: "pinned-differential", gaps: ["Error-class hierarchy and arbitrary Python sequences excluded."] },
    notes: "Canonical bound helper differs from WordPunctTokenizer's JSON kernel route; do not merge by spelling or copy the helper evidence to the class.",
  });
  for (const binding of bindings) {
    const index = manifest.signatureBindings.findIndex((previous) => previous.target === binding.target);
    if (index === -1) manifest.signatureBindings.push(binding);
    else manifest.signatureBindings[index] = binding;
  }
  // Do not keep a falsely grouped NLTK-class review on an ASCII convenience.
  // No runtime export is removed: discovery still inventories this as unreviewed.
  delete manifest.reviewedRoutes["."]!.porterStemAscii;
  manifest.reviewedRoutes["."]!.ngrams_iter = "src/nltk_compat.ts";
  return manifest;
}
