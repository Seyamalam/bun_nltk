import { FreqDist, SentimentIntensityAnalyzer, sentenceTokenizePunkt } from "bun_nltk";
import {
  computeAsciiMetrics,
  ngramsAsciiNative,
  normalizeTokensAsciiNative,
  tokenizeAscii,
} from "bun_nltk/tokenize";

const MAX_TEXT_BYTES = 1_000_000;
const DEFAULT_OPTIONS = Object.freeze({ ngramSize: 2, topK: 12 });
const encoder = new TextEncoder();
const sentimentAnalyzer = new SentimentIntensityAnalyzer();

function integerOption(value, fallback, minimum, maximum, name) {
  const resolved = value ?? fallback;
  if (!Number.isInteger(resolved) || resolved < minimum || resolved > maximum) {
    throw new TypeError(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return resolved;
}

export function validateAnalysisRequest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("request body must be a JSON object");
  }
  if (typeof value.text !== "string" || value.text.trim().length === 0) {
    throw new TypeError("text must be a non-empty string");
  }

  const bytes = encoder.encode(value.text).length;
  if (bytes > MAX_TEXT_BYTES) {
    throw new RangeError(`text exceeds the ${MAX_TEXT_BYTES.toLocaleString()} byte limit`);
  }

  return {
    text: value.text,
    ngramSize: integerOption(value.ngramSize, DEFAULT_OPTIONS.ngramSize, 2, 4, "ngramSize"),
    topK: integerOption(value.topK, DEFAULT_OPTIONS.topK, 1, 50, "topK"),
  };
}

function rankedFrequency(values, limit) {
  return new FreqDist(values).mostCommon(limit).map(([value, count]) => ({ value, count }));
}

function sentenceReport(sentence) {
  const tokens = tokenizeAscii(sentence);
  return {
    text: sentence,
    tokens: tokens.length,
    sentiment: sentimentAnalyzer.polarityScores(sentence),
  };
}

export function analyzeDocument(request) {
  const { text, ngramSize, topK } = validateAnalysisRequest(request);
  const started = performance.now();

  const sentences = sentenceTokenizePunkt(text).map(sentenceReport);
  const tokens = tokenizeAscii(text);
  const normalizedTokens = normalizeTokensAsciiNative(text, true);
  const ngrams = ngramsAsciiNative(text, ngramSize).map((parts) => parts.join(" "));
  const metrics = computeAsciiMetrics(text, ngramSize);
  const elapsedMs = performance.now() - started;

  return {
    meta: {
      backend: "bun_nltk native with TypeScript compatibility APIs",
      elapsedMs: Number(elapsedMs.toFixed(3)),
      generatedAt: new Date().toISOString(),
    },
    document: {
      characters: text.length,
      bytes: encoder.encode(text).length,
      sentences: sentences.length,
      tokens: metrics.tokens,
      uniqueTokens: metrics.uniqueTokens,
      lexicalDiversity: metrics.tokens === 0 ? 0 : Number((metrics.uniqueTokens / metrics.tokens).toFixed(4)),
      averageTokensPerSentence:
        sentences.length === 0 ? 0 : Number((tokens.length / sentences.length).toFixed(2)),
    },
    sentiment: sentimentAnalyzer.polarityScores(text),
    keywords: rankedFrequency(normalizedTokens, topK),
    ngrams: {
      size: ngramSize,
      total: metrics.ngrams,
      unique: metrics.uniqueNgrams,
      mostCommon: rankedFrequency(ngrams, topK),
    },
    sentences,
  };
}

export const limits = Object.freeze({ maxTextBytes: MAX_TEXT_BYTES, maxBatchItems: 20 });

