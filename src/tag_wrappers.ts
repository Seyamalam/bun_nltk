/**
 * External POS tagger wrappers (ports of nltk.tag.stanford/hunpos/senna).
 */

function externalError(name: string): never {
  throw new Error(`${name} requires an external binary (Stanford Tagger / HunPos / SENNA) not available in the JS runtime.`);
}

export class StanfordPOSTagger {
  constructor(_pathToModel?: string, _pathToJar?: string) { void _pathToModel; void _pathToJar; }
  tag(_tokens: string[]): Array<[string,string]> { return externalError("StanfordPOSTagger.tag"); }
}
export class StanfordNERTagger extends StanfordPOSTagger {}
export class HunPosTagger {
  constructor(_pathToModel?: string, _pathToBin?: string) { void _pathToModel; void _pathToBin; }
  tag(_tokens: string[]): Array<[string,string]> { return externalError("HunPosTagger.tag"); }
}
export class SennaTagger {
  constructor(_pathToSenna?: string) { void _pathToSenna; }
  tag(_tokens: string[]): Array<[string,string]> { return externalError("SennaTagger.tag"); }
}
export class SennaChunkTagger extends SennaTagger {}
export class SennaNERTagger extends SennaTagger {}
