/**
 * Honest unsupported stubs for nltk.parse surfaces not yet ported:
 * feature-chart/incremental/earley rule machinery, probabilistic chart
 * parsers, dependency-parser internals, transition-parser state, and
 * external-binary/server-bound parsers. Every surface throws a clear
 * error rather than falsely claiming parity.
 */
import { pyError } from "./internals";

function unsupported(name: string, why: string): never {
  throw pyError("NotImplementedError", `${name}: ${why}`);
}

export { CoreNLPServerError } from "./ext_subprocess";

// Feature-chart machinery ported to parse_feature.ts (FeatStruct internals in
// featstruct.ts); names stay routed through this module so reviewed
// provenance is stable.
export {
  FeatStructNonterminal, FeatureChart, FeatureIncrementalChart, FeatureTreeEdge,
  InstantiateVarsChart, FeatureFundamentalRule, FeatureSingleEdgeFundamentalRule,
  FeatureBottomUpPredictRule, FeatureBottomUpPredictCombineRule, FeatureTopDownInitRule,
  FeatureTopDownPredictRule, FeatureEmptyPredictRule, FeatureScannerRule,
  FeaturePredictorRule, FeatureCompleterRule, FeatureCompleteFundamentalRule,
  FeatureBottomUpChartParser, FeatureBottomUpLeftCornerChartParser, FeatureTopDownChartParser,
  FeatureIncrementalChartParser, FeatureIncrementalBottomUpChartParser,
  FeatureIncrementalBottomUpLeftCornerChartParser, FeatureIncrementalTopDownChartParser,
  FeatureGrammar,
} from "./parse_feature";
export { find_variables, unify } from "./featstruct";

// Incremental/Earley chart machinery ported to parse_earley.ts; names stay
// routed through this module so reviewed provenance is stable.

export { TestGrammar } from "./parse_stepping";

// Real ports promoted out of the stub set live in parse_dependency /
// parse_dep_parsers / parse_pchart; the export names stay routed through
// this module so reviewed provenance is stable.
export {
  ARC_EAGER, ARC_STANDARD, Configuration, Transition, DependencySpan, ChartCell,
  DependencyScorerI, NaiveBayesDependencyScorer, DemoScorer,
  ProbabilisticTree, ProbabilisticTreeEdge, ProbabilisticLeafEdge,
  extract_test_sentences, extractTestSentences,
} from "./parse_dependency";
export {
  ProjectiveDependencyParser, ProbabilisticProjectiveDependencyParser,
  NonprojectiveDependencyParser, ProbabilisticNonprojectiveParser,
} from "./parse_dep_parsers";
export {
  ProbabilisticFundamentalRule, SingleEdgeProbabilisticFundamentalRule,
  ProbabilisticBottomUpInitRule, ProbabilisticBottomUpPredictRule,
  BottomUpProbabilisticChartParser, InsideChartParser, LongestChartParser,
  RandomChartParser, UnsortedChartParser,
} from "./parse_pchart";
export {
  IncrementalChart, IncrementalChartParser, IncrementalBottomUpChartParser,
  IncrementalBottomUpLeftCornerChartParser, IncrementalLeftCornerChartParser,
  IncrementalTopDownChartParser, PredictorRule, ScannerRule,
  CompleterRule, CompleteFundamentalRule, FilteredCompleteFundamentalRule,
} from "./parse_earley";

export { SteppingRecursiveDescentParser, SteppingShiftReduceParser } from "./parse_stepping";

// Optional-dependency adapters in ext_subprocess.ts: resolve the tool via
// env/config and spawn it; raise Python-exact LookupError/OSError when absent.
export {
  CoreNLPServer, CoreNLPDependencyParser, GenericCoreNLPParser,
  find_jar_iter, try_port, find_dir, find_jars_within_path,
  find_malt_model, find_maltparser, malt_regex_tagger, dot2img,
} from "./ext_subprocess";

export { ZipFilePathPointer as ZipFilePathPointerImpl } from "./data";
import { ZipFilePathPointer as DataZipFilePathPointer } from "./data";
/** Real nltk.data.ZipFilePathPointer (re-exported to keep reviewed provenance). */
export class ZipFilePathPointer extends DataZipFilePathPointer {}
export { transform } from "./parse_stepping";

const DEMO_WHY = "interactive demo or corpus-bound helper; not applicable to the TS runtime contract";
const EXT_WHY = "requires an external binary (MaltParser), unavailable in the JS runtime";
export function run_profile(): never { return unsupported("run_profile", DEMO_WHY); }
export {
  conllDemo, conll_demo, conllFileDemo, conll_file_demo,
  cycleFindingDemo, cycle_finding_demo, dependencygraphDemo, dg_demo,
  nppDemo, npp_demo, hallDemo, hall_demo,
  nonprojectiveConllParseDemo, nonprojective_conll_parse_demo,
  ruleBasedDemo, rule_based_demo, pdpDemo, pdp_demo,
  projectiveRuleParseDemo, projective_rule_parse_demo,
  arityParseDemo, arity_parse_demo,
  projectiveProbParseDemo, projective_prob_parse_demo,
} from "./demos";
export function malt_demo(): never { return unsupported("malt_demo", EXT_WHY); }
