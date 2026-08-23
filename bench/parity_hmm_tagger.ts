import { resolve } from "node:path";
import { HiddenMarkovModelTagger, type Estimator } from "../src/hmm_tagger";
import type { GoldSentence } from "../src/sequential_taggers";
import { LidstoneProbDist } from "../src/probability";

type ModelSpec = { name: string; smoothing: number };

const trainCorpus: GoldSentence[] = [
  [["the", "DT"], ["cat", "NN"], ["sleeps", "VBZ"], [".", "."]],
  [["a", "DT"], ["dog", "NN"], ["barks", "VBZ"], [".", "."]],
  [["the", "DT"], ["dog", "NN"], ["runs", "VBZ"], ["fast", "RB"], [".", "."]],
  [["she", "PRP"], ["reads", "VBZ"], ["a", "DT"], ["book", "NN"], [".", "."]],
  [["they", "PRP"], ["book", "VB"], ["a", "DT"], ["table", "NN"], [".", "."]],
  [["he", "PRP"], ["will", "MD"], ["book", "VB"], ["flights", "NNS"], [".", "."]],
  [["i", "PRP"], ["read", "VBP"], ["the", "DT"], ["book", "NN"], [".", "."]],
  [["we", "PRP"], ["dance", "VBP"], ["every", "DT"], ["night", "NN"], [".", "."]],
  [["the", "DT"], ["dance", "NN"], ["was", "VBD"], ["beautiful", "JJ"], [".", "."]],
  [["birds", "NNS"], ["fly", "VBP"], ["south", "RB"], [".", "."]],
  [["the", "DT"], ["birds", "NNS"], ["sing", "VBP"], ["sweetly", "RB"], [".", "."]],
  [["a", "DT"], ["child", "NN"], ["plays", "VBZ"], ["outside", "RB"], [".", "."]],
  [["children", "NNS"], ["play", "VBP"], ["games", "NNS"], [".", "."]],
  [["the", "DT"], ["old", "JJ"], ["man", "NN"], ["walks", "VBZ"], ["slowly", "RB"], [".", "."]],
  [["she", "PRP"], ["is", "VBZ"], ["very", "RB"], ["happy", "JJ"], [".", "."]],
  [["it", "PRP"], ["rained", "VBD"], ["yesterday", "NN"], [".", "."]],
  [["the", "DT"], ["sun", "NN"], ["shines", "VBZ"], ["brightly", "RB"], [".", "."]],
  [["he", "PRP"], ["ate", "VBD"], ["three", "CD"], ["apples", "NNS"], [".", "."]],
  [["ten", "CD"], ["students", "NNS"], ["study", "VBP"], ["hard", "RB"], [".", "."]],
  [["the", "DT"], ["quick", "JJ"], ["fox", "NN"], ["jumps", "VBZ"], [".", "."]],
  [["a", "DT"], ["lazy", "JJ"], ["dog", "NN"], ["sleeps", "VBZ"], ["all", "DT"], ["day", "NN"], [".", "."]],
  [["music", "NN"], ["makes", "VBZ"], ["people", "NNS"], ["dance", "VB"], [".", "."]],
  [["her", "PRP$"], ["smile", "NN"], ["brightens", "VBZ"], ["rooms", "NNS"], [".", "."]],
  [["the", "DT"], ["meeting", "NN"], ["starts", "VBZ"], ["at", "IN"], ["noon", "NN"], [".", "."]],
  [["we", "PRP"], ["talk", "VBP"], ["about", "IN"], ["weather", "NN"], [".", "."]],
  [["the", "DT"], ["fish", "NN"], ["swims", "VBZ"], ["in", "IN"], ["water", "NN"], [".", "."]],
  [["cold", "JJ"], ["water", "NN"], ["freezes", "VBZ"], ["quickly", "RB"], [".", "."]],
  [["teachers", "NNS"], ["inspire", "VBP"], ["young", "JJ"], ["minds", "NNS"], [".", "."]],
  [["the", "DT"], ["engine", "NN"], ["roars", "VBZ"], ["loudly", "RB"], [".", "."]],
  [["fresh", "JJ"], ["bread", "NN"], ["smells", "VBZ"], ["wonderful", "JJ"], [".", "."]],
  [["he", "PRP"], ["can", "MD"], ["swim", "VB"], ["very", "RB"], ["well", "RB"], [".", "."]],
  [["a", "DT"], ["storm", "NN"], ["may", "MD"], ["arrive", "VB"], ["tonight", "NN"], [".", "."]],
  [["the", "DT"], ["chef", "NN"], ["cooked", "VBD"], ["dinner", "NN"], ["for", "IN"], ["us", "PRP"], [".", "."]],
  [["tall", "JJ"], ["trees", "NNS"], ["grow", "VBP"], ["here", "RB"], [".", "."]],
  [["the", "DT"], ["movie", "NN"], ["was", "VBD"], ["long", "JJ"], ["and", "CC"], ["boring", "JJ"], [".", "."]],
];

const goldSents: GoldSentence[] = [
  ...trainCorpus,
  [["the", "DT"], ["zorp", "NN"], ["sleeps", "VBZ"], [".", "."]],
  [["flights", "NNS"], ["fly", "VBP"], [".", "."]],
  [["she", "PRP"], ["will", "MD"], ["read", "VB"], [".", "."]],
];

const testSents: string[][] = [
  ["the", "cat", "sleeps", "."],
  ["zorp", "the", "quux", "."],
  ["she", "will", "book", "a", "flight", "."],
  ["i", "dance", "."],
  ["123", "dogs", "run", "."],
  ["sings", "quickly", "."],
  ["the", "blorpish", "wolf", "howls", "loudly", "."],
];

const models: ModelSpec[] = [
  { name: "hmm_lidstone_default", smoothing: 0.1 },
  { name: "hmm_lidstone_heavy", smoothing: 0.5 },
];

function buildModel(spec: ModelSpec, train: ReadonlyArray<GoldSentence>) {
  const estimator: Estimator = (freqdist, bins) => new LidstoneProbDist(freqdist, spec.smoothing, bins);
  const tagger = HiddenMarkovModelTagger.train(train, { estimator });
  const tagged = tagger.tagSents(testSents);
  const evaluation = Math.round(tagger.evaluate(goldSents) * 1e12) / 1e12;
  const transitions: Record<string, Record<string, number>> = {};
  const emissions: Record<string, Record<string, number>> = {};
  const priors: Record<string, number> = {};
  for (const fromState of tagger.states) {
    transitions[fromState] = {};
    emissions[fromState] = {};
    for (const toState of tagger.states) {
      transitions[fromState]![toState] = Number(tagger.transitionProb(fromState, toState).toFixed(10));
    }
    for (const symbol of tagger.symbols) {
      emissions[fromState]![symbol] = Number(tagger.emissionProb(fromState, symbol).toFixed(10));
    }
    priors[fromState] = Number(tagger.priorProb(fromState).toFixed(10));
  }
  return {
    name: spec.name,
    num_states: tagger.states.length,
    num_symbols: tagger.symbols.length,
    repr: tagger.toString(),
    tagged,
    eval: goldSents.length > 0 ? evaluation : null,
    transitions,
    emissions,
    priors,
  };
}

type ModelResult = ReturnType<typeof buildModel>;

function maxProbDiff(a: ModelResult, b: ModelResult): number {
  let maxDiff = 0;
  const tables = ["transitions", "emissions", "priors"] as const;
  for (const table of tables) {
    const left = a[table];
    const right = b[table];
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of keys) {
      if (table === "priors") {
        maxDiff = Math.max(maxDiff, Math.abs((left as Record<string, number>)[key]! - (right as Record<string, number>)[key]!));
        continue;
      }
      const leftRow = (left as Record<string, Record<string, number>>)[key] ?? {};
      const rightRow = (right as Record<string, Record<string, number>>)[key] ?? {};
      const innerKeys = new Set([...Object.keys(leftRow), ...Object.keys(rightRow)]);
      for (const innerKey of innerKeys) {
        const diff = Math.abs((leftRow[innerKey] ?? 0) - (rightRow[innerKey] ?? 0));
        if (diff > maxDiff) maxDiff = diff;
      }
    }
  }
  return maxDiff;
}

function main() {
  const payload = JSON.stringify({
    train: trainCorpus,
    test: testSents,
    gold: goldSents,
    models,
  });
  const proc = Bun.spawnSync(["python3", "bench/python_hmm_baseline.py", "--payload", payload], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    throw new Error(`python hmm baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  }
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as { models: ModelResult[] };

  const jsModels = models.map((spec) => buildModel(spec, trainCorpus));

  let maxDiff = 0;
  let discreteParity = jsModels.length === py.models.length;
  for (let i = 0; i < Math.min(jsModels.length, py.models.length); i += 1) {
    const js = jsModels[i]!;
    const p = py.models[i]!;
    const discrete = JSON.stringify({ ...js, transitions: null, emissions: null, priors: null });
    const pyDiscrete = JSON.stringify({ ...p, transitions: null, emissions: null, priors: null });
    if (discrete !== pyDiscrete) {
      discreteParity = false;
      console.error(`hmm model mismatch (${js.name}):`);
      console.error(`js=${discrete}`);
      console.error(`py=${pyDiscrete}`);
    }
    maxDiff = Math.max(maxDiff, maxProbDiff(js, p));
  }

  const parity = discreteParity;
  const parityTolerant = parity && maxDiff <= 1e-9;
  if (!parity) throw new Error("hmm tagger parity failed");
  if (!parityTolerant) throw new Error(`hmm tagger probability parity failed (max diff ${maxDiff})`);

  const sanity = (() => {
    const tagger = HiddenMarkovModelTagger.train(trainCorpus);
    return {
      repr: tagger.toString(),
      unknown_zorp: tagger.tag(["zorp"])[0]![1],
      logprob_labeled: Number(tagger.logProbability(trainCorpus[0]!).toFixed(9)),
      transition_rows_sum_to_one: Math.max(
        ...tagger.states.map((fromState) =>
          Math.abs(tagger.states.reduce((sum, toState) => sum + tagger.transitionProb(fromState, toState), 0) - 1),
        ),
      ) < 1e-9,
    };
  })();

  console.log(
    JSON.stringify(
      {
        parity,
        parity_tolerant: parityTolerant,
        max_prob_diff: maxDiff,
        models: models.length,
        train_sents: trainCorpus.length,
        test_sents: testSents.length,
        sanity,
      },
      null,
      2,
    ),
  );
}

main();
