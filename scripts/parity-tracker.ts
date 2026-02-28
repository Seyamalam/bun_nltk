import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type Status = "implemented" | "partial" | "missing";

type DashboardParity = Record<string, boolean>;
type DashboardSpeedups = Record<string, number>;

type ItemDef = {
  module: string;
  feature: string;
  requiredParity: string[];
  requiredSpeedups?: string[];
  tests: string[];
  benches: string[];
  caveat?: string;
};

type Item = {
  module: string;
  feature: string;
  status: Status;
  notes: string;
  tests: string[];
  benches: string[];
};

function extractJson(payload: string): Record<string, unknown> {
  const start = payload.indexOf("{");
  const end = payload.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`unable to parse json payload: ${payload}`);
  }
  return JSON.parse(payload.slice(start, end + 1)) as Record<string, unknown>;
}

function run(command: string[], cwd: string): Record<string, unknown> {
  const proc = Bun.spawnSync(command, { cwd, stdout: "pipe", stderr: "pipe" });
  if (proc.exitCode !== 0) {
    throw new Error(
      `command failed (${command.join(" ")}):\n${new TextDecoder().decode(proc.stderr)}\n${new TextDecoder().decode(proc.stdout)}`,
    );
  }
  return extractJson(new TextDecoder().decode(proc.stdout).trim());
}

function loadParityAndSpeedups(root: string): { parity: DashboardParity; speedups: DashboardSpeedups } {
  const dashboardPath = resolve(root, "artifacts", "bench-dashboard.json");
  if (existsSync(dashboardPath)) {
    const dashboard = JSON.parse(readFileSync(dashboardPath, "utf8")) as {
      parity?: DashboardParity;
      speedups?: DashboardSpeedups;
    };
    return {
      parity: dashboard.parity ?? {},
      speedups: dashboard.speedups ?? {},
    };
  }

  const parityAll = run(["bun", "run", "bench/parity_all.ts"], root) as {
    checks?: DashboardParity;
  };
  return {
    parity: parityAll.checks ?? {},
    speedups: {},
  };
}

function statusFromChecks(
  def: ItemDef,
  parity: DashboardParity,
  speedups: DashboardSpeedups,
): { status: Status; notes: string } {
  const parityKeys = def.requiredParity;
  const parityPass = parityKeys.filter((key) => Boolean(parity[key]));
  const parityAllPass = parityPass.length === parityKeys.length;

  const speedKeys = def.requiredSpeedups ?? [];
  const speedKnown = speedKeys.filter((key) => Number.isFinite(speedups[key]));
  const speedPass = speedKnown.filter((key) => (speedups[key] ?? 0) >= 1);
  const speedAllPass = speedKeys.length === 0 || (speedKnown.length === speedKeys.length && speedPass.length === speedKeys.length);

  let status: Status;
  if (parityAllPass && speedAllPass) status = "implemented";
  else if (parityPass.length > 0 || speedPass.length > 0) status = "partial";
  else status = "missing";

  const pieces = [
    `parity ${parityPass.length}/${parityKeys.length}`,
    speedKeys.length > 0
      ? speedKnown.length === speedKeys.length
        ? `speedup>=1 ${speedPass.length}/${speedKeys.length}`
        : `speedup>=1 ${speedPass.length}/${speedKeys.length} (incomplete metrics)`
      : null,
    def.caveat ?? null,
  ].filter((item): item is string => Boolean(item));

  return { status, notes: pieces.join("; ") };
}

function main() {
  const root = resolve(import.meta.dir, "..");
  const { parity, speedups } = loadParityAndSpeedups(root);

  const defs: ItemDef[] = [
    {
      module: "tokenize",
      feature: "word/tweet/sentence/punkt subsets",
      requiredParity: ["tokenizer", "sentence", "punkt", "punkt_extended"],
      requiredSpeedups: ["sentence_x", "punkt_x"],
      tests: ["test/tokenizers.test.ts", "test/sentence_tokenizer.test.ts", "test/punkt.test.ts", "test/punkt_extended_parity.test.ts"],
      benches: ["bench/parity_tokenizer.ts", "bench/parity_sentence.ts", "bench/parity_punkt.ts", "bench/parity_punkt_extended.ts"],
      caveat: "subset-focused tokenizer scope, not full upstream tokenizer matrix",
    },
    {
      module: "wordnet",
      feature: "lookup + graph relations + similarity",
      requiredParity: ["wordnet"],
      requiredSpeedups: ["wordnet_x"],
      tests: ["test/wordnet.test.ts", "test/wordnet_python_parity.test.ts"],
      benches: ["bench/parity_wordnet.ts", "bench/compare_wordnet.ts"],
      caveat: "official packed corpus preferred at runtime when present",
    },
    {
      module: "lm",
      feature: "MLE/Lidstone/KneserNeyInterpolated",
      requiredParity: ["lm"],
      requiredSpeedups: ["lm_x"],
      tests: ["test/lm.test.ts"],
      benches: ["bench/compare_lm.ts"],
    },
    {
      module: "chunk",
      feature: "RegexpParser-style chunking + IOB",
      requiredParity: ["chunk"],
      requiredSpeedups: ["chunk_x"],
      tests: ["test/chunk.test.ts"],
      benches: ["bench/compare_chunk.ts"],
    },
    {
      module: "corpora",
      feature: "raw/words/sents/paras + imported parity",
      requiredParity: ["corpus_imported", "imported"],
      tests: ["test/corpus.test.ts", "test/corpus_readers.test.ts", "test/corpus_registry.test.ts"],
      benches: ["bench/parity_corpus_imported.ts", "bench/parity_imported.ts"],
    },
    {
      module: "tag",
      feature: "POS tagging",
      requiredParity: ["tagger"],
      requiredSpeedups: ["tagger_x"],
      tests: ["test/tagger.test.ts", "test/perceptron_tagger.test.ts"],
      benches: ["bench/compare_tagger.ts"],
    },
    {
      module: "metrics",
      feature: "FreqDist/ConditionalFreqDist/collocations/stemming",
      requiredParity: ["tokenizer"],
      requiredSpeedups: ["token_ngram_x", "collocations_x", "porter_x"],
      tests: ["test/native.test.ts", "test/nltk-coverage.test.ts"],
      benches: ["bench/compare.ts", "bench/compare_collocations.ts", "bench/compare_porter.ts", "bench/compare_freqdist_stream.ts"],
    },
    {
      module: "parse",
      feature: "CFG/PCFG/Earley/left-corner/feature chart+earley",
      requiredParity: ["parser", "pcfg", "earley", "leftcorner", "feature_parser", "feature_earley"],
      requiredSpeedups: ["parser_x", "pcfg_x", "earley_x", "leftcorner_x", "feature_parser_x", "feature_earley_x"],
      tests: ["test/parse.test.ts", "test/pcfg.test.ts", "test/feature_parse.test.ts"],
      benches: [
        "bench/compare_parser.ts",
        "bench/compare_pcfg.ts",
        "bench/compare_earley.ts",
        "bench/compare_leftcorner.ts",
        "bench/compare_feature_parser.ts",
        "bench/compare_feature_earley.ts",
      ],
    },
    {
      module: "classify",
      feature: "NB/PositiveNB/MaxEnt/CondExp/DecisionTree/Linear/Perceptron",
      requiredParity: ["classifier", "maxent", "decision_tree", "condexp", "positive_nb"],
      requiredSpeedups: ["classifier_x", "maxent_x", "decision_tree_x", "condexp_x", "positive_nb_x"],
      tests: [
        "test/classify.test.ts",
        "test/maxent.test.ts",
        "test/conditional_exponential.test.ts",
        "test/decision_tree.test.ts",
        "test/linear_models.test.ts",
        "test/perceptron_classifier.test.ts",
        "test/positive_naive_bayes.test.ts",
      ],
      benches: [
        "bench/compare_classifier.ts",
        "bench/compare_maxent.ts",
        "bench/compare_condexp.ts",
        "bench/compare_decision_tree.ts",
        "bench/compare_linear_scores.ts",
        "bench/compare_positive_nb.ts",
      ],
    },
  ];

  const items: Item[] = defs.map((def) => {
    const computed = statusFromChecks(def, parity, speedups);
    return {
      module: def.module,
      feature: def.feature,
      status: computed.status,
      notes: computed.notes,
      tests: def.tests,
      benches: def.benches,
    };
  });

  const totals = {
    implemented: items.filter((i) => i.status === "implemented").length,
    partial: items.filter((i) => i.status === "partial").length,
    missing: items.filter((i) => i.status === "missing").length,
  };
  const coveragePct = (totals.implemented / items.length) * 100;

  const report = {
    generated_at: new Date().toISOString(),
    source: existsSync(resolve(root, "artifacts", "bench-dashboard.json")) ? "artifacts/bench-dashboard.json" : "bench/parity_all.ts",
    total_items: items.length,
    totals,
    implemented_coverage_percent: Number(coveragePct.toFixed(2)),
    items,
  };

  const artifacts = resolve(root, "artifacts");
  mkdirSync(artifacts, { recursive: true });
  writeFileSync(resolve(artifacts, "parity-tracker.json"), JSON.stringify(report, null, 2), "utf8");

  const md: string[] = [];
  md.push("# NLTK Parity Tracker");
  md.push("");
  md.push(`- Source: ${report.source}`);
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

  console.log(JSON.stringify({ ok: true, coverage: report.implemented_coverage_percent, source: report.source }, null, 2));
}

main();
