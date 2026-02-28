import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type BenchResult = Record<string, unknown>;
type TrendConfig = {
  gate_min_speedup?: Record<string, number>;
};

function extractJson(payload: string): BenchResult {
  const start = payload.indexOf("{");
  const end = payload.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`unable to parse benchmark json: ${payload}`);
  }
  return JSON.parse(payload.slice(start, end + 1)) as BenchResult;
}

function run(command: string[], cwd: string): BenchResult {
  const proc = Bun.spawnSync(command, { cwd, stdout: "pipe", stderr: "pipe" });
  if (proc.exitCode !== 0) {
    throw new Error(
      `command failed (${command.join(" ")}):\n${new TextDecoder().decode(proc.stderr)}\n${new TextDecoder().decode(proc.stdout)}`,
    );
  }
  return extractJson(new TextDecoder().decode(proc.stdout).trim());
}

function assertAtLeast(metric: number, threshold: number, label: string): void {
  if (metric < threshold) {
    throw new Error(`${label} regression: ${metric.toFixed(2)}x < ${threshold.toFixed(2)}x`);
  }
}

function loadGateThresholds(root: string): Record<string, number> {
  const defaults: Record<string, number> = {
    token_ngram_x: 3.0,
    collocations_x: 5.0,
    porter_x: 3.0,
    wasm_x: 2.5,
    sentence_x: 1.5,
    punkt_x: 1.5,
    tagger_x: 2.0,
    lm_x: 1.1,
    chunk_x: 1.2,
    wordnet_x: 1.2,
    parser_x: 1.1,
    classifier_x: 0.7,
    pcfg_x: 1.1,
    maxent_x: 1.0,
    linear_x: 3.0,
    decision_tree_x: 1.1,
    earley_x: 1.1,
    leftcorner_x: 1.1,
    feature_parser_x: 1.1,
    feature_earley_x: 1.1,
    condexp_x: 1.0,
    positive_nb_x: 1.0,
  };
  try {
    const payload = JSON.parse(readFileSync(resolve(root, "bench", "trend-config.json"), "utf8")) as TrendConfig;
    const fromConfig = payload.gate_min_speedup ?? {};
    return { ...defaults, ...fromConfig };
  } catch {
    return defaults;
  }
}

function main() {
  const root = resolve(import.meta.dir, "..");
  const thresholds = loadGateThresholds(root);
  const dataset = "bench/datasets/gate_synthetic.txt";
  const datasetAbs = resolve(root, dataset);

  if (!existsSync(datasetAbs)) {
    const gen = Bun.spawnSync(
      ["python", "bench/generate_synthetic.py", "--size-mb", "8", "--seed", "1337", "--out", dataset],
      { cwd: root, stdout: "pipe", stderr: "pipe" },
    );
    if (gen.exitCode !== 0) {
      throw new Error(`failed to generate gate dataset: ${new TextDecoder().decode(gen.stderr)}`);
    }
  }

  const compare = run(["bun", "run", "bench/compare.ts", dataset, "2", "3"], root);
  const colloc = run(["bun", "run", "bench/compare_collocations.ts", dataset, "30", "3"], root);
  const porter = run(["bun", "run", "bench/compare_porter.ts", dataset, "2"], root);
  const wasm = run(["bun", "run", "bench/compare_wasm.ts", dataset, "2", "3"], root);
  const sentence = run(["bun", "run", "bench/compare_sentence.ts", dataset, "3"], root);
  const punkt = run(["bun", "run", "bench/compare_punkt.ts", dataset, "3"], root);
  const tagger = run(["bun", "run", "bench/compare_tagger.ts", dataset, "2"], root);
  const lm = run(["bun", "run", "bench/compare_lm.ts", dataset, "2"], root);
  const chunk = run(["bun", "run", "bench/compare_chunk.ts", "9000", "3"], root);
  const wordnet = run(["bun", "run", "bench/compare_wordnet.ts", "4"], root);
  const parser = run(["bun", "run", "bench/compare_parser.ts", "800", "3"], root);
  const classifier = run(["bun", "run", "bench/compare_classifier.ts", "1800", "450", "3"], root);
  const linear = run(["bun", "run", "bench/compare_linear_scores.ts", "6000", "12000", "6", "40", "3"], root);
  const decisionTree = run(["bun", "run", "bench/compare_decision_tree.ts", "2400", "600", "3"], root);
  const earley = run(["bun", "run", "bench/compare_earley.ts", "2000", "3"], root);
  const leftcorner = run(["bun", "run", "bench/compare_leftcorner.ts", "1200", "3"], root);
  const featureParser = run(["bun", "run", "bench/compare_feature_parser.ts", "1200", "3"], root);
  const featureEarley = run(["bun", "run", "bench/compare_feature_earley.ts", "1200", "3"], root);
  const pcfg = run(["bun", "run", "bench/compare_pcfg.ts", "700", "2"], root);
  const maxent = run(["bun", "run", "bench/compare_maxent.ts", "900", "250", "1"], root);
  const condexp = run(["bun", "run", "bench/compare_condexp.ts", "1000", "300", "2"], root);
  const positiveNb = run(["bun", "run", "bench/compare_positive_nb.ts", "800", "2400", "500", "3"], root);
  const parityAll = run(["bun", "run", "bench/parity_all.ts"], root);

  assertAtLeast(Number(compare.speedup_vs_python), thresholds.token_ngram_x!, "token/ngram");
  assertAtLeast(Number(colloc.speedup_vs_python), thresholds.collocations_x!, "collocations");
  assertAtLeast(Number(porter.speedup_vs_python), thresholds.porter_x!, "porter");
  assertAtLeast(Number(wasm.wasm_speedup_vs_python), thresholds.wasm_x!, "wasm");
  assertAtLeast(Number(sentence.speedup_vs_python), thresholds.sentence_x!, "sentence");
  assertAtLeast(Number(punkt.speedup_vs_python), thresholds.punkt_x!, "punkt");
  assertAtLeast(Number(tagger.speedup_vs_python), thresholds.tagger_x!, "tagger");
  assertAtLeast(Number(lm.speedup_vs_python), thresholds.lm_x!, "lm");
  assertAtLeast(Number(chunk.speedup_vs_python), thresholds.chunk_x!, "chunk");
  assertAtLeast(Number(wordnet.speedup_vs_python), thresholds.wordnet_x!, "wordnet");
  assertAtLeast(Number(parser.speedup_vs_python), thresholds.parser_x!, "parser");
  assertAtLeast(Number(classifier.speedup_vs_python), thresholds.classifier_x!, "classifier");
  assertAtLeast(Number(linear.speedup_vs_python), thresholds.linear_x!, "linear");
  assertAtLeast(Number(decisionTree.speedup_vs_python), thresholds.decision_tree_x!, "decision_tree");
  assertAtLeast(Number(earley.speedup_vs_python), thresholds.earley_x!, "earley");
  assertAtLeast(Number(leftcorner.speedup_vs_python), thresholds.leftcorner_x!, "leftcorner");
  assertAtLeast(Number(featureParser.speedup_vs_python), thresholds.feature_parser_x!, "feature_parser");
  assertAtLeast(Number(featureEarley.speedup_vs_python), thresholds.feature_earley_x!, "feature_earley");
  assertAtLeast(Number(pcfg.speedup_vs_python), thresholds.pcfg_x!, "pcfg");
  assertAtLeast(Number(maxent.speedup_vs_python), thresholds.maxent_x!, "maxent");
  assertAtLeast(Number(condexp.speedup_vs_python), thresholds.condexp_x!, "condexp");
  assertAtLeast(Number(positiveNb.speedup_vs_python), thresholds.positive_nb_x!, "positive_nb");

  if (!parityAll.ok) {
    throw new Error("global parity harness failed");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        thresholds: {
          token_ngram_x: thresholds.token_ngram_x,
          collocations_x: thresholds.collocations_x,
          porter_x: thresholds.porter_x,
          wasm_x: thresholds.wasm_x,
          sentence_x: thresholds.sentence_x,
          punkt_x: thresholds.punkt_x,
          tagger_x: thresholds.tagger_x,
          lm_x: thresholds.lm_x,
          chunk_x: thresholds.chunk_x,
          wordnet_x: thresholds.wordnet_x,
          parser_x: thresholds.parser_x,
          classifier_x: thresholds.classifier_x,
          linear_x: thresholds.linear_x,
          decision_tree_x: thresholds.decision_tree_x,
          earley_x: thresholds.earley_x,
          leftcorner_x: thresholds.leftcorner_x,
          feature_parser_x: thresholds.feature_parser_x,
          feature_earley_x: thresholds.feature_earley_x,
          pcfg_x: thresholds.pcfg_x,
          maxent_x: thresholds.maxent_x,
          condexp_x: thresholds.condexp_x,
          positive_nb_x: thresholds.positive_nb_x,
        },
        measured: {
          token_ngram_x: compare.speedup_vs_python,
          collocations_x: colloc.speedup_vs_python,
          porter_x: porter.speedup_vs_python,
          wasm_x: wasm.wasm_speedup_vs_python,
          sentence_x: sentence.speedup_vs_python,
          punkt_x: punkt.speedup_vs_python,
          tagger_x: tagger.speedup_vs_python,
          lm_x: lm.speedup_vs_python,
          chunk_x: chunk.speedup_vs_python,
          wordnet_x: wordnet.speedup_vs_python,
          parser_x: parser.speedup_vs_python,
          classifier_x: classifier.speedup_vs_python,
          linear_x: linear.speedup_vs_python,
          decision_tree_x: decisionTree.speedup_vs_python,
          earley_x: earley.speedup_vs_python,
          leftcorner_x: leftcorner.speedup_vs_python,
          feature_parser_x: featureParser.speedup_vs_python,
          feature_earley_x: featureEarley.speedup_vs_python,
          pcfg_x: pcfg.speedup_vs_python,
          maxent_x: maxent.speedup_vs_python,
          condexp_x: condexp.speedup_vs_python,
          positive_nb_x: positiveNb.speedup_vs_python,
        },
      },
      null,
      2,
    ),
  );
}

main();
