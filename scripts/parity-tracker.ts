import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type Status = "implemented" | "partial" | "missing";

type Item = {
  module: string;
  feature: string;
  status: Status;
  notes: string;
  tests: string[];
  benches: string[];
};

function main() {
  const items: Item[] = [
    {
      module: "tokenize",
      feature: "word_tokenize subset",
      status: "implemented",
      notes: "PTB-like contractions supported for subset behavior.",
      tests: ["test/tokenizers.test.ts"],
      benches: [],
    },
    {
      module: "tokenize",
      feature: "tweet_tokenize subset",
      status: "implemented",
      notes: "Handles emoji ZWJ, handles stripping/reduceLen options.",
      tests: ["test/tokenizers.test.ts"],
      benches: [],
    },
    {
      module: "tokenize",
      feature: "punkt sentence tokenize",
      status: "partial",
      notes: "Fast native/WASM path + trainable subset + NLTK-style trainer/tokenizer wrappers, not full upstream model parity.",
      tests: ["test/punkt.test.ts", "test/sentence_tokenizer.test.ts"],
      benches: ["bench/compare_punkt.ts", "bench/compare_sentence.ts"],
    },
    {
      module: "wordnet",
      feature: "synset/lemma lookup + morphy",
      status: "partial",
      notes: "Mini + extended bundles + packed format loader + graph traversal helpers, not full WordNet DB yet.",
      tests: ["test/wordnet.test.ts"],
      benches: ["bench/compare_wordnet.ts"],
    },
    {
      module: "lm",
      feature: "MLE/Lidstone/KneserNeyInterpolated",
      status: "implemented",
      notes: "TS model with native/WASM ID evaluation hot loop.",
      tests: ["test/lm.test.ts"],
      benches: ["bench/compare_lm.ts"],
    },
    {
      module: "chunk",
      feature: "RegexpParser-style chunking + IOB",
      status: "implemented",
      notes: "Native/WASM chunk matcher for compiled grammar atoms.",
      tests: ["test/chunk.test.ts"],
      benches: ["bench/compare_chunk.ts"],
    },
    {
      module: "corpora",
      feature: "raw/words/sents/paras + category/file filtering",
      status: "implemented",
      notes: "Bundled mini corpora + external bundle loading + imported NLTK corpus snapshot parity.",
      tests: ["test/corpus.test.ts", "test/corpus_readers.test.ts", "test/corpus_registry.test.ts"],
      benches: ["bench/parity_corpus_imported.ts"],
    },
    {
      module: "tag",
      feature: "POS tagging",
      status: "implemented",
      notes: "Rule-based baseline + perceptron model native/WASM paths.",
      tests: ["test/tagger.test.ts", "test/perceptron_tagger.test.ts"],
      benches: ["bench/compare_tagger.ts"],
    },
    {
      module: "metrics",
      feature: "FreqDist/ConditionalFreqDist/collocations/stemming",
      status: "implemented",
      notes: "Native primitives with parity and benchmark coverage.",
      tests: ["test/native.test.ts", "test/nltk-coverage.test.ts"],
      benches: ["bench/compare.ts", "bench/compare_collocations.ts", "bench/compare_porter.ts", "bench/compare_freqdist_stream.ts"],
    },
    {
      module: "parse",
      feature: "CFG/PCFG/chart parsing",
      status: "partial",
      notes: "CFG + PCFG chart parsing + Earley + recursive descent + lightweight dependency parsing; additional parser families still pending.",
      tests: ["test/parse.test.ts", "test/pcfg.test.ts"],
      benches: ["bench/compare_parser.ts", "bench/compare_pcfg.ts", "bench/compare_earley.ts"],
    },
    {
      module: "classify",
      feature: "classifiers (NaiveBayes/MaxEnt/etc.)",
      status: "partial",
      notes: "Naive Bayes + MaxEnt + DecisionTree + Logistic + LinearSVM + Perceptron implemented; additional classifier families pending.",
      tests: ["test/classify.test.ts", "test/maxent.test.ts", "test/decision_tree.test.ts", "test/linear_models.test.ts", "test/perceptron_classifier.test.ts"],
      benches: ["bench/compare_classifier.ts", "bench/compare_maxent.ts", "bench/compare_decision_tree.ts", "bench/compare_linear_scores.ts"],
    },
  ];

  const totals = {
    implemented: items.filter((i) => i.status === "implemented").length,
    partial: items.filter((i) => i.status === "partial").length,
    missing: items.filter((i) => i.status === "missing").length,
  };
  const coveragePct = (totals.implemented / items.length) * 100;

  const report = {
    generated_at: new Date().toISOString(),
    total_items: items.length,
    totals,
    implemented_coverage_percent: Number(coveragePct.toFixed(2)),
    items,
  };

  const artifacts = resolve(import.meta.dir, "..", "artifacts");
  mkdirSync(artifacts, { recursive: true });
  writeFileSync(resolve(artifacts, "parity-tracker.json"), JSON.stringify(report, null, 2), "utf8");

  const md: string[] = [];
  md.push("# NLTK Parity Tracker");
  md.push("");
  md.push(`- Total items: ${items.length}`);
  md.push(`- Implemented: ${totals.implemented}`);
  md.push(`- Partial: ${totals.partial}`);
  md.push(`- Missing: ${totals.missing}`);
  md.push(`- Implemented coverage: ${report.implemented_coverage_percent}%`);
  md.push("");
  md.push("| Module | Feature | Status | Tests | Benches | Notes |");
  md.push("|---|---|---|---|---|---|");
  for (const item of items) {
    md.push(
      `| ${item.module} | ${item.feature} | ${item.status} | ${item.tests.join("<br>") || "-"} | ${item.benches.join("<br>") || "-"} | ${item.notes} |`,
    );
  }
  writeFileSync(resolve(artifacts, "parity-tracker.md"), `${md.join("\n")}\n`, "utf8");

  console.log(JSON.stringify({ ok: true, coverage: report.implemented_coverage_percent }, null, 2));
}

main();
