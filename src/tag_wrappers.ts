/**
 * External POS tagger wrappers (ports of nltk.tag.stanford/hunpos/senna).
 */

function externalError(name: string): never {
  throw new Error(`${name} requires an external binary (Stanford Tagger / HunPos / SENNA) not available in the JS runtime.`);
}

/** Port of nltk.tag.stanford.StanfordTagger — base for the POS/NER taggers. */
export class StanfordTagger {
  constructor(_pathToModel?: string, _pathToJar?: string) { void _pathToModel; void _pathToJar; }
  tag(_tokens: string[]): Array<[string,string]> { return externalError("StanfordTagger.tag"); }
}
export class StanfordPOSTagger extends StanfordTagger {}
export class StanfordNERTagger extends StanfordTagger {}

/** Port of nltk.tag.hunpos.HunposTagger (external hunpos-tag binary). */
export class HunposTagger {
  constructor(_pathToModel?: string, _pathToBin?: string) { void _pathToModel; void _pathToBin; }
  tag(_tokens: string[]): Array<[string,string]> { return externalError("HunposTagger.tag"); }
}
/** Backwards-compatible alias kept for the pre-rename export name. */
export const HunPosTagger = HunposTagger;

/** Port of nltk.tag.senna.Senna — base pipeline wrapper. */
export class Senna {
  constructor(_pathToSenna?: string) { void _pathToSenna; }
  tag(_tokens: string[]): Array<[string,string]> { return externalError("Senna.tag"); }
  tag_sents(_sents: Iterable<string[]>): Array<Array<[string,string]>> { return externalError("Senna.tag_sents"); }
}
export class SennaTagger extends Senna {}
export class SennaChunkTagger extends Senna {}
export class SennaNERTagger extends Senna {}
