import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type WasmExports = {
  memory: WebAssembly.Memory;
  bunnltk_wasm_last_error_code: () => number;
  bunnltk_wasm_input_ptr: () => number;
  bunnltk_wasm_input_capacity: () => number;
  bunnltk_wasm_alloc: (size: number) => number;
  bunnltk_wasm_free: (ptr: number, size: number) => void;
  bunnltk_wasm_count_tokens_ascii: (inputLen: number) => bigint;
  bunnltk_wasm_count_ngrams_ascii: (inputLen: number, n: number) => bigint;
  bunnltk_wasm_compute_ascii_metrics: (
    inputLen: number,
    n: number,
    outMetricsPtr: number,
    outMetricsLen: number,
  ) => void;
  bunnltk_wasm_fill_token_offsets_ascii: (
    inputLen: number,
    outOffsetsPtr: number,
    outLengthsPtr: number,
    capacity: number,
  ) => bigint;
  bunnltk_wasm_count_sentences_punkt_ascii: (inputLen: number) => bigint;
  bunnltk_wasm_fill_sentence_offsets_punkt_ascii: (
    inputLen: number,
    outOffsetsPtr: number,
    outLengthsPtr: number,
    capacity: number,
  ) => bigint;
  bunnltk_wasm_count_normalized_tokens_ascii: (inputLen: number, removeStopwords: number) => bigint;
  bunnltk_wasm_fill_normalized_token_offsets_ascii: (
    inputLen: number,
    removeStopwords: number,
    outOffsetsPtr: number,
    outLengthsPtr: number,
    capacity: number,
  ) => bigint;
  bunnltk_wasm_perceptron_predict_batch: (
    featureIdsPtr: number,
    featureIdsLen: number,
    tokenOffsetsPtr: number,
    tokenCount: number,
    weightsPtr: number,
    modelFeatureCount: number,
    tagCount: number,
    outTagIdsPtr: number,
  ) => void;
  bunnltk_wasm_wordnet_morphy_ascii: (
    inputLen: number,
    pos: number,
    outPtr: number,
    outCapacity: number,
  ) => number;
  bunnltk_wasm_lm_eval_ids: (
    tokenIdsPtr: number,
    tokenIdsLen: number,
    sentenceOffsetsPtr: number,
    sentenceOffsetsLen: number,
    order: number,
    modelType: number,
    gamma: number,
    discount: number,
    vocabSize: number,
    probeContextFlatPtr: number,
    probeContextFlatLen: number,
    probeContextLensPtr: number,
    probeWordsPtr: number,
    probeCount: number,
    outScoresPtr: number,
    outScoresLen: number,
    perplexityTokensPtr: number,
    perplexityLen: number,
    prefixTokensPtr: number,
    prefixLen: number,
  ) => number;
  bunnltk_wasm_chunk_iob_ids: (
    tokenTagIdsPtr: number,
    tokenCount: number,
    atomAllowedOffsetsPtr: number,
    atomAllowedLengthsPtr: number,
    atomAllowedFlatPtr: number,
    atomAllowedFlatLen: number,
    atomMinsPtr: number,
    atomMaxsPtr: number,
    atomCount: number,
    ruleAtomOffsetsPtr: number,
    ruleAtomCountsPtr: number,
    ruleLabelIdsPtr: number,
    ruleCount: number,
    outLabelIdsPtr: number,
    outBeginsPtr: number,
    outCapacity: number,
  ) => bigint;
  bunnltk_wasm_cyk_recognize_ids: (
    tokenBitsPtr: number,
    tokenCount: number,
    binaryLeftPtr: number,
    binaryRightPtr: number,
    binaryParentPtr: number,
    binaryCount: number,
    unaryChildPtr: number,
    unaryParentPtr: number,
    unaryCount: number,
    startSymbol: number,
  ) => number;
  bunnltk_wasm_naive_bayes_log_scores_ids: (
    docTokenIdsPtr: number,
    docTokenCount: number,
    vocabSize: number,
    tokenCountsMatrixPtr: number,
    tokenCountsMatrixLen: number,
    labelDocCountsPtr: number,
    labelTokenTotalsPtr: number,
    labelCount: number,
    totalDocs: number,
    smoothing: number,
    outScoresPtr: number,
    outScoresLen: number,
  ) => void;
};

export type AsciiMetrics = {
  tokens: number;
  uniqueTokens: number;
  ngrams: number;
  uniqueNgrams: number;
};

type PoolBlock = {
  ptr: number;
  bytes: number;
};

function toNumber(v: number | bigint): number {
  return typeof v === "bigint" ? Number(v) : v;
}

export type WasmNltkInit = {
  wasmBytes?: Uint8Array;
  wasmPath?: string;
};

export type WasmLmModelType = "mle" | "lidstone" | "kneser_ney_interpolated";

export class WasmNltk {
  private readonly exports: WasmExports;
  private readonly inputPtr: number;
  private readonly inputCapacity: number;
  private readonly encoder = new TextEncoder();
  private readonly decoder = new TextDecoder();
  private readonly blocks = new Map<string, PoolBlock>();

  private constructor(exports: WasmExports) {
    this.exports = exports;
    this.inputPtr = exports.bunnltk_wasm_input_ptr();
    this.inputCapacity = exports.bunnltk_wasm_input_capacity();
  }

  static async init(init: WasmNltkInit = {}): Promise<WasmNltk> {
    const wasmPath = init.wasmPath ?? resolve(import.meta.dir, "..", "native", "bun_nltk.wasm");
    const bytes = init.wasmBytes ?? readFileSync(wasmPath);
    const { instance } = await WebAssembly.instantiate(bytes, {});
    return new WasmNltk(instance.exports as unknown as WasmExports);
  }

  dispose(): void {
    for (const block of this.blocks.values()) {
      this.exports.bunnltk_wasm_free(block.ptr, block.bytes);
    }
    this.blocks.clear();
  }

  private assertNoError(context: string): void {
    const code = this.exports.bunnltk_wasm_last_error_code();
    if (code !== 0) {
      throw new Error(`wasm error code ${code} in ${context}`);
    }
  }

  private ensureBlock(key: string, bytes: number): PoolBlock {
    const existing = this.blocks.get(key);
    if (existing && existing.bytes >= bytes) return existing;
    if (existing) {
      this.exports.bunnltk_wasm_free(existing.ptr, existing.bytes);
      this.blocks.delete(key);
    }

    const ptr = this.exports.bunnltk_wasm_alloc(bytes);
    this.assertNoError(`alloc:${key}`);
    if (!ptr) throw new Error(`failed to allocate wasm block for ${key}`);

    const block = { ptr, bytes };
    this.blocks.set(key, block);
    return block;
  }

  private writeInput(text: string): number {
    const encoded = this.encoder.encode(text);
    if (encoded.length > this.inputCapacity) {
      throw new Error(`input too large for wasm input buffer: ${encoded.length} > ${this.inputCapacity}`);
    }
    const mem = new Uint8Array(this.exports.memory.buffer);
    mem.set(encoded, this.inputPtr);
    return encoded.length;
  }

  countTokensAscii(text: string): number {
    const inputLen = this.writeInput(text);
    return toNumber(this.exports.bunnltk_wasm_count_tokens_ascii(inputLen));
  }

  countNgramsAscii(text: string, n: number): number {
    const inputLen = this.writeInput(text);
    const out = toNumber(this.exports.bunnltk_wasm_count_ngrams_ascii(inputLen, n));
    this.assertNoError("countNgramsAscii");
    return out;
  }

  computeAsciiMetrics(text: string, n: number): AsciiMetrics {
    const inputLen = this.writeInput(text);
    const block = this.ensureBlock("metrics", 4 * BigUint64Array.BYTES_PER_ELEMENT);
    this.exports.bunnltk_wasm_compute_ascii_metrics(inputLen, n, block.ptr, 4);
    this.assertNoError("computeAsciiMetrics");

    const values = new BigUint64Array(this.exports.memory.buffer, block.ptr, 4);
    return {
      tokens: Number(values[0]!),
      uniqueTokens: Number(values[1]!),
      ngrams: Number(values[2]!),
      uniqueNgrams: Number(values[3]!),
    };
  }

  tokenOffsetsAscii(text: string): { total: number; offsets: Uint32Array; lengths: Uint32Array; input: Uint8Array } {
    const inputLen = this.writeInput(text);
    const total = toNumber(this.exports.bunnltk_wasm_count_tokens_ascii(inputLen));
    if (total === 0) {
      return {
        total: 0,
        offsets: new Uint32Array(0),
        lengths: new Uint32Array(0),
        input: new Uint8Array(0),
      };
    }

    const offsetsBlock = this.ensureBlock("offsets", total * Uint32Array.BYTES_PER_ELEMENT);
    const lengthsBlock = this.ensureBlock("lengths", total * Uint32Array.BYTES_PER_ELEMENT);
    const written = toNumber(
      this.exports.bunnltk_wasm_fill_token_offsets_ascii(inputLen, offsetsBlock.ptr, lengthsBlock.ptr, total),
    );
    this.assertNoError("tokenOffsetsAscii");

    return {
      total: written,
      offsets: new Uint32Array(this.exports.memory.buffer, offsetsBlock.ptr, written),
      lengths: new Uint32Array(this.exports.memory.buffer, lengthsBlock.ptr, written),
      input: new Uint8Array(this.exports.memory.buffer, this.inputPtr, inputLen),
    };
  }

  normalizedTokenOffsetsAscii(
    text: string,
    removeStopwords = true,
  ): { total: number; offsets: Uint32Array; lengths: Uint32Array; input: Uint8Array } {
    const inputLen = this.writeInput(text);
    const total = toNumber(
      this.exports.bunnltk_wasm_count_normalized_tokens_ascii(inputLen, removeStopwords ? 1 : 0),
    );
    this.assertNoError("normalizedTokenOffsetsAscii.count");

    if (total === 0) {
      return {
        total: 0,
        offsets: new Uint32Array(0),
        lengths: new Uint32Array(0),
        input: new Uint8Array(0),
      };
    }

    const offsetsBlock = this.ensureBlock("norm_offsets", total * Uint32Array.BYTES_PER_ELEMENT);
    const lengthsBlock = this.ensureBlock("norm_lengths", total * Uint32Array.BYTES_PER_ELEMENT);
    const written = toNumber(
      this.exports.bunnltk_wasm_fill_normalized_token_offsets_ascii(
        inputLen,
        removeStopwords ? 1 : 0,
        offsetsBlock.ptr,
        lengthsBlock.ptr,
        total,
      ),
    );
    this.assertNoError("normalizedTokenOffsetsAscii.fill");

    return {
      total: written,
      offsets: new Uint32Array(this.exports.memory.buffer, offsetsBlock.ptr, written),
      lengths: new Uint32Array(this.exports.memory.buffer, lengthsBlock.ptr, written),
      input: new Uint8Array(this.exports.memory.buffer, this.inputPtr, inputLen),
    };
  }

  tokenizeAscii(text: string): string[] {
    const { total, offsets, lengths, input } = this.tokenOffsetsAscii(text);
    const out = new Array<string>(total);
    for (let i = 0; i < total; i += 1) {
      const start = offsets[i]!;
      const len = lengths[i]!;
      out[i] = this.decoder.decode(input.subarray(start, start + len)).toLowerCase();
    }
    return out;
  }

  sentenceTokenizePunktAscii(text: string): string[] {
    const inputLen = this.writeInput(text);
    const total = toNumber(this.exports.bunnltk_wasm_count_sentences_punkt_ascii(inputLen));
    this.assertNoError("sentenceTokenizePunktAscii.count");
    if (total === 0) return [];

    const offsetsBlock = this.ensureBlock("sent_offsets", total * Uint32Array.BYTES_PER_ELEMENT);
    const lengthsBlock = this.ensureBlock("sent_lengths", total * Uint32Array.BYTES_PER_ELEMENT);
    const written = toNumber(
      this.exports.bunnltk_wasm_fill_sentence_offsets_punkt_ascii(
        inputLen,
        offsetsBlock.ptr,
        lengthsBlock.ptr,
        total,
      ),
    );
    this.assertNoError("sentenceTokenizePunktAscii.fill");

    const offsets = new Uint32Array(this.exports.memory.buffer, offsetsBlock.ptr, written);
    const lengths = new Uint32Array(this.exports.memory.buffer, lengthsBlock.ptr, written);
    const input = new Uint8Array(this.exports.memory.buffer, this.inputPtr, inputLen);
    const out = new Array<string>(written);
    for (let i = 0; i < written; i += 1) {
      const start = offsets[i]!;
      const len = lengths[i]!;
      out[i] = this.decoder.decode(input.subarray(start, start + len));
    }
    return out;
  }

  normalizeTokensAscii(text: string, removeStopwords = true): string[] {
    const { total, offsets, lengths, input } = this.normalizedTokenOffsetsAscii(text, removeStopwords);
    const out = new Array<string>(total);
    for (let i = 0; i < total; i += 1) {
      const start = offsets[i]!;
      const len = lengths[i]!;
      out[i] = this.decoder.decode(input.subarray(start, start + len)).toLowerCase();
    }
    return out;
  }

  perceptronPredictBatch(
    featureIds: Uint32Array,
    tokenOffsets: Uint32Array,
    weights: Float32Array,
    modelFeatureCount: number,
    tagCount: number,
  ): Uint16Array {
    if (tokenOffsets.length === 0) return new Uint16Array(0);
    const tokenCount = tokenOffsets.length - 1;

    const featureBlock = this.ensureBlock("perceptron_feature_ids", featureIds.length * Uint32Array.BYTES_PER_ELEMENT);
    const offsetBlock = this.ensureBlock("perceptron_token_offsets", tokenOffsets.length * Uint32Array.BYTES_PER_ELEMENT);
    const weightBlock = this.ensureBlock("perceptron_weights", weights.length * Float32Array.BYTES_PER_ELEMENT);
    const outBlock = this.ensureBlock("perceptron_out_tags", tokenCount * Uint16Array.BYTES_PER_ELEMENT);

    new Uint32Array(this.exports.memory.buffer, featureBlock.ptr, featureIds.length).set(featureIds);
    new Uint32Array(this.exports.memory.buffer, offsetBlock.ptr, tokenOffsets.length).set(tokenOffsets);
    new Float32Array(this.exports.memory.buffer, weightBlock.ptr, weights.length).set(weights);

    this.exports.bunnltk_wasm_perceptron_predict_batch(
      featureBlock.ptr,
      featureIds.length,
      offsetBlock.ptr,
      tokenCount,
      weightBlock.ptr,
      modelFeatureCount,
      tagCount,
      outBlock.ptr,
    );
    this.assertNoError("perceptronPredictBatch");

    return Uint16Array.from(new Uint16Array(this.exports.memory.buffer, outBlock.ptr, tokenCount));
  }

  wordnetMorphyAscii(word: string, pos?: "n" | "v" | "a" | "r"): string {
    const inputLen = this.writeInput(word);
    const outBlock = this.ensureBlock("wordnet_morphy", Math.max(64, inputLen + 8));
    const posCode = pos === "n" ? 1 : pos === "v" ? 2 : pos === "a" ? 3 : pos === "r" ? 4 : 0;
    const written = this.exports.bunnltk_wasm_wordnet_morphy_ascii(inputLen, posCode, outBlock.ptr, outBlock.bytes);
    this.assertNoError("wordnetMorphyAscii");
    if (written <= 0) return "";
    return this.decoder.decode(new Uint8Array(this.exports.memory.buffer, outBlock.ptr, written));
  }

  evaluateLanguageModelIds(input: {
    tokenIds: Uint32Array;
    sentenceOffsets: Uint32Array;
    order: number;
    model: WasmLmModelType;
    gamma: number;
    discount: number;
    vocabSize: number;
    probeContextFlat: Uint32Array;
    probeContextLens: Uint32Array;
    probeWordIds: Uint32Array;
    perplexityTokenIds: Uint32Array;
    prefixTokenIds: Uint32Array;
  }): { scores: Float64Array; perplexity: number } {
    const tokenBlock = this.ensureBlock("lm_token_ids", input.tokenIds.length * Uint32Array.BYTES_PER_ELEMENT);
    const sentBlock = this.ensureBlock("lm_sentence_offsets", input.sentenceOffsets.length * Uint32Array.BYTES_PER_ELEMENT);
    const probeFlatBlock = this.ensureBlock(
      "lm_probe_flat",
      Math.max(1, input.probeContextFlat.length) * Uint32Array.BYTES_PER_ELEMENT,
    );
    const probeLensBlock = this.ensureBlock(
      "lm_probe_lens",
      Math.max(1, input.probeContextLens.length) * Uint32Array.BYTES_PER_ELEMENT,
    );
    const probeWordBlock = this.ensureBlock(
      "lm_probe_words",
      Math.max(1, input.probeWordIds.length) * Uint32Array.BYTES_PER_ELEMENT,
    );
    const scoreBlock = this.ensureBlock("lm_scores", Math.max(1, input.probeWordIds.length) * Float64Array.BYTES_PER_ELEMENT);
    const pplTokensBlock = this.ensureBlock(
      "lm_ppl_tokens",
      Math.max(1, input.perplexityTokenIds.length) * Uint32Array.BYTES_PER_ELEMENT,
    );
    const prefixBlock = this.ensureBlock("lm_prefix_tokens", Math.max(1, input.prefixTokenIds.length) * Uint32Array.BYTES_PER_ELEMENT);

    new Uint32Array(this.exports.memory.buffer, tokenBlock.ptr, input.tokenIds.length).set(input.tokenIds);
    new Uint32Array(this.exports.memory.buffer, sentBlock.ptr, input.sentenceOffsets.length).set(input.sentenceOffsets);
    if (input.probeContextFlat.length > 0) {
      new Uint32Array(this.exports.memory.buffer, probeFlatBlock.ptr, input.probeContextFlat.length).set(input.probeContextFlat);
    }
    if (input.probeContextLens.length > 0) {
      new Uint32Array(this.exports.memory.buffer, probeLensBlock.ptr, input.probeContextLens.length).set(input.probeContextLens);
    }
    if (input.probeWordIds.length > 0) {
      new Uint32Array(this.exports.memory.buffer, probeWordBlock.ptr, input.probeWordIds.length).set(input.probeWordIds);
    }
    if (input.perplexityTokenIds.length > 0) {
      new Uint32Array(this.exports.memory.buffer, pplTokensBlock.ptr, input.perplexityTokenIds.length).set(input.perplexityTokenIds);
    }
    if (input.prefixTokenIds.length > 0) {
      new Uint32Array(this.exports.memory.buffer, prefixBlock.ptr, input.prefixTokenIds.length).set(input.prefixTokenIds);
    }

    const modelType = input.model === "mle" ? 0 : input.model === "lidstone" ? 1 : 2;
    const perplexity = this.exports.bunnltk_wasm_lm_eval_ids(
      tokenBlock.ptr,
      input.tokenIds.length,
      sentBlock.ptr,
      input.sentenceOffsets.length,
      input.order,
      modelType,
      input.gamma,
      input.discount,
      input.vocabSize,
      probeFlatBlock.ptr,
      input.probeContextFlat.length,
      probeLensBlock.ptr,
      probeWordBlock.ptr,
      input.probeWordIds.length,
      scoreBlock.ptr,
      input.probeWordIds.length,
      pplTokensBlock.ptr,
      input.perplexityTokenIds.length,
      prefixBlock.ptr,
      input.prefixTokenIds.length,
    );
    this.assertNoError("evaluateLanguageModelIds");
    const scores = Float64Array.from(new Float64Array(this.exports.memory.buffer, scoreBlock.ptr, input.probeWordIds.length));
    return { scores, perplexity };
  }

  chunkIobIds(input: {
    tokenTagIds: Uint16Array;
    atomAllowedOffsets: Uint32Array;
    atomAllowedLengths: Uint32Array;
    atomAllowedFlat: Uint16Array;
    atomMins: Uint8Array;
    atomMaxs: Uint8Array;
    ruleAtomOffsets: Uint32Array;
    ruleAtomCounts: Uint32Array;
    ruleLabelIds: Uint16Array;
  }): { labelIds: Uint16Array; begins: Uint8Array } {
    const tokenTagsBlock = this.ensureBlock("chunk_token_tags", Math.max(1, input.tokenTagIds.length) * Uint16Array.BYTES_PER_ELEMENT);
    const atomOffBlock = this.ensureBlock("chunk_atom_off", Math.max(1, input.atomAllowedOffsets.length) * Uint32Array.BYTES_PER_ELEMENT);
    const atomLenBlock = this.ensureBlock("chunk_atom_len", Math.max(1, input.atomAllowedLengths.length) * Uint32Array.BYTES_PER_ELEMENT);
    const atomFlatBlock = this.ensureBlock("chunk_atom_flat", Math.max(1, input.atomAllowedFlat.length) * Uint16Array.BYTES_PER_ELEMENT);
    const atomMinBlock = this.ensureBlock("chunk_atom_min", Math.max(1, input.atomMins.length));
    const atomMaxBlock = this.ensureBlock("chunk_atom_max", Math.max(1, input.atomMaxs.length));
    const ruleOffBlock = this.ensureBlock("chunk_rule_off", Math.max(1, input.ruleAtomOffsets.length) * Uint32Array.BYTES_PER_ELEMENT);
    const ruleCountBlock = this.ensureBlock("chunk_rule_count", Math.max(1, input.ruleAtomCounts.length) * Uint32Array.BYTES_PER_ELEMENT);
    const ruleLabelBlock = this.ensureBlock("chunk_rule_label", Math.max(1, input.ruleLabelIds.length) * Uint16Array.BYTES_PER_ELEMENT);
    const outLabelBlock = this.ensureBlock("chunk_out_label", Math.max(1, input.tokenTagIds.length) * Uint16Array.BYTES_PER_ELEMENT);
    const outBeginBlock = this.ensureBlock("chunk_out_begin", Math.max(1, input.tokenTagIds.length));

    if (input.tokenTagIds.length > 0) {
      new Uint16Array(this.exports.memory.buffer, tokenTagsBlock.ptr, input.tokenTagIds.length).set(input.tokenTagIds);
      new Uint16Array(this.exports.memory.buffer, outLabelBlock.ptr, input.tokenTagIds.length).fill(0xffff);
      new Uint8Array(this.exports.memory.buffer, outBeginBlock.ptr, input.tokenTagIds.length).fill(0);
    }
    if (input.atomAllowedOffsets.length > 0) {
      new Uint32Array(this.exports.memory.buffer, atomOffBlock.ptr, input.atomAllowedOffsets.length).set(input.atomAllowedOffsets);
      new Uint32Array(this.exports.memory.buffer, atomLenBlock.ptr, input.atomAllowedLengths.length).set(input.atomAllowedLengths);
      new Uint16Array(this.exports.memory.buffer, atomFlatBlock.ptr, input.atomAllowedFlat.length).set(input.atomAllowedFlat);
      new Uint8Array(this.exports.memory.buffer, atomMinBlock.ptr, input.atomMins.length).set(input.atomMins);
      new Uint8Array(this.exports.memory.buffer, atomMaxBlock.ptr, input.atomMaxs.length).set(input.atomMaxs);
    }
    if (input.ruleAtomOffsets.length > 0) {
      new Uint32Array(this.exports.memory.buffer, ruleOffBlock.ptr, input.ruleAtomOffsets.length).set(input.ruleAtomOffsets);
      new Uint32Array(this.exports.memory.buffer, ruleCountBlock.ptr, input.ruleAtomCounts.length).set(input.ruleAtomCounts);
      new Uint16Array(this.exports.memory.buffer, ruleLabelBlock.ptr, input.ruleLabelIds.length).set(input.ruleLabelIds);
    }

    this.exports.bunnltk_wasm_chunk_iob_ids(
      tokenTagsBlock.ptr,
      input.tokenTagIds.length,
      atomOffBlock.ptr,
      atomLenBlock.ptr,
      atomFlatBlock.ptr,
      input.atomAllowedFlat.length,
      atomMinBlock.ptr,
      atomMaxBlock.ptr,
      input.atomMins.length,
      ruleOffBlock.ptr,
      ruleCountBlock.ptr,
      ruleLabelBlock.ptr,
      input.ruleLabelIds.length,
      outLabelBlock.ptr,
      outBeginBlock.ptr,
      input.tokenTagIds.length,
    );
    this.assertNoError("chunkIobIds");

    return {
      labelIds: Uint16Array.from(new Uint16Array(this.exports.memory.buffer, outLabelBlock.ptr, input.tokenTagIds.length)),
      begins: Uint8Array.from(new Uint8Array(this.exports.memory.buffer, outBeginBlock.ptr, input.tokenTagIds.length)),
    };
  }

  cykRecognizeIds(input: {
    tokenBits: BigUint64Array;
    binaryLeft: Uint16Array;
    binaryRight: Uint16Array;
    binaryParent: Uint16Array;
    unaryChild: Uint16Array;
    unaryParent: Uint16Array;
    startSymbol: number;
  }): boolean {
    const tokenBitsBlock = this.ensureBlock("cyk_token_bits", Math.max(1, input.tokenBits.length) * BigUint64Array.BYTES_PER_ELEMENT);
    const bLeftBlock = this.ensureBlock("cyk_binary_left", Math.max(1, input.binaryLeft.length) * Uint16Array.BYTES_PER_ELEMENT);
    const bRightBlock = this.ensureBlock("cyk_binary_right", Math.max(1, input.binaryRight.length) * Uint16Array.BYTES_PER_ELEMENT);
    const bParentBlock = this.ensureBlock("cyk_binary_parent", Math.max(1, input.binaryParent.length) * Uint16Array.BYTES_PER_ELEMENT);
    const uChildBlock = this.ensureBlock("cyk_unary_child", Math.max(1, input.unaryChild.length) * Uint16Array.BYTES_PER_ELEMENT);
    const uParentBlock = this.ensureBlock("cyk_unary_parent", Math.max(1, input.unaryParent.length) * Uint16Array.BYTES_PER_ELEMENT);

    if (input.tokenBits.length > 0) {
      new BigUint64Array(this.exports.memory.buffer, tokenBitsBlock.ptr, input.tokenBits.length).set(input.tokenBits);
    }
    if (input.binaryLeft.length > 0) {
      new Uint16Array(this.exports.memory.buffer, bLeftBlock.ptr, input.binaryLeft.length).set(input.binaryLeft);
      new Uint16Array(this.exports.memory.buffer, bRightBlock.ptr, input.binaryRight.length).set(input.binaryRight);
      new Uint16Array(this.exports.memory.buffer, bParentBlock.ptr, input.binaryParent.length).set(input.binaryParent);
    }
    if (input.unaryChild.length > 0) {
      new Uint16Array(this.exports.memory.buffer, uChildBlock.ptr, input.unaryChild.length).set(input.unaryChild);
      new Uint16Array(this.exports.memory.buffer, uParentBlock.ptr, input.unaryParent.length).set(input.unaryParent);
    }

    const out = this.exports.bunnltk_wasm_cyk_recognize_ids(
      tokenBitsBlock.ptr,
      input.tokenBits.length,
      bLeftBlock.ptr,
      bRightBlock.ptr,
      bParentBlock.ptr,
      input.binaryLeft.length,
      uChildBlock.ptr,
      uParentBlock.ptr,
      input.unaryChild.length,
      input.startSymbol,
    );
    this.assertNoError("cykRecognizeIds");
    return out === 1;
  }

  naiveBayesLogScoresIds(input: {
    docTokenIds: Uint32Array;
    vocabSize: number;
    tokenCountsMatrix: Uint32Array;
    labelDocCounts: Uint32Array;
    labelTokenTotals: Uint32Array;
    totalDocs: number;
    smoothing: number;
  }): Float64Array {
    const docBlock = this.ensureBlock("nb_doc_ids", Math.max(1, input.docTokenIds.length) * Uint32Array.BYTES_PER_ELEMENT);
    const matrixBlock = this.ensureBlock("nb_matrix", Math.max(1, input.tokenCountsMatrix.length) * Uint32Array.BYTES_PER_ELEMENT);
    const labelDocBlock = this.ensureBlock("nb_label_docs", Math.max(1, input.labelDocCounts.length) * Uint32Array.BYTES_PER_ELEMENT);
    const labelTokBlock = this.ensureBlock("nb_label_tok", Math.max(1, input.labelTokenTotals.length) * Uint32Array.BYTES_PER_ELEMENT);
    const outBlock = this.ensureBlock("nb_out_scores", Math.max(1, input.labelDocCounts.length) * Float64Array.BYTES_PER_ELEMENT);

    if (input.docTokenIds.length > 0) {
      new Uint32Array(this.exports.memory.buffer, docBlock.ptr, input.docTokenIds.length).set(input.docTokenIds);
    }
    new Uint32Array(this.exports.memory.buffer, matrixBlock.ptr, input.tokenCountsMatrix.length).set(input.tokenCountsMatrix);
    new Uint32Array(this.exports.memory.buffer, labelDocBlock.ptr, input.labelDocCounts.length).set(input.labelDocCounts);
    new Uint32Array(this.exports.memory.buffer, labelTokBlock.ptr, input.labelTokenTotals.length).set(input.labelTokenTotals);

    this.exports.bunnltk_wasm_naive_bayes_log_scores_ids(
      docBlock.ptr,
      input.docTokenIds.length,
      input.vocabSize,
      matrixBlock.ptr,
      input.tokenCountsMatrix.length,
      labelDocBlock.ptr,
      labelTokBlock.ptr,
      input.labelDocCounts.length,
      input.totalDocs,
      input.smoothing,
      outBlock.ptr,
      input.labelDocCounts.length,
    );
    this.assertNoError("naiveBayesLogScoresIds");
    return Float64Array.from(new Float64Array(this.exports.memory.buffer, outBlock.ptr, input.labelDocCounts.length));
  }
}
