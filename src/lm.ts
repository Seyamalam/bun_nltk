import { syncWasm } from "./sync_wasm.ts";
import type { WasmNltk } from "./wasm.ts";
import { LmWasm } from "./lm_wasm.ts";
import { assertU32 } from "./numeric_validation.ts";

export type LanguageModelType = "mle" | "lidstone" | "laplace" | "kneser_ney_interpolated"
  | "stupid_backoff" | "witten_bell_interpolated" | "absolute_discounting_interpolated";

export type NgramLanguageModelOptions = {
  order: number; model?: LanguageModelType; gamma?: number; discount?: number; alpha?: number;
  padLeft?: boolean; padRight?: boolean; startToken?: string; endToken?: string;
};
export type LmProbe = { word: string; context?: string[] };

const codes: Record<LanguageModelType, number> = {
  mle: 0, lidstone: 1, laplace: 1, kneser_ney_interpolated: 2, stupid_backoff: 3,
  witten_bell_interpolated: 4, absolute_discounting_interpolated: 5,
};
const finalizer = new FinalizationRegistry<{ transport: LmWasm; handle: number }>((state) => {
  try { state.transport.free(state.handle); } catch { /* Runtime may already be disposed. */ }
});

/** Existing normalized-token contract; vocabulary/counts/smoothing/evaluation are Rust-owned. */
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
  private readonly tokenToId = new Map<string, number>();
  private readonly transport: LmWasm;
  private readonly handle: number;
  private readonly unknownId: number;
  private disposed = false;

  constructor(sentences: string[][], options: NgramLanguageModelOptions, runtime?: WasmNltk) {
    assertU32(options.order, "order", 1, 64);
    this.order = options.order;
    this.model = options.model ?? "mle";
    if (!Object.hasOwn(codes, this.model)) throw new TypeError("unsupported language model");
    this.gamma = this.model === "laplace" ? 1 : options.gamma ?? 0.1;
    this.discount = options.discount ?? 0.75;
    this.alpha = options.alpha ?? 0.4;
    this.padLeft = options.padLeft ?? true;
    this.padRight = options.padRight ?? true;
    this.startToken = options.startToken ?? "<s>";
    this.endToken = options.endToken ?? "</s>";
    for (const [name, value] of [["gamma", this.gamma], ["alpha", this.alpha]] as const) {
      if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be finite and nonnegative`);
    }
    if (!Number.isFinite(this.discount) || this.discount < 0 || this.discount > 1) throw new RangeError("discount must be in [0, 1]");
    assertU32(sentences.length, "sentences", 0, 1_000_000);
    const intern = (token: string): number => {
      if (typeof token !== "string") throw new TypeError("LM tokens must be strings");
      let id = this.tokenToId.get(token);
      if (id === undefined) { id = this.tokenToId.size; this.tokenToId.set(token, id); }
      return id;
    };
    this.unknownId = intern("<UNK>");
    const start = intern(this.startToken), end = intern(this.endToken);
    const tokens: number[] = [], offsets = [0];
    for (const sentence of sentences) {
      if (tokens.length + sentence.length > 1_000_000) throw new RangeError("training tokens exceed 1000000");
      for (const token of sentence) tokens.push(intern(token.toLowerCase()));
      offsets.push(tokens.length);
    }
    this.transport = new LmWasm(runtime ?? syncWasm());
    this.handle = this.transport.train(Uint32Array.from(tokens), Uint32Array.from(offsets),
      Uint32Array.from([this.order, codes[this.model], Number(this.padLeft), Number(this.padRight), start, end, this.unknownId]),
      Float64Array.from([this.gamma, this.discount, this.alpha]));
    try {
      const names = [...this.tokenToId.keys()];
      this.vocabulary = Array.from(this.transport.vocabulary(this.handle), (id) => names[id]!).sort();
    } catch (error) { this.transport.free(this.handle); throw error; }
    finalizer.register(this, { transport: this.transport, handle: this.handle }, this);
  }

  private encodeToken(token: string): number {
    if (typeof token !== "string") throw new TypeError("LM tokens must be strings");
    const normalized = token === this.startToken || token === this.endToken ? token : token.toLowerCase();
    return this.tokenToId.get(normalized) ?? this.unknownId;
  }

  private evaluate(probes: LmProbe[], tokens: string[], perplexity: boolean, logScores = false): { scores: number[]; perplexity: number } {
    if (this.disposed) throw new Error("language model has been disposed");
    assertU32(probes.length, "probes", 0, 1_000_000);
    assertU32(tokens.length, "evaluation tokens", 0, 1_000_000);
    const flat: number[] = [], lens: number[] = [], words: number[] = [];
    for (const probe of probes) {
      const context = probe.context ?? [];
      const keep = Math.min(context.length, this.order - 1);
      if (flat.length + keep > 8_000_000) throw new RangeError("probe contexts exceed 8000000 IDs");
      lens.push(keep);
      for (let i = context.length - keep; i < context.length; i++) flat.push(this.encodeToken(context[i]!));
      words.push(this.encodeToken(probe.word));
    }
    return this.transport.evaluate(this.handle, Uint32Array.from(flat), Uint32Array.from(lens),
      Uint32Array.from(words), Uint32Array.from(tokens, (token) => this.encodeToken(token)), perplexity, logScores);
  }

  score(word: string, context: string[] = []): number { return this.evaluate([{ word, context }], [], false).scores[0]!; }
  logScore(word: string, context: string[] = []): number {
    return this.evaluate([{ word, context }], [], false, true).scores[0]!;
  }
  logscore(word: string, context: string[] = []): number { return this.logScore(word, context); }
  perplexity(tokens: string[]): number { return this.evaluate([], tokens, true).perplexity; }
  evaluateBatch(probes: LmProbe[], perplexityTokens: string[]): { scores: number[]; perplexity: number } {
    return this.evaluate(probes, perplexityTokens, true);
  }
  dispose(): void {
    if (this.disposed) return;
    this.transport.free(this.handle);
    finalizer.unregister(this);
    this.disposed = true;
  }
}

/** Explicit-runtime portable surface: one shared artifact, no native imports or fallback. */
export class RustNgramLanguageModel extends NgramLanguageModel {
  constructor(runtime: WasmNltk, sentences: string[][], options: NgramLanguageModelOptions) {
    super(sentences, options, runtime);
  }
}

export function trainNgramLanguageModel(sentences: string[][], options: NgramLanguageModelOptions): NgramLanguageModel {
  return new NgramLanguageModel(sentences, options);
}
