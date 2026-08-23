/**
 * Phrase extraction from word alignments (port of nltk.translate.phrase_based).
 */

export const MAX_PHRASE_EXTRACTION_DEFAULT_LEN = 100;

function isConsistent(
  fStart: number, fEnd: number, eStart: number, eEnd: number,
  alignment: Array<[number, number]>,
): boolean {
  // Check all alignments involving this phrase are inside it, and at least one inside
  let hasInside = false;
  for (const [e, f] of alignment) {
    const eInside = e >= eStart && e < eEnd;
    const fInside = f >= fStart && f < fEnd;
    if (eInside !== fInside) return false;
    if (eInside && fInside) hasInside = true;
  }
  return hasInside;
}

export type PhrasePair = [[number, number], [number, number], string, string];

export function phraseExtraction(
  srctext: string,
  trgtext: string,
  alignment: Array<[number, number]>,
  maxPhraseLength = 0,
): PhrasePair[] {
  const srcToks = srctext.split(/\s+/).filter(Boolean);
  const trgToks = trgtext.split(/\s+/).filter(Boolean);
  const srcLen = srcToks.length, trgLen = trgToks.length;
  if (!maxPhraseLength) {
    maxPhraseLength = Math.max(srcLen, trgLen);
    if (maxPhraseLength > MAX_PHRASE_EXTRACTION_DEFAULT_LEN)
      throw new Error(`phraseExtraction: default maxPhraseLength ${maxPhraseLength} exceeds limit ${MAX_PHRASE_EXTRACTION_DEFAULT_LEN}; pass explicit maxPhraseLength`);
  }
  const bp = new Set<string>();
  const out: PhrasePair[] = [];
  const seen = new Set<string>();

  // Collect all consistent phrase pairs via NLTK's chunk method
  for (let eStart = 0; eStart < srcLen; eStart++) {
    for (let eEnd = Math.min(srcLen, eStart + maxPhraseLength); eEnd > eStart; eEnd--) {
      // Find minimal f span that covers all alignments of [eStart,eEnd)
      let fMin = trgLen, fMax = -1;
      let hasAlign = false;
      for (const [e, f] of alignment) {
        if (e >= eStart && e < eEnd) {
          hasAlign = true;
          if (f < fMin) fMin = f;
          if (f > fMax) fMax = f;
        }
      }
      if (!hasAlign) continue;
      // Check consistency of the minimal span and its expansions up to maxPhraseLength
      for (let fStart = Math.max(0, fMax - maxPhraseLength + 1); fStart <= fMin; fStart++) {
        for (let fEnd = fMax + 1; fEnd <= Math.min(trgLen, fStart + maxPhraseLength); fEnd++) {
          if (fEnd - fStart > maxPhraseLength) continue;
          if (!isConsistent(fStart, fEnd, eStart, eEnd, alignment)) continue;
          const key = `${eStart},${eEnd},${fStart},${fEnd}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const srcPhrase = srcToks.slice(eStart, eEnd).join(" ");
          const trgPhrase = trgToks.slice(fStart, fEnd).join(" ");
          out.push([[eStart, eEnd], [fStart, fEnd], srcPhrase, trgPhrase]);
        }
      }
    }
  }
  void bp;
  return out.sort((a,b) => a[0][0]-b[0][0] || a[0][1]-b[0][1] || a[1][0]-b[1][0] || a[1][1]-b[1][1]);
}

export function extract(
  srctext: string, trgtext: string, alignment: Array<[number, number]>, maxPhraseLength = 7,
): PhrasePair[] {
  return phraseExtraction(srctext, trgtext, alignment, maxPhraseLength);
}
