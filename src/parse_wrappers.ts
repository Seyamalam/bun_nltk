/**
 * External parser wrappers (ports of nltk.parse.bllip/corenlp/malt/stanford/transitionparser/shiftreduce).
 */

function externalError(name: string): never {
  throw new Error(`${name} requires an external binary (BLLIP / CoreNLP / Malt / Stanford Parser) not available in the JS runtime.`);
}

export { BllipParser, CoreNLPParser, MaltParser } from "./ext_subprocess";

export class StanfordParser {
  constructor(_pathToJar?: string, _pathToModel?: string) { void _pathToJar; void _pathToModel; }
  parse(_tokens: string[]): unknown { return externalError("StanfordParser.parse"); }
  rawParse(_sentence: string): unknown { return externalError("StanfordParser.rawParse"); }
}
export class TransitionParser {
  static readonly ARC_STANDARD = "arc-standard";
  static readonly ARC_EAGER = "arc-eager";
  constructor(..._args: unknown[]) { void _args; }
  parse(_tokens: string[]): unknown { return externalError("TransitionParser.parse"); }
}
export class ShiftReduceParser {
  constructor(_grammar: unknown) { void _grammar; }
  parse(_tokens: string[]): unknown { return externalError("ShiftReduceParser.parse"); }
}

/** nltk.parse.transitionparser.demo — docstring-only doctest holder; calling it is a no-op. */
export function demo(): void {}
