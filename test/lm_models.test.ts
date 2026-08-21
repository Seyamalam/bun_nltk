import { expect, test } from "bun:test";
import { resolve } from "node:path";
import {
  trainNgramLanguageModel,
  type LanguageModelType,
  type NgramLanguageModelOptions,
} from "../index";

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
  alpha: number;
  probes: Probe[];
  perplexityTokens: string[];
  padLeft: boolean;
  padRight: boolean;
  startToken: string;
  endToken: string;
}): PythonLmResult {
  const proc = Bun.spawnSync(["python3", "bench/python_lm_baseline.py", "--payload", JSON.stringify(payload)], {
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
  { word: "fast", context: [] },
  { word: "sprints", context: ["a"] },
];

const perplexityTokens = ["the", "quick", "dog", "runs"];

// Score tolerance is tight (1e-9): the JS formulas mirror nltk.lm arithmetic
// operation-for-operation, so only float association noise remains.
// Perplexity accumulates many log2 terms, so it gets the same relaxed
// score-tolerance x 20 slack used by test/lm.test.ts.
const SCORE_TOLERANCE = 1e-9;
const PERPLEXITY_TOLERANCE = SCORE_TOLERANCE * 20;

function runParityCase(model: LanguageModelType) {
  const options: NgramLanguageModelOptions = {
    order: 3,
    model,
    gamma: 0.2,
    discount: 0.75,
    alpha: 0.4,
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
    alpha: options.alpha ?? 0.4,
    probes,
    perplexityTokens,
    padLeft: options.padLeft ?? true,
    padRight: options.padRight ?? true,
    startToken: options.startToken ?? "<s>",
    endToken: options.endToken ?? "</s>",
  });

  for (let i = 0; i < probes.length; i += 1) {
    const probe = probes[i]!;
    const jsScore = lm.score(probe.word, probe.context);
    const pyScore = python.probeScores[i]!.score;
    expect(Math.abs(jsScore - pyScore)).toBeLessThanOrEqual(SCORE_TOLERANCE);
  }

  const jsPerplexity = lm.perplexity(perplexityTokens);
  expect(Math.abs(jsPerplexity - python.perplexity)).toBeLessThanOrEqual(PERPLEXITY_TOLERANCE);
}

test("ngram lm parity: StupidBackoff", () => {
  runParityCase("stupid_backoff");
});

test("ngram lm parity: Witten-Bell interpolated", () => {
  runParityCase("witten_bell_interpolated");
});

test("ngram lm parity: Absolute discounting interpolated", () => {
  runParityCase("absolute_discounting_interpolated");
});

test("StupidBackoff scores are backoff weights, not a distribution", () => {
  // NLTK caveat: same-order ngram scores do not sum to unity; alpha scales
  // each backoff step. Perplexity over these scores is only pseudo-perplexity.
  const lm = trainNgramLanguageModel(sentences, { order: 3, model: "stupid_backoff" });
  expect(lm.alpha).toBe(0.4);
  // Seen trigram: raw MLE ratio.
  expect(lm.score("fox", ["the", "quick"])).toBeCloseTo(1 / 2, 12);
  // Unseen bigram under seen unigram history: alpha * unigram freq.
  const expected = 0.4 * (lm.score("fox") as number);
  expect(lm.score("fox", ["a"])).toBeCloseTo(expected, 12);
});

test("new models route through the JS path (native gate)", () => {
  for (const model of [
    "stupid_backoff",
    "witten_bell_interpolated",
    "absolute_discounting_interpolated",
  ] as LanguageModelType[]) {
    const lm = trainNgramLanguageModel(sentences, { order: 3, model });
    const batch = lm.evaluateBatch(
      probes.map((probe) => ({ word: probe.word, context: probe.context })),
      perplexityTokens,
    );
    for (let i = 0; i < probes.length; i += 1) {
      expect(batch.scores[i]).toBe(lm.score(probes[i]!.word, probes[i]!.context));
    }
    expect(batch.perplexity).toBe(lm.perplexity(perplexityTokens));
  }
});
