import { existsSync } from "node:fs";
import { delimiter, resolve } from "node:path";
import { classifyParity, missingFixtureResult, summarizeParity, type CheckResult } from "../scripts/parity-status";
function ensureGateDataset(root: string): string {
  const dataset = "bench/datasets/gate_synthetic.txt";
  const full = resolve(root, dataset);
  if (existsSync(full)) return dataset;
  const proc = Bun.spawnSync(
    [
      "python3",
      "bench/generate_synthetic.py",
      "--size-mb",
      "8",
      "--seed",
      "1337",
      "--out",
      dataset,
    ],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  if (proc.exitCode !== 0) {
    throw new Error(`failed to generate gate dataset: ${new TextDecoder().decode(proc.stderr)}`);
  }
  return dataset;
}

const root = resolve(import.meta.dir, "..");
const localBin = resolve(root, ".venv/bin");
const env = existsSync(resolve(localBin, "python3"))
  ? { ...process.env, PATH: `${localBin}${delimiter}${process.env.PATH ?? ""}` }
  : process.env;
let dataset: string;
try {
  dataset = ensureGateDataset(root);
} catch {
  dataset = "bench/datasets/gate_synthetic.txt";
}
const definitions: [string, string[], string[]][] = [
  ["statistical_models", ["bun", "run", "bench/parity_statistical.ts"], ["parity"]],
  ["tokenizer", ["bun", "run", "bench/parity_tokenizer.ts"], ["parity"]],
  ["tokenizer_family", ["bun", "run", "bench/parity_tokenizer_family.ts"], ["parity"]],
  ["sentence", ["bun", "run", "bench/parity_sentence.ts"], ["parity"]],
  ["punkt", ["bun", "run", "bench/parity_punkt.ts"], ["parity"]],
  ["punkt_extended", ["bun", "run", "bench/parity_punkt_extended.ts"], ["parity"]],
  ["stemmers", ["bun", "run", "bench/parity_stemmers.ts"], ["parity"]],
  ["translation_metrics", ["bun", "run", "bench/parity_metrics.ts"], ["parity"]],
  ["sentiment", ["bun", "run", "bench/parity_sentiment.ts"], ["parity"]],
  ["lm", ["bun", "run", "bench/compare_lm.ts", dataset, "1"], ["parity_exact"]],
  ["chunk", ["bun", "run", "bench/compare_chunk.ts", "3000", "1"], ["parity_sample_400"]],
  ["wordnet", ["bun", "run", "bench/parity_wordnet.ts"], ["parity"]],
  ["wordnet_compat", ["bun", "run", "bench/parity_wordnet_compat.ts"], ["parity"]],
  ["parser", ["bun", "run", "bench/parity_parser.ts"], ["parity"]],
  ["classifier", ["bun", "run", "bench/parity_classifier.ts"], ["parity"]],
  ["pcfg", ["bun", "run", "bench/parity_pcfg.ts"], ["parity"]],
  ["maxent", ["bun", "run", "bench/parity_maxent.ts"], ["parity"]],
  ["decision_tree", ["bun", "run", "bench/parity_decision_tree.ts"], ["parity"]],
  ["earley", ["bun", "run", "bench/parity_earley.ts"], ["parity"]],
  ["leftcorner", ["bun", "run", "bench/parity_leftcorner.ts"], ["parity"]],
  ["feature_parser", ["bun", "run", "bench/parity_feature_parser.ts"], ["parity"]],
  ["feature_earley", ["bun", "run", "bench/parity_feature_earley.ts"], ["parity"]],
  ["corpus_imported", ["bun", "run", "bench/parity_corpus_imported.ts"], ["parity"]],
  ["imported", ["bun", "run", "bench/parity_imported.ts"], ["parity"]],
  ["tagger", ["bun", "run", "bench/parity_tagger.ts"], ["parity"]],
  ["condexp", ["bun", "run", "bench/parity_condexp.ts"], ["parity"]],
  ["positive_nb", ["bun", "run", "bench/parity_positive_nb.ts"], ["parity"]],
  ["distance", ["bun", "run", "bench/parity_distance.ts"], ["parity"]],
  ["seq_taggers", ["bun", "run", "bench/parity_seq_taggers.ts"], ["parity"]],
  ["wsd", ["bun", "run", "bench/parity_wsd.ts"], ["parity"]],
  ["chrf_nist", ["bun", "run", "bench/parity_chrf_nist.ts"], ["parity"]],
  ["lm_models", ["bun", "run", "bench/parity_lm_models.ts"], ["parity_tolerant", "parity"]],
  ["snowball", ["bun", "run", "bench/parity_snowball.ts"], ["parity"]],
  ["brill", ["bun", "run", "bench/parity_brill.ts"], ["parity"]],
  ["hmm_tagger", ["bun", "run", "bench/parity_hmm_tagger.ts"], ["parity_tolerant", "parity"]],
  ["agreement", ["bun", "run", "bench/parity_agreement.ts"], ["parity"]],
  ["sem_logic", ["bun", "run", "bench/parity_sem.ts"], ["parity"]],
  ["bleu_nist_wasm", ["bun", "run", "bench/parity_bleu_nist_wasm.ts"], ["parity"]],
  ["nltk_models", ["bun", "run", "bench/parity_nltk_models.ts"], ["parity"]],
];
const results: Record<string, CheckResult> = {};
for (const [name, command, keys] of definitions) {
  const requiredFixtures =
    name === "imported"
      ? ["pcfg_treebank_fixture.json", "classifier_movie_reviews_fixture.json"]
      : name === "corpus_imported"
        ? ["corpus_subsets_fixture.json"]
        : [];
  const missing = missingFixtureResult(
    requiredFixtures.map((file) => resolve(root, "test/fixtures/nltk_imported", file)),
  );
  if (missing) {
    results[name] = missing;
    continue;
  }

  const proc = Bun.spawnSync(command, { cwd: root, env, stdout: "pipe", stderr: "pipe" });
  const stdout = new TextDecoder().decode(proc.stdout),
    stderr = new TextDecoder().decode(proc.stderr);
  try {
    const evidence = JSON.parse(stdout.slice(stdout.indexOf("{"), stdout.lastIndexOf("}") + 1));
    results[name] = classifyParity(proc.exitCode, evidence, keys);
    if (proc.exitCode !== 0)
      results[name]!.reason = stderr.trim() || `process exited ${proc.exitCode}`;
  } catch {
    results[name] = {
      status: "failed",
      required: true,
      reason: stderr.trim() || stdout.trim() || "No JSON evidence",
    };
  }
}
results.gui_integrations = {
  status: "unsupported",
  required: false,
  reason: "Tkinter/matplotlib app and drawing shims do not provide upstream GUI behavior.",
};
results.network_integrations = {
  status: "unsupported",
  required: false,
  reason:
    "Twitter/network-service integrations requiring credentials are outside the behavioral gate.",
};
results.external_java_integrations = {
  status: "unsupported",
  required: false,
  reason:
    "Stanford/CoreNLP/Malt external Java integrations are outside this gate; no behavioral parity claim.",
};
const report = summarizeParity(results);
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
