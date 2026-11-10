// NLTK collections — lightweight JS port
// Original: nltk/collections.py

import { pyError } from "./internals";

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

/** Port of nltk.collections.Trie — a dict-subclass trie where ``self[key]``
 * auto-vivifies a subtrie via ``__missing__`` and a complete string stores
 * ``{Trie.LEAF: None}`` at its node. dict methods are inherited in Python;
 * here they are explicit Map-compatible members. Preserves the
 * ``dict.copy() -> dict`` quirk: copy() returns a plain Map, not a Trie.
 */
export class Trie extends Map<unknown, unknown> {
  static readonly LEAF = true;

  constructor(strings?: Iterable<string> | null) {
    super();
    if (strings) for (const string of strings) this.insert(string);
  }

  private missing(key: unknown): Trie {
    const subtrie = new Trie();
    super.set(key, subtrie);
    return subtrie;
  }

  insert(string: string): void {
    if (string.length) {
      const node = super.has(string[0]) ? super.get(string[0]) : this.missing(string[0]);
      (node as Trie).insert(string.slice(1));
    } else {
      super.set(Trie.LEAF, null);
    }
  }

  override get(key: unknown, defaultValue?: unknown): unknown {
    return super.has(key) ? super.get(key) : defaultValue;
  }

  /** Quirk preserved: nltk's Trie.copy() resolves to dict.copy(), which
   * returns a plain dict (shallow), not a Trie. */
  copy(): Map<unknown, unknown> {
    return new Map(this);
  }

  static fromkeys(iterable: Iterable<unknown>, value: unknown = null): Trie {
    const trie = new Trie();
    for (const key of iterable) trie.set(key, value);
    return trie;
  }

  pop(key: unknown, defaultValue?: unknown): unknown {
    if (super.has(key)) {
      const value = super.get(key);
      super.delete(key);
      return value;
    }
    if (arguments.length > 1) return defaultValue;
    throw pyError("KeyError", `${String(key)}`);
  }

  popitem(): [unknown, unknown] {
    if (super.size === 0) throw pyError("KeyError", "popitem(): dictionary is empty");
    let last: unknown;
    for (const key of super.keys()) last = key;
    const value = super.get(last);
    super.delete(last);
    return [last, value];
  }

  setdefault(key: unknown, defaultValue: unknown = null): unknown {
    if (!super.has(key)) super.set(key, defaultValue);
    return super.get(key);
  }

  update(other: Iterable<[unknown, unknown]> | Map<unknown, unknown> | Record<string, unknown>): void {
    if (other instanceof Map || Symbol.iterator in Object(other)) {
      for (const [k, v] of other as Iterable<[unknown, unknown]>) super.set(k, v);
    } else {
      for (const [k, v] of Object.entries(other)) super.set(k, v);
    }
  }

  items(): MapIterator<[unknown, unknown]> {
    return super.entries();
  }

  hasWord(word: string): boolean {
    // eslint-disable-next-line typescript/no-this-alias -- trie node descent
    let node: Trie = this;
    for (const ch of word) {
      const next = node.get(ch);
      if (!(next instanceof Trie)) return false;
      node = next;
    }
    return node.has(Trie.LEAF);
  }
}
