import { ConditionalFreqDist, FreqDist } from "./freqdist";

const NEG_INF = Number.NEGATIVE_INFINITY;
const ADD_LOGS_MAX_DIFF = Math.log2(1e-30);

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
  if (logx < logy + ADD_LOGS_MAX_DIFF) return logy;
  if (logy < logx + ADD_LOGS_MAX_DIFF) return logx;
  const base = Math.min(logx, logy);
  return base + Math.log2(2 ** (logx - base) + 2 ** (logy - base));
}

export function sumLogs(logs: number[]): number {
  if (logs.length === 0) return NEG_INF;
  return logs.slice(1).reduce((acc, value) => addLogs(acc, value), logs[0]!);
}

export function logLikelihood<T>(testPdist: ProbDistLike<T>, actualPdist: ProbDistLike<T>): number {
  let total = 0;
  for (const sample of actualPdist.samples()) {
    const actualProb = actualPdist.prob(sample);
    if (actualProb <= 0) continue;
    total += actualProb * Math.log2(Math.max(testPdist.prob(sample), Number.MIN_VALUE));
  }
  return total;
}

export function entropy<T>(pdist: ProbDistLike<T>): number {
  let total = 0;
  for (const sample of pdist.samples()) {
    const prob = pdist.prob(sample);
    if (prob <= 0) continue;
    total -= prob * Math.log2(prob);
  }
  return total;
}

export abstract class ProbDistI<T> implements ProbDistLike<T> {
  abstract prob(sample: T): number;
  abstract max(): T;
  abstract samples(): Iterable<T>;

  logprob(sample: T): number {
    const prob = this.prob(sample);
    if (prob <= 0) return NEG_INF;
    return Math.log2(prob);
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
      this.#probMap.set(keyOf(sample), { sample, value: prob });
    }

    if (normalize) {
      const entries = [...this.#probMap.values()];
      if (entries.length === 0) {
        throw new Error("A DictionaryProbDist must have at least one sample before it can be normalized.");
      }

      if (this.#log) {
        const valueSum = sumLogs(entries.map((entry) => entry.value));
        if (valueSum <= NEG_INF) {
          const uniform = Math.log2(1 / entries.length);
          for (const entry of entries) entry.value = uniform;
        } else {
          for (const entry of entries) entry.value -= valueSum;
        }
      } else {
        const valueSum = entries.reduce((acc, entry) => acc + entry.value, 0);
        if (valueSum === 0) {
          const uniform = 1 / entries.length;
          for (const entry of entries) entry.value = uniform;
        } else {
          for (const entry of entries) entry.value /= valueSum;
        }
      }
    }
  }

  prob(sample: T): number {
    const value = this.#probMap.get(keyOf(sample))?.value;
    if (value === undefined) return 0;
    return this.#log ? 2 ** value : value;
  }

  override logprob(sample: T): number {
    const value = this.#probMap.get(keyOf(sample))?.value;
    if (value === undefined) return NEG_INF;
    if (this.#log) return value;
    if (value <= 0) return NEG_INF;
    return Math.log2(value);
  }

  max(): T {
    if (this.#maxSample !== undefined) return this.#maxSample;
    const best = [...this.#probMap.values()].reduce((acc, value) => {
      if (!acc) return value;
      const accProb = this.#log ? acc.value : Math.log2(Math.max(acc.value, Number.MIN_VALUE));
      const valueProb = this.#log ? value.value : Math.log2(Math.max(value.value, Number.MIN_VALUE));
      return valueProb > accProb ? value : acc;
    }, undefined as { sample: T; value: number } | undefined);
    if (!best) throw new Error("A DictionaryProbDist must have at least one sample before max is defined.");
    this.#maxSample = best.sample;
    return best.sample;
  }

  *samples(): IterableIterator<T> {
    for (const entry of this.#probMap.values()) {
      yield entry.sample;
    }
  }

  toString(): string {
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
    return this.freqDistValue.freq(sample);
  }

  max(): T {
    return this.freqDistValue.max();
  }

  samples(): Iterable<T> {
    return this.freqDistValue.keys();
  }

  toString(): string {
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
    this.divisor = this.totalCount + this.binsValue * this.gammaValue;

    if (this.divisor === 0) {
      this.gammaValue = 0;
      this.divisor = 1;
    }
  }

  freqdist(): FreqDist<T> {
    return this.freqDistValue;
  }

  prob(sample: T): number {
    return (this.freqDistValue.get(sample) + this.gammaValue) / this.divisor;
  }

  max(): T {
    return this.freqDistValue.max();
  }

  samples(): Iterable<T> {
    return this.freqDistValue.keys();
  }

  discount(): number {
    const gb = this.gammaValue * this.binsValue;
    return gb / (this.totalCount + gb);
  }

  toString(): string {
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

type ProbDistFactory<T> = (new (freqdist: FreqDist<T>, ...args: any[]) => ProbDistLike<T>) | ((freqdist: FreqDist<T>, ...args: any[]) => ProbDistLike<T>);

export class UniformProbDist<T> extends ProbDistI<T> {
  readonly #samples: T[];

  constructor(samples: Iterable<T>) {
    super();
    this.#samples = [...samples];
    if (this.#samples.length === 0) {
      throw new Error("A UniformProbDist must have at least one sample.");
    }
  }

  prob(sample: T): number {
    return this.#samples.some((item) => keyOf(item) === keyOf(sample)) ? 1 / this.#samples.length : 0;
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

  constructor(probDist: ProbDistLike<T>, samples: Iterable<T>, storeLogs = true) {
    super();
    this.#storeLogs = storeLogs;
    for (const sample of samples) {
      const value = storeLogs ? probDist.logprob(sample) : probDist.prob(sample);
      this.#probMap.set(keyOf(sample), { sample, value });
    }
  }

  update(sample: T, value: number, log = false): void {
    const stored = this.#storeLogs
      ? (log ? value : (value <= 0 ? NEG_INF : Math.log2(value)))
      : (log ? 2 ** value : value);
    this.#probMap.set(keyOf(sample), { sample, value: stored });
  }

  prob(sample: T): number {
    const value = this.#probMap.get(keyOf(sample))?.value;
    if (value === undefined) return 0;
    return this.#storeLogs ? (value <= NEG_INF ? 0 : 2 ** value) : value;
  }

  override logprob(sample: T): number {
    const value = this.#probMap.get(keyOf(sample))?.value;
    if (value === undefined) return NEG_INF;
    if (this.#storeLogs) return value;
    if (value <= 0) return NEG_INF;
    return Math.log2(value);
  }

  max(): T {
    const best = [...this.#probMap.values()].reduce((acc, current) => {
      if (!acc) return current;
      const accValue = this.#storeLogs ? acc.value : Math.log2(Math.max(acc.value, Number.MIN_VALUE));
      const currentValue = this.#storeLogs ? current.value : Math.log2(Math.max(current.value, Number.MIN_VALUE));
      return currentValue > accValue ? current : acc;
    }, undefined as { sample: T; value: number } | undefined);
    if (!best) throw new Error("A MutableProbDist must have at least one sample before max is defined.");
    return best.sample;
  }

  *samples(): IterableIterator<T> {
    for (const entry of this.#probMap.values()) {
      yield entry.sample;
    }
  }
}

export abstract class ConditionalProbDistI<C, T> {
  abstract get(condition: C): ProbDistLike<T>;
  abstract conditions(): C[];
}

export { type ProbDistFactory };

export class ConditionalProbDist<C, T> extends ConditionalProbDistI<C, T> {
  readonly #cache = new Map<string, { condition: C; pdist: ProbDistLike<T> }>();
  readonly #factoryArgs: any[];

  constructor(
    private readonly cfdist: ConditionalFreqDist<C, T>,
    private readonly probdistFactory: ProbDistFactory<T>,
    ...factoryArgs: any[]
  ) {
    super();
    this.#factoryArgs = factoryArgs;
    for (const condition of cfdist.conditions()) {
      this.#cache.set(keyOf(condition), {
        condition,
        pdist: this.#create(cfdist.get(condition)),
      });
    }
  }

  #create(freqdist: FreqDist<T>): ProbDistLike<T> {
    const factory = this.probdistFactory as any;
    try {
      return factory(freqdist, ...this.#factoryArgs);
    } catch {
      return new factory(freqdist, ...this.#factoryArgs);
    }
  }

  get(condition: C): ProbDistLike<T> {
    const key = keyOf(condition);
    const existing = this.#cache.get(key);
    if (existing) return existing.pdist;

    const source = this.cfdist.peek(condition) ?? new FreqDist<T>();
    const pdist = this.#create(source);
    this.#cache.set(key, { condition, pdist });
    return pdist;
  }

  peek(condition: C): ProbDistLike<T> | undefined {
    return this.#cache.get(keyOf(condition))?.pdist;
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
