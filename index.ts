export {
  countNgramsAscii,
  countTokensAscii,
  countTokensAsciiScalar,
  countUniqueNgramsAscii,
  countUniqueTokensAscii,
  bigramWindowStatsAscii,
  bigramWindowStatsAsciiIds,
  computeAsciiMetrics,
  countNormalizedTokensAscii,
  countNormalizedTokensAsciiScalar,
  NativeFreqDistStream,
  everygramsAsciiNative,
  normalizeTokensAsciiNative,
  sentenceTokenizePunktAsciiNative,
  evaluateLanguageModelIdsNative,
  chunkIobIdsNative,
  cykRecognizeIdsNative,
  naiveBayesLogScoresIdsNative,
  linearScoresSparseIdsNative,
  perceptronPredictBatchNative,
  posTagAsciiNative,
  skipgramsAsciiNative,
  ngramsAsciiNative,
  nativeLibraryPath,
  ngramFreqDistHashAscii,
  porterStemAscii,
  porterStemAsciiTokens,
  tokenFreqDistIdsAscii,
  topPmiBigramsAscii,
  tokenizeAsciiNative,
  tokenFreqDistHashAscii,
  wordnetMorphyAsciiNative,
} from "./src/native";

export type { StreamBigramFreq, StreamConditionalFreq } from "./src/native";
export type { NativeLmModelType } from "./src/native";

export {
  countNgramsAscii as countNgramsAsciiJs,
  countTokensAscii as countTokensAsciiJs,
  countUniqueNgramsAscii as countUniqueNgramsAsciiJs,
  countUniqueTokensAscii as countUniqueTokensAsciiJs,
  computeAsciiMetrics as computeAsciiMetricsJs,
  hashNgram,
  hashTokenAscii,
  bigramWindowStatsAscii as bigramWindowStatsAsciiJs,
  bigramWindowStatsAsciiIds as bigramWindowStatsAsciiIdsJs,
  everygramsAscii,
  normalizeTokensAscii,
  normalizeTokensUnicode,
  ngramsAscii,
  ngramFreqDistHashAscii as ngramFreqDistHashAsciiJs,
  posTagAscii,
  skipgramsAscii,
  tokenFreqDistIdsAscii as tokenFreqDistIdsAsciiJs,
  topPmiBigramsAscii as topPmiBigramsAsciiJs,
  tokenFreqDistHashAscii as tokenFreqDistHashAsciiJs,
  tokenizeAscii,
} from "./src/reference";

export {
  mweTokenize,
  MWETokenizer,
  toktokTokenize,
  ToktokTokenizer,
  treebankWordTokenize,
  TreebankWordTokenizer,
  tweetTokenize,
  TweetTokenizer,
  tweetTokenizeSubset,
  wordPunctTokenize,
  WordPunctTokenizer,
  wordTokenizeSubset,
} from "./src/tokenizers";
export { sentenceTokenizeSubset } from "./src/sentence_tokenizer";
export {
  defaultPunktModel,
  parsePunktModel,
  PunktSentenceTokenizer,
  PunktSentenceTokenizerSubset,
  PunktTrainer,
  PunktTrainerSubset,
  sentenceTokenizePunktCompat,
  sentenceTokenizePunkt,
  serializePunktModel,
  trainPunktModel,
} from "./src/punkt";
export type { PunktModelSerialized, PunktTrainingOptions } from "./src/punkt";
export { normalizeTokens } from "./src/normalization";
export { chunkTreeToIob, regexpChunkParse } from "./src/chunk";
export type { ChunkElement, ChunkNode, IobRow, TaggedToken } from "./src/chunk";
export { DEFAULT_NE_GRAMMAR, neChunk, neChunkIob } from "./src/named_entity";
export type { NeChunkOptions, NeIobTuple } from "./src/named_entity";
export { TextCat } from "./src/textcat";
export type { LanguageDistance, TextCatOptions } from "./src/textcat";
export { ImmutableTree, ParentedTree } from "./src/parented_tree";
export type { TreePosition, TreePositionsOrder } from "./src/parented_tree";
export { ConditionalFreqDist, FreqDist } from "./src/freqdist";
export type { ConditionalFreqDistInput, FreqDistInput } from "./src/freqdist";
export {
  BigramAssocMeasures,
  BigramCollocationFinder,
  QuadgramAssocMeasures,
  QuadgramCollocationFinder,
  TrigramAssocMeasures,
  TrigramCollocationFinder,
} from "./src/collocations";
export type { BigramScoreFn, QuadgramScoreFn, TrigramScoreFn } from "./src/collocations";
export {
  addLogs,
  ConditionalProbDist,
  ConditionalProbDistI,
  DictionaryProbDist,
  ELEProbDist,
  entropy,
  LaplaceProbDist,
  LidstoneProbDist,
  logLikelihood,
  MLEProbDist,
  MutableProbDist,
  ProbDistI,
  SimpleGoodTuringProbDist,
  sumLogs,
  UniformProbDist,
  WittenBellProbDist,
} from "./src/probability";
export type { ProbDistFactory, ProbDistLike } from "./src/probability";
export { ConcordanceIndex, ContextIndex, Text } from "./src/text";
export type { ConcordanceLine } from "./src/text";
export {
  CorpusReader,
  downloadCorpusRegistry,
  loadBundledMiniCorpus,
  loadCorpusBundleFromIndex,
  loadCorpusRegistryManifest,
} from "./src/corpus";
export type { CorpusFile, CorpusMiniIndex, CorpusRegistryEntry, CorpusRegistryManifest } from "./src/corpus";
export { parseBrownTagged, parseConllChunked, parseConllTagged } from "./src/corpus_readers";
export type { ChunkedSentence, ChunkedToken, TaggedSentence as CorpusTaggedSentence, TaggedToken as CorpusTaggedToken } from "./src/corpus_readers";
export { NgramLanguageModel, trainNgramLanguageModel } from "./src/lm";
export type { LanguageModelType, NgramLanguageModelOptions } from "./src/lm";
export {
  chartParse,
  earleyParse,
  earleyRecognize,
  leftCornerParse,
  parseCfgGrammar,
  parsePcfgGrammar,
  parseTextWithCfg,
  parseTextWithEarley,
  parseTextWithLeftCorner,
  parseTextWithPcfg,
  parseTextWithRecursiveDescent,
  probabilisticChartParse,
  recursiveDescentParse,
} from "./src/parse";
export type { CfgGrammar, CfgProduction, ParseTree, PcfgGrammar, PcfgProduction, ProbabilisticParse } from "./src/parse";
export { featureChartParse, featureEarleyParse, parseFeatureCfgGrammar, parseTextWithFeatureCfg, parseTextWithFeatureEarley } from "./src/feature_parse";
export type { FeatureCfgGrammar, FeatureMap, FeatureProduction, FeatureSymbol } from "./src/feature_parse";
export {
  loadNaiveBayesTextClassifier,
  NaiveBayesTextClassifier,
  trainNaiveBayesTextClassifier,
} from "./src/classify";
export type { NaiveBayesExample, NaiveBayesPrediction, NaiveBayesSerialized } from "./src/classify";
export {
  DecisionTreeClassifier,
  MaxentClassifier,
  NaiveBayesClassifier,
  PositiveNaiveBayesClassifier,
} from "./src/classifier_compat";
export type { FeatureSet, FeatureValue, LabeledFeatureset } from "./src/classifier_compat";
export { flattenSparseBatch, TextFeatureVectorizer } from "./src/features";
export type { SparseVector, VectorizerOptions, VectorizerSerialized } from "./src/features";
export {
  loadDecisionTreeTextClassifier,
  DecisionTreeTextClassifier,
  trainDecisionTreeTextClassifier,
} from "./src/decision_tree";
export type { DecisionTreeExample, DecisionTreeSerialized } from "./src/decision_tree";
export {
  loadMaxEntTextClassifier,
  MaxEntTextClassifier,
  trainMaxEntTextClassifier,
} from "./src/maxent";
export type { MaxEntExample, MaxEntPrediction, MaxEntSerialized } from "./src/maxent";
export {
  loadConditionalExponentialTextClassifier,
  ConditionalExponentialTextClassifier,
  trainConditionalExponentialTextClassifier,
} from "./src/conditional_exponential";
export type { ConditionalExponentialExample, ConditionalExponentialSerialized } from "./src/conditional_exponential";
export {
  loadLinearSvmTextClassifier,
  loadLogisticTextClassifier,
  LinearSvmTextClassifier,
  LogisticTextClassifier,
  trainLinearSvmTextClassifier,
  trainLogisticTextClassifier,
} from "./src/linear_models";
export type { LinearModelExample, LinearSvmSerialized, LogisticSerialized } from "./src/linear_models";
export {
  loadPerceptronTextClassifier,
  PerceptronTextClassifier,
  trainPerceptronTextClassifier,
} from "./src/perceptron_classifier";
export type { PerceptronExample, PerceptronSerialized } from "./src/perceptron_classifier";
export {
  loadPositiveNaiveBayesTextClassifier,
  PositiveNaiveBayesTextClassifier,
  trainPositiveNaiveBayesTextClassifier,
} from "./src/positive_naive_bayes";
export type { PositiveNaiveBayesSerialized } from "./src/positive_naive_bayes";
export { loadWordNet, loadWordNetExtended, loadWordNetMini, loadWordNetPacked, WordNet } from "./src/wordnet";
export type { WordNetMiniPayload, WordNetPos, WordNetSynset } from "./src/wordnet";
export { LancasterStemmer, RegexpStemmer, SnowballStemmer, WordNetLemmatizer } from "./src/stemmers";
export { confusionMatrix, corpusBleu, editDistance, sentenceBleu } from "./src/metrics";
export type { BleuWeights, ConfusionMatrixResult, EditDistanceOptions } from "./src/metrics";
export { SentimentIntensityAnalyzer } from "./src/sentiment";
export type { VaderOptions, VaderPolarity } from "./src/sentiment";
export { WasmNltk } from "./src/wasm";
export {
  loadPerceptronTaggerModel,
  posTagPerceptronAscii,
  preparePerceptronTaggerModel,
} from "./src/perceptron_tagger";
export {
  CFG,
  ChartParser,
  EarleyChartParser,
  FeatureCFG,
  FeatureChartParser,
  FeatureEarleyChartParser,
  LeftCornerChartParser,
  PCFG,
  PerceptronTagger,
  pos_tag,
  posTag,
  RecursiveDescentParser,
  ViterbiParser,
} from "./src/parser_tagger_compat";
export {
  bracketToTree,
  collapseUnaryChains,
  mapTreeLabels,
  treeDepth,
  treeLeaves,
  treeToBracket,
} from "./src/tree_transforms";
export { dependencyParse, dependencyParseText } from "./src/dependency";
export type { DependencyArc, DependencyParse } from "./src/dependency";
export {
  binaryDistance,
  customDistance,
  editDistanceAlign,
  fMeasure,
  fractionalPresence,
  intervalDistance,
  jaccardDistance,
  logLikelihood as metricsLogLikelihood,
  masiDistance,
  pk,
  precision,
  presence,
  recall,
  sorensenDiceDistance,
  sorensenDiceSimilarity,
  spearmanCorrelation,
  windowdiff,
} from "./src/distance_metrics";
export type { LabelSet, ProbabilityMap, Ranking, Segmentation } from "./src/distance_metrics";
export {
  BigramTagger,
  DefaultTagger,
  NgramTagger,
  RegexpTagger,
  SequentialBackoffTagger,
  ContextTagger,
  TrigramTagger,
  UnigramTagger,
} from "./src/sequential_taggers";
export type {
  GoldSentence,
  NgramTaggerOptions,
  TagContext,
  TaggedToken as SeqTaggedToken,
  TaggerModel,
  UntaggedSentence,
} from "./src/sequential_taggers";
export { lesk, synsetDefinition } from "./src/wsd";
export type { Synset as WsdSynset } from "./src/wsd";
export { corpusChrF, corpusNist, nistLengthPenalty, sentenceChrF, sentenceNist } from "./src/translation_metrics_extra";
export type { ChrFOptions, NistOptions } from "./src/translation_metrics_extra";
export {
  AnnotationTask,
  averageObservedAgreement,
} from "./src/agreement_metrics";
export type {
  AgreementDistanceFn,
  AnnotationLabel,
  AnnotationTriple,
} from "./src/agreement_metrics";
export {
  BrillTagger,
  BrillTaggerTrainer,
  Pos,
  TblFeature,
  TblRule,
  Template,
  Word,
  buildTemplates,
  clearTemplateRegistry,
  standardTemplates,
} from "./src/brill_tagger";
export type {
  BrillSentence,
  BrillToken,
  BrillTrainerOptions,
  BrillTrainingStats,
  Condition,
  FeatureSpec,
  InitialTaggerLike,
  RuleEffect,
} from "./src/brill_tagger";
export {
  HiddenMarkovModelTagger,
  HiddenMarkovModelTrainer,
  untag,
  untagSents,
} from "./src/hmm_tagger";
export type {
  Estimator as HmmEstimator,
  HiddenMarkovModelTrainerOptions,
} from "./src/hmm_tagger";
export {
  APP,
  AllExpression,
  ApplicationExpression,
  ConstantExpression,
  EventVariableExpression,
  ExistsExpression,
  ExpectedMoreTokensException,
  Expression,
  FunctionVariableExpression,
  IndividualVariableExpression,
  IotaExpression,
  LambdaExpression,
  LogicalExpressionException,
  LogicParser as SemLogicParser,
  NegatedExpression,
  Tokens,
  UndefinedError,
  UnexpectedTokenException,
  Variable,
  is_eventvar,
  is_funcvar,
  is_indvar,
  makeVariableExpression,
  uniqueVariable,
  resetUniqueVariableCounter,
  nextUniqueCounterValue,
} from "./src/sem_logic";
export {
  DRS,
  DrtParser,
  DrtApplicationExpression,
  DrtLambdaExpression,
  DrtNegatedExpression,
  DrtEqualityExpression,
  DrtOrExpression,
  DrtConcatenation,
  DrtProposition,
  DrtAbstractVariableExpression,
  DrtIndividualVariableExpression,
  DrtFunctionVariableExpression,
  DrtEventVariableExpression,
  DrtConstantExpression,
  DrtVariableExpression,
  DrtTokens,
} from "./src/drt";
export type { Drs } from "./src/drt";
export { skolemize } from "./src/skolemize";
export type { SNOWBALL_LANGUAGES as SnowballLanguages } from "./src/snowball";
export { SNOWBALL_LANGUAGES, snowballStem } from "./src/snowball";

export {
  IBMModel1,
} from "./src/ibm1";
export { IBMModel2 } from "./src/ibm2";
export { IBMModel3 } from "./src/ibm3";
export { factorial as ibmFactorial } from "./src/ibm_model";
export { IBMModel4 } from "./src/ibm4";
export { IBMModel5 } from "./src/ibm5";
export {
  MIN_PROB as IBM_MIN_PROB,
  Counts as IBMCounts,
  type AlignedSentInput,
  type AlignmentPair,
} from "./src/ibm_model";
export {
  AlignmentInfo,
  type Scorer as IBMScore,
} from "./src/ibm_sampling";
