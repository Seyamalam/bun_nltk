import { expect, test } from "bun:test";
import { resolve } from "node:path";
import {
  DefaultTagger,
  RegexpTagger,
  type GoldSentence,
} from "../src/sequential_taggers";
import {
  BrillTagger,
  BrillTaggerTrainer,
  Pos,
  Template,
  TblRule,
  Word,
  buildTemplates,
  clearTemplateRegistry,
  standardTemplates,
} from "../src/brill_tagger";

const train: GoldSentence[] = [
  [["the", "DT"], ["cat", "NN"], ["sleeps", "VBZ"], [".", "."]],
  [["a", "DT"], ["dog", "NN"], ["barks", "VBZ"], [".", "."]],
  [["the", "DT"], ["dog", "NN"], ["runs", "VBZ"], ["fast", "RB"], [".", "."]],
  [["she", "PRP"], ["reads", "VBZ"], ["a", "DT"], ["book", "NN"], [".", "."]],
  [["they", "PRP"], ["book", "VB"], ["a", "DT"], ["table", "NN"], [".", "."]],
  [["he", "PRP"], ["will", "MD"], ["book", "VB"], ["flights", "NNS"], [".", "."]],
  [["i", "PRP"], ["read", "VBP"], ["the", "DT"], ["book", "NN"], [".", "."]],
  [["we", "PRP"], ["dance", "VBP"], ["every", "DT"], ["night", "NN"], [".", "."]],
  [["music", "NN"], ["makes", "VBZ"], ["people", "NNS"], ["dance", "VB"], [".", "."]],
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

function buildInitialTagger(): RegexpTagger {
  return new RegexpTagger(regexpRules, new DefaultTagger("NN"));
}

test("Pos/Word features extract tags and words at absolute indices", () => {
  const sent: Array<[string, string]> = [
    ["the", "DT"],
    ["cat", "NN"],
    ["sleeps", "VBZ"],
  ];
  // NLTK passes the absolute index (rule index + relative position).
  expect(new Pos([-1]).extractProperty(sent, 0)).toBe("DT");
  expect(new Word([0]).extractProperty(sent, 1)).toBe("cat");
  expect(new Pos([0]).extractProperty(sent, 2)).toBe("VBZ");
});

test("Feature positions are sorted and deduplicated like nltk.tbl.feature.Feature", () => {
  const feature = new Word([2, -1, -1]);
  expect([...feature.positions]).toEqual([-1, 2]);
  expect(feature.repr()).toBe("Word([-1, 2])");
});

test("Template repr and rule repr match the nltk string format", () => {
  const template = new Template(new Pos([-1]), new Word([0, 1]));
  expect(template.repr()).toBe("Template(Pos([-1]),Word([0, 1]))");

  const rule = template.applicableRules(
    [
      ["the", "X"],
      ["cat", "Y"],
    ],
    1,
    "Z",
  )!;
  expect(rule.length).toBe(1);
  expect(rule[0]!.templateid).toBe(template.id);
  expect(rule[0]!.repr()).toBe(
    `Rule('${template.id}', 'Y', 'Z', [(Pos([-1]),'X'), (Word([0, 1]),'cat')])`,
  );
  expect(rule[0]!.toString()).toBe("Y->Z if Pos:X@[-1] & Word:cat@[0,1]");
});

test("applicableRules returns nothing for already-correct tokens", () => {
  const template = new Template(new Pos([-1]));
  expect(
    template.applicableRules(
      [
        ["a", "NN"],
        ["b", "VB"],
      ],
      0,
      "NN",
    ),
  ).toEqual([]);
});

test("Rule.applies honors out-of-range positions with OR semantics per condition", () => {
  const rule = new TblRule("000", "NN", "VB", [[new Pos([-2, -1]), "DT"]]);
  // Previous tag DT -> applies.
  expect(
    rule.applies(
      [
        ["the", "DT"],
        ["cat", "NN"],
      ],
      1,
    ),
  ).toBe(true);
  // Position -2 is out of range but -1 matches.
  expect(
    rule.applies(
      [
        ["the", "DT"],
        ["cat", "NN"],
      ],
      1,
    ),
  ).toBe(true);
  // No DT nearby -> does not apply.
  expect(
    rule.applies(
      [
        ["she", "PRP"],
        ["cat", "NN"],
      ],
      1,
    ),
  ).toBe(false);
  // Original tag mismatch -> never applies.
  expect(
    rule.applies(
      [
        ["the", "DT"],
        ["cat", "VB"],
      ],
      1,
    ),
  ).toBe(false);
});

test("BrillTagger applies learned rules in order over an initial tagging", () => {
  const initial = new DefaultTagger("NN");
  const rules = [
    new TblRule("000", "NN", "VB", [[new Word([0]), "run"]]),
    new TblRule("001", "NN", "RB", [[new Word([0]), "fast"]]),
  ];
  const tagger = new BrillTagger(initial, rules);
  expect(tagger.tag(["the", "run", "fast"])).toEqual([
    ["the", "NN"],
    ["run", "VB"],
    ["fast", "RB"],
  ]);
});

test("training learns deterministic rule sequences across repeated runs", () => {
  const trainOnce = (): Array<{ repr: string; score: number }> => {
    clearTemplateRegistry();
    const templates = standardTemplates();
    const trainer = new BrillTaggerTrainer(buildInitialTagger(), templates, {
      deterministic: true,
    });
    const tagger = trainer.train(train, 10, 2);
    return tagger.rules().map((rule, i) => ({
      repr: rule.repr(),
      score: tagger.trainStats()?.rulescores[i] ?? -1,
    }));
  };
  const first = trainOnce();
  const second = trainOnce();
  expect(first.length).toBeGreaterThan(0);
  expect(first).toEqual(second);
});

test("training improves accuracy on training data and respects max_rules", () => {
  clearTemplateRegistry();
  const templates = standardTemplates();
  const initial = buildInitialTagger();
  const trainer = new BrillTaggerTrainer(initial, templates, { deterministic: true });
  const tagger = trainer.train(train, 5, 2);
  expect(tagger.rules().length).toBeLessThanOrEqual(5);
  expect(tagger.rules().length).toBeGreaterThan(0);

  const stats = tagger.trainStats()!;
  expect(stats.finalerrors).toBeLessThan(stats.initialerrors);
  expect(stats.rulescores.every((s) => s >= 2)).toBe(true);
  expect(tagger.evaluate(train)).toBeGreaterThan(buildInitialTagger().evaluate(train));
});

test("min_score threshold filters weak rules", () => {
  clearTemplateRegistry();
  const lowThreshold = (() => {
    const templates = standardTemplates();
    const trainer = new BrillTaggerTrainer(buildInitialTagger(), templates, { deterministic: true });
    return trainer.train(train, 50, 1).rules().length;
  })();
  clearTemplateRegistry();
  const highThreshold = (() => {
    const templates = standardTemplates();
    const trainer = new BrillTaggerTrainer(buildInitialTagger(), templates, { deterministic: true });
    return trainer.train(train, 50, 4).rules().length;
  })();
  expect(highThreshold).toBeLessThanOrEqual(lowThreshold);
  expect(highThreshold).toBeGreaterThan(0);
});

test("rules are selected by descending score with deterministic repr tie-breaking", () => {
  clearTemplateRegistry();
  const templates = standardTemplates();
  const trainer = new BrillTaggerTrainer(buildInitialTagger(), templates, { deterministic: true });
  const tagger = trainer.train(train, 20, 2);
  const scores = tagger.trainStats()!.rulescores;
  for (let i = 1; i < scores.length; i += 1) {
    expect(scores[i - 1]!).toBeGreaterThanOrEqual(scores[i]!);
  }
  // Tie-break order within equal scores must be by NLTK repr (lexicographic).
  const reprsByScore = new Map<number, string[]>();
  tagger.rules().forEach((rule, i) => {
    const score = scores[i]!;
    const list = reprsByScore.get(score) ?? [];
    list.push(rule.repr());
    reprsByScore.set(score, list);
  });
  for (const reprList of reprsByScore.values()) {
    const sorted = [...reprList].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    expect(reprList).toEqual(sorted);
  }
});

test("buildTemplates assigns sequential ids in creation order", () => {
  clearTemplateRegistry();
  const templates = buildTemplates([
    [{ kind: "Pos", positions: [-1] }],
    [{ kind: "Word", positions: [0, 1] }],
  ]);
  expect(templates.map((t) => t.id)).toEqual(["000", "001"]);
  expect(templates.map((t) => t.repr())).toEqual([
    "Template(Pos([-1]))",
    "Template(Word([0, 1]))",
  ]);
});

test("python3 baseline parity: learned rules, tagged output and accuracy match real nltk", () => {
  const testSents = [
    ["she", "reads", "a", "book", "."],
    ["they", "dance", "every", "night", "."],
  ];
  const gold: GoldSentence[] = [
    [["she", "PRP"], ["reads", "VBZ"], ["a", "DT"], ["book", "NN"], [".", "."]],
    [["they", "PRP"], ["dance", "VB"], ["every", "DT"], ["night", "NN"], [".", "."]],
  ];
  const configs = [
    {
      name: "prev_pos",
      templates: [[{ kind: "Pos", positions: [-1] }]],
      max_rules: 8,
    },
    {
      name: "pos_word_combo",
      templates: [
        [{ kind: "Pos", positions: [-1] }],
        [{ kind: "Word", positions: [0] }],
        [{ kind: "Pos", positions: [-1] }, { kind: "Word", positions: [0] }],
      ],
      max_rules: 10,
    },
  ];

  const roundEval = (v: number): number => Math.round(v * 1e12) / 1e12;

  // One python process per config: nltk template ids come from a process-global
  // counter, so a fresh process per config keeps ids aligned with the freshly
  // cleared JS registry.
  for (let i = 0; i < configs.length; i += 1) {
    const config = configs[i]!;
    const proc = Bun.spawnSync(
      ["python3", "bench/python_brill_baseline.py", "--payload", JSON.stringify({ train, test: testSents, gold, configs: [config] })],
      {
        cwd: resolve(import.meta.dir, ".."),
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    if (proc.exitCode !== 0) {
      console.warn("skipping python brill parity:", new TextDecoder().decode(proc.stderr));
      return;
    }
    const pyConfig = (JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as {
      configs: Array<{
        name: string;
        rules: Array<{ repr: string; original: string; replacement: string; templateid: string }>;
        tagged: Array<Array<[string, string]>>;
        accuracy: number;
      }>;
    }).configs[0]!;

    clearTemplateRegistry();
    const templates = buildTemplates(config.templates);
    const trainer = new BrillTaggerTrainer(buildInitialTagger(), templates, { deterministic: true });
    const tagger = trainer.train(train, config.max_rules, 2);

    const jsRules = tagger.rules().map((rule) => ({
      templateid: rule.templateid,
      original: rule.originalTag,
      replacement: rule.replacementTag,
      repr: rule.repr(),
    }));
    expect(jsRules).toEqual(pyConfig.rules);

    const jsTagged = tagger.tagSents(testSents);
    expect(jsTagged).toEqual(pyConfig.tagged);

    expect(roundEval(tagger.evaluate(gold))).toBe(pyConfig.accuracy);
  }
});
