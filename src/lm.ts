export type LanguageModelType = "mle" | "lidstone" | "kneser_ney_interpolated";

export type NgramLanguageModelOptions = {
  order: number;
  model?: LanguageModelType;
  gamma?: number;
  discount?: number;
  padLeft?: boolean;
  padRight?: boolean;
  startToken?: string;
  endToken?: string;
};

function key(tokens: string[]): string {
  return tokens.join("\u0001");
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

export class NgramLanguageModel {
  readonly order: number;
  readonly model: LanguageModelType;
  readonly gamma: number;
  readonly discount: number;
  readonly padLeft: boolean;
  readonly padRight: boolean;
  readonly startToken: string;
  readonly endToken: string;
  readonly vocabulary: string[];

  private readonly countsByOrder: Array<Map<string, number>>;
  private readonly followersByContext: Array<Map<string, Set<string>>>;
  private readonly continuationByWord: Map<string, Set<string>>;
  private readonly continuationTypeCount: number;
  private readonly unigramTotal: number;

  constructor(sentences: string[][], options: NgramLanguageModelOptions) {
    if (!Number.isInteger(options.order) || options.order <= 0) {
      throw new Error("order must be a positive integer");
    }
    this.order = options.order;
    this.model = options.model ?? "mle";
    this.gamma = options.gamma ?? 0.1;
    this.discount = options.discount ?? 0.75;
    this.padLeft = options.padLeft ?? true;
    this.padRight = options.padRight ?? true;
    this.startToken = options.startToken ?? "<s>";
    this.endToken = options.endToken ?? "</s>";

    this.countsByOrder = Array.from({ length: this.order + 1 }, () => new Map<string, number>());
    this.followersByContext = Array.from({ length: this.order + 1 }, () => new Map<string, Set<string>>());
    this.continuationByWord = new Map<string, Set<string>>();

    const vocab = new Set<string>();
    const prepared = this.prepareSentences(sentences);
    for (const row of prepared) {
      for (const tok of row) vocab.add(tok);
      for (let n = 1; n <= this.order; n += 1) {
        if (row.length < n) continue;
        for (let i = 0; i <= row.length - n; i += 1) {
          const gram = row.slice(i, i + n);
          increment(this.countsByOrder[n]!, key(gram));

          if (n >= 2) {
            const context = gram.slice(0, n - 1);
            const predicted = gram[n - 1]!;
            addToSetMap(this.followersByContext[n]!, key(context), predicted);
            if (n === 2) {
              const predecessor = context[0]!;
              addToSetMap(this.continuationByWord, predicted, predecessor);
            }
          }
        }
      }
    }

    this.vocabulary = [...vocab].sort();
    this.unigramTotal = [...this.countsByOrder[1]!.values()].reduce((acc, count) => acc + count, 0);
    this.continuationTypeCount = [...this.continuationByWord.values()].reduce((acc, set) => acc + set.size, 0);
  }

  private prepareSentences(sentences: string[][]): string[][] {
    const out: string[][] = [];
    const leftPad = this.padLeft ? Array.from({ length: Math.max(0, this.order - 1) }, () => this.startToken) : [];
    for (const sentence of sentences) {
      const row = [...leftPad, ...sentence];
      if (this.padRight) row.push(this.endToken);
      out.push(row);
    }
    return out;
  }

  private backoffContext(context: string[]): string[] {
    return tail(context, this.order - 1);
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
    const ctxCount = this.countsByOrder[n - 1]!.get(key(ctx)) ?? 0;
    if (ctxCount === 0) return this.mleScore(word, ctx.slice(1));
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
    const ctxCount = this.countsByOrder[n - 1]!.get(key(ctx)) ?? 0;
    if (ctxCount === 0) return this.lidstoneScore(word, ctx.slice(1));
    return (gramCount + this.gamma) / (ctxCount + this.gamma * vocabSize);
  }

  private kneserNeyScore(word: string, context: string[]): number {
    const ctx = this.backoffContext(context);
    if (ctx.length === 0) {
      const continuation = this.continuationByWord.get(word)?.size ?? 0;
      if (this.continuationTypeCount === 0) return 1 / Math.max(1, this.vocabulary.length);
      if (continuation === 0) return 1 / (Math.max(1, this.continuationTypeCount) * 10);
      return continuation / this.continuationTypeCount;
    }

    const n = ctx.length + 1;
    const contextKey = key(ctx);
    const ctxCount = this.countsByOrder[n - 1]!.get(contextKey) ?? 0;
    if (ctxCount === 0) return this.kneserNeyScore(word, ctx.slice(1));

    const gramCount = this.countsByOrder[n]!.get(key([...ctx, word])) ?? 0;
    const followers = this.followersByContext[n]!.get(contextKey)?.size ?? 0;
    const lambda = (this.discount * followers) / ctxCount;
    const discounted = Math.max(gramCount - this.discount, 0) / ctxCount;
    return discounted + lambda * this.kneserNeyScore(word, ctx.slice(1));
  }

  score(word: string, context: string[] = []): number {
    const normalizedWord = word.toLowerCase();
    const normalizedContext = context.map((item) => item.toLowerCase());
    if (this.model === "lidstone") return this.lidstoneScore(normalizedWord, normalizedContext);
    if (this.model === "kneser_ney_interpolated") return this.kneserNeyScore(normalizedWord, normalizedContext);
    return this.mleScore(normalizedWord, normalizedContext);
  }

  logScore(word: string, context: string[] = []): number {
    return Math.log2(safeProb(this.score(word, context)));
  }

  perplexity(tokens: string[]): number {
    if (tokens.length === 0) return Number.POSITIVE_INFINITY;
    const sequence = [...tokens.map((item) => item.toLowerCase())];
    if (this.padRight) sequence.push(this.endToken);
    const leftContext = this.padLeft ? Array.from({ length: Math.max(0, this.order - 1) }, () => this.startToken) : [];
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
}

export function trainNgramLanguageModel(
  sentences: string[][],
  options: NgramLanguageModelOptions,
): NgramLanguageModel {
  return new NgramLanguageModel(sentences, options);
}

