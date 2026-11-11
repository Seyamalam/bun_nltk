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

export class CoreNLPServerError extends Error {
  constructor(message: string) { super(message); this.name = "CoreNLPServerError"; }
}

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

export class TestGrammar { constructor() { unsupported("TestGrammar", "test-grammar loader not yet ported"); } }

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

const STEP_WHY = "interactive stepping parser UI not applicable to the TS runtime contract";
export class SteppingRecursiveDescentParser { constructor() { unsupported("SteppingRecursiveDescentParser", STEP_WHY); } }
export class SteppingShiftReduceParser { constructor() { unsupported("SteppingShiftReduceParser", STEP_WHY); } }

const EXT_WHY = "requires an external binary/server (CoreNLP, MaltParser), unavailable in the JS runtime";
export class CoreNLPServer { constructor() { unsupported("CoreNLPServer", EXT_WHY); } }
export class CoreNLPDependencyParser { constructor() { unsupported("CoreNLPDependencyParser", EXT_WHY); } }
export class GenericCoreNLPParser { constructor() { unsupported("GenericCoreNLPParser", EXT_WHY); } }
export { ZipFilePathPointer as ZipFilePathPointerImpl } from "./data";
import { ZipFilePathPointer as DataZipFilePathPointer } from "./data";
/** Real nltk.data.ZipFilePathPointer (re-exported to keep reviewed provenance). */
export class ZipFilePathPointer extends DataZipFilePathPointer {}
export function find_jar_iter(): never { return unsupported("find_jar_iter", EXT_WHY); }
export function try_port(): never { return unsupported("try_port", EXT_WHY); }
export function transform(): never { return unsupported("transform", EXT_WHY); }
export function find_dir(): never { return unsupported("find_dir", EXT_WHY); }
export function find_jars_within_path(): never { return unsupported("find_jars_within_path", EXT_WHY); }
export function find_malt_model(): never { return unsupported("find_malt_model", EXT_WHY); }
export function find_maltparser(): never { return unsupported("find_maltparser", EXT_WHY); }
export function malt_regex_tagger(): never { return unsupported("malt_regex_tagger", EXT_WHY); }

const DEMO_WHY = "interactive demo or corpus-bound helper; not applicable to the TS runtime contract";
export function run_profile(): never { return unsupported("run_profile", DEMO_WHY); }
export function conll_demo(): never { return unsupported("conll_demo", DEMO_WHY); }
export function conll_file_demo(): never { return unsupported("conll_file_demo", DEMO_WHY); }
export function cycle_finding_demo(): never { return unsupported("cycle_finding_demo", DEMO_WHY); }
export function dot2img(): never { return unsupported("dot2img", "requires graphviz dot binary"); }
export function malt_demo(): never { return unsupported("malt_demo", EXT_WHY); }
export function hall_demo(): never { return unsupported("hall_demo", DEMO_WHY); }
export function nonprojective_conll_parse_demo(): never { return unsupported("nonprojective_conll_parse_demo", DEMO_WHY); }
export function rule_based_demo(): never { return unsupported("rule_based_demo", DEMO_WHY); }
export function arity_parse_demo(): never { return unsupported("arity_parse_demo", DEMO_WHY); }
export function projective_prob_parse_demo(): never { return unsupported("projective_prob_parse_demo", DEMO_WHY); }
export function projective_rule_parse_demo(): never { return unsupported("projective_rule_parse_demo", DEMO_WHY); }
