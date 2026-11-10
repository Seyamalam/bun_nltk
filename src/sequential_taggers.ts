import { ConditionalFreqDist } from "./freqdist";
import { accuracy, ConfusionMatrix } from "./confusion_metrics";

export type TaggedToken = readonly [word: string, tag: string];
export type GoldSentence = readonly TaggedToken[];
export type UntaggedSentence = readonly string[];

export type TagContext = string | null | readonly (string | null | readonly (string | null)[])[];

export type TaggerModel = ReadonlyMap<TagContext, string> | Record<string, string>;

export interface NgramTaggerOptions {
  train?: readonly GoldSentence[];
  model?: TaggerModel;
  backoff?: SequentialBackoffTagger | null;
  cutoff?: number;
  verbose?: boolean;
}

function contextKey(context: TagContext): string {
  if (typeof context === "string") return JSON.stringify(context);
  if (context === null) return JSON.stringify(context);
  return JSON.stringify([...context]);
}

function modelEntries(model: TaggerModel): Array<[TagContext, string]> {
  if (model instanceof Map) return [...model.entries()];
  return Object.entries(model);
}

export abstract class SequentialBackoffTagger {
  readonly taggers: readonly SequentialBackoffTagger[];

  constructor(backoff?: SequentialBackoffTagger | null) {
    this.taggers = backoff ? [this, ...backoff.taggers] : [this];
  }

  get backoff(): SequentialBackoffTagger | null {
    return this.taggers.length > 1 ? (this.taggers[1] as SequentialBackoffTagger) : null;
  }

  tag(tokens: UntaggedSentence): Array<[string, string | null]> {
    const tags: Array<string | null> = [];
    for (let index = 0; index < tokens.length; index += 1) {
      tags.push(this.tagOne(tokens, index, tags));
    }
    return tags.map((tag, i) => [tokens[i]!, tag] as [string, string | null]);
  }

  tagOne(tokens: UntaggedSentence, index: number, history: ReadonlyArray<string | null>): string | null {
    for (const tagger of this.taggers) {
      const tag = tagger.chooseTag(tokens, index, history);
      if (tag !== null) return tag;
    }
    return null;
  }

  tagSents(sentences: ReadonlyArray<UntaggedSentence>): Array<Array<[string, string | null]>> {
    return sentences.map((tokens) => this.tag(tokens));
  }

  evaluate(gold: ReadonlyArray<GoldSentence>): number {
    const taggedSents = this.tagSents(gold.map((sentence) => sentence.map(([word]) => word)));
    let correct = 0;
    let total = 0;
    for (let s = 0; s < gold.length; s += 1) {
      const reference = gold[s]!;
      const test = taggedSents[s]!;
      const length = Math.min(reference.length, test.length);
      for (let i = 0; i < length; i += 1) {
        total += 1;
        if (reference[i]![1] === test[i]![1]) correct += 1;
      }
    }
    return total === 0 ? 0 : correct / total;
  }

  /** NLTK TaggerI.accuracy: retag the untagged gold tokens, compare tags. */
  accuracy(gold: ReadonlyArray<GoldSentence>): number {
    const taggedSents = this.tagSents(gold.map((sentence) => sentence.map(([word]) => word)));
    return accuracy(
      gold.flat().map(([, tag]) => tag),
      taggedSents.flat().map(([, tag]) => tag),
    );
  }

  /** NLTK TaggerI.confusion: ConfusionMatrix of gold tags vs predicted tags. */
  confusion(gold: ReadonlyArray<GoldSentence>): ConfusionMatrix<string | null> {
    const taggedSents = this.tagSents(gold.map((sentence) => sentence.map(([word]) => word)));
    return new ConfusionMatrix(
      gold.flat().map(([, tag]) => tag),
      taggedSents.flat().map(([, tag]) => tag),
    );
  }

  precision(gold: ReadonlyArray<GoldSentence>): Map<string | null, number> {
    const cm = this.confusion(gold);
    return new Map(cm.labels.map((tag) => [tag, cm.precision(tag)]));
  }

  recall(gold: ReadonlyArray<GoldSentence>): Map<string | null, number> {
    const cm = this.confusion(gold);
    return new Map(cm.labels.map((tag) => [tag, cm.recall(tag)]));
  }

  fMeasure(gold: ReadonlyArray<GoldSentence>, alpha = 0.5): Map<string | null, number> {
    const cm = this.confusion(gold);
    return new Map(cm.labels.map((tag) => [tag, cm.fMeasure(tag, alpha)]));
  }

  f_measure(gold: ReadonlyArray<GoldSentence>, alpha = 0.5): Map<string | null, number> {
    return this.fMeasure(gold, alpha);
  }

  /** NLTK TaggerI.evaluate_per_tag: tabulated per-tag metrics string. */
  evaluatePerTag(
    gold: ReadonlyArray<GoldSentence>,
    options: { alpha?: number; truncate?: number; sortByCount?: boolean } = {},
  ): string {
    return this.confusion(gold).evaluate(options.alpha ?? 0.5, options.truncate, options.sortByCount ?? false);
  }

  abstract chooseTag(tokens: UntaggedSentence, index: number, history: ReadonlyArray<string | null>): string | null;

  abstract size(): number;
}

export abstract class ContextTagger extends SequentialBackoffTagger {
  protected table = new Map<string, { context: TagContext; tag: string }>();

  constructor(backoff?: SequentialBackoffTagger | null) {
    super(backoff);
  }

  size(): number {
    return this.table.size;
  }

  protected loadModel(model: TaggerModel): void {
    this.table.clear();
    for (const [context, tag] of modelEntries(model)) {
      this.table.set(contextKey(context), { context, tag });
    }
  }

  train(taggedCorpus: ReadonlyArray<GoldSentence>, cutoff = 0, verbose = false): void {
    let tokenCount = 0;
    let hitCount = 0;
    const usefulContexts = new Set<string>();
    const fd = new ConditionalFreqDist<TagContext, string>();

    for (const sentence of taggedCorpus) {
      const tokens = sentence.map(([word]) => word);
      const tags = sentence.map(([, tag]) => tag);
      for (let index = 0; index < sentence.length; index += 1) {
        tokenCount += 1;
        const context = this.context(tokens, index, tags.slice(0, index));
        if (context === null) continue;
        fd.get(context).inc(tags[index]!);
        const backoffTag = this.backoff === null ? null : this.backoff.tagOne(tokens, index, tags.slice(0, index));
        if (backoffTag === null || tags[index] !== backoffTag) {
          usefulContexts.add(contextKey(context));
        }
      }
    }

    this.table.clear();
    for (const condition of fd.conditions()) {
      if (!usefulContexts.has(contextKey(condition))) continue;
      const dist = fd.peek(condition)!;
      const bestTag = dist.max();
      const hits = dist.get(bestTag);
      if (hits > cutoff) {
        this.table.set(contextKey(condition), { context: condition, tag: bestTag });
        hitCount += hits;
      }
    }

    if (verbose) {
      const size = this.size();
      const conditions = fd.conditions().length;
      const backoffPct = tokenCount === 0 ? 0 : 100 - (hitCount * 100.0) / tokenCount;
      const pruningPct = conditions === 0 ? 0 : 100 - (size * 100.0) / conditions;
      console.log(
        `[Trained Unigram tagger: size=${size}, backoff=${backoffPct.toFixed(2)}%, pruning=${pruningPct.toFixed(2)}%]`,
      );
    }
  }

  chooseTag(tokens: UntaggedSentence, index: number, history: ReadonlyArray<string | null>): string | null {
    const context = this.context(tokens, index, history);
    if (context === null) return null;
    return this.table.get(contextKey(context))?.tag ?? null;
  }

  /** NLTK ``_context_to_tag`` view. */
  get contextToTag(): Map<TagContext, string> {
    return new Map([...this.table.values()].map((entry) => [entry.context, entry.tag]));
  }

  abstract context(tokens: UntaggedSentence, index: number, history: ReadonlyArray<string | null>): TagContext | null;
}

export class DefaultTagger extends SequentialBackoffTagger {
  readonly #tag: string;

  constructor(tag: string) {
    super(null);
    this.#tag = tag;
  }

  get assignedTag(): string {
    return this.#tag;
  }

  size(): number {
    return 1;
  }

  chooseTag(): string | null {
    return this.#tag;
  }

  override toString(): string {
    return `<DefaultTagger: tag=${this.#tag}>`;
  }
}

export class NgramTagger extends ContextTagger {
  readonly n: number;

  constructor(n: number, options: NgramTaggerOptions = {}) {
    super(options.backoff ?? null);
    this.n = n;
    const train = options.train ?? null;
    const model = options.model ?? null;
    if ((train === null) === (model === null)) {
      throw new Error("Must specify either training data or trained model.");
    }
    if (model) this.loadModel(model);
    if (train && train.length > 0) {
      this.train(train, options.cutoff ?? 0, options.verbose ?? false);
    }
  }

  context(tokens: UntaggedSentence, index: number, history: ReadonlyArray<string | null>): TagContext {
    const start = Math.max(0, index - this.n + 1);
    return [history.slice(start, index) as readonly (string | null)[], tokens[index]!] as TagContext;
  }

  encodeJsonObj(): [number, Record<string, string>, SequentialBackoffTagger | null] {
    const contextToTag: Record<string, string> = {};
    for (const { context, tag } of this.table.values()) {
      contextToTag[JSON.stringify(context)] = tag;
    }
    return [this.n, contextToTag, this.backoff];
  }

  override toString(): string {
    return `<${this.constructor.name}: size=${this.size()}>`;
  }
}

export class UnigramTagger extends ContextTagger {
  constructor(options?: NgramTaggerOptions);
  constructor(
    train?: readonly GoldSentence[] | null,
    model?: TaggerModel | null,
    backoff?: SequentialBackoffTagger | null,
    cutoff?: number,
    verbose?: boolean,
  );
  constructor(
    trainOrOptions: readonly GoldSentence[] | NgramTaggerOptions | null = null,
    model: TaggerModel | null = null,
    backoff: SequentialBackoffTagger | null = null,
    cutoff = 0,
    verbose = false,
  ) {
    const isOptions =
      trainOrOptions !== null && !Array.isArray(trainOrOptions);
    const options: NgramTaggerOptions = isOptions
      ? (trainOrOptions as NgramTaggerOptions)
      : { train: trainOrOptions ?? undefined, model: model ?? undefined, backoff, cutoff, verbose };
    super(options.backoff ?? null);
    const train = options.train ?? null;
    const resolvedModel = options.model ?? null;
    if ((train === null) === (resolvedModel === null)) {
      throw new Error("Must specify either training data or trained model.");
    }
    if (resolvedModel) this.loadModel(resolvedModel);
    if (train && train.length > 0) {
      this.train(train, options.cutoff ?? 0, options.verbose ?? false);
    }
  }

  context(tokens: UntaggedSentence, index: number): TagContext {
    return tokens[index]!;
  }

  encodeJsonObj(): [Record<string, string>, SequentialBackoffTagger | null] {
    const contextToTag: Record<string, string> = {};
    for (const { context, tag } of this.table.values()) {
      contextToTag[JSON.stringify(context)] = tag;
    }
    return [contextToTag, this.backoff];
  }

  static decodeJsonObj(obj: [Record<string, string>, SequentialBackoffTagger | null]): SequentialBackoffTagger | null {
    const [contextToTag, backoff] = obj;
    const model: Record<string, string> = {};
    for (const [key, tag] of Object.entries(contextToTag)) {
      model[JSON.parse(key) as string] = tag;
    }
    if (Object.keys(model).length === 0) return backoff;
    return new UnigramTagger(null, model, backoff);
  }

  override toString(): string {
    return `<UnigramTagger: size=${this.size()}>`;
  }
}

export class BigramTagger extends NgramTagger {
  constructor(options: NgramTaggerOptions = {}) {
    super(2, options);
  }

  override toString(): string {
    return `<BigramTagger: size=${this.size()}>`;
  }
}

export class TrigramTagger extends NgramTagger {
  constructor(options: NgramTaggerOptions = {}) {
    super(3, options);
  }

  override toString(): string {
    return `<TrigramTagger: size=${this.size()}>`;
  }
}

export class RegexpTagger extends SequentialBackoffTagger {
  readonly regexps: ReadonlyArray<{ pattern: RegExp; tag: string }>;

  constructor(regexps: ReadonlyArray<readonly [string, string]>, backoff?: SequentialBackoffTagger | null) {
    super(backoff ?? null);
    this.regexps = regexps.map(([regexp, tag]) => {
      try {
        return { pattern: new RegExp(regexp, "y"), tag };
      } catch (error) {
        throw new Error(
          `Invalid RegexpTagger regexp: ${error}\n- regexp: ${JSON.stringify(regexp)}\n- tag: ${JSON.stringify(tag)}`,
        );
      }
    });
  }

  size(): number {
    return this.regexps.length;
  }

  chooseTag(tokens: UntaggedSentence, index: number): string | null {
    const token = tokens[index]!;
    for (const { pattern, tag } of this.regexps) {
      pattern.lastIndex = 0;
      if (pattern.test(token)) return tag;
    }
    return null;
  }

  override toString(): string {
    return `<Regexp Tagger: size=${this.size()}>`;
  }
}

export type FeatureDetector = (tokens: UntaggedSentence, index: number, history: readonly (string | null)[]) => Record<string, unknown>;

/** nltk.tag.sequential.AffixTagger — context = leading/trailing substring of the token. */
export class AffixTagger extends ContextTagger {
  readonly affixLength: number;
  readonly minStemLength: number;
  private readonly minWordLength: number;

  constructor(
    train?: ReadonlyArray<GoldSentence> | null,
    model?: TaggerModel | null,
    affixLength = -3,
    minStemLength = 2,
    backoff?: SequentialBackoffTagger | null,
    cutoff = 0,
    verbose = false,
  ) {
    // NLTK __init__ accepts positional (train, model, affix_length, min_stem_length, backoff, cutoff, verbose).
    super(backoff ?? null);
    this.affixLength = affixLength;
    this.minStemLength = minStemLength;
    this.minWordLength = minStemLength + Math.abs(affixLength);
    if (model) this.loadModel(model);
    if (train) this.train(train, cutoff, verbose);
  }

  context(tokens: UntaggedSentence, index: number, _history?: readonly (string | null)[]): TagContext | null {
    const token = tokens[index]!;
    if (token.length < this.minWordLength) return null;
    return this.affixLength > 0 ? token.slice(0, this.affixLength) : token.slice(this.affixLength);
  }

  encodeJsonObj(): [number, number, Map<TagContext, string>, SequentialBackoffTagger | null] {
    return [this.affixLength, this.minWordLength, this.contextToTag, this.backoff];
  }

  static decodeJsonObj(obj: [number, number, Map<TagContext, string>, SequentialBackoffTagger | null]): AffixTagger {
    const [affixLength, minWordLength, contextToTag, backoff] = obj;
    return new AffixTagger(null, contextToTag, affixLength, minWordLength - Math.abs(affixLength), backoff);
  }

  override toString(): string {
    return `<AffixTagger: size=${this.size()}>`;
  }
}

export interface FeaturesetClassifier {
  classify(featureset: Record<string, unknown>): string;
  prob_classify?(featureset: Record<string, unknown>): { max(): string; prob(x: string): number };
  probClassify?(featureset: Record<string, unknown>): { max(): string; prob(x: string): number };
}

/** nltk.tag.sequential.ClassifierBasedTagger — tagger driven by a classifier + feature detector. */
export class ClassifierBasedTagger extends SequentialBackoffTagger {
  protected featureDetectorFn?: FeatureDetector;
  protected classifierObj?: FeaturesetClassifier;
  readonly cutoffProb?: number;

  constructor(options: {
    feature_detector?: FeatureDetector;
    train?: ReadonlyArray<GoldSentence> | null;
    classifier_builder?: (labeled: ReadonlyArray<readonly [Record<string, unknown>, string]>) => FeaturesetClassifier;
    classifier?: FeaturesetClassifier | null;
    backoff?: SequentialBackoffTagger | null;
    cutoff_prob?: number;
    verbose?: boolean;
  } = {}) {
    const { train = null, classifier = null } = options;
    if (!train && !classifier) {
      throw new Error("Must specify either training data or trained model.");
    }
    if (train && classifier) {
      throw new Error("Must specify either training data or trained classifier.");
    }
    super(options.backoff ?? null);
    if (options.feature_detector) this.featureDetectorFn = options.feature_detector;
    this.cutoffProb = options.cutoff_prob;
    this.classifierObj = classifier ?? undefined;
    if (train) this.trainClassifier(train, options.classifier_builder, options.verbose ?? false);
  }

  size(): number { return 0; }

  feature_detector(tokens: UntaggedSentence, index: number, history: readonly (string | null)[]): Record<string, unknown> {
    if (!this.featureDetectorFn) throw new Error("feature_detector is not defined for this tagger");
    return this.featureDetectorFn(tokens, index, history);
  }

  classifier(): FeaturesetClassifier | undefined { return this.classifierObj; }

  chooseTag(tokens: UntaggedSentence, index: number, history: readonly (string | null)[]): string | null {
    const featureset = this.feature_detector(tokens, index, history);
    const clf = this.classifierObj;
    if (!clf) return null;
    if (this.cutoffProb == null) return clf.classify(featureset);
    const pdist = (clf.prob_classify ?? clf.probClassify)!.call(clf, featureset);
    const tag = pdist.max();
    return pdist.prob(tag) >= this.cutoffProb ? tag : null;
  }

  private trainClassifier(
    taggedCorpus: ReadonlyArray<GoldSentence>,
    classifierBuilder: ((labeled: ReadonlyArray<readonly [Record<string, unknown>, string]>) => FeaturesetClassifier) | undefined,
    verbose: boolean,
  ): void {
    const classifierCorpus: Array<readonly [Record<string, unknown>, string]> = [];
    if (verbose) console.log("Constructing training corpus for classifier.");
    for (const sentence of taggedCorpus) {
      const history: string[] = [];
      const untagged = sentence.map(([word]) => word);
      const tags = sentence.map(([, tag]) => tag);
      for (let index = 0; index < sentence.length; index += 1) {
        classifierCorpus.push([this.feature_detector(untagged, index, history), tags[index]!]);
        history.push(tags[index]!);
      }
    }
    if (verbose) console.log(`Training classifier (${classifierCorpus.length} instances)`);
    if (!classifierBuilder) throw new Error("classifier_builder is required when training");
    this.classifierObj = classifierBuilder(classifierCorpus);
  }

  override toString(): string {
    return `<ClassifierBasedTagger: ${String(this.classifierObj)}>`;
  }
}

/** nltk.tag.sequential.ClassifierBasedPOSTagger — POS-specific feature detector. */
export class ClassifierBasedPOSTagger extends ClassifierBasedTagger {
  override feature_detector(tokens: UntaggedSentence, index: number, history: readonly (string | null)[]): Record<string, unknown> {
    const word = tokens[index]!;
    let prevword: string | null, prevprevword: string | null, prevtag: string | null, prevprevtag: string | null;
    if (index === 0) {
      prevword = prevprevword = prevtag = prevprevtag = null;
    } else if (index === 1) {
      prevword = tokens[index - 1]!.toLowerCase(); prevprevword = null;
      prevtag = history[index - 1]!; prevprevtag = null;
    } else {
      prevword = tokens[index - 1]!.toLowerCase();
      prevprevword = tokens[index - 2]!.toLowerCase();
      prevtag = history[index - 1]!; prevprevtag = history[index - 2]!;
    }
    let shape: string;
    if (/^[0-9]+(\.[0-9]*)?|^[0-9]*\.[0-9]+$/.test(word)) shape = "number";
    else if (/^\W+$/.test(word)) shape = "punct";
    else if (/^[A-Z][a-z]+$/.test(word)) shape = "upcase";
    else if (/^[a-z]+$/.test(word)) shape = "downcase";
    else if (/^\w+$/.test(word)) shape = "mixedcase";
    else shape = "other";
    const lower = word.toLowerCase();
    return {
      prevtag, prevprevtag, word, "word.lower": lower,
      suffix3: lower.slice(-3), suffix2: lower.slice(-2), suffix1: lower.slice(-1),
      prevprevword, prevword,
      "prevtag+word": `${prevtag ?? "None"}+${lower}`,
      "prevprevtag+word": `${prevprevtag ?? "None"}+${lower}`,
      "prevword+word": `${prevword ?? "None"}+${lower}`,
      shape,
    };
  }
}
