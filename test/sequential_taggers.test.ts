import { expect, test } from "bun:test";
import { resolve } from "node:path";
import {
  BigramTagger,
  DefaultTagger,
  NgramTagger,
  RegexpTagger,
  TrigramTagger,
  UnigramTagger,
  type GoldSentence,
} from "../index";

const train: GoldSentence[] = [
  [["the", "DT"], ["cat", "NN"], ["sleeps", "VBZ"], [".", "."]],
  [["a", "DT"], ["dog", "NN"], ["barks", "VBZ"], [".", "."]],
  [["the", "DT"], ["dog", "NN"], ["runs", "VBZ"], ["fast", "RB"], [".", "."]],
  [["she", "PRP"], ["reads", "VBZ"], ["a", "DT"], ["book", "NN"], [".", "."]],
  [["they", "PRP"], ["book", "VB"], ["a", "DT"], ["table", "NN"], [".", "."]],
  [["i", "PRP"], ["read", "VBP"], ["the", "DT"], ["book", "NN"], [".", "."]],
  [["we", "PRP"], ["dance", "VBP"], ["every", "DT"], ["night", "NN"], [".", "."]],
  [["the", "DT"], ["dance", "NN"], ["was", "VBD"], ["beautiful", "JJ"], [".", "."]],
  [["music", "NN"], ["makes", "VBZ"], ["people", "NNS"], ["dance", "VB"], [".", "."]],
  [["he", "PRP"], ["ate", "VBD"], ["three", "CD"], ["apples", "NNS"], [".", "."]],
];

test("DefaultTagger assigns its tag to every token", () => {
  const tagger = new DefaultTagger("NN");
  expect(tagger.tag(["This", "is", "a", "test"])).toEqual([
    ["This", "NN"],
    ["is", "NN"],
    ["a", "NN"],
    ["test", "NN"],
  ]);
});

test("DefaultTagger evaluate is 1.0 on matching gold", () => {
  const tagger = new DefaultTagger("NN");
  expect(tagger.evaluate([[["x", "NN"]], [["y", "NN"], ["z", "NN"]]])).toBe(1);
});

test("RegexpTagger applies rules in order, first match wins", () => {
  const tagger = new RegexpTagger([
    ["^-?[0-9]+(\\.[0-9]+)?$", "CD"],
    ["(The|the|A|a|An|an)$", "AT"],
    [".*at$", "XX"],
    ["^c.*$", "YY"],
    [".*s$", "NNS"],
    [".*", "NN"],
  ]);
  // "cat" matches both .*at$ and ^c.*$ — the earlier rule wins.
  expect(tagger.tag(["cat", "123", "the", "cats", "dog", "sings"])).toEqual([
    ["cat", "XX"],
    ["123", "CD"],
    ["the", "AT"],
    ["cats", "YY"],
    ["dog", "NN"],
    ["sings", "NNS"],
  ]);
});

test("RegexpTagger returns null when nothing matches, delegating to backoff", () => {
  const regexp = new RegexpTagger([["^[0-9]+$", "CD"]], new DefaultTagger("NN"));
  expect(regexp.tag(["42", "fox"])).toEqual([
    ["42", "CD"],
    ["fox", "NN"],
  ]);
  const bare = new RegexpTagger([["^[0-9]+$", "CD"]]);
  expect(bare.tag(["fox"])).toEqual([["fox", null]]);
});

test("UnigramTagger picks the most frequent tag per word", () => {
  const tagger = new UnigramTagger({ train });
  expect(tagger.tag(["dog"])).toEqual([["dog", "NN"]]);
  expect(tagger.size()).toBeGreaterThan(0);
});

test("UnigramTagger tie-breaking prefers the earliest-seen tag", () => {
  const tagger = new UnigramTagger({ train });
  // book: NN x2 (sents 4, 6), VB x1 — NN wins outright.
  expect(tagger.tag(["book"])[0]![1]).toBe("NN");
  // dance: VBP (sent 7), NN (sent 8), VB (sent 9) — three-way tie; VBP seen first.
  expect(tagger.tag(["dance"])[0]![1]).toBe("VBP");
});

test("UnigramTagger backs off for unseen words through the chain", () => {
  const defaultTagger = new DefaultTagger("NN");
  const tagger = new UnigramTagger({ train, backoff: defaultTagger });
  expect(tagger.tag(["zorp"])).toEqual([["zorp", "NN"]]);
  expect(tagger.backoff).toBe(defaultTagger);
  expect(tagger.taggers.length).toBe(2);
});

test("UnigramTagger cutoff excludes contexts at or below the cutoff", () => {
  // "book" occurs 3 times total but max tag count is 2; cutoff=2 means hits must be > 2.
  const strict = new UnigramTagger({ train, backoff: new DefaultTagger("NN"), cutoff: 2 });
  expect(strict.tag(["book"])[0]![1]).toBe("NN"); // falls back to default
  // "dog" has NN x2 as well → also excluded with cutoff=2
  expect(strict.tag(["dog"])[0]![1]).toBe("NN");
  // cutoff=1 keeps any tag seen more than once
  const loose = new UnigramTagger({ train, backoff: new DefaultTagger("NN"), cutoff: 1 });
  expect(loose.tag(["book"])[0]![1]).toBe("NN");
});

test("UnigramTagger accepts a model instead of training data", () => {
  const tagger = new UnigramTagger({ model: { dog: "NN", run: "VB" } });
  expect(tagger.tag(["dog", "run", "cat"])).toEqual([
    ["dog", "NN"],
    ["run", "VB"],
    ["cat", null],
  ]);
  expect(() => new UnigramTagger({ train, model: { dog: "NN" } })).toThrow();
});

test("BigramTagger conditions on the previous tag and word", () => {
  const tagger = new BigramTagger({ train, backoff: new DefaultTagger("NN") });
  // In training, "book" follows PRP only as VB ("they book a table").
  expect(tagger.tag(["they", "book"])[1]![1]).toBe("VB");
  // Sentence-initial context is ([], word) — never trained, so backoff applies.
  expect(tagger.tag(["book"])[0]![1]).toBe("NN");
});

test("TrigramTagger conditions on the two previous tags and word", () => {
  const tagger = new TrigramTagger({ train, backoff: new DefaultTagger("NN") });
  const tagged = tagger.tag(["she", "will", "book"]);
  expect(tagged[2]![1]).toBe("NN");
});

test("NgramTagger generalizes to arbitrary n", () => {
  const tagger = new NgramTagger(1, { train });
  expect(tagger.n).toBe(1);
  expect(tagger.tag(["cat"])).toEqual([["cat", "NN"]]);
});

test("tag_sents tags each sentence independently", () => {
  const tagger = new UnigramTagger({ train, backoff: new DefaultTagger("NN") });
  const result = tagger.tagSents([["dog"], ["dog", "runs"]]);
  expect(result.length).toBe(2);
  expect(result[0]).toEqual([["dog", "NN"]]);
  expect(result[1]!.length).toBe(2);
});

test("evaluate scores accuracy over tagged sentences", () => {
  const tagger = new UnigramTagger({ train, backoff: new DefaultTagger("NN") });
  const score = tagger.evaluate(train);
  expect(score).toBeGreaterThan(0.5);
  expect(score).toBeLessThanOrEqual(1);
});

test("backoff chain order: earlier taggers win over later ones", () => {
  const chain = new UnigramTagger({
    train,
    backoff: new RegexpTagger([["^d.*$", "JJ"], [".*", "NN"]], new DefaultTagger("X")),
  });
  // unigram knows dog -> NN (not the regexp's JJ)
  expect(chain.tag(["dog"])[0]![1]).toBe("NN");
  // unseen word starting with d hits the regexp layer
  expect(chain.tag(["dawg"])[0]![1]).toBe("JJ");
  // unseen word that matches no regexp rule falls to the default
  const noCatchAll = new UnigramTagger({
    train,
    backoff: new RegexpTagger([["^q$", "QQ"]], new DefaultTagger("X")),
  });
  expect(noCatchAll.tag(["zzz"])[0]![1]).toBe("X");
});

type ParityResult = {
  chains: Array<{ name: string; size: number; tagged: Array<Array<[string, string]>>; eval: number }>;
};

function runPython(payload: unknown): ParityResult {
  const proc = Bun.spawnSync(
    ["python3", "bench/python_seq_taggers_baseline.py", "--payload", JSON.stringify(payload)],
    {
      cwd: resolve(import.meta.dir, ".."),
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  if (proc.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(proc.stderr));
  }
  return JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as ParityResult;
}

test("python3 baseline parity: sequential backoff tagger chains", () => {
  const rules: Array<[string, string]> = [
    ["^-?[0-9]+(\\.[0-9]+)?$", "CD"],
    ["(The|the|A|a|An|an)$", "AT"],
    [".*ing$", "VBG"],
    [".*ed$", "VBD"],
    [".*ly$", "RB"],
    [".*s$", "NNS"],
    [".*", "NN"],
  ];
  const gold: GoldSentence[] = [...train, [["flights", "NNS"], ["fly", "VBP"], [".", "."]]];
  const testSents = [
    ["the", "cat", "sleeps", "."],
    ["zorp", "the", "quux", "."],
    ["she", "will", "book", "a", "flight", "."],
    ["i", "dance", "."],
    ["123", "dogs", "run", "."],
    ["sings", "quickly", "."],
  ];
  const chains = [
    { name: "default_nn", steps: [{ type: "default", tag: "NN" }] },
    { name: "regexp_only", steps: [{ type: "regexp", rules }] },
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
        { type: "regexp", rules },
        { type: "default", tag: "NN" },
      ],
    },
  ];

  const py = runPython({ train, test: testSents, gold, chains });

  type Step = (typeof chains)[number]["steps"][number];
  function build(steps: readonly Step[]): UnigramTagger | BigramTagger | TrigramTagger | RegexpTagger | DefaultTagger {
    let tagger: UnigramTagger | BigramTagger | TrigramTagger | RegexpTagger | DefaultTagger | null = null;
    for (const step of [...steps].reverse()) {
      if (step.type === "default") tagger = new DefaultTagger(step.tag!);
      else if (step.type === "regexp") tagger = new RegexpTagger(rules, tagger ?? undefined);
      else if (step.type === "unigram") tagger = new UnigramTagger({ train, backoff: tagger ?? undefined, cutoff: (step as { cutoff?: number }).cutoff });
      else if (step.type === "bigram") tagger = new BigramTagger({ train, backoff: tagger ?? undefined, cutoff: (step as { cutoff?: number }).cutoff });
      else tagger = new TrigramTagger({ train, backoff: tagger ?? undefined, cutoff: (step as { cutoff?: number }).cutoff });
    }
    return tagger!;
  }

  const jsChains = chains.map((spec) => {
    const tagger = build(spec.steps);
    return {
      name: spec.name,
      size: tagger.size(),
      tagged: tagger.tagSents(testSents),
      eval: Math.round(tagger.evaluate(gold) * 1e12) / 1e12,
    };
  });

  expect(jsChains).toEqual(py.chains);
});

// NLTK 3.10.3 oracle pins — TaggerI member surface (accuracy/confusion/precision/recall/f_measure/evaluate_per_tag).
test("unigram tagger: NLTK TaggerI metric members", () => {
  const train2: GoldSentence[] = [
    [["the", "DT"], ["dog", "NN"], ["runs", "VB"]],
    [["a", "DT"], ["dog", "NN"], ["sleeps", "VB"]],
  ];
  const gold2: GoldSentence[] = [[["the", "DT"], ["dog", "NN"]]];
  const t = new UnigramTagger(train2);
  // accuracy: 2/2 = 1.0; NLTK: 1.0
  expect(t.accuracy(gold2)).toBe(1);
  // confusion on fully-covered gold — prec/rec/fms all 1.0 per NLTK
  const prec = Object.fromEntries(t.precision(gold2));
  const rec = Object.fromEntries(t.recall(gold2));
  const fms = Object.fromEntries(t.fMeasure(gold2));
  expect(prec).toEqual({ DT: 1, NN: 1 });
  expect(rec).toEqual({ DT: 1, NN: 1 });
  expect(fms).toEqual({ DT: 1, NN: 1 });
  // evaluate_per_tag formatted table — NLTK repr:
  // 'Tag | Prec.  | Recall | F-measure\n----+--------+--------+-----------\n DT | 1.0000 ...'
  const table = t.evaluatePerTag(gold2);
  expect(table).toContain("Tag | Prec.  | Recall | F-measure");
  expect(table).toContain("DT | 1.0000 | 1.0000 | 1.0000");
  expect(table).toContain("NN | 1.0000 | 1.0000 | 1.0000");
  // size = unique contexts: runs,a,the,sleeps,dog = 5
  expect(t.size()).toBe(5);
  // _context_to_tag view
  const c2t = t.contextToTag;
  expect(c2t.get("runs")).toBe("VB");
  expect(c2t.get("the")).toBe("DT");
});

test("unigram tagger: constructor validation (NLTK _check_params)", () => {
  const train2: GoldSentence[] = [[["the", "DT"], ["dog", "NN"]]];
  // neither train nor model → error
  expect(() => new UnigramTagger()).toThrow("Must specify either training data or trained model");
  // both → error
  expect(() => new UnigramTagger({ train: train2, model: { dog: "NN" } })).toThrow(
    "Must specify either training data or trained model",
  );
  // positional form
  const t = new UnigramTagger(train2);
  expect(t.size()).toBeGreaterThan(0);
  // model-only positional
  const tm = new UnigramTagger(null, { dog: "NN" });
  expect(tm.tag([["dog"]].flat())).toEqual([["dog", "NN"]]);
});

test("unigram tagger: backoff chain (NLTK backoff_tag)", () => {
  const train2: GoldSentence[] = [
    [["the", "DT"], ["dog", "NN"], ["runs", "VB"]],
    [["a", "DT"], ["dog", "NN"], ["sleeps", "VB"]],
  ];
  const t = new UnigramTagger({ train: train2, backoff: new DefaultTagger("NN") });
  // NLTK: tag(['unknown','word']) → [('unknown','NN'),('word','NN')]
  expect(t.tag(["unknown", "word"])).toEqual([["unknown", "NN"], ["word", "NN"]]);
});

test("unigram tagger: encode_json_obj round-trip", () => {
  const train2: GoldSentence[] = [
    [["the", "DT"], ["dog", "NN"], ["runs", "VB"]],
  ];
  const t = new UnigramTagger(train2);
  const enc = t.encodeJsonObj();
  const [ctx] = enc;
  expect(ctx[JSON.stringify("runs")]).toBe("VB");
  const back = UnigramTagger.decodeJsonObj(enc);
  expect(back).not.toBeNull();
  expect((back as UnigramTagger).tag(["runs"])).toEqual([["runs", "VB"]]);
});
