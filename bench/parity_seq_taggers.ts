import { resolve } from "node:path";
import {
  BigramTagger,
  DefaultTagger,
  NgramTagger,
  RegexpTagger,
  TrigramTagger,
  UnigramTagger,
  type GoldSentence,
  type SequentialBackoffTagger,
} from "../src/sequential_taggers";

type ChainStep =
  | { type: "default"; tag: string }
  | { type: "regexp"; rules: Array<[string, string]> }
  | { type: "unigram" | "bigram" | "trigram"; cutoff?: number };

type ChainSpec = { name: string; steps: ChainStep[] };

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
];

const goldSents: GoldSentence[] = [
  ...trainCorpus,
  [["the", "DT"], ["zorp", "NN"], ["sleeps", "VBZ"], [".", "."]],
  [["flights", "NNS"], ["fly", "VBP"], [".", "."]],
  [["he", "PRP"], ["can", "MD"], ["swim", "VB"], [".", "."]],
];

const testSents: string[][] = [
  ["the", "cat", "sleeps", "."],
  ["zorp", "the", "quux", "."],
  ["she", "will", "book", "a", "flight", "."],
  ["i", "dance", "."],
  ["123", "dogs", "run", "."],
  ["sings", "quickly", "."],
];

const regexpRules: Array<[string, string]> = [
  ["^-?[0-9]+(\\.[0-9]+)?$", "CD"],
  ["(The|the|A|a|An|an)$", "AT"],
  [".*ing$", "VBG"],
  [".*ed$", "VBD"],
  [".*ly$", "RB"],
  [".*s$", "NNS"],
  [".*", "NN"],
];

const chains: ChainSpec[] = [
  { name: "default_nn", steps: [{ type: "default", tag: "NN" }] },
  { name: "regexp_only", steps: [{ type: "regexp", rules: regexpRules }] },
  { name: "unigram_only", steps: [{ type: "unigram" }] },
  { name: "unigram_cutoff2_default", steps: [{ type: "unigram", cutoff: 2 }, { type: "default", tag: "NN" }] },
  { name: "bigram_default", steps: [{ type: "bigram" }, { type: "default", tag: "NN" }] },
  { name: "trigram_only", steps: [{ type: "trigram" }] },
  {
    name: "full_chain",
    steps: [
      { type: "trigram" },
      { type: "bigram" },
      { type: "unigram" },
      { type: "regexp", rules: regexpRules },
      { type: "default", tag: "NN" },
    ],
  },
];

function buildChain(steps: ChainStep[], train: GoldSentence[]): SequentialBackoffTagger {
  let tagger: SequentialBackoffTagger | null = null;
  for (const step of [...steps].reverse()) {
    const backoff: SequentialBackoffTagger | undefined = tagger ?? undefined;
    if (step.type === "default") {
      tagger = new DefaultTagger(step.tag);
    } else if (step.type === "regexp") {
      tagger = new RegexpTagger(step.rules, backoff);
    } else if (step.type === "unigram") {
      tagger = new UnigramTagger({ train, backoff, cutoff: step.cutoff });
    } else if (step.type === "bigram") {
      tagger = new BigramTagger({ train, backoff, cutoff: step.cutoff });
    } else {
      tagger = new TrigramTagger({ train, backoff, cutoff: step.cutoff });
    }
  }
  return tagger!;
}

function roundEval(value: number): number {
  return Math.round(value * 1e12) / 1e12;
}

function main() {
  const payload = JSON.stringify({
    train: trainCorpus,
    test: testSents,
    gold: goldSents,
    chains,
  });
  const proc = Bun.spawnSync(["python3", "bench/python_seq_taggers_baseline.py", "--payload", payload], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    throw new Error(`python seq taggers baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  }
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as {
    chains: Array<{ name: string; size: number; tagged: Array<Array<[string, string]>>; eval: number }>;
  };

  const jsChains = chains.map((spec) => {
    const tagger = buildChain(spec.steps, trainCorpus);
    return {
      name: spec.name,
      size: tagger.size(),
      tagged: tagger.tagSents(testSents),
      eval: roundEval(tagger.evaluate(goldSents)),
    };
  });

  const parity = JSON.stringify(jsChains) === JSON.stringify(py.chains);
  if (!parity) {
    for (let i = 0; i < Math.max(jsChains.length, py.chains.length); i += 1) {
      const jsChain = jsChains[i];
      const pyChain = py.chains[i];
      if (JSON.stringify(jsChain) !== JSON.stringify(pyChain)) {
        console.error(`chain mismatch (${jsChain?.name}):`);
        console.error(`js=${JSON.stringify(jsChain)}`);
        console.error(`py=${JSON.stringify(pyChain)}`);
      }
    }
    throw new Error("seq taggers parity failed");
  }

  const sanity = (() => {
    const unigram = new UnigramTagger({ train: trainCorpus, backoff: new DefaultTagger("NN") });
    const ngram = new NgramTagger(2, { train: trainCorpus });
    return {
      dance_tie: unigram.tag(["dance"])[0]![1],
      book_tie: unigram.tag(["book"])[0]![1],
      bigram_size: ngram.size(),
    };
  })();

  console.log(
    JSON.stringify(
      {
        parity,
        chains: chains.length,
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
