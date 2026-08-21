import { resolve } from "node:path";
import { trainNgramLanguageModel, type LanguageModelType } from "../index";

type Probe = { word: string; context: string[] };
type PythonLmResult = {
  probeScores: Array<{ word: string; context: string[]; score: number; logScore: number }>;
  perplexity: number;
};

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

// Score tolerance is tight (1e-9): the JS formulas mirror nltk.lm arithmetic
// operation-for-operation, so only float association noise remains.
// Perplexity accumulates many log2 terms, so it gets the same relaxed
// score-tolerance x 20 slack used by test/lm.test.ts.
const SCORE_TOLERANCE = 1e-9;
const PERPLEXITY_TOLERANCE = SCORE_TOLERANCE * 20;

function checkModel(model: LanguageModelType) {
  const lm = trainNgramLanguageModel(sentences, {
    order: 3,
    model,
    gamma: 0.2,
    discount: 0.75,
    alpha: 0.4,
    padLeft: true,
    padRight: true,
    startToken: "<s>",
    endToken: "</s>",
  });
  const python = runPythonLm({
    sentences,
    order: 3,
    model,
    gamma: 0.2,
    discount: 0.75,
    alpha: 0.4,
    probes,
    perplexityTokens,
    padLeft: true,
    padRight: true,
    startToken: "<s>",
    endToken: "</s>",
  });

  const jsScores = probes.map((probe) => lm.score(probe.word, probe.context));
  const maxScoreDelta = Math.max(
    ...jsScores.map((score, i) => Math.abs(score - python.probeScores[i]!.score)),
  );
  const jsPerplexity = lm.perplexity(perplexityTokens);
  const perplexityDelta = Math.abs(jsPerplexity - python.perplexity);

  return {
    model,
    parity_tolerant: maxScoreDelta <= SCORE_TOLERANCE && perplexityDelta <= PERPLEXITY_TOLERANCE,
    max_score_delta: maxScoreDelta,
    js_perplexity: jsPerplexity,
    python_perplexity: python.perplexity,
    perplexity_delta: perplexityDelta,
  };
}

const models: LanguageModelType[] = [
  "stupid_backoff",
  "witten_bell_interpolated",
  "absolute_discounting_interpolated",
];

const results = models.map(checkModel);
console.log(
  JSON.stringify(
    {
      parity_tolerant: results.every((row) => row.parity_tolerant),
      models: results,
    },
    null,
    2,
  ),
);
