/**
 * TnT — Trigrams'n'Tags statistical POS tagger (port of nltk.tag.tnt).
 *
 * Second-order HMM per Brants (2000): deleted-interpolation transition
 * smoothing over tag unigram/bigram/trigram tiers, suffix-model unknown
 * words with successive abstraction + Bayesian inversion, beam-pruned
 * Viterbi decoding over (prev1, current) state pairs.
 */

const _BOS_TAG = "<s>";
const _EOS_TAG = "</s>";
type State = [tag: string, cap: boolean];
const BOS: State = [_BOS_TAG, false];
const EOS: State = [_EOS_TAG, false];

const _LOG_FLOOR_2 = -1000; // log2 floor for zero probabilities

function safeLog2(p: number): number {
  return p > 1e-300 ? Math.log2(p) : _LOG_FLOOR_2;
}

function safeInverse(n: number): number {
  return n ? 1.0 / n : 0.0;
}

/** FreqDist over states. */
class StateFreq {
  private m = new Map<string, { state: State; count: number }>();
  bump(state: State, by = 1): void {
    const k = stateKey(state);
    const cur = this.m.get(k);
    if (cur) cur.count += by;
    else this.m.set(k, { state, count: by });
  }
  get(state: State): number {
    return this.m.get(stateKey(state))?.count ?? 0;
  }
  N(): number {
    let n = 0;
    for (const v of this.m.values()) n += v.count;
    return n;
  }
  entries(): Array<{ state: State; count: number }> {
    return [...this.m.values()].sort((a, b) => stateKey(a.state).localeCompare(stateKey(b.state)));
  }
}

/** ConditionalFreqDist keyed by a string context. */
class CondFreq {
  private m = new Map<string, Map<string, number>>();
  private states = new Map<string, State>();

  bump(context: string, state: State, by = 1): void {
    this.states.set(stateKey(state), state);
    let dist = this.m.get(context);
    if (!dist) {
      dist = new Map();
      this.m.set(context, dist);
    }
    dist.set(stateKey(state), (dist.get(stateKey(state)) ?? 0) + by);
  }
  get(context: string, state: State): number {
    return this.m.get(context)?.get(stateKey(state)) ?? 0;
  }
  dist(context: string): Map<string, number> | undefined {
    return this.m.get(context);
  }
  N(context: string): number {
    const d = this.m.get(context);
    if (!d) return 0;
    let n = 0;
    for (const v of d.values()) n += v;
    return n;
  }
  conditions(): string[] {
    return [...this.m.keys()].sort();
  }
  items(context: string): Array<[State, number]> {
    const d = this.m.get(context);
    if (!d) return [];
    return [...d.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, c]) => [this.states.get(k)!, c] as [State, number]);
  }
}

function stateKey(s: State): string {
  return `${s[0]}\x1f${s[1] ? "1" : "0"}`;
}

export interface TntOptions {
  /** Beam threshold N (Brants default 1000). */
  N?: number;
  /** Include capitalization in the tag state. */
  C?: boolean;
  /** External unknown-word tagger; overrides the built-in suffix model. */
  unk?: { tag(tokens: string[]): Array<[string, string]>; train(data: unknown): void };
}

interface CandidateTagsEntry {
  state: State;
  logEmit: number;
  unigramLogp: number;
}

export class TnT {
  private readonly beamThreshold: number;
  private readonly useCap: boolean;
  private readonly unk?: TntOptions["unk"];
  private unkTrained = false;

  known = 0;
  unknown = 0;

  private tagUnigrams = new StateFreq();
  private tagBigrams = new CondFreq();
  private tagTrigrams = new CondFreq();
  private wordTagFreqs = new Map<string, Map<string, number>>();

  private lambda1 = 0;
  private lambda2 = 0;
  private lambda3 = 0;
  private numTagTokens = 0;

  private transLogpUnigram = new Map<string, number>();
  private transLogpBigram = new Map<string, Map<string, number>>();
  private transLogpTrigram = new Map<string, Map<string, number>>();

  private tagPriorProbs = new Map<string, number>();
  private theta = 0;
  private suffixTrieByCap: Record<"true" | "false", Map<string, Map<string, number>>> = {
    false: new Map(),
    true: new Map(),
  };

  private candidateTagsCache = new Map<string, CandidateTagsEntry[]>();

  constructor(options: TntOptions = {}) {
    this.beamThreshold = options.N ?? 1000;
    this.useCap = options.C ?? false;
    this.unk = options.unk;
  }

  /** Train on tagged sentences [[word, tag], ...]. Rebuilds the model from scratch. */
  train(data: Array<Array<[string, string]>>): void {
    this.candidateTagsCache.clear();
    this.tagUnigrams = new StateFreq();
    this.tagBigrams = new CondFreq();
    this.tagTrigrams = new CondFreq();
    this.wordTagFreqs = new Map();

    if (this.unk && !this.unkTrained) this.unk.train(data);

    for (const sent of data) {
      let sm2 = BOS;
      let sm1 = BOS;
      let hasTokens = false;

      for (const [word, tag] of sent) {
        hasTokens = true;
        const ci = this.useCap && word.length > 0 && word[0]! >= "A" && word[0]! <= "Z";
        const si: State = [tag, ci];

        let wt = this.wordTagFreqs.get(word);
        if (!wt) {
          wt = new Map();
          this.wordTagFreqs.set(word, wt);
        }
        wt.set(tag, (wt.get(tag) ?? 0) + 1);

        this.tagUnigrams.bump(si);
        this.tagBigrams.bump(stateKey(sm1), si);
        this.tagTrigrams.bump(`${stateKey(sm2)}\x1e${stateKey(sm1)}`, si);

        sm2 = sm1;
        sm1 = si;
      }

      if (hasTokens) {
        this.tagUnigrams.bump(EOS);
        this.tagBigrams.bump(stateKey(sm1), EOS);
        this.tagTrigrams.bump(`${stateKey(sm2)}\x1e${stateKey(sm1)}`, EOS);
      }
    }

    this.computeLambda();

    this.numTagTokens = this.tagUnigrams.N();
    this.log2BeamThreshold = Math.log2(this.beamThreshold);

    this.buildTransitionLogpCache();
    this.buildSuffixModel();

    this.unkTrained = true;
  }

  private log2BeamThreshold = 10;

  private computeLambda(): void {
    const unigramNMinus1 = this.tagUnigrams.N() - 1;
    let l1mass = 0.0;
    let l2mass = 0.0;
    let l3mass = 0.0;

    for (const ctx of this.tagTrigrams.conditions()) {
      // ctx = key(sm2) \x1e key(sm1)
      const sep = ctx.indexOf("\x1e");
      const kSm1 = ctx.slice(sep + 1);
      const trigramNMinus1 = this.tagTrigrams.N(ctx) - 1;
      const bigramNMinus1 = this.tagBigrams.N(kSm1) - 1;

      for (const [si, count] of this.tagTrigrams.items(ctx)) {
        const c1 = unigramNMinus1 ? (this.tagUnigrams.get(si) - 1) / unigramNMinus1 : 0.0;
        const c2 = bigramNMinus1 ? (this.tagBigrams.get(kSm1, si) - 1) / bigramNMinus1 : 0.0;
        const c3 = trigramNMinus1 ? (count - 1) / trigramNMinus1 : 0.0;

        const maxc = Math.max(c1, c2, c3);
        const w1 = c1 === maxc ? 1 : 0;
        const w2 = c2 === maxc ? 1 : 0;
        const w3 = c3 === maxc ? 1 : 0;
        const share = count / (w1 + w2 + w3);

        if (w1) l1mass += share;
        if (w2) l2mass += share;
        if (w3) l3mass += share;
      }
    }

    const totalMass = l1mass + l2mass + l3mass;
    if (totalMass > 0) {
      this.lambda1 = l1mass / totalMass;
      this.lambda2 = l2mass / totalMass;
      this.lambda3 = l3mass / totalMass;
    } else {
      this.lambda1 = 0;
      this.lambda2 = 0;
      this.lambda3 = 0;
    }
  }

  private buildTransitionLogpCache(): void {
    const invTotalN = safeInverse(this.numTagTokens);

    const unigramPart = new Map<string, number>();
    const unigramLogpPart = new Map<string, number>();
    for (const { state, count } of this.tagUnigrams.entries()) {
      const p = this.lambda1 * (count * invTotalN);
      unigramPart.set(stateKey(state), p);
      unigramLogpPart.set(stateKey(state), safeLog2(p));
    }
    this.transLogpUnigram = unigramLogpPart;

    const bigramLogp = new Map<string, Map<string, number>>();
    for (const prev1 of this.tagBigrams.conditions()) {
      const invBigramN = safeInverse(this.tagBigrams.N(prev1));
      const inner = new Map<string, number>();
      for (const [current, count] of this.tagBigrams.items(prev1)) {
        const p =
          (unigramPart.get(stateKey(current)) ?? 0.0) +
          this.lambda2 * count * invBigramN;
        inner.set(stateKey(current), safeLog2(p));
      }
      bigramLogp.set(prev1, inner);
    }
    this.transLogpBigram = bigramLogp;

    const trigramLogp = new Map<string, Map<string, number>>();
    for (const prevPair of this.tagTrigrams.conditions()) {
      const sep = prevPair.indexOf("\x1e");
      const kSm1 = prevPair.slice(sep + 1);
      const invTrigramN = safeInverse(this.tagTrigrams.N(prevPair));
      const invBigramN = safeInverse(this.tagBigrams.N(kSm1));

      const inner = new Map<string, number>();
      for (const [current, count] of this.tagTrigrams.items(prevPair)) {
        const p =
          (unigramPart.get(stateKey(current)) ?? 0.0) +
          this.lambda2 * this.tagBigrams.get(kSm1, current) * invBigramN +
          this.lambda3 * count * invTrigramN;
        inner.set(stateKey(current), safeLog2(p));
      }
      trigramLogp.set(prevPair, inner);
    }
    this.transLogpTrigram = trigramLogp;
  }

  private buildSuffixModel(): void {
    const tagCounts = new Map<string, number>();
    for (const { state, count } of this.tagUnigrams.entries()) {
      if (state[0] === _EOS_TAG) continue;
      tagCounts.set(state[0], (tagCounts.get(state[0]) ?? 0) + count);
    }

    const total = [...tagCounts.values()].reduce((a, b) => a + b, 0);
    this.tagPriorProbs = new Map();
    if (total > 0) {
      for (const [tag, count] of tagCounts) this.tagPriorProbs.set(tag, count / total);
    }

    const priors = [...this.tagPriorProbs.values()];
    let theta = 0.0;
    if (priors.length > 1) {
      const mean = priors.reduce((a, b) => a + b, 0) / priors.length;
      theta = Math.sqrt(priors.reduce((a, b) => a + (b - mean) ** 2, 0) / (priors.length - 1));
    }
    this.theta = theta;

    const tries: Record<"true" | "false", Map<string, Map<string, number>>> = {
      false: new Map(),
      true: new Map(),
    };

    const sortedWords = [...this.wordTagFreqs.keys()].sort();
    for (const word of sortedWords) {
      const tagFreqs = this.wordTagFreqs.get(word)!;
      let freqN = 0;
      for (const v of tagFreqs.values()) freqN += v;
      if (!word || freqN > 10) continue;

      const trie = tries[word[0]! >= "A" && word[0]! <= "Z" ? "true" : "false"];
      const maxSuffixLen = Math.min(word.length, 10);

      for (let m = 1; m <= maxSuffixLen; m++) {
        const suf = word.slice(word.length - m);
        let dist = trie.get(suf);
        if (!dist) {
          dist = new Map();
          trie.set(suf, dist);
        }
        for (const [tag, count] of [...tagFreqs.entries()].sort(([a], [b]) => a.localeCompare(b))) {
          dist.set(tag, (dist.get(tag) ?? 0) + count);
        }
      }
    }

    this.suffixTrieByCap = tries;
  }

  /** Brants's suffix-model scores for an unseen word (Bayes-inverted). */
  unknownTagScores(word: string): Map<string, number> {
    const tagPriors = this.tagPriorProbs;
    if (tagPriors.size === 0) return new Map();

    const isCap = word.length > 0 && word[0]! >= "A" && word[0]! <= "Z";
    const trie = this.suffixTrieByCap[isCap ? "true" : "false"];
    const maxSuffixLen = Math.min(word.length, 10);

    let longest = 0;
    for (let m = maxSuffixLen; m > 0; m--) {
      if (trie.has(word.slice(word.length - m))) {
        longest = m;
        break;
      }
    }

    if (longest === 0) {
      const out = new Map<string, number>();
      for (const [tag, prior] of tagPriors) if (prior > 0) out.set(tag, 1.0);
      return out;
    }

    const theta = this.theta;

    if (theta === 0.0) {
      const dist = trie.get(word.slice(word.length - longest))!;
      let n = 0;
      for (const v of dist.values()) n += v;
      const invSuffixN = 1.0 / n;
      const out = new Map<string, number>();
      for (const [tag, count] of dist) {
        const prior = tagPriors.get(tag) ?? 0;
        if (prior > 0) out.set(tag, (count * invSuffixN) / prior);
      }
      return out;
    }

    const denom = 1.0 + theta;
    const missScale = theta / denom;
    let globalScale = 1.0;
    const deltaMap = new Map<string, number>();

    for (let i = 1; i <= longest; i++) {
      const dist = trie.get(word.slice(word.length - i))!;
      let n = 0;
      for (const v of dist.values()) n += v;
      const invSuffixN = 1.0 / n;

      globalScale *= missScale;
      const corrScale = invSuffixN / (denom * globalScale);

      for (const [tag, count] of dist) {
        deltaMap.set(tag, (deltaMap.get(tag) ?? 0.0) + count * corrScale);
      }
    }

    const result = new Map<string, number>();
    for (const [tag, prior] of tagPriors) {
      if (prior <= 0) continue;
      const extra = deltaMap.get(tag);
      result.set(tag, extra === undefined ? globalScale : globalScale * (1.0 + extra / prior));
    }
    return result;
  }

  /**
   * Tag one tokenized sentence.
   */
  tag(tokens: string[]): Array<[string, string]> {
    const sent = [...tokens];
    if (sent.length === 0) return [];
    const states = this.tagWord(sent);
    return sent.map((w, i) => [w, states[i + 2]![0]] as [string, string]);
  }

  /** Tag a list of sentences. */
  tagdata(data: string[][]): Array<Array<[string, string]>> {
    return data.map((sent) => this.tag(sent));
  }

  private tagWord(sent: string[]): State[] {
    if (sent.length === 0) return [BOS, BOS];

    const T = sent.length;
    let states = new Map<string, [logp: number, backpointerTagKey: string]>();
    states.set(`${stateKey(BOS)}\x1e${stateKey(BOS)}`, [0.0, stateKey(BOS)]);
    const stateHistory: Array<Map<string, [number, string]>> = [states];

    for (const word of sent) {
      const ci = this.useCap && word.length > 0 && word[0]! >= "A" && word[0]! <= "Z";
      const tagFreqs = this.wordTagFreqs.get(word);

      if (tagFreqs !== undefined) this.known += 1;
      else this.unknown += 1;

      let candidateTags: CandidateTagsEntry[];

      if (tagFreqs === undefined && this.unk !== undefined) {
        const unkOut = this.unk.tag([word]);
        if (unkOut.length !== 1) throw new Error(`unk tagger returned ${unkOut.length} tags for 1 word`);
        const [, tag] = unkOut[0]!;
        const si: State = [tag, ci];
        const unigramLogp = this.transLogpUnigram.get(stateKey(si)) ?? _LOG_FLOOR_2;
        candidateTags = [{ state: si, logEmit: 0.0, unigramLogp }];
      } else {
        const cacheKey = `${word}\x1f${ci ? "1" : "0"}`;
        const cached = this.candidateTagsCache.get(cacheKey);
        if (cached !== undefined) {
          candidateTags = cached;
        } else if (tagFreqs !== undefined) {
          const entries: CandidateTagsEntry[] = [];
          for (const [tag, tagCount] of [...tagFreqs.entries()].sort(([a], [b]) => a.localeCompare(b))) {
            const si: State = [tag, ci];
            const unigramCount = this.tagUnigrams.get(si);
            const unigramLogp = this.transLogpUnigram.get(stateKey(si)) ?? _LOG_FLOOR_2;
            entries.push({ state: si, logEmit: Math.log2(tagCount / unigramCount), unigramLogp });
          }
          candidateTags = entries;
        } else {
          const suffixScores = this.unknownTagScores(word);
          if (suffixScores.size === 0) {
            const si: State = ["Unk", ci];
            const unigramLogp = this.transLogpUnigram.get(stateKey(si)) ?? _LOG_FLOOR_2;
            candidateTags = [{ state: si, logEmit: 0.0, unigramLogp }];
          } else {
            candidateTags = [...suffixScores.entries()].map(([tag, score]) => ({
              state: [tag, ci] as State,
              logEmit: safeLog2(score),
              unigramLogp: this.transLogpUnigram.get(stateKey([tag, ci])) ?? _LOG_FLOOR_2,
            }));
          }
        }
        this.candidateTagsCache.set(cacheKey, candidateTags);
      }

      const [newStates, bestLogp] = this.expandStates(states, candidateTags);
      const cutoff = bestLogp - this.log2BeamThreshold;
      states = new Map([...newStates].filter(([, v]) => v[0] >= cutoff));
      stateHistory.push(states);
    }

    // Explicit EOS scoring with raw-probability interpolation
    const pEosUnigram = this.numTagTokens ? this.tagUnigrams.get(EOS) / this.numTagTokens : 0.0;

    let bestFinalKey = "";
    let bestFinalLogp = Number.NEGATIVE_INFINITY;
    for (const [key, [prefixLogp]] of states) {
      const sep = key.indexOf("\x1e");
      const kSm1 = key.slice(sep + 1);

      const bigramDist = this.tagBigrams.dist(kSm1);
      let pEosBigram = 0.0;
      if (bigramDist) {
        let bn = 0;
        for (const v of bigramDist.values()) bn += v;
        pEosBigram = bn ? (bigramDist.get(stateKey(EOS)) ?? 0) / bn : 0.0;
      }

      const trigramDist = this.tagTrigrams.dist(key);
      let pEosTrigram = 0.0;
      if (trigramDist) {
        let tn = 0;
        for (const v of trigramDist.values()) tn += v;
        pEosTrigram = tn ? (trigramDist.get(stateKey(EOS)) ?? 0) / tn : 0.0;
      }

      const pEosGivenHistory = this.lambda1 * pEosUnigram + this.lambda2 * pEosBigram + this.lambda3 * pEosTrigram;
      const finalLogp = prefixLogp + safeLog2(pEosGivenHistory);
      if (finalLogp > bestFinalLogp) {
        bestFinalLogp = finalLogp;
        bestFinalKey = key;
      }
    }

    if (!bestFinalKey) return [BOS, BOS];

    const _sep = bestFinalKey.indexOf("\x1e");
    const parts = bestFinalKey.split("\x1e");
    const kSm2 = parts[0]!;
    const kSm1 = parts[1]!;

    const statesReversed: string[] = [kSm1];
    if (T >= 2) statesReversed.push(kSm2);

    let currentKey = bestFinalKey;
    for (let level = T; level > 2; level--) {
      const bp = stateHistory[level]!.get(currentKey)![1]!;
      statesReversed.push(bp);
      const bpParts = bp.split("\x1e");
      void kSm2;
      currentKey = `${bp}\x1e${currentKey.split("\x1e")[0]}`;
      void bpParts;
    }

    statesReversed.reverse();
    const decoded = [BOS, BOS, ...statesReversed.map(unwrapState)];
    return decoded;
  }

  private expandStates(
    states: Map<string, [number, string]>,
    candidateTags: CandidateTagsEntry[],
  ): [Map<string, [number, string]>, number] {
    const newStates = new Map<string, [number, string]>();
    let bestLogp = Number.NEGATIVE_INFINITY;

    for (const [predKey, [prefixLogp]] of states) {
      const sepIdx = predKey.indexOf("\x1e");
      const kSm2 = predKey.slice(0, sepIdx);
      const kSm1 = predKey.slice(sepIdx + 1);

      const trigramLogp = this.transLogpTrigram.get(predKey);
      const bigramLogp = this.transLogpBigram.get(kSm1);

      for (const cand of candidateTags) {
        const sk = stateKey(cand.state);
        let transLogp = trigramLogp?.get(sk);
        if (transLogp === undefined) transLogp = bigramLogp?.get(sk);
        if (transLogp === undefined) transLogp = cand.unigramLogp;

        const pathLogp = prefixLogp + (transLogp + cand.logEmit);
        const nextState = `${kSm1}\x1e${sk}`;

        const prevBest = newStates.get(nextState);
        if (prevBest === undefined || pathLogp > prevBest[0]) {
          newStates.set(nextState, [pathLogp, kSm2]);
          if (pathLogp > bestLogp) bestLogp = pathLogp;
        }
      }
    }
    return [newStates, bestLogp];
  }
}

function unwrapState(key: string): State {
  const parts = key.split("\x1e");
  const last = parts.length > 1 ? parts[parts.length - 1]! : key;
  const tab = last.lastIndexOf("\x1f");
  return [last.slice(0, tab), last.slice(tab + 1) === "1"] as State;
}
