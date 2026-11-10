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

const FC_WHY = "feature-chart machinery (FeatStruct unification) not yet ported";
export class FeatStructNonterminal { constructor() { unsupported("FeatStructNonterminal", FC_WHY); } }
export class FeatureChart { constructor() { unsupported("FeatureChart", FC_WHY); } }
export class FeatureIncrementalChart { constructor() { unsupported("FeatureIncrementalChart", FC_WHY); } }
export class FeatureTreeEdge { constructor() { unsupported("FeatureTreeEdge", FC_WHY); } }
export class InstantiateVarsChart { constructor() { unsupported("InstantiateVarsChart", FC_WHY); } }
export class FeatureFundamentalRule { constructor() { unsupported("FeatureFundamentalRule", FC_WHY); } }
export class FeatureSingleEdgeFundamentalRule { constructor() { unsupported("FeatureSingleEdgeFundamentalRule", FC_WHY); } }
export class FeatureBottomUpPredictRule { constructor() { unsupported("FeatureBottomUpPredictRule", FC_WHY); } }
export class FeatureBottomUpPredictCombineRule { constructor() { unsupported("FeatureBottomUpPredictCombineRule", FC_WHY); } }
export class FeatureTopDownInitRule { constructor() { unsupported("FeatureTopDownInitRule", FC_WHY); } }
export class FeatureTopDownPredictRule { constructor() { unsupported("FeatureTopDownPredictRule", FC_WHY); } }
export class FeatureEmptyPredictRule { constructor() { unsupported("FeatureEmptyPredictRule", FC_WHY); } }
export class FeatureScannerRule { constructor() { unsupported("FeatureScannerRule", FC_WHY); } }
export class FeaturePredictorRule { constructor() { unsupported("FeaturePredictorRule", FC_WHY); } }
export class FeatureCompleterRule { constructor() { unsupported("FeatureCompleterRule", FC_WHY); } }
export class FeatureCompleteFundamentalRule { constructor() { unsupported("FeatureCompleteFundamentalRule", FC_WHY); } }
export class FeatureBottomUpChartParser { constructor() { unsupported("FeatureBottomUpChartParser", FC_WHY); } }
export class FeatureBottomUpLeftCornerChartParser { constructor() { unsupported("FeatureBottomUpLeftCornerChartParser", FC_WHY); } }
export class FeatureTopDownChartParser { constructor() { unsupported("FeatureTopDownChartParser", FC_WHY); } }
export class FeatureIncrementalChartParser { constructor() { unsupported("FeatureIncrementalChartParser", FC_WHY); } }
export class FeatureIncrementalBottomUpChartParser { constructor() { unsupported("FeatureIncrementalBottomUpChartParser", FC_WHY); } }
export class FeatureIncrementalBottomUpLeftCornerChartParser { constructor() { unsupported("FeatureIncrementalBottomUpLeftCornerChartParser", FC_WHY); } }
export class FeatureIncrementalTopDownChartParser { constructor() { unsupported("FeatureIncrementalTopDownChartParser", FC_WHY); } }
export class FeatureGrammar { constructor() { unsupported("FeatureGrammar", FC_WHY); } }
export function find_variables(): never { return unsupported("find_variables", FC_WHY); }
export function unify(): never { return unsupported("unify", FC_WHY); }

const INC_WHY = "incremental/Earley chart machinery not yet ported";
export class IncrementalChart { constructor() { unsupported("IncrementalChart", INC_WHY); } }
export class IncrementalChartParser { constructor() { unsupported("IncrementalChartParser", INC_WHY); } }
export class IncrementalBottomUpChartParser { constructor() { unsupported("IncrementalBottomUpChartParser", INC_WHY); } }
export class IncrementalBottomUpLeftCornerChartParser { constructor() { unsupported("IncrementalBottomUpLeftCornerChartParser", INC_WHY); } }
export class IncrementalLeftCornerChartParser { constructor() { unsupported("IncrementalLeftCornerChartParser", INC_WHY); } }
export class IncrementalTopDownChartParser { constructor() { unsupported("IncrementalTopDownChartParser", INC_WHY); } }
export class PredictorRule { constructor() { unsupported("PredictorRule", INC_WHY); } }
export class ScannerRule { constructor() { unsupported("ScannerRule", INC_WHY); } }
export class CompleterRule { constructor() { unsupported("CompleterRule", INC_WHY); } }
export class CompleteFundamentalRule { constructor() { unsupported("CompleteFundamentalRule", INC_WHY); } }
export class FilteredCompleteFundamentalRule { constructor() { unsupported("FilteredCompleteFundamentalRule", INC_WHY); } }

const PC_WHY = "probabilistic chart machinery not yet ported";
export class ProbabilisticTree { constructor() { unsupported("ProbabilisticTree", "nltk.tree.ProbabilisticTree not yet ported"); } }
export class ProbabilisticTreeEdge { constructor() { unsupported("ProbabilisticTreeEdge", PC_WHY); } }
export class ProbabilisticLeafEdge { constructor() { unsupported("ProbabilisticLeafEdge", PC_WHY); } }
export class ProbabilisticFundamentalRule { constructor() { unsupported("ProbabilisticFundamentalRule", PC_WHY); } }
export class SingleEdgeProbabilisticFundamentalRule { constructor() { unsupported("SingleEdgeProbabilisticFundamentalRule", PC_WHY); } }
export class ProbabilisticBottomUpInitRule { constructor() { unsupported("ProbabilisticBottomUpInitRule", PC_WHY); } }
export class ProbabilisticBottomUpPredictRule { constructor() { unsupported("ProbabilisticBottomUpPredictRule", PC_WHY); } }
export class BottomUpProbabilisticChartParser { constructor() { unsupported("BottomUpProbabilisticChartParser", PC_WHY); } }
export class InsideChartParser { constructor() { unsupported("InsideChartParser", PC_WHY); } }
export class LongestChartParser { constructor() { unsupported("LongestChartParser", PC_WHY); } }
export class RandomChartParser { constructor() { unsupported("RandomChartParser", PC_WHY); } }
export class UnsortedChartParser { constructor() { unsupported("UnsortedChartParser", PC_WHY); } }

const DP_WHY = "dependency-parser machinery not yet ported";
export class DependencySpan { constructor() { unsupported("DependencySpan", DP_WHY); } }
export class ChartCell { constructor() { unsupported("ChartCell", DP_WHY); } }
export class ProjectiveDependencyParser { constructor() { unsupported("ProjectiveDependencyParser", DP_WHY); } }
export class ProbabilisticProjectiveDependencyParser { constructor() { unsupported("ProbabilisticProjectiveDependencyParser", DP_WHY); } }
export class DependencyScorerI { constructor() { unsupported("DependencyScorerI", DP_WHY); } }
export class NaiveBayesDependencyScorer { constructor() { unsupported("NaiveBayesDependencyScorer", DP_WHY); } }
export class DemoScorer { constructor() { unsupported("DemoScorer", DP_WHY); } }
export class NonprojectiveDependencyParser { constructor() { unsupported("NonprojectiveDependencyParser", DP_WHY); } }
export class ProbabilisticNonprojectiveParser { constructor() { unsupported("ProbabilisticNonprojectiveParser", DP_WHY); } }
export class Configuration { constructor() { unsupported("Configuration", "transition-parser state not yet ported"); } }
export class Transition { constructor() { unsupported("Transition", "transition-parser state not yet ported"); } }
export class TestGrammar { constructor() { unsupported("TestGrammar", "test-grammar loader not yet ported"); } }
export function extract_test_sentences(): never { return unsupported("extract_test_sentences", "test-grammar loader not yet ported"); }

const STEP_WHY = "interactive stepping parser UI not applicable to the TS runtime contract";
export class SteppingRecursiveDescentParser { constructor() { unsupported("SteppingRecursiveDescentParser", STEP_WHY); } }
export class SteppingShiftReduceParser { constructor() { unsupported("SteppingShiftReduceParser", STEP_WHY); } }

const EXT_WHY = "requires an external binary/server (CoreNLP, MaltParser), unavailable in the JS runtime";
export class CoreNLPServer { constructor() { unsupported("CoreNLPServer", EXT_WHY); } }
export class CoreNLPDependencyParser { constructor() { unsupported("CoreNLPDependencyParser", EXT_WHY); } }
export class GenericCoreNLPParser { constructor() { unsupported("GenericCoreNLPParser", EXT_WHY); } }
export class ZipFilePathPointer { constructor() { unsupported("ZipFilePathPointer", EXT_WHY); } }
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
