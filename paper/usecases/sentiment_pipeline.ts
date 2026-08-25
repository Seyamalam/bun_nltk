/**
 * End-to-end sentiment analysis pipeline (movie_reviews style).
 *
 * Loads labeled positive/negative movie reviews from the local NLTK data
 * directory when available (~/nltk_data/corpora/movie_reviews), otherwise
 * falls back to an embedded sample. Extracts bag-of-word presence features,
 * trains a Naive Bayes classifier, evaluates holdout accuracy, and classifies
 * three new review strings.
 *
 * Run: bun run paper/usecases/sentiment_pipeline.ts
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NaiveBayesClassifier } from "../../src/classifier_compat";

type LabeledDoc = { words: string[]; label: string };

const SPLIT_SEED = 1337;

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const EMBEDDED_SAMPLE: Array<{ text: string; label: string }> = [
  { text: "a gorgeous witty delightful comedy with brilliant performances and a smart heartfelt script", label: "pos" },
  { text: "one of the best films of the year excellent direction superb acting and a wonderful story", label: "pos" },
  { text: "an intelligent moving masterpiece the performances are flawless and the ending is perfect", label: "pos" },
  { text: "beautifully shot and wonderfully acted a charming funny film that rewards repeated viewings", label: "pos" },
  { text: "a stunning achievement brilliant screenplay great cast and unforgettable music", label: "pos" },
  { text: "warm funny and touching the best romantic comedy in years highly recommended", label: "pos" },
  { text: "dull predictable and badly acted a waste of time the worst movie of the year", label: "neg" },
  { text: "terrible script boring direction wooden performances avoid this mess at all costs", label: "neg" },
  { text: "a stupid pointless mess the plot makes no sense and the dialogue is laughably bad", label: "neg" },
  { text: "lifeless tedious and unfunny i could not wait for this disaster to end", label: "neg" },
  { text: "the worst film i have seen in years awful acting terrible pacing and a ridiculous plot", label: "neg" },
  { text: "boring cliched and painfully bad skip this garbage and save your money", label: "neg" },
];

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z']+/g) ?? []).filter((w) => w.length >= 2);
}

function loadMovieReviews(): { docs: LabeledDoc[]; source: string } | null {
  const candidates = [
    process.env.NLTK_DATA ? join(process.env.NLTK_DATA, "corpora", "movie_reviews") : null,
    join(process.env.HOME ?? "", "nltk_data", "corpora", "movie_reviews"),
  ].filter((p): p is string => !!p && existsSync(p));

  for (const root of candidates) {
    try {
      const docs: LabeledDoc[] = [];
      const maxPerLabel = 500;
      for (const label of ["pos", "neg"] as const) {
        const dir = join(root, label);
        const files = readdirSync(dir).filter((f) => f.endsWith(".txt")).slice(0, maxPerLabel);
        for (const file of files) {
          const words = tokenize(readFileSync(join(dir, file), "utf8"));
          if (words.length > 0) docs.push({ words, label });
        }
      }
      if (docs.length > 0) return { docs, source: root };
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

function documentFeatures(words: string[], wordFeatures: string[]): Record<string, boolean> {
  // NLTK movie-reviews style: contains(word) = true for every vocabulary word
  // present in the document. Only present words are emitted as features.
  const present = new Set(words);
  const features: Record<string, boolean> = {};
  for (const w of wordFeatures) if (present.has(w)) features[`contains(${w})`] = true;
  return features;
}

// ---------------------------------------------------------------- load data
let docs: LabeledDoc[];
let dataSource: string;
const loaded = loadMovieReviews();
if (loaded) {
  ({ docs } = loaded);
  dataSource = loaded.source;
} else {
  console.warn(
    "[warn] movie_reviews corpus not found under $NLTK_DATA or ~/nltk_data — using an embedded 12-review sample.",
  );
  docs = EMBEDDED_SAMPLE.map((row) => ({ words: tokenize(row.text), label: row.label }));
  dataSource = "embedded sample (movie_reviews corpus not found)";
}

console.log("== Sentiment pipeline: Naive Bayes over movie reviews ==");
console.log(`Corpus source : ${dataSource}`);
console.log(`Documents     : ${docs.length} (${docs.filter((d) => d.label === "pos").length} pos / ${docs.filter((d) => d.label === "neg").length} neg)`);

// ------------------------------------------------- feature extraction + train
const t0 = performance.now();

// Top-N most frequent words become the feature vocabulary (NLTK book style).
const freq = new Map<string, number>();
for (const doc of docs) for (const w of doc.words) freq.set(w, (freq.get(w) ?? 0) + 1);
const wordFeatures = [...freq.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, Math.min(2000, freq.size))
  .map(([w]) => w);

// Shuffle deterministically before splitting (Fisher–Yates).
const splitRng = mulberry32(SPLIT_SEED);
for (let i = docs.length - 1; i > 0; i -= 1) {
  const j = Math.floor(splitRng() * (i + 1));
  [docs[i], docs[j]] = [docs[j]!, docs[i]!];
}
const splitIdx = Math.floor(docs.length * 0.8);
const trainDocs = docs.slice(0, splitIdx);
const testDocs = docs.slice(splitIdx);

const trainSet = trainDocs.map((doc) => [documentFeatures(doc.words, wordFeatures), doc.label] as const);

const classifier = NaiveBayesClassifier.train(trainSet);
const tTrain = performance.now();

// ------------------------------------------------------------------ evaluate
const correct = testDocs.filter((doc) => classifier.classify(documentFeatures(doc.words, wordFeatures)) === doc.label).length;
const accuracy = testDocs.length > 0 ? correct / testDocs.length : 0;
const tEval = performance.now();

console.log(`Vocabulary    : ${wordFeatures.length} word features`);
console.log(`Split seed    : ${SPLIT_SEED}`);
console.log(`Train/test    : ${trainDocs.length}/${testDocs.length} documents`);
console.log(`Holdout accuracy: ${(accuracy * 100).toFixed(2)}% (${correct}/${testDocs.length})`);

// ------------------------------------------------------------- new predictions
const newReviews = [
  "an absolute delight from start to finish brilliant acting and a clever warm story",
  "two hours of my life wasted dull badly paced and painfully unfunny",
  "gorgeous cinematography lifts an otherwise mediocre and predictable script",
];

console.log("\nPredictions for unseen reviews:");
const predictionRows = newReviews.map((review, i) => {
  const dist = classifier.probClassify(documentFeatures(tokenize(review), wordFeatures));
  const pPos = dist.prob("pos");
  const pNeg = dist.prob("neg");
  return {
    "#": i + 1,
    review: review.length > 46 ? `${review.slice(0, 46)}…` : review,
    prediction: pPos >= pNeg ? "pos" : "neg",
    p_pos: Number.isFinite(pPos) ? pPos.toFixed(4) : "-",
    p_neg: Number.isFinite(pNeg) ? pNeg.toFixed(4) : "-",
  };
});
console.table(predictionRows);

const tEnd = performance.now();
console.log("\nTiming:");
console.log(`  feature extraction + training: ${(tTrain - t0).toFixed(1)} ms`);
console.log(`  evaluation (${testDocs.length} docs): ${(tEval - tTrain).toFixed(1)} ms`);
console.log(`  total wall time: ${(tEnd - t0).toFixed(1)} ms`);
