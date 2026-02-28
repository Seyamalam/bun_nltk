import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { computeAsciiMetrics, loadPerceptronTaggerModel, normalizeTokens, posTagPerceptronAscii } from "../index";

type JsonMap = Record<string, unknown>;

function parseJsonOutput(raw: string): JsonMap {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error(`could not parse JSON output: ${raw}`);
  }
  return JSON.parse(raw.slice(start, end + 1)) as JsonMap;
}

function run(command: string[], cwd: string): JsonMap {
  const proc = Bun.spawnSync(command, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    throw new Error(
      `command failed (${command.join(" ")}):\n${new TextDecoder().decode(proc.stderr)}\n${new TextDecoder().decode(proc.stdout)}`,
    );
  }
  return parseJsonOutput(new TextDecoder().decode(proc.stdout).trim());
}

function toNum(v: unknown): number {
  return typeof v === "number" ? v : Number(v);
}

function pctFaster(speedup: number): number {
  return (speedup - 1) * 100;
}

function maybeGc(): void {
  const fn = (Bun as unknown as { gc?: (force?: boolean) => void }).gc;
  if (typeof fn === "function") fn(true);
}

function memoryProfile(text: string) {
  const rssSamples: number[] = [];
  const heapSamples: number[] = [];
  const sample = () => {
    const m = process.memoryUsage();
    rssSamples.push(m.rss);
    heapSamples.push(m.heapUsed);
  };

  maybeGc();
  sample();

  computeAsciiMetrics(text, 2);
  sample();

  normalizeTokens(text, { removeStopwords: true, stem: true });
  sample();

  const model = loadPerceptronTaggerModel();
  posTagPerceptronAscii(text, { model });
  sample();

  const rssPeak = Math.max(...rssSamples);
  const rssMin = Math.min(...rssSamples);
  const heapPeak = Math.max(...heapSamples);
  const heapMin = Math.min(...heapSamples);

  return {
    rss_baseline_mb: Number((rssMin / 1024 / 1024).toFixed(2)),
    rss_peak_mb: Number((rssPeak / 1024 / 1024).toFixed(2)),
    rss_delta_mb: Number(((rssPeak - rssMin) / 1024 / 1024).toFixed(2)),
    heap_baseline_mb: Number((heapMin / 1024 / 1024).toFixed(2)),
    heap_peak_mb: Number((heapPeak / 1024 / 1024).toFixed(2)),
    heap_delta_mb: Number(((heapPeak - heapMin) / 1024 / 1024).toFixed(2)),
  };
}

function main() {
  const root = resolve(import.meta.dir, "..");
  const artifactsDir = resolve(root, "artifacts");
  mkdirSync(artifactsDir, { recursive: true });

  const dataset = "bench/datasets/gate_synthetic.txt";
  const datasetAbs = resolve(root, dataset);
  if (!existsSync(datasetAbs)) {
    const gen = Bun.spawnSync(
      ["python", "bench/generate_synthetic.py", "--size-mb", "8", "--seed", "1337", "--out", dataset],
      { cwd: root, stdout: "pipe", stderr: "pipe" },
    );
    if (gen.exitCode !== 0) {
      throw new Error(`failed to generate dataset: ${new TextDecoder().decode(gen.stderr)}`);
    }
  }

  const compare = run(["bun", "run", "bench/compare.ts", dataset, "2", "3"], root);
  const colloc = run(["bun", "run", "bench/compare_collocations.ts", dataset, "30", "3"], root);
  const porter = run(["bun", "run", "bench/compare_porter.ts", dataset, "2"], root);
  const wasm = run(["bun", "run", "bench/compare_wasm.ts", dataset, "2", "3"], root);
  const sentence = run(["bun", "run", "bench/compare_sentence.ts", dataset, "3"], root);
  const punkt = run(["bun", "run", "bench/compare_punkt.ts", dataset, "3"], root);
  const tagger = run(["bun", "run", "bench/compare_tagger.ts", dataset, "1"], root);
  const lm = run(["bun", "run", "bench/compare_lm.ts", dataset, "2"], root);
  const chunk = run(["bun", "run", "bench/compare_chunk.ts", "9000", "3"], root);
  const wordnet = run(["bun", "run", "bench/compare_wordnet.ts", "4"], root);
  const parser = run(["bun", "run", "bench/compare_parser.ts", "800", "3"], root);
  const leftcorner = run(["bun", "run", "bench/compare_leftcorner.ts", "1200", "3"], root);
  const featureParser = run(["bun", "run", "bench/compare_feature_parser.ts", "1200", "3"], root);
  const featureEarley = run(["bun", "run", "bench/compare_feature_earley.ts", "1200", "3"], root);
  const classifier = run(["bun", "run", "bench/compare_classifier.ts", "1800", "450", "3"], root);
  const linear = run(["bun", "run", "bench/compare_linear_scores.ts", "6000", "12000", "6", "40", "3"], root);
  const decisionTree = run(["bun", "run", "bench/compare_decision_tree.ts", "2400", "600", "3"], root);
  const earley = run(["bun", "run", "bench/compare_earley.ts", "2000", "3"], root);
  const pcfg = run(["bun", "run", "bench/compare_pcfg.ts", "700", "2"], root);
  const maxent = run(["bun", "run", "bench/compare_maxent.ts", "900", "250", "1"], root);
  const condexp = run(["bun", "run", "bench/compare_condexp.ts", "1000", "300", "2"], root);
  const positiveNb = run(["bun", "run", "bench/compare_positive_nb.ts", "800", "2400", "500", "3"], root);
  const paritySentence = run(["bun", "run", "bench/parity_sentence.ts"], root);
  const parityTagger = run(["bun", "run", "bench/parity_tagger.ts"], root);
  const parityAll = run(["bun", "run", "bench/parity_all.ts"], root);

  const text = readFileSync(datasetAbs, "utf8");
  const mem = memoryProfile(text);

  const tokenThroughput = toNum(compare.native?.tokens ?? 0) / toNum(compare.native_seconds_median);
  const sentenceThroughput = toNum(sentence.native_sentence_count) / toNum(sentence.native_seconds_median);
  const taggerThroughput = toNum(tagger.token_count) / toNum(tagger.native_seconds_median);

  const dashboard = {
    generated_at: new Date().toISOString(),
    dataset,
    parity: {
      all: Boolean(parityAll.ok),
      tokenizer: Boolean(parityAll.checks?.tokenizer),
      sentence: Boolean(paritySentence.parity),
      punkt: Boolean(parityAll.checks?.punkt),
      punkt_extended: Boolean(parityAll.checks?.punkt_extended),
      lm: Boolean(parityAll.checks?.lm),
      chunk: Boolean(parityAll.checks?.chunk),
      wordnet: Boolean(parityAll.checks?.wordnet),
      parser: Boolean(parityAll.checks?.parser),
      classifier: Boolean(parityAll.checks?.classifier),
      pcfg: Boolean(parityAll.checks?.pcfg),
      maxent: Boolean(parityAll.checks?.maxent),
      decision_tree: Boolean(parityAll.checks?.decision_tree),
      earley: Boolean(parityAll.checks?.earley),
      leftcorner: Boolean(parityAll.checks?.leftcorner),
      feature_parser: Boolean(parityAll.checks?.feature_parser),
      feature_earley: Boolean(parityAll.checks?.feature_earley),
      corpus_imported: Boolean(parityAll.checks?.corpus_imported),
      imported: Boolean(parityAll.checks?.imported),
      tagger: Boolean(parityTagger.parity),
      condexp: Boolean(parityAll.checks?.condexp),
      positive_nb: Boolean(parityAll.checks?.positive_nb),
    },
    speedups: {
      token_ngram_x: toNum(compare.speedup_vs_python),
      collocations_x: toNum(colloc.speedup_vs_python),
      porter_x: toNum(porter.speedup_vs_python),
      wasm_x: toNum(wasm.wasm_speedup_vs_python),
      sentence_x: toNum(sentence.speedup_vs_python),
      punkt_x: toNum(punkt.speedup_vs_python),
      tagger_x: toNum(tagger.speedup_vs_python),
      lm_x: toNum(lm.speedup_vs_python),
      chunk_x: toNum(chunk.speedup_vs_python),
      wordnet_x: toNum(wordnet.speedup_vs_python),
      parser_x: toNum(parser.speedup_vs_python),
      leftcorner_x: toNum(leftcorner.speedup_vs_python),
      feature_parser_x: toNum(featureParser.speedup_vs_python),
      feature_earley_x: toNum(featureEarley.speedup_vs_python),
      classifier_x: toNum(classifier.speedup_vs_python),
      linear_x: toNum(linear.speedup_vs_python),
      decision_tree_x: toNum(decisionTree.speedup_vs_python),
      earley_x: toNum(earley.speedup_vs_python),
      pcfg_x: toNum(pcfg.speedup_vs_python),
      maxent_x: toNum(maxent.speedup_vs_python),
      condexp_x: toNum(condexp.speedup_vs_python),
      positive_nb_x: toNum(positiveNb.speedup_vs_python),
    },
    percent_faster: {
      token_ngram_pct: pctFaster(toNum(compare.speedup_vs_python)),
      collocations_pct: pctFaster(toNum(colloc.speedup_vs_python)),
      porter_pct: pctFaster(toNum(porter.speedup_vs_python)),
      wasm_pct: pctFaster(toNum(wasm.wasm_speedup_vs_python)),
      sentence_pct: pctFaster(toNum(sentence.speedup_vs_python)),
      punkt_pct: pctFaster(toNum(punkt.speedup_vs_python)),
      tagger_pct: pctFaster(toNum(tagger.speedup_vs_python)),
      lm_pct: pctFaster(toNum(lm.speedup_vs_python)),
      chunk_pct: pctFaster(toNum(chunk.speedup_vs_python)),
      wordnet_pct: pctFaster(toNum(wordnet.speedup_vs_python)),
      parser_pct: pctFaster(toNum(parser.speedup_vs_python)),
      leftcorner_pct: pctFaster(toNum(leftcorner.speedup_vs_python)),
      feature_parser_pct: pctFaster(toNum(featureParser.speedup_vs_python)),
      feature_earley_pct: pctFaster(toNum(featureEarley.speedup_vs_python)),
      classifier_pct: pctFaster(toNum(classifier.speedup_vs_python)),
      linear_pct: pctFaster(toNum(linear.speedup_vs_python)),
      decision_tree_pct: pctFaster(toNum(decisionTree.speedup_vs_python)),
      earley_pct: pctFaster(toNum(earley.speedup_vs_python)),
      pcfg_pct: pctFaster(toNum(pcfg.speedup_vs_python)),
      maxent_pct: pctFaster(toNum(maxent.speedup_vs_python)),
      condexp_pct: pctFaster(toNum(condexp.speedup_vs_python)),
      positive_nb_pct: pctFaster(toNum(positiveNb.speedup_vs_python)),
    },
    throughput: {
      token_per_sec: Number(tokenThroughput.toFixed(2)),
      sentence_per_sec: Number(sentenceThroughput.toFixed(2)),
      tagged_tokens_per_sec: Number(taggerThroughput.toFixed(2)),
    },
    memory_profile: mem,
    raw: {
      compare,
      colloc,
      porter,
      wasm,
      sentence,
      punkt,
      tagger,
      lm,
      chunk,
      wordnet,
      parser,
      leftcorner,
      feature_parser: featureParser,
      feature_earley: featureEarley,
      classifier,
      linear,
      decision_tree: decisionTree,
      earley,
      pcfg,
      maxent,
      condexp,
      positive_nb: positiveNb,
    },
  };

  const md = [
    "# Bench Dashboard",
    "",
    `Generated: ${dashboard.generated_at}`,
    `Dataset: ${dataset}`,
    "",
    "| Workload | Speedup (x) | Faster (%) |",
    "|---|---:|---:|",
    `| token/ngram | ${dashboard.speedups.token_ngram_x.toFixed(2)} | ${dashboard.percent_faster.token_ngram_pct.toFixed(2)} |`,
    `| collocations | ${dashboard.speedups.collocations_x.toFixed(2)} | ${dashboard.percent_faster.collocations_pct.toFixed(2)} |`,
    `| porter | ${dashboard.speedups.porter_x.toFixed(2)} | ${dashboard.percent_faster.porter_pct.toFixed(2)} |`,
    `| wasm | ${dashboard.speedups.wasm_x.toFixed(2)} | ${dashboard.percent_faster.wasm_pct.toFixed(2)} |`,
    `| sentence | ${dashboard.speedups.sentence_x.toFixed(2)} | ${dashboard.percent_faster.sentence_pct.toFixed(2)} |`,
    `| punkt | ${dashboard.speedups.punkt_x.toFixed(2)} | ${dashboard.percent_faster.punkt_pct.toFixed(2)} |`,
    `| tagger | ${dashboard.speedups.tagger_x.toFixed(2)} | ${dashboard.percent_faster.tagger_pct.toFixed(2)} |`,
    `| lm | ${dashboard.speedups.lm_x.toFixed(2)} | ${dashboard.percent_faster.lm_pct.toFixed(2)} |`,
    `| chunk | ${dashboard.speedups.chunk_x.toFixed(2)} | ${dashboard.percent_faster.chunk_pct.toFixed(2)} |`,
    `| wordnet | ${dashboard.speedups.wordnet_x.toFixed(2)} | ${dashboard.percent_faster.wordnet_pct.toFixed(2)} |`,
    `| parser | ${dashboard.speedups.parser_x.toFixed(2)} | ${dashboard.percent_faster.parser_pct.toFixed(2)} |`,
    `| leftcorner | ${dashboard.speedups.leftcorner_x.toFixed(2)} | ${dashboard.percent_faster.leftcorner_pct.toFixed(2)} |`,
    `| feature_parser | ${dashboard.speedups.feature_parser_x.toFixed(2)} | ${dashboard.percent_faster.feature_parser_pct.toFixed(2)} |`,
    `| feature_earley | ${dashboard.speedups.feature_earley_x.toFixed(2)} | ${dashboard.percent_faster.feature_earley_pct.toFixed(2)} |`,
    `| classifier | ${dashboard.speedups.classifier_x.toFixed(2)} | ${dashboard.percent_faster.classifier_pct.toFixed(2)} |`,
    `| linear | ${dashboard.speedups.linear_x.toFixed(2)} | ${dashboard.percent_faster.linear_pct.toFixed(2)} |`,
    `| decision_tree | ${dashboard.speedups.decision_tree_x.toFixed(2)} | ${dashboard.percent_faster.decision_tree_pct.toFixed(2)} |`,
    `| earley | ${dashboard.speedups.earley_x.toFixed(2)} | ${dashboard.percent_faster.earley_pct.toFixed(2)} |`,
    `| pcfg | ${dashboard.speedups.pcfg_x.toFixed(2)} | ${dashboard.percent_faster.pcfg_pct.toFixed(2)} |`,
    `| maxent | ${dashboard.speedups.maxent_x.toFixed(2)} | ${dashboard.percent_faster.maxent_pct.toFixed(2)} |`,
    `| condexp | ${dashboard.speedups.condexp_x.toFixed(2)} | ${dashboard.percent_faster.condexp_pct.toFixed(2)} |`,
    `| positive_nb | ${dashboard.speedups.positive_nb_x.toFixed(2)} | ${dashboard.percent_faster.positive_nb_pct.toFixed(2)} |`,
    "",
    "| Throughput Metric | Value |",
    "|---|---:|",
    `| tokens/sec | ${dashboard.throughput.token_per_sec} |`,
    `| sentences/sec | ${dashboard.throughput.sentence_per_sec} |`,
    `| tagged tokens/sec | ${dashboard.throughput.tagged_tokens_per_sec} |`,
    "",
    "| Memory Metric | MB |",
    "|---|---:|",
    `| rss baseline | ${dashboard.memory_profile.rss_baseline_mb} |`,
    `| rss peak | ${dashboard.memory_profile.rss_peak_mb} |`,
    `| rss delta | ${dashboard.memory_profile.rss_delta_mb} |`,
    `| heap baseline | ${dashboard.memory_profile.heap_baseline_mb} |`,
    `| heap peak | ${dashboard.memory_profile.heap_peak_mb} |`,
    `| heap delta | ${dashboard.memory_profile.heap_delta_mb} |`,
    "",
    `Parity all: ${dashboard.parity.all}`,
    `Parity tokenizer: ${dashboard.parity.tokenizer}`,
    `Parity sentence: ${dashboard.parity.sentence}`,
    `Parity punkt: ${dashboard.parity.punkt}`,
    `Parity punkt_extended: ${dashboard.parity.punkt_extended}`,
    `Parity lm: ${dashboard.parity.lm}`,
    `Parity chunk: ${dashboard.parity.chunk}`,
    `Parity wordnet: ${dashboard.parity.wordnet}`,
    `Parity parser: ${dashboard.parity.parser}`,
    `Parity classifier: ${dashboard.parity.classifier}`,
    `Parity decision_tree: ${dashboard.parity.decision_tree}`,
    `Parity earley: ${dashboard.parity.earley}`,
    `Parity leftcorner: ${dashboard.parity.leftcorner}`,
    `Parity feature_parser: ${dashboard.parity.feature_parser}`,
    `Parity feature_earley: ${dashboard.parity.feature_earley}`,
    `Parity corpus_imported: ${dashboard.parity.corpus_imported}`,
    `Parity pcfg: ${dashboard.parity.pcfg}`,
    `Parity maxent: ${dashboard.parity.maxent}`,
    `Parity condexp: ${dashboard.parity.condexp}`,
    `Parity positive_nb: ${dashboard.parity.positive_nb}`,
    `Parity imported fixtures: ${dashboard.parity.imported}`,
    `Parity tagger: ${dashboard.parity.tagger}`,
    "",
  ].join("\n");

  const jsonPath = resolve(artifactsDir, "bench-dashboard.json");
  const mdPath = resolve(artifactsDir, "bench-dashboard.md");
  writeFileSync(jsonPath, JSON.stringify(dashboard, null, 2), "utf8");
  writeFileSync(mdPath, md, "utf8");

  if (process.env.GITHUB_STEP_SUMMARY) {
    Bun.write(process.env.GITHUB_STEP_SUMMARY, md);
  }

  console.log(JSON.stringify({ ok: true, json: jsonPath, markdown: mdPath }, null, 2));
}

main();
