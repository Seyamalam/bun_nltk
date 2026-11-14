/**
 * TBL demo helpers (port of nltk.tbl.demo).
 *
 * `postag` is a faithful port of the demo driver: it prepares the data split
 * (treebank by default), trains a UnigramTagger baseline over a RegexpTagger
 * backoff, runs BrillTaggerTrainer and reports accuracy. Pickle-dependent
 * options (cache/serialize) and the matplotlib learning curve raise the same
 * error Python would surface, at the same point in the output stream; the
 * nltk 3.10.3 upstream bugs in error_output and print_template_statistics
 * are reproduced rather than fixed.
 */
import { errorList } from "./tbl_erroranalysis";
import {
  BrillTagger,
  BrillTaggerTrainer,
  Pos,
  TblRule,
  Template,
  Word,
} from "./brill_tagger";
import type { GoldSentence, UntaggedSentence } from "./brill_tagger";
import { RegexpTagger, UnigramTagger } from "./sequential_taggers";
import type { SequentialBackoffTagger } from "./brill_tagger";
import { PyRandom } from "./py_random";
import { pyError } from "./internals";
import { BracketParseCorpusReader } from "./corpus_readers2";
import { find as dataFind } from "./data";
import type { PrintSink } from "./ext_pure";
import { existsSync, writeFileSync } from "node:fs";

export type DemoTaggedSentence = [string, string][];

/** nltk.tbl.demo.corpus_size — (num sequences, total tokens). */
export function corpusSize(seqs: ReadonlyArray<readonly unknown[]>): [number, number] {
  return [seqs.length, seqs.reduce((n, s) => n + s.length, 0)];
}
export { corpusSize as corpus_size };

/** nltk.tag.brill template sets used by the demo driver. */
export function brill24(): Template[] {
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
export function describeTemplateSets(out: PrintSink = defaultSink): string {
  const lines = [
    "Available template sets:",
    `  brill24: ${brill24().length} templates`,
    `  fntbl37: ${fntbl37().length} templates`,
    `  nltkdemo18: ${nltkdemo18().length} templates`,
    `  nltkdemo18plus: ${nltkdemo18plus().length} templates`,
  ];
  const text = lines.join("\n");
  print(out, text);
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
  taggedData?: readonly GoldSentence[] | null;
  numSents?: number | null;
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

const defaultSink: PrintSink = (text) => {
  process.stdout.write(text);
};

/** Python print() over a raw chunk sink. */
const print = (out: PrintSink, s: string): void => out(`${s}\n`);

/** nltk.tbl.demo._demo_prepare_data's `treebank.tagged_sents()` fallback. */
function treebankTaggedSents(): GoldSentence[] {
  const root = (dataFind("corpora/treebank/combined") as unknown as { path: string }).path;
  const reader = new BracketParseCorpusReader(
    root, "wsj_.*\\.mrg", null, "unindented_paren", "ascii", "wsj",
  );
  const sents: GoldSentence[] = [];
  for (const s of reader.tagged_sents() as Iterable<GoldSentence>) {
    sents.push(s);
  }
  return sents;
}

/** repr() of a python string-or-None (for "Errors for Brill Tagger %r"). */
function pyReprOrNone(value: string | null): string {
  if (value === null) return "None";
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

/** nltk.tbl.demo.postag — Brill tagger demonstration driver. */
export function postag(options: PostagOptions = {}, out: PrintSink = defaultSink): PostagResult {
  const baselineBackoffTagger = options.baselineBackoffTagger ?? REGEXP_TAGGER;
  const templates = options.templates ?? brill24();
  const trace = options.trace ?? 3;
  const ruleformat = options.ruleformat ?? "str";

  // _demo_prepare_data(tagged_data, train, num_sents, randomize, separate)
  let taggedData = options.taggedData;
  if (taggedData == null) {
    print(out, "Loading tagged data from treebank... ");
    taggedData = treebankTaggedSents();
  }
  const sents: GoldSentence[] = taggedData.map((s) => s.map(([w, t]) => [w, t] as [string, string]));
  const wantSents = options.numSents === undefined ? 1000 : options.numSents;
  // Python: if num_sents is None or len(tagged_data) <= num_sents: num_sents = len(...)
  const numSents = wantSents === null || sents.length <= wantSents ? sents.length : wantSents;
  if (options.randomize) {
    new PyRandom(sents.length).shuffle(sents);
  }
  const train = options.train ?? 0.8;
  const cutoff = Math.trunc(numSents * train);
  let trainingData = sents.slice(0, cutoff);
  const goldData = sents.slice(cutoff, numSents);
  const testingData: UntaggedSentence[] = goldData.map((sent) => sent.map(([w]) => w));
  let baselineData = trainingData;
  if (options.separateBaselineData) {
    const blCutoff = Math.floor(trainingData.length / 3);
    baselineData = trainingData.slice(0, blCutoff);
    trainingData = trainingData.slice(blCutoff);
  }
  {
    const [testseqs, testtokens] = corpusSize(testingData);
    const [trainseqs, traintokens] = corpusSize(trainingData);
    const [blseqs, bltokens] = corpusSize(baselineData);
    print(out, `Read testing data (${testseqs} sents/${testtokens} wds)`);
    print(out, `Read training data (${trainseqs} sents/${traintokens} wds)`);
    print(out, 
      `Read baseline data (${blseqs} sents/${bltokens} wds) ${options.separateBaselineData ? "" : "[reused the training set]"}`,
    );
  }

  let baselineTagger: UnigramTagger;
  const cachePath = options.cacheBaselineTagger ?? null;
  if (cachePath !== null) {
    if (!existsSync(cachePath)) {
      baselineTagger = new UnigramTagger(baselineData, null, baselineBackoffTagger);
      // Python: pickle.dump(baseline_tagger, f) — CPython pickle is not portable.
      throw pyError("TypeError", `cache_baseline_tagger requires CPython pickle (cannot dump baseline tagger to ${cachePath})`);
    }
    // Python: pickle.load — not portable either.
    throw pyError("TypeError", `cache_baseline_tagger requires CPython pickle (cannot load ${cachePath})`);
  }
  baselineTagger = new UnigramTagger(baselineData, null, baselineBackoffTagger);
  print(out, "Trained baseline tagger");
  let baselineAccuracy: number | null = null;
  if (goldData.length > 0) {
    baselineAccuracy = baselineTagger.accuracy(goldData);
    print(out, `    Accuracy on test set: ${baselineAccuracy.toFixed(4)}`);
  }

  const t0 = Date.now();
  const trainer = new BrillTaggerTrainer(baselineTagger, templates, { trace, out, ruleformat });
  print(out, "Training tbl tagger...");
  const brillTagger = trainer.train(
    trainingData,
    options.maxRules ?? 300,
    options.minScore ?? 3,
    options.minAcc ?? null,
  );
  print(out, `Trained tbl tagger in ${((Date.now() - t0) / 1000).toFixed(2)} seconds`);

  let brillAccuracy: number | null = null;
  if (goldData.length > 0) {
    brillAccuracy = brillTagger.evaluate(goldData);
    print(out, `    Accuracy on test set: ${brillAccuracy.toFixed(4)}`);
  }

  if (trace === 1) {
    print(out, "\nLearned rules: ");
    brillTagger.rules().forEach((rule: TblRule, i: number) => {
      print(out, `${String(i + 1).padStart(4)} ${rule.format(ruleformat)}`);
    });
  }

  let taggedTest: DemoTaggedSentence[];
  if (options.incrementalStats) {
    print(out, "Incrementally tagging the test data, collecting individual rule statistics");
    const [incrementalTagged, teststats] = brillTagger.batchTagIncremental(testingData, goldData);
    taggedTest = incrementalTagged as DemoTaggedSentence[];
    print(out, "    Rule statistics collected");
    if (!options.separateBaselineData) {
      print(out, "WARNING: train_stats asked for separate_baseline_data=True; the baseline will be artificially high");
    }
    brillTagger.trainStats();
    if (options.templateStats) {
      brillTagger.printTemplateStatistics(teststats, true, out);
    }
    if (options.learningCurveOutput != null) {
      // nltk's _demo_plot does `import matplotlib.pyplot` — absent here, same error.
      throw pyError("ModuleNotFoundError", "No module named 'matplotlib'");
    }
  } else {
    print(out, "Tagging the test data");
    taggedTest = brillTagger.tagSents(testingData) as DemoTaggedSentence[];
    if (options.templateStats) {
      brillTagger.printTemplateStatistics(null, true, out);
    }
  }

  if (options.errorOutput != null) {
    // Python 3.10.3 writes the header line, then crashes concatenating
    // bytes + str — the file keeps only the header. Same side effect + error.
    writeFileSync(
      options.errorOutput,
      `Errors for Brill Tagger ${pyReprOrNone(options.serializeOutput ?? null)}\n\n`,
      "utf8",
    );
    errorList(goldData, taggedTest);
    throw pyError("TypeError", "can't concat str to bytes");
  }

  if (options.serializeOutput != null) {
    taggedTest = brillTagger.tagSents(testingData) as DemoTaggedSentence[];
    // Python: pickle.dump(brill_tagger, f) — CPython pickle is not portable.
    throw pyError("TypeError", `serialize_output requires CPython pickle (cannot dump BrillTagger to ${options.serializeOutput})`);
  }

  return { tagger: brillTagger, baselineAccuracy, brillAccuracy, taggedTest };
}

/** nltk.tbl.demo.demo — postag() with all defaults. */
export function demo(out: PrintSink = defaultSink, options: PostagOptions = {}): PostagResult {
  return postag(options, out);
}
export function demoReprRuleFormat(out: PrintSink = defaultSink, options: PostagOptions = {}): PostagResult {
  return postag({ ...options, ruleformat: "repr" }, out);
}
export function demoStrRuleFormat(out: PrintSink = defaultSink, options: PostagOptions = {}): PostagResult {
  return postag({ ...options, ruleformat: "str" }, out);
}
export function demoVerboseRuleFormat(out: PrintSink = defaultSink, options: PostagOptions = {}): PostagResult {
  return postag({ ...options, ruleformat: "verbose" }, out);
}
export function demoMultipositionFeature(out: PrintSink = defaultSink, options: PostagOptions = {}): PostagResult {
  return postag(
    { templates: buildTemplates([[["Pos", [-3, -2, -1]]]]), ...options },
    out,
  );
}
export function demoMultifeatureTemplate(out: PrintSink = defaultSink, options: PostagOptions = {}): PostagResult {
  return postag(
    { templates: buildTemplates([[["Word", [0]], ["Pos", [-2, -1]]]]), ...options },
    out,
  );
}
export function demoGeneratedTemplates(out: PrintSink = defaultSink, options: PostagOptions = {}): PostagResult {
  const wordtpls = Word.expand([-1, 0, 1], [1, 2], false);
  const tagtpls = Pos.expand([-2, -1, 0, 1], [1, 2], true);
  const templates = options.templates ?? Template.expand([wordtpls, tagtpls], [1, 3]);
  print(out, `Generated ${templates.length} templates for transformation-based learning`);
  return postag({ ...options, templates, incrementalStats: true, templateStats: true }, out);
}
export function demoTemplateStatistics(out: PrintSink = defaultSink, options: PostagOptions = {}): PostagResult {
  return postag({ ...options, incrementalStats: true, templateStats: true }, out);
}
export function demoErrorAnalysis(out: PrintSink = defaultSink, options: PostagOptions = {}): PostagResult {
  return postag({ ...options, errorOutput: options.errorOutput ?? "errors.txt" }, out);
}
export function demoSerializeTagger(out: PrintSink = defaultSink, options: PostagOptions = {}): PostagResult {
  return postag({ ...options, serializeOutput: options.serializeOutput ?? "tagger.pcl" }, out);
}
export function demoHighAccuracyRules(out: PrintSink = defaultSink, options: PostagOptions = {}): PostagResult {
  return postag({ numSents: 3000, minAcc: 0.96, minScore: 10, ...options }, out);
}
export function demoLearningCurve(out: PrintSink = defaultSink, options: PostagOptions = {}): PostagResult {
  return postag(
    { incrementalStats: true, separateBaselineData: true, learningCurveOutput: "learningcurve.png", ...options },
    out,
  );
}

/** nltk.tbl.demo.pickle_load — CPython pickle is not portable. */
export function pickleLoad(_infile?: unknown): never {
  throw pyError("TypeError", "pickle_load requires CPython pickle (not portable)");
}
export { pickleLoad as pickle_load };

export {
  demoReprRuleFormat as demo_repr_rule_format,
  demoStrRuleFormat as demo_str_rule_format,
  demoVerboseRuleFormat as demo_verbose_rule_format,
  demoMultipositionFeature as demo_multiposition_feature,
  demoMultifeatureTemplate as demo_multifeature_template,
  demoGeneratedTemplates as demo_generated_templates,
  demoTemplateStatistics as demo_template_statistics,
  demoErrorAnalysis as demo_error_analysis,
  demoSerializeTagger as demo_serialize_tagger,
  demoHighAccuracyRules as demo_high_accuracy_rules,
  demoLearningCurve as demo_learning_curve,
};

export { errorList };
export { Word, Pos, Template, BrillTaggerTrainer, RegexpTagger, UnigramTagger };
export type { PrintSink };
