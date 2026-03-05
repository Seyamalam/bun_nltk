import { bigramWindowStatsAscii } from "./native";
import { FreqDist } from "./freqdist";
import { tokenizeAscii } from "./reference";

const SMALL = 1e-20;

export type BigramScoreFn<T> = (n_ii: number, marginals: [number, number], total: number) => number;

function compareTuple<T>(left: readonly [T, T], right: readonly [T, T]): number {
  const left0 = String(left[0]);
  const right0 = String(right[0]);
  if (left0 !== right0) return left0.localeCompare(right0);
  return String(left[1]).localeCompare(String(right[1]));
}

function product(values: Iterable<number>): number {
  let out = 1;
  for (const value of values) out *= value;
  return out;
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
