import { evaluateLanguageModelIdsNative, type NativeLmModelType } from "./native";

export type LanguageModelType =
  | "mle"
  | "lidstone"
  | "kneser_ney_interpolated"
  | "stupid_backoff"
  | "witten_bell_interpolated"
  | "absolute_discounting_interpolated";

const NATIVE_LM_MODELS: ReadonlySet<LanguageModelType> = new Set([
  "mle",
  "lidstone",
  "kneser_ney_interpolated",
]);

export type NgramLanguageModelOptions = {
  order: number;
  model?: LanguageModelType;
  gamma?: number;
  discount?: number;
  alpha?: number;
  padLeft?: boolean;
  padRight?: boolean;
  startToken?: string;
  endToken?: string;
};

function key(tokens: string[]): string {
  return JSON.stringify(tokens);
}

function tail(tokens: string[], size: number): string[] {
  if (size <= 0) return [];
  if (tokens.length <= size) return [...tokens];
  return tokens.slice(tokens.length - size);
}

function safeProb(p: number): number {
  if (!Number.isFinite(p) || p <= 0) return 1e-12;
  return p;
}

function increment(map: Map<string, number>, k: string): void {
  map.set(k, (map.get(k) ?? 0) + 1);
}

function addToSetMap(map: Map<string, Set<string>>, k: string, value: string): void {
  const bucket = map.get(k) ?? new Set<string>();
  bucket.add(value);
  map.set(k, bucket);
}

export type LmProbe = {
  word: string;
  context?: string[];
};

type NativePrepared = {
  tokenToId: Map<string, number>;
  unknownId: number;
  tokenIds: Uint32Array;
  sentenceOffsets: Uint32Array;
  prefixTokenIds: Uint32Array;
};

export class NgramLanguageModel {
  readonly order: number;
  readonly model: LanguageModelType;
  readonly gamma: number;
  readonly discount: number;
  readonly alpha: number;
  readonly padLeft: boolean;
  readonly padRight: boolean;
  readonly startToken: string;
  readonly endToken: string;
  readonly vocabulary: string[];

  private readonly countsByOrder: Array<Map<string, number>>;
  private readonly followersByContext: Array<Map<string, Set<string>>>;
  private readonly contextTotals: Array<Map<string, number>>;
  private readonly continuationCounts: Array<Map<string, number>>;
  private readonly continuationTotals: Array<Map<string, number>>;
  private readonly unigramTotal: number;
  private readonly nativePrepared: NativePrepared | null;

  constructor(sentences: string[][], options: NgramLanguageModelOptions) {
    if (!Number.isInteger(options.order) || options.order <= 0) {
      throw new Error("order must be a positive integer");
    }
    this.order = options.order;
    this.model = options.model ?? "mle";
    this.gamma = options.gamma ?? 0.1;
    this.discount = options.discount ?? 0.75;
    this.alpha = options.alpha ?? 0.4;
    this.padLeft = options.padLeft ?? true;
    this.padRight = options.padRight ?? true;
    this.startToken = options.startToken ?? "<s>";
    this.endToken = options.endToken ?? "</s>";

    this.countsByOrder = Array.from({ length: this.order + 1 }, () => new Map<string, number>());
    this.followersByContext = Array.from({ length: this.order + 1 }, () => new Map<string, Set<string>>());
    this.contextTotals = Array.from({ length: this.order + 1 }, () => new Map<string, number>());
    this.continuationCounts = Array.from({ length: this.order + 1 }, () => new Map<string, number>());
    this.continuationTotals = Array.from({ length: this.order + 1 }, () => new Map<string, number>());

    const vocab = new Set<string>();
    const prepared = this.prepareSentences(sentences);
    for (const row of prepared) {
      for (const tok of row) vocab.add(tok);
      for (let n = 1; n <= this.order; n += 1) {
        if (row.length < n) continue;
        for (let i = 0; i <= row.length - n; i += 1) {
          const gram = row.slice(i, i + n);
          const firstOccurrence = !this.countsByOrder[n]!.has(key(gram));
          increment(this.countsByOrder[n]!, key(gram));

          if (n >= 2) {
            const context = gram.slice(0, n - 1);
            const predicted = gram[n - 1]!;
            addToSetMap(this.followersByContext[n]!, key(context), predicted);
            increment(this.contextTotals[n]!, key(context));
            if (firstOccurrence) {
              increment(this.continuationCounts[n - 1]!, key(gram.slice(1)));
              increment(this.continuationTotals[n - 1]!, key(gram.slice(1, -1)));
            }
          }
        }
      }
    }

    vocab.add("<UNK>");
    this.vocabulary = [...vocab].sort();
    this.unigramTotal = [...this.countsByOrder[1]!.values()].reduce((acc, count) => acc + count, 0);
    this.nativePrepared = this.order <= 3 ? this.prepareNative(prepared) : null;
  }

  private prepareSentences(sentences: string[][]): string[][] {
    const out: string[][] = [];
    const leftPad = this.padLeft
      ? Array.from({ length: Math.max(0, this.order - 1) }, () => this.startToken)
      : [];
    for (const sentence of sentences) {
      const row = [...leftPad, ...sentence.map((token) => token.toLowerCase())];
      if (this.padRight)
        row.push(...Array.from({ length: Math.max(0, this.order - 1) }, () => this.endToken));
      out.push(row);
    }
    return out;
  }

  private backoffContext(context: string[]): string[] {
    return tail(context, this.order - 1);
  }

  private prepareNative(preparedSentences: string[][]): NativePrepared {
    const tokenToId = new Map<string, number>();
    for (const token of this.vocabulary) {
      tokenToId.set(token, tokenToId.size);
    }
    if (!tokenToId.has(this.startToken)) tokenToId.set(this.startToken, tokenToId.size);
    if (!tokenToId.has(this.endToken)) tokenToId.set(this.endToken, tokenToId.size);
    const unknownId = tokenToId.get("<UNK>")!;

    const flat: number[] = [];
    const offsets: number[] = [0];
    for (const sentence of preparedSentences) {
      for (const token of sentence) {
        const id = tokenToId.get(token) ?? unknownId;
        flat.push(id);
      }
      offsets.push(flat.length);
    }

    const prefix = this.padLeft
      ? Array.from({ length: Math.max(0, this.order - 1) }, () => tokenToId.get(this.startToken) ?? unknownId)
      : [];

    return {
      tokenToId,
      unknownId,
      tokenIds: Uint32Array.from(flat),
      sentenceOffsets: Uint32Array.from(offsets),
      prefixTokenIds: Uint32Array.from(prefix),
    };
  }

  private normalizeToken(token: string): string {
    return token === this.startToken || token === this.endToken ? token : token.toLowerCase();
  }

  private encodeToken(token: string): number {
    if (!this.nativePrepared) return 0;
    return this.nativePrepared.tokenToId.get(this.normalizeToken(token)) ?? this.nativePrepared.unknownId;
  }

  private mleScore(word: string, context: string[]): number {
    const ctx = this.backoffContext(context);
    if (ctx.length === 0) {
      const count = this.countsByOrder[1]!.get(key([word])) ?? 0;
      if (this.unigramTotal === 0) return 0;
      return count / this.unigramTotal;
    }

    const n = ctx.length + 1;
    const gramCount = this.countsByOrder[n]!.get(key([...ctx, word])) ?? 0;
    const ctxCount = this.contextTotals[n]?.get(key(ctx)) ?? 0;
    if (ctxCount === 0) return 0;
    return gramCount / ctxCount;
  }

  private lidstoneScore(word: string, context: string[]): number {
    const ctx = this.backoffContext(context);
    const vocabSize = Math.max(1, this.vocabulary.length);
    if (ctx.length === 0) {
      const count = this.countsByOrder[1]!.get(key([word])) ?? 0;
      return (count + this.gamma) / (this.unigramTotal + this.gamma * vocabSize);
    }

    const n = ctx.length + 1;
    const gramCount = this.countsByOrder[n]!.get(key([...ctx, word])) ?? 0;
    const ctxCount = this.contextTotals[n]?.get(key(ctx)) ?? 0;
    return (gramCount + this.gamma) / (ctxCount + this.gamma * vocabSize);
  }

  private kneserNeyScore(word: string, context: string[]): number {
    const ctx = this.backoffContext(context);
    if (ctx.length === 0) {
      const total = this.continuationTotals[1]?.get(key([])) ?? 0;
      return total ? (this.continuationCounts[1]!.get(key([word])) ?? 0) / total : 0;
    }
    const n = ctx.length + 1;
    const contextKey = key(ctx);
    const rawTotal = this.contextTotals[n]!.get(contextKey) ?? 0;
    if (rawTotal === 0) return this.kneserNeyScore(word, ctx.slice(1));
    const total = n === this.order ? rawTotal : (this.continuationTotals[n]!.get(contextKey) ?? 0);
    if (total === 0) return this.kneserNeyScore(word, ctx.slice(1));
    const count =
      (n === this.order ? this.countsByOrder[n]! : this.continuationCounts[n]!).get(key([...ctx, word])) ?? 0;
    const followers = this.followersByContext[n]!.get(contextKey)?.size ?? 0;
    return (
      Math.max(count - this.discount, 0) / total +
      ((this.discount * followers) / total) * this.kneserNeyScore(word, ctx.slice(1))
    );
  }

  private unigramFreq(word: string): number {
    if (this.unigramTotal === 0) return 0;
    return (this.countsByOrder[1]!.get(key([word])) ?? 0) / this.unigramTotal;
  }

  // Mirrors nltk.lm.models.StupidBackoff.unmasked_score. Scores are backoff
  // weights, not a true probability distribution (n-gram scores of the same
  // order do not sum to unity), so perplexity over these scores is only a
  // pseudo-perplexity — it matches the python baseline's clamped computation,
  // not an information-theoretic quantity.
  private stupidBackoffScore(word: string, context: string[]): number {
    const ctx = this.backoffContext(context);
    if (ctx.length === 0) return this.unigramFreq(word);

    const n = ctx.length + 1;
    const gramCount = this.countsByOrder[n]!.get(key([...ctx, word])) ?? 0;
    if (gramCount > 0) {
      const ctxCount = this.contextTotals[n]?.get(key(ctx)) ?? 0;
      return gramCount / ctxCount;
    }
    return this.alpha * this.stupidBackoffScore(word, ctx.slice(1));
  }

  // Mirrors nltk.lm.smoothing.WittenBell via InterpolatedLanguageModel:
  // alpha = (1 - gamma) * P_MLE(w|ctx), gamma = n_plus / (n_plus + N(ctx)).
  private wittenBellScore(word: string, context: string[]): number {
    const ctx = this.backoffContext(context);
    if (ctx.length === 0) return this.unigramFreq(word);

    const n = ctx.length + 1;
    const contextKey = key(ctx);
    const ctxCount = this.contextTotals[n]?.get(contextKey) ?? 0;
    if (ctxCount === 0) return this.wittenBellScore(word, ctx.slice(1));

    const gramCount = this.countsByOrder[n]!.get(key([...ctx, word])) ?? 0;
    const nPlus = this.followersByContext[n]!.get(contextKey)?.size ?? 0;
    const gamma = nPlus / (nPlus + ctxCount);
    const alpha = (1 - gamma) * (gramCount / ctxCount);
    return alpha + gamma * this.wittenBellScore(word, ctx.slice(1));
  }

  // Mirrors nltk.lm.smoothing.AbsoluteDiscounting via InterpolatedLanguageModel:
  // alpha = max(count - discount, 0) / N(ctx), gamma = discount * n_plus / N(ctx).
  private absoluteDiscountingScore(word: string, context: string[]): number {
    const ctx = this.backoffContext(context);
    if (ctx.length === 0) return this.unigramFreq(word);

    const n = ctx.length + 1;
    const contextKey = key(ctx);
    const ctxCount = this.contextTotals[n]?.get(contextKey) ?? 0;
    if (ctxCount === 0) return this.absoluteDiscountingScore(word, ctx.slice(1));

    const gramCount = this.countsByOrder[n]!.get(key([...ctx, word])) ?? 0;
    const nPlus = this.followersByContext[n]!.get(contextKey)?.size ?? 0;
    const gamma = (this.discount * nPlus) / ctxCount;
    const alpha = Math.max(gramCount - this.discount, 0) / ctxCount;
    return alpha + gamma * this.absoluteDiscountingScore(word, ctx.slice(1));
  }

  score(word: string, context: string[] = []): number {
    const normalizedWord = this.normalizeToken(word);
    const normalizedContext = context.map((item) => this.normalizeToken(item));
    if (this.model === "lidstone") return this.lidstoneScore(normalizedWord, normalizedContext);
    if (this.model === "kneser_ney_interpolated")
      return this.kneserNeyScore(normalizedWord, normalizedContext);
    if (this.model === "stupid_backoff") return this.stupidBackoffScore(normalizedWord, normalizedContext);
    if (this.model === "witten_bell_interpolated")
      return this.wittenBellScore(normalizedWord, normalizedContext);
    if (this.model === "absolute_discounting_interpolated")
      return this.absoluteDiscountingScore(normalizedWord, normalizedContext);
    return this.mleScore(normalizedWord, normalizedContext);
  }

  logScore(word: string, context: string[] = []): number {
    return Math.log2(safeProb(this.score(word, context)));
  }

  perplexity(tokens: string[]): number {
    if (this.nativePrepared && this.order <= 3 && NATIVE_LM_MODELS.has(this.model)) {
      return this.evaluateBatch([], tokens).perplexity;
    }
    const sequence = [...tokens.map((item) => this.normalizeToken(item))];
    if (this.padRight) sequence.push(this.endToken);
    if (sequence.length === 0) return Number.POSITIVE_INFINITY;
    const leftContext = this.padLeft
      ? Array.from({ length: Math.max(0, this.order - 1) }, () => this.startToken)
      : [];
    const history = [...leftContext];

    let negLog2 = 0;
    for (const token of sequence) {
      const context = tail(history, this.order - 1);
      const prob = safeProb(this.score(token, context));
      negLog2 += -Math.log2(prob);
      history.push(token);
    }

    return 2 ** (negLog2 / sequence.length);
  }

  evaluateBatch(probes: LmProbe[], perplexityTokens: string[]): { scores: number[]; perplexity: number } {
    if (!this.nativePrepared || this.order > 3 || !NATIVE_LM_MODELS.has(this.model)) {
      const scores = probes.map((probe) => this.score(probe.word, probe.context ?? []));
      return {
        scores,
        perplexity: this.perplexity(perplexityTokens),
      };
    }

    const contextsFlat: number[] = [];
    const contextLens: number[] = [];
    const words: number[] = [];
    for (const probe of probes) {
      const ctx = (probe.context ?? []).map((item) => this.encodeToken(item));
      contextLens.push(Math.min(ctx.length, this.order - 1));
      const tailCtx = ctx.length <= this.order - 1 ? ctx : ctx.slice(ctx.length - (this.order - 1));
      contextsFlat.push(...tailCtx);
      words.push(this.encodeToken(probe.word));
    }

    const perplexitySequence = [...perplexityTokens.map((item) => this.encodeToken(item))];
    if (this.padRight) perplexitySequence.push(this.encodeToken(this.endToken));

    const out = evaluateLanguageModelIdsNative({
      tokenIds: this.nativePrepared.tokenIds,
      sentenceOffsets: this.nativePrepared.sentenceOffsets,
      order: this.order,
      model: this.model as unknown as NativeLmModelType,
      gamma: this.gamma,
      discount: this.discount,
      vocabSize: this.vocabulary.length,
      probeContextFlat: Uint32Array.from(contextsFlat),
      probeContextLens: Uint32Array.from(contextLens),
      probeWordIds: Uint32Array.from(words),
      perplexityTokenIds: Uint32Array.from(perplexitySequence),
      prefixTokenIds: this.nativePrepared.prefixTokenIds,
    });

    return {
      scores: Array.from(out.scores),
      perplexity: out.perplexity,
    };
  }
}

export function trainNgramLanguageModel(
  sentences: string[][],
  options: NgramLanguageModelOptions,
): NgramLanguageModel {
  return new NgramLanguageModel(sentences, options);
}
