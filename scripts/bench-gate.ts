import { existsSync } from "node:fs";
import { resolve } from "node:path";

type BenchResult = Record<string, unknown>;

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

function main() {
  const root = resolve(import.meta.dir, "..");
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
  const pcfg = run(["bun", "run", "bench/compare_pcfg.ts", "700", "2"], root);
  const maxent = run(["bun", "run", "bench/compare_maxent.ts", "900", "250", "1"], root);
  const parityAll = run(["bun", "run", "bench/parity_all.ts"], root);

  assertAtLeast(Number(compare.speedup_vs_python), 3.0, "token/ngram");
  assertAtLeast(Number(colloc.speedup_vs_python), 5.0, "collocations");
  assertAtLeast(Number(porter.speedup_vs_python), 3.0, "porter");
  assertAtLeast(Number(wasm.wasm_speedup_vs_python), 3.0, "wasm");
  assertAtLeast(Number(sentence.speedup_vs_python), 1.5, "sentence");
  assertAtLeast(Number(punkt.speedup_vs_python), 1.5, "punkt");
  assertAtLeast(Number(tagger.speedup_vs_python), 2.0, "tagger");
  assertAtLeast(Number(lm.speedup_vs_python), 1.1, "lm");
  assertAtLeast(Number(chunk.speedup_vs_python), 1.2, "chunk");
  assertAtLeast(Number(wordnet.speedup_vs_python), 1.2, "wordnet");
  assertAtLeast(Number(parser.speedup_vs_python), 1.1, "parser");
  assertAtLeast(Number(classifier.speedup_vs_python), 1.1, "classifier");
  assertAtLeast(Number(pcfg.speedup_vs_python), 1.1, "pcfg");
  assertAtLeast(Number(maxent.speedup_vs_python), 1.0, "maxent");

  if (!parityAll.ok) {
    throw new Error("global parity harness failed");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        thresholds: {
          token_ngram_x: 3.0,
          collocations_x: 5.0,
          porter_x: 3.0,
          wasm_x: 3.0,
          sentence_x: 1.5,
          punkt_x: 1.5,
          tagger_x: 2.0,
          lm_x: 1.1,
          chunk_x: 1.2,
          wordnet_x: 1.2,
          parser_x: 1.1,
          classifier_x: 1.1,
          pcfg_x: 1.1,
          maxent_x: 1.0,
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
          pcfg_x: pcfg.speedup_vs_python,
          maxent_x: maxent.speedup_vs_python,
        },
      },
      null,
      2,
    ),
  );
}

main();
