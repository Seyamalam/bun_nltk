import { ConditionalFreqDist } from "./freqdist";

export type TaggedToken = readonly [word: string, tag: string];
export type GoldSentence = readonly TaggedToken[];
export type UntaggedSentence = readonly string[];

export type TagContext = string | readonly string[];

export type TaggerModel = ReadonlyMap<TagContext, string> | Record<string, string>;

export interface NgramTaggerOptions {
  train?: readonly GoldSentence[];
  model?: TaggerModel;
  backoff?: SequentialBackoffTagger | null;
  cutoff?: number;
  verbose?: boolean;
}

function contextKey(context: TagContext): string {
  return typeof context === "string" ? JSON.stringify(context) : JSON.stringify([...context]);
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

  protected abstract chooseTag(tokens: UntaggedSentence, index: number, history: ReadonlyArray<string | null>): string | null;

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

  protected train(taggedCorpus: ReadonlyArray<GoldSentence>, cutoff = 0, verbose = false): void {
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

  protected abstract context(tokens: UntaggedSentence, index: number, history: ReadonlyArray<string | null>): TagContext | null;
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

  protected chooseTag(): string | null {
    return this.#tag;
  }

  toString(): string {
    return `<DefaultTagger: tag=${this.#tag}>`;
  }
}

export class NgramTagger extends ContextTagger {
  readonly n: number;

  constructor(n: number, options: NgramTaggerOptions = {}) {
    super(options.backoff ?? null);
    this.n = n;
    if (options.train && options.model) {
      throw new Error("Cannot specify both train and model for NgramTagger");
    }
    if (options.model) this.loadModel(options.model);
    if (options.train && options.train.length > 0) {
      this.train(options.train, options.cutoff ?? 0, options.verbose ?? false);
    }
  }

  protected context(tokens: UntaggedSentence, index: number, history: ReadonlyArray<string | null>): TagContext {
    const start = Math.max(0, index - this.n + 1);
    return [...history.slice(start, index), tokens[index]!];
  }

  toString(): string {
    return `<${this.constructor.name}: size=${this.size()}>`;
  }
}

export class UnigramTagger extends ContextTagger {
  constructor(options: NgramTaggerOptions = {}) {
    super(options.backoff ?? null);
    if (options.train && options.model) {
      throw new Error("Cannot specify both train and model for UnigramTagger");
    }
    if (options.model) this.loadModel(options.model);
    if (options.train && options.train.length > 0) {
      this.train(options.train, options.cutoff ?? 0, options.verbose ?? false);
    }
  }

  protected context(tokens: UntaggedSentence, index: number): TagContext {
    return tokens[index]!;
  }

  toString(): string {
    return `<UnigramTagger: size=${this.size()}>`;
  }
}

export class BigramTagger extends NgramTagger {
  constructor(options: NgramTaggerOptions = {}) {
    super(2, options);
  }

  toString(): string {
    return `<BigramTagger: size=${this.size()}>`;
  }
}

export class TrigramTagger extends NgramTagger {
  constructor(options: NgramTaggerOptions = {}) {
    super(3, options);
  }

  toString(): string {
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

  protected chooseTag(tokens: UntaggedSentence, index: number): string | null {
    const token = tokens[index]!;
    for (const { pattern, tag } of this.regexps) {
      pattern.lastIndex = 0;
      if (pattern.test(token)) return tag;
    }
    return null;
  }

  toString(): string {
    return `<Regexp Tagger: size=${this.size()}>`;
  }
}
