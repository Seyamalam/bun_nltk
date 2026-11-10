/**
 * TBL demo helpers (port of nltk.tbl.demo).
 *
 * `postag` is a faithful port of the demo driver: it prepares the data split,
 * trains a UnigramTagger baseline over a RegexpTagger backoff, runs
 * BrillTaggerTrainer and reports accuracy. Corpus-bound options (treebank
 * data, pickle caching/serialization, matplotlib learning curves, incremental
 * stats) throw an unsupported error rather than silently changing behavior.
 */
import { errorList } from "./tbl_erroranalysis";
import {
  BrillTagger,
  BrillTaggerTrainer,
  Pos,
  TblRule,
  Template,
  Word,
  clearTemplateRegistry,
} from "./brill_tagger";
import type { GoldSentence, UntaggedSentence } from "./brill_tagger";
import { RegexpTagger, UnigramTagger } from "./sequential_taggers";
import type { SequentialBackoffTagger } from "./brill_tagger";

export type DemoTaggedSentence = [string, string][];

/** nltk.tbl.demo.corpus_size — (num sequences, total tokens). */
export function corpusSize(seqs: ReadonlyArray<readonly unknown[]>): [number, number] {
  return [seqs.length, seqs.reduce((n, s) => n + s.length, 0)];
}
export { corpusSize as corpus_size };

/** nltk.tag.brill template sets used by the demo driver. */
export function brill24(): Template[] {
  clearTemplateRegistry();
  return buildTemplates([
    [["Pos", [-1]]], [["Pos", [1]]], [["Pos", [-2]]], [["Pos", [2]]],
    [["Pos", [-2, -1]]], [["Pos", [1, 2]]], [["Pos", [-3, -2, -1]]], [["Pos", [1, 2, 3]]],
    [["Pos", [-1]], ["Pos", [1]]], [["Pos", [-2]], ["Pos", [-1]]], [["Pos", [1]], ["Pos", [2]]],
    [["Word", [-1]]], [["Word", [1]]], [["Word", [-2]]], [["Word", [2]]],
    [["Word", [-2, -1]]], [["Word", [1, 2]]], [["Word", [-1, 0]]], [["Word", [0, 1]]],
    [["Word", [0]]],
    [["Word", [-1]], ["Pos", [-1]]], [["Word", [1]], ["Pos", [1]]],
    [["Word", [0]], ["Word", [-1]], ["Pos", [-1]]], [["Word", [0]], ["Word", [1]], ["Pos", [1]]],
  ]);
}

export function fntbl37(): Template[] {
  clearTemplateRegistry();
  return buildTemplates([
    [["Word", [0]], ["Word", [1]], ["Word", [2]]],
    [["Word", [-1]], ["Word", [0]], ["Word", [1]]],
    [["Word", [0]], ["Word", [-1]]], [["Word", [0]], ["Word", [1]]],
    [["Word", [0]], ["Word", [2]]], [["Word", [0]], ["Word", [-2]]],
    [["Word", [1, 2]]], [["Word", [-2, -1]]], [["Word", [1, 2, 3]]], [["Word", [-3, -2, -1]]],
    [["Word", [0]], ["Pos", [2]]], [["Word", [0]], ["Pos", [-2]]],
    [["Word", [0]], ["Pos", [1]]], [["Word", [0]], ["Pos", [-1]]],
    [["Word", [0]]], [["Word", [-2]]], [["Word", [2]]], [["Word", [1]]], [["Word", [-1]]],
    [["Pos", [-1]], ["Pos", [1]]], [["Pos", [1]], ["Pos", [2]]], [["Pos", [-1]], ["Pos", [-2]]],
    [["Pos", [1]]], [["Pos", [-1]]], [["Pos", [-2]]], [["Pos", [2]]],
    [["Pos", [1, 2, 3]]], [["Pos", [1, 2]]], [["Pos", [-3, -2, -1]]], [["Pos", [-2, -1]]],
    [["Pos", [1]], ["Word", [0]], ["Word", [1]]], [["Pos", [1]], ["Word", [0]], ["Word", [-1]]],
    [["Pos", [-1]], ["Word", [-1]], ["Word", [0]]], [["Pos", [-1]], ["Word", [0]], ["Word", [1]]],
    [["Pos", [-2]], ["Pos", [-1]]], [["Pos", [1]], ["Pos", [2]]],
    [["Pos", [1]], ["Pos", [2]], ["Word", [1]]],
  ]);
}

export function nltkdemo18(): Template[] {
  clearTemplateRegistry();
  return buildTemplates([
    [["Pos", [-1]]], [["Pos", [1]]], [["Pos", [-2]]], [["Pos", [2]]],
    [["Pos", [-2, -1]]], [["Pos", [1, 2]]], [["Pos", [-3, -2, -1]]], [["Pos", [1, 2, 3]]],
    [["Pos", [-1]], ["Pos", [1]]],
    [["Word", [-1]]], [["Word", [1]]], [["Word", [-2]]], [["Word", [2]]],
    [["Word", [-2, -1]]], [["Word", [1, 2]]], [["Word", [-3, -2, -1]]], [["Word", [1, 2, 3]]],
    [["Word", [-1]], ["Word", [1]]],
  ]);
}

export function nltkdemo18plus(): Template[] {
  clearTemplateRegistry();
  return buildTemplates([
    ...nltkdemo18Spec(),
    [["Word", [-1]], ["Pos", [1]]], [["Pos", [-1]], ["Word", [1]]],
    [["Word", [-1]], ["Word", [0]], ["Pos", [1]]],
    [["Pos", [-1]], ["Word", [0]], ["Word", [1]]],
    [["Pos", [-1]], ["Word", [0]], ["Pos", [1]]],
  ]);
}

function nltkdemo18Spec(): FeatureSpecList[] {
  return [
    [["Pos", [-1]]], [["Pos", [1]]], [["Pos", [-2]]], [["Pos", [2]]],
    [["Pos", [-2, -1]]], [["Pos", [1, 2]]], [["Pos", [-3, -2, -1]]], [["Pos", [1, 2, 3]]],
    [["Pos", [-1]], ["Pos", [1]]],
    [["Word", [-1]]], [["Word", [1]]], [["Word", [-2]]], [["Word", [2]]],
    [["Word", [-2, -1]]], [["Word", [1, 2]]], [["Word", [-3, -2, -1]]], [["Word", [1, 2, 3]]],
    [["Word", [-1]], ["Word", [1]]],
  ];
}

type FeatureSpecList = ReadonlyArray<readonly ["Pos" | "Word", readonly number[]]>;

function buildTemplates(specs: ReadonlyArray<FeatureSpecList>): Template[] {
  return specs.map(
    (features) =>
      new Template(
        ...features.map(([kind, positions]) =>
          kind === "Pos" ? new Pos(positions) : new Word(positions),
        ),
      ),
  );
}

/** nltk.tag.brill.describe_template_sets — list the built-in template sets. */
export function describeTemplateSets(): string {
  const lines = [
    "Available template sets:",
    `  brill24: ${brill24().length} templates`,
    `  fntbl37: ${fntbl37().length} templates`,
    `  nltkdemo18: ${nltkdemo18().length} templates`,
    `  nltkdemo18plus: ${nltkdemo18plus().length} templates`,
  ];
  const text = lines.join("\n");
  console.log(text);
  return text;
}
export { describeTemplateSets as describe_template_sets };

/** nltk.tbl.demo.REGEXP_TAGGER / NN_CD_TAGGER baseline backoff taggers. */
export const NN_CD_TAGGER = new RegexpTagger([
  ["^-?[0-9]+(\\.[0-9]+)?$", "CD"],
  [".*", "NN"],
]);

export const REGEXP_TAGGER = new RegexpTagger([
  ["^-?[0-9]+(\\.[0-9]+)?$", "CD"],
  ["(The|the|A|a|An|an)$", "AT"],
  [".*able$", "JJ"],
  [".*ness$", "NN"],
  [".*ly$", "RB"],
  [".*s$", "NNS"],
  [".*ing$", "VBG"],
  [".*ed$", "VBD"],
  [".*", "NN"],
]);

export interface PostagOptions {
  templates?: readonly Template[];
  taggedData?: readonly GoldSentence[];
  numSents?: number;
  maxRules?: number;
  minScore?: number;
  minAcc?: number | null;
  train?: number;
  trace?: number;
  randomize?: boolean;
  ruleformat?: string;
  incrementalStats?: boolean;
  templateStats?: boolean;
  errorOutput?: string | null;
  serializeOutput?: string | null;
  learningCurveOutput?: string | null;
  learningCurveTake?: number;
  baselineBackoffTagger?: SequentialBackoffTagger | null;
  separateBaselineData?: boolean;
  cacheBaselineTagger?: string | null;
}

export interface PostagResult {
  tagger: BrillTagger;
  baselineAccuracy: number | null;
  brillAccuracy: number | null;
  taggedTest: DemoTaggedSentence[];
}

function shuffle<T>(xs: T[], rand: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Small deterministic PRNG (mulberry32) for the `randomize` data shuffle.
 * NLTK uses random.seed(len(tagged_data)) — the shuffle order differs but the
 * contract (deterministic per corpus size) is preserved. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** nltk.tbl.demo.postag — Brill tagger demonstration driver. */
export function postag(options: PostagOptions = {}): PostagResult {
  const baselineBackoffTagger = options.baselineBackoffTagger ?? REGEXP_TAGGER;
  const templates = options.templates ?? brill24();
  if (options.cacheBaselineTagger != null || options.serializeOutput != null) {
    throw new Error("postag: cache_baseline_tagger/serialize_output require CPython pickle, which is not supported in the JS runtime");
  }
  if (options.learningCurveOutput != null) {
    throw new Error("postag: learning_curve_output requires matplotlib, which is not supported in the JS runtime");
  }
  if (options.incrementalStats || options.templateStats) {
    throw new Error("postag: incremental_stats/template_stats require batch_tag_incremental (not ported)");
  }
  const numSents = options.numSents ?? 1000;
  const train = options.train ?? 0.8;

  const taggedData = options.taggedData;
  if (taggedData == null) {
    throw new Error("postag: tagged_data=None requires the treebank corpus reader, which is not bundled in this runtime");
  }
  let sents: GoldSentence[] = taggedData.map((s) => s.map(([w, t]) => [w, t] as [string, string]));
  const take = Math.min(numSents, sents.length);
  if (options.randomize) {
    sents = shuffle(sents, mulberry32(sents.length));
  }
  const cutoff = Math.floor(take * train);
  let trainingData = sents.slice(0, cutoff);
  const goldData = sents.slice(cutoff, take);
  const testingData: UntaggedSentence[] = goldData.map((sent) => sent.map(([w]) => w));
  let baselineData = trainingData;
  if (options.separateBaselineData) {
    const blCutoff = Math.floor(trainingData.length / 3);
    baselineData = trainingData.slice(0, blCutoff);
    trainingData = trainingData.slice(blCutoff);
  }
  const trace = options.trace ?? 3;
  {
    const [testseqs, testtokens] = corpusSize(testingData);
    const [trainseqs, traintokens] = corpusSize(trainingData);
    const [blseqs, bltokens] = corpusSize(baselineData);
    console.log(`Read testing data (${testseqs} sents/${testtokens} wds)`);
    console.log(`Read training data (${trainseqs} sents/${traintokens} wds)`);
    console.log(
      `Read baseline data (${blseqs} sents/${bltokens} wds)${options.separateBaselineData ? "" : " [reused the training set]"}`,
    );
  }

  const baselineTagger = new UnigramTagger(baselineData, null, baselineBackoffTagger);
  console.log("Trained baseline tagger");
  let baselineAccuracy: number | null = null;
  if (goldData.length > 0) {
    baselineAccuracy = baselineTagger.accuracy(goldData);
    console.log(`    Accuracy on test set: ${baselineAccuracy.toFixed(4)}`);
  }

  console.log("Training tbl tagger...");
  const t0 = Date.now();
  const trainer = new BrillTaggerTrainer(baselineTagger, templates, { trace });
  const brillTagger = trainer.train(
    trainingData,
    options.maxRules ?? 300,
    options.minScore ?? 3,
    options.minAcc ?? null,
  );
  console.log(`Trained tbl tagger in ${((Date.now() - t0) / 1000).toFixed(2)} seconds`);

  let brillAccuracy: number | null = null;
  if (goldData.length > 0) {
    brillAccuracy = brillTagger.evaluate(goldData);
    console.log(`    Accuracy on test set: ${brillAccuracy.toFixed(4)}`);
  }

  const ruleformat = options.ruleformat ?? "str";
  if (trace === 1) {
    console.log("\nLearned rules: ");
    brillTagger.rules().forEach((rule: TblRule, i: number) => {
      console.log(`${String(i + 1).padStart(4)} ${rule.format(ruleformat)}`);
    });
  }

  console.log("Tagging the test data");
  const taggedTest = brillTagger.tagSents(testingData) as DemoTaggedSentence[];

  if (options.errorOutput != null) {
    const req = (globalThis as { require?: (id: string) => typeof import("node:fs") }).require;
    if (req === undefined) {
      throw new Error("postag: error_output requires a filesystem (Node/Bun runtime)");
    }
    req("node:fs").writeFileSync(
      options.errorOutput,
      `Errors for Brill Tagger ${options.serializeOutput ?? ""}\n\n` +
        errorList(goldData, taggedTest).join("\n") + "\n",
    );
    console.log(`Wrote tagger errors including context to ${options.errorOutput}`);
  }

  return { tagger: brillTagger, baselineAccuracy, brillAccuracy, taggedTest };
}

function demoCall(opts: PostagOptions = {}): PostagResult {
  return postag(opts);
}

/** nltk.tbl.demo.demo* — each runs postag with a fixed option set. They
 * still require tagged_data/treebank, so the unconfigured call throws the
 * same unsupported error as postag. */
export function demo(options: PostagOptions = {}): PostagResult {
  return demoCall(options);
}
export function demoReprRuleFormat(options: PostagOptions = {}): PostagResult {
  return demoCall({ ...options, ruleformat: "repr" });
}
export function demoStrRuleFormat(options: PostagOptions = {}): PostagResult {
  return demoCall({ ...options, ruleformat: "str" });
}
export function demoVerboseRuleFormat(options: PostagOptions = {}): PostagResult {
  return demoCall({ ...options, ruleformat: "verbose" });
}
export function demoMultipositionFeature(options: PostagOptions = {}): PostagResult {
  return demoCall({
    templates: buildTemplates([[["Pos", [-3, -2, -1]]]]),
    ...options,
  });
}
export function demoMultifeatureTemplate(options: PostagOptions = {}): PostagResult {
  return demoCall({
    templates: buildTemplates([[["Word", [0]], ["Pos", [-2, -1]]]]),
    ...options,
  });
}
export function demoGeneratedTemplates(options: PostagOptions = {}): PostagResult {
  const wordtpls = Word.expand([-1, 0, 1], [1, 2], false);
  const tagtpls = Pos.expand([-2, -1, 0, 1], [1, 2], true);
  const templates = options.templates ?? Template.expand([wordtpls, tagtpls], [1, 3]);
  console.log(`Generated ${templates.length} templates for transformation-based learning`);
  return demoCall({ ...options, templates, incrementalStats: true, templateStats: true });
}
export function demoTemplateStatistics(options: PostagOptions = {}): PostagResult {
  return demoCall({ ...options, incrementalStats: true, templateStats: true });
}
export function demoErrorAnalysis(options: PostagOptions = {}): PostagResult {
  return demoCall({ ...options, errorOutput: options.errorOutput ?? "errors.txt" });
}
export function demoSerializeTagger(options: PostagOptions = {}): PostagResult {
  return demoCall({ ...options, serializeOutput: options.serializeOutput ?? "tagger.pcl" });
}
export function demoHighAccuracyRules(options: PostagOptions = {}): PostagResult {
  return demoCall({ numSents: 3000, minAcc: 0.96, minScore: 10, ...options });
}
export function demoLearningCurve(options: PostagOptions = {}): PostagResult {
  return demoCall({ incrementalStats: true, separateBaselineData: true, learningCurveOutput: "learningcurve.png", ...options });
}

export { errorList };
export { Word, Pos, Template, BrillTaggerTrainer, RegexpTagger, UnigramTagger };
