import { posTagAsciiNative, tokenFreqDistIdsAscii } from "./native";
import { posTagAscii, tokenizeAscii } from "./reference";

type StoredCount<T> = {
  count: number;
  index: number;
  sample: T;
};

type StoredCondition<C, S> = {
  condition: C;
  dist: FreqDist<S>;
  index: number;
};

export type FreqDistInput<S> = FreqDist<S> | ReadonlyMap<S, number> | Iterable<S> | Record<string, number>;
export type ConditionalFreqDistInput<C, S> =
  | ConditionalFreqDist<C, S>
  | ReadonlyMap<C, FreqDist<S>>
  | Iterable<readonly [C, S]>;

function stableKey(value: unknown): string {
  switch (typeof value) {
    case "string":
      return `str:${JSON.stringify(value)}`;
    case "number":
      if (Number.isNaN(value)) return "num:NaN";
      if (!Number.isFinite(value)) return `num:${value > 0 ? "Infinity" : "-Infinity"}`;
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
      if (Array.isArray(value)) {
        return `arr:[${value.map((item) => stableKey(item)).join(",")}]`;
      }

      if (value instanceof Date) {
        return `date:${value.toISOString()}`;
      }

      return `obj:{${Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => `${JSON.stringify(key)}:${stableKey(item)}`)
        .join(",")}}`;
    default:
      throw new Error(`unsupported sample type: ${typeof value}`);
  }
}

function isPlainNumberRecord(value: unknown): value is Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value) || value instanceof Map) {
    return false;
  }
  return Object.values(value).every((item) => typeof item === "number");
}

function validateCount(count: number, label: string) {
  if (!Number.isFinite(count) || count < 0) {
    throw new Error(`${label} must be a finite number >= 0`);
  }
}

function formatSample(sample: unknown): string {
  if (typeof sample === "string") return JSON.stringify(sample);
  if (typeof sample === "bigint") return `${sample}n`;
  if (typeof sample === "symbol") return `Symbol(${sample.description ?? ""})`;
  try {
    return JSON.stringify(sample);
  } catch {
    return String(sample);
  }
}

export class FreqDist<S> implements Iterable<S> {
  #counts = new Map<string, StoredCount<S>>();
  #nextIndex = 0;
  #totalCount = 0;

  constructor(samples?: FreqDistInput<S>) {
    if (samples) this.update(samples);
  }

  static fromTextAscii(text: string, options?: { native?: boolean }): FreqDist<string> {
    const useNative = options?.native ?? true;
    if (useNative) {
      try {
        const ids = tokenFreqDistIdsAscii(text);
        const out = new FreqDist<string>();
        for (let i = 0; i < ids.tokens.length; i += 1) {
          out.set(ids.tokens[i]!, ids.counts[i]!);
        }
        return out;
      } catch {
        // Fall back to the reference tokenizer when prebuilt native artifacts are unavailable.
      }
    }
    return new FreqDist<string>(tokenizeAscii(text));
  }

  #keyFor(sample: S): string {
    return stableKey(sample);
  }

  #setCount(sample: S, count: number): void {
    validateCount(count, "count");
    const key = this.#keyFor(sample);
    const existing = this.#counts.get(key);
    if (existing) {
      this.#totalCount += count - existing.count;
      if (count === 0) {
        this.#counts.delete(key);
        return;
      }

      existing.count = count;
      existing.sample = sample;
      return;
    }

    if (count === 0) return;
    this.#counts.set(key, {
      sample,
      count,
      index: this.#nextIndex,
    });
    this.#nextIndex += 1;
    this.#totalCount += count;
  }

  #sortedEntries(): StoredCount<S>[] {
    return [...this.#counts.values()].sort((left, right) => {
      if (left.count !== right.count) return right.count - left.count;
      return left.index - right.index;
    });
  }

  #insertionEntries(): StoredCount<S>[] {
    return [...this.#counts.values()].sort((left, right) => left.index - right.index);
  }

  get(sample: S): number {
    return this.#counts.get(this.#keyFor(sample))?.count ?? 0;
  }

  count(sample: S): number {
    return this.get(sample);
  }

  has(sample: S): boolean {
    return this.#counts.has(this.#keyFor(sample));
  }

  set(sample: S, count: number): this {
    this.#setCount(sample, count);
    return this;
  }

  inc(sample: S, count = 1): this {
    validateCount(count, "increment");
    if (count === 0) return this;
    this.#setCount(sample, this.get(sample) + count);
    return this;
  }

  delete(sample: S): boolean {
    const key = this.#keyFor(sample);
    const existing = this.#counts.get(key);
    if (!existing) return false;
    this.#counts.delete(key);
    this.#totalCount -= existing.count;
    return true;
  }

  clear(): void {
    this.#counts.clear();
    this.#nextIndex = 0;
    this.#totalCount = 0;
  }

  update(samples?: FreqDistInput<S>): this {
    if (!samples) return this;

    if (samples instanceof FreqDist) {
      for (const entry of samples.#insertionEntries()) {
        this.inc(entry.sample, entry.count);
      }
      return this;
    }

    if (samples instanceof Map) {
      for (const [sample, count] of samples.entries()) {
        this.inc(sample, count);
      }
      return this;
    }

    if (isPlainNumberRecord(samples)) {
      for (const [sample, count] of Object.entries(samples)) {
        this.inc(sample as S, count);
      }
      return this;
    }

    for (const sample of samples) {
      this.inc(sample);
    }
    return this;
  }

  N(): number {
    return this.#totalCount;
  }

  B(): number {
    return this.#counts.size;
  }

  freq(sample: S): number {
    const total = this.N();
    if (total === 0) return 0;
    return this.get(sample) / total;
  }

  max(): S {
    const top = this.mostCommon(1)[0];
    if (!top) {
      throw new Error("A FreqDist must have at least one sample before max is defined.");
    }
    return top[0];
  }

  hapaxes(): S[] {
    return this.#sortedEntries()
      .filter((entry) => entry.count === 1)
      .map((entry) => entry.sample);
  }

  r_Nr(bins?: number): Record<number, number> {
    const out: Record<number, number> = {};
    for (const entry of this.#counts.values()) {
      out[entry.count] = (out[entry.count] ?? 0) + 1;
    }
    out[0] = bins !== undefined ? Math.max(0, bins - this.B()) : 0;
    return out;
  }

  Nr(r: number, bins?: number): number {
    return this.r_Nr(bins)[r] ?? 0;
  }

  mostCommon(count = this.B()): Array<[S, number]> {
    return this.#sortedEntries()
      .slice(0, Math.max(0, count))
      .map((entry) => [entry.sample, entry.count]);
  }

  samples(): S[] {
    return [...this];
  }

  copy(): FreqDist<S> {
    const out = new FreqDist<S>();
    for (const entry of this.#counts.values()) {
      out.#counts.set(out.#keyFor(entry.sample), { ...entry });
    }
    out.#nextIndex = this.#nextIndex;
    out.#totalCount = this.#totalCount;
    return out;
  }

  add(other: FreqDist<S>): FreqDist<S> {
    const out = this.copy();
    out.update(other);
    return out;
  }

  subtract(other: FreqDist<S>): FreqDist<S> {
    const out = new FreqDist<S>();
    for (const entry of this.#insertionEntries()) {
      const next = entry.count - other.get(entry.sample);
      if (next > 0) out.set(entry.sample, next);
    }
    return out;
  }

  union(other: FreqDist<S>): FreqDist<S> {
    const out = this.copy();
    for (const entry of other.#insertionEntries()) {
      out.set(entry.sample, Math.max(out.get(entry.sample), entry.count));
    }
    return out;
  }

  intersection(other: FreqDist<S>): FreqDist<S> {
    const out = new FreqDist<S>();
    for (const entry of this.#insertionEntries()) {
      const next = Math.min(entry.count, other.get(entry.sample));
      if (next > 0) out.set(entry.sample, next);
    }
    return out;
  }

  isSubsetOf(other: FreqDist<S>): boolean {
    for (const [sample, count] of this.entries()) {
      if (count > other.get(sample)) return false;
    }
    return true;
  }

  isSupersetOf(other: FreqDist<S>): boolean {
    return other.isSubsetOf(this);
  }

  equals(other: FreqDist<S>): boolean {
    return this.isSubsetOf(other) && other.isSubsetOf(this);
  }

  pformat(maxlen = 10): string {
    const items = this.mostCommon(maxlen).map(([sample, count]) => `${formatSample(sample)}: ${count}`);
    if (this.B() > maxlen) items.push("...");
    return `FreqDist({${items.join(", ")}})`;
  }

  pprint(maxlen = 10, writer: (line: string) => void = console.log): void {
    writer(this.pformat(maxlen));
  }

  *keys(): IterableIterator<S> {
    for (const [sample] of this.mostCommon()) {
      yield sample;
    }
  }

  *values(): IterableIterator<number> {
    for (const [, count] of this.mostCommon()) {
      yield count;
    }
  }

  *entries(): IterableIterator<[S, number]> {
    for (const [sample, count] of this.mostCommon()) {
      yield [sample, count];
    }
  }

  [Symbol.iterator](): IterableIterator<S> {
    return this.keys();
  }

  toString(): string {
    return `<FreqDist with ${this.B()} samples and ${this.N()} outcomes>`;
  }
}

export class ConditionalFreqDist<C, S> implements Iterable<C> {
  #conditions = new Map<string, StoredCondition<C, S>>();
  #nextIndex = 0;

  constructor(condSamples?: ConditionalFreqDistInput<C, S>) {
    if (condSamples) this.update(condSamples);
  }

  static fromTaggedTextAscii(text: string, options?: { native?: boolean }): ConditionalFreqDist<string, string> {
    const useNative = options?.native ?? true;
    const rows = useNative ? (() => {
      try {
        return posTagAsciiNative(text);
      } catch {
        return posTagAscii(text);
      }
    })() : posTagAscii(text);

    const out = new ConditionalFreqDist<string, string>();
    for (const row of rows) {
      out.get(row.tag).inc(row.token.toLowerCase());
    }
    return out;
  }

  #keyFor(condition: C): string {
    return stableKey(condition);
  }

  #sortedConditions(): StoredCondition<C, S>[] {
    return [...this.#conditions.values()].sort((left, right) => left.index - right.index);
  }

  get(condition: C): FreqDist<S> {
    const key = this.#keyFor(condition);
    const existing = this.#conditions.get(key);
    if (existing) return existing.dist;

    const created: StoredCondition<C, S> = {
      condition,
      dist: new FreqDist<S>(),
      index: this.#nextIndex,
    };
    this.#nextIndex += 1;
    this.#conditions.set(key, created);
    return created.dist;
  }

  peek(condition: C): FreqDist<S> | undefined {
    return this.#conditions.get(this.#keyFor(condition))?.dist;
  }

  has(condition: C): boolean {
    return this.#conditions.has(this.#keyFor(condition));
  }

  set(condition: C, dist: FreqDist<S>): this {
    const key = this.#keyFor(condition);
    const existing = this.#conditions.get(key);
    if (existing) {
      existing.condition = condition;
      existing.dist = dist;
      return this;
    }

    this.#conditions.set(key, {
      condition,
      dist,
      index: this.#nextIndex,
    });
    this.#nextIndex += 1;
    return this;
  }

  delete(condition: C): boolean {
    return this.#conditions.delete(this.#keyFor(condition));
  }

  clear(): void {
    this.#conditions.clear();
    this.#nextIndex = 0;
  }

  update(condSamples?: ConditionalFreqDistInput<C, S>): this {
    if (!condSamples) return this;

    if (condSamples instanceof ConditionalFreqDist) {
      for (const [condition, dist] of condSamples.entries()) {
        this.get(condition).update(dist);
      }
      return this;
    }

    if (condSamples instanceof Map) {
      for (const [condition, dist] of condSamples.entries()) {
        this.get(condition).update(dist);
      }
      return this;
    }

    for (const [condition, sample] of condSamples) {
      this.get(condition).inc(sample);
    }
    return this;
  }

  conditions(): C[] {
    return [...this.keys()];
  }

  N(): number {
    let total = 0;
    for (const entry of this.#conditions.values()) {
      total += entry.dist.N();
    }
    return total;
  }

  copy(): ConditionalFreqDist<C, S> {
    const out = new ConditionalFreqDist<C, S>();
    for (const entry of this.#conditions.values()) {
      out.#conditions.set(out.#keyFor(entry.condition), {
        condition: entry.condition,
        dist: entry.dist.copy(),
        index: entry.index,
      });
    }
    out.#nextIndex = this.#nextIndex;
    return out;
  }

  add(other: ConditionalFreqDist<C, S>): ConditionalFreqDist<C, S> {
    const out = this.copy();
    out.update(other);
    return out;
  }

  subtract(other: ConditionalFreqDist<C, S>): ConditionalFreqDist<C, S> {
    const out = new ConditionalFreqDist<C, S>();
    for (const [condition, dist] of this.entries()) {
      const next = dist.subtract(other.peek(condition) ?? new FreqDist<S>());
      if (next.B() > 0) out.set(condition, next);
    }
    return out;
  }

  union(other: ConditionalFreqDist<C, S>): ConditionalFreqDist<C, S> {
    const out = this.copy();
    for (const [condition, dist] of other.entries()) {
      const current = out.peek(condition);
      out.set(condition, current ? current.union(dist) : dist.copy());
    }
    return out;
  }

  intersection(other: ConditionalFreqDist<C, S>): ConditionalFreqDist<C, S> {
    const out = new ConditionalFreqDist<C, S>();
    for (const [condition, dist] of this.entries()) {
      const otherDist = other.peek(condition);
      if (!otherDist) continue;
      const next = dist.intersection(otherDist);
      if (next.B() > 0) out.set(condition, next);
    }
    return out;
  }

  isSubsetOf(other: ConditionalFreqDist<C, S>): boolean {
    for (const [condition, dist] of this.entries()) {
      const otherDist = other.peek(condition);
      if (!otherDist || !dist.isSubsetOf(otherDist)) return false;
    }
    return true;
  }

  isSupersetOf(other: ConditionalFreqDist<C, S>): boolean {
    return other.isSubsetOf(this);
  }

  equals(other: ConditionalFreqDist<C, S>): boolean {
    return this.isSubsetOf(other) && other.isSubsetOf(this);
  }

  *keys(): IterableIterator<C> {
    for (const entry of this.#sortedConditions()) {
      yield entry.condition;
    }
  }

  *values(): IterableIterator<FreqDist<S>> {
    for (const entry of this.#sortedConditions()) {
      yield entry.dist;
    }
  }

  *entries(): IterableIterator<[C, FreqDist<S>]> {
    for (const entry of this.#sortedConditions()) {
      yield [entry.condition, entry.dist];
    }
  }

  [Symbol.iterator](): IterableIterator<C> {
    return this.keys();
  }

  toString(): string {
    return `<ConditionalFreqDist with ${this.#conditions.size} conditions>`;
  }
}
