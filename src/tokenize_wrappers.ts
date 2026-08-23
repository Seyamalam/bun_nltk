/**
 * External tokenizer wrappers (ports of nltk.tokenize.stanford/repp/stanford_segmenter).
 */

function externalError(name: string): never {
  throw new Error(`${name} requires an external binary (Stanford Segmenter / REPP) not available in the JS runtime.`);
}

export class StanfordTokenizer {
  constructor(_pathToJar?: string, _options?: unknown) { void _pathToJar; void _options; }
  tokenize(_text: string): string[] { return externalError("StanfordTokenizer.tokenize"); }
}
export class StanfordSegmenter {
  constructor(_pathToJar?: string, _pathToSihanCorporaDict?: string, _pathToModel?: string) { void _pathToJar; void _pathToSihanCorporaDict; void _pathToModel; }
  tokenize(_text: string): string[] { return externalError("StanfordSegmenter.tokenize"); }
  segment(_text: string): string[] { return externalError("StanfordSegmenter.segment"); }
}
export class ReppTokenizer {
  constructor(_repp?: string) { void _repp; }
  tokenize(_text: string): string[] { return externalError("ReppTokenizer.tokenize"); }
}
