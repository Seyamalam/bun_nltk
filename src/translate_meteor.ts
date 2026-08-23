/**
 * METEOR score (port of nltk.translate.meteor_score).
 *
 * Alignment stages: exact match -> Porter-stem match -> WordNet synonym
 * match. The synonym stage is optional: pass a WordNet instance (from
 * loadWordNet) to enable it; when omitted, only exact + stem matching run,
 * which reproduces NLTK's scores whenever synonyms add no matches.
 *
 * Lavie & Agarwal (2007), "Meteor: An Automatic Metric for MT Evaluation…"
 */
import { porterStemAscii } from "./native";
import type { WordNet } from "./wordnet";

/** Minimal stemmer interface matching NLTK's StemmerI. */
export interface MeteorStemmer {
  stem(word: string): string;
}

/** Default METEOR stemmer backed by the native Porter stemmer (NLTK default). */
class NativePorterStemmer implements MeteorStemmer {
  stem(word: string): string {
    return porterStemAscii(word);
  }
}

function defaultStemmer(): MeteorStemmer {
  return new NativePorterStemmer();
}

type EnumPair = [index: number, word: string];
export type MatchPair = [hypIdx: number, refIdx: number];

function generateEnums(
  hypothesis: string[],
  reference: string[],
  preprocess: (w: string) => string = (w) => w.toLowerCase(),
): [EnumPair[], EnumPair[]] {
  if (typeof hypothesis === "string") {
    throw new TypeError(`"hypothesis" expects pre-tokenized hypothesis (string[]): ${hypothesis}`);
  }
  if (typeof reference === "string") {
    throw new TypeError(`"reference" expects pre-tokenized reference (string[]): ${reference}`);
  }
  return [
    hypothesis.map((w, i) => [i, preprocess(w)] as EnumPair),
    reference.map((w, i) => [i, preprocess(w)] as EnumPair),
  ];
}

function matchEnums(
  enumHypothesisList: EnumPair[],
  enumReferenceList: EnumPair[],
): [MatchPair[], EnumPair[], EnumPair[]] {
  const wordMatch: MatchPair[] = [];
  // Reference positions per surface form, ascending; popping the highest
  // available position mirrors NLTK's reverse j-scan.
  const refPositions = new Map<string, number[]>();
  for (let j = 0; j < enumReferenceList.length; j++) {
    const w = enumReferenceList[j]![1];
    const list = refPositions.get(w);
    if (list) list.push(j);
    else refPositions.set(w, [j]);
  }

  const matchedHyp = new Set<number>();
  const matchedRef = new Set<number>();
  for (let i = enumHypothesisList.length - 1; i >= 0; i--) {
    const word = enumHypothesisList[i]![1];
    const positions = refPositions.get(word);
    if (positions && positions.length > 0) {
      const j = positions.pop()!;
      matchedHyp.add(i);
      matchedRef.add(j);
      wordMatch.push([enumHypothesisList[i]![0], enumReferenceList[j]![0]]);
    }
  }

  return [
    wordMatch,
    enumHypothesisList.filter((_, i) => !matchedHyp.has(i)),
    enumReferenceList.filter((_, j) => !matchedRef.has(j)),
  ];
}

/**
 * Exact word match between hypothesis and reference.
 */
export function exactMatch(
  hypothesis: string[],
  reference: string[],
): [MatchPair[], EnumPair[], EnumPair[]] {
  const [h, r] = generateEnums(hypothesis, reference);
  return matchEnums(h, r);
}

function enumStemMatch(
  enumHypothesisList: EnumPair[],
  enumReferenceList: EnumPair[],
  stemmer: { stem(word: string): string },
): [MatchPair[], EnumPair[], EnumPair[]] {
  const stemmedHyp = enumHypothesisList.map(
    ([i, w]) => [i, stemmer.stem(w)] as EnumPair,
  );
  const stemmedRef = enumReferenceList.map(([j, w]) => [j, stemmer.stem(w)] as EnumPair);
  return matchEnums(stemmedHyp, stemmedRef);
}

/**
 * Stem-based match using the given stemmer (default Porter).
 */
export function stemMatch(
  hypothesis: string[],
  reference: string[],
  stemmer: MeteorStemmer = defaultStemmer(),
): [MatchPair[], EnumPair[], EnumPair[]] {
  const [h, r] = generateEnums(hypothesis, reference);
  return enumStemMatch(h, r, stemmer);
}

function enumWordnetSynMatch(
  enumHypothesisList: EnumPair[],
  enumReferenceList: EnumPair[],
  wordnet: WordNet,
): [MatchPair[], EnumPair[], EnumPair[]] {
  const wordMatch: MatchPair[] = [];
  const refPositions = new Map<string, number[]>();
  for (let j = 0; j < enumReferenceList.length; j++) {
    const w = enumReferenceList[j]![1];
    const list = refPositions.get(w);
    if (list) list.push(j);
    else refPositions.set(w, [j]);
  }

  const matchedHyp = new Set<number>();
  const matchedRef = new Set<number>();
  for (let i = enumHypothesisList.length - 1; i >= 0; i--) {
    const hypWord = enumHypothesisList[i]![1];
    // Synonym set: lemma names (no underscores) from all synsets + the word itself
    const syns = new Set<string>([hypWord]);
    let synsets: Array<{ synset: { lemmas: Array<{ lemma: string }> } }> = [];
    try {
      synsets = wordnet.synsets(hypWord) as unknown as typeof synsets;
    } catch {
      synsets = [];
    }
    for (const row of synsets) {
      for (const lemma of row.synset.lemmas) {
        if (!lemma.lemma.includes("_")) syns.add(lemma.lemma.toLowerCase());
      }
    }

    let bestJ = -1;
    let bestWord: string | undefined;
    for (const syn of syns) {
      const positions = refPositions.get(syn);
      if (positions && positions.length > 0 && positions[positions.length - 1]! > bestJ) {
        bestJ = positions[positions.length - 1]!;
        bestWord = syn;
      }
    }
    if (bestWord !== undefined) {
      refPositions.get(bestWord)!.pop();
      matchedHyp.add(i);
      matchedRef.add(bestJ);
      wordMatch.push([enumHypothesisList[i]![0], enumReferenceList[bestJ]![0]]);
    }
  }

  return [
    wordMatch,
    enumHypothesisList.filter((_, i) => !matchedHyp.has(i)),
    enumReferenceList.filter((_, j) => !matchedRef.has(j)),
  ];
}

/**
 * WordNet-synonym match. Requires a loaded WordNet instance.
 */
export function wordnetsynMatch(
  hypothesis: string[],
  reference: string[],
  wordnet: WordNet,
): [MatchPair[], EnumPair[], EnumPair[]] {
  const [h, r] = generateEnums(hypothesis, reference);
  return enumWordnetSynMatch(h, r, wordnet);
}

function enumAlignWords(
  enumHypothesisList: EnumPair[],
  enumReferenceList: EnumPair[],
  stemmer: { stem(word: string): string },
  wordnet?: WordNet,
): [MatchPair[], EnumPair[], EnumPair[]] {
  const [exactMatches, h1, r1] = matchEnums(enumHypothesisList, enumReferenceList);
  const [stemMatches, h2, r2] = enumStemMatch(h1, r1, stemmer);
  const [wnsMatches, h3, r3] =
    wordnet !== undefined ? enumWordnetSynMatch(h2, r2, wordnet) : [[], h2, r2] as [MatchPair[], EnumPair[], EnumPair[]];

  const all = [...exactMatches, ...stemMatches, ...wnsMatches];
  all.sort((a, b) => a[0] - b[0]);
  return [all, h3, r3];
}

/**
 * Align words via sequential exact → stem → WordNet-synonym matching.
 */
export function alignWords(
  hypothesis: string[],
  reference: string[],
  options: { stemmer?: MeteorStemmer; wordnet?: WordNet } = {},
): [MatchPair[], EnumPair[], EnumPair[]] {
  const [h, r] = generateEnums(hypothesis, reference);
  return enumAlignWords(h, r, options.stemmer ?? defaultStemmer(), options.wordnet);
}

/** Fewest adjacent chunks among matched unigrams (fragmentation term). */
export function countChunks(matches: MatchPair[]): number {
  let i = 0;
  let chunks = 1;
  while (i < matches.length - 1) {
    if (matches[i + 1]![0] === matches[i]![0] + 1 && matches[i + 1]![1] === matches[i]![1] + 1) {
      i += 1;
      continue;
    }
    i += 1;
    chunks += 1;
  }
  return chunks;
}

export interface MeteorOptions {
  preprocess?: (w: string) => string;
  stemmer?: MeteorStemmer;
  wordnet?: WordNet;
  alpha?: number;
  beta?: number;
  gamma?: number;
}

/**
 * Sentence-level METEOR score for a single hypothesis/reference pair.
 * Returns 0.0 when there are no matches (NLTK's ZeroDivisionError path).
 */
export function singleMeteorScore(
  reference: string[],
  hypothesis: string[],
  options: MeteorOptions = {},
): number {
  const {
    preprocess = (w) => w.toLowerCase(),
    stemmer = defaultStemmer(),
    wordnet,
    alpha = 0.9,
    beta = 3.0,
    gamma = 0.5,
  } = options;

  const [enumHypothesis, enumReference] = generateEnums(hypothesis, reference, preprocess);
  const translationLength = enumHypothesis.length;
  const referenceLength = enumReference.length;
  const [matches] = enumAlignWords(enumHypothesis, enumReference, stemmer, wordnet);
  const matchesCount = matches.length;

  if (matchesCount === 0 || translationLength === 0 || referenceLength === 0) return 0.0;

  const precision = matchesCount / translationLength;
  const recall = matchesCount / referenceLength;
  const fmean = (precision * recall) / (alpha * precision + (1 - alpha) * recall);
  const chunkCount = countChunks(matches);
  const fragFrac = chunkCount / matchesCount;
  const penalty = gamma * Math.pow(fragFrac, beta);
  return (1 - penalty) * fmean;
}

/**
 * METEOR score against multiple references — the best per-reference score wins.
 */
export function meteorScore(
  references: string[][],
  hypothesis: string[],
  options: MeteorOptions = {},
): number {
  let best = 0.0;
  for (const reference of references) {
    const score = singleMeteorScore(reference, hypothesis, options);
    if (score > best) best = score;
  }
  return best;
}
