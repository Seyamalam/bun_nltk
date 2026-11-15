import { ConditionalFreqDist, FreqDist } from "./freqdist";
import { ConfusionMatrix } from "./confusion_metrics";
import { hmmViterbiIdsNative } from "./native";
import { ConditionalProbDist, DictionaryConditionalProbDist, DictionaryProbDist, LidstoneProbDist, MutableProbDist, RandomProbDist, type ConditionalProbDistI, type ProbDistLike } from "./probability";
import { find as dataFind } from "./data";
import { CategorizedTaggedCorpusReader } from "./corpus_text_readers";
import { ndarray, pyFloatRepr, pyRepr, pytuple, type PrintSink } from "./ext_pure";
import { PyRandom } from "./py_random";
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
  useNativeDecoding?: boolean;
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

    return new HiddenMarkovModelTagger(this.symbols, this.states, transitionDist, outputDist, priors, {
      useNativeDecoding: options?.useNativeDecoding,
    });
  }

  /** NLTK `train_supervised` snake_case member. */
  train_supervised(
    labeledSequences: ReadonlyArray<GoldSentence>,
    options?: HiddenMarkovModelTrainerOptions,
  ): HiddenMarkovModelTagger {
    return this.trainSupervised(labeledSequences, options);
  }

  /** NLTK `train` — alias of `train_supervised` in this port. */
  train(labeledSequences: ReadonlyArray<GoldSentence>, options?: HiddenMarkovModelTrainerOptions): HiddenMarkovModelTagger {
    return this.trainSupervised(labeledSequences, options);
  }

  /**
   * nltk.tag.hmm.train_unsupervised — Baum-Welch EM on unlabeled sequences.
   * `options.model` seeds the EM; without it a RandomProbDist model is built
   * (python draws from the ambient `random` module — inject `options.random`
   * for determinism). Prints "iteration <i> logprob <l>" per EM round.
   */
  trainUnsupervised(
    unlabeledSequences: ReadonlyArray<UntaggedSentence>,
    options: {
      updateOutputs?: boolean;
      model?: HiddenMarkovModelTagger;
      maxIterations?: number;
      convergenceLogprob?: number;
      random?: () => number;
      out?: PrintSink;
    } = {},
  ): HiddenMarkovModelTagger {
    const updateOutputs = options.updateOutputs ?? true;
    const out = options.out ?? defaultPrintSink;
    const random = options.random ?? Math.random;

    let model = options.model;
    if (!model) {
      const priors = new RandomProbDist(this.states, random);
      const transitions = new DictionaryConditionalProbDist<string, string>(
        this.states.map((s) => [s, new RandomProbDist(this.states, random)] as const));
      const outputs = new DictionaryConditionalProbDist<string, string>(
        this.states.map((s) => [s, new RandomProbDist(this.symbols, random)] as const));
      model = new HiddenMarkovModelTagger(this.symbols, this.states, transitions, outputs, priors);
    }

    this.states = model.states;
    this.symbols = model.symbols;

    const N = this.states.length;
    const M = this.symbols.length;
    const symbolNumbers = new Map(this.symbols.map((s, i) => [s, i]));

    model.transitions = new DictionaryConditionalProbDist<string, string>(
      this.states.map((s) => [s, new MutableProbDist(model.transitions.get(s), this.states)] as const));
    if (updateOutputs) {
      model.outputs = new DictionaryConditionalProbDist<string, string>(
        this.states.map((s) => [s, new MutableProbDist(model.outputs.get(s), this.symbols)] as const));
    }

    model.resetCache();

    let converged = false;
    let lastLogprob: number | null = null;
    let iteration = 0;
    const maxIterations = options.maxIterations ?? 1000;
    const epsilon = options.convergenceLogprob ?? 1e-6;

    while (!converged && iteration < maxIterations) {
      let Anumer = ninfMatrix(N, N);
      let Bnumer = ninfMatrix(N, M);
      let Adenom = ninfVector(N);
      let Bdenom = ninfVector(N);

      let logprob = 0;
      for (const seq of unlabeledSequences) {
        const sequence = [...seq];
        if (sequence.length === 0) continue;
        const [lpk, seqAnumer, seqAdenom, seqBnumer, seqBdenom] = this.#baumWelchStep(sequence, model, symbolNumbers);

        for (let i = 0; i < N; i += 1) {
          for (let j = 0; j < N; j += 1) {
            Anumer[i]![j] = logAddExp2(Anumer[i]![j]!, seqAnumer[i]![j]! - lpk);
          }
          for (let k = 0; k < M; k += 1) {
            Bnumer[i]![k] = logAddExp2(Bnumer[i]![k]!, seqBnumer[i]![k]! - lpk);
          }
        }
        for (let i = 0; i < N; i += 1) {
          Adenom[i] = logAddExp2(Adenom[i]!, seqAdenom[i]! - lpk);
          Bdenom[i] = logAddExp2(Bdenom[i]!, seqBdenom[i]! - lpk);
        }

        logprob += lpk;
      }

      for (let i = 0; i < N; i += 1) {
        const logprobAi = Anumer[i]!.map((v) => v - Adenom[i]!);
        const logprobBi = Bnumer[i]!.map((v) => v - Bdenom[i]!);

        const normA = logSumExp2(logprobAi);
        const normB = logSumExp2(logprobBi);
        for (let j = 0; j < N; j += 1) logprobAi[j] = logprobAi[j]! - normA;
        for (let k = 0; k < M; k += 1) logprobBi[k] = logprobBi[k]! - normB;

        const si = this.states[i]!;
        const transRow = model.transitions.get(si) as MutableProbDist<string>;
        for (let j = 0; j < N; j += 1) transRow.update(this.states[j]!, logprobAi[j]!);

        if (updateOutputs) {
          const outRow = model.outputs.get(si) as MutableProbDist<string>;
          for (let k = 0; k < M; k += 1) outRow.update(this.symbols[k]!, logprobBi[k]!);
        }
      }

      if (iteration > 0 && Math.abs(logprob - lastLogprob!) < epsilon) converged = true;

      print(out, `iteration ${iteration} logprob ${pyFloatRepr(logprob)}`);
      iteration += 1;
      lastLogprob = logprob;
    }

    return model;
  }

  /** NLTK `train_unsupervised` snake_case member. */
  train_unsupervised(
    unlabeledSequences: ReadonlyArray<UntaggedSentence>,
    options?: Parameters<HiddenMarkovModelTrainer["trainUnsupervised"]>[1],
  ): HiddenMarkovModelTagger {
    return this.trainUnsupervised(unlabeledSequences, options);
  }

  /** nltk.tag.hmm._baum_welch_step — per-sequence expected counts in log space. */
  #baumWelchStep(
    sequence: UntaggedSentence,
    model: HiddenMarkovModelTagger,
    symbolToNumber: ReadonlyMap<string, number>,
  ): [number, number[][], number[], number[][], number[]] {
    const N = model.states.length;
    const M = model.symbols.length;
    const T = sequence.length;

    const alpha = model.forwardProbability(sequence);
    const beta = model.backwardProbability(sequence);
    const lpk = logSumExp2(alpha[T - 1]!);

    const Anumer = ninfMatrix(N, N);
    const Bnumer = ninfMatrix(N, M);
    const Adenom = ninfVector(N);
    const Bdenom = ninfVector(N);

    // _transitions_matrix().T: transitionsLog[j][i] = logprob(s_i | s_j)
    const transitionsLog: number[][] = model.states.map((j) =>
      model.states.map((i) => model.transitionLogProb(j, i)));

    for (let t = 0; t < T; t += 1) {
      const symbol = sequence[t]!;
      const nextSymbol = t < T - 1 ? sequence[t + 1]! : undefined;
      const xi = symbolToNumber.get(symbol)!;

      const nextOutputsLogprob = model.states.map((s) => model.emissionLogProb(s, nextSymbol as string));
      const alphaPlusBeta = alpha[t]!.map((v, i) => v + beta[t]![i]!);

      if (t < T - 1) {
        for (let j = 0; j < N; j += 1) {
          for (let i = 0; i < N; i += 1) {
            const numerAdd = transitionsLog[j]![i]! + nextOutputsLogprob[i]! + beta[t + 1]![i]! + alpha[t]![j]!;
            Anumer[j]![i] = logAddExp2(Anumer[j]![i]!, numerAdd);
          }
        }
        for (let i = 0; i < N; i += 1) {
          Adenom[i] = logAddExp2(Adenom[i]!, alphaPlusBeta[i]!);
        }
      } else {
        for (let i = 0; i < N; i += 1) {
          Bdenom[i] = logAddExp2(Adenom[i]!, alphaPlusBeta[i]!);
        }
      }

      for (let i = 0; i < N; i += 1) {
        Bnumer[i]![xi] = logAddExp2(Bnumer[i]![xi]!, alphaPlusBeta[i]!);
      }
    }

    return [lpk, Anumer, Adenom, Bnumer, Bdenom];
  }
}

export class HiddenMarkovModelTagger {
  symbols: string[];
  states: string[];
  transitions: ConditionalProbDistI<string, string>;
  outputs: ConditionalProbDistI<string, string>;
  priors: ProbDistLike<string>;

  #priorLogCache: Float32Array | null = null;
  #transitionLogCache: Float32Array[] | null = null;
  #outputLogCache: Float32Array[] | null = null;
  #transitionLogFlat: Float32Array | null = null;
  #outputLogFlat: Float32Array | null = null;
  #symbolIndex = new Map<string, number>();
  readonly #useNativeDecoding: boolean;

  constructor(
    symbols: Iterable<string>,
    states: Iterable<string>,
    transitions: ConditionalProbDistI<string, string>,
    outputs: ConditionalProbDistI<string, string>,
    priors: ProbDistLike<string>,
    options: { useNativeDecoding?: boolean } = {},
  ) {
    this.symbols = uniqueInOrder(symbols);
    this.states = uniqueInOrder(states);
    this.transitions = transitions;
    this.outputs = outputs;
    this.priors = priors;
    this.#useNativeDecoding = options.useNativeDecoding ?? true;
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

    if (this.#useNativeDecoding) {
      try {
        const path = hmmViterbiIdsNative({
          symbolIds: Uint32Array.from(symbolIds),
          stateCount: N,
          symbolCount: this.symbols.length,
          priors: P,
          transitions: this.#getTransitionLogFlat(),
          outputs: this.#getOutputLogFlat(),
        });
        return Array.from(path, (index) => this.states[index]!);
      } catch {
        // Fall back if the native kernel rejects this sequence.
      }
    }

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
    const indices = Array.from<number>({ length: T });
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
    const alpha: number[][] = Array.from({ length: T }, () => Array.from({ length: N }, () => Number.NEGATIVE_INFINITY));
    if (T === 0) return alpha;

    for (let i = 0; i < N; i += 1) {
      alpha[0]![i] = this.priors.logprob(this.states[i]!) + this.emissionLogProb(this.states[i]!, unlabeledSequence[0]!);
    }
    for (let t = 1; t < T; t += 1) {
      for (let i = 0; i < N; i += 1) {
        const incoming: number[] = Array.from<number>({ length: N });
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

  // ---- nltk.tag.api.TaggerI contract (snake_case members) ----

  tag_sents(sentences: ReadonlyArray<UntaggedSentence>): Array<Array<[string, string]>> {
    return this.tagSents(sentences);
  }
  best_path(unlabeledSequence: UntaggedSentence): string[] {
    return this.bestPath(unlabeledSequence);
  }
  log_probability(sequence: UntaggedSentence | GoldSentence): number {
    return this.logProbability(sequence);
  }
  /** Score accuracy against the gold standard (NLTK `TaggerI.accuracy`). */
  accuracy(gold: ReadonlyArray<GoldSentence>): number {
    return this.evaluate(gold);
  }
  /** ConfusionMatrix: gold tags as reference, predictions as test. */
  confusion(gold: ReadonlyArray<GoldSentence>): ConfusionMatrix {
    const taggedSents = this.tagSents(gold.map((sentence) => sentence.map(([word]) => word)));
    const goldTokens = gold.flat().map(([, t]) => t);
    const testTokens = taggedSents.flat().map(([, t]) => t);
    return new ConfusionMatrix(goldTokens, testTokens);
  }
  precision(gold: ReadonlyArray<GoldSentence>): Map<string, number> {
    const cm = this.confusion(gold);
    return new Map(cm.labels.map((tag) => [tag, cm.precision(tag)]));
  }
  recall(gold: ReadonlyArray<GoldSentence>): Map<string, number> {
    const cm = this.confusion(gold);
    return new Map(cm.labels.map((tag) => [tag, cm.recall(tag)]));
  }
  f_measure(gold: ReadonlyArray<GoldSentence>, alpha = 0.5): Map<string, number> {
    const cm = this.confusion(gold);
    return new Map(cm.labels.map((tag) => [tag, cm.f_measure(tag, alpha)]));
  }
  fMeasure(gold: ReadonlyArray<GoldSentence>, alpha = 0.5): Map<string, number> {
    return this.f_measure(gold, alpha);
  }
  evaluate_per_tag(gold: ReadonlyArray<GoldSentence>): string {
    return this.confusion(gold).evaluate();
  }
  /** nltk.tag.hmm._backward_probability — T×N log2 backward matrix. */
  backwardProbability(unlabeledSequence: UntaggedSentence): number[][] {
    const T = unlabeledSequence.length;
    const N = this.states.length;
    const beta: number[][] = Array.from({ length: T }, () => Array.from({ length: N }, () => -Infinity));
    if (T === 0) return beta;
    beta[T - 1]!.fill(0); // "1" is an arbitrarily chosen value from the Rabiner tutorial
    for (let t = T - 2; t >= 0; t -= 1) {
      const symbol = unlabeledSequence[t + 1]!;
      const outputs = this.states.map((s) => this.emissionLogProb(s, symbol));
      for (let i = 0; i < N; i += 1) {
        const summand: number[] = Array.from<number>({ length: N });
        for (let j = 0; j < N; j += 1) {
          summand[j] = this.transitionLogProb(this.states[i]!, this.states[j]!) + beta[t + 1]![j]! + outputs[j]!;
        }
        beta[t]![i] = logSumExp2(summand);
      }
    }
    return beta;
  }

  /** NLTK `_backward_probability` snake_case member. */
  backward_probability(unlabeledSequence: UntaggedSentence): number[][] {
    return this.backwardProbability(unlabeledSequence);
  }

  /** nltk.tag.hmm.entropy — posterior entropy over labellings via forward/backward DP. */
  entropy(unlabeledSequence: UntaggedSentence): number {
    const T = unlabeledSequence.length;
    const alpha = this.forwardProbability(unlabeledSequence);
    const beta = this.backwardProbability(unlabeledSequence);
    const normalisation = logSumExp2(alpha[T - 1]!);

    let entropy = normalisation;

    for (let i = 0; i < this.states.length; i += 1) {
      const p = 2 ** (alpha[0]![i]! + beta[0]![i]! - normalisation);
      entropy -= p * this.priors.logprob(this.states[i]!);
    }

    for (let t0 = 0; t0 < T - 1; t0 += 1) {
      const t1 = t0 + 1;
      for (let i0 = 0; i0 < this.states.length; i0 += 1) {
        for (let i1 = 0; i1 < this.states.length; i1 += 1) {
          const trans = this.transitionLogProb(this.states[i0]!, this.states[i1]!);
          const p = 2 ** (
            alpha[t0]![i0]! + trans
            + this.emissionLogProb(this.states[i1]!, unlabeledSequence[t1]!)
            + beta[t1]![i1]! - normalisation
          );
          entropy -= p * trans;
        }
      }
    }

    for (let t = 0; t < T; t += 1) {
      for (let i = 0; i < this.states.length; i += 1) {
        const p = 2 ** (alpha[t]![i]! + beta[t]![i]! - normalisation);
        entropy -= p * this.emissionLogProb(this.states[i]!, unlabeledSequence[t]!);
      }
    }

    return entropy;
  }

  /** nltk.tag.hmm.point_entropy — per-position posterior entropy (returns Float64Array like the np array). */
  pointEntropy(unlabeledSequence: UntaggedSentence): number[] {
    const T = unlabeledSequence.length;
    const N = this.states.length;
    const alpha = this.forwardProbability(unlabeledSequence);
    const beta = this.backwardProbability(unlabeledSequence);
    const normalisation = logSumExp2(alpha[T - 1]!);

    const entropies = Array.from<number>({ length: T }).fill(0);
    const probs = Array.from<number>({ length: N });
    for (let t = 0; t < T; t += 1) {
      for (let s = 0; s < N; s += 1) probs[s] = alpha[t]![s]! + beta[t]![s]! - normalisation;
      for (let s = 0; s < N; s += 1) entropies[t] = entropies[t]! - 2 ** (probs[s]!) * probs[s]!;
    }
    return entropies;
  }

  /** NLTK `point_entropy` snake_case member. */
  point_entropy(unlabeledSequence: UntaggedSentence): number[] {
    return this.pointEntropy(unlabeledSequence);
  }

  /** NLTK `_exhaustive_entropy` — brute-force cross-check used by nltk.tag.hmm.demo. */
  exhaustiveEntropy(unlabeledSequence: UntaggedSentence): number {
    const T = unlabeledSequence.length;
    let labellings: string[][] = this.states.map((state) => [state]);
    for (let t = 0; t < T - 1; t += 1) {
      const current = labellings;
      labellings = [];
      for (const labelling of current) {
        for (const state of this.states) labellings.push([...labelling, state]);
      }
    }

    const logProbs: number[] = [];
    for (const labelling of labellings) {
      const labeledSequence: GoldSentence = unlabeledSequence.map((token, t) => [token, labelling[t]!]);
      logProbs.push(this.logProbability(labeledSequence));
    }
    const normalisation = logAdd(...logProbs);

    let entropy = 0;
    for (let lp of logProbs) {
      lp -= normalisation;
      entropy -= 2 ** lp * lp;
    }
    return entropy;
  }

  /** NLTK `_exhaustive_point_entropy` — brute-force per-position posterior entropy. */
  exhaustivePointEntropy(unlabeledSequence: UntaggedSentence): number[] {
    const T = unlabeledSequence.length;
    const N = this.states.length;
    let labellings: string[][] = this.states.map((state) => [state]);
    for (let t = 0; t < T - 1; t += 1) {
      const current = labellings;
      labellings = [];
      for (const labelling of current) {
        for (const state of this.states) labellings.push([...labelling, state]);
      }
    }

    const logProbs: number[] = [];
    for (const labelling of labellings) {
      const labeledSequence: GoldSentence = unlabeledSequence.map((token, t) => [token, labelling[t]!]);
      logProbs.push(this.logProbability(labeledSequence));
    }
    const normalisation = logAdd(...logProbs);

    const probabilities: number[][] = Array.from({ length: T }, () => Array.from({ length: N }, () => -Infinity));
    const stateIndex = new Map(this.states.map((s, i) => [s, i]));
    labellings.forEach((labelling, k) => {
      const lp = logProbs[k]! - normalisation;
      labelling.forEach((label, t) => {
        const index = stateIndex.get(label)!;
        probabilities[t]![index] = logAdd(probabilities[t]![index]!, lp);
      });
    });

    const entropies = Array.from<number>({ length: T }).fill(0);
    for (let t = 0; t < T; t += 1) {
      for (let s = 0; s < N; s += 1) {
        entropies[t] = entropies[t]! - 2 ** (probabilities[t]![s]!) * probabilities[t]![s]!;
      }
    }
    return entropies;
  }

  /** nltk.tag.hmm._sample_probdist — inverse-CDF sample over an ordered sample list. */
  #sampleProbdist<T>(probdist: ProbDistLike<T>, p: number, samples: readonly T[]): T {
    let cumP = 0;
    for (const sample of samples) {
      const addP = probdist.prob(sample);
      if (cumP <= p && p <= cumP + addP) return sample;
      cumP += addP;
    }
    throw new Error("Invalid probability distribution - does not sum to one");
  }

  /** nltk.tag.hmm.random_sample — ancestral sample of (symbol, state) pairs; consumes rng.random() like python. */
  randomSample(rng: { random(): number }, length: number): TaggedToken[] {
    const tokens: TaggedToken[] = [];
    let state = this.#sampleProbdist(this.priors, rng.random(), this.states);
    let symbol = this.#sampleProbdist(this.outputs.get(state), rng.random(), this.symbols);
    tokens.push([symbol, state]);
    for (let i = 1; i < length; i += 1) {
      state = this.#sampleProbdist(this.transitions.get(state), rng.random(), this.states);
      symbol = this.#sampleProbdist(this.outputs.get(state), rng.random(), this.symbols);
      tokens.push([symbol, state]);
    }
    return tokens;
  }

  /** NLTK `random_sample` snake_case member. */
  random_sample(rng: { random(): number }, length: number): TaggedToken[] {
    return this.randomSample(rng, length);
  }

  /**
   * nltk.tag.hmm.test — tags each test sentence and (verbose) prints the
   * gold/untagged/tagged/entropy block per sentence, then the accuracy line.
   */
  test(testSequence: ReadonlyArray<GoldSentence>, verbose = false, out: PrintSink = defaultPrintSink): number {
    const testSents = [...testSequence];
    const predicted = testSents.map((sent) => this.tag(sent.map(([word]) => word)));

    if (verbose) {
      for (let s = 0; s < testSents.length; s += 1) {
        const testSent = testSents[s]!;
        const predictedSent = predicted[s]!;
        print(out, `Test: ${testSent.map(([t, tag]) => `${t}/${tag}`).join(" ")}`);
        print(out, "");
        print(out, `Untagged: ${testSent.map(([t]) => `${t}`).join(" ")}`);
        print(out, "");
        print(out, `HMM-tagged: ${predictedSent.map(([t, tag]) => `${t}/${tag}`).join(" ")}`);
        print(out, "");
        print(out, `Entropy: ${pyFloatRepr(this.entropy(predictedSent.map(([t]) => t)))}`);
        print(out, "");
        print(out, "-".repeat(60));
      }
    }

    let correct = 0;
    let count = 0;
    for (let s = 0; s < testSents.length; s += 1) {
      for (let i = 0; i < testSents[s]!.length; i += 1) {
        count += 1;
        if (testSents[s]![i]![1] === predicted[s]![i]![1]) correct += 1;
      }
    }
    const acc = count === 0 ? 0 : correct / count;
    print(out, `accuracy over ${count} tokens: ${(acc * 100).toFixed(2)}`);
    return acc;
  }

  evaluatePerTag(gold: ReadonlyArray<GoldSentence>): string {
    return this.evaluate_per_tag(gold);
  }

  /** nltk.tag.hmm.reset_cache — drops the lazily built log-prob caches. */
  resetCache(): void {
    this.#priorLogCache = null;
    this.#transitionLogCache = null;
    this.#outputLogCache = null;
    this.#transitionLogFlat = null;
    this.#outputLogFlat = null;
    this.#symbolIndex.clear();
  }

  /** NLTK `reset_cache` snake_case member. */
  reset_cache(): void {
    this.resetCache();
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
      this.#outputLogFlat = null;
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

  #getTransitionLogFlat(): Float32Array {
    if (this.#transitionLogFlat === null) {
      const rows = this.#getTransitionLogCache();
      const flat = new Float32Array(this.states.length * this.states.length);
      for (let index = 0; index < rows.length; index += 1) {
        flat.set(rows[index]!, index * this.states.length);
      }
      this.#transitionLogFlat = flat;
    }
    return this.#transitionLogFlat;
  }

  #getOutputLogFlat(): Float32Array {
    if (this.#outputLogFlat === null) {
      const rows = this.#getOutputLogCache();
      const flat = new Float32Array(this.states.length * this.symbols.length);
      for (let index = 0; index < rows.length; index += 1) {
        flat.set(rows[index]!, index * this.symbols.length);
      }
      this.#outputLogFlat = flat;
    }
    return this.#outputLogFlat;
  }
}

/**
 * numpy `np.sum` pairwise summation for 1-D float64 arrays: sequential under 8
 * elements, 8-accumulator unrolled blocks up to 128, recursive halving beyond.
 */
function npSum(a: readonly number[]): number {
  const n = a.length;
  if (n < 8) {
    let res = 0;
    for (let i = 0; i < n; i++) res += a[i]!;
    return res;
  }
  if (n <= 128) {
    let r0 = a[0]!, r1 = a[1]!, r2 = a[2]!, r3 = a[3]!,
      r4 = a[4]!, r5 = a[5]!, r6 = a[6]!, r7 = a[7]!;
    let i = 8;
    for (; i < n - (n % 8); i += 8) {
      r0 += a[i]!; r1 += a[i + 1]!; r2 += a[i + 2]!; r3 += a[i + 3]!;
      r4 += a[i + 4]!; r5 += a[i + 5]!; r6 += a[i + 6]!; r7 += a[i + 7]!;
    }
    let res = ((r0 + r1) + (r2 + r3)) + ((r4 + r5) + (r6 + r7));
    for (; i < n; i++) res += a[i]!;
    return res;
  }
  let n2 = Math.floor(n / 2);
  n2 -= n2 % 8;
  return npSum(a.slice(0, n2)) + npSum(a.slice(n2));
}

function logSumExp2(values: number[]): number {
  if (values.length === 0) return Number.NEGATIVE_INFINITY;
  const max = Math.max(...values);
  // numpy parity: all--inf input yields (-inf) - (-inf) = nan, not -inf.
  return Math.log2(npSum(values.map((v) => 2 ** (v - max)))) + max;
}

/**
 * Port of nltk.tag.hmm.logsumexp2 — `log2(sum(2**arr))` computed
 * stably via the max-trick (`arr.max()` on an empty array raises in
 * NLTK/numpy; here it returns -inf like numpy's `max` would not — NLTK
 * always calls it on non-empty arrays).
 */
export function logsumexp2(arr: readonly number[]): number {
  return logSumExp2([...arr]);
}

const ninfVector = (n: number): number[] => Array.from({ length: n }, () => -Infinity);
const ninfMatrix = (rows: number, cols: number): number[][] => Array.from({ length: rows }, () => ninfVector(cols));

/** numpy `np.logaddexp2` scalar — `log2(2**a + 2**b)` with -inf handling. */
function logAddExp2(a: number, b: number): number {
  if (a === -Infinity && b === -Infinity) return -Infinity;
  return a > b ? a + Math.log2(1 + 2 ** (b - a)) : b + Math.log2(1 + 2 ** (a - b));
}

/** nltk.tag.hmm._log_add — log2-sum of already-logged values via the max trick. */
export function logAdd(...values: number[]): number {
  const x = Math.max(...values);
  if (x > -Infinity) {
    let sumDiffs = 0;
    for (const value of values) sumDiffs += 2 ** (value - x);
    return x + Math.log2(sumDiffs);
  }
  return x;
}

const defaultPrintSink: PrintSink = (text) => { process.stdout.write(text); };
const print = (out: PrintSink, s: string): void => out(`${s}\n`);

/** nltk.tag.hmm.load_pos — brown news tagged sentences, lowercased + tag-normalized. */
export function loadPos(numSents: number): [GoldSentence[], string[], string[]] {
  const brown = new CategorizedTaggedCorpusReader(
    dataFind("corpora/brown"), "c[a-z]\\d\\d", "/",
    undefined, undefined, undefined, "ascii", "brown",
    { cat_file: "cats.txt" });
  const sentences = [...(brown.tagged_sents_cats(null, "news") as Iterable<GoldSentence>)].slice(0, numSents);

  const tagRe = /^([*]|--|[^+*-]+)/;
  const tagSet: string[] = [];
  const symbols: string[] = [];
  const tagSeen = new Set<string>();
  const symSeen = new Set<string>();

  const cleaned: GoldSentence[] = [];
  for (const sentence of sentences) {
    const cleanedSentence: TaggedToken[] = [];
    for (const [rawWord, rawTag] of sentence) {
      const word = rawWord.toLowerCase();
      if (!symSeen.has(word)) { symSeen.add(word); symbols.push(word); }
      const tag = tagRe.exec(rawTag)![0];
      if (!tagSeen.has(tag)) { tagSeen.add(tag); tagSet.push(tag); }
      cleanedSentence.push([word, tag]);
    }
    cleaned.push(cleanedSentence);
  }
  return [cleaned, tagSet, symbols];
}

/** NLTK `load_pos` snake_case binding. */
export { loadPos as load_pos };

/** nltk.tag.hmm._market_hmm_example — the Huang et al p.381 market model. */
export function marketHmmExample(): [HiddenMarkovModelTagger, string[], string[]] {
  const states = ["bull", "bear", "static"];
  const symbols = ["up", "down", "unchanged"];
  const A = [[0.6, 0.2, 0.2], [0.5, 0.3, 0.2], [0.4, 0.1, 0.5]];
  const B = [[0.7, 0.1, 0.2], [0.1, 0.6, 0.3], [0.3, 0.3, 0.4]];
  const pi = [0.5, 0.2, 0.3];

  const pd = (values: number[], samples: string[]) =>
    new DictionaryProbDist<string>(new Map(samples.map((s, i) => [s, values[i]!])));
  const cpd = (array: number[][], conditions: string[], samples: string[]) =>
    new DictionaryConditionalProbDist<string, string>(
      conditions.map((c, i) => [c, pd(array[i]!, samples)] as const));

  const model = new HiddenMarkovModelTagger(
    symbols, states,
    cpd(A, states, states),
    cpd(B, states, symbols),
    pd(pi, states),
  );
  return [model, states, symbols];
}

/** nltk.tag.hmm.demo — probability calculation demo over the market model. */
export function demo(out: PrintSink = defaultPrintSink): void {
  print(out, "");
  print(out, "HMM probability calculation demo");
  print(out, "");

  const [model] = marketHmmExample();
  print(out, `Testing ${model}`);

  for (const test of [
    ["up", "up"],
    ["up", "down", "up"],
    ["down", "down", "down", "down", "down"],
    ["unchanged", "unchanged", "unchanged", "unchanged", "unchanged", "up"],
  ]) {
    const sequence = test as unknown as UntaggedSentence;
    print(out, `Testing with state sequence ${pyRepr(test)}`);
    print(out, `probability = ${pyFloatRepr(model.probability(sequence))}`);
    print(out, `tagging =     ${pyRepr(model.tag(sequence).map(([w, t]) => pytuple(w, t)))}`);
    print(out, `p(tagged) =   ${pyFloatRepr(model.probability(sequence))}`);
    print(out, `H =           ${pyFloatRepr(model.entropy(sequence))}`);
    print(out, `H_exh =       ${pyFloatRepr(model.exhaustiveEntropy(sequence))}`);
    print(out, `H(point) =    ${ndarray(model.pointEntropy(sequence))}`);
    print(out, `H_exh(point)= ${ndarray(model.exhaustivePointEntropy(sequence))}`);
    print(out, "");
  }
}

/** nltk.tag.hmm.demo_pos — supervised POS tagging demo over brown news. */
export function demo_pos(out: PrintSink = defaultPrintSink): void {
  print(out, "");
  print(out, "HMM POS tagging demo");
  print(out, "");

  print(out, "Training HMM...");
  const [labelledSequences, tagSet, symbols] = loadPos(20000);
  const trainer = new HiddenMarkovModelTrainer(tagSet, symbols);
  const hmm = trainer.train_supervised(labelledSequences.slice(10), {
    estimator: (fd, bins) => new LidstoneProbDist(fd, 0.1, bins),
  });

  print(out, "Testing...");
  hmm.test(labelledSequences.slice(0, 10), true, out);
}

/** NLTK `demo_pos` camelCase binding. */
export { demo_pos as demoPos };

/** nltk.tag.hmm.demo_bw — Baum-Welch EM on random samples from the market model. */
export function demo_bw(out: PrintSink = defaultPrintSink): void {
  print(out, "");
  print(out, "Baum-Welch demo for market example");
  print(out, "");

  const [model, states, symbols] = marketHmmExample();

  const rng = new PyRandom(0);
  const training: UntaggedSentence[] = [];
  for (let i = 0; i < 10; i += 1) {
    const item = model.randomSample(rng, 5);
    training.push(item.map(([w]) => w));
  }

  const trainer = new HiddenMarkovModelTrainer(states, symbols);
  trainer.train_unsupervised(training, { model, maxIterations: 1000, out });
}

/** NLTK `demo_bw` camelCase binding. */
export { demo_bw as demoBw };

/** nltk.tag.hmm.demo_pos_bw — supervised + unsupervised HMM over brown news. */
export function demo_pos_bw(
  test = 10,
  supervised = 20,
  unsupervised = 10,
  verbose = true,
  maxIterations = 5,
  out: PrintSink = defaultPrintSink,
): void {
  print(out, "");
  print(out, "Baum-Welch demo for POS tagging");
  print(out, "");

  print(out, `Training HMM (supervised, ${supervised} sentences)...`);

  const [sentences, tagSet] = loadPos(test + supervised + unsupervised);

  const symbols: string[] = [];
  const seen = new Set<string>();
  for (const sentence of sentences) {
    for (const [token] of sentence) {
      if (!seen.has(token)) { seen.add(token); symbols.push(token); }
    }
  }

  const trainer = new HiddenMarkovModelTrainer(tagSet, symbols);
  let hmm = trainer.train_supervised(
    sentences.slice(test, test + supervised),
    { estimator: (fd, bins) => new LidstoneProbDist(fd, 0.1, bins) },
  );

  hmm.test(sentences.slice(0, test), verbose, out);

  print(out, `Training (unsupervised, ${unsupervised} sentences)...`);
  const unlabeled = untagSents(sentences.slice(test + supervised));
  hmm = trainer.train_unsupervised(unlabeled, { model: hmm, maxIterations, out });
  hmm.test(sentences.slice(0, test), verbose, out);
}

/** NLTK `demo_pos_bw` camelCase binding. */
export { demo_pos_bw as demoPosBw };
