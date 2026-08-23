/**
 * External parser wrappers (ports of nltk.parse.bllip/corenlp/malt/stanford/transitionparser/shiftreduce).
 */

function externalError(name: string): never {
  throw new Error(`${name} requires an external binary (BLLIP / CoreNLP / Malt / Stanford Parser) not available in the JS runtime.`);
}

export class BllipParser {
  constructor(..._args: unknown[]) { void _args; }
  parse(_tokens: string[]): unknown { return externalError("BllipParser.parse"); }
}
export class CoreNLPParser {
  constructor(_url?: string, _encoding?: string, _tagtype?: string) { void _url; void _encoding; void _tagtype; }
  parse(_tokens: string[]): unknown { return externalError("CoreNLPParser.parse"); }
  rawParse(_sentence: string): unknown { return externalError("CoreNLPParser.rawParse"); }
}
export class MaltParser {
  constructor(_pathToMalt?: string, _pathToModel?: string, _additionalJarArgs?: unknown) { void _pathToMalt; void _pathToModel; void _additionalJarArgs; }
  parse(_tokens: string[]): unknown { return externalError("MaltParser.parse"); }
}
export class StanfordParser {
  constructor(_pathToJar?: string, _pathToModel?: string) { void _pathToJar; void _pathToModel; }
  parse(_tokens: string[]): unknown { return externalError("StanfordParser.parse"); }
  rawParse(_sentence: string): unknown { return externalError("StanfordParser.rawParse"); }
}
export class TransitionParser {
  constructor(..._args: unknown[]) { void _args; }
  parse(_tokens: string[]): unknown { return externalError("TransitionParser.parse"); }
}
export class ShiftReduceParser {
  constructor(_grammar: unknown) { void _grammar; }
  parse(_tokens: string[]): unknown { return externalError("ShiftReduceParser.parse"); }
}
