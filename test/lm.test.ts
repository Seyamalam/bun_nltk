import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { trainNgramLanguageModel, type LanguageModelType, type NgramLanguageModelOptions } from "../index";

type Probe = { word: string; context: string[] };
type PythonLmResult = {
  probeScores: Array<{ word: string; context: string[]; score: number; logScore: number }>;
  perplexity: number;
};

function runPythonLm(payload: {
  sentences: string[][];
  order: number;
  model: LanguageModelType;
  gamma: number;
  discount: number;
  probes: Probe[];
  perplexityTokens: string[];
  padLeft: boolean;
  padRight: boolean;
  startToken: string;
  endToken: string;
}): PythonLmResult {
  const proc = Bun.spawnSync(["python", "bench/python_lm_baseline.py", "--payload", JSON.stringify(payload)], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });

  if (proc.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(proc.stderr));
  }

  return JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as PythonLmResult;
}

const sentences = [
  ["the", "quick", "fox", "jumps"],
  ["the", "quick", "dog", "runs"],
  ["a", "fast", "dog", "sprints"],
  ["the", "dog", "runs", "fast"],
];

const probes: Probe[] = [
  { word: "fox", context: ["the", "quick"] },
  { word: "dog", context: ["the", "quick"] },
  { word: "runs", context: ["quick", "dog"] },
];

const perplexityTokens = ["the", "quick", "dog", "runs"];

function runParityCase(model: LanguageModelType, tolerance: number) {
  const options: NgramLanguageModelOptions = {
    order: 3,
    model,
    gamma: 0.2,
    discount: 0.75,
    padLeft: true,
    padRight: true,
    startToken: "<s>",
    endToken: "</s>",
  };
  const lm = trainNgramLanguageModel(sentences, options);
  const python = runPythonLm({
    sentences,
    order: options.order,
    model,
    gamma: options.gamma ?? 0.1,
    discount: options.discount ?? 0.75,
    probes,
    perplexityTokens,
    padLeft: options.padLeft ?? true,
    padRight: options.padRight ?? true,
    startToken: options.startToken ?? "<s>",
    endToken: options.endToken ?? "</s>",
  });

  const batch = lm.evaluateBatch(
    probes.map((probe) => ({ word: probe.word, context: probe.context })),
    perplexityTokens,
  );

  for (let i = 0; i < probes.length; i += 1) {
    const probe = probes[i]!;
    const jsScore = batch.scores[i]!;
    const pyScore = python.probeScores[i]!.score;
    expect(Math.abs(jsScore - pyScore)).toBeLessThanOrEqual(tolerance);
  }

  const jsPerplexity = batch.perplexity;
  expect(Math.abs(jsPerplexity - python.perplexity)).toBeLessThanOrEqual(tolerance * 20);
}

test("ngram lm parity: MLE", () => {
  runParityCase("mle", 1e-9);
});

test("ngram lm parity: Lidstone", () => {
  runParityCase("lidstone", 0.03);
});

test("ngram lm parity: Kneser-Ney interpolated", () => {
  runParityCase("kneser_ney_interpolated", 0.2);
});
