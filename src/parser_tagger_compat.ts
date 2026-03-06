import {
  chartParse,
  earleyParse,
  leftCornerParse,
  parseCfgGrammar,
  parsePcfgGrammar,
  probabilisticChartParse,
  recursiveDescentParse,
  type CfgGrammar,
  type ParseTree,
  type PcfgGrammar,
  type ProbabilisticParse,
} from "./parse";
import {
  featureChartParse,
  featureEarleyParse,
  parseFeatureCfgGrammar,
  type FeatureCfgGrammar,
} from "./feature_parse";
import {
  loadPerceptronTaggerModel,
  posTagPerceptronAscii,
  type PerceptronTaggedToken,
  type PerceptronTaggerModel,
} from "./perceptron_tagger";

function joinTokens(tokens: string[]): string {
  return tokens.join(" ");
}

export class CFG {
  constructor(public readonly grammar: CfgGrammar) {}

  static fromstring(grammarText: string, options?: { startSymbol?: string }): CFG {
    return new CFG(parseCfgGrammar(grammarText, options));
  }
}

export class PCFG {
  constructor(public readonly grammar: PcfgGrammar) {}

  static fromstring(grammarText: string, options?: { startSymbol?: string }): PCFG {
    return new PCFG(parsePcfgGrammar(grammarText, options));
  }
}

export class FeatureCFG {
  constructor(public readonly grammar: FeatureCfgGrammar) {}

  static fromstring(grammarText: string, options?: { startSymbol?: string }): FeatureCFG {
    return new FeatureCFG(parseFeatureCfgGrammar(grammarText, options));
  }
}

function asCfgGrammar(grammar: CFG | CfgGrammar | string): CfgGrammar {
  if (typeof grammar === "string") return parseCfgGrammar(grammar);
  return grammar instanceof CFG ? grammar.grammar : grammar;
}

function asPcfgGrammar(grammar: PCFG | PcfgGrammar | string): PcfgGrammar {
  if (typeof grammar === "string") return parsePcfgGrammar(grammar);
  return grammar instanceof PCFG ? grammar.grammar : grammar;
}

function asFeatureGrammar(grammar: FeatureCFG | FeatureCfgGrammar | string): FeatureCfgGrammar {
  if (typeof grammar === "string") return parseFeatureCfgGrammar(grammar);
  return grammar instanceof FeatureCFG ? grammar.grammar : grammar;
}

export class ChartParser {
  protected readonly grammar: CfgGrammar;

  constructor(grammar: CFG | CfgGrammar | string) {
    this.grammar = asCfgGrammar(grammar);
  }

  parse(tokens: string[]): ParseTree[] {
    return chartParse(tokens, this.grammar);
  }

  parseOne(tokens: string[]): ParseTree | null {
    return this.parse(tokens)[0] ?? null;
  }
}

export class EarleyChartParser extends ChartParser {
  override parse(tokens: string[]): ParseTree[] {
    return earleyParse(tokens, this.grammar);
  }
}

export class RecursiveDescentParser extends ChartParser {
  override parse(tokens: string[]): ParseTree[] {
    return recursiveDescentParse(tokens, this.grammar);
  }
}

export class LeftCornerChartParser extends ChartParser {
  override parse(tokens: string[]): ParseTree[] {
    return leftCornerParse(tokens, this.grammar);
  }
}

export class ViterbiParser {
  private readonly grammar: PcfgGrammar;

  constructor(grammar: PCFG | PcfgGrammar | string) {
    this.grammar = asPcfgGrammar(grammar);
  }

  parse(tokens: string[]): ProbabilisticParse[] {
    const best = probabilisticChartParse(tokens, this.grammar);
    return best ? [best] : [];
  }

  parseOne(tokens: string[]): ProbabilisticParse | null {
    return probabilisticChartParse(tokens, this.grammar);
  }
}

export class FeatureChartParser {
  protected readonly grammar: FeatureCfgGrammar;

  constructor(grammar: FeatureCFG | FeatureCfgGrammar | string) {
    this.grammar = asFeatureGrammar(grammar);
  }

  parse(tokens: string[]): ParseTree[] {
    return featureChartParse(tokens, this.grammar);
  }

  parseOne(tokens: string[]): ParseTree | null {
    return this.parse(tokens)[0] ?? null;
  }
}

export class FeatureEarleyChartParser extends FeatureChartParser {
  override parse(tokens: string[]): ParseTree[] {
    return featureEarleyParse(tokens, this.grammar);
  }
}

export class PerceptronTagger {
  private readonly model: PerceptronTaggerModel;

  constructor(model?: PerceptronTaggerModel | string) {
    this.model = typeof model === "string" || model === undefined ? loadPerceptronTaggerModel(model) : model;
  }

  tag(tokens: string[]): Array<[string, string]> {
    return posTag(joinTokens(tokens), { model: this.model }).map(([token, tag]) => [token, tag]);
  }

  tag_sents(sentences: string[][]): Array<Array<[string, string]>> {
    return sentences.map((sentence) => this.tag(sentence));
  }

  tagText(text: string): Array<[string, string]> {
    return posTag(joinTokens(text.split(/\s+/g).filter(Boolean)), { model: this.model });
  }
}

export function posTag(tokens: string[], options?: { model?: PerceptronTaggerModel | string }): Array<[string, string]>;
export function posTag(text: string, options?: { model?: PerceptronTaggerModel | string }): Array<[string, string]>;
export function posTag(
  value: string[] | string,
  options?: { model?: PerceptronTaggerModel | string },
): Array<[string, string]> {
  const model = typeof options?.model === "string" || options?.model === undefined
    ? loadPerceptronTaggerModel(options?.model)
    : options.model;
  const text = Array.isArray(value) ? joinTokens(value) : value;
  return posTagPerceptronAscii(text, { model }).map((row: PerceptronTaggedToken) => [row.token, row.tag]);
}

export const pos_tag = posTag;
