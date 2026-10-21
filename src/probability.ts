import { ConditionalFreqDist, FreqDist } from "./freqdist";
export { HeldoutProbDist, CrossValidationProbDist, KneserNeyProbDist } from "./probability_missing.ts";
export type { Trigram } from "./probability_missing.ts";
import { probabilityKey, probabilityRuntime } from "./probability_abi.ts";

const NEG_INF = Number.NEGATIVE_INFINITY;
export const add_logs = addLogs;
export const sum_logs = sumLogs;
export const log_likelihood = logLikelihood;

function numeric(kind: number, values: number[], capacity = 1): number[] {
  return probabilityRuntime().call(30, [kind, ...values], capacity);
}

function keyOf(value: unknown): string {
  switch (typeof value) {
    case "string":
      return `str:${JSON.stringify(value)}`;
    case "number":
      if (Number.isNaN(value)) return "num:NaN";
      if (Object.is(value, -0)) return "num:-0";
      return `num:${value}`;
    case "bigint":
      return `big:${value}`;
    case "boolean":
      return `bool:${value ? 1 : 0}`;
    case "undefined":
      return "undefined";
    case "symbol":
      return `sym:${String(value.description ?? "")}`;
    case "object":
      if (value === null) return "null";
      if (Array.isArray(value)) return `arr:[${value.map((item) => keyOf(item)).join(",")}]`;
      return `obj:{${Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, item]) => `${JSON.stringify(name)}:${keyOf(item)}`)
        .join(",")}}`;
    default:
      throw new Error(`unsupported condition type: ${typeof value}`);
  }
}

function conditionKey(value: unknown): string {
  try { return probabilityKey(value); } catch { return keyOf(value); }
}

function asEntries<T>(probDict?: ReadonlyMap<T, number> | Record<string, number>): Array<[T, number]> {
  if (!probDict) return [];
  if (probDict instanceof Map) return [...probDict.entries()];
  return Object.entries(probDict).map(([sample, prob]) => [sample as T, prob]);
}

export interface ProbDistLike<T> {
  prob(sample: T): number;
  logprob(sample: T): number;
  logProb?(sample: T): number;
  max(): T;
  samples(): Iterable<T>;
}

export function addLogs(logx: number, logy: number): number {
  return numeric(0, [logx, logy])[0]!;
}

export function sumLogs(logs: number[]): number {
  return numeric(0, logs)[0]!;
}

export function logLikelihood<T>(testPdist: ProbDistLike<T>, actualPdist: ProbDistLike<T>): number {
  const values: number[] = [];
  for (const sample of actualPdist.samples()) {
    const actualProb = actualPdist.prob(sample);
    if (actualProb <= 0) continue;
    values.push(actualProb, testPdist.prob(sample));
  }
  return numeric(17, values)[0]!;
}

export function entropy<T>(pdist: ProbDistLike<T>): number {
  return numeric(16, [...pdist.samples()].map(sample => pdist.prob(sample)))[0]!;
}

export abstract class ProbDistI<T> implements ProbDistLike<T> {
  abstract prob(sample: T): number;
  abstract max(): T;
  abstract samples(): Iterable<T>;

  logprob(sample: T): number {
    return numeric(3, [this.prob(sample)])[0]!;
  }

  logProb(sample: T): number {
    return this.logprob(sample);
  }
}

export class DictionaryProbDist<T> extends ProbDistI<T> {
  readonly #probMap = new Map<string, { sample: T; value: number }>();
  readonly #log: boolean;
  #maxSample?: T;

  constructor(probDict?: ReadonlyMap<T, number> | Record<string, number>, log = false, normalize = false) {
    super();
    this.#log = log;
    for (const [sample, prob] of asEntries(probDict)) {
      const key = conditionKey(sample), previous = this.#probMap.get(key);
      this.#probMap.set(key, { sample: previous ? previous.sample : sample, value: prob });
    }

    if (normalize) {
      const entries = [...this.#probMap.values()];
      if (entries.length === 0) {
        throw new Error("A DictionaryProbDist must have at least one sample before it can be normalized.");
      }

      const values = numeric(this.#log ? 2 : 1, entries.map(entry => entry.value), entries.length);
      for (const [i, entry] of entries.entries()) entry.value = values[i]!;
    }
  }

  prob(sample: T): number {
    const value = this.#probMap.get(conditionKey(sample))?.value;
    if (value === undefined) return 0;
    return this.#log ? numeric(5, [value])[0]! : value;
  }

  override logprob(sample: T): number {
    const value = this.#probMap.get(conditionKey(sample))?.value;
    if (value === undefined) return -1e300;
    if (this.#log) return value;
    return numeric(3, [value])[0]!;
  }

  max(): T {
    if (this.#maxSample !== undefined) return this.#maxSample;
    const entries = [...this.#probMap.values()];
    const best = entries.length === 0 ? undefined : entries[numeric(18, entries.map(entry => entry.value))[0]!];
    if (!best) throw new Error("A DictionaryProbDist must have at least one sample before max is defined.");
    // Preserve the existing adapter tie order (some classifier adapters rely on
    // first-insertion ties), rather than silently changing their predictions.
    this.#maxSample = best.sample;
    return best.sample;
  }

  *samples(): IterableIterator<T> {
    for (const entry of this.#probMap.values()) {
      yield entry.sample;
    }
  }

  override toString(): string {
    return `<ProbDist with ${this.#probMap.size} samples>`;
  }
}

export class MLEProbDist<T> extends ProbDistI<T> {
  constructor(private readonly freqDistValue: FreqDist<T>) {
    super();
  }

  freqdist(): FreqDist<T> {
    return this.freqDistValue;
  }

  prob(sample: T): number {
    return numeric(6, [this.freqDistValue.get(sample), this.freqDistValue.N()])[0]!;
  }

  max(): T {
    return this.freqDistValue.max();
  }

  samples(): Iterable<T> {
    return this.freqDistValue.keys();
  }

  override toString(): string {
    return `<MLEProbDist based on ${this.freqDistValue.N()} samples>`;
  }
}

export class LidstoneProbDist<T> extends ProbDistI<T> {
  protected readonly freqDistValue: FreqDist<T>;
  protected gammaValue: number;
  protected readonly totalCount: number;
  protected readonly binsValue: number;
  protected divisor: number;

  constructor(freqdist: FreqDist<T>, gamma: number, bins?: number) {
    super();

    if (bins === 0 || (bins === undefined && freqdist.N() === 0)) {
      const name = this.constructor.name.replace(/ProbDist$/, "");
      throw new Error(`A ${name} probability distribution must have at least one bin.`);
    }
    if (bins !== undefined && bins < freqdist.B()) {
      const name = this.constructor.name.replace(/ProbDist$/, "");
      throw new Error(
        `The number of bins in a ${name} distribution (${bins}) must be >= the number of bins in the FreqDist used to create it (${freqdist.B()}).`,
      );
    }

    this.freqDistValue = freqdist;
    this.gammaValue = Number(gamma);
    this.totalCount = freqdist.N();
    this.binsValue = bins ?? freqdist.B();
    [this.gammaValue, this.divisor] = numeric(8, [this.totalCount, this.binsValue, this.gammaValue], 2) as [number, number];
  }

  freqdist(): FreqDist<T> {
    return this.freqDistValue;
  }

  prob(sample: T): number {
    return numeric(7, [this.freqDistValue.get(sample), this.gammaValue, this.divisor])[0]!;
  }

  max(): T {
    return this.freqDistValue.max();
  }

  samples(): Iterable<T> {
    return this.freqDistValue.keys();
  }

  discount(): number {
    return numeric(9, [this.totalCount, this.binsValue, this.gammaValue])[0]!;
  }

  override toString(): string {
    return `<LidstoneProbDist based on ${this.freqDistValue.N()} samples>`;
  }
}

export class LaplaceProbDist<T> extends LidstoneProbDist<T> {
  constructor(freqdist: FreqDist<T>, bins?: number) {
    super(freqdist, 1, bins);
  }

  override toString(): string {
    return `<LaplaceProbDist based on ${this.freqDistValue.N()} samples>`;
  }
}

export class ELEProbDist<T> extends LidstoneProbDist<T> {
  constructor(freqdist: FreqDist<T>, bins?: number) {
    super(freqdist, 0.5, bins);
  }

  override toString(): string {
    return `<ELEProbDist based on ${this.freqDistValue.N()} samples>`;
  }
}

type ProbDistFactory<T, Args extends unknown[] = []> =
  | (new (freqdist: FreqDist<T>, ...args: Args) => ProbDistLike<T>)
  | ((freqdist: FreqDist<T>, ...args: Args) => ProbDistLike<T>);

export class WittenBellProbDist<T> extends ProbDistI<T> {
  readonly #freqdist: FreqDist<T>;
  readonly #T: number;
  readonly #N: number;
  readonly #P0: number;

  constructor(freqdist: FreqDist<T>, bins?: number) {
    super();
    if (bins !== undefined && bins < freqdist.B()) {
      throw new Error(`bins parameter must not be less than ${freqdist.B()}=freqdist.B()`);
    }
    const resolvedBins = bins ?? freqdist.B();
    this.#freqdist = freqdist;
    this.#T = freqdist.B();
    this.#N = freqdist.N();
    this.#P0 = numeric(10, [this.#N, this.#T, resolvedBins])[0]!;
  }

  prob(sample: T): number {
    const count = this.#freqdist.get(sample);
    return numeric(11, [count, this.#N, this.#T, this.#P0])[0]!;
  }

  max(): T {
    return this.#freqdist.max();
  }

  samples(): Iterable<T> {
    return this.#freqdist.keys();
  }

  freqdist(): FreqDist<T> {
    return this.#freqdist;
  }

  discount(): never {
    throw new Error("WittenBellProbDist.discount is not implemented in bun_nltk");
  }

  override toString(): string {
    return `<WittenBellProbDist based on ${this.#freqdist.N()} samples>`;
  }
}

export class SimpleGoodTuringProbDist<T> extends ProbDistI<T> {
  readonly #freqdist: FreqDist<T>;
  readonly #bins: number;
  readonly #fit: number[];

  constructor(freqdist: FreqDist<T>, bins?: number) {
    super();
    if (bins !== undefined && bins <= freqdist.B()) {
      throw new Error(`bins parameter must not be less than ${freqdist.B() + 1}=freqdist.B()+1`);
    }
    this.#freqdist = freqdist;
    this.#bins = bins ?? (freqdist.B() + 1);

    this.#fit = numeric(12, [...freqdist.values()], 4);
  }

  smoothedNr(r: number): number {
    return numeric(13, [...this.#fit, r])[0]!;
  }
  smoothed_nr(r: number): number { return this.smoothedNr(r); }

  prob(sample: T): number {
    return numeric(14, [...this.#fit, this.#freqdist.get(sample), this.#freqdist.N(), this.#bins,
      ...this.#freqdist.values()])[0]!;
  }

  discount(): number {
    return numeric(15, [...this.#fit, this.#freqdist.N()])[0]!;
  }

  max(): T {
    return this.#freqdist.max();
  }

  samples(): Iterable<T> {
    return this.#freqdist.keys();
  }

  freqdist(): FreqDist<T> {
    return this.#freqdist;
  }

  override toString(): string {
    return `<SimpleGoodTuringProbDist based on ${this.#freqdist.N()} samples>`;
  }
}

export class UniformProbDist<T> extends ProbDistI<T> {
  readonly #samples: T[];
  readonly #keys: Set<string>;
  readonly #probability: number;

  constructor(samples: Iterable<T>) {
    super();
    const unique = new Map<string, T>();
    for (const sample of samples) if (!unique.has(conditionKey(sample))) unique.set(conditionKey(sample), sample);
    this.#samples = [...unique.values()];
    if (this.#samples.length === 0) {
      throw new Error("A UniformProbDist must have at least one sample.");
    }
    this.#keys = new Set(unique.keys());
    this.#probability = numeric(19, [this.#keys.size])[0]!;
  }

  prob(sample: T): number {
    return this.#keys.has(conditionKey(sample)) ? this.#probability : 0;
  }

  max(): T {
    return this.#samples[0]!;
  }

  samples(): Iterable<T> {
    return this.#samples;
  }
}

export class MutableProbDist<T> extends ProbDistI<T> {
  readonly #probMap = new Map<string, { sample: T; value: number }>();
  readonly #storeLogs: boolean;
  readonly #samples: T[];
  readonly #indices = new Map<string, number>();

  constructor(probDist: ProbDistLike<T>, samples: Iterable<T>, storeLogs = true) {
    super();
    this.#storeLogs = storeLogs;
    this.#samples = Array.isArray(samples) ? samples : [...samples];
    for (const [i, sample] of this.#samples.entries()) {
      const value = storeLogs ? probDist.logprob(sample) : probDist.prob(sample);
      const key = conditionKey(sample), previous = this.#probMap.get(key);
      this.#indices.set(key, i);
      this.#probMap.set(key, { sample: previous ? previous.sample : sample, value });
    }
  }

  update(sample: T, value: number, log = true): void {
    const previous = this.#probMap.get(conditionKey(sample));
    if (!previous) throw new RangeError("sample is not in this mutable distribution");
    if (this.#storeLogs && !log && value <= 0) throw new RangeError("math domain error");
    const stored = this.#storeLogs ? (log ? value : numeric(4, [value])[0]!)
      : (log ? numeric(5, [value])[0]! : value);
    this.#probMap.set(conditionKey(sample), { sample: previous.sample, value: stored });
  }

  prob(sample: T): number {
    const value = this.#probMap.get(conditionKey(sample))?.value;
    if (value === undefined) return 0;
    return this.#storeLogs ? numeric(5, [value])[0]! : value;
  }

  override logprob(sample: T): number {
    const value = this.#probMap.get(conditionKey(sample))?.value;
    if (value === undefined) return NEG_INF;
    if (this.#storeLogs) return value;
    if (value <= 0) throw new RangeError("math domain error");
    return numeric(4, [value])[0]!;
  }

  max(): T {
    if (this.#samples.length === 0) throw new Error("A MutableProbDist must have at least one sample before max is defined.");
    // NLTK's max reads _sample_dict's indices, not the mutable probabilities.
    const entries = [...this.#probMap.entries()];
    const best = numeric(18, entries.map(([key]) => this.#indices.get(key)!), 1)[0]!;
    return entries[best]![1].sample;
  }

  *samples(): IterableIterator<T> {
    yield* this.#samples;
  }
}

export abstract class ConditionalProbDistI<C, T> {
  abstract get(condition: C): ProbDistLike<T>;
  abstract conditions(): C[];
}

export { type ProbDistFactory };

export class ConditionalProbDist<C, T, Args extends unknown[] = unknown[]> extends ConditionalProbDistI<C, T> {
  readonly #cache = new Map<string, { condition: C; pdist: ProbDistLike<T> }>();
  readonly #createDistribution: (freqdist: FreqDist<T>) => ProbDistLike<T>;

  constructor(
    private readonly cfdist: ConditionalFreqDist<C, T>,
    probdistFactory: ProbDistFactory<T, Args>,
    ...factoryArgs: Args
  ) {
    super();
    this.#createDistribution = /^class\s/.test(Function.prototype.toString.call(probdistFactory))
      ? freqdist => new (probdistFactory as new (freqdist: FreqDist<T>, ...args: Args) => ProbDistLike<T>)(freqdist, ...factoryArgs)
      : freqdist => (probdistFactory as (freqdist: FreqDist<T>, ...args: Args) => ProbDistLike<T>)(freqdist, ...factoryArgs);
    const sources = new Map<string, { condition: C; freqdist: FreqDist<T>; copied: boolean }>();
    for (const condition of cfdist.conditions()) {
      const key = conditionKey(condition), existing = sources.get(key);
      if (existing) {
        if (!existing.copied) { existing.freqdist = existing.freqdist.copy(); existing.copied = true; }
        existing.freqdist.update(cfdist.get(condition));
      } else sources.set(key, { condition, freqdist: cfdist.get(condition), copied: false });
    }
    for (const [key, { condition, freqdist }] of sources) {
      this.#cache.set(key, {
        condition,
        pdist: this.#create(freqdist),
      });
    }
  }

  #create(freqdist: FreqDist<T>): ProbDistLike<T> {
    return this.#createDistribution(freqdist);
  }

  get(condition: C): ProbDistLike<T> {
    const key = conditionKey(condition);
    const existing = this.#cache.get(key);
    if (existing) return existing.pdist;

    const source = this.cfdist.peek(condition) ?? new FreqDist<T>();
    const pdist = this.#create(source);
    this.#cache.set(key, { condition, pdist });
    return pdist;
  }

  peek(condition: C): ProbDistLike<T> | undefined {
    return this.#cache.get(conditionKey(condition))?.pdist;
  }

  conditions(): C[] {
    return [...this.#cache.values()].map((entry) => entry.condition);
  }

  prob(condition: C, sample: T): number {
    return this.get(condition).prob(sample);
  }

  logprob(condition: C, sample: T): number {
    return this.get(condition).logprob(sample);
  }

  logProb(condition: C, sample: T): number {
    return this.logprob(condition, sample);
  }

  *entries(): IterableIterator<[C, ProbDistLike<T>]> {
    for (const entry of this.#cache.values()) {
      yield [entry.condition, entry.pdist];
    }
  }
}

export class DictionaryConditionalProbDist<C, T> extends ConditionalProbDistI<C, T> {
  private readonly distributions = new Map<string, { condition: C; pdist: ProbDistLike<T> }>();
  constructor(probdists: ReadonlyMap<C, ProbDistLike<T>> | Iterable<readonly [C, ProbDistLike<T>]>) {
    super();
    this.update(probdists);
  }
  update(probdists: Iterable<readonly [C, ProbDistLike<T>]>): void {
    for (const [condition, pdist] of probdists) {
      const key = conditionKey(condition), previous = this.distributions.get(key);
      this.distributions.set(key, { condition: previous ? previous.condition : condition, pdist });
    }
  }
  override get(condition: C): ProbDistLike<T> {
    const key = conditionKey(condition);
    let row = this.distributions.get(key);
    if (!row) {
      row = { condition, pdist: new DictionaryProbDist<T>() };
      this.distributions.set(key, row);
    }
    return row.pdist;
  }
  peek(condition: C): ProbDistLike<T> | undefined { return this.distributions.get(conditionKey(condition))?.pdist; }
  override conditions(): C[] { return [...this.distributions.values()].map(row => row.condition); }
  *entries(): IterableIterator<[C, ProbDistLike<T>]> {
    for (const row of this.distributions.values()) yield [row.condition, row.pdist];
  }
}
