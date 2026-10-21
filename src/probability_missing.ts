import { FreqDist } from "./freqdist.ts";
import type { ProbDistLike } from "./probability.ts";
import { probabilityKey, probabilityRuntime } from "./probability_abi.ts";

function snapshot<T>(fd: FreqDist<T>): Map<string, { sample: T; count: number }> {
  const result = new Map<string, { sample: T; count: number }>();
  for (const [sample, count] of fd.entries()) {
    const key = probabilityKey(sample), previous = result.get(key);
    result.set(key, { sample: previous ? previous.sample : sample, count: (previous?.count ?? 0) + count });
  }
  return result;
}

function logarithm(value: number | null): number {
  if (value !== null && value < 0) throw new RangeError("math domain error");
  return probabilityRuntime().call(11, [value ?? NaN], 1)[0]!;
}

function maximum<T>(freqdist: FreqDist<T>): T {
  const rows = [...snapshot(freqdist).values()];
  const index = probabilityRuntime().call(12, [rows.length, ...rows.map(row => row.count)], 1)[0]!;
  return rows[index]!.sample;
}

/** NLTK intentionally returns None for unseen values when Nr(0) is zero. */
export class HeldoutProbDist<T> {
  readonly SUM_TO_ONE = false;
  private readonly countEstimates = new Map<number, number | null>();
  private readonly maxCount: number;
  private readonly unseen: number | null;

  constructor(private readonly base: FreqDist<T>, private readonly held: FreqDist<T>, bins?: number | null) {
    const b = snapshot(base), h = snapshot(held);
    const keys = [...new Set([...b.keys(), ...h.keys()])];
    const input = [bins ?? NaN, keys.length];
    for (const key of keys) input.push(b.get(key)?.count ?? 0, h.get(key)?.count ?? 0);
    const output = probabilityRuntime().call(1, input, keys.length + 1);
    this.maxCount = 0;
    for (const [i, key] of keys.entries()) {
      const estimate = Number.isNaN(output[i]!) ? null : output[i]!;
      const count = b.get(key)?.count ?? 0;
      this.countEstimates.set(count, estimate);
      this.maxCount = Math.max(this.maxCount, count);
    }
    this.unseen = Number.isNaN(output[keys.length]!) ? null : output[keys.length]!;
  }

  base_fdist(): FreqDist<T> { return this.base; }
  heldout_fdist(): FreqDist<T> { return this.held; }
  prob(sample: T): number | null {
    const count = snapshot(this.base).get(probabilityKey(sample))?.count ?? 0;
    if (!Number.isInteger(count)) throw new TypeError("list indices must be integers");
    if (count > this.maxCount) throw new RangeError("list index out of range");
    return count === 0 ? this.unseen : this.countEstimates.get(count) ?? null;
  }
  logprob(sample: T): number { return logarithm(this.prob(sample)); }
  logProb(sample: T): number { return this.logprob(sample); }
  samples(): Iterable<T> { return snapshot(this.base).values().map(row => row.sample); }
  max(): T { return maximum(this.base); }
  discount(): never { throw new Error("NotImplementedError"); }
  toString(): string { return `<HeldoutProbDist: ${this.base.N()} base samples; ${this.held.N()} heldout samples>`; }
}

export abstract class CrossValidationProbDist<T> implements ProbDistLike<T> {
  readonly SUM_TO_ONE = false;
  private readonly estimates = new Map<string, number>();
  private readonly unseen: number;
  private readonly noPairs: boolean;
  private readonly sampleValues: T[];
  private readonly distributions: FreqDist<T>[];

  constructor(freqdists: Iterable<FreqDist<T>>, bins: number | null) {
    if (new.target === CrossValidationProbDist) throw new TypeError("Can't instantiate abstract class CrossValidationProbDist without an implementation for abstract method 'max'");
    this.distributions = [...freqdists];
    const rows = this.distributions.map(snapshot);
    const union = new Map<string, T>();
    for (const row of rows) for (const [key, value] of row) if (!union.has(key)) union.set(key, value.sample);
    this.sampleValues = [...union.values()];
    const identities = new Map<FreqDist<T>, number>();
    const input = [bins ?? NaN, rows.length, union.size];
    for (const [i, row] of rows.entries()) {
      const fd = this.distributions[i]!;
      if (!identities.has(fd)) identities.set(fd, identities.size);
      input.push(identities.get(fd)!);
      for (const key of union.keys()) input.push(row.get(key)?.count ?? 0);
    }
    this.noPairs = identities.size < 2;
    const output = probabilityRuntime().call(2, input, union.size + 1);
    for (const [i, key] of [...union.keys()].entries()) this.estimates.set(key, output[i]!);
    this.unseen = output[union.size]!;
  }

  freqdists(): FreqDist<T>[] { return [...this.distributions]; }
  prob(sample: T): number {
    if (this.noPairs) throw new RangeError("division by zero");
    const value = this.estimates.get(probabilityKey(sample)) ?? this.unseen;
    if (Number.isNaN(value)) throw new TypeError("unsupported operand type(s) for +=: 'float' and 'NoneType'");
    return value;
  }
  logprob(sample: T): number { return logarithm(this.prob(sample)); }
  logProb(sample: T): number { return this.logprob(sample); }
  samples(): Iterable<T> { return this.sampleValues.values(); }
  abstract max(): T;
  discount(): never { throw new Error("NotImplementedError"); }
  toString(): string { return `<CrossValidationProbDist: ${this.distributions.length}-way>`; }
}

export type Trigram<T> = readonly [T, T, T];

export class KneserNeyProbDist<T> implements ProbDistLike<Trigram<T>> {
  readonly SUM_TO_ONE = true;
  private readonly symbols = new Map<string, number>();
  private readonly handle: number;
  private disposed = false;
  private discountValue: number;

  constructor(private readonly freqdist: FreqDist<Trigram<T>>, _bins?: number | null, discount = 0.75) {
    this.discountValue = discount;
    const rows = snapshot(freqdist);
    const input = [discount, rows.size];
    for (const { sample, count } of rows.values()) input.push(...this.ids(sample), count);
    this.handle = probabilityRuntime().call(3, input, 1)[0]!;
  }

  private ids(trigram: Trigram<T>): number[] {
    if (!Array.isArray(trigram) || trigram.length !== 3) throw new RangeError("Expected an iterable with 3 members.");
    return trigram.map(value => {
      const key = probabilityKey(value);
      if (!this.symbols.has(key)) this.symbols.set(key, this.symbols.size);
      return this.symbols.get(key)!;
    });
  }
  prob(trigram: Trigram<T>): number {
    if (this.disposed) throw new Error("model has been disposed");
    return probabilityRuntime().call(4, [this.handle, ...this.ids(trigram)], 1)[0]!;
  }
  logprob(sample: Trigram<T>): number { return logarithm(this.prob(sample)); }
  logProb(sample: Trigram<T>): number { return this.logprob(sample); }
  discount(): number { return this.discountValue; }
  set_discount(value: number): void {
    if (this.disposed) throw new Error("model has been disposed");
    probabilityRuntime().call(5, [this.handle, value], 0);
    this.discountValue = value;
  }
  samples(): Iterable<Trigram<T>> { return snapshot(this.freqdist).values().map(row => row.sample); }
  max(): Trigram<T> { return maximum(this.freqdist); }
  dispose(): void {
    if (!this.disposed) probabilityRuntime().call(10, [this.handle], 0);
    this.disposed = true;
  }
  toString(): string { return `<KneserNeyProbDist based on ${this.freqdist.N()} trigrams`; }
}
