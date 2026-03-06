import { expect, test } from "bun:test";
import {
  CFG,
  ChartParser,
  EarleyChartParser,
  FeatureCFG,
  FeatureChartParser,
  FeatureEarleyChartParser,
  LeftCornerChartParser,
  PCFG,
  PerceptronTagger,
  RecursiveDescentParser,
  ViterbiParser,
  chartParse,
  earleyParse,
  featureChartParse,
  featureEarleyParse,
  leftCornerParse,
  parseCfgGrammar,
  parseFeatureCfgGrammar,
  parsePcfgGrammar,
  posTagPerceptronAscii,
  pos_tag,
  probabilisticChartParse,
  recursiveDescentParse,
} from "../index";

const CFG_TEXT = `
S -> NP VP
NP -> 'john' | 'mary'
VP -> V NP
V -> 'likes'
`;

const PCFG_TEXT = `
S -> NP VP [1.0]
NP -> 'john' [0.5] | 'mary' [0.5]
VP -> V NP [1.0]
V -> 'likes' [1.0]
`;

const FEATURE_CFG_TEXT = `
S[] -> NP[NUM=?n] VP[NUM=?n]
NP[NUM=sg] -> 'dog'
NP[NUM=pl] -> 'dogs'
VP[NUM=sg] -> 'runs'
VP[NUM=pl] -> 'run'
`;

test("CFG/PCFG convenience wrappers parse from strings", () => {
  expect(CFG.fromstring(CFG_TEXT).grammar).toEqual(parseCfgGrammar(CFG_TEXT));
  expect(PCFG.fromstring(PCFG_TEXT).grammar).toEqual(parsePcfgGrammar(PCFG_TEXT));
  expect(FeatureCFG.fromstring(FEATURE_CFG_TEXT).grammar).toEqual(parseFeatureCfgGrammar(FEATURE_CFG_TEXT));
});

test("Chart-family parser wrappers match existing parser functions", () => {
  const tokens = ["john", "likes", "mary"];
  const grammar = parseCfgGrammar(CFG_TEXT);

  expect(new ChartParser(grammar).parse(tokens)).toEqual(chartParse(tokens, grammar));
  expect(new EarleyChartParser(grammar).parse(tokens)).toEqual(earleyParse(tokens, grammar));
  expect(new RecursiveDescentParser(grammar).parse(tokens)).toEqual(recursiveDescentParse(tokens, grammar));
  expect(new LeftCornerChartParser(grammar).parse(tokens)).toEqual(leftCornerParse(tokens, grammar));
  expect(new ChartParser(grammar).parseOne(tokens)).toEqual(chartParse(tokens, grammar)[0]!);
});

test("ViterbiParser wrapper matches probabilistic chart parser", () => {
  const tokens = ["john", "likes", "mary"];
  const grammar = parsePcfgGrammar(PCFG_TEXT);
  const wrapper = new ViterbiParser(grammar);
  expect(wrapper.parseOne(tokens)).toEqual(probabilisticChartParse(tokens, grammar));
});

test("Feature parser wrappers match existing feature parser functions", () => {
  const tokens = ["dog", "runs"];
  const grammar = parseFeatureCfgGrammar(FEATURE_CFG_TEXT);
  expect(new FeatureChartParser(grammar).parse(tokens)).toEqual(featureChartParse(tokens, grammar));
  expect(new FeatureEarleyChartParser(grammar).parse(tokens)).toEqual(featureEarleyParse(tokens, grammar));
});

test("PerceptronTagger and pos_tag expose tuple-based tagging APIs", () => {
  const tagger = new PerceptronTagger();
  const tokens = ["John", "runs", "fast"];
  const expected = posTagPerceptronAscii(tokens.join(" ")).map((row) => [row.token, row.tag]);
  expect(tagger.tag(tokens)).toEqual(expected);
  expect(tagger.tag_sents([tokens, ["Mary", "runs"]])).toEqual([
    expected,
    posTagPerceptronAscii("Mary runs").map((row) => [row.token, row.tag]),
  ]);
  expect(pos_tag(tokens)).toEqual(expected);
});
