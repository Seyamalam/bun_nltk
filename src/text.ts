import { BigramAssocMeasures, BigramCollocationFinder, type BigramScoreFn } from "./collocations";
import { ConditionalFreqDist, FreqDist } from "./freqdist";
import { MLE } from "./lm_nltk";
import { sent_tokenize } from "./nltk_compat";
import { everygrams, pad_sequence, tokenwrap } from "./util_nltk";

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
  left_print: string;
  right_print: string;
};

type Context = [string, string];

// nltk.util.cut_string: width counts only non-combining characters; a
// negative width takes the *last* |width| display chars (Python s[-width:]).
function cutString(s: string, width = 70): string {
  const absWidth = Math.abs(width);
  const chars = [...s];
  let widthSoFar = 0;
  let charsSoFar = 0;
  let result = "";
  while (widthSoFar < absWidth && charsSoFar < chars.length) {
    let char: string;
    if (width < 0) {
      char = chars[chars.length - 1 - charsSoFar]!;
      result = char + result;
    } else {
      char = chars[charsSoFar]!;
      result += char;
    }
    charsSoFar += 1;
    if (!/\p{M}/u.test(char)) widthSoFar += 1;
  }
  return result;
}

function truncateLeft(value: string, width: number): string {
  return cutString(value, -width);
}

function truncateRight(value: string, width: number): string {
  return cutString(value, width);
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
    const key = this.key(word);
    // NLTK uses defaultdict(list): a missed lookup still registers the key.
    let offsets = this.#offsets.get(key);
    if (!offsets) {
      offsets = [];
      this.#offsets.set(key, offsets);
    }
    return offsets;
  }

  findConcordance(word: string | string[], width = 80): ConcordanceLine[] {
    const phrase = Array.isArray(word) ? word : [word];
    if (phrase.length === 0) return [];

    const phraseStr = phrase.join(" ");
    const phraseLen = [...phraseStr].filter((c) => !/\p{M}/u.test(c)).length;
    const halfWidth = Math.floor((width - phraseLen - 2) / 2);
    const contextWindow = Math.floor(width / 4);

    let offsets = this.offsets(phrase[0]!);
    for (let i = 1; i < phrase.length; i += 1) {
      const nextOffsets = new Set(this.offsets(phrase[i]!).map((offset) => offset - i));
      offsets = offsets.filter((offset) => nextOffsets.has(offset)).sort((a, b) => a - b);
    }

    const out: ConcordanceLine[] = [];
    for (const offset of offsets) {
      const query = this.tokensValue.slice(offset, offset + phrase.length).join(" ");
      const left = this.tokensValue.slice(Math.max(0, offset - contextWindow), offset);
      // NLTK slices right context to i+context (from the phrase start), not
      // i+len(phrase)+context.
      const right = this.tokensValue.slice(offset + phrase.length, offset + contextWindow);
      const leftPrint = truncateLeft(left.join(" "), halfWidth).padStart(halfWidth, " ");
      const rightPrint = truncateRight(right.join(" "), halfWidth);
      out.push({
        left,
        query,
        right,
        offset,
        leftPrint,
        rightPrint,
        left_print: leftPrint,
        right_print: rightPrint,
        line: [leftPrint, query, rightPrint].join(" "),
      });
    }
    return out;
  }

  find_concordance(word: string | string[], width = 80): ConcordanceLine[] {
    return this.findConcordance(word, width);
  }

  /** NLTK ``print_concordance`` rendered as a string (printing adapted). */
  printConcordance(word: string | string[], width = 80, lines = 25): string {
    const concordanceList = this.findConcordance(word, width);
    if (concordanceList.length === 0) return "no matches\n";
    const shown = Math.min(lines, concordanceList.length);
    let out = `Displaying ${shown} of ${concordanceList.length} matches:\n`;
    for (const row of concordanceList.slice(0, shown)) out += `${row.line}\n`;
    return out;
  }

  print_concordance(word: string | string[], width = 80, lines = 25): string {
    return this.printConcordance(word, width, lines);
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

  common_contexts(words: string[], num = 20): Context[] {
    return this.commonContexts(words, num);
  }

  concordance_list(word: string | string[], width = 79, lines = 25): ConcordanceLine[] {
    return this.concordanceList(word, width, lines);
  }

  collocation_list(
    num = 20,
    window_size = 2,
    options?: {
      minFreq?: number;
      scoreFn?: BigramScoreFn<string>;
      stopwords?: Iterable<string>;
    },
  ): Array<[string, string]> {
    return this.collocationList(num, window_size, options);
  }

  findall(regexp: string, timeout?: number): string {
    this.#tokenSearcher ??= new TokenSearcher(this.tokens);
    const hits = this.#tokenSearcher.findall(regexp, timeout).map((h) => h.join(" "));
    return tokenwrap(hits, "; ");
  }

  generate(length = 100, text_seed?: readonly string[], random_seed = 42): string {
    const tokenized_sents = sent_tokenize(this.tokens.join(" ")).map((sent) => sent.split(" "));
    if (!this.#trigramModel) {
      const n = 3;
      const trainData = tokenized_sents.map((sent) =>
        [...everygrams([...pad_sequence(sent, n, { pad_left: true, left_pad_symbol: "<s>", pad_right: true, right_pad_symbol: "</s>" })], 1, n)],
      );
      const vocabText = tokenized_sents.flatMap((sent) =>
        [...pad_sequence(sent, n, { pad_left: true, left_pad_symbol: "<s>", pad_right: true, right_pad_symbol: "</s>" })],
      );
      const model = new MLE(n);
      model.fit(trainData, vocabText);
      this.#trigramModel = model;
    }

    const generated_tokens: string[] = [];
    if (length <= 0) throw new Error("The `length` must be more than 0.");
    let seed = random_seed;
    while (generated_tokens.length < length) {
      for (const token of this.#trigramModel.generate(length, text_seed as string[] | undefined, seed) as string[]) {
        if (token === "<s>") continue;
        if (token === "</s>") break;
        generated_tokens.push(token);
      }
      seed += 1;
    }

    const prefix = text_seed ? text_seed.join(" ") + " " : "";
    const output_str = prefix + tokenwrap(generated_tokens.slice(0, length));
    return output_str;
  }

  readability(_method: string): never {
    throw new Error("NotImplementedError");
  }

  dispersion_plot(words: readonly string[]): number[][] {
    // Adapted: NLTK draws with matplotlib (nltk.draw.dispersion_plot); we
    // return the per-word token offsets that the plot would render.
    return words.map((word) => {
      const offsets: number[] = [];
      this.tokens.forEach((token, i) => {
        if (token === word) offsets.push(i);
      });
      return offsets;
    });
  }

  dispersionPlot(words: readonly string[]): number[][] {
    return this.dispersion_plot(words);
  }

  plot(...args: unknown[]): unknown {
    const vocab = this.vocab() as FreqDist<string> & { plot?: (...a: unknown[]) => unknown };
    if (typeof vocab.plot !== "function") throw new Error("FreqDist.plot requires a plotting backend (matplotlib)");
    return vocab.plot(...args);
  }

  #tokenSearcher?: TokenSearcher;
  #trigramModel?: MLE;

  toString(): string {
    return `<Text: ${this.name}>`;
  }
}

/** nltk.text.TokenSearcher — regex search over a token stream using <token> markup. */
export class TokenSearcher {
  private readonly raw: string;

  constructor(tokens: Iterable<string>) {
    this.raw = [...tokens].map((w) => `<${w}>`).join("");
  }

  findall(regexp: string, _timeout?: number): string[][] {
    let pattern = regexp.replace(/\s/g, "");
    pattern = pattern.replace(/</g, "(?:<(?:");
    pattern = pattern.replace(/>/g, ")>)");
    pattern = pattern.replace(/(?<!\\)\./g, "[^>]");
    const re = new RegExp(pattern, "g");
    // Python findall(): 0 groups → whole match; 1 group → group text
    // (empty string for non-participating); ≥2 groups → tuples that then
    // crash in the sanity check (replicated as a throw below).
    const hits: Array<string | string[]> = [];
    for (const m of this.raw.matchAll(re)) {
      if (m.length - 1 === 0) hits.push(m[0]);
      else if (m.length - 1 === 1) hits.push(m[1] ?? "");
      else hits.push(m.slice(1));
    }
    for (const h of hits) {
      if (Array.isArray(h)) throw new TypeError("'tuple' object has no attribute 'startswith'");
      if (!h.startsWith("<") && h.endsWith(">")) throw new Error("Bad regexp for TokenSearcher.findall");
    }
    return hits.map((h) => (h as string).slice(1, -1).split("><"));
  }
}

/** nltk.text.TextCollection — Text over a collection of texts with tf/idf helpers. */
export class TextCollection extends Text {
  private readonly texts: string[][];
  private readonly idfCache = new Map<string, number>();

  constructor(source: Iterable<Iterable<string>> | { words(fileid?: string): Iterable<string>; fileids(): string[] }) {
    let texts: string[][];
    if (typeof (source as { fileids?: unknown }).fileids === "function" && typeof (source as { words?: unknown }).words === "function") {
      const corpus = source as { words(fileid?: string): Iterable<string>; fileids(): string[] };
      texts = corpus.fileids().map((f) => [...corpus.words(f)]);
    } else {
      texts = [...(source as Iterable<Iterable<string>>)].map((t) => [...t]);
    }
    super(texts.flat());
    this.texts = texts;
  }

  tf(term: string, text: readonly string[]): number {
    return text.filter((t) => t === term).length / text.length;
  }

  idf(term: string): number {
    let idf = this.idfCache.get(term);
    if (idf === undefined) {
      const matches = this.texts.filter((text) => text.includes(term)).length;
      if (this.texts.length === 0) throw new Error("IDF undefined for empty document collection");
      idf = matches ? Math.log(this.texts.length / matches) : 0.0;
      this.idfCache.set(term, idf);
    }
    return idf;
  }

  tf_idf(term: string, text: readonly string[]): number {
    return this.tf(term, text) * this.idf(term);
  }
}
