import { pyError } from "./internals";

// ---------------------------------------------------------------------------
// MT19937 + Python Random (seed/shuffle/randrange/sample/random)
// ---------------------------------------------------------------------------

export class MT19937 {
  private mt = new Uint32Array(624);
  private idx = 624;
  seed(s: number): void {
    this.mt[0] = s >>> 0;
    for (let i = 1; i < 624; i++) {
      this.mt[i] = (Math.imul(1812433253, this.mt[i - 1]! ^ (this.mt[i - 1]! >>> 30)) + i) >>> 0;
    }
    this.idx = 624;
  }
  /** Python's init_by_array seeding (what random.seed(int) calls). */
  seedByArray(keys: number[]): void {
    this.seed(19650218);
    let i = 1, j = 0;
    const k = Math.max(624, keys.length);
    for (let n = 0; n < k; n++) {
      this.mt[i] = ((this.mt[i]! ^ Math.imul(this.mt[i - 1]! ^ (this.mt[i - 1]! >>> 30), 1664525)) + (keys[j]! >>> 0) + j) >>> 0;
      i++; j++;
      if (i >= 624) { this.mt[0] = this.mt[623]!; i = 1; }
      if (j >= keys.length) j = 0;
    }
    for (let n = 0; n < 623; n++) {
      this.mt[i] = ((this.mt[i]! ^ Math.imul(this.mt[i - 1]! ^ (this.mt[i - 1]! >>> 30), 1566083941)) - i) >>> 0;
      i++;
      if (i >= 624) { this.mt[0] = this.mt[623]!; i = 1; }
    }
    this.mt[0] = 0x80000000;
    this.idx = 624;
  }
  private twist(): void {
    const m = this.mt;
    for (let i = 0; i < 624; i++) {
      const y = (m[i]! & 0x80000000) | (m[(i + 1) % 624]! & 0x7fffffff);
      m[i] = m[(i + 397) % 624]! ^ (y >>> 1);
      if (y & 1) m[i] = m[i]! ^ 0x9908b0df;
    }
    this.idx = 0;
  }
  uint32(): number {
    if (this.idx >= 624) this.twist();
    let y = this.mt[this.idx++]!;
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return y >>> 0;
  }
}

/** Port of Python's random.Random (integer seeds + shuffle/randrange/sample). */
export class PyRandom {
  private mt = new MT19937();
  constructor(seed?: number) { if (seed !== undefined) this.seed(seed); }
  seed(a: number): void {
    if (!Number.isInteger(a)) throw pyError("TypeError", "seed expects int");
    // CPython: int seed -> init_by_array over 32-bit little-endian words.
    const keys: number[] = [];
    let v = a >>> 0;
    keys.push(v);
    // For large ints Python splits the whole bignum; demos only use small.
    this.mt.seedByArray(keys);
  }
  getrandbits(k: number): bigint {
    // CPython: words are drawn little-endian; each word contributes its
    // HIGH `bits` bits (genrand_int32 >> (32 - bits)).
    const words = Math.ceil(k / 32);
    let result = 0n;
    for (let i = 0; i < words; i++) {
      const bits = Math.min(32, k - i * 32);
      const w = BigInt(this.mt.uint32()) >> BigInt(32 - bits);
      result |= w << BigInt(i * 32);
    }
    return result;
  }
  randbelow(n: number): number {
    const k = Math.max(1, n.toString(2).length); // bit_length
    let r = Number(this.getrandbits(k));
    while (r >= n) r = Number(this.getrandbits(k));
    return r;
  }
  random(): number {
    // CPython: (a >> 5) * 2**26 + (b >> 6), all over 2**53.
    const a = this.mt.uint32() >>> 5, b = this.mt.uint32() >>> 6;
    return (a * 67108864.0 + b) / 9007199254740992.0;
  }
  randrange(n: number): number { return this.randbelow(n); }
  shuffle<T>(x: T[]): T[] {
    for (let i = x.length - 1; i > 0; i--) {
      const j = this.randbelow(i + 1);
      [x[i], x[j]] = [x[j]!, x[i]!];
    }
    return x;
  }
  sample<T>(pop: T[], k: number): T[] {
    const n = pop.length;
    const result: T[] = Array.from({ length: k });
    const setsize = 21;
    if (k <= 5) {
      // small pool path
      const pool = pop.slice();
      for (let i = 0; i < k; i++) {
        const j = this.randbelow(n - i);
        result[i] = pool[j]!;
        pool[j] = pool[n - i - 1]!;
      }
      return result;
    }
    void setsize;
    const selected = new Set<number>();
    for (let i = 0; i < k; i++) {
      let j = this.randbelow(n);
      while (selected.has(j)) j = this.randbelow(n);
      selected.add(j);
      result[i] = pop[j]!;
    }
    return result;
  }
}

