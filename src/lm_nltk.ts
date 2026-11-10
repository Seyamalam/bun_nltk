import { ConditionalFreqDist, FreqDist } from "./freqdist.ts";

const MAX_NGRAMS = 10_000_000;

/** CPython `random.Random(seed)` - MT19937 with init_by_array keying for int seeds. */
export class PythonRandom {
  private mt = new Uint32Array(624);
  private index = 624;

  constructor(seed?: number | PythonRandom) {
    if (seed instanceof PythonRandom) {
      this.mt.set(seed.mt);
      this.index = seed.index;
      return;
    }
    const s = seed === undefined ? Math.floor(Math.random() * 0xffffffff) : Math.floor(Math.abs(seed));
    const key = [s >>> 0];
    this.mt[0] = 19650218;
    for (let i = 1; i < 624; i++) {
      this.mt[i] = (1812433253 * (this.mt[i - 1]! ^ (this.mt[i - 1]! >>> 30)) + i) >>> 0;
    }
    let i = 1, j = 0, k = Math.max(624, key.length);
    for (; k; k--) {
      this.mt[i] = ((this.mt[i]! ^ ((this.mt[i - 1]! ^ (this.mt[i - 1]! >>> 30)) * 1664525)) + key[j]! + j) >>> 0;
      i++; j++;
      if (i >= 624) { this.mt[0] = this.mt[623]!; i = 1; }
      if (j >= key.length) j = 0;
    }
    for (k = 623; k; k--) {
      this.mt[i] = ((this.mt[i]! ^ ((this.mt[i - 1]! ^ (this.mt[i - 1]! >>> 30)) * 1566083941)) - i) >>> 0;
      i++;
      if (i >= 624) { this.mt[0] = this.mt[623]!; i = 1; }
    }
    this.mt[0] = 0x80000000;
  }

  private gen(): number {
    const mag = [0, 0x9908b0df];
    if (this.index >= 624) {
      let y: number;
      for (let kk = 0; kk < 227; kk++) {
        y = (this.mt[kk]! & 0x80000000) | (this.mt[kk + 1]! & 0x7fffffff);
        this.mt[kk] = (this.mt[kk + 397]! ^ (y >>> 1) ^ mag[y & 1]!) >>> 0;
      }
      for (let kk = 227; kk < 623; kk++) {
        y = (this.mt[kk]! & 0x80000000) | (this.mt[kk + 1]! & 0x7fffffff);
        this.mt[kk] = (this.mt[kk - 227]! ^ (y >>> 1) ^ mag[y & 1]!) >>> 0;
      }
      y = (this.mt[623]! & 0x80000000) | (this.mt[0]! & 0x7fffffff);
      this.mt[623] = (this.mt[396]! ^ (y >>> 1) ^ mag[y & 1]!) >>> 0;
      this.index = 0;
    }
    let y = this.mt[this.index++]!;
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return y >>> 0;
  }

  /** CPython `random()`: 53-bit float from two 32-bit draws. */
  random(): number {
    const a = this.gen() >>> 5, b = this.gen() >>> 6;
    return (a * 67108864 + b) / 9007199254740992;
  }
}

function fsum(items: number[]): number {
  // Neumaier compensated summation ~ math.fsum for this scale.
  let sum = 0, c = 0;
  for (const x of items) {
    const t = sum + x;
    c += Math.abs(sum) >= Math.abs(x) ? (sum - t) + x : (x - t) + sum;
    sum = t;
  }
  return sum + c;
}

export class Vocabulary {
  readonly counts = new FreqDist<string>();
  readonly unkLabel: string;
  private readonly _cutoff: number;
  private _len = 0;

  constructor(counts?: Iterable<string> | FreqDist<string> | Record<string, number>, unkCutoff = 1, unkLabel = "<UNK>") {
    this.unkLabel = unkLabel;
    if (unkCutoff < 1) throw new RangeError(`Cutoff value cannot be less than 1. Got: ${unkCutoff}`);
    this._cutoff = unkCutoff;
    this.update(counts ?? []);
  }

  get unk_label(): string { return this.unkLabel; }
  get cutoff(): number { return this._cutoff; }
  get length(): number { return this._len; }

  update(items?: Iterable<string> | FreqDist<string> | Record<string, number>): void {
    if (items instanceof FreqDist) {
      for (const [k, c] of items.entries()) for (let i = 0; i < c; i++) this.counts.inc(k);
    } else if (items !== undefined && typeof items === "object" && !Array.isArray(items) && !(Symbol.iterator in items)) {
      for (const [k, c] of Object.entries(items)) for (let i = 0; i < c; i++) this.counts.inc(k);
    } else {
      for (const w of items ?? []) this.counts.inc(w);
    }
    this._len = [...this].length;
  }

  private lookupOne(word: string): string {
    return this.contains(word) ? word : this.unkLabel;
  }

  lookup(words: unknown): unknown {
    if (typeof words === "string") return this.lookupOne(words);
    if (words != null && typeof (words as Iterable<unknown>)[Symbol.iterator] === "function") {
      return [...(words as Iterable<unknown>)].map((w) => this.lookup(w));
    }
    throw new TypeError(`Unsupported type for looking up in vocabulary: ${typeof words}`);
  }

  lookupStr(words: string | Iterable<unknown>): string | unknown[] {
    return this.lookup(words) as string | unknown[];
  }

  get(item: string): number {
    return item === this.unkLabel ? this._cutoff : this.counts.get(item);
  }

  contains(item: string): boolean {
    return this.get(item) >= this._cutoff;
  }

  *[Symbol.iterator](): Generator<string> {
    for (const [k] of this.counts.entries()) if (this.contains(k)) yield k;
    if (this.counts.B() > 0) yield this.unkLabel;
  }

  equals(other: Vocabulary): boolean {
    if (this.unkLabel !== other.unkLabel || this._cutoff !== other._cutoff) return false;
    return this.counts.equals?.(other.counts) ?? JSON.stringify([...this.counts.entries()].sort()) === JSON.stringify([...other.counts.entries()].sort());
  }

  toString(): string {
    return `<Vocabulary with cutoff=${this._cutoff} unk_label='${this.unkLabel}' and ${this._len} items>`;
  }
}

export class NgramCounter {
  private readonly _counts = new Map<number, ConditionalFreqDist<string[], string>>();
  readonly unigrams = new FreqDist<string>();
  private _distinct = 0;

  constructor(ngramText?: Iterable<Iterable<string[]>>) {
    if (ngramText) this.update(ngramText);
  }

  private orderCounts(order: number): ConditionalFreqDist<string[], string> {
    let cfd = this._counts.get(order);
    if (!cfd) {
      cfd = new ConditionalFreqDist<string[], string>();
      this._counts.set(order, cfd);
    }
    return cfd;
  }

  update(ngramText: Iterable<Iterable<string[]>>): void {
    for (const sent of ngramText) {
      for (const ngram of sent) {
        if (!Array.isArray(ngram)) throw new TypeError(`Ngram <${ngram}> isn't a tuple`);
        const order = ngram.length;
        if (order === 1) {
          if (this.unigrams.get(ngram[0]!) === 0) this.noteNew();
          this.unigrams.inc(ngram[0]!);
          continue;
        }
        const context = ngram.slice(0, -1);
        const word = ngram[order - 1]!;
        const dist = this.orderCounts(order).get(context);
        if (dist.get(word) === 0) this.noteNew();
        dist.inc(word);
      }
    }
  }

  private noteNew(): void {
    if (this._distinct >= MAX_NGRAMS) {
      throw new RangeError(
        `Refusing to count further: NgramCounter exceeded the limit of ${MAX_NGRAMS} distinct ngrams (CWE-770).`,
      );
    }
    this._distinct += 1;
  }

  N(): number {
    let total = this.unigrams.N();
    for (const cfd of this._counts.values()) total += cfd.N();
    return total;
  }

  /** `counter[n]` -> ConditionalFreqDist (n>=2) or unigram FreqDist (n=1); `counter['w']` -> unigram count; `counter[[ctx...]]` -> context FreqDist. */
  get(item: number): ConditionalFreqDist<string[], string> | FreqDist<string>;
  get(item: string): number;
  get(item: string[]): FreqDist<string>;
  get(item: number | string | string[]): ConditionalFreqDist<string[], string> | FreqDist<string> | number {
    if (typeof item === "number") return item === 1 ? this.unigrams : this.orderCounts(item);
    if (typeof item === "string") return this.unigrams.get(item);
    return this.orderCounts(item.length + 1).get(item);
  }

  contextDist(context: string[]): FreqDist<string> {
    return this.orderCounts(context.length + 1).get(context);
  }

  get ngramOrderCount(): number {
    return this._counts.size + 1;
  }

  toString(): string {
    return `<NgramCounter with ${this._counts.size + 1} ngram orders and ${this.N()} ngrams>`;
  }
}

export abstract class Smoothing {
  constructor(protected readonly vocab: Vocabulary, protected readonly counts: NgramCounter) {}

  protected ctxDist(context: string[]): FreqDist<string> {
    return this.counts.contextDist(context);
  }

  abstract unigram_score(word: string): number;
  abstract alpha_gamma(word: string, context: string[]): [number, number];
}

function countValuesGtZero(dist: FreqDist<string>): number {
  let n = 0;
  for (const [, c] of dist.entries()) if (c > 0) n++;
  return n;
}

export class WittenBell extends Smoothing {
  alpha_gamma(word: string, context: string[]): [number, number] {
    const alpha = this.ctxDist(context).freq(word);
    const gamma = this.gammaOf(context);
    return [(1 - gamma) * alpha, gamma];
  }

  private gammaOf(context: string[]): number {
    const dist = this.ctxDist(context);
    const nPlus = countValuesGtZero(dist);
    return nPlus / (nPlus + dist.N());
  }

  unigram_score(word: string): number {
    return this.counts.unigrams.freq(word);
  }
}

export class AbsoluteDiscounting extends Smoothing {
  constructor(vocab: Vocabulary, counts: NgramCounter, readonly discount = 0.75) {
    super(vocab, counts);
  }

  alpha_gamma(word: string, context: string[]): [number, number] {
    const dist = this.ctxDist(context);
    const alpha = Math.max(dist.get(word) - this.discount, 0) / dist.N();
    return [alpha, this.gammaOf(dist)];
  }

  private gammaOf(dist: FreqDist<string>): number {
    return (this.discount * countValuesGtZero(dist)) / dist.N();
  }

  unigram_score(word: string): number {
    return this.counts.unigrams.freq(word);
  }
}

export class KneserNey extends Smoothing {
  constructor(
    vocab: Vocabulary,
    counts: NgramCounter,
    private readonly _order: number,
    readonly discount = 0.1,
  ) {
    super(vocab, counts);
  }

  unigram_score(word: string): number {
    const [wc, total] = this.continuationCounts(word, []);
    return wc / total;
  }

  alpha_gamma(word: string, context: string[]): [number, number] {
    const prefix = this.ctxDist(context);
    const [wc, total] =
      context.length + 1 === this._order ? [prefix.get(word), prefix.N()] : this.continuationCounts(word, context);
    const alpha = Math.max(wc - this.discount, 0) / total;
    const gamma = (this.discount * countValuesGtZero(prefix)) / total;
    return [alpha, gamma];
  }

  private continuationCounts(word: string, context: string[]): [number, number] {
    let withWord = 0, total = 0;
    // iterate order-(len+2) ConditionalFreqDist entries whose context suffix matches
    const cfd = this.counts.get(context.length + 2) as ConditionalFreqDist<string[], string>;
    for (const prefix of cfd.conditions()) {
      if (JSON.stringify(prefix.slice(1)) !== JSON.stringify(context)) continue;
      const dist = cfd.get(prefix);
      if (dist.get(word) > 0) withWord++;
      total += countValuesGtZero(dist);
    }
    return [withWord, total];
  }
}

export abstract class LanguageModel {
  readonly order: number;
  readonly vocab: Vocabulary;
  readonly counts: NgramCounter;

  constructor(order: number, vocabulary?: Vocabulary, counter?: NgramCounter) {
    this.order = order;
    this.vocab = vocabulary ?? new Vocabulary();
    this.counts = counter ?? new NgramCounter();
  }

  fit(text: Iterable<Iterable<string[]>>, vocabularyText?: Iterable<string>): void {
    if (this.vocab.length === 0) {
      if (vocabularyText === undefined) {
        throw new Error("Cannot fit without a vocabulary or text to create it from.");
      }
      this.vocab.update(vocabularyText);
    }
    for (const sent of text) {
      this.counts.update([[...sent].map((ng) => this.vocab.lookup(ng) as string[])]);
    }
  }

  score(word: string, context?: string[] | null): number {
    return this.unmasked_score(
      this.vocab.lookup(word) as string,
      context && context.length ? (this.vocab.lookup(context) as string[]) : null,
    );
  }

  abstract unmasked_score(word: string, context: string[] | null): number;

  logscore(word: string, context?: string[] | null): number {
    const s = this.score(word, context);
    if (!(s > 0)) throw new RangeError("math domain error");
    return Math.log2(s);
  }

  context_counts(context: string[] | null): FreqDist<string> {
    return context && context.length ? this.counts.contextDist(context) : this.counts.unigrams;
  }

  contextCounts(context: string[] | null): FreqDist<string> {
    return this.context_counts(context);
  }

  entropy(textNgrams: Iterable<string[]>): number {
    const scores = [...textNgrams].map((ngram) => this.logscore(ngram[ngram.length - 1]!, ngram.slice(0, -1)));
    return -fsum(scores) / scores.length;
  }

  perplexity(textNgrams: Iterable<string[]>): number {
    return Math.pow(2, this.entropy(textNgrams));
  }

  generate(num_words = 1, text_seed?: Iterable<string>, random_seed?: number | PythonRandom): string | string[] {
    const textSeed = text_seed === undefined ? [] : [...text_seed];
    const rng = random_seed instanceof PythonRandom ? random_seed : new PythonRandom(random_seed);
    if (num_words === 1) {
      let context = textSeed.length >= this.order ? textSeed.slice(-(this.order - 1)) : [...textSeed];
      let samples = this.context_counts(this.vocab.lookup(context) as string[]);
      while (context.length && samples.B() === 0) {
        context = context.length > 1 ? context.slice(1) : [];
        samples = this.context_counts(this.vocab.lookup(context) as string[]);
      }
      const sorted = [...samples].sort();
      const weights = sorted.map((w) => this.score(w, context));
      return weightedChoice(sorted, weights, rng);
    }
    const generated: string[] = [];
    for (let i = 0; i < num_words; i++) {
      generated.push(this.generate(1, textSeed.concat(generated), rng) as string);
    }
    return generated;
  }
}

function weightedChoice(population: string[], weights: number[], rng: PythonRandom): string {
  if (population.length === 0) throw new Error("Can't choose from empty population");
  if (population.length !== weights.length) throw new Error("The number of weights does not match the population");
  const cum: number[] = [];
  let acc = 0;
  for (const w of weights) cum.push((acc += w));
  const threshold = rng.random() * fsum(weights);
  let lo = 0, hi = cum.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid]! <= threshold) lo = mid + 1;
    else hi = mid;
  }
  return population[lo]!;
}

export class MLE extends LanguageModel {
  unmasked_score(word: string, context: string[] | null): number {
    return this.context_counts(context).freq(word);
  }
}

export class Lidstone extends LanguageModel {
  constructor(public readonly gamma: number, order: number, vocabulary?: Vocabulary, counter?: NgramCounter) {
    super(order, vocabulary, counter);
  }

  unmasked_score(word: string, context: string[] | null): number {
    const counts = this.context_counts(context);
    return (counts.get(word) + this.gamma) / (counts.N() + this.vocab.length * this.gamma);
  }
}

export class Laplace extends Lidstone {
  constructor(order: number, vocabulary?: Vocabulary, counter?: NgramCounter) {
    super(1, order, vocabulary, counter);
  }
}

export class StupidBackoff extends LanguageModel {
  constructor(public readonly alpha = 0.4, order: number, vocabulary?: Vocabulary, counter?: NgramCounter) {
    super(order, vocabulary, counter);
  }

  unmasked_score(word: string, context: string[] | null): number {
    let ctx = context;
    if (ctx && ctx.length) {
      const maxCtx = this.order - 1;
      ctx = maxCtx <= 0 ? [] : ctx.length > maxCtx ? ctx.slice(-maxCtx) : ctx;
    }
    if (!ctx || ctx.length === 0) return this.counts.unigrams.freq(word);
    const counts = this.context_counts(ctx);
    const wordCount = counts.get(word);
    if (wordCount > 0) return wordCount / counts.N();
    return this.alpha * this.unmasked_score(word, ctx.slice(1));
  }
}

export class InterpolatedLanguageModel extends LanguageModel {
  protected readonly estimator: Smoothing;

  constructor(
    smoothingCls: new (vocab: Vocabulary, counts: NgramCounter, ...args: never[]) => Smoothing,
    order: number,
    vocabulary?: Vocabulary,
    counter?: NgramCounter,
    buildEstimator?: (vocab: Vocabulary, counts: NgramCounter) => Smoothing,
  ) {
    super(order, vocabulary, counter);
    this.estimator = buildEstimator
      ? buildEstimator(this.vocab, this.counts)
      : new smoothingCls(this.vocab, this.counts);
  }

  unmasked_score(word: string, context: string[] | null): number {
    let ctx = context;
    if (ctx && ctx.length) {
      const maxCtx = this.order - 1;
      ctx = maxCtx <= 0 ? [] : ctx.length > maxCtx ? ctx.slice(-maxCtx) : ctx;
    }
    if (!ctx || ctx.length === 0) return this.estimator.unigram_score(word);
    const [alpha, gamma] = this.counts.get(ctx).B() === 0 ? [0, 1] : this.estimator.alpha_gamma(word, ctx);
    return alpha + gamma * this.unmasked_score(word, ctx.slice(1));
  }
}

export class WittenBellInterpolated extends InterpolatedLanguageModel {
  constructor(order: number, vocabulary?: Vocabulary, counter?: NgramCounter) {
    super(WittenBell as never, order, vocabulary, counter);
  }
}

export class AbsoluteDiscountingInterpolated extends InterpolatedLanguageModel {
  constructor(order: number, readonly discount = 0.75, vocabulary?: Vocabulary, counter?: NgramCounter) {
    super(AbsoluteDiscounting as never, order, vocabulary, counter,
      (v, c) => new AbsoluteDiscounting(v, c, discount));
  }
}

export class KneserNeyInterpolated extends InterpolatedLanguageModel {
  constructor(order: number, readonly discount = 0.1, vocabulary?: Vocabulary, counter?: NgramCounter) {
    if (discount < 0 || discount > 1) {
      throw new RangeError("Discount must be between 0 and 1 for probabilities to sum to unity.");
    }
    super(KneserNey as never, order, vocabulary, counter,
      (v, c) => new KneserNey(v, c, order, discount));
  }
}
