import { ConditionalFreqDist, FreqDist } from "./freqdist";
import { ConditionalProbDist, LidstoneProbDist, type ProbDistLike } from "./probability";
import type { GoldSentence, TaggedToken, UntaggedSentence } from "./sequential_taggers";

export type Estimator = (freqdist: FreqDist<string>, bins: number) => ProbDistLike<string>;

const f32 = Math.fround;

function uniqueInOrder(values: Iterable<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  }
  return out;
}

function isTaggedSentence(sequence: UntaggedSentence | GoldSentence): sequence is GoldSentence {
  return sequence.length > 0 && Array.isArray(sequence[0]);
}

export function untag(taggedSentence: ReadonlyArray<TaggedToken>): string[] {
  return taggedSentence.map(([word]) => word);
}

export function untagSents(taggedSentences: ReadonlyArray<GoldSentence>): string[][] {
  return taggedSentences.map((sentence) => untag(sentence));
}

export interface HiddenMarkovModelTrainerOptions {
  estimator?: Estimator;
}

function defaultEstimator(freqdist: FreqDist<string>, bins: number): ProbDistLike<string> {
  return new LidstoneProbDist(freqdist, 0.1, bins);
}

export class HiddenMarkovModelTrainer {
  states: string[];
  symbols: string[];

  constructor(states?: Iterable<string>, symbols?: Iterable<string>) {
    this.states = states ? [...states] : [];
    this.symbols = symbols ? [...symbols] : [];
  }

  trainSupervised(
    labeledSequences: ReadonlyArray<GoldSentence>,
    options?: HiddenMarkovModelTrainerOptions,
  ): HiddenMarkovModelTagger {
    const estimator = options?.estimator ?? defaultEstimator;

    const knownSymbols = new Set(this.symbols);
    const knownStates = new Set(this.states);

    const starting = new FreqDist<string>();
    const transitions = new ConditionalFreqDist<string, string>();
    const outputs = new ConditionalFreqDist<string, string>();

    for (const sequence of labeledSequences) {
      let lastState: string | null = null;
      for (const [symbol, state] of sequence) {
        if (lastState === null) {
          starting.inc(state);
        } else {
          transitions.get(lastState).inc(state);
        }
        outputs.get(state).inc(symbol);
        lastState = state;

        if (!knownStates.has(state)) {
          this.states.push(state);
          knownStates.add(state);
        }
        if (!knownSymbols.has(symbol)) {
          this.symbols.push(symbol);
          knownSymbols.add(symbol);
        }
      }
    }

    const numStates = this.states.length;
    const numSymbols = this.symbols.length;
    const priors = estimator(starting, numStates);
    const transitionDist = new ConditionalProbDist(transitions, estimator, numStates);
    const outputDist = new ConditionalProbDist(outputs, estimator, numSymbols);

    return new HiddenMarkovModelTagger(this.symbols, this.states, transitionDist, outputDist, priors);
  }
}

export class HiddenMarkovModelTagger {
  symbols: string[];
  states: string[];
  transitions: ConditionalProbDist<string, string>;
  outputs: ConditionalProbDist<string, string>;
  priors: ProbDistLike<string>;

  #priorLogCache: Float32Array | null = null;
  #transitionLogCache: Float32Array[] | null = null;
  #outputLogCache: Float32Array[] | null = null;
  #symbolIndex = new Map<string, number>();

  constructor(
    symbols: Iterable<string>,
    states: Iterable<string>,
    transitions: ConditionalProbDist<string, string>,
    outputs: ConditionalProbDist<string, string>,
    priors: ProbDistLike<string>,
  ) {
    this.symbols = uniqueInOrder(symbols);
    this.states = uniqueInOrder(states);
    this.transitions = transitions;
    this.outputs = outputs;
    this.priors = priors;
  }

  static train(
    labeledSequence: ReadonlyArray<GoldSentence>,
    options?: HiddenMarkovModelTrainerOptions,
  ): HiddenMarkovModelTagger {
    const words: string[] = [];
    const tags: string[] = [];
    for (const sentence of labeledSequence) {
      for (const [word, tag] of sentence) {
        words.push(word);
        tags.push(tag);
      }
    }
    const symbols = uniqueInOrder(words);
    const tagSet = uniqueInOrder(tags);
    const trainer = new HiddenMarkovModelTrainer(tagSet, symbols);
    return trainer.trainSupervised(labeledSequence, options);
  }

  priorProb(state: string): number {
    return this.priors.prob(state);
  }

  priorLogProb(state: string): number {
    return this.priors.logprob(state);
  }

  transitionProb(fromState: string, toState: string): number {
    return this.transitions.get(fromState).prob(toState);
  }

  transitionLogProb(fromState: string, toState: string): number {
    return this.transitions.get(fromState).logprob(toState);
  }

  emissionProb(state: string, symbol: string): number {
    return this.outputs.get(state).prob(symbol);
  }

  emissionLogProb(state: string, symbol: string): number {
    return this.outputs.get(state).logprob(symbol);
  }

  tag(unlabeledSequence: UntaggedSentence): Array<[string, string]> {
    const path = this.bestPath(unlabeledSequence);
    return unlabeledSequence.map((token, index) => [token, path[index]!]);
  }

  tagSents(sentences: ReadonlyArray<UntaggedSentence>): Array<Array<[string, string]>> {
    return sentences.map((sentence) => this.tag(sentence));
  }

  evaluate(gold: ReadonlyArray<GoldSentence>): number {
    const taggedSents = this.tagSents(gold.map((sentence) => sentence.map(([word]) => word)));
    let correct = 0;
    let total = 0;
    for (let s = 0; s < gold.length; s += 1) {
      const reference = gold[s]!;
      const test = taggedSents[s]!;
      const length = Math.min(reference.length, test.length);
      for (let i = 0; i < length; i += 1) {
        total += 1;
        if (reference[i]![1] === test[i]![1]) correct += 1;
      }
    }
    return total === 0 ? 0 : correct / total;
  }

  bestPath(unlabeledSequence: UntaggedSentence): string[] {
    const T = unlabeledSequence.length;
    const N = this.states.length;
    if (T === 0) return [];

    this.#ensureSymbolCache(unlabeledSequence);
    const P = this.#getPriorLogCache();
    const X = this.#getTransitionLogCache();
    const O = this.#getOutputLogCache();

    const symbolIds = unlabeledSequence.map((token) => this.#symbolIndex.get(token)!);

    const V: Float64Array[] = [];
    const B: Int32Array[] = [];
    V.push(new Float64Array(N));
    B.push(new Int32Array(N).fill(-1));
    for (let i = 0; i < N; i += 1) {
      (V[0] as Float64Array)[i] = f32(P[i]! + (O[i] as unknown as Float64Array)[symbolIds[0]!]!);
    }
    for (let t = 1; t < T; t += 1) {
      const prev = V[t - 1]!;
      const row = new Float64Array(N);
      const back = new Int32Array(N);
      for (let j = 0; j < N; j += 1) {
        let best = 0;
        let bestScore = f32(prev[0]! + X[0]![j]!);
        for (let i = 1; i < N; i += 1) {
          const score = f32(prev[i]! + X[i]![j]!);
          if (score > bestScore) {
            bestScore = score;
            best = i;
          }
        }
        (row as Float64Array)[j] = f32(bestScore + (O[j] as unknown as Float64Array)[symbolIds[t]!]!);
        back[j] = best;
      }
      V.push(row);
      B.push(back);
    }

    let current = 0;
    for (let i = 1; i < N; i += 1) {
      if (V[T - 1]![i]! > V[T - 1]![current]!) current = i;
    }
    const indices = new Array<number>(T);
    indices[T - 1] = current;
    for (let t = T - 1; t > 0; t -= 1) {
      current = B[t]![current]!;
      indices[t - 1] = current;
    }
    return indices.map((index) => this.states[index]!);
  }

  logProbability(sequence: UntaggedSentence | GoldSentence): number {
    if (isTaggedSentence(sequence)) {
      const T = sequence.length;
      if (T === 0) return 0;
      let lastState: string = sequence[0]![1];
      let p = this.priors.logprob(lastState) + this.emissionLogProb(lastState, sequence[0]![0]);
      for (let t = 1; t < T; t += 1) {
        const state = sequence[t]![1];
        p += this.transitionLogProb(lastState, state) + this.emissionLogProb(state, sequence[t]![0]);
        lastState = state;
      }
      return p;
    }
    const alpha = this.forwardProbability(sequence);
    const T = sequence.length;
    if (T === 0) return 0;
    return logSumExp2(alpha[T - 1]!);
  }

  probability(sequence: UntaggedSentence | GoldSentence): number {
    return 2 ** this.logProbability(sequence);
  }

  forwardProbability(unlabeledSequence: UntaggedSentence): number[][] {
    const T = unlabeledSequence.length;
    const N = this.states.length;
    const alpha: number[][] = Array.from({ length: T }, () => new Array<number>(N).fill(Number.NEGATIVE_INFINITY));
    if (T === 0) return alpha;

    for (let i = 0; i < N; i += 1) {
      alpha[0]![i] = this.priors.logprob(this.states[i]!) + this.emissionLogProb(this.states[i]!, unlabeledSequence[0]!);
    }
    for (let t = 1; t < T; t += 1) {
      for (let i = 0; i < N; i += 1) {
        const incoming: number[] = new Array<number>(N);
        for (let h = 0; h < N; h += 1) {
          incoming[h] = alpha[t - 1]![h]! + this.transitionLogProb(this.states[h]!, this.states[i]!);
        }
        alpha[t]![i] = logSumExp2(incoming) + this.emissionLogProb(this.states[i]!, unlabeledSequence[t]!);
      }
    }
    return alpha;
  }

  toString(): string {
    return `<HiddenMarkovModelTagger ${this.states.length} states and ${this.symbols.length} output symbols>`;
  }

  #ensureSymbolCache(unlabeledSequence: UntaggedSentence): void {
    let added = false;
    for (const token of unlabeledSequence) {
      if (!this.#symbolIndex.has(token) && !this.symbols.includes(token)) {
        this.symbols.push(token);
        added = true;
      }
    }
    if (added || this.#outputLogCache === null) {
      this.#symbolIndex.clear();
      for (let k = 0; k < this.symbols.length; k += 1) {
        this.#symbolIndex.set(this.symbols[k]!, k);
      }
      this.#outputLogCache = null;
    }
  }

  #getPriorLogCache(): Float32Array {
    if (this.#priorLogCache === null) {
      const cache = new Float32Array(this.states.length);
      for (let i = 0; i < this.states.length; i += 1) {
        cache[i] = f32(this.priors.logprob(this.states[i]!));
      }
      this.#priorLogCache = cache;
    }
    return this.#priorLogCache;
  }

  #getTransitionLogCache(): Float32Array[] {
    if (this.#transitionLogCache === null) {
      this.#transitionLogCache = this.states.map((fromState) => {
        const dist = this.transitions.get(fromState);
        const row = new Float32Array(this.states.length);
        for (let j = 0; j < this.states.length; j += 1) {
          row[j]! = f32(dist.logprob(this.states[j]!));
        }
        return row;
      });
    }
    return this.#transitionLogCache;
  }

  #getOutputLogCache(): Float32Array[] {
    if (this.#outputLogCache === null) {
      this.#outputLogCache = this.states.map((state) => {
        const dist = this.outputs.get(state);
        const row = new Float32Array(this.symbols.length);
        for (let k = 0; k < this.symbols.length; k += 1) {
          row[k] = f32(dist.logprob(this.symbols[k]!));
        }
        return row;
      });
    }
    return this.#outputLogCache;
  }
}

function logSumExp2(values: number[]): number {
  if (values.length === 0) return Number.NEGATIVE_INFINITY;
  const max = Math.max(...values);
  if (max === Number.NEGATIVE_INFINITY) return max;
  let sum = 0;
  for (const value of values) sum += 2 ** (value - max);
  return Math.log2(sum) + max;
}
