/**
 * CRF tagger shim (port of nltk.tag.crf).
 *
 * Thin wrapper around python-crfsuite (pycrfsuite) — an external binary
 * unavailable in the JS runtime. Preserves the full typed API surface so
 * imports and isinstance checks remain valid; runtime calls throw with a
 * helpful message (consistent with src/classify_wrappers.ts).
 */

function externalError(name: string): never {
  throw new Error(
    `${name} requires python-crfsuite (pycrfsuite), an external binary not available in the JS runtime. ` +
      `Install it in Python and use NLTK directly: pip install python-crfsuite (see https://pypi.org/project/python-crfsuite/).`,
  );
}

export type CrfFeatureFunc = (tokens: string[], idx: number) => string[];
export type CrfTrainingOptions = Record<string, unknown>;

export class CRFTagger {
  constructor(
    _featureFunc?: CrfFeatureFunc | null,
    _verbose?: boolean,
    _trainingOpt?: CrfTrainingOptions | null,
  ) {
    void _featureFunc;
    void _verbose;
    void _trainingOpt;
    externalError("nltk.tag.crf.CRFTagger");
  }

  setModelFile(_modelFile: string): void {
    return externalError("CRFTagger.setModelFile");
  }
  set_model_file(_modelFile: string): void {
    return externalError("CRFTagger.set_model_file");
  }

  tagSents(_sentences: string[][]): Array<Array<[string, string]>> {
    return externalError("CRFTagger.tagSents");
  }
  tag_sents(_sentences: string[][]): Array<Array<[string, string]>> {
    return externalError("CRFTagger.tag_sents");
  }

  tag(_tokens: string[]): Array<[string, string]> {
    return externalError("CRFTagger.tag");
  }

  train(_trainData: Array<Array<[string, string]>>, _modelFile: string): void {
    return externalError("CRFTagger.train");
  }

  clearFeatureCache(): void {
    return externalError("CRFTagger.clearFeatureCache");
  }
  clear_feature_cache(): void {
    return externalError("CRFTagger.clear_feature_cache");
  }

  accuracy(_goldSentences: Array<Array<[string, string]>>): number {
    return externalError("CRFTagger.accuracy");
  }
}
