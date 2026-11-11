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
  leftCornerParse,
  parseCfgGrammar,
  parseFeatureCfgGrammar,
  parsePcfgGrammar,
  posTagPerceptronAscii,
  pos_tag,
  probabilisticChartParse,
  recursiveDescentParse,
} from "../index";
import type { ParseTree } from "../src/parse";

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

test("Feature parser wrappers match the real feature-chart parsers", () => {
  const tokens = ["dog", "runs"];
  const grammar = parseFeatureCfgGrammar(FEATURE_CFG_TEXT);
  const expected = [{ label: "S[]", children: [
    { label: "NP[NUM='sg']", children: ["dog"] },
    { label: "VP[NUM='sg']", children: ["runs"] },
  ] }];
  const norm = (trees: ReturnType<typeof featureChartParse>) =>
    trees.map((t) => ({
      label: String(t.label),
      children: t.children.map((c) => (typeof c === "string" ? c : { label: String((c as ParseTree).label), children: (c as ParseTree).children })),
    }));
  expect(norm(new FeatureChartParser(grammar).parse(tokens))).toEqual(expected);
  expect(norm(new FeatureEarleyChartParser(grammar).parse(tokens))).toEqual(expected);
});

test("PerceptronTagger and pos_tag expose tuple-based tagging APIs", () => {
  const tagger = new PerceptronTagger();
  const tokens = ["John", "runs", "fast"];
  const expected = posTagPerceptronAscii(tokens.join(" ")).map((row) => [row.token, row.tag]);
  expect(tagger.tag(tokens) as unknown as typeof expected).toEqual(expected as unknown as [string, string][]);
  expect(tagger.tag_sents([tokens, ["Mary", "runs"]]) as unknown as [string, string][][]).toEqual([
    expected,
    posTagPerceptronAscii("Mary runs").map((row) => [row.token, row.tag]),
  ] as unknown as [string, string][][]);
  expect(pos_tag(tokens) as unknown as typeof expected).toEqual(expected as unknown as [string, string][]);
});
