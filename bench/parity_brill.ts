import { resolve } from "node:path";
import { DefaultTagger, RegexpTagger } from "../src/sequential_taggers";
import {
  BrillTaggerTrainer,
  buildTemplates,
  type FeatureSpec,
  type GoldSentence,
} from "../src/brill_tagger";

type TemplateSpec = ReadonlyArray<ReadonlyArray<FeatureSpec>>;

interface BrillConfig {
  name: string;
  templates: TemplateSpec;
  max_rules?: number;
  min_score?: number;
}

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

const heldOutGold: GoldSentence[] = [
  [["the", "DT"], ["cat", "NN"], ["reads", "VBZ"], ["a", "DT"], ["book", "NN"], [".", "."]],
  [["she", "PRP"], ["will", "MD"], ["book", "VB"], ["flights", "NNS"], [".", "."]],
  [["they", "PRP"], ["dance", "VB"], ["every", "DT"], ["night", "NN"], [".", "."]],
  [["ten", "CD"], ["dogs", "NNS"], ["play", "VBP"], ["outside", "RB"], [".", "."]],
  [["a", "DT"], ["lazy", "JJ"], ["cat", "NN"], ["sleeps", "VBZ"], ["all", "DT"], ["day", "NN"], [".", "."]],
];

const testSents: string[][] = heldOutGold.map((sentence) => sentence.map(([word]) => word));

const regexpRules: Array<[string, string]> = [
  ["^-?[0-9]+(\\.[0-9]+)?$", "CD"],
  ["(The|the|A|a|An|an)$", "AT"],
  [".*ing$", "VBG"],
  [".*ed$", "VBD"],
  [".*ly$", "RB"],
  [".*s$", "NNS"],
  [".*", "NN"],
];

const configs: BrillConfig[] = [
  {
    name: "prev_pos_only",
    templates: [[{ kind: "Pos", positions: [-1] }]],
    max_rules: 8,
    min_score: 2,
  },
  {
    name: "pos_and_word",
    templates: [
      [{ kind: "Pos", positions: [-1] }],
      [{ kind: "Word", positions: [0] }],
      [{ kind: "Pos", positions: [-1] }, { kind: "Word", positions: [0] }],
    ],
    max_rules: 12,
    min_score: 2,
  },
  {
    name: "five_templates",
    templates: [
      [{ kind: "Pos", positions: [-1] }],
      [{ kind: "Pos", positions: [-2, -1] }],
      [{ kind: "Word", positions: [0] }],
      [{ kind: "Word", positions: [-2, -1] }],
      [{ kind: "Pos", positions: [-1] }, { kind: "Word", positions: [0] }],
    ],
    max_rules: 15,
    min_score: 3,
  },
  {
    name: "high_min_score",
    templates: [
      [{ kind: "Pos", positions: [-1] }],
      [{ kind: "Pos", positions: [-1] }, { kind: "Pos", positions: [1] }],
    ],
    max_rules: 10,
    min_score: 5,
  },
];

function buildInitialTagger(): RegexpTagger {
  return new RegexpTagger(regexpRules, new DefaultTagger("NN"));
}

function roundEval(value: number): number {
  return Math.round(value * 1e12) / 1e12;
}

function main() {
  const payload = JSON.stringify({
    train: trainCorpus,
    test: testSents,
    gold: heldOutGold,
    configs,
  });
  const proc = Bun.spawnSync(
    ["python3", "bench/python_brill_baseline.py", "--payload", payload],
    {
      cwd: resolve(import.meta.dir, ".."),
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  if (proc.exitCode !== 0) {
    throw new Error(`python brill baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  }
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as {
    configs: Array<{
      name: string;
      rules: Array<{ templateid: string; original: string; replacement: string; repr: string }>;
      tagged: Array<Array<[string, string]>>;
      accuracy: number;
      initialerrors: number;
      finalerrors: number;
      rulescores: number[];
    }>;
  };

  const jsConfigs = configs.map((config) => {
    // Template ids are assigned from a process-global counter in creation
    // order, mirroring nltk.tbl.template.Template.ALLTEMPLATES — the python
    // baseline accumulates ids the same way across configs.
    const templates = buildTemplates(config.templates);
    const trainer = new BrillTaggerTrainer(buildInitialTagger(), templates, {
      deterministic: true,
    });
    const tagger = trainer.train(trainCorpus, config.max_rules ?? 200, config.min_score ?? 2);
    const stats = tagger.trainStats();
    return {
      name: config.name,
      rules: tagger.rules().map((rule) => ({
        templateid: rule.templateid,
        original: rule.originalTag,
        replacement: rule.replacementTag,
        repr: rule.repr(),
      })),
      tagged: tagger.tagSents(testSents),
      accuracy: roundEval(tagger.evaluate(heldOutGold)),
      initialerrors: stats?.initialerrors ?? -1,
      finalerrors: stats?.finalerrors ?? -1,
      rulescores: stats?.rulescores ?? [],
    };
  });

  const parity = JSON.stringify(jsConfigs) === JSON.stringify(py.configs);
  if (!parity) {
    for (let i = 0; i < Math.max(jsConfigs.length, py.configs.length); i += 1) {
      const jsConfig = jsConfigs[i];
      const pyConfig = py.configs[i];
      if (JSON.stringify(jsConfig) !== JSON.stringify(pyConfig)) {
        console.error(`config mismatch (${jsConfig?.name}):`);
        if (JSON.stringify(jsConfig?.rules) !== JSON.stringify(pyConfig?.rules)) {
          console.error(`  js rules=${JSON.stringify(jsConfig?.rules, null, 2)}`);
          console.error(`  py rules=${JSON.stringify(pyConfig?.rules, null, 2)}`);
        }
        if (JSON.stringify(jsConfig?.tagged) !== JSON.stringify(pyConfig?.tagged)) {
          console.error(`  js tagged=${JSON.stringify(jsConfig?.tagged)}`);
          console.error(`  py tagged=${JSON.stringify(pyConfig?.tagged)}`);
        }
        if (jsConfig?.accuracy !== pyConfig?.accuracy) {
          console.error(`  js acc=${jsConfig?.accuracy} py acc=${pyConfig?.accuracy}`);
        }
        if (
          JSON.stringify(jsConfig?.rulescores) !== JSON.stringify(pyConfig?.rulescores) ||
          jsConfig?.initialerrors !== pyConfig?.initialerrors ||
          jsConfig?.finalerrors !== pyConfig?.finalerrors
        ) {
          console.error(`  js stats=${JSON.stringify(jsConfig)} `);
          console.error(`  py stats=${JSON.stringify({ initialerrors: pyConfig?.initialerrors, finalerrors: pyConfig?.finalerrors, rulescores: pyConfig?.rulescores })}`);
        }
      }
    }
    throw new Error("brill parity failed");
  }

  console.log(
    JSON.stringify(
      {
        parity,
        configs: configs.length,
        train_sents: trainCorpus.length,
        held_out_sents: heldOutGold.length,
        learned_rules_per_config: jsConfigs.map((c) => c.rules.length),
      },
      null,
      2,
    ),
  );
}

main();
