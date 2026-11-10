import { accuracy } from "./confusion_metrics";
import { ConfusionMatrix } from "./confusion_metrics";

/**
 * NLTK processing-interface ABCs, ported from nltk.tokenize.api,
 * nltk.stem.api, nltk.tag.api, nltk.parse.api, nltk.classify.api and
 * nltk.probability. Each class replicates Python's "delegates to the
 * overridden sibling method" contract via prototype comparison.
 */

export type TaggedToken<S = string, T = string> = [S, T];
export type TaggedSentence<S = string, T = string> = TaggedToken<S, T>[];

function overridden(instance: object, name: string, base: Function): boolean {
  const proto = Object.getPrototypeOf(instance) as Record<string, unknown>;
  return proto[name] !== base.prototype[name as keyof typeof base];
}

// ---- nltk.stem.api.StemmerI -------------------------------------------------

export abstract class StemmerI {
  /** Strip affixes from the token and return the stem. */
  abstract stem(token: string): string;
}

// ---- nltk.tokenize.api.TokenizerI -------------------------------------------

export abstract class TokenizerI {
  /** Return a tokenized copy of `s`. */
  tokenize(s: string): string[] {
    if (overridden(this, "tokenize_sents", TokenizerI)) return this.tokenize_sents([s])[0]!;
    throw new Error("NotImplementedError");
  }
  /** Integer `(start, end)` offsets for each token in `s`. */
  span_tokenize(_s: string): Array<[number, number]> {
    throw new Error("NotImplementedError");
  }
  /** Apply `tokenize()` to each element of `strings`. */
  tokenize_sents(strings: readonly string[]): string[][] {
    return strings.map((s) => this.tokenize(s));
  }
  /** Apply `span_tokenize()` to each element of `strings`. */
  *span_tokenize_sents(strings: readonly string[]): Generator<Array<[number, number]>> {
    for (const s of strings) yield [...this.span_tokenize(s)];
  }
  spanTokenize(s: string): Array<[number, number]> { return this.span_tokenize(s); }
  tokenizeSents(strings: readonly string[]): string[][] { return this.tokenize_sents(strings); }
  spanTokenizeSents(strings: readonly string[]): Array<Array<[number, number]>> {
    return [...this.span_tokenize_sents(strings)];
  }
}

// ---- nltk.tag.api.TaggerI ---------------------------------------------------

export function untag<T, S>(taggedSentence: readonly [T, S][]): T[] {
  return taggedSentence.map(([w]) => w);
}

export abstract class TaggerI {
  /** Tag `tokens` — delegates to `tag_sents` when that is overridden. */
  tag(tokens: string[]): TaggedToken[] {
    if (overridden(this, "tag_sents", TaggerI)) return this.tag_sents([tokens])[0]!;
    throw new Error("NotImplementedError");
  }
  /** Apply `tag()` to each element of `sentences`. */
  tag_sents(sentences: Iterable<string[]>): TaggedToken[][] {
    return [...sentences].map((s) => this.tag(s));
  }
  tagSents(sentences: Iterable<string[]>): TaggedToken[][] { return this.tag_sents(sentences); }
  /** Deprecated alias of `accuracy` (NLTK `evaluate`). */
  evaluate(gold: readonly TaggedToken[][]): number { return this.accuracy(gold); }
  /** Score accuracy against the gold standard. */
  accuracy(gold: readonly TaggedToken[][]): number {
    const taggedSents = this.tag_sents(gold.map((s) => untag(s)));
    const goldTokens = gold.flat().map(([, t]) => t);
    const testTokens = taggedSents.flat().map(([, t]) => t);
    return accuracy(goldTokens, testTokens);
  }
  /** ConfusionMatrix: gold tags as reference, predictions as test. */
  confusion(gold: readonly TaggedToken[][]): ConfusionMatrix {
    const taggedSents = this.tag_sents(gold.map((s) => untag(s)));
    const goldTokens = gold.flat().map(([, t]) => t);
    const testTokens = taggedSents.flat().map(([, t]) => t);
    return new ConfusionMatrix(goldTokens, testTokens);
  }
  /** Per-tag precision over the gold standard (dict in NLTK, Map here). */
  precision(gold: readonly TaggedToken[][]): Map<string, number> {
    const cm = this.confusion(gold);
    return new Map(cm.labels.map((tag) => [tag, cm.precision(tag)]));
  }
  /** Per-tag recall over the gold standard. */
  recall(gold: readonly TaggedToken[][]): Map<string, number> {
    const cm = this.confusion(gold);
    return new Map(cm.labels.map((tag) => [tag, cm.recall(tag)]));
  }
  /** Per-tag F-measure over the gold standard. */
  f_measure(gold: readonly TaggedToken[][], alpha = 0.5): Map<string, number> {
    const cm = this.confusion(gold);
    return new Map(cm.labels.map((tag) => [tag, cm.f_measure(tag, alpha)]));
  }
  fMeasure(gold: readonly TaggedToken[][], alpha = 0.5): Map<string, number> {
    return this.f_measure(gold, alpha);
  }
  /** Per-tag precision/recall/F table (NLTK `evaluate_per_tag`). */
  evaluate_per_tag(gold: readonly TaggedToken[][]): string {
    const cm = this.confusion(gold);
    return cm.evaluate();
  }
  evaluatePerTag(gold: readonly TaggedToken[][]): string { return this.evaluate_per_tag(gold); }
}

/** A tagger that requires tokens to be featuresets. */
export abstract class FeaturesetTaggerI extends TaggerI {}

// ---- nltk.parse.api.ParserI -------------------------------------------------

export abstract class ParserI<T = string> {
  /** The grammar used by this parser. */
  grammar(): unknown { throw new Error("NotImplementedError"); }
  /** Iterate parse trees for `sent`. */
  *parse(sent: readonly T[], ...args: unknown[]): Generator<unknown> {
    if (overridden(this, "parse_sents", ParserI)) {
      yield* this.parse_sents([sent as T[]], ...args).next().value as Generator<unknown>;
      return;
    }
    if (overridden(this, "parse_one", ParserI)) {
      const tree = this.parse_one(sent, ...args);
      if (tree !== null && tree !== undefined) yield tree;
      return;
    }
    if (overridden(this, "parse_all", ParserI)) {
      yield* this.parse_all(sent, ...args);
      return;
    }
    throw new Error("NotImplementedError");
  }
  /** Apply `parse()` to each element of `sents`. */
  *parse_sents(sents: Iterable<readonly T[]>, ...args: unknown[]): Generator<Generator<unknown>> {
    for (const sent of sents) yield this.parse(sent as T[], ...args);
  }
  /** All parses of `sent` as a list. */
  parse_all(sent: readonly T[], ...args: unknown[]): unknown[] {
    return [...this.parse(sent, ...args)];
  }
  /** The first parse of `sent`, or null. */
  parse_one(sent: readonly T[], ...args: unknown[]): unknown | null {
    return this.parse(sent, ...args).next().value ?? null;
  }
  parseSents(sents: Iterable<readonly T[]>, ...args: unknown[]): Generator<Generator<unknown>> {
    return this.parse_sents(sents, ...args);
  }
  parseAll(sent: readonly T[], ...args: unknown[]): unknown[] { return this.parse_all(sent, ...args); }
  parseOne(sent: readonly T[], ...args: unknown[]): unknown | null { return this.parse_one(sent, ...args); }
}

// ---- nltk.classify.api.ClassifierI ------------------------------------------

export abstract class ClassifierI<F = unknown, L = string> {
  /** The list of category labels used by this classifier. */
  labels(): L[] { throw new Error("NotImplementedError"); }
  /** The most appropriate label for `featureset`. */
  classify(featureset: F): L {
    if (overridden(this, "classify_many", ClassifierI)) return this.classify_many([featureset])[0]!;
    throw new Error("NotImplementedError");
  }
  /** A probability distribution over labels for `featureset`. */
  prob_classify(featureset: F): unknown {
    if (overridden(this, "prob_classify_many", ClassifierI)) return this.prob_classify_many([featureset])[0];
    throw new Error("NotImplementedError");
  }
  /** Apply `classify()` to each element of `featuresets`. */
  classify_many(featuresets: readonly F[]): L[] { return featuresets.map((fs) => this.classify(fs)); }
  /** Apply `prob_classify()` to each element of `featuresets`. */
  prob_classify_many(featuresets: readonly F[]): unknown[] { return featuresets.map((fs) => this.prob_classify(fs)); }
  probClassify(featureset: F): unknown { return this.prob_classify(featureset); }
  classifyMany(featuresets: readonly F[]): L[] { return this.classify_many(featuresets); }
  probClassifyMany(featuresets: readonly F[]): unknown[] { return this.prob_classify_many(featuresets); }
}

// ---- nltk.probability mixins ------------------------------------------------

export class ProbabilisticMixIn {
  private _prob: number | null;
  private _logprob: number | null;
  constructor({ prob, logprob }: { prob?: number; logprob?: number } = {}) {
    if (prob !== undefined && logprob !== undefined) {
      throw new TypeError("Must specify either prob or logprob (not both)");
    }
    this._prob = null;
    this._logprob = null;
    if (prob !== undefined) this.set_prob(prob);
    else if (logprob !== undefined) this.set_logprob(logprob);
  }
  set_prob(prob: number): void { this._prob = prob; this._logprob = null; }
  set_logprob(logprob: number): void { this._logprob = logprob; this._prob = null; }
  setProb(prob: number): void { this.set_prob(prob); }
  setLogprob(logprob: number): void { this.set_logprob(logprob); }
  prob(): number | null {
    if (this._prob === null) {
      if (this._logprob === null) return null;
      this._prob = 2 ** this._logprob;
    }
    return this._prob;
  }
  logprob(): number | null {
    if (this._logprob === null) {
      if (this._prob === null) return null;
      this._logprob = Math.log2(this._prob);
    }
    return this._logprob;
  }
}

export class ImmutableProbabilisticMixIn extends ProbabilisticMixIn {
  override set_prob(_prob: number): void {
    throw new Error(`${this.constructor.name} is immutable`);
  }
  override set_logprob(_logprob: number): void {
    throw new Error(`${this.constructor.name} is immutable`);
  }
}

// ---- nltk.util ---------------------------------------------------------------


export function unsupportedStub(name: string): never {
  throw new Error(`${name} is an interactive/platform-bound helper with no TS-parity surface`);
}
