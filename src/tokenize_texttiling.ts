/**
 * TextTiling topic segmentation (port of nltk.tokenize.texttiling).
 *
 * Detects subtopic shifts via lexical co-occurrence: pseudosentences of
 * fixed size w, block-comparison (or vocabulary-introduction) similarity at
 * gaps, smoothing, depth scores, and boundary identification.
 *
 * Hearst (1997), "TextTiling: Segmenting Text into Multi-Paragraph
 * Subtopic Passages", Computational Linguistics 23(1).
 */

export const BLOCK_COMPARISON = "block_comparison";
export const VOCABULARY_INTRODUCTION = "vocabulary_introduction";
export const LC = 0;
export const HC = 1;
export const DEFAULT_SMOOTHING = [0];

export interface TextTilingOptions {
  /** Pseudosentence size. */
  w?: number;
  /** Block size (in pseudosentences) for the comparison method. */
  k?: number;
  /** BLOCK_COMPARISON (default) or VOCABULARY_INTRODUCTION. */
  similarityMethod?: typeof BLOCK_COMPARISON | typeof VOCABULARY_INTRODUCTION;
  /** Stopwords filtered out; defaults to an empty list (NLTK uses its corpus). */
  stopwords?: string[];
  smoothingWidth?: number;
  smoothingRounds?: number;
  /** HC (default) or LC cutoff policy. */
  cutoffPolicy?: typeof LC | typeof HC;
}

interface TokenTableField {
  firstPos: number;
  tsOccurences: Array<[number, number]>;
  totalCount: number;
  parCount: number;
  lastPar: number;
  lastTokSeq: number;
}

interface TokenSequence {
  index: number;
  wrdindexList: Array<[string, number]>;
}

/** SciPy-Cookbook flat-window smoothing with reflected edges. */
export function smooth(x: number[], windowLen = 11): number[] {
  if (x.length < windowLen) {
    throw new Error(`Input vector (${x.length}) needs to be bigger than window size (${windowLen}).`);
  }
  if (windowLen < 3) return x.slice();
  // s = numpy.r_[2*x[0]-x[window_len:1:-1], x, 2*x[-1]-x[-1:-window_len:-1]]
  //   left reflection: x[window_len-1 .. 1] (w-1 items); right: x[-2 .. -(w-1)] (w-1 items)
  const s: number[] = [];
  for (let i = windowLen - 1; i >= 1; i--) s.push(2 * x[0]! - x[i]!);
  s.push(...x);
  // x[-1:-window_len:-1] yields x[-1], x[-2], ... — the first reflected item mirrors x[-1] onto itself
  for (let i = x.length - 1; i >= x.length - (windowLen - 1); i--) s.push(2 * x[x.length - 1]! - x[i]!);
  // y = convolve(w/w.sum(), s, mode="same"); return y[w-1 : -(w-1)]
  const w = windowLen;
  const half = Math.floor(w / 2);
  const outLen = s.length; // 'same' keeps s length
  const same: number[] = new Array(outLen);
  for (let i = 0; i < outLen; i++) {
    let acc = 0;
    for (let j = 0; j < w; j++) {
      const si = i + j - half;
      acc += (si >= 0 && si < s.length ? s[si]! : 0) / w;
    }
    same[i] = acc;
  }
  return same.slice(w - 1, s.length - (w - 1));
}

export class TextTilingTokenizer {
  private readonly w: number;
  private readonly k: number;
  private readonly similarityMethod: string;
  private readonly stopwords: string[];
  private readonly smoothingWidth: number;
  private readonly smoothingRounds: number;
  private readonly cutoffPolicy: number;

  static readonly MAX_TEXT_LEN = 1_000_000;

  constructor(options: TextTilingOptions = {}) {
    this.w = options.w ?? 20;
    this.k = options.k ?? 10;
    this.similarityMethod = options.similarityMethod ?? BLOCK_COMPARISON;
    this.stopwords = options.stopwords ?? [];
    this.smoothingWidth = options.smoothingWidth ?? 2;
    this.smoothingRounds = options.smoothingRounds ?? 1;
    this.cutoffPolicy = options.cutoffPolicy ?? HC;
  }

  tokenize(text: string): string[] {
    if (text.length > TextTilingTokenizer.MAX_TEXT_LEN) {
      throw new Error(`TextTilingTokenizer: input length exceeds MAX_TEXT_LEN.`);
    }
    const lowercaseText = text.toLowerCase();
    const paragraphBreaks = this.markParagraphBreaks(text);
    const textLength = lowercaseText.length;

    // Strip punctuation, keeping [a-z-' \n\t]
    let nopunctText = "";
    for (const c of lowercaseText) {
      if (/[a-z\-' \n\t]/.test(c)) nopunctText += c;
    }
    const nopunctParBreaks = this.markParagraphBreaks(nopunctText);

    const tokseqs = this.divideToTokenSequences(nopunctText);

    for (const ts of tokseqs) {
      ts.wrdindexList = ts.wrdindexList.filter(([w]) => !this.stopwords.includes(w));
    }

    const tokenTable = this.createTokenTable(tokseqs, nopunctParBreaks);

    let gapScores: number[];
    if (this.similarityMethod === BLOCK_COMPARISON) {
      gapScores = this.blockComparison(tokseqs, tokenTable);
    } else if (this.similarityMethod === VOCABULARY_INTRODUCTION) {
      gapScores = this.vocabularyIntroduction(tokseqs);
    } else {
      throw new Error(`Similarity method ${this.similarityMethod} not recognized`);
    }

    if (this.smoothingMethodCheck()) {
      let smoothScores = this.smoothScores(gapScores);
      for (let r = 1; r < this.smoothingRounds; r++) {
        smoothScores = this.smoothScores(smoothScores);
      }
      const depthScores = this.depthScores(smoothScores);
      const segmentBoundaries = this.identifyBoundaries(depthScores);
      const normalizedBoundaries = this.normalizeBoundaries(text, segmentBoundaries, paragraphBreaks);

      const segmentedText: string[] = [];
      let prevb = 0;
      for (const b of normalizedBoundaries) {
        if (b === 0) continue;
        segmentedText.push(text.slice(prevb, b));
        prevb = b;
      }
      if (prevb < textLength) segmentedText.push(text.slice(prevb));
      if (segmentedText.length === 0) segmentedText.push(text);
      return segmentedText;
    }
    throw new Error("Smoothing method not recognized");
  }

  private smoothingMethodCheck(): boolean {
    return true; // only DEFAULT_SMOOTHING supported, as in NLTK's default path
  }

  private markParagraphBreaks(text: string): number[] {
    const MIN_PARAGRAPH = 100;
    const pattern = /[ \t\r\f\v]*\n[ \t\r\f\v]*\n[ \t\r\f\v]*/g;
    let lastBreak = 0;
    const pbreaks = [0];
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      if (m.index - lastBreak < MIN_PARAGRAPH) continue;
      pbreaks.push(m.index);
      lastBreak = m.index;
    }
    return pbreaks;
  }

  private divideToTokenSequences(text: string): TokenSequence[] {
    const w = this.w;
    const wrdindexList: Array<[string, number]> = [];
    const re = /\w+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) wrdindexList.push([m[0], m.index]);
    const seqs: TokenSequence[] = [];
    for (let i = 0; i < wrdindexList.length; i += w) {
      seqs.push({ index: i / w, wrdindexList: wrdindexList.slice(i, i + w) });
    }
    return seqs;
  }

  private createTokenTable(tokenSequences: TokenSequence[], parBreaks: number[]): Map<string, TokenTableField> {
    const tokenTable = new Map<string, TokenTableField>();
    let currentPar = 0;
    let currentTokSeq = 0;
    let pbIndex = 0;
    let currentParBreak = parBreaks[pbIndex++]!;
    if (currentParBreak === 0) {
      if (pbIndex >= parBreaks.length) {
        throw new Error("No paragraph breaks were found(text too short perhaps?)");
      }
      currentParBreak = parBreaks[pbIndex++]!; // skip break at 0
    }
    for (const ts of tokenSequences) {
      for (const [word, index] of ts.wrdindexList) {
        while (pbIndex < parBreaks.length && index > currentParBreak) {
          currentPar += 1;
          currentParBreak = parBreaks[pbIndex++]!;
        }

        const entry = tokenTable.get(word);
        if (entry) {
          entry.totalCount += 1;
          if (entry.lastPar !== currentPar) {
            entry.lastPar = currentPar;
            entry.parCount += 1;
          }
          if (entry.lastTokSeq !== currentTokSeq) {
            entry.lastTokSeq = currentTokSeq;
            entry.tsOccurences.push([currentTokSeq, 1]);
          } else {
            entry.tsOccurences[entry.tsOccurences.length - 1]![1]! += 1;
          }
        } else {
          tokenTable.set(word, {
            firstPos: index,
            tsOccurences: [[currentTokSeq, 1]],
            totalCount: 1,
            parCount: 1,
            lastPar: currentPar,
            lastTokSeq: currentTokSeq,
          });
        }
      }
      currentTokSeq += 1;
    }
    return tokenTable;
  }

  private blockComparison(
    tokseqs: TokenSequence[],
    tokenTable: Map<string, TokenTableField>,
  ): number[] {
    const blkFrq = (tok: TokenTableField, block: number[]): number => {
      let freq = 0;
      for (const [ts, count] of tok.tsOccurences) {
        if (block.includes(ts)) freq += count;
      }
      return freq;
    };

    const gapScores: number[] = [];
    const numgaps = tokseqs.length - 1;

    for (let currGap = 0; currGap < numgaps; currGap++) {
      let scoreDividend = 0.0;
      let scoreDivisorB1 = 0.0;
      let scoreDivisorB2 = 0.0;

      let windowSize: number;
      if (currGap < this.k - 1) windowSize = currGap + 1;
      else if (currGap > numgaps - this.k) windowSize = numgaps - currGap;
      else windowSize = this.k;

      const b1 = tokseqs.slice(currGap - windowSize + 1, currGap + 1).map((ts) => ts.index);
      const b2 = tokseqs.slice(currGap + 1, currGap + windowSize + 1).map((ts) => ts.index);

      for (const t of tokenTable.values()) {
        scoreDividend += blkFrq(t, b1) * blkFrq(t, b2);
        scoreDivisorB1 += blkFrq(t, b1) ** 2;
        scoreDivisorB2 += blkFrq(t, b2) ** 2;
      }
      const denom = Math.sqrt(scoreDivisorB1 * scoreDivisorB2);
      gapScores.push(denom === 0 ? 0 : scoreDividend / denom);
    }
    return gapScores;
  }

  /** Vocabulary-introduction scores per Section 3.2 of Hearst 1997. */
  private vocabularyIntroduction(tokseqs: TokenSequence[]): number[] {
    const n = tokseqs.length;
    if (n < 2) return [];

    const tokseqSets = tokseqs.map((seq) => new Set(seq.wrdindexList.map(([t]) => t)));
    const norm = this.w * 2;

    const newLeft: number[] = [];
    const seenLeft = new Set<string>();
    for (let i = 0; i < n; i++) {
      let newCount = 0;
      for (const t of tokseqSets[i]!) if (!seenLeft.has(t)) newCount++;
      newLeft.push(newCount);
      for (const t of tokseqSets[i]!) seenLeft.add(t);
    }

    const newRight = new Array<number>(n).fill(0);
    const seenRight = new Set<string>();
    for (let i = n - 1; i >= 0; i--) {
      let newCount = 0;
      for (const t of tokseqSets[i]!) if (!seenRight.has(t)) newCount++;
      newRight[i] = newCount;
      for (const t of tokseqSets[i]!) seenRight.add(t);
    }

    const gapScores: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      gapScores.push((newLeft[i]! + newRight[i + 1]!) / norm);
    }
    return gapScores;
  }

  private smoothScores(gapScores: number[]): number[] {
    return smooth(gapScores, this.smoothingWidth + 1);
  }

  private depthScores(scores: number[]): number[] {
    const depthScores = new Array<number>(scores.length).fill(0);
    const clip = Math.min(Math.max(Math.floor(scores.length / 10), 2), 5);
    let index = clip;

    for (let gi = clip; gi < scores.length - clip; gi++) {
      const gapscore = scores[gi]!;
      let lpeak = gapscore;
      for (let i = index; i >= 0; i--) {
        if (scores[i]! >= lpeak) lpeak = scores[i]!;
        else break;
      }
      let rpeak = gapscore;
      for (let i = index; i < scores.length; i++) {
        if (scores[i]! >= rpeak) rpeak = scores[i]!;
        else break;
      }
      depthScores[index] = lpeak + rpeak - 2 * gapscore;
      index += 1;
    }
    return depthScores;
  }

  private identifyBoundaries(depthScores: number[]): number[] {
    const boundaries = new Array<number>(depthScores.length).fill(0);
    const avg = depthScores.reduce((a, b) => a + b, 0) / depthScores.length;
    const variance = depthScores.reduce((a, b) => a + (b - avg) ** 2, 0) / depthScores.length;
    const stdev = Math.sqrt(variance);

    const cutoff = this.cutoffPolicy === LC ? avg - stdev : avg - stdev / 2.0;

    const depthTuples = depthScores
      .map((score, idx) => [score, idx] as [number, number])
      .sort((a, b) => a[0] - b[0])
      .reverse();
    const hp = depthTuples.filter(([score]) => score > cutoff);

    for (const [, dtIdx] of hp) {
      boundaries[dtIdx] = 1;
      for (const [, dt2] of hp) {
        if (
          dtIdx !== dt2 &&
          Math.abs(dt2 - dtIdx) < 4 &&
          boundaries[dt2] === 1
        ) {
          boundaries[dtIdx] = 0;
        }
      }
    }
    return boundaries;
  }

  private normalizeBoundaries(text: string, boundaries: number[], paragraphBreaks: number[]): number[] {
    const normBoundaries: number[] = [];
    let charCount = 0;
    let wordCount = 0;
    let gapsSeen = 0;
    let seenWord = false;

    for (const char of text) {
      charCount += 1;
      if ((char === " " || char === "\t" || char === "\n") && seenWord) {
        seenWord = false;
        wordCount += 1;
      }
      if (!(char === " " || char === "\t" || char === "\n") && !seenWord) {
        seenWord = true;
      }
      if (gapsSeen < boundaries.length && wordCount > Math.max(gapsSeen * this.w, this.w)) {
        if (boundaries[gapsSeen] === 1) {
          let bestFit = text.length;
          let bestbr: number | undefined;
          for (const br of paragraphBreaks) {
            if (bestFit > Math.abs(br - charCount)) {
              bestFit = Math.abs(br - charCount);
              bestbr = br;
            } else break;
          }
          if (bestbr !== undefined && !normBoundaries.includes(bestbr)) normBoundaries.push(bestbr);
        }
        gapsSeen += 1;
      }
    }
    return normBoundaries;
  }
}
