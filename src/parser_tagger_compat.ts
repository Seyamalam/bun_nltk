import {
  chartParse,
  earleyParse,
  leftCornerParse,
  parsePcfgGrammar,
  probabilisticChartParse,
  recursiveDescentParse,
  type CfgGrammar,
  type ParseTree,
  type PcfgGrammar,
  type ProbabilisticParse,
} from "./parse";
import {
  featureChartParse,
  featureEarleyParse,
  parseFeatureCfgGrammar,
  type FeatureCfgGrammar,
} from "./feature_parse";
import {
  loadPerceptronTaggerModel,
  posTagPerceptronAscii,
  type PerceptronTaggedToken,
  type PerceptronTaggerModel,
} from "./perceptron_tagger";
import { AveragedPerceptron, shuffleInPlace } from "./perceptron_nltk";
import { accuracy, ConfusionMatrix } from "./confusion_metrics";
import type { GoldSentence } from "./sequential_taggers";

function joinTokens(tokens: string[]): string {
  return tokens.join(" ");
}

export { CFG } from "./grammar";
import { CFG, Nonterminal, Production } from "./grammar";
import { NltkChartParser, type ChartParserOptions } from "./chart";

export class PCFG {
  constructor(public readonly grammar: PcfgGrammar) {}

  static fromstring(grammarText: string, options?: { startSymbol?: string }): PCFG {
    return new PCFG(parsePcfgGrammar(grammarText, options));
  }
}

export class FeatureCFG {
  constructor(public readonly grammar: FeatureCfgGrammar) {}

  static fromstring(grammarText: string, options?: { startSymbol?: string }): FeatureCFG {
    return new FeatureCFG(parseFeatureCfgGrammar(grammarText, options));
  }
}

function asPcfgGrammar(grammar: PCFG | PcfgGrammar | string): PcfgGrammar {
  if (typeof grammar === "string") return parsePcfgGrammar(grammar);
  return grammar instanceof PCFG ? grammar.grammar : grammar;
}

function asFeatureGrammar(grammar: FeatureCFG | FeatureCfgGrammar | string): FeatureCfgGrammar {
  if (typeof grammar === "string") return parseFeatureCfgGrammar(grammar);
  return grammar instanceof FeatureCFG ? grammar.grammar : grammar;
}

function toNltkGrammar(grammar: CFG | CfgGrammar | string): CFG {
  if (grammar instanceof CFG) return grammar;
  if (typeof grammar === "string") return CFG.fromstring(grammar);
  const lhsSet = new Set(grammar.productions.map((p) => p.lhs));
  return new CFG(
    new Nonterminal(grammar.startSymbol),
    grammar.productions.map(
      (p) => new Production(new Nonterminal(p.lhs), p.rhs.map((s) => (lhsSet.has(s) ? new Nonterminal(s) : s))),
    ),
  );
}

export class ChartParser extends NltkChartParser {
  protected readonly cfgGrammar: CfgGrammar;

  constructor(grammar: CFG | CfgGrammar | string, options: ChartParserOptions = {}) {
    super(toNltkGrammar(grammar), options);
    this.cfgGrammar = this.grammar().grammar;
  }

  override parse<T = ParseTree>(tokens: Iterable<string>): T[] {
    return chartParse([...tokens], this.cfgGrammar) as T[];
  }
}

export class EarleyChartParser extends ChartParser {
  override parse<T = ParseTree>(tokens: Iterable<string>): T[] {
    return earleyParse([...tokens], this.cfgGrammar) as T[];
  }
}

export class RecursiveDescentParser extends ChartParser {
  override parse<T = ParseTree>(tokens: Iterable<string>): T[] {
    return recursiveDescentParse([...tokens], this.cfgGrammar) as T[];
  }
}

export class LeftCornerChartParser extends ChartParser {
  override parse<T = ParseTree>(tokens: Iterable<string>): T[] {
    return leftCornerParse([...tokens], this.cfgGrammar) as T[];
  }
}

export class ViterbiParser {
  private readonly grammar: PcfgGrammar;

  constructor(grammar: PCFG | PcfgGrammar | string) {
    this.grammar = asPcfgGrammar(grammar);
  }

  parse(tokens: string[]): ProbabilisticParse[] {
    const best = probabilisticChartParse(tokens, this.grammar);
    return best ? [best] : [];
  }

  parseOne(tokens: string[]): ProbabilisticParse | null {
    return probabilisticChartParse(tokens, this.grammar);
  }
}

export class FeatureChartParser {
  protected readonly grammar: FeatureCfgGrammar;

  constructor(grammar: FeatureCFG | FeatureCfgGrammar | string) {
    this.grammar = asFeatureGrammar(grammar);
  }

  parse(tokens: string[]): ParseTree[] {
    return featureChartParse(tokens, this.grammar);
  }

  parseOne(tokens: string[]): ParseTree | null {
    return this.parse(tokens)[0] ?? null;
  }
}

export class FeatureEarleyChartParser extends FeatureChartParser {
  override parse(tokens: string[]): ParseTree[] {
    return featureEarleyParse(tokens, this.grammar);
  }
}

export interface PerceptronTaggerOptions {
  load?: boolean;
  lang?: string;
  loc?: string | null;
  model?: PerceptronTaggerModel;
}

export class PerceptronTagger {
  readonly jsonTag = "nltk.tag.perceptron.PerceptronTagger";
  static readonly START = ["-START-", "-START2-"] as const;
  static readonly END = ["-END-", "-END2-"] as const;

  model = new AveragedPerceptron();
  tagdict: Record<string, string> = {};
  classes = new Set<string>();
  lang = "eng";
  saveDir = "";
  sentences: GoldSentence[] | null = null;

  private packed: PerceptronTaggerModel | null = null;

  constructor(load?: boolean, lang?: string, loc?: string | null);
  constructor(options?: PerceptronTaggerOptions);
  constructor(model?: PerceptronTaggerModel | string);
  constructor(
    loadOrOptionsOrModel: boolean | PerceptronTaggerOptions | PerceptronTaggerModel | string = true,
    lang = "eng",
    loc: string | null = null,
  ) {
    let load = true;
    if (typeof loadOrOptionsOrModel === "boolean") {
      load = loadOrOptionsOrModel;
    } else if (typeof loadOrOptionsOrModel === "string") {
      this.packed = loadPerceptronTaggerModel(loadOrOptionsOrModel);
      load = false;
    } else if (loadOrOptionsOrModel && typeof loadOrOptionsOrModel === "object") {
      const opts = loadOrOptionsOrModel as PerceptronTaggerOptions;
      if ("tagCount" in opts || "featureCount" in opts) {
        this.packed = loadOrOptionsOrModel as unknown as PerceptronTaggerModel;
      } else {
        load = opts.load ?? true;
        lang = opts.lang ?? lang;
        loc = opts.loc ?? loc;
        if (opts.model) this.packed = opts.model;
      }
    }
    this.lang = lang;
    this.saveDir = `averaged_perceptron_tagger_${lang}`;
    if (load) this.loadFromJson(lang, loc);
  }

  paramFiles(lang = "eng"): string[] {
    return ["weights", "tagdict", "classes"].map(
      (attr) => `averaged_perceptron_tagger_${lang}.${attr}.json`,
    );
  }

  normalize(word: string): string {
    if (word.includes("-") && word[0] !== "-") return "!HYPHEN";
    if (/^\d+$/.test(word) && word.length === 4) return "!YEAR";
    if (word && /\d/.test(word[0]!)) return "!DIGITS";
    return word.toLowerCase();
  }

  getFeatures(i: number, word: string, context: readonly string[], prev: string, prev2: string): Record<string, number> {
    const features: Record<string, number> = Object.create(null);
    const add = (name: string, ...args: string[]): void => {
      const key = [name, ...args].join(" ");
      features[key] = (features[key] ?? 0) + 1;
    };
    const idx = i + PerceptronTagger.START.length;
    add("bias");
    add("i suffix", word.slice(-3));
    add("i pref1", word ? word[0]! : "");
    add("i-1 tag", prev);
    add("i-2 tag", prev2);
    add("i tag+i-2 tag", prev, prev2);
    add("i word", context[idx]!);
    add("i-1 tag+i word", prev, context[idx]!);
    add("i-1 word", context[idx - 1]!);
    add("i-1 suffix", context[idx - 1]!.slice(-3));
    add("i-2 word", context[idx - 2]!);
    add("i+1 word", context[idx + 1]!);
    add("i+1 suffix", context[idx + 1]!.slice(-3));
    add("i+2 word", context[idx + 2]!);
    return features;
  }

  makeTagdict(sentences: readonly GoldSentence[]): void {
    const counts = new Map<string, Map<string, number>>();
    this.sentences = this.sentences ?? [];
    for (const sentence of sentences) {
      this.sentences.push(sentence);
      for (const [word, tag] of sentence) {
        const c = counts.get(word) ?? new Map<string, number>();
        c.set(tag, (c.get(tag) ?? 0) + 1);
        counts.set(word, c);
        this.classes.add(tag);
      }
    }
    const freqThresh = 20;
    const ambiguityThresh = 0.97;
    for (const [word, tagFreqs] of counts) {
      let tag = "";
      let mode = -1;
      for (const [t, n] of tagFreqs) if (n > mode) { tag = t; mode = n; }
      const n = [...tagFreqs.values()].reduce((a, b) => a + b, 0);
      if (n >= freqThresh && mode / n >= ambiguityThresh) this.tagdict[word] = tag;
    }
  }

  tag(tokens: string[], returnConf?: false, useTagdict?: boolean): Array<[string, string]>;
  tag(tokens: string[], returnConf: true, useTagdict?: boolean): Array<[string, string, number | null]>;
  tag(
    tokens: string[],
    returnConf = false,
    useTagdict = true,
  ): Array<[string, string] | [string, string, number | null]> {
    const trained = Object.keys(this.model.weights).length > 0;
    if (!trained && this.packed) {
      const rows = posTagPerceptronAscii(joinTokens(tokens), { model: this.packed });
      return rows.map((row: PerceptronTaggedToken) =>
        returnConf ? [row.token, row.tag, null] : [row.token, row.tag],
      );
    }
    const [start, start2] = PerceptronTagger.START;
    let prev: string = start;
    let prev2: string = start2;
    const context = [...PerceptronTagger.START, ...tokens.map((w) => this.normalize(w)), ...PerceptronTagger.END];
    const output: Array<[string, string] | [string, string, number | null]> = [];
    for (let i = 0; i < tokens.length; i++) {
      const word = tokens[i]!;
      let tag: string | null = useTagdict ? (this.tagdict[word] ?? null) : null;
      let conf: number | null = tag ? 1.0 : null;
      if (!tag) {
        const feats = this.getFeatures(i, word, context, prev, prev2);
        [tag, conf] = this.model.predict(feats);
      }
      output.push(returnConf ? [word, tag ?? "", conf] : [word, tag ?? ""]);
      prev2 = prev;
      prev = tag ?? "";
    }
    return output;
  }

  tag_sents(sentences: string[][]): Array<Array<[string, string]>> {
    return sentences.map((sentence) => this.tag(sentence) as Array<[string, string]>);
  }

  tagSents(sentences: string[][]): Array<Array<[string, string]>> {
    return this.tag_sents(sentences);
  }

  tagText(text: string): Array<[string, string]> {
    return posTagPerceptronAscii(joinTokens(text.split(/\s+/g).filter(Boolean)), {
      model: this.packed ?? loadPerceptronTaggerModel(),
    }).map((row: PerceptronTaggedToken) => [row.token, row.tag]);
  }

  train(sentences: readonly GoldSentence[], saveLoc?: string | null, nrIter = 5): void {
    this.sentences = [];
    this.makeTagdict(sentences);
    this.model.classes = this.classes;
    for (let iter = 0; iter < nrIter; iter++) {
      for (const sentence of this.sentences) {
        const words = sentence.map(([w]) => w);
        const tags = sentence.map(([, t]) => t);
        let prev: string = PerceptronTagger.START[0];
        let prev2: string = PerceptronTagger.START[1];
        const context = [...PerceptronTagger.START, ...words.map((w) => this.normalize(w)), ...PerceptronTagger.END];
        for (let i = 0; i < words.length; i++) {
          let guess = this.tagdict[words[i]!] ?? null;
          if (!guess) {
            const feats = this.getFeatures(i, words[i]!, context, prev, prev2);
            [guess] = this.model.predict(feats);
            this.model.update(tags[i]!, guess, feats);
          }
          prev2 = prev;
          prev = guess ?? "";
        }
      }
      shuffleInPlace(this.sentences, iter + 1);
    }
    this.sentences = null;
    this.model.averageWeights();
    if (saveLoc != null) this.saveToJson(this.lang, saveLoc);
  }

  encodeJsonObj(): [Record<string, Record<string, number>>, Record<string, string>, string[]] {
    return [this.model.weights, this.tagdict, [...this.classes]];
  }

  decodeJsonParams(params: [Record<string, Record<string, number>>, Record<string, string>, string[]]): void {
    const [weights, tagdict, classList] = params;
    this.model.weights = weights;
    this.tagdict = tagdict;
    this.classes = this.model.classes = new Set(classList);
  }

  encodeJsonParams(): [Record<string, Record<string, number>>, Record<string, string>, string[]] {
    return this.encodeJsonObj();
  }

  async saveToJson(lang = "xxx", loc?: string | null): Promise<void> {
    const dir = loc ?? this.saveDir;
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const params = this.encodeJsonObj();
    const files = this.paramFiles(lang);
    for (let i = 0; i < files.length; i++) {
      await writeFile(`${dir}/${files[i]!}`, JSON.stringify(params[i]!), { mode: 0o600 });
    }
  }

  loadFromJson(lang = "eng", loc?: string | null): void {
    if (loc == null) {
      this.packed = this.packed ?? loadPerceptronTaggerModel();
      return;
    }
    const fs = require("node:fs") as typeof import("node:fs");
    const files = this.paramFiles(lang);
    const params = files.map((f) => JSON.parse(fs.readFileSync(`${loc}/${f}`, "utf8")));
    this.decodeJsonParams(params as [Record<string, Record<string, number>>, Record<string, string>, string[]]);
  }

  accuracy(gold: readonly GoldSentence[]): number {
    const tagged = this.tag_sents(gold.map((s) => s.map(([w]) => w)));
    return accuracy(
      gold.flat().map(([, t]) => t),
      tagged.flat().map(([, t]) => t),
    );
  }

  evaluate(gold: readonly GoldSentence[]): number {
    return this.accuracy(gold);
  }

  confusion(gold: readonly GoldSentence[]): ConfusionMatrix {
    const tagged = this.tag_sents(gold.map((s) => s.map(([w]) => w)));
    return new ConfusionMatrix(
      gold.flat().map(([, t]) => t),
      tagged.flat().map(([, t]) => t),
    );
  }

  precision(gold: readonly GoldSentence[]): Map<string, number> {
    const cm = this.confusion(gold);
    return new Map(cm.labels.map((tag) => [tag as string, cm.precision(tag)]));
  }

  recall(gold: readonly GoldSentence[]): Map<string, number> {
    const cm = this.confusion(gold);
    return new Map(cm.labels.map((tag) => [tag as string, cm.recall(tag)]));
  }

  fMeasure(gold: readonly GoldSentence[], alpha = 0.5): Map<string, number> {
    const cm = this.confusion(gold);
    return new Map(cm.labels.map((tag) => [tag as string, cm.fMeasure(tag, alpha)]));
  }

  f_measure(gold: readonly GoldSentence[], alpha = 0.5): Map<string, number> {
    return this.fMeasure(gold, alpha);
  }

  evaluatePerTag(
    gold: readonly GoldSentence[],
    options: { alpha?: number; truncate?: number | null; sortByCount?: boolean } = {},
  ): string {
    return this.confusion(gold).evaluate(options.alpha ?? 0.5, options.truncate ?? undefined, options.sortByCount ?? false);
  }
}

export function posTag(tokens: string[], options?: { model?: PerceptronTaggerModel | string }): Array<[string, string]>;
export function posTag(text: string, options?: { model?: PerceptronTaggerModel | string }): Array<[string, string]>;
export function posTag(
  value: string[] | string,
  options?: { model?: PerceptronTaggerModel | string },
): Array<[string, string]> {
  const model = typeof options?.model === "string" || options?.model === undefined
    ? loadPerceptronTaggerModel(options?.model)
    : options.model;
  const text = Array.isArray(value) ? joinTokens(value) : value;
  return posTagPerceptronAscii(text, { model }).map((row: PerceptronTaggedToken) => [row.token, row.tag]);
}

export const pos_tag = posTag;
