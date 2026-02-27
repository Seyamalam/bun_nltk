import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { tokenizeAsciiNative, trainNgramLanguageModel } from "../index";

type Probe = { word: string; context: string[] };
type PythonLmResult = {
  probeScores: Array<{ word: string; context: string[]; score: number; logScore: number }>;
  perplexity: number;
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function buildSentences(text: string, maxSentences = 3000, sentenceLen = 14): string[][] {
  const tokens = tokenizeAsciiNative(text);
  const maxTokens = Math.min(tokens.length, maxSentences * sentenceLen);
  const out: string[][] = [];
  for (let i = 0; i + sentenceLen <= maxTokens; i += sentenceLen) {
    out.push(tokens.slice(i, i + sentenceLen));
  }
  return out.length > 0 ? out : [["the", "model", "is", "fast"]];
}

function buildProbes(sentences: string[][]): Probe[] {
  const out: Probe[] = [];
  for (const sent of sentences.slice(0, 20)) {
    if (sent.length < 3) continue;
    out.push({
      context: [sent[0]!, sent[1]!],
      word: sent[2]!,
    });
  }
  return out.length > 0 ? out : [{ context: ["the", "model"], word: "is" }];
}

function runNative(sentences: string[][], probes: Probe[], perplexityTokens: string[], rounds: number) {
  const timings: number[] = [];
  let checksum = 0;
  let perplexity = 0;
  for (let i = 0; i < rounds; i += 1) {
    const started = performance.now();
    const model = trainNgramLanguageModel(sentences, {
      order: 3,
      model: "kneser_ney_interpolated",
      discount: 0.75,
    });
    let local = 0;
    for (const probe of probes) {
      local += model.score(probe.word, probe.context);
    }
    perplexity = model.perplexity(perplexityTokens);
    checksum = local;
    timings.push((performance.now() - started) / 1000);
  }
  return {
    checksum,
    perplexity,
    median_seconds: median(timings),
  };
}

function runPython(payload: {
  sentences: string[][];
  order: number;
  model: "kneser_ney_interpolated";
  gamma: number;
  discount: number;
  probes: Probe[];
  perplexityTokens: string[];
  padLeft: boolean;
  padRight: boolean;
  startToken: string;
  endToken: string;
}): PythonLmResult {
  const payloadPath = resolve(import.meta.dir, "datasets", "lm_payload.json");
  writeFileSync(payloadPath, JSON.stringify(payload), "utf8");
  const proc = Bun.spawnSync(["python", "bench/python_lm_baseline.py", "--payload-file", payloadPath], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  rmSync(payloadPath, { force: true });
  if (proc.exitCode !== 0) {
    throw new Error(`python lm baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  }
  return JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as PythonLmResult;
}

function main() {
  const inputPath = process.argv[2] ?? "bench/datasets/synthetic.txt";
  const rounds = Number(process.argv[3] ?? "3");
  const text = readFileSync(resolve(import.meta.dir, "..", inputPath), "utf8");

  const sentences = buildSentences(text);
  const probes = buildProbes(sentences);
  const perplexityTokens = sentences[Math.floor(sentences.length / 2)] ?? sentences[0]!;

  const native = runNative(sentences, probes, perplexityTokens, rounds);

  const pyStart = performance.now();
  const python = runPython({
    sentences,
    order: 3,
    model: "kneser_ney_interpolated",
    gamma: 0.1,
    discount: 0.75,
    probes,
    perplexityTokens,
    padLeft: true,
    padRight: true,
    startToken: "<s>",
    endToken: "</s>",
  });
  const pythonSeconds = (performance.now() - pyStart) / 1000;

  const pythonChecksum = python.probeScores.reduce((acc, row) => acc + row.score, 0);
  const parity =
    Math.abs(native.checksum - pythonChecksum) <= 0.5 &&
    Math.abs(native.perplexity - python.perplexity) <= 0.5;

  console.log(
    JSON.stringify(
      {
        dataset: inputPath,
        rounds,
        model: "kneser_ney_interpolated",
        parity_tolerant: parity,
        native_seconds_median: native.median_seconds,
        python_seconds: pythonSeconds,
        speedup_vs_python: pythonSeconds / native.median_seconds,
        native_checksum: native.checksum,
        python_checksum: pythonChecksum,
        native_perplexity: native.perplexity,
        python_perplexity: python.perplexity,
      },
      null,
      2,
    ),
  );
}

main();
