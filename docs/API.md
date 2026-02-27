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
  loadWordNetMini,
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

## Tokenizers

- `wordTokenizeSubset(text: string): string[]`
- `tweetTokenizeSubset(text: string, opts?: { stripHandles?: boolean; reduceLen?: boolean; matchPhoneNumbers?: boolean }): string[]`
- `sentenceTokenizeSubset(text: string, opts?: { abbreviations?: Iterable<string>; learnAbbreviations?: boolean; orthographicHeuristics?: boolean }): string[]`

## Punkt

- `trainPunktModel(text: string, options?: { minAbbrevCount?: number; minCollocationCount?: number; minSentenceStarterCount?: number }): { version: number; abbreviations: string[]; collocations: Array<[string, string]>; sentenceStarters: string[] }`
- `sentenceTokenizePunkt(text: string, model?: PunktModelSerialized): string[]`
- `defaultPunktModel(): PunktModelSerialized`
- `serializePunktModel(model: PunktModelSerialized): string`
- `parsePunktModel(payload: string | PunktModelSerialized): PunktModelSerialized`

## WordNet

- `loadWordNetMini(path?: string): WordNet`
- `loadWordNetExtended(path?: string): WordNet`
- `loadWordNetPacked(path?: string): WordNet`
- `new WordNet(payload: WordNetMiniPayload)`
- `synset(id: string): WordNetSynset | null`
- `synsets(word: string, pos?: "n" | "v" | "a" | "r"): WordNetSynset[]`
- `lemmas(pos?: "n" | "v" | "a" | "r"): string[]`
- `morphy(word: string, pos?: "n" | "v" | "a" | "r"): string | null`
- `hypernyms(idOrSynset: string | WordNetSynset): WordNetSynset[]`
- `hyponyms(idOrSynset: string | WordNetSynset): WordNetSynset[]`
- `similarTo(idOrSynset: string | WordNetSynset): WordNetSynset[]`
- `antonyms(idOrSynset: string | WordNetSynset): WordNetSynset[]`

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

## Parsing (CFG / Chart)

- `parseCfgGrammar(grammarText: string, options?: { startSymbol?: string }): { startSymbol: string; productions: Array<{ lhs: string; rhs: string[] }> }`
- `chartParse(tokens: string[], grammar: CfgGrammar, options?: { maxTrees?: number; startSymbol?: string }): Array<{ label: string; children: Array<ParseTree | string> }>`
- `parseTextWithCfg(text: string, grammar: CfgGrammar | string, options?: { maxTrees?: number; startSymbol?: string; normalizeTokens?: boolean }): ParseTree[]`

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

## Corpora

- `new CorpusReader(files: Array<{ id: string; text: string; categories: string[] }>)`
- `loadBundledMiniCorpus(rootPath?: string): CorpusReader`
- `loadCorpusBundleFromIndex(indexPath: string): CorpusReader`
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
