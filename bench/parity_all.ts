import { existsSync } from "node:fs";
import { resolve } from "node:path";

type JsonObj = Record<string, unknown>;

function extractJson(payload: string): JsonObj {
  const start = payload.indexOf("{");
  const end = payload.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`unable to parse json payload: ${payload}`);
  }
  return JSON.parse(payload.slice(start, end + 1)) as JsonObj;
}

function run(command: string[], cwd: string): JsonObj {
  const proc = Bun.spawnSync(command, { cwd, stdout: "pipe", stderr: "pipe" });
  if (proc.exitCode !== 0) {
    throw new Error(
      `command failed (${command.join(" ")}):\n${new TextDecoder().decode(proc.stderr)}\n${new TextDecoder().decode(proc.stdout)}`,
    );
  }
  return extractJson(new TextDecoder().decode(proc.stdout).trim());
}

function ensureGateDataset(root: string): string {
  const dataset = "bench/datasets/gate_synthetic.txt";
  const full = resolve(root, dataset);
  if (existsSync(full)) return dataset;
  const proc = Bun.spawnSync(
    ["python", "bench/generate_synthetic.py", "--size-mb", "8", "--seed", "1337", "--out", dataset],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  if (proc.exitCode !== 0) {
    throw new Error(`failed to generate gate dataset: ${new TextDecoder().decode(proc.stderr)}`);
  }
  return dataset;
}

function main() {
  const root = resolve(import.meta.dir, "..");
  const dataset = ensureGateDataset(root);

  const tokenizer = run(["bun", "run", "bench/parity_tokenizer.ts"], root);
  const sentence = run(["bun", "run", "bench/parity_sentence.ts"], root);
  const punkt = run(["bun", "run", "bench/parity_punkt.ts"], root);
  const lm = run(["bun", "run", "bench/compare_lm.ts", dataset, "1"], root);
  const chunk = run(["bun", "run", "bench/compare_chunk.ts", "3000", "1"], root);
  const wordnet = run(["bun", "run", "bench/parity_wordnet.ts"], root);
  const parser = run(["bun", "run", "bench/parity_parser.ts"], root);
  const classifier = run(["bun", "run", "bench/parity_classifier.ts"], root);
  const pcfg = run(["bun", "run", "bench/parity_pcfg.ts"], root);
  const maxent = run(["bun", "run", "bench/parity_maxent.ts"], root);
  const tagger = run(["bun", "run", "bench/parity_tagger.ts"], root);
  const importedFixturePath = resolve(root, "test", "fixtures", "nltk_imported", "pcfg_treebank_fixture.json");
  const imported = existsSync(importedFixturePath) ? run(["bun", "run", "bench/parity_imported.ts"], root) : { parity: true };

  const checks = {
    tokenizer: Boolean(tokenizer.parity),
    sentence: Boolean(sentence.parity),
    punkt: Boolean(punkt.parity),
    lm: Boolean(lm.parity_tolerant),
    chunk: Boolean(chunk.parity_sample_400),
    wordnet: Boolean(wordnet.parity),
    parser: Boolean(parser.parity),
    classifier: Boolean(classifier.parity),
    pcfg: Boolean(pcfg.parity),
    maxent: Boolean(maxent.parity),
    imported: Boolean(imported.parity),
    tagger: Boolean(tagger.parity),
  };

  const failed = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);
  if (failed.length > 0) {
    throw new Error(`parity suite failed: ${failed.join(", ")}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        checks,
      },
      null,
      2,
    ),
  );
}

main();
