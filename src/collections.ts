// NLTK collections — lightweight JS port
// Original: nltk/collections.py

export class OrderedDict<K, V> extends Map<K, V> {
  private _keys: K[] = [];
  constructor(entries?: Iterable<[K, V]> | null) {
    super();
    if (entries) for (const [k, v] of entries) this.set(k, v);
  }
  override set(key: K, value: V): this {
    if (!super.has(key)) this._keys.push(key);
    super.set(key, value);
    return this;
  }
  override delete(key: K): boolean {
    const ok = super.delete(key);
    if (ok) this._keys = this._keys.filter(k => k !== key);
    return ok;
  }
  override clear(): void { super.clear(); this._keys = []; }
  override keys(): MapIterator<K> { return this._keys.values() as unknown as MapIterator<K>; }
  orderedKeys(): K[] { return [...this._keys]; }
}

export abstract class AbstractLazySequence<T> {
  abstract get length(): number;
  abstract get(index: number): T;
  [Symbol.iterator](): Iterator<T> { let i=0; return { next: () => i < this.length ? { value: this.get(i++), done: false } : { value: undefined as unknown as T, done: true } }; }
  toArray(): T[] { return [...this]; }
}

export class LazySubsequence<T> extends AbstractLazySequence<T> {
  constructor(private seq: T[] | AbstractLazySequence<T>, private start: number, private stop: number) { super(); }
  get length(): number { return Math.max(0, this.stop - this.start); }
  get(index: number): T {
    const arr = this.seq instanceof Array ? this.seq : (this.seq as AbstractLazySequence<T>);
    return (Array.isArray(arr) ? (arr as T[])[this.start + index] : (arr as AbstractLazySequence<T>).get(this.start + index)) as T;
  }
}

export class LazyConcatenation<T> extends AbstractLazySequence<T> {
  constructor(private seqs: (T[] | AbstractLazySequence<T>)[]) { super(); }
  get length(): number { return this.seqs.reduce((n,s)=> n + (Array.isArray(s)? s.length : (s as AbstractLazySequence<T>).length), 0); }
  get(index: number): T {
    for (const s of this.seqs) {
      const len = Array.isArray(s) ? s.length : (s as AbstractLazySequence<T>).length;
      if (index < len) return (Array.isArray(s) ? (s as T[])[index] : (s as AbstractLazySequence<T>).get(index)) as T;
      index -= len;
    }
    throw new RangeError("index out of range");
  }
}

export class LazyMap<T, U> extends AbstractLazySequence<U> {
  constructor(private func: (x: T)=>U, private seq: T[] | AbstractLazySequence<T>) { super(); }
  get length(): number { return Array.isArray(this.seq) ? this.seq.length : (this.seq as AbstractLazySequence<T>).length; }
  get(index: number): U {
    const v = (Array.isArray(this.seq) ? (this.seq as T[])[index] : (this.seq as AbstractLazySequence<T>).get(index)) as T;
    return this.func(v);
  }
}

export class LazyZip<T> extends LazyMap<T[], T[]> { constructor(...seqs: unknown[][]) { super(x=>x as T[], seqs as unknown as T[][]); } }
export class LazyEnumerate<T> extends LazyZip<[number,T]> {}

export class LazyIteratorList<T> extends AbstractLazySequence<T> {
  private cache: T[] = [];
  constructor(private iter: Iterable<T>) { super(); for (const x of iter) this.cache.push(x); }
  get length(): number { return this.cache.length; }
  get(index: number): T { return this.cache[index] as T; }
}

export class Trie extends Map<string, unknown> {
  insert(word: string, value: unknown = true): void {
    let node: Map<string, unknown> = this;
    for (const ch of word) {
      if (!node.has(ch)) node.set(ch, new Map());
      node = node.get(ch) as Map<string, unknown>;
    }
    node.set("__value__", value);
  }
  hasWord(word: string): boolean {
    let node: Map<string, unknown> = this;
    for (const ch of word) {
      if (!node.has(ch)) return false;
      node = node.get(ch) as Map<string, unknown>;
    }
    return node.has("__value__");
  }
}
