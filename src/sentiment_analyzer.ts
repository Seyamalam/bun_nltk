/**
 * Sentiment analyzer shim (port of nltk.sentiment.sentiment_analyzer).
 *
 * SentimentAnalyzer is a thin teaching/demo wrapper around NLTK
 * classifiers and collocation helpers. While its core logic is pure
 * Python, it is not a standalone metric — it requires a trained
 * classifier (NaiveBayes, Maxent, etc.) and NLTK's collocation/
 * probability machinery. The fully-native VADER analyzer lives in
 * src/sentiment.ts; this shim preserves the SentimentAnalyzer API
 * surface with typed stubs so imports stay valid in the JS runtime.
 *
 * Consistent with src/classify_wrappers.ts and src/tag_crf.ts: calling
 * any method throws a helpful error noting the external dependency.
 */

function externalError(name: string): never {
  throw new Error(
    `${name} is part of nltk.sentiment.sentiment_analyzer, a teaching/demo wrapper that requires a trained NLTK classifier. ` +
      `Use the native VADER SentimentIntensityAnalyzer from src/sentiment.ts for pure-JS sentiment, or run NLTK in Python. ` +
      `See https://www.nltk.org/api/nltk.sentiment.html`,
  );
}

export type LabeledDocument = [words: string[], label: string];
export type FeatureDict = Record<string, unknown>;
export type FeatureExtractor = (document: string[], ...args: unknown[]) => FeatureDict;
export type ClassifierLike = { classify(feats: FeatureDict): string };
export type TrainerFn = (trainingSet: Array<[FeatureDict, string]>, ...args: unknown[]) => ClassifierLike;

export class SentimentAnalyzer {
  featExtractors: Map<FeatureExtractor, unknown[]> = new Map();
  classifier: ClassifierLike | null;

  constructor(_classifier?: ClassifierLike | null) {
    void _classifier;
    // Construction itself is allowed so `new SentimentAnalyzer()` doesn't throw at import time
    // (mirrors Python where __init__ is trivial). Methods throw on use.
    this.classifier = _classifier ?? null;
  }

  allWords(_documents: Array<LabeledDocument | string[]>, _labeled?: boolean | null): string[] {
    return externalError("SentimentAnalyzer.allWords");
  }
  all_words(_documents: Array<LabeledDocument | string[]>, _labeled?: boolean | null): string[] {
    return externalError("SentimentAnalyzer.all_words");
  }

  applyFeatures(_documents: unknown, _labeled?: boolean | null): unknown {
    return externalError("SentimentAnalyzer.applyFeatures");
  }
  apply_features(_documents: unknown, _labeled?: boolean | null): unknown {
    return externalError("SentimentAnalyzer.apply_features");
  }

  unigramWordFeats(_words: string[], _topN?: number | null, _minFreq?: number): string[] {
    return externalError("SentimentAnalyzer.unigramWordFeats");
  }
  unigram_word_feats(_words: string[], _topN?: number | null, _minFreq?: number): string[] {
    return externalError("SentimentAnalyzer.unigram_word_feats");
  }

  bigramCollocationFeats(
    _documents: string[][],
    _topN?: number | null,
    _minFreq?: number,
    _assocMeasure?: unknown,
  ): Array<[string, string]> {
    return externalError("SentimentAnalyzer.bigramCollocationFeats");
  }
  bigram_collocation_feats(
    _documents: string[][],
    _topN?: number | null,
    _minFreq?: number,
    _assocMeasure?: unknown,
  ): Array<[string, string]> {
    return externalError("SentimentAnalyzer.bigram_collocation_feats");
  }

  classify(_instance: string[]): string {
    return externalError("SentimentAnalyzer.classify");
  }

  addFeatExtractor(_fn: FeatureExtractor, ..._kwargs: unknown[]): void {
    return externalError("SentimentAnalyzer.addFeatExtractor");
  }
  add_feat_extractor(_fn: FeatureExtractor, ..._kwargs: unknown[]): void {
    return externalError("SentimentAnalyzer.add_feat_extractor");
  }

  extractFeatures(_document: string[]): FeatureDict {
    return externalError("SentimentAnalyzer.extractFeatures");
  }
  extract_features(_document: string[]): FeatureDict {
    return externalError("SentimentAnalyzer.extract_features");
  }

  train(_trainer: TrainerFn, _trainingSet: unknown, _saveClassifier?: string | null, ..._kwargs: unknown[]): ClassifierLike {
    return externalError("SentimentAnalyzer.train");
  }

  saveFile(_content: unknown, _filename: string): void {
    return externalError("SentimentAnalyzer.saveFile");
  }
  save_file(_content: unknown, _filename: string): void {
    return externalError("SentimentAnalyzer.save_file");
  }

  evaluate(
    _testSet: Array<[FeatureDict, string]>,
    _classifier?: ClassifierLike | null,
    _accuracy?: boolean,
    _fMeasure?: boolean,
    _precision?: boolean,
    _recall?: boolean,
    _verbose?: boolean,
  ): Record<string, number> {
    return externalError("SentimentAnalyzer.evaluate");
  }
}
