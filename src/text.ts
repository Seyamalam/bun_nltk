import { BigramAssocMeasures, BigramCollocationFinder, type BigramScoreFn } from "./collocations";
import { ConditionalFreqDist, FreqDist } from "./freqdist";

const DEFAULT_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "if",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "these",
  "this",
  "to",
  "was",
  "were",
  "with",
]);

export type ConcordanceLine = {
  left: string[];
  query: string;
  right: string[];
  offset: number;
  leftPrint: string;
  rightPrint: string;
  line: string;
};

type Context = [string, string];

function truncateLeft(value: string, width: number): string {
  if (width <= 0) return "";
  if (value.length <= width) return value;
  return value.slice(value.length - width);
}

function truncateRight(value: string, width: number): string {
  if (width <= 0) return "";
  if (value.length <= width) return value;
  return value.slice(0, width);
}

function contextKey([left, right]: Context): string {
  return `${left}\u0001${right}`;
}

export class ConcordanceIndex {
  readonly #offsets = new Map<string, number[]>();

  constructor(
    private readonly tokensValue: string[],
    private readonly key: (token: string) => string = (token) => token,
  ) {
    for (let index = 0; index < tokensValue.length; index += 1) {
      const token = this.key(tokensValue[index]!);
      const offsets = this.#offsets.get(token) ?? [];
      offsets.push(index);
      this.#offsets.set(token, offsets);
    }
  }

  tokens(): string[] {
    return this.tokensValue;
  }

  offsets(word: string): number[] {
    return this.#offsets.get(this.key(word)) ?? [];
  }

  findConcordance(word: string | string[], width = 80): ConcordanceLine[] {
    const phrase = Array.isArray(word) ? word : [word];
    if (phrase.length === 0) return [];

    const phraseWidth = phrase.join(" ").length;
    const halfWidth = Math.max(0, Math.floor((width - phraseWidth - 2) / 2));
    const contextWindow = Math.max(1, Math.floor(width / 4));

    let offsets = this.offsets(phrase[0]!);
    for (let i = 1; i < phrase.length; i += 1) {
      const nextOffsets = new Set(this.offsets(phrase[i]!).map((offset) => offset - i));
      offsets = offsets.filter((offset) => nextOffsets.has(offset));
    }

    const out: ConcordanceLine[] = [];
    for (const offset of offsets) {
      const query = this.tokensValue.slice(offset, offset + phrase.length).join(" ");
      const left = this.tokensValue.slice(Math.max(0, offset - contextWindow), offset);
      const right = this.tokensValue.slice(offset + phrase.length, offset + phrase.length + contextWindow);
      const leftPrint = truncateLeft(left.join(" "), halfWidth).padStart(halfWidth, " ");
      const rightPrint = truncateRight(right.join(" "), halfWidth);
      out.push({
        left,
        query,
        right,
        offset,
        leftPrint,
        rightPrint,
        line: `${leftPrint} ${query} ${rightPrint}`.trimEnd(),
      });
    }
    return out;
  }

  concordance(word: string | string[], width = 80, lines = 25): string[] {
    return this.findConcordance(word, width)
      .slice(0, Math.max(0, lines))
      .map((row) => row.line);
  }

  toString(): string {
    return `<ConcordanceIndex for ${this.tokensValue.length} tokens (${this.#offsets.size} types)>`;
  }
}

export class ContextIndex {
  readonly #wordToContexts = new ConditionalFreqDist<string, Context>();
  readonly #contextToWords = new ConditionalFreqDist<Context, string>();
  readonly #keyFn: (token: string) => string;

  constructor(
    private readonly tokensValue: string[],
    options?: {
      contextFn?: (tokens: string[], index: number) => Context;
      filter?: (token: string) => boolean;
      key?: (token: string) => string;
    },
  ) {
    const key = options?.key ?? ((token: string) => token);
    this.#keyFn = key;
    const filter = options?.filter ?? (() => true);
    const contextFn = options?.contextFn ?? ((tokens: string[], index: number): Context => [
      index > 0 ? key(tokens[index - 1]!) : "*START*",
      index + 1 < tokens.length ? key(tokens[index + 1]!) : "*END*",
    ]);

    for (let index = 0; index < tokensValue.length; index += 1) {
      const token = tokensValue[index]!;
      if (!filter(token)) continue;
      const normalized = key(token);
      const context = contextFn(tokensValue, index);
      this.#wordToContexts.get(normalized).inc(context);
      this.#contextToWords.get(context).inc(normalized);
    }
  }

  tokens(): string[] {
    return this.tokensValue;
  }

  similarWords(word: string, count = 20): string[] {
    const normalized = this.#keyFn(word);
    const contexts = this.#wordToContexts.peek(normalized);
    if (!contexts) return [];

    const scores = new Map<string, number>();
    for (const [context, wordContextCount] of contexts.entries()) {
      const related = this.#contextToWords.get(context);
      for (const [candidate, candidateCount] of related.entries()) {
        if (candidate === normalized) continue;
        scores.set(candidate, (scores.get(candidate) ?? 0) + wordContextCount * candidateCount);
      }
    }

    return [...scores.entries()]
      .sort((left, right) => {
        if (left[1] !== right[1]) return right[1] - left[1];
        return left[0].localeCompare(right[0]);
      })
      .slice(0, Math.max(0, count))
      .map(([candidate]) => candidate);
  }

  commonContexts(words: string[], failOnUnknown = false): FreqDist<Context> {
    const normalized = words.map((word) => this.#keyFn(word));
    if (normalized.length === 0) return new FreqDist<Context>();

    const contextMaps = normalized.map((word) => {
      const dist = this.#wordToContexts.peek(word);
      if (!dist) return new Map<string, Context>();
      return new Map(dist.samples().map((context) => [contextKey(context), context] as const));
    });
    const missing = normalized.filter((word, index) => contextMaps[index]!.size === 0);
    if (missing.length > 0 && failOnUnknown) {
      throw new Error(`The following word(s) were not found: ${missing.join(" ")}`);
    }

    if (contextMaps.some((item) => item.size === 0)) {
      return new FreqDist<Context>();
    }

    const commonKeys = [...contextMaps[0]!.keys()].filter((key) => contextMaps.every((map) => map.has(key)));
    if (commonKeys.length === 0) return new FreqDist<Context>();

    const out = new FreqDist<Context>();
    for (const word of normalized) {
      const dist = this.#wordToContexts.get(word);
      for (const [context, freq] of dist.entries()) {
        if (commonKeys.includes(contextKey(context))) {
          out.inc(context, freq);
        }
      }
    }
    return out;
  }
}

export class Text {
  readonly tokens: string[];
  readonly name: string;
  #concordanceIndex?: ConcordanceIndex;
  #contextIndex?: ContextIndex;

  constructor(tokens: Iterable<string>, name?: string) {
    this.tokens = [...tokens];
    this.name = name ?? `${this.tokens.slice(0, 8).join(" ")}${this.tokens.length > 8 ? "..." : ""}`;
  }

  count(word: string): number {
    let total = 0;
    for (const token of this.tokens) {
      if (token === word) total += 1;
    }
    return total;
  }

  index(word: string): number {
    const idx = this.tokens.indexOf(word);
    if (idx < 0) throw new Error(`word not found: ${word}`);
    return idx;
  }

  vocab(): FreqDist<string> {
    return new FreqDist(this.tokens);
  }

  concordanceList(word: string | string[], width = 79, lines = 25): ConcordanceLine[] {
    this.#concordanceIndex ??= new ConcordanceIndex(this.tokens, (token) => token.toLowerCase());
    return this.#concordanceIndex.findConcordance(word, width).slice(0, Math.max(0, lines));
  }

  concordance(word: string | string[], width = 79, lines = 25): string[] {
    return this.concordanceList(word, width, lines).map((row) => row.line);
  }

  collocationList(
    num = 20,
    windowSize = 2,
    options?: {
      minFreq?: number;
      scoreFn?: BigramScoreFn<string>;
      stopwords?: Iterable<string>;
    },
  ): Array<[string, string]> {
    const minFreq = options?.minFreq ?? 2;
    const scoreFn = options?.scoreFn ?? BigramAssocMeasures.likelihood_ratio;
    const stopwords = new Set(options?.stopwords ?? DEFAULT_STOPWORDS);

    const finder = BigramCollocationFinder.fromWords(this.tokens, windowSize);
    finder.applyFreqFilter(minFreq);
    finder.applyWordFilter((word) => word.length < 3 || stopwords.has(word.toLowerCase()));
    return finder.nbest(scoreFn, num);
  }

  collocations(num = 20, windowSize = 2): string[] {
    return this.collocationList(num, windowSize).map(([left, right]) => `${left} ${right}`);
  }

  similar(word: string, num = 20): string[] {
    this.#contextIndex ??= new ContextIndex(this.tokens, {
      filter: (token) => /^[A-Za-z]+$/.test(token),
      key: (token) => token.toLowerCase(),
    });
    return this.#contextIndex.similarWords(word, num);
  }

  commonContexts(words: string[], num = 20): Context[] {
    this.#contextIndex ??= new ContextIndex(this.tokens, {
      key: (token) => token.toLowerCase(),
    });
    return this.#contextIndex.commonContexts(words, true).mostCommon(num).map(([context]) => context);
  }

  toString(): string {
    return `<Text: ${this.name}>`;
  }
}
