/**
 * Stack decoder (port of nltk.translate.stack_decoder).
 *
 * Phrase-based stack decoder for machine translation — verbatim port of
 * NLTK's stack_decoder.py (515 LOC). Includes PhraseTable + helpers so
 * the decoder is self-contained without a separate api import.
 */

// ---------------------------------------------------------------------------
// PhraseTable (port of nltk.translate.api.PhraseTable)
// ---------------------------------------------------------------------------
export type PhraseTableEntry = { trgPhrase: string[]; logProb: number };

export class PhraseTable {
  private readonly srcPhrases = new Map<string, PhraseTableEntry[]>();
  private key(phrase: readonly string[]): string { return phrase.join("\x1f"); }
  translationsFor(srcPhrase: readonly string[]): PhraseTableEntry[] {
    const v = this.srcPhrases.get(this.key(srcPhrase as string[]));
    if (v === undefined) throw new Error(`Phrase not in table: ${srcPhrase.join(" ")}`);
    return v;
  }
  translations_for = this.translationsFor.bind(this);
  add(srcPhrase: readonly string[], trgPhrase: readonly string[], logProb: number): void {
    const k = this.key(srcPhrase as string[]);
    const entry: PhraseTableEntry = { trgPhrase: [...trgPhrase], logProb };
    const list = this.srcPhrases.get(k);
    if (list === undefined) this.srcPhrases.set(k, [entry]);
    else { list.push(entry); list.sort((a, b) => b.logProb - a.logProb); }
  }
  has(srcPhrase: readonly string[]): boolean { return this.srcPhrases.has(this.key(srcPhrase as string[])); }
  contains = this.has.bind(this);
}

// ---------------------------------------------------------------------------
// Language model interface (experimental NLTK api)
// ---------------------------------------------------------------------------
export interface StackDecoderLanguageModel {
  probability(phrase: readonly string[]): number;
  probabilityChange(hypothesis: Hypothesis, phrase: readonly string[]): number;
}

// ---------------------------------------------------------------------------
// Hypothesis (port of _Hypothesis)
// ---------------------------------------------------------------------------
export class Hypothesis {
  rawScore: number;
  srcPhraseSpan: readonly [number, number] | readonly [];
  trgPhrase: readonly string[];
  previous: Hypothesis | null;
  futureScore: number;
  constructor(opts: {
    rawScore?: number;
    srcPhraseSpan?: readonly [number, number] | readonly [];
    trgPhrase?: readonly string[];
    previous?: Hypothesis | null;
    futureScore?: number;
  } = {}) {
    this.rawScore = opts.rawScore ?? 0.0;
    this.srcPhraseSpan = opts.srcPhraseSpan ?? [];
    this.trgPhrase = opts.trgPhrase ?? [];
    this.previous = opts.previous ?? null;
    this.futureScore = opts.futureScore ?? 0.0;
  }
  score(): number { return this.rawScore + this.futureScore; }
  translatedPositions(): number[] {
    const out: number[] = [];
    let cur: Hypothesis | null = this;
    while (cur !== null && cur.previous !== null) {
      const span = cur.srcPhraseSpan as readonly [number, number] | readonly [];
      if (span.length === 2) for (let i = span[0]!; i < span[1]!; i++) out.push(i);
      cur = cur.previous;
    }
    return out;
  }
  totalTranslatedWords(): number { return this.translatedPositions().length; }
  total_translated_words = this.totalTranslatedWords.bind(this);
  translated_positions = this.translatedPositions.bind(this);
  untranslatedSpans(sentenceLength: number): Array<[number, number]> {
    const tp = this.translatedPositions();
    tp.sort((a, b) => a - b);
    tp.push(sentenceLength);
    const spans: Array<[number, number]> = [];
    let start = 0;
    for (const end of tp) { if (start < end) spans.push([start, end]); start = end + 1; }
    return spans;
  }
  untranslated_spans = this.untranslatedSpans.bind(this);
  translationSoFar(): string[] {
    const out: string[] = [];
    this.buildTranslation(this, out);
    return out;
  }
  translation_so_far = this.translationSoFar.bind(this);
  private buildTranslation(hyp: Hypothesis, out: string[]): void {
    if (hyp.previous === null) return;
    this.buildTranslation(hyp.previous, out);
    out.push(...hyp.trgPhrase);
  }
  score_method = this.score.bind(this);
}
export const _Hypothesis = Hypothesis;

// ---------------------------------------------------------------------------
// Stack (port of _Stack)
// ---------------------------------------------------------------------------
export class Stack {
  maxSize: number;
  items: Hypothesis[];
  private logBeamThreshold: number;
  constructor(maxSize = 100, beamThreshold = 0.0) {
    this.maxSize = maxSize;
    this.items = [];
    this.logBeamThreshold = beamThreshold === 0.0 ? -Infinity : Math.log(beamThreshold);
  }
  push(hypothesis: Hypothesis): void {
    this.items.push(hypothesis);
    this.items.sort((a, b) => b.score() - a.score());
    while (this.items.length > this.maxSize) this.items.pop();
    this.thresholdPrune();
  }
  thresholdPrune(): void {
    if (this.items.length === 0) return;
    const threshold = this.items[0]!.score() + this.logBeamThreshold;
    for (let i = this.items.length - 1; i >= 0; i--) {
      if (this.items[i]!.score() < threshold) this.items.pop();
      else break;
    }
  }
  threshold_prune = this.thresholdPrune.bind(this);
  best(): Hypothesis | null { return this.items.length > 0 ? this.items[0]! : null; }
  [Symbol.iterator](): Iterator<Hypothesis> { return this.items[Symbol.iterator](); }
  get length(): number { return this.items.length; }
  contains(h: Hypothesis): boolean { return this.items.includes(h); }
  valueOf(): boolean { return this.items.length !== 0; }
}
export const _Stack = Stack;

// ---------------------------------------------------------------------------
// StackDecoder (port of StackDecoder)
// ---------------------------------------------------------------------------
export class StackDecoder {
  phraseTable: PhraseTable;
  languageModel: StackDecoderLanguageModel;
  wordPenalty = 0.0;
  beamThreshold = 0.0;
  stackSize = 100;
  private _distortionFactor = 0.5;
  private _logDistortionFactor!: number;
  constructor(phraseTable: PhraseTable, languageModel: StackDecoderLanguageModel) {
    this.phraseTable = phraseTable;
    this.languageModel = languageModel;
    this.computeLogDistortion();
  }
  get distortionFactor(): number { return this._distortionFactor; }
  set distortionFactor(d: number) { this._distortionFactor = d; this.computeLogDistortion(); }
  get distortion_factor(): number { return this._distortionFactor; }
  set distortion_factor(d: number) { this.distortionFactor = d; }
  private computeLogDistortion(): void {
    if (this._distortionFactor === 0.0) this._logDistortionFactor = Math.log(1e-9);
    else this._logDistortionFactor = Math.log(this._distortionFactor);
  }
  translate(srcSentence: string[]): string[] {
    const sentence = [...srcSentence];
    const sentenceLength = sentence.length;
    const stacks: Stack[] = [];
    for (let i = 0; i <= sentenceLength; i++) stacks.push(new Stack(this.stackSize, this.beamThreshold));
    stacks[0]!.push(new Hypothesis());
    const allPhrases = this.findAllSrcPhrases(sentence);
    const futureScoreTable = this.computeFutureScores(sentence);
    for (const stack of stacks) {
      const hyps = [...stack.items];
      for (const hypothesis of hyps) {
        const possible = StackDecoder.validPhrases(allPhrases, hypothesis);
        for (const span of possible) {
          const srcPhrase = sentence.slice(span[0], span[1]);
          let translations: PhraseTableEntry[];
          try { translations = this.phraseTable.translationsFor(srcPhrase); } catch { continue; }
          for (const translationOption of translations) {
            const rawScore = this.expansionScore(hypothesis, translationOption, span);
            const newHyp = new Hypothesis({ rawScore, srcPhraseSpan: span, trgPhrase: translationOption.trgPhrase, previous: hypothesis });
            newHyp.futureScore = this.futureScore(newHyp, futureScoreTable, sentenceLength);
            stacks[newHyp.totalTranslatedWords()]!.push(newHyp);
          }
        }
      }
    }
    const finalStack = stacks[sentenceLength]!;
    if (finalStack.items.length === 0) {
      console.warn("Unable to translate all words. The source sentence contains words not in the phrase table");
      return [];
    }
    return finalStack.best()!.translationSoFar();
  }
  findAllSrcPhrases(srcSentence: readonly string[]): number[][] {
    const n = srcSentence.length;
    const phraseIndices: number[][] = Array.from({ length: n }, () => []);
    for (let start = 0; start < n; start++)
      for (let end = start + 1; end <= n; end++)
        if (this.phraseTable.has(srcSentence.slice(start, end) as string[])) phraseIndices[start]!.push(end);
    return phraseIndices;
  }
  find_all_src_phrases = this.findAllSrcPhrases.bind(this);
  computeFutureScores(srcSentence: readonly string[]): Map<number, Map<number, number>> {
    const scores = new Map<number, Map<number, number>>();
    const get = (s: number, e: number): number => scores.get(s)?.get(e) ?? -Infinity;
    const set = (s: number, e: number, v: number): void => {
      let inner = scores.get(s);
      if (!inner) { inner = new Map(); scores.set(s, inner); }
      inner.set(e, v);
    };
    const n = srcSentence.length;
    for (let len = 1; len <= n; len++) {
      for (let start = 0; start + len <= n; start++) {
        const end = start + len;
        const phrase = srcSentence.slice(start, end);
        if (this.phraseTable.has(phrase as string[])) {
          let score = this.phraseTable.translationsFor(phrase as string[])[0]!.logProb;
          try { score += this.languageModel.probability(phrase as string[]); } catch { /* experimental API */ }
          set(start, end, score);
        }
        for (let mid = start + 1; mid < end; mid++) {
          const combined = get(start, mid) + get(mid, end);
          if (combined > get(start, end)) set(start, end, combined);
        }
      }
    }
    return scores;
  }
  compute_future_scores = this.computeFutureScores.bind(this);
  futureScore(hypothesis: Hypothesis, futureScoreTable: Map<number, Map<number, number>>, sentenceLength: number): number {
    let score = 0.0;
    for (const span of hypothesis.untranslatedSpans(sentenceLength)) score += futureScoreTable.get(span[0])?.get(span[1]) ?? -Infinity;
    return score;
  }
  future_score = this.futureScore.bind(this);
  expansionScore(hypothesis: Hypothesis, translationOption: PhraseTableEntry, srcPhraseSpan: readonly [number, number]): number {
    let score = hypothesis.rawScore;
    score += translationOption.logProb;
    try { score += this.languageModel.probabilityChange(hypothesis, translationOption.trgPhrase); } catch { /* experimental */ }
    score += this.distortionScore(hypothesis, srcPhraseSpan);
    score -= this.wordPenalty * translationOption.trgPhrase.length;
    return score;
  }
  expansion_score = this.expansionScore.bind(this);
  distortionScore(hypothesis: Hypothesis, nextSpan: readonly [number, number]): number {
    if ((hypothesis.srcPhraseSpan as readonly unknown[]).length === 0) return 0.0;
    const span = hypothesis.srcPhraseSpan as readonly [number, number];
    return Math.abs(nextSpan[0] - span[1]) * this._logDistortionFactor;
  }
  distortion_score = this.distortionScore.bind(this);
  static validPhrases(allPhrasesFrom: number[][], hypothesis: Hypothesis): Array<[number, number]> {
    const untranslated = hypothesis.untranslatedSpans(allPhrasesFrom.length);
    const out: Array<[number, number]> = [];
    for (const span of untranslated) {
      let start = span[0]; const availEnd = span[1];
      while (start < availEnd) {
        for (const phraseEnd of (allPhrasesFrom[start] ?? [])) {
          if (phraseEnd > availEnd) break;
          out.push([start, phraseEnd]);
        }
        start += 1;
      }
    }
    return out;
  }
  static valid_phrases = StackDecoder.validPhrases;
}
