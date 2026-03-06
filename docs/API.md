# API Reference

This document describes the public API exported by [index.ts](/C:/Users/user/Desktop/bun/bun_nltk/index.ts).

## Installation

```bash
bun add bun_nltk
# or
npm install bun_nltk
```

## Import

```ts
import {
  countTokensAscii,
  sentenceTokenizePunkt,
  loadWordNet,
  trainNgramLanguageModel,
  regexpChunkParse,
  loadBundledMiniCorpus,
} from "bun_nltk";
```

## Native Zig API

These functions call the dynamic native library through Bun FFI.

- `countTokensAscii(text: string): number`
- `countTokensAsciiScalar(text: string): number`
- `countUniqueTokensAscii(text: string): number`
- `countNgramsAscii(text: string, n: number): number`
- `countUniqueNgramsAscii(text: string, n: number): number`
- `computeAsciiMetrics(text: string, n: number): { tokens: number; uniqueTokens: number; ngrams: number; uniqueNgrams: number }`
- `tokenFreqDistHashAscii(text: string): Map<bigint, number>`
- `ngramFreqDistHashAscii(text: string, n: number): Map<bigint, number>`
- `tokenizeAsciiNative(text: string): string[]`
- `sentenceTokenizePunktAsciiNative(text: string): string[]`
- `ngramsAsciiNative(text: string, n: number): string[][]`
- `everygramsAsciiNative(text: string, minLen?: number, maxLen?: number): string[][]`
- `skipgramsAsciiNative(text: string, n: number, k: number): string[][]`
- `tokenFreqDistIdsAscii(text: string): { tokens: string[]; counts: number[]; tokenToId: Map<string, number>; totalTokens: number }`
- `bigramWindowStatsAsciiIds(text: string, windowSize?: number): Array<{ leftId: number; rightId: number; count: number; pmi: number }>`
- `bigramWindowStatsAscii(text: string, windowSize?: number): Array<{ left: string; right: string; leftId: number; rightId: number; count: number; pmi: number }>`
- `topPmiBigramsAscii(text: string, topK: number, windowSize?: number): Array<{ leftHash: bigint; rightHash: bigint; score: number }>`
- `porterStemAscii(token: string): string`
- `porterStemAsciiTokens(tokens: string[]): string[]`
- `wordnetMorphyAsciiNative(word: string, pos?: "n" | "v" | "a" | "r"): string`
- `countNormalizedTokensAscii(text: string, removeStopwords?: boolean): number`
- `countNormalizedTokensAsciiScalar(text: string, removeStopwords?: boolean): number`
- `normalizeTokensAsciiNative(text: string, removeStopwords?: boolean): string[]`
- `posTagAsciiNative(text: string): Array<{ token: string; tag: string; tagId: number; start: number; length: number }>`
- `evaluateLanguageModelIdsNative(input: { tokenIds: Uint32Array; sentenceOffsets: Uint32Array; order: number; model: "mle" | "lidstone" | "kneser_ney_interpolated"; gamma?: number; discount?: number; vocabSize: number; probeContextFlat: Uint32Array; probeContextLens: Uint32Array; probeWords: Uint32Array; perplexityTokens: Uint32Array; prefixTokens?: Uint32Array }): { scores: Float64Array; perplexity: number }`
- `chunkIobIdsNative(input: { tokenTagIds: Uint16Array; atomAllowedOffsets: Uint32Array; atomAllowedLengths: Uint32Array; atomAllowedFlat: Uint16Array; atomMins: Uint8Array; atomMaxs: Uint8Array; ruleAtomOffsets: Uint32Array; ruleAtomCounts: Uint32Array; ruleLabelIds: Uint16Array }): { labelIds: Uint16Array; begins: Uint8Array }`
- `perceptronPredictBatchNative(featureIds: Uint32Array, tokenOffsets: Uint32Array, weights: Float32Array, modelFeatureCount: number, tagCount: number): Uint16Array`
- `linearScoresSparseIdsNative(input: { docOffsets: Uint32Array; featureIds: Uint32Array; featureValues: Float64Array; classCount: number; featureCount: number; weights: Float64Array; bias: Float64Array }): Float64Array`
- `NativeFreqDistStream`
- `new NativeFreqDistStream()`
- `update(text: string): void`
- `flush(): void`
- `tokenUniqueCount(): number`
- `bigramUniqueCount(): number`
- `conditionalUniqueCount(): number`
- `tokenFreqDistHash(): Map<bigint, number>`
- `bigramFreqDistHash(): Array<{ leftHash: bigint; rightHash: bigint; count: number }>`
- `conditionalFreqDistHash(): Array<{ tagId: number; tokenHash: bigint; count: number }>`
- `toJson(): string`
- `dispose(): void`
- `nativeLibraryPath(): string`

## JS Reference API

These functions are pure TypeScript reference implementations.

- `tokenizeAscii(text: string): string[]`
- `countTokensAsciiJs(text: string): number`
- `countUniqueTokensAsciiJs(text: string): number`
- `countNgramsAsciiJs(text: string, n: number): number`
- `countUniqueNgramsAsciiJs(text: string, n: number): number`
- `computeAsciiMetricsJs(text: string, n: number): { tokens: number; uniqueTokens: number; ngrams: number; uniqueNgrams: number }`
- `hashTokenAscii(token: string): bigint`
- `hashNgram(tokenHashes: bigint[], n: number): bigint`
- `tokenFreqDistHashAsciiJs(text: string): Map<bigint, number>`
- `ngramFreqDistHashAsciiJs(text: string, n: number): Map<bigint, number>`
- `ngramsAscii(text: string, n: number): string[][]`
- `everygramsAscii(text: string, minLen?: number, maxLen?: number): string[][]`
- `skipgramsAscii(text: string, n: number, k: number): string[][]`
- `tokenFreqDistIdsAsciiJs(text: string): { tokens: string[]; counts: number[]; tokenToId: Map<string, number>; totalTokens: number }`
- `bigramWindowStatsAsciiIdsJs(text: string, windowSize?: number): Array<{ leftId: number; rightId: number; count: number; pmi: number }>`
- `bigramWindowStatsAsciiJs(text: string, windowSize?: number): Array<{ left: string; right: string; leftId: number; rightId: number; count: number; pmi: number }>`
- `topPmiBigramsAsciiJs(text: string, topK: number, windowSize?: number): Array<{ leftHash: bigint; rightHash: bigint; score: number }>`
- `normalizeTokensAscii(text: string, removeStopwords?: boolean): string[]`
- `normalizeTokensUnicode(text: string, removeStopwords?: boolean): string[]`
- `posTagAscii(text: string): Array<{ token: string; tag: string; tagId: number; start: number; length: number }>`

## Frequency Distributions

- `new FreqDist(samples?: Iterable<T> | ReadonlyMap<T, number> | Record<string, number> | FreqDist<T>)`
- `FreqDist.fromTextAscii(text: string, options?: { native?: boolean }): FreqDist<string>`
- `get(sample: T): number`
- `count(sample: T): number`
- `set(sample: T, count: number): this`
- `inc(sample: T, count?: number): this`
- `update(samples?: Iterable<T> | ReadonlyMap<T, number> | Record<string, number> | FreqDist<T>): this`
- `N(): number`
- `B(): number`
- `freq(sample: T): number`
- `max(): T`
- `hapaxes(): T[]`
- `Nr(r: number, bins?: number): number`
- `r_Nr(bins?: number): Record<number, number>`
- `mostCommon(count?: number): Array<[T, number]>`
- `samples(): T[]`
- `copy(): FreqDist<T>`
- `add(other: FreqDist<T>): FreqDist<T>`
- `subtract(other: FreqDist<T>): FreqDist<T>`
- `union(other: FreqDist<T>): FreqDist<T>`
- `intersection(other: FreqDist<T>): FreqDist<T>`
- `isSubsetOf(other: FreqDist<T>): boolean`
- `isSupersetOf(other: FreqDist<T>): boolean`
- `equals(other: FreqDist<T>): boolean`
- `pformat(maxlen?: number): string`
- `pprint(maxlen?: number, writer?: (line: string) => void): void`
- `toString(): string`
- `new ConditionalFreqDist(condSamples?: Iterable<readonly [C, T]> | ReadonlyMap<C, FreqDist<T>> | ConditionalFreqDist<C, T>)`
- `ConditionalFreqDist.fromTaggedTextAscii(text: string, options?: { native?: boolean }): ConditionalFreqDist<string, string>`
- `get(condition: C): FreqDist<T>` (auto-vivifies)
- `peek(condition: C): FreqDist<T> | undefined`
- `set(condition: C, dist: FreqDist<T>): this`
- `update(condSamples?: Iterable<readonly [C, T]> | ReadonlyMap<C, FreqDist<T>> | ConditionalFreqDist<C, T>): this`
- `conditions(): C[]`
- `N(): number`
- `copy(): ConditionalFreqDist<C, T>`
- `add(other: ConditionalFreqDist<C, T>): ConditionalFreqDist<C, T>`
- `subtract(other: ConditionalFreqDist<C, T>): ConditionalFreqDist<C, T>`
- `union(other: ConditionalFreqDist<C, T>): ConditionalFreqDist<C, T>`
- `intersection(other: ConditionalFreqDist<C, T>): ConditionalFreqDist<C, T>`
- `isSubsetOf(other: ConditionalFreqDist<C, T>): boolean`
- `isSupersetOf(other: ConditionalFreqDist<C, T>): boolean`
- `equals(other: ConditionalFreqDist<C, T>): boolean`
- `toString(): string`

## Probability Distributions

- `abstract class ProbDistI<T>`
- `prob(sample: T): number`
- `logprob(sample: T): number`
- `logProb(sample: T): number`
- `max(): T`
- `samples(): Iterable<T>`
- `new DictionaryProbDist(probDict?: ReadonlyMap<T, number> | Record<string, number>, log?: boolean, normalize?: boolean)`
- `new UniformProbDist(samples: Iterable<T>)`
- `new MLEProbDist(freqDist: FreqDist<T>)`
- `freqdist(): FreqDist<T>`
- `new LidstoneProbDist(freqDist: FreqDist<T>, gamma: number, bins?: number)`
- `discount(): number`
- `bins(): number`
- `new LaplaceProbDist(freqDist: FreqDist<T>, bins?: number)`
- `new ELEProbDist(freqDist: FreqDist<T>, bins?: number)`
- `new MutableProbDist(probDist: ProbDistI<T>, samples: Iterable<T>, storeLogs?: boolean)`
- `update(sample: T, prob: number, log?: boolean): void`
- `new WittenBellProbDist(freqDist: FreqDist<T>, bins?: number)`
- `new SimpleGoodTuringProbDist(freqDist: FreqDist<T>, bins?: number)`
- `smoothedNr(r: number): number`
- `abstract class ConditionalProbDistI<C, T>`
- `conditions(): C[]`
- `new ConditionalProbDist(cfdist: ConditionalFreqDist<C, T>, probdistFactory: (fd: FreqDist<T>, ...args: unknown[]) => ProbDistI<T>, ...factoryArgs: unknown[])`
- `get(condition: C): ProbDistI<T>`
- `prob(condition: C, sample: T): number`
- `logprob(condition: C, sample: T): number`
- `logProb(condition: C, sample: T): number`
- `addLogs(logx: number, logy: number): number`
- `sumLogs(logs: number[]): number`
- `entropy(pdist: ProbDistI<T>): number`
- `logLikelihood(testPdist: ProbDistI<T>, actualPdist: ProbDistI<T>): number`

## Collocations

- `BigramAssocMeasures.raw_freq(n_ii: number, marginals: [number, number], total: number): number`
- `BigramAssocMeasures.student_t(n_ii: number, marginals: [number, number], total: number): number`
- `BigramAssocMeasures.mi_like(n_ii: number, marginals: [number, number], total: number, options?: { power?: number }): number`
- `BigramAssocMeasures.pmi(n_ii: number, marginals: [number, number], total: number): number`
- `BigramAssocMeasures.likelihood_ratio(n_ii: number, marginals: [number, number], total: number): number`
- `BigramAssocMeasures.poisson_stirling(n_ii: number, marginals: [number, number], total: number): number`
- `BigramAssocMeasures.jaccard(n_ii: number, marginals: [number, number], total: number): number`
- `BigramAssocMeasures.phi_sq(n_ii: number, marginals: [number, number], total: number): number`
- `BigramAssocMeasures.chi_sq(n_ii: number, marginals: [number, number], total: number): number`
- `BigramAssocMeasures.dice(n_ii: number, marginals: [number, number], total: number): number`
- `new BigramCollocationFinder(wordFd: FreqDist<T>, ngramFd: FreqDist<[T, T]>, windowSize?: number)`
- `BigramCollocationFinder.fromWords(words: Iterable<T>, windowSize?: number): BigramCollocationFinder<T>`
- `BigramCollocationFinder.fromDocuments(documents: Iterable<Iterable<T>>, windowSize?: number): BigramCollocationFinder<T>`
- `BigramCollocationFinder.fromTextAscii(text: string, options?: { windowSize?: number; native?: boolean }): BigramCollocationFinder<string>`
- `applyFreqFilter(minFreq: number): this`
- `applyNgramFilter(fn: (left: T, right: T) => boolean): this`
- `applyWordFilter(fn: (word: T) => boolean): this`
- `scoreNgram(scoreFn: BigramScoreFn<T>, left: T, right: T): number | null`
- `scoreNgrams(scoreFn: BigramScoreFn<T>): Array<[[T, T], number]>`
- `nbest(scoreFn: BigramScoreFn<T>, count: number): Array<[T, T]>`
- `aboveScore(scoreFn: BigramScoreFn<T>, minScore: number): IterableIterator<[T, T]>`
- `TrigramAssocMeasures.raw_freq(n_iii: number, bigramMarginals: [number, number, number], unigramMarginals: [number, number, number], total: number): number`
- `TrigramAssocMeasures.student_t(...)`, `mi_like(...)`, `pmi(...)`, `likelihood_ratio(...)`, `poisson_stirling(...)`, `jaccard(...)`
- `new TrigramCollocationFinder(wordFd: FreqDist<T>, bigramFd: FreqDist<[T, T]>, wildcardFd: FreqDist<[T, T]>, trigramFd: FreqDist<[T, T, T]>)`
- `TrigramCollocationFinder.fromWords(words: Iterable<T>, windowSize?: number): TrigramCollocationFinder<T>`
- `bigramFinder(): BigramCollocationFinder<T>`
- `applyFreqFilter(minFreq: number): this`
- `applyNgramFilter(fn: (w1: T, w2: T, w3: T) => boolean): this`
- `applyWordFilter(fn: (word: T) => boolean): this`
- `scoreNgram(scoreFn: TrigramScoreFn<T>, w1: T, w2: T, w3: T): number | null`
- `scoreNgrams(scoreFn: TrigramScoreFn<T>): Array<[[T, T, T], number]>`
- `nbest(scoreFn: TrigramScoreFn<T>, count: number): Array<[T, T, T]>`
- `QuadgramAssocMeasures.raw_freq(n_iiii: number, trigramMarginals: [number, number, number, number], bigramMarginals: [number, number, number, number, number, number], unigramMarginals: [number, number, number, number], total: number): number`
- `QuadgramAssocMeasures.student_t(...)`, `mi_like(...)`, `pmi(...)`, `likelihood_ratio(...)`, `poisson_stirling(...)`, `jaccard(...)`
- `new QuadgramCollocationFinder(wordFd: FreqDist<T>, quadgramFd: FreqDist<[T, T, T, T]>, ii: FreqDist<[T, T]>, iii: FreqDist<[T, T, T]>, ixi: FreqDist<[T, T]>, ixxi: FreqDist<[T, T]>, iixi: FreqDist<[T, T, T]>, ixii: FreqDist<[T, T, T]>)`
- `QuadgramCollocationFinder.fromWords(words: Iterable<T>, windowSize?: number): QuadgramCollocationFinder<T>`
- `applyFreqFilter(minFreq: number): this`
- `applyWordFilter(fn: (word: T) => boolean): this`
- `scoreNgram(scoreFn: QuadgramScoreFn<T>, w1: T, w2: T, w3: T, w4: T): number | null`
- `scoreNgrams(scoreFn: QuadgramScoreFn<T>): Array<[[T, T, T, T], number]>`
- `nbest(scoreFn: QuadgramScoreFn<T>, count: number): Array<[T, T, T, T]>`

## Text Exploration

- `new ConcordanceIndex(tokens: string[], key?: (token: string) => string)`
- `tokens(): string[]`
- `offsets(word: string): number[]`
- `findConcordance(word: string | string[], width?: number): ConcordanceLine[]`
- `concordance(word: string | string[], width?: number, lines?: number): string[]`
- `new ContextIndex(tokens: string[], options?: { contextFn?: (tokens: string[], index: number) => [string, string]; filter?: (token: string) => boolean; key?: (token: string) => string })`
- `similarWords(word: string, count?: number): string[]`
- `commonContexts(words: string[], failOnUnknown?: boolean): FreqDist<[string, string]>`
- `new Text(tokens: Iterable<string>, name?: string)`
- `count(word: string): number`
- `index(word: string): number`
- `vocab(): FreqDist<string>`
- `concordanceList(word: string | string[], width?: number, lines?: number): ConcordanceLine[]`
- `concordance(word: string | string[], width?: number, lines?: number): string[]`
- `collocationList(num?: number, windowSize?: number, options?: { minFreq?: number; scoreFn?: BigramScoreFn<string>; stopwords?: Iterable<string> }): Array<[string, string]>`
- `collocations(num?: number, windowSize?: number): string[]`
- `similar(word: string, num?: number): string[]`
- `commonContexts(words: string[], num?: number): Array<[string, string]>`

## Tokenizers

- `wordTokenizeSubset(text: string): string[]`
- `tweetTokenizeSubset(text: string, opts?: { stripHandles?: boolean; reduceLen?: boolean; matchPhoneNumbers?: boolean }): string[]`
- `treebankWordTokenize(text: string): string[]`
- `wordPunctTokenize(text: string): string[]`
- `toktokTokenize(text: string): string[]`
- `mweTokenize(tokens: string[], mwes: string[][], separator?: string): string[]`
- `tweetTokenize(text: string, opts?: { preserveCase?: boolean; stripHandles?: boolean; reduceLen?: boolean; matchPhoneNumbers?: boolean }): string[]`
- `new TreebankWordTokenizer()`
- `TreebankWordTokenizer.tokenize(text: string): string[]`
- `new WordPunctTokenizer()`
- `WordPunctTokenizer.tokenize(text: string): string[]`
- `new ToktokTokenizer()`
- `ToktokTokenizer.tokenize(text: string): string[]`
- `new MWETokenizer(mwes?: string[][], separator?: string)`
- `MWETokenizer.addMwe(tokens: string[]): void`
- `MWETokenizer.tokenize(tokens: string[]): string[]`
- `new TweetTokenizer(opts?: { preserveCase?: boolean; stripHandles?: boolean; reduceLen?: boolean; matchPhoneNumbers?: boolean })`
- `TweetTokenizer.tokenize(text: string): string[]`
- `sentenceTokenizeSubset(text: string, opts?: { abbreviations?: Iterable<string>; learnAbbreviations?: boolean; orthographicHeuristics?: boolean }): string[]`

## Punkt

- `trainPunktModel(text: string, options?: { minAbbrevCount?: number; minCollocationCount?: number; minSentenceStarterCount?: number }): { version: number; abbreviations: string[]; collocations: Array<[string, string]>; sentenceStarters: string[]; abbreviationScores?: Record<string, number>; orthographicContext?: Record<string, { lower: number; upper: number }> }`
- `sentenceTokenizePunkt(text: string, model?: PunktModelSerialized): string[]`
- `sentenceTokenizePunktCompat(text: string, model?: PunktModelSerialized): string[]`
- `defaultPunktModel(): PunktModelSerialized`
- `serializePunktModel(model: PunktModelSerialized): string`
- `parsePunktModel(payload: string | PunktModelSerialized): PunktModelSerialized`
- `new PunktTrainer()`
- `PunktTrainer.loadTrainText(text: string): PunktTrainer`
- `PunktTrainer.train(text: string, options?: PunktTrainingOptions): PunktTrainer`
- `PunktTrainer.finalize(): PunktModelSerialized`
- `new PunktSentenceTokenizer(model?: PunktModelSerialized)`
- `PunktSentenceTokenizer.setParams(model: PunktModelSerialized): PunktSentenceTokenizer`
- `PunktSentenceTokenizer.tokenize(text: string): string[]`
- `new PunktTrainerSubset()`
- `PunktTrainerSubset.train(text: string, options?: PunktTrainingOptions): PunktTrainerSubset`
- `PunktTrainerSubset.finalize(): PunktModelSerialized`
- `PunktTrainerSubset.getParams(): PunktModelSerialized`
- `new PunktSentenceTokenizerSubset(model?: PunktModelSerialized)`
- `PunktSentenceTokenizerSubset.tokenize(text: string): string[]`
- `PunktSentenceTokenizerSubset.train(text: string, options?: PunktTrainingOptions): PunktSentenceTokenizerSubset`
- `PunktSentenceTokenizerSubset.getParams(): PunktModelSerialized`

## WordNet

- `loadWordNet(path?: string): WordNet` (default runtime loader: packed official corpus when available, else extended JSON fallback)
- `loadWordNetMini(path?: string): WordNet`
- `loadWordNetExtended(path?: string): WordNet`
- `loadWordNetPacked(path?: string): WordNet`
- `new WordNet(payload: WordNetMiniPayload)`
- `synset(id: string): WordNetSynset | null`
- `allSynsets(pos?: "n" | "v" | "a" | "r"): WordNetSynset[]`
- `synsets(word: string, pos?: "n" | "v" | "a" | "r"): WordNetSynset[]`
- `lemmas(pos?: "n" | "v" | "a" | "r"): string[]`
- `lemmaNames(idOrSynset: string | WordNetSynset): string[]`
- `morphy(word: string, pos?: "n" | "v" | "a" | "r"): string | null`
- `synsetFromPosAndOffset(pos: "n" | "v" | "a" | "r", offset: string | number): WordNetSynset | null`
- `synset_from_pos_and_offset(pos: "n" | "v" | "a" | "r", offset: string | number): WordNetSynset | null`
- `senseKeys(word: string, pos?: "n" | "v" | "a" | "r"): string[]`
- `synsetFromSenseKey(senseKey: string): WordNetSynset | null`
- `synset_from_sense_key(senseKey: string): WordNetSynset | null`
- `hypernyms(idOrSynset: string | WordNetSynset): WordNetSynset[]`
- `hyponyms(idOrSynset: string | WordNetSynset): WordNetSynset[]`
- `similarTo(idOrSynset: string | WordNetSynset): WordNetSynset[]`
- `antonyms(idOrSynset: string | WordNetSynset): WordNetSynset[]`
- `hypernymPaths(idOrSynset: string | WordNetSynset, options?: { maxDepth?: number }): WordNetSynset[][]`
- `lowestCommonHypernyms(left: string | WordNetSynset, right: string | WordNetSynset, options?: { maxDepth?: number }): WordNetSynset[]`
- `shortestPathDistance(left: string | WordNetSynset, right: string | WordNetSynset, options?: { maxDepth?: number }): number | null`
- `pathSimilarity(left: string | WordNetSynset, right: string | WordNetSynset, options?: { maxDepth?: number }): number | null`

## Language Models

- `new NgramLanguageModel(sentences: string[][], options: { order: number; model?: "mle" | "lidstone" | "kneser_ney_interpolated"; gamma?: number; discount?: number; padLeft?: boolean; padRight?: boolean; startToken?: string; endToken?: string })`
- `trainNgramLanguageModel(sentences: string[][], options: NgramLanguageModelOptions): NgramLanguageModel`
- `score(word: string, context?: string[]): number`
- `logScore(word: string, context?: string[]): number`
- `perplexity(tokens: string[]): number`
- `evaluateBatch(probes: Array<{ word: string; context: string[] }>, perplexityTokens: string[]): { scores: number[]; perplexity: number }`

## Chunking

- `regexpChunkParse(tokens: Array<{ token: string; tag: string }>, grammar: string): Array<{ token: string; tag: string } | { kind: "chunk"; label: string; tokens: Array<{ token: string; tag: string }> }>`
- `chunkTreeToIob(tree: ChunkElement[]): Array<{ token: string; tag: string; iob: string }>`

## Parsing (CFG / Chart / Recursive Descent)

- `parseCfgGrammar(grammarText: string, options?: { startSymbol?: string }): { startSymbol: string; productions: Array<{ lhs: string; rhs: string[] }> }`
- `chartParse(tokens: string[], grammar: CfgGrammar, options?: { maxTrees?: number; startSymbol?: string }): Array<{ label: string; children: Array<ParseTree | string> }>`
- `earleyRecognize(tokens: string[], grammar: CfgGrammar, options?: { startSymbol?: string }): boolean`
- `earleyParse(tokens: string[], grammar: CfgGrammar, options?: { maxTrees?: number; startSymbol?: string }): ParseTree[]`
- `recursiveDescentParse(tokens: string[], grammar: CfgGrammar, options?: { maxTrees?: number; startSymbol?: string; maxDepth?: number }): ParseTree[]`
- `leftCornerParse(tokens: string[], grammar: CfgGrammar, options?: { maxTrees?: number; startSymbol?: string; maxDepth?: number }): ParseTree[]`
- `parseTextWithCfg(text: string, grammar: CfgGrammar | string, options?: { maxTrees?: number; startSymbol?: string; normalizeTokens?: boolean }): ParseTree[]`
- `parseTextWithEarley(text: string, grammar: CfgGrammar | string, options?: { maxTrees?: number; startSymbol?: string; normalizeTokens?: boolean }): ParseTree[]`
- `parseTextWithRecursiveDescent(text: string, grammar: CfgGrammar | string, options?: { maxTrees?: number; startSymbol?: string; normalizeTokens?: boolean; maxDepth?: number }): ParseTree[]`
- `parseTextWithLeftCorner(text: string, grammar: CfgGrammar | string, options?: { maxTrees?: number; startSymbol?: string; normalizeTokens?: boolean; maxDepth?: number }): ParseTree[]`

## Feature Parsing (Subset)

- `parseFeatureCfgGrammar(grammarText: string, options?: { startSymbol?: string }): FeatureCfgGrammar`
- `featureChartParse(tokens: string[], grammar: FeatureCfgGrammar, options?: { maxTrees?: number; maxDepth?: number; startSymbol?: FeatureSymbol | string }): ParseTree[]`
- `featureEarleyParse(tokens: string[], grammar: FeatureCfgGrammar, options?: { maxTrees?: number; maxDepth?: number; startSymbol?: FeatureSymbol | string }): ParseTree[]`
- `parseTextWithFeatureCfg(text: string, grammar: FeatureCfgGrammar | string, options?: { maxTrees?: number; startSymbol?: string; normalizeTokens?: boolean; maxDepth?: number }): ParseTree[]`
- `parseTextWithFeatureEarley(text: string, grammar: FeatureCfgGrammar | string, options?: { maxTrees?: number; startSymbol?: string; normalizeTokens?: boolean; maxDepth?: number }): ParseTree[]`

## Dependency Parsing

- `dependencyParse(tokens: string[], posTags?: string[]): { tokens: string[]; posTags: string[]; root: number; arcs: Array<{ head: number; dep: number; relation: string }> }`
- `dependencyParseText(text: string, options?: { normalizeTokens?: boolean }): DependencyParse`

## Classification (Naive Bayes)

- `new NaiveBayesTextClassifier(options?: { smoothing?: number })`
- `train(examples: Array<{ label: string; text: string }>): this`
- `labels(): string[]`
- `classify(text: string): string`
- `predict(text: string): Array<{ label: string; logProb: number }>`
- `evaluate(examples: Array<{ label: string; text: string }>): { accuracy: number; total: number; correct: number }`
- `toJSON(): NaiveBayesSerialized`
- `NaiveBayesTextClassifier.fromSerialized(payload: NaiveBayesSerialized): NaiveBayesTextClassifier`
- `trainNaiveBayesTextClassifier(examples: Array<{ label: string; text: string }>, options?: { smoothing?: number }): NaiveBayesTextClassifier`
- `loadNaiveBayesTextClassifier(payload: NaiveBayesSerialized): NaiveBayesTextClassifier`

## Classification Compatibility Wrappers

- `type FeatureSet = Record<string, string | number | boolean | null | undefined>`
- `type LabeledFeatureset = readonly [FeatureSet, string]`
- `NaiveBayesClassifier.train(labeledFeaturesets: Iterable<LabeledFeatureset>, options?: { smoothing?: number }): NaiveBayesClassifier`
- `DecisionTreeClassifier.train(labeledFeaturesets: Iterable<LabeledFeatureset>, options?: { maxDepth?: number; minSamples?: number; maxCandidateFeatures?: number; maxFeatures?: number }): DecisionTreeClassifier`
- `MaxentClassifier.train(labeledFeaturesets: Iterable<LabeledFeatureset>, options?: { epochs?: number; learningRate?: number; l2?: number; maxFeatures?: number }): MaxentClassifier`
- `PositiveNaiveBayesClassifier.train(positiveFeaturesets: Iterable<FeatureSet>, unlabeledFeaturesets: Iterable<FeatureSet>, options?: { maxFeatures?: number; positivePrior?: number; positiveLabel?: string; negativeLabel?: string }): PositiveNaiveBayesClassifier`
- `classify(featureset: FeatureSet): string`
- `probClassify(featureset: FeatureSet): DictionaryProbDist<string>`
- `classifyMany(featuresets: Iterable<FeatureSet>): string[]`
- `probClassifyMany(featuresets: Iterable<FeatureSet>): DictionaryProbDist<string>[]`
- `labels(): string[]`

## Classification (Decision Tree / Linear / Perceptron)

- `new TextFeatureVectorizer(options?: { ngramMin?: number; ngramMax?: number; binary?: boolean; maxFeatures?: number })`
- `flattenSparseBatch(rows: SparseVector[]): { docOffsets: Uint32Array; featureIds: Uint32Array; featureValues: Float64Array }`
- `new DecisionTreeTextClassifier(options?: { maxDepth?: number; minSamples?: number; maxCandidateFeatures?: number; maxFeatures?: number })`
- `trainDecisionTreeTextClassifier(examples: Array<{ label: string; text: string }>, options?): DecisionTreeTextClassifier`
- `loadDecisionTreeTextClassifier(payload: DecisionTreeSerialized): DecisionTreeTextClassifier`
- `new LogisticTextClassifier(options?: { epochs?: number; learningRate?: number; l2?: number; maxFeatures?: number; useNativeScoring?: boolean })`
- `new LinearSvmTextClassifier(options?: { epochs?: number; learningRate?: number; l2?: number; margin?: number; maxFeatures?: number; useNativeScoring?: boolean })`
- `trainLogisticTextClassifier(examples: Array<{ label: string; text: string }>, options?: { epochs?: number; learningRate?: number; l2?: number; maxFeatures?: number; useNativeScoring?: boolean }): LogisticTextClassifier`
- `trainLinearSvmTextClassifier(examples: Array<{ label: string; text: string }>, options?: { epochs?: number; learningRate?: number; l2?: number; margin?: number; maxFeatures?: number; useNativeScoring?: boolean }): LinearSvmTextClassifier`
- `loadLogisticTextClassifier(payload: LogisticSerialized): LogisticTextClassifier`
- `loadLinearSvmTextClassifier(payload: LinearSvmSerialized): LinearSvmTextClassifier`
- `new PerceptronTextClassifier(options?: { epochs?: number; learningRate?: number; maxFeatures?: number; averaged?: boolean })`
- `trainPerceptronTextClassifier(examples: Array<{ label: string; text: string }>, options?: { epochs?: number; learningRate?: number; maxFeatures?: number; averaged?: boolean }): PerceptronTextClassifier`
- `loadPerceptronTextClassifier(payload: PerceptronSerialized): PerceptronTextClassifier`
- `new ConditionalExponentialTextClassifier(options?: { epochs?: number; learningRate?: number; l2?: number; maxFeatures?: number })`
- `trainConditionalExponentialTextClassifier(examples: Array<{ label: string; text: string }>, options?: { epochs?: number; learningRate?: number; l2?: number; maxFeatures?: number }): ConditionalExponentialTextClassifier`
- `loadConditionalExponentialTextClassifier(payload: ConditionalExponentialSerialized): ConditionalExponentialTextClassifier`
- `new PositiveNaiveBayesTextClassifier(options?: { maxFeatures?: number; positivePrior?: number; positiveLabel?: string; negativeLabel?: string })`
- `trainPositiveNaiveBayesTextClassifier(positiveRows: string[] | Array<{ text: string }>, unlabeledRows: string[] | Array<{ text: string }>, options?: { maxFeatures?: number; positivePrior?: number; positiveLabel?: string; negativeLabel?: string }): PositiveNaiveBayesTextClassifier`
- `loadPositiveNaiveBayesTextClassifier(payload: PositiveNaiveBayesSerialized): PositiveNaiveBayesTextClassifier`

## Corpora

- `new CorpusReader(files: Array<{ id: string; text: string; categories: string[] }>)`
- `loadBundledMiniCorpus(rootPath?: string): CorpusReader`
- `loadCorpusBundleFromIndex(indexPath: string): CorpusReader`
- `loadCorpusRegistryManifest(manifestPath: string): CorpusRegistryManifest`
- `downloadCorpusRegistry(manifestOrPath: CorpusRegistryManifest | string, outDir: string, options?: { fetchBytes?: (url: string) => Promise<Uint8Array> }): Promise<string>`
- `fileIds(options?: { fileIds?: string[]; categories?: string[] }): string[]`
- `raw(options?: { fileIds?: string[]; categories?: string[] }): string`
- `words(options?: { fileIds?: string[]; categories?: string[] }): string[]`
- `sents(options?: { fileIds?: string[]; categories?: string[] }): string[]`
- `paras(options?: { fileIds?: string[]; categories?: string[] }): string[]`
- `categories(): string[]`

## Tagged/Chunked Corpus Parsers

- `parseConllTagged(text: string): Array<Array<{ token: string; tag: string }>>`
- `parseBrownTagged(text: string): Array<Array<{ token: string; tag: string }>>`
- `parseConllChunked(text: string): Array<Array<{ token: string; pos: string; chunk: string }>>`

## Normalization

- `normalizeTokens(text: string, options?: { removeStopwords?: boolean; preferNativeAscii?: boolean; stem?: boolean }): string[]`

## Stemming and Lemmatization

- `new RegexpStemmer(pattern: RegExp | string, min?: number)`
- `RegexpStemmer.stem(word: string): string`
- `new LancasterStemmer()`
- `LancasterStemmer.stem(word: string): string`
- `new SnowballStemmer(language?: string)`
- `SnowballStemmer.stem(word: string): string`
- `new WordNetLemmatizer()`
- `WordNetLemmatizer.lemmatize(word: string, pos?: string): string`

## Sentiment (VADER-style)

- `new SentimentIntensityAnalyzer(options?: { lexicon?: Record<string, number> })`
- `SentimentIntensityAnalyzer.polarityScores(text: string): { neg: number; neu: number; pos: number; compound: number }`

## Metrics and Translation Helpers

- `editDistance(left: string, right: string, options?: { substitutionCost?: number; transpositions?: boolean }): number`
- `sentenceBleu(references: string[][], hypothesis: string[], weights?: [number, number, number, number]): number`
- `corpusBleu(listOfReferences: string[][][], hypotheses: string[][], weights?: [number, number, number, number]): number`
- `confusionMatrix(gold: string[], predicted: string[]): { labels: string[]; matrix: number[][]; accuracy: number }`

## Perceptron Tagger

- `preparePerceptronTaggerModel(payload: PerceptronTaggerModelSerialized): PerceptronTaggerModel`
- `loadPerceptronTaggerModel(path?: string): PerceptronTaggerModel`
- `posTagPerceptronAscii(text: string, options?: { model?: PerceptronTaggerModel; wasm?: WasmNltk; useWasm?: boolean; useNative?: boolean }): Array<{ token: string; tag: string; tagId: number; start: number; length: number }>`

## WASM Runtime

`WasmNltk` loads and executes the WASM build with reusable allocation pools.

- `WasmNltk.init(init?: { wasmBytes?: Uint8Array; wasmPath?: string }): Promise<WasmNltk>`
- `dispose(): void`
- `countTokensAscii(text: string): number`
- `countNgramsAscii(text: string, n: number): number`
- `computeAsciiMetrics(text: string, n: number): { tokens: number; uniqueTokens: number; ngrams: number; uniqueNgrams: number }`
- `tokenizeAscii(text: string): string[]`
- `normalizeTokensAscii(text: string, removeStopwords?: boolean): string[]`
- `perceptronPredictBatch(featureIds: Uint32Array, tokenOffsets: Uint32Array, weights: Float32Array, modelFeatureCount: number, tagCount: number): Uint16Array`
- `sentenceTokenizePunktAscii(text: string): string[]`
- `wordnetMorphyAscii(word: string, pos?: "n" | "v" | "a" | "r"): string`
- `evaluateLanguageModelIds(input: { tokenIds: Uint32Array; sentenceOffsets: Uint32Array; order: number; model: 0 | 1 | 2; gamma: number; discount: number; vocabSize: number; probeContextFlat: Uint32Array; probeContextLens: Uint32Array; probeWords: Uint32Array; perplexityTokens: Uint32Array; prefixTokens?: Uint32Array }): { scores: Float64Array; perplexity: number }`
- `chunkIobIds(input: { tokenTagIds: Uint16Array; atomAllowedOffsets: Uint32Array; atomAllowedLengths: Uint32Array; atomAllowedFlat: Uint16Array; atomMins: Uint8Array; atomMaxs: Uint8Array; ruleAtomOffsets: Uint32Array; ruleAtomCounts: Uint32Array; ruleLabelIds: Uint16Array }): { labelIds: Uint16Array; begins: Uint8Array }`

## Notes

- Native APIs load packaged prebuilt binaries at `native/prebuilt/<platform>-<arch>/bun_nltk.{so|dll}`.
- Supported packaged native targets are `linux-x64` and `win32-x64`.
- There is no implicit runtime fallback to a locally built native artifact.
- WASM APIs require `native/bun_nltk.wasm`.
- `Node.js` users should ensure an execution path that supports TS ESM package entrypoints or build/transpile this package as part of their pipeline.
