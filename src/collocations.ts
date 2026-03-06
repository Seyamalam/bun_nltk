import { bigramWindowStatsAscii } from "./native";
import { FreqDist } from "./freqdist";
import { tokenizeAscii } from "./reference";

const SMALL = 1e-20;

export type BigramScoreFn<T> = (n_ii: number, marginals: [number, number], total: number) => number;
export type TrigramScoreFn<T> = (
  n_iii: number,
  bigramMarginals: [number, number, number],
  unigramMarginals: [number, number, number],
  total: number,
) => number;
export type QuadgramScoreFn<T> = (
  n_iiii: number,
  trigramMarginals: [number, number, number, number],
  bigramMarginals: [number, number, number, number, number, number],
  unigramMarginals: [number, number, number, number],
  total: number,
) => number;

function compareTuple<T>(left: readonly [T, T], right: readonly [T, T]): number {
  const left0 = String(left[0]);
  const right0 = String(right[0]);
  if (left0 !== right0) return left0.localeCompare(right0);
  return String(left[1]).localeCompare(String(right[1]));
}

function compareTriple<T>(left: readonly [T, T, T], right: readonly [T, T, T]): number {
  const first = compareTuple([left[0], left[1]], [right[0], right[1]]);
  if (first !== 0) return first;
  return String(left[2]).localeCompare(String(right[2]));
}

function compareQuad<T>(left: readonly [T, T, T, T], right: readonly [T, T, T, T]): number {
  const first = compareTriple([left[0], left[1], left[2]], [right[0], right[1], right[2]]);
  if (first !== 0) return first;
  return String(left[3]).localeCompare(String(right[3]));
}

function product(values: Iterable<number>): number {
  let out = 1;
  for (const value of values) out *= value;
  return out;
}

function expectedValues(contingency: number[], n: number): number[] {
  const total = contingency.reduce((sum, value) => sum + value, 0);
  const bits = Array.from({ length: n }, (_, index) => 1 << index);
  return contingency.map((_, cell) =>
    product(
      bits.map((bit) =>
        contingency
          .filter((_, index) => (index & bit) === (cell & bit))
          .reduce((sum, value) => sum + value, 0),
      ),
    ) / (total ** (n - 1)),
  );
}

function rawFreqGeneric(n: number, count: number, marginals: number[], total: number): number {
  void n;
  void marginals;
  return count / total;
}

function studentTGeneric(n: number, count: number, marginals: number[], total: number): number {
  return (count - product(marginals) / (total ** (n - 1))) / Math.sqrt(count + SMALL);
}

function miLikeGeneric(_n: number, count: number, marginals: number[], _total: number, power = 3): number {
  return count ** power / product(marginals);
}

function pmiGeneric(n: number, count: number, marginals: number[], total: number): number {
  return Math.log2(count * (total ** (n - 1))) - Math.log2(product(marginals));
}

function likelihoodRatioGeneric(n: number, contingency: number[], count: number, marginals: number[], total: number): number {
  void count;
  void marginals;
  void total;
  const expected = expectedValues(contingency, n);
  let result = 0;
  for (let i = 0; i < contingency.length; i += 1) {
    result += contingency[i]! * Math.log(contingency[i]! / (expected[i]! + SMALL) + SMALL);
  }
  return 2 * result;
}

function poissonStirlingGeneric(n: number, count: number, marginals: number[], total: number): number {
  const expected = product(marginals) / (total ** (n - 1));
  return count * (Math.log2(count / expected) - 1);
}

function jaccardGeneric(contingency: number[]): number {
  return contingency[0]! / contingency.slice(0, -1).reduce((sum, value) => sum + value, 0);
}

export class BigramAssocMeasures {
  static _contingency(n_ii: number, [n_ix, n_xi]: [number, number], n_xx: number): [number, number, number, number] {
    const n_oi = n_xi - n_ii;
    const n_io = n_ix - n_ii;
    return [n_ii, n_oi, n_io, n_xx - n_ii - n_oi - n_io];
  }

  static _marginals(n_ii: number, n_oi: number, n_io: number, n_oo: number): [number, [number, number], number] {
    return [n_ii, [n_oi + n_ii, n_io + n_ii], n_oo + n_oi + n_io + n_ii];
  }

  static raw_freq(n_ii: number, _marginals: [number, number], n_xx: number): number {
    return n_ii / n_xx;
  }

  static student_t(n_ii: number, marginals: [number, number], n_xx: number): number {
    return (n_ii - product(marginals) / n_xx) / Math.sqrt(n_ii + SMALL);
  }

  static mi_like(n_ii: number, marginals: [number, number], _n_xx: number, options?: { power?: number }): number {
    return n_ii ** (options?.power ?? 3) / product(marginals);
  }

  static pmi(n_ii: number, marginals: [number, number], n_xx: number): number {
    return Math.log2(n_ii * n_xx) - Math.log2(product(marginals));
  }

  static likelihood_ratio(n_ii: number, marginals: [number, number], n_xx: number): number {
    const contingency = BigramAssocMeasures._contingency(n_ii, marginals, n_xx);
    const expected = BigramAssocMeasures._expected_values(contingency);
    let total = 0;
    for (let i = 0; i < contingency.length; i += 1) {
      total += contingency[i]! * Math.log(contingency[i]! / (expected[i]! + SMALL) + SMALL);
    }
    return 2 * total;
  }

  static poisson_stirling(n_ii: number, marginals: [number, number], n_xx: number): number {
    const expected = product(marginals) / n_xx;
    return n_ii * (Math.log2(n_ii / expected) - 1);
  }

  static jaccard(n_ii: number, marginals: [number, number], n_xx: number): number {
    const contingency = BigramAssocMeasures._contingency(n_ii, marginals, n_xx);
    return contingency[0] / (contingency[0] + contingency[1] + contingency[2]);
  }

  static phi_sq(n_ii: number, marginals: [number, number], n_xx: number): number {
    const [hit, missRight, missLeft, missBoth] = BigramAssocMeasures._contingency(n_ii, marginals, n_xx);
    return ((hit * missBoth - missLeft * missRight) ** 2) /
      ((hit + missLeft) * (hit + missRight) * (missLeft + missBoth) * (missRight + missBoth));
  }

  static chi_sq(n_ii: number, marginals: [number, number], n_xx: number): number {
    return n_xx * BigramAssocMeasures.phi_sq(n_ii, marginals, n_xx);
  }

  static dice(n_ii: number, [n_ix, n_xi]: [number, number], _n_xx: number): number {
    return (2 * n_ii) / (n_ix + n_xi);
  }

  static fisher(_n_ii: number, _marginals: [number, number], _n_xx: number): never {
    throw new Error("BigramAssocMeasures.fisher is not implemented in bun_nltk");
  }

  static _expected_values([n_ii, n_oi, n_io, n_oo]: [number, number, number, number]): [number, number, number, number] {
    const n_xx = n_ii + n_oi + n_io + n_oo;
    return [
      ((n_ii + n_oi) * (n_ii + n_io)) / n_xx,
      ((n_oi + n_ii) * (n_oi + n_oo)) / n_xx,
      ((n_io + n_ii) * (n_io + n_oo)) / n_xx,
      ((n_oo + n_oi) * (n_oo + n_io)) / n_xx,
    ];
  }
}

export class TrigramAssocMeasures {
  static _contingency(
    n_iii: number,
    [n_iix, n_ixi, n_xii]: [number, number, number],
    [n_ixx, n_xix, n_xxi]: [number, number, number],
    n_xxx: number,
  ): [number, number, number, number, number, number, number, number] {
    const n_oii = n_xii - n_iii;
    const n_ioi = n_ixi - n_iii;
    const n_iio = n_iix - n_iii;
    const n_ooi = n_xxi - n_iii - n_oii - n_ioi;
    const n_oio = n_xix - n_iii - n_oii - n_iio;
    const n_ioo = n_ixx - n_iii - n_ioi - n_iio;
    const n_ooo = n_xxx - n_iii - n_oii - n_ioi - n_iio - n_ooi - n_oio - n_ioo;
    return [n_iii, n_oii, n_ioi, n_ooi, n_iio, n_oio, n_ioo, n_ooo];
  }

  static _marginals(
    n_iii: number,
    n_oii: number,
    n_ioi: number,
    n_ooi: number,
    n_iio: number,
    n_oio: number,
    n_ioo: number,
    n_ooo: number,
  ): [number, [number, number, number], [number, number, number], number] {
    return [
      n_iii,
      [n_iii + n_iio, n_iii + n_ioi, n_iii + n_oii],
      [
        n_iii + n_ioi + n_iio + n_ioo,
        n_iii + n_oii + n_iio + n_oio,
        n_iii + n_oii + n_ioi + n_ooi,
      ],
      n_iii + n_oii + n_ioi + n_ooi + n_iio + n_oio + n_ioo + n_ooo,
    ];
  }

  static raw_freq(n_iii: number, _bigramMarginals: [number, number, number], _unigramMarginals: [number, number, number], n_xxx: number): number {
    return rawFreqGeneric(3, n_iii, [], n_xxx);
  }

  static student_t(n_iii: number, _bigramMarginals: [number, number, number], unigramMarginals: [number, number, number], n_xxx: number): number {
    return studentTGeneric(3, n_iii, unigramMarginals, n_xxx);
  }

  static mi_like(
    n_iii: number,
    _bigramMarginals: [number, number, number],
    unigramMarginals: [number, number, number],
    _n_xxx: number,
    options?: { power?: number },
  ): number {
    return miLikeGeneric(3, n_iii, unigramMarginals, 0, options?.power ?? 3);
  }

  static pmi(n_iii: number, _bigramMarginals: [number, number, number], unigramMarginals: [number, number, number], n_xxx: number): number {
    return pmiGeneric(3, n_iii, unigramMarginals, n_xxx);
  }

  static likelihood_ratio(
    n_iii: number,
    bigramMarginals: [number, number, number],
    unigramMarginals: [number, number, number],
    n_xxx: number,
  ): number {
    return likelihoodRatioGeneric(3, TrigramAssocMeasures._contingency(n_iii, bigramMarginals, unigramMarginals, n_xxx), n_iii, unigramMarginals, n_xxx);
  }

  static poisson_stirling(
    n_iii: number,
    _bigramMarginals: [number, number, number],
    unigramMarginals: [number, number, number],
    n_xxx: number,
  ): number {
    return poissonStirlingGeneric(3, n_iii, unigramMarginals, n_xxx);
  }

  static jaccard(n_iii: number, bigramMarginals: [number, number, number], unigramMarginals: [number, number, number], n_xxx: number): number {
    return jaccardGeneric(TrigramAssocMeasures._contingency(n_iii, bigramMarginals, unigramMarginals, n_xxx));
  }
}

export class QuadgramAssocMeasures {
  static _contingency(
    n_iiii: number,
    [n_iiix, n_iixi, n_ixii, n_xiii]: [number, number, number, number],
    [n_iixx, n_ixix, n_ixxi, n_xixi, n_xxii, n_xiix]: [number, number, number, number, number, number],
    [n_ixxx, n_xixx, n_xxix, n_xxxi]: [number, number, number, number],
    n_xxxx: number,
  ): number[] {
    const n_oiii = n_xiii - n_iiii;
    const n_ioii = n_ixii - n_iiii;
    const n_iioi = n_iixi - n_iiii;
    const n_ooii = n_xxii - n_iiii - n_oiii - n_ioii;
    const n_oioi = n_xixi - n_iiii - n_oiii - n_iioi;
    const n_iooi = n_ixxi - n_iiii - n_ioii - n_iioi;
    const n_oooi = n_xxxi - n_iiii - n_oiii - n_ioii - n_iioi - n_ooii - n_iooi - n_oioi;
    const n_iiio = n_iiix - n_iiii;
    const n_oiio = n_xiix - n_iiii - n_oiii - n_iiio;
    const n_ioio = n_ixix - n_iiii - n_ioii - n_iiio;
    const n_ooio = n_xxix - n_iiii - n_oiii - n_ioii - n_iiio - n_ooii - n_ioio - n_oiio;
    const n_iioo = n_iixx - n_iiii - n_iioi - n_iiio;
    const n_oioo = n_xixx - n_iiii - n_oiii - n_iioi - n_iiio - n_oioi - n_oiio - n_iioo;
    const n_iooo = n_ixxx - n_iiii - n_ioii - n_iioi - n_iiio - n_iooi - n_iioo - n_ioio;
    const n_oooo =
      n_xxxx - n_iiii - n_oiii - n_ioii - n_iioi - n_ooii - n_oioi - n_iooi - n_oooi -
      n_iiio - n_oiio - n_ioio - n_ooio - n_iioo - n_oioo - n_iooo;

    return [
      n_iiii, n_oiii, n_ioii, n_ooii, n_iioi, n_oioi, n_iooi, n_oooi,
      n_iiio, n_oiio, n_ioio, n_ooio, n_iioo, n_oioo, n_iooo, n_oooo,
    ];
  }

  static _marginals(...contingency: number[]): [number, [number, number, number, number], [number, number, number, number, number, number], [number, number, number, number], number] {
    const [
      n_iiii, n_oiii, n_ioii, n_ooii, n_iioi, n_oioi, n_iooi, n_oooi,
      n_iiio, n_oiio, n_ioio, n_ooio, n_iioo, n_oioo, n_iooo, n_oooo,
    ] = contingency;

    const n_iiix = n_iiii + n_iiio;
    const n_iixi = n_iiii + n_iioi;
    const n_ixii = n_iiii + n_ioii;
    const n_xiii = n_iiii + n_oiii;

    const n_iixx = n_iiii + n_iioi + n_iiio + n_iioo;
    const n_ixix = n_iiii + n_ioii + n_iiio + n_ioio;
    const n_ixxi = n_iiii + n_ioii + n_iioi + n_iooi;
    const n_xixi = n_iiii + n_oiii + n_iioi + n_oioi;
    const n_xxii = n_iiii + n_oiii + n_ioii + n_ooii;
    const n_xiix = n_iiii + n_oiii + n_iiio + n_oiio;

    const n_ixxx = n_iiii + n_ioii + n_iioi + n_iiio + n_iooi + n_iioo + n_ioio + n_iooo;
    const n_xixx = n_iiii + n_oiii + n_iioi + n_iiio + n_oioi + n_oiio + n_iioo + n_oioo;
    const n_xxix = n_iiii + n_oiii + n_ioii + n_iiio + n_ooii + n_ioio + n_oiio + n_ooio;
    const n_xxxi = n_iiii + n_oiii + n_ioii + n_iioi + n_ooii + n_iooi + n_oioi + n_oooi;

    return [
      n_iiii,
      [n_iiix, n_iixi, n_ixii, n_xiii],
      [n_iixx, n_ixix, n_ixxi, n_xixi, n_xxii, n_xiix],
      [n_ixxx, n_xixx, n_xxix, n_xxxi],
      contingency.reduce((sum, value) => sum + value, 0),
    ];
  }

  static raw_freq(
    n_iiii: number,
    _trigramMarginals: [number, number, number, number],
    _bigramMarginals: [number, number, number, number, number, number],
    _unigramMarginals: [number, number, number, number],
    n_all: number,
  ): number {
    return rawFreqGeneric(4, n_iiii, [], n_all);
  }

  static student_t(
    n_iiii: number,
    _trigramMarginals: [number, number, number, number],
    _bigramMarginals: [number, number, number, number, number, number],
    unigramMarginals: [number, number, number, number],
    n_all: number,
  ): number {
    return studentTGeneric(4, n_iiii, unigramMarginals, n_all);
  }

  static mi_like(
    n_iiii: number,
    _trigramMarginals: [number, number, number, number],
    _bigramMarginals: [number, number, number, number, number, number],
    unigramMarginals: [number, number, number, number],
    _n_all: number,
    options?: { power?: number },
  ): number {
    return miLikeGeneric(4, n_iiii, unigramMarginals, 0, options?.power ?? 3);
  }

  static pmi(
    n_iiii: number,
    _trigramMarginals: [number, number, number, number],
    _bigramMarginals: [number, number, number, number, number, number],
    unigramMarginals: [number, number, number, number],
    n_all: number,
  ): number {
    return pmiGeneric(4, n_iiii, unigramMarginals, n_all);
  }

  static likelihood_ratio(
    n_iiii: number,
    trigramMarginals: [number, number, number, number],
    bigramMarginals: [number, number, number, number, number, number],
    unigramMarginals: [number, number, number, number],
    n_all: number,
  ): number {
    return likelihoodRatioGeneric(4, QuadgramAssocMeasures._contingency(n_iiii, trigramMarginals, bigramMarginals, unigramMarginals, n_all), n_iiii, unigramMarginals, n_all);
  }

  static poisson_stirling(
    n_iiii: number,
    _trigramMarginals: [number, number, number, number],
    _bigramMarginals: [number, number, number, number, number, number],
    unigramMarginals: [number, number, number, number],
    n_all: number,
  ): number {
    return poissonStirlingGeneric(4, n_iiii, unigramMarginals, n_all);
  }

  static jaccard(
    n_iiii: number,
    trigramMarginals: [number, number, number, number],
    bigramMarginals: [number, number, number, number, number, number],
    unigramMarginals: [number, number, number, number],
    n_all: number,
  ): number {
    return jaccardGeneric(QuadgramAssocMeasures._contingency(n_iiii, trigramMarginals, bigramMarginals, unigramMarginals, n_all));
  }
}

export class BigramCollocationFinder<T = string> {
  static readonly default_ws = 2;

  readonly N: number;

  constructor(
    public readonly wordFd: FreqDist<T>,
    public ngramFd: FreqDist<[T, T]>,
    public readonly windowSize = 2,
  ) {
    this.N = wordFd.N();
  }

  static fromWords<T>(words: Iterable<T>, windowSize = 2): BigramCollocationFinder<T> {
    if (!Number.isInteger(windowSize) || windowSize < 2) {
      throw new Error("Specify window_size at least 2");
    }

    const tokens = [...words];
    const wordFd = new FreqDist<T>();
    const bigramFd = new FreqDist<[T, T]>();

    for (let i = 0; i < tokens.length; i += 1) {
      const left = tokens[i]!;
      wordFd.inc(left);
      for (let j = i + 1; j < Math.min(tokens.length, i + windowSize); j += 1) {
        bigramFd.inc([left, tokens[j]!]);
      }
    }

    return new BigramCollocationFinder(wordFd, bigramFd, windowSize);
  }

  static fromDocuments<T>(documents: Iterable<Iterable<T>>, windowSize = 2): BigramCollocationFinder<T> {
    const wordFd = new FreqDist<T>();
    const bigramFd = new FreqDist<[T, T]>();

    for (const document of documents) {
      const finder = BigramCollocationFinder.fromWords(document, windowSize);
      wordFd.update(finder.wordFd);
      bigramFd.update(finder.ngramFd);
    }

    return new BigramCollocationFinder(wordFd, bigramFd, windowSize);
  }

  static fromTextAscii(
    text: string,
    options?: { windowSize?: number; native?: boolean },
  ): BigramCollocationFinder<string> {
    const windowSize = options?.windowSize ?? 2;
    if (!Number.isInteger(windowSize) || windowSize < 2) {
      throw new Error("Specify window_size at least 2");
    }

    const useNative = options?.native ?? true;
    if (useNative) {
      try {
        const wordFd = FreqDist.fromTextAscii(text, { native: true });
        const bigramFd = new FreqDist<[string, string]>();
        for (const row of bigramWindowStatsAscii(text, windowSize)) {
          bigramFd.set([row.left, row.right], row.count);
        }
        return new BigramCollocationFinder(wordFd, bigramFd, windowSize);
      } catch {
        // Fall through to the reference tokenizer path when native artifacts are unavailable.
      }
    }

    return BigramCollocationFinder.fromWords(tokenizeAscii(text), windowSize);
  }

  #applyFilter(fn: (ngram: readonly [T, T], freq: number) => boolean): void {
    const next = new FreqDist<[T, T]>();
    for (const [ngram, freq] of this.ngramFd.entries()) {
      if (!fn(ngram, freq)) next.set(ngram, freq);
    }
    this.ngramFd = next;
  }

  applyFreqFilter(minFreq: number): this {
    this.#applyFilter((_ngram, freq) => freq < minFreq);
    return this;
  }

  applyNgramFilter(fn: (left: T, right: T) => boolean): this {
    this.#applyFilter((ngram) => fn(ngram[0], ngram[1]));
    return this;
  }

  applyWordFilter(fn: (word: T) => boolean): this {
    this.#applyFilter((ngram) => fn(ngram[0]) || fn(ngram[1]));
    return this;
  }

  scoreNgram(scoreFn: BigramScoreFn<T>, left: T, right: T): number | null {
    const rawCount = this.ngramFd.get([left, right]);
    const scaledCount = rawCount / (this.windowSize - 1);
    if (!scaledCount) return null;
    return scoreFn(scaledCount, [this.wordFd.get(left), this.wordFd.get(right)], this.N);
  }

  scoreNgrams(scoreFn: BigramScoreFn<T>): Array<[[T, T], number]> {
    const scored: Array<[[T, T], number]> = [];
    for (const [ngram] of this.ngramFd.entries()) {
      const score = this.scoreNgram(scoreFn, ngram[0], ngram[1]);
      if (score !== null && Number.isFinite(score)) {
        scored.push([ngram, score]);
      }
    }

    scored.sort((left, right) => {
      if (left[1] !== right[1]) return right[1] - left[1];
      return compareTuple(left[0], right[0]);
    });
    return scored;
  }

  nbest(scoreFn: BigramScoreFn<T>, count: number): Array<[T, T]> {
    return this.scoreNgrams(scoreFn)
      .slice(0, Math.max(0, count))
      .map(([ngram]) => ngram);
  }

  *aboveScore(scoreFn: BigramScoreFn<T>, minScore: number): IterableIterator<[T, T]> {
    for (const [ngram, score] of this.scoreNgrams(scoreFn)) {
      if (score > minScore) {
        yield ngram;
      } else {
        break;
      }
    }
  }
}

export class TrigramCollocationFinder<T = string> {
  static readonly default_ws = 3;
  readonly N: number;

  constructor(
    public readonly wordFd: FreqDist<T>,
    public readonly bigramFd: FreqDist<[T, T]>,
    public readonly wildcardFd: FreqDist<[T, T]>,
    public ngramFd: FreqDist<[T, T, T]>,
  ) {
    this.N = wordFd.N();
  }

  static fromWords<T>(words: Iterable<T>, windowSize = 3): TrigramCollocationFinder<T> {
    if (!Number.isInteger(windowSize) || windowSize < 3) {
      throw new Error("Specify window_size at least 3");
    }

    const tokens = [...words];
    const wordFd = new FreqDist<T>();
    const wildcardFd = new FreqDist<[T, T]>();
    const bigramFd = new FreqDist<[T, T]>();
    const trigramFd = new FreqDist<[T, T, T]>();

    for (let i = 0; i < tokens.length; i += 1) {
      const window = Array.from({ length: windowSize }, (_, offset) => tokens[i + offset]);
      const left = window[0];
      if (left === undefined) continue;
      for (let j = 1; j < window.length; j += 1) {
        for (let k = j + 1; k < window.length; k += 1) {
          const middle = window[j];
          const right = window[k];
          wordFd.inc(left);
          if (middle === undefined) continue;
          bigramFd.inc([left, middle]);
          if (right === undefined) continue;
          wildcardFd.inc([left, right]);
          trigramFd.inc([left, middle, right]);
        }
      }
    }

    return new TrigramCollocationFinder(wordFd, bigramFd, wildcardFd, trigramFd);
  }

  bigramFinder(): BigramCollocationFinder<T> {
    return new BigramCollocationFinder(this.wordFd, this.bigramFd);
  }

  #applyFilter(fn: (ngram: readonly [T, T, T], freq: number) => boolean): void {
    const next = new FreqDist<[T, T, T]>();
    for (const [ngram, freq] of this.ngramFd.entries()) {
      if (!fn(ngram, freq)) next.set(ngram, freq);
    }
    this.ngramFd = next;
  }

  applyFreqFilter(minFreq: number): this {
    this.#applyFilter((_ngram, freq) => freq < minFreq);
    return this;
  }

  applyNgramFilter(fn: (w1: T, w2: T, w3: T) => boolean): this {
    this.#applyFilter((ngram) => fn(ngram[0], ngram[1], ngram[2]));
    return this;
  }

  applyWordFilter(fn: (word: T) => boolean): this {
    this.#applyFilter((ngram) => ngram.some((word) => fn(word)));
    return this;
  }

  scoreNgram(scoreFn: TrigramScoreFn<T>, w1: T, w2: T, w3: T): number | null {
    const n_iii = this.ngramFd.get([w1, w2, w3]);
    if (!n_iii) return null;
    return scoreFn(
      n_iii,
      [this.bigramFd.get([w1, w2]), this.wildcardFd.get([w1, w3]), this.bigramFd.get([w2, w3])],
      [this.wordFd.get(w1), this.wordFd.get(w2), this.wordFd.get(w3)],
      this.N,
    );
  }

  scoreNgrams(scoreFn: TrigramScoreFn<T>): Array<[[T, T, T], number]> {
    const scored: Array<[[T, T, T], number]> = [];
    for (const [ngram] of this.ngramFd.entries()) {
      const score = this.scoreNgram(scoreFn, ngram[0], ngram[1], ngram[2]);
      if (score !== null && Number.isFinite(score)) scored.push([ngram, score]);
    }
    scored.sort((left, right) => {
      if (left[1] !== right[1]) return right[1] - left[1];
      return compareTriple(left[0], right[0]);
    });
    return scored;
  }

  nbest(scoreFn: TrigramScoreFn<T>, count: number): Array<[T, T, T]> {
    return this.scoreNgrams(scoreFn).slice(0, Math.max(0, count)).map(([ngram]) => ngram);
  }

  *aboveScore(scoreFn: TrigramScoreFn<T>, minScore: number): IterableIterator<[T, T, T]> {
    for (const [ngram, score] of this.scoreNgrams(scoreFn)) {
      if (score > minScore) {
        yield ngram;
      } else {
        break;
      }
    }
  }
}

export class QuadgramCollocationFinder<T = string> {
  static readonly default_ws = 4;
  readonly N: number;

  constructor(
    public readonly wordFd: FreqDist<T>,
    public ngramFd: FreqDist<[T, T, T, T]>,
    public readonly ii: FreqDist<[T, T]>,
    public readonly iii: FreqDist<[T, T, T]>,
    public readonly ixi: FreqDist<[T, T]>,
    public readonly ixxi: FreqDist<[T, T]>,
    public readonly iixi: FreqDist<[T, T, T]>,
    public readonly ixii: FreqDist<[T, T, T]>,
  ) {
    this.N = wordFd.N();
  }

  static fromWords<T>(words: Iterable<T>, windowSize = 4): QuadgramCollocationFinder<T> {
    if (!Number.isInteger(windowSize) || windowSize < 4) {
      throw new Error("Specify window_size at least 4");
    }

    const tokens = [...words];
    const ixxx = new FreqDist<T>();
    const iiii = new FreqDist<[T, T, T, T]>();
    const ii = new FreqDist<[T, T]>();
    const iii = new FreqDist<[T, T, T]>();
    const ixi = new FreqDist<[T, T]>();
    const ixxi = new FreqDist<[T, T]>();
    const iixi = new FreqDist<[T, T, T]>();
    const ixii = new FreqDist<[T, T, T]>();

    for (let i = 0; i < tokens.length; i += 1) {
      const window = Array.from({ length: windowSize }, (_, offset) => tokens[i + offset]);
      const w1 = window[0];
      if (w1 === undefined) continue;
      for (let j = 1; j < window.length; j += 1) {
        for (let k = j + 1; k < window.length; k += 1) {
          for (let l = k + 1; l < window.length; l += 1) {
            const w2 = window[j];
            const w3 = window[k];
            const w4 = window[l];
            ixxx.inc(w1);
            if (w2 === undefined) continue;
            ii.inc([w1, w2]);
            if (w3 === undefined) continue;
            iii.inc([w1, w2, w3]);
            ixi.inc([w1, w3]);
            if (w4 === undefined) continue;
            iiii.inc([w1, w2, w3, w4]);
            ixxi.inc([w1, w4]);
            ixii.inc([w1, w3, w4]);
            iixi.inc([w1, w2, w4]);
          }
        }
      }
    }

    return new QuadgramCollocationFinder(ixxx, iiii, ii, iii, ixi, ixxi, iixi, ixii);
  }

  #applyFilter(fn: (ngram: readonly [T, T, T, T], freq: number) => boolean): void {
    const next = new FreqDist<[T, T, T, T]>();
    for (const [ngram, freq] of this.ngramFd.entries()) {
      if (!fn(ngram, freq)) next.set(ngram, freq);
    }
    this.ngramFd = next;
  }

  applyFreqFilter(minFreq: number): this {
    this.#applyFilter((_ngram, freq) => freq < minFreq);
    return this;
  }

  applyWordFilter(fn: (word: T) => boolean): this {
    this.#applyFilter((ngram) => ngram.some((word) => fn(word)));
    return this;
  }

  applyNgramFilter(fn: (w1: T, w2: T, w3: T, w4: T) => boolean): this {
    this.#applyFilter((ngram) => fn(ngram[0], ngram[1], ngram[2], ngram[3]));
    return this;
  }

  scoreNgram(scoreFn: QuadgramScoreFn<T>, w1: T, w2: T, w3: T, w4: T): number | null {
    const n_iiii = this.ngramFd.get([w1, w2, w3, w4]);
    if (!n_iiii) return null;
    return scoreFn(
      n_iiii,
      [this.iii.get([w1, w2, w3]), this.iixi.get([w1, w2, w4]), this.ixii.get([w1, w3, w4]), this.iii.get([w2, w3, w4])],
      [this.ii.get([w1, w2]), this.ixi.get([w1, w3]), this.ixxi.get([w1, w4]), this.ixi.get([w2, w4]), this.ii.get([w3, w4]), this.ii.get([w2, w3])],
      [this.wordFd.get(w1), this.wordFd.get(w2), this.wordFd.get(w3), this.wordFd.get(w4)],
      this.N,
    );
  }

  scoreNgrams(scoreFn: QuadgramScoreFn<T>): Array<[[T, T, T, T], number]> {
    const scored: Array<[[T, T, T, T], number]> = [];
    for (const [ngram] of this.ngramFd.entries()) {
      const score = this.scoreNgram(scoreFn, ngram[0], ngram[1], ngram[2], ngram[3]);
      if (score !== null && Number.isFinite(score)) scored.push([ngram, score]);
    }
    scored.sort((left, right) => {
      if (left[1] !== right[1]) return right[1] - left[1];
      return compareQuad(left[0], right[0]);
    });
    return scored;
  }

  nbest(scoreFn: QuadgramScoreFn<T>, count: number): Array<[T, T, T, T]> {
    return this.scoreNgrams(scoreFn).slice(0, Math.max(0, count)).map(([ngram]) => ngram);
  }

  *aboveScore(scoreFn: QuadgramScoreFn<T>, minScore: number): IterableIterator<[T, T, T, T]> {
    for (const [ngram, score] of this.scoreNgrams(scoreFn)) {
      if (score > minScore) {
        yield ngram;
      } else {
        break;
      }
    }
  }
}
