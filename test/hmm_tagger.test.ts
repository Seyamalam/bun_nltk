import { expect, test } from "bun:test";
import type { FreqDist } from "../src/freqdist";
import { resolve } from "node:path";
import {
  HiddenMarkovModelTagger,
  HiddenMarkovModelTrainer,
  type Estimator,
  untag,
  untagSents,
} from "../src/hmm_tagger";
import { LidstoneProbDist } from "../src/probability";
import type { GoldSentence } from "../src/sequential_taggers";

const trainCorpus: GoldSentence[] = [
  [["the", "DT"], ["cat", "NN"], ["sleeps", "VBZ"], [".", "."]],
  [["a", "DT"], ["dog", "NN"], ["barks", "VBZ"], [".", "."]],
  [["the", "DT"], ["dog", "NN"], ["runs", "VBZ"], ["fast", "RB"], [".", "."]],
  [["she", "PRP"], ["reads", "VBZ"], ["a", "DT"], ["book", "NN"], [".", "."]],
  [["they", "PRP"], ["book", "VB"], ["a", "DT"], ["table", "NN"], [".", "."]],
  [["he", "PRP"], ["will", "MD"], ["book", "VB"], ["flights", "NNS"], [".", "."]],
  [["i", "PRP"], ["read", "VBP"], ["the", "DT"], ["book", "NN"], [".", "."]],
  [["the", "DT"], ["birds", "NNS"], ["sing", "VBP"], ["sweetly", "RB"], [".", "."]],
];

const goldSents: GoldSentence[] = [
  ...trainCorpus,
  [["the", "DT"], ["zorp", "NN"], ["sleeps", "VBZ"], [".", "."]],
];

const testSents: string[][] = [
  ["the", "cat", "sleeps", "."],
  ["zorp", "the", "quux", "."],
  ["she", "will", "book", "a", "flight", "."],
];

test("supervised training derives states and symbols in first-occurrence order", () => {
  const tagger = HiddenMarkovModelTagger.train(trainCorpus);
  expect(tagger.states).toEqual([
    "DT",
    "NN",
    "VBZ",
    ".",
    "RB",
    "PRP",
    "VB",
    "MD",
    "NNS",
    "VBP",
  ]);
  expect(tagger.symbols[0]).toBe("the");
  expect(new Set(tagger.symbols).size).toBe(tagger.symbols.length);
  expect(tagger.toString()).toBe(
    `<HiddenMarkovModelTagger ${tagger.states.length} states and ${tagger.symbols.length} output symbols>`,
  );
});

test("trainer class appends states and symbols while counting transitions", () => {
  const trainer = new HiddenMarkovModelTrainer(["DT"], ["the"]);
  expect(trainer.states).toEqual(["DT"]);
  expect(trainer.symbols).toEqual(["the"]);
  const tagger = trainer.trainSupervised(trainCorpus);
  expect(tagger.states[0]).toBe("DT");
  expect(tagger.symbols[0]).toBe("the");
  expect(tagger.states).toContain("VBZ");
});

test("transition distributions are smoothed over all states and sum to one", () => {
  const tagger = HiddenMarkovModelTagger.train(trainCorpus);
  for (const fromState of tagger.states) {
    let total = 0;
    for (const toState of tagger.states) {
      total += tagger.transitionProb(fromState, toState);
      expect(tagger.transitionProb(fromState, toState)).toBeGreaterThan(0);
    }
    expect(total).toBeCloseTo(1, 9);
  }
  // unseen transition still gets Lidstone mass
  expect(tagger.transitionProb(".", "VB")).toBeGreaterThan(0);
  let priorTotal = 0;
  for (const state of tagger.states) priorTotal += tagger.priorProb(state);
  expect(priorTotal).toBeCloseTo(1, 9);
});

test("emission distributions cover every training symbol plus unseen words", () => {
  const tagger = HiddenMarkovModelTagger.train(trainCorpus);
  expect(tagger.emissionProb("DT", "the")).toBeGreaterThan(0);
  // unknown words get nonzero probability via smoothing bins
  expect(tagger.emissionProb("NN", "zzzzunseen")).toBeGreaterThan(0);
  for (const state of tagger.states) {
    let total = 0;
    for (const symbol of tagger.symbols) total += tagger.emissionProb(state, symbol);
    expect(total).toBeCloseTo(1, 9);
  }
});

test("viterbi tags seen sentences exactly and handles unknown words", () => {
  const tagger = HiddenMarkovModelTagger.train(trainCorpus);
  expect(tagger.tag(["the", "cat", "sleeps", "."])).toEqual([
    ["the", "DT"],
    ["cat", "NN"],
    ["sleeps", "VBZ"],
    [".", "."],
  ]);
  expect(tagger.tagSents(testSents)).toHaveLength(testSents.length);
  // unseen word falls back to a plausible tag rather than crashing
  const taggedUnknown = tagger.tag(["zzzunseen"])[0]!;
  expect(taggedUnknown[0]).toBe("zzzunseen");
  expect(tagger.states).toContain(taggedUnknown[1]!);
  expect(tagger.bestPath(["the", "dog"])).toHaveLength(2);
});

test("unknown words resolve through smoothed emissions and transitions", () => {
  const tagger = HiddenMarkovModelTagger.train(trainCorpus);
  // after "the", the strong DT->NN transition dominates for an unseen token
  expect(tagger.tag(["the", "qqqxyz"])[1]![1]).toBe("NN");
  // a lone unseen token gets some valid tag (smoothing-driven backoff)
  const [word, tag] = tagger.tag(["qqqxyz"])[0]!;
  expect(word).toBe("qqqxyz");
  expect(tagger.states).toContain(tag);
});

test("evaluate computes token accuracy over gold sentences", () => {
  const tagger = HiddenMarkovModelTagger.train(trainCorpus);
  expect(tagger.evaluate(goldSents)).toBeGreaterThan(0.8);
  expect(tagger.evaluate(goldSents)).toBeLessThanOrEqual(1);
  expect(tagger.evaluate([])).toBe(0);
});

test("logProbability matches manual joint computation and supports unlabeled input", () => {
  const tagger = HiddenMarkovModelTagger.train(trainCorpus);
  const sentence: GoldSentence = [["the", "DT"], ["cat", "NN"]];
  const manual =
    tagger.priorLogProb("DT") +
    tagger.emissionLogProb("DT", "the") +
    tagger.transitionLogProb("DT", "NN") +
    tagger.emissionLogProb("NN", "cat");
  expect(tagger.logProbability(sentence)).toBeCloseTo(manual, 12);
  expect(tagger.logProbability(["the", "cat"])).not.toBeNaN();
  expect(tagger.probability(["the", "cat"])).toBeGreaterThan(0);
});

test("untag strips tags from tagged sentences", () => {
  expect(untag([["the", "DT"], ["cat", "NN"]] as const)).toEqual(["the", "cat"]);
  expect(untagSents([goldSents[0]!])).toEqual([["the", "cat", "sleeps", "."]]);
});

test("custom estimator changes smoothing behavior", () => {
  const tagger = HiddenMarkovModelTagger.train(trainCorpus, {
    estimator: ((fd: FreqDist<string>, bins: number) => new LidstoneProbDist(fd, 1.0, bins)) as unknown as Estimator,
  });
  const defaultTagger = HiddenMarkovModelTagger.train(trainCorpus);
  // heavier smoothing shrinks the MLE gap between frequent and rare emissions
  const gapSmoothed =
    tagger.emissionProb("DT", "the") - tagger.emissionProb("DT", "cat");
  const gapDefault =
    defaultTagger.emissionProb("DT", "the") - defaultTagger.emissionProb("DT", "cat");
  expect(gapSmoothed).toBeLessThan(gapDefault);
});

test("python3 nltk baseline parity", () => {
  const payload = JSON.stringify({
    train: trainCorpus,
    test: testSents,
    gold: goldSents,
    models: [{ name: "hmm_default", smoothing: 0.1 }],
  });
  const proc = Bun.spawnSync(
    ["python3", "bench/python_hmm_baseline.py", "--payload", payload],
    {
      cwd: resolve(import.meta.dir, ".."),
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  if (proc.exitCode !== 0) {
    throw new Error(`python baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  }
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as {
    models: Array<{
      name: string;
      num_states: number;
      num_symbols: number;
      repr: string;
      tagged: Array<Array<[string, string]>>;
      eval: number;
      priors: Record<string, number>;
    }>;
  };
  const estimator: Estimator = (fd, bins) => new LidstoneProbDist(fd as unknown as FreqDist<string>, 0.1, bins) as unknown as ReturnType<Estimator>;
  const tagger = HiddenMarkovModelTagger.train(trainCorpus, { estimator });
  const tagged = tagger.tagSents(testSents);
  const jsModel = {
    name: "hmm_default",
    num_states: tagger.states.length,
    num_symbols: tagger.symbols.length,
    repr: tagger.toString(),
    tagged,
    eval: Math.round(tagger.evaluate(goldSents) * 1e12) / 1e12,
  };
  const pyModel = py.models[0]!;
  expect(jsModel.name).toBe(pyModel.name);
  expect(jsModel.num_states).toBe(pyModel.num_states);
  expect(jsModel.repr).toBe(pyModel.repr);
  expect(jsModel.tagged).toEqual(pyModel.tagged);
  expect(jsModel.eval).toBe(pyModel.eval);
  for (const [state, prob] of Object.entries(pyModel.priors)) {
    expect(tagger.priorProb(state)).toBeCloseTo(prob, 9);
  }
});
