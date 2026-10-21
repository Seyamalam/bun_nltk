import { assertOffsets, assertPerceptronBuffers, assertU32 } from "./numeric_validation.js";
function toNumber(v) {
  return typeof v === "bigint" ? Number(v) : v;
}
function defaultWasmUrl() {
  const relative = import.meta.url.includes("/dist/portable/") ? "../../native/bun_nltk.wasm" : "../native/bun_nltk.wasm";
  return new URL(relative, import.meta.url);
}

export class WasmNltk {
  exports;
  inputPtr = 0;
  maxInputBytes;
  disposed = false;
  encoder = new TextEncoder;
  decoder = new TextDecoder;
  blocks = new Map;
  constructor(exports, maxInputBytes) {
    this.exports = exports;
    this.maxInputBytes = maxInputBytes;
  }
  static initSync(wasmBytes, maxInputBytes = 128 * 1024 * 1024) {
    if (!Number.isSafeInteger(maxInputBytes) || maxInputBytes < 1 || maxInputBytes > 128 * 1024 * 1024) {
      throw new RangeError("maxInputBytes must be an integer between 1 and 134217728");
    }
    const instance = new WebAssembly.Instance(new WebAssembly.Module(wasmBytes), {});
    return WasmNltk.fromInstance(instance, maxInputBytes);
  }
  static fromInstance(instance, maxInputBytes) {
    const exports = instance.exports;
    if (!(exports.memory instanceof WebAssembly.Memory) || typeof exports.bunnltk_wasm_reserve_input !== "function" || typeof exports.bunnltk_wasm_release_input !== "function" || typeof exports.bunnltk_wasm_categorical_nb_train !== "function" || typeof exports.bunnltk_wasm_positive_categorical_nb_train !== "function" || typeof exports.bunnltk_wasm_metrics_stream_new !== "function" || typeof exports.bunnltk_wasm_perceptron_predict_batch !== "function" || exports.bunnltk_wasm_perceptron_predict_batch.length !== 9 || typeof exports.bunnltk_wasm_edit_distance !== "function") {
      throw new Error("incompatible WASM artifact: rebuild with bun run build:wasm");
    }
    return new WasmNltk(exports, maxInputBytes);
  }
  static async init(init = {}) {
    const maxInputBytes = init.maxInputBytes ?? 128 * 1024 * 1024;
    if (!Number.isSafeInteger(maxInputBytes) || maxInputBytes < 1 || maxInputBytes > 128 * 1024 * 1024) {
      throw new RangeError("maxInputBytes must be an integer between 1 and 134217728");
    }
    let bytes = init.wasmBytes;
    if (!bytes) {
      const url = init.wasmUrl ?? defaultWasmUrl();
      if (init.wasmPath || new URL(url, import.meta.url).protocol === "file:") {
        const { readFile } = await import("node:fs/promises");
        bytes = await readFile(init.wasmPath ?? new URL(url, import.meta.url));
      } else {
        const response = await fetch(url);
        if (!response.ok)
          throw new Error(`failed to load WASM: HTTP ${response.status}`);
        bytes = new Uint8Array(await response.arrayBuffer());
      }
    }
    const { instance } = await WebAssembly.instantiate(bytes, {});
    return WasmNltk.fromInstance(instance, maxInputBytes);
  }
  get memoryBytes() {
    return this.exports.memory.buffer.byteLength;
  }
  dispose() {
    if (this.disposed)
      return;
    for (const block of this.blocks.values()) {
      this.exports.bunnltk_wasm_free(block.ptr, block.bytes);
    }
    this.blocks.clear();
    this.exports.bunnltk_wasm_categorical_nb_clear();
    this.exports.bunnltk_wasm_decision_tree_clear?.();
    this.exports.bunnltk_wasm_metrics_stream_clear();
    this.exports.bunnltk_wasm_release_input();
    this.inputPtr = 0;
    this.disposed = true;
  }
  assertActive() {
    if (this.disposed)
      throw new Error("WasmNltk has been disposed");
  }
  assertOrder(n) {
    if (!Number.isSafeInteger(n) || n < 1 || n > 4294967295) {
      throw new RangeError("n must be a positive uint32 integer");
    }
  }
  tokenizerRequest(request) {
    this.assertActive();
    if (typeof this.exports.bunnltk_wasm_tokenizer_run !== "function" || typeof this.exports.bunnltk_wasm_tokenizer_output_ptr !== "function" || typeof this.exports.bunnltk_wasm_tokenizer_release !== "function") {
      throw new Error("incompatible WASM artifact: rebuild with bun run build:wasm");
    }
    const inputLen = this.writeInput(JSON.stringify(request));
    const size = this.exports.bunnltk_wasm_tokenizer_run(this.inputPtr, inputLen);
    try {
      const ptr = this.exports.bunnltk_wasm_tokenizer_output_ptr();
      const result = JSON.parse(this.decoder.decode(new Uint8Array(this.exports.memory.buffer, ptr, size)));
      if (this.exports.bunnltk_wasm_last_error_code() !== 0) {
        throw new Error(typeof result === "string" ? result : "Rust tokenizer error");
      }
      return result;
    } finally {
      this.exports.bunnltk_wasm_tokenizer_release();
    }
  }
  tokenize(text, kind = "treebank", options = {}) {
    if (typeof text !== "string")
      throw new TypeError("text must be a string");
    return this.tokenizerRequest({ kind, text, convert_parentheses: options.convertParentheses, blanklines: options.blanklines });
  }
  tokenizerSpans(text, kind = "treebank", options = {}) {
    if (typeof text !== "string")
      throw new TypeError("text must be a string");
    return this.tokenizerRequest({ kind, text, spans: true, blanklines: options.blanklines });
  }
  treebankDetokenize(tokens, convertParentheses = false) {
    if (!Array.isArray(tokens) || tokens.some((token) => typeof token !== "string"))
      throw new TypeError("tokens must be an array of strings");
    return this.tokenizerRequest({ kind: "treebank-detokenize", tokens, convert_parentheses: convertParentheses });
  }
  categoricalNaiveBayesTrain(input) {
    this.assertOrder(input.labelCount);
    if (!Number.isFinite(input.smoothing) || input.smoothing <= 0)
      throw new RangeError("smoothing must be positive and finite");
    const pairs = this.copyU32("categorical_pairs", input.pairs);
    const offsets = this.copyU32("categorical_offsets", input.offsets);
    const labels = this.copyU32("categorical_labels", input.labels);
    const handle = this.exports.bunnltk_wasm_categorical_nb_train(pairs.ptr, input.pairs.length, offsets.ptr, input.offsets.length, labels.ptr, input.labels.length, input.labelCount, input.smoothing);
    this.assertNoError("categoricalNaiveBayesTrain");
    return handle;
  }
  categoricalNaiveBayesPredict(handle, pairs, labelCount) {
    this.assertOrder(handle);
    this.assertOrder(labelCount);
    const input = this.copyU32("categorical_pairs", pairs);
    const output = this.ensureBlock("categorical_output", labelCount * Float64Array.BYTES_PER_ELEMENT);
    this.exports.bunnltk_wasm_categorical_nb_predict(handle, input.ptr, pairs.length, output.ptr, labelCount);
    this.assertNoError("categoricalNaiveBayesPredict");
    return Float64Array.from(new Float64Array(this.exports.memory.buffer, output.ptr, labelCount));
  }
  positiveCategoricalNaiveBayesTrain(input) {
    if (!Number.isFinite(input.positivePrior) || input.positivePrior < 0 || input.positivePrior >= 1)
      throw new RangeError("positivePrior must be finite and in [0, 1)");
    if (!Number.isFinite(input.smoothing) || input.smoothing <= 0)
      throw new RangeError("smoothing must be positive and finite");
    const positive = this.copyU32("positive_pairs", input.positivePairs);
    const positiveOffsets = this.copyU32("positive_offsets", input.positiveOffsets);
    const unlabeled = this.copyU32("unlabeled_pairs", input.unlabeledPairs);
    const unlabeledOffsets = this.copyU32("unlabeled_offsets", input.unlabeledOffsets);
    const handle = this.exports.bunnltk_wasm_positive_categorical_nb_train(positive.ptr, input.positivePairs.length, positiveOffsets.ptr, input.positiveOffsets.length, unlabeled.ptr, input.unlabeledPairs.length, unlabeledOffsets.ptr, input.unlabeledOffsets.length, input.positivePrior, input.smoothing);
    this.assertNoError("positiveCategoricalNaiveBayesTrain");
    return handle;
  }
  categoricalNaiveBayesFree(handle) {
    this.assertActive();
    this.assertOrder(handle);
    this.exports.bunnltk_wasm_categorical_nb_free(handle);
  }
  categoricalMaxentTrain(input) {
    this.assertActive();
    if (typeof this.exports.bunnltk_wasm_categorical_maxent_train !== "function")
      throw new Error("incompatible WASM artifact: rebuild with bun run build:wasm");
    this.assertOrder(input.labelCount);
    assertU32(input.maxIter, "maxIter", 0);
    assertU32(input.countCutoff, "countCutoff", 0);
    for (const [name, value] of [
      ["minLl", input.minLl],
      ["minLldelta", input.minLldelta],
      ["maxAcc", input.maxAcc],
      ["minAccdelta", input.minAccdelta]
    ]) {
      if (value !== undefined && !Number.isFinite(value))
        throw new RangeError(`${name} must be finite`);
    }
    if (input.pairs.length % 2 !== 0)
      throw new RangeError("pairs must contain feature/value pairs");
    assertOffsets(input.offsets, input.pairs.length / 2, "offsets");
    if (input.labels.length === 0 || input.offsets.length !== input.labels.length + 1)
      throw new RangeError("labels must match nonempty training rows");
    const pairs = this.copyU32("maxent_pairs", input.pairs);
    const offsets = this.copyU32("maxent_offsets", input.offsets);
    const labels = this.copyU32("maxent_labels", input.labels);
    const handle = this.exports.bunnltk_wasm_categorical_maxent_train(pairs.ptr, input.pairs.length, offsets.ptr, input.offsets.length, labels.ptr, input.labels.length, input.labelCount, input.algorithm === "gis" ? 1 : 0, input.maxIter, input.minLl ?? Number.NaN, input.minLldelta ?? Number.NaN, input.maxAcc ?? Number.NaN, input.minAccdelta ?? Number.NaN, input.countCutoff);
    this.assertNoError("categoricalMaxentTrain");
    return handle;
  }
  categoricalMaxentLoad(input) {
    this.assertActive();
    if (typeof this.exports.bunnltk_wasm_categorical_maxent_load !== "function")
      throw new Error("incompatible WASM artifact: rebuild with bun run build:wasm");
    this.assertOrder(input.labelCount);
    if (input.features.length % 3 !== 0)
      throw new RangeError("features must contain name/value/label triples");
    const expected = input.features.length / 3 + (input.algorithm === "gis" ? 1 : 0);
    if (input.weights.length !== expected)
      throw new RangeError(`weights length must be ${expected}`);
    if (input.algorithm === "gis" && (!Number.isFinite(input.correction) || input.correction <= 0))
      throw new RangeError("GIS correction must be finite and positive");
    const features = this.copyU32("maxent_features_load", input.features);
    const weights = this.copyF64("maxent_weights_load", input.weights);
    const handle = this.exports.bunnltk_wasm_categorical_maxent_load(features.ptr, input.features.length / 3, weights.ptr, input.weights.length, input.labelCount, input.algorithm === "gis" ? 1 : 0, input.correction ?? Number.NaN);
    this.assertNoError("categoricalMaxentLoad");
    return handle;
  }
  categoricalMaxentPredict(handle, pairs, labelCount) {
    this.assertOrder(handle);
    this.assertOrder(labelCount);
    const input = this.copyU32("maxent_pairs", pairs);
    const length = 2 * labelCount;
    const output = this.ensureBlock("maxent_output", length * Float64Array.BYTES_PER_ELEMENT);
    this.exports.bunnltk_wasm_categorical_maxent_predict(handle, input.ptr, pairs.length, output.ptr, length);
    this.assertNoError("categoricalMaxentPredict");
    return Float64Array.from(new Float64Array(this.exports.memory.buffer, output.ptr, length));
  }
  categoricalMaxentFeatureCount(handle) {
    this.assertOrder(handle);
    const count = this.exports.bunnltk_wasm_categorical_maxent_feature_count(handle);
    this.assertNoError("categoricalMaxentFeatureCount");
    return count;
  }
  categoricalMaxentWeightCount(handle) {
    this.assertOrder(handle);
    const count = this.exports.bunnltk_wasm_categorical_maxent_weight_count(handle);
    this.assertNoError("categoricalMaxentWeightCount");
    return count;
  }
  categoricalMaxentCorrection(handle) {
    this.assertOrder(handle);
    const value = this.exports.bunnltk_wasm_categorical_maxent_correction(handle);
    this.assertNoError("categoricalMaxentCorrection");
    return value;
  }
  categoricalMaxentFeatures(handle) {
    this.assertOrder(handle);
    const count = this.categoricalMaxentFeatureCount(handle);
    if (count === 0)
      return new Uint32Array;
    const length = count * 3;
    const output = this.ensureBlock("maxent_features", length * Uint32Array.BYTES_PER_ELEMENT);
    this.exports.bunnltk_wasm_categorical_maxent_copy_features(handle, output.ptr, length);
    this.assertNoError("categoricalMaxentFeatures");
    return Uint32Array.from(new Uint32Array(this.exports.memory.buffer, output.ptr, length));
  }
  categoricalMaxentWeights(handle) {
    this.assertOrder(handle);
    const count = this.categoricalMaxentWeightCount(handle);
    if (count === 0)
      return new Float64Array;
    const output = this.ensureBlock("maxent_weights", count * Float64Array.BYTES_PER_ELEMENT);
    this.exports.bunnltk_wasm_categorical_maxent_copy_weights(handle, output.ptr, count);
    this.assertNoError("categoricalMaxentWeights");
    return Float64Array.from(new Float64Array(this.exports.memory.buffer, output.ptr, count));
  }
  categoricalMaxentFree(handle) {
    if (this.disposed)
      return;
    this.assertOrder(handle);
    this.exports.bunnltk_wasm_categorical_maxent_free(handle);
  }
  copyU32(key, values) {
    const block = this.ensureBlock(key, values.byteLength);
    new Uint32Array(this.exports.memory.buffer, block.ptr, values.length).set(values);
    return block;
  }
  copyF64(key, values) {
    const block = this.ensureBlock(key, values.byteLength);
    new Float64Array(this.exports.memory.buffer, block.ptr, values.length).set(values);
    return block;
  }
  decisionTreeTrain(input) {
    this.assertActive();
    if (typeof this.exports.bunnltk_wasm_decision_tree_train !== "function")
      throw new Error("incompatible WASM artifact: rebuild with bun run build:wasm");
    assertU32(input.labelCount, "labelCount");
    assertU32(input.depthCutoff, "depthCutoff", 1, 100);
    assertU32(input.supportCutoff, "supportCutoff", 0);
    if (!Number.isFinite(input.entropyCutoff) || input.entropyCutoff < 0)
      throw new RangeError("entropyCutoff must be finite and nonnegative");
    if (input.pairs.length % 2 !== 0)
      throw new RangeError("pairs must contain feature/value pairs");
    assertOffsets(input.offsets, input.pairs.length / 2, "offsets");
    if (input.labels.length === 0 || input.offsets.length !== input.labels.length + 1)
      throw new RangeError("labels must match nonempty training rows");
    const pairs = this.copyU32("tree_pairs", input.pairs), offsets = this.copyU32("tree_offsets", input.offsets), labels = this.copyU32("tree_labels", input.labels);
    const handle = this.exports.bunnltk_wasm_decision_tree_train(pairs.ptr, input.pairs.length, offsets.ptr, input.offsets.length, labels.ptr, input.labels.length, input.labelCount, input.entropyCutoff, input.depthCutoff, input.supportCutoff, input.binary ? 1 : 0);
    this.assertNoError("decisionTreeTrain");
    return handle;
  }
  decisionTreeClassify(handle, pairs) {
    this.assertActive();
    this.assertOrder(handle);
    const input = this.copyU32("tree_pairs", pairs);
    const label = this.exports.bunnltk_wasm_decision_tree_classify(handle, input.ptr, pairs.length);
    this.assertNoError("decisionTreeClassify");
    return label;
  }
  decisionTreeLabels(handle, labelCount) {
    this.assertActive();
    this.assertOrder(handle);
    this.assertOrder(labelCount);
    const out = this.ensureBlock("tree_labels_output", labelCount * 4);
    const count = this.exports.bunnltk_wasm_decision_tree_labels(handle, out.ptr, labelCount);
    this.assertNoError("decisionTreeLabels");
    return Uint32Array.from(new Uint32Array(this.exports.memory.buffer, out.ptr, count));
  }
  decisionTreeFree(handle) {
    if (this.disposed)
      return;
    this.assertOrder(handle);
    this.exports.bunnltk_wasm_decision_tree_free(handle);
  }
  distanceInputs(left, right, cost) {
    this.assertActive();
    if (typeof left !== "string" || typeof right !== "string")
      throw new TypeError("distance inputs must be strings");
    if (!Number.isFinite(cost))
      throw new RangeError("substitutionCost must be finite");
    if (Math.max(left.length, right.length) > 4000)
      throw new RangeError("input length exceeds MAX_DISTANCE_INPUT_LEN (2000)");
    const a = Array.from(left), b = Array.from(right);
    if (Math.max(a.length, b.length) > 2000)
      throw new RangeError("input length exceeds MAX_DISTANCE_INPUT_LEN (2000)");
    return { left: Uint32Array.from(a, (c) => c.codePointAt(0)), right: Uint32Array.from(b, (c) => c.codePointAt(0)) };
  }
  editDistance(left, right, options = {}) {
    const cost = options.substitutionCost ?? 1;
    const points = this.distanceInputs(left, right, cost);
    const a = this.copyU32("distance_left", points.left), b = this.copyU32("distance_right", points.right);
    const result = this.exports.bunnltk_wasm_edit_distance(a.ptr, points.left.length, b.ptr, points.right.length, cost, options.transpositions ? 1 : 0);
    this.assertNoError("editDistance");
    return result;
  }
  editDistanceAlign(left, right, substitutionCost = 1) {
    const points = this.distanceInputs(left, right, substitutionCost);
    const a = this.copyU32("distance_left", points.left), b = this.copyU32("distance_right", points.right);
    const size = (points.left.length + points.right.length + 1) * 2;
    const out = this.ensureBlock("distance_alignment", size * Uint32Array.BYTES_PER_ELEMENT);
    const count = this.exports.bunnltk_wasm_edit_alignment(a.ptr, points.left.length, b.ptr, points.right.length, substitutionCost, out.ptr, size);
    this.assertNoError("editDistanceAlign");
    const data = new Uint32Array(this.exports.memory.buffer, out.ptr, count * 2);
    return Array.from({ length: count }, (_, i) => [data[i * 2], data[i * 2 + 1]]);
  }
  assertNoError(context) {
    const code = this.exports.bunnltk_wasm_last_error_code();
    if (code !== 0) {
      throw new Error(`wasm error code ${code} in ${context}`);
    }
  }
  ensureBlock(key, bytes) {
    this.assertActive();
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > 4294967295) {
      throw new RangeError(`invalid WASM allocation size for ${key}`);
    }
    bytes = Math.max(16, bytes);
    const existing = this.blocks.get(key);
    if (existing && existing.bytes >= bytes)
      return existing;
    if (existing) {
      this.exports.bunnltk_wasm_free(existing.ptr, existing.bytes);
      this.blocks.delete(key);
    }
    const ptr = this.exports.bunnltk_wasm_alloc(bytes);
    this.assertNoError(`alloc:${key}`);
    if (!ptr)
      throw new Error(`failed to allocate wasm block for ${key}`);
    const block = { ptr, bytes };
    this.blocks.set(key, block);
    return block;
  }
  writeInput(text) {
    this.assertActive();
    if (typeof text !== "string")
      throw new TypeError("text must be a string");
    const encoded = this.encoder.encode(text);
    return this.writeBytes(encoded);
  }
  writeBytes(encoded) {
    this.assertActive();
    if (encoded.length > this.maxInputBytes) {
      throw new RangeError(`input too large for wasm input buffer: ${encoded.length} > ${this.maxInputBytes}`);
    }
    this.inputPtr = this.exports.bunnltk_wasm_reserve_input(encoded.length);
    this.assertNoError("reserveInput");
    if (!this.inputPtr)
      throw new Error("failed to allocate WASM input staging");
    const mem = new Uint8Array(this.exports.memory.buffer);
    mem.set(encoded, this.inputPtr);
    return encoded.length;
  }
  createAsciiMetricsStream(n, options = {}) {
    this.assertActive();
    if (!Number.isSafeInteger(n) || n < 1 || n > 64)
      throw new RangeError("stream n must be an integer in [1, 64]");
    const maxTokenBytes = options.maxTokenBytes ?? 1048576;
    const maxUniqueTokens = options.maxUniqueTokens ?? 1e6;
    const maxUniqueNgrams = options.maxUniqueNgrams ?? 1e6;
    for (const value of [maxTokenBytes, maxUniqueTokens, maxUniqueNgrams])
      this.assertOrder(value);
    const handle = this.exports.bunnltk_wasm_metrics_stream_new(n, maxTokenBytes, maxUniqueTokens, maxUniqueNgrams);
    this.assertNoError("createAsciiMetricsStream");
    let disposed = false, finished = false, failed = false;
    const active = () => {
      this.assertActive();
      if (disposed)
        throw new Error("metrics stream has been disposed");
      if (failed)
        throw new Error("metrics stream failed; dispose and create a new stream");
    };
    return {
      update: (chunk) => {
        active();
        if (finished)
          throw new Error("metrics stream has been finished");
        if (!(chunk instanceof Uint8Array))
          throw new TypeError("stream chunks must be Uint8Array bytes");
        try {
          const size = this.writeBytes(chunk);
          this.exports.bunnltk_wasm_metrics_stream_update(handle, size);
          this.assertNoError("metricsStream.update");
        } catch (error) {
          failed = true;
          throw error;
        }
      },
      finish: () => {
        active();
        try {
          const out = this.ensureBlock("stream_metrics", 4 * BigUint64Array.BYTES_PER_ELEMENT);
          this.exports.bunnltk_wasm_metrics_stream_finish(handle, out.ptr, 4);
          this.assertNoError("metricsStream.finish");
          finished = true;
          const values = new BigUint64Array(this.exports.memory.buffer, out.ptr, 4);
          return { tokens: Number(values[0]), uniqueTokens: Number(values[1]), ngrams: Number(values[2]), uniqueNgrams: Number(values[3]) };
        } catch (error) {
          failed = true;
          throw error;
        }
      },
      dispose: () => {
        if (disposed)
          return;
        this.assertActive();
        this.exports.bunnltk_wasm_metrics_stream_free(handle);
        disposed = true;
      }
    };
  }
  countTokensAscii(text) {
    const inputLen = this.writeInput(text);
    const count = toNumber(this.exports.bunnltk_wasm_count_tokens_ascii(inputLen));
    this.assertNoError("countTokensAscii");
    return count;
  }
  countNgramsAscii(text, n) {
    this.assertOrder(n);
    const inputLen = this.writeInput(text);
    const out = toNumber(this.exports.bunnltk_wasm_count_ngrams_ascii(inputLen, n));
    this.assertNoError("countNgramsAscii");
    return out;
  }
  computeAsciiMetrics(text, n) {
    this.assertOrder(n);
    const inputLen = this.writeInput(text);
    const block = this.ensureBlock("metrics", 4 * BigUint64Array.BYTES_PER_ELEMENT);
    this.exports.bunnltk_wasm_compute_ascii_metrics(inputLen, n, block.ptr, 4);
    this.assertNoError("computeAsciiMetrics");
    const values = new BigUint64Array(this.exports.memory.buffer, block.ptr, 4);
    return {
      tokens: Number(values[0]),
      uniqueTokens: Number(values[1]),
      ngrams: Number(values[2]),
      uniqueNgrams: Number(values[3])
    };
  }
  tokenOffsetsAscii(text) {
    const inputLen = this.writeInput(text);
    const total = toNumber(this.exports.bunnltk_wasm_count_tokens_ascii(inputLen));
    if (total === 0) {
      return {
        total: 0,
        offsets: new Uint32Array(0),
        lengths: new Uint32Array(0),
        input: new Uint8Array(0)
      };
    }
    const offsetsBlock = this.ensureBlock("offsets", total * Uint32Array.BYTES_PER_ELEMENT);
    const lengthsBlock = this.ensureBlock("lengths", total * Uint32Array.BYTES_PER_ELEMENT);
    const written = toNumber(this.exports.bunnltk_wasm_fill_token_offsets_ascii(inputLen, offsetsBlock.ptr, lengthsBlock.ptr, total));
    this.assertNoError("tokenOffsetsAscii");
    return {
      total: written,
      offsets: Uint32Array.from(new Uint32Array(this.exports.memory.buffer, offsetsBlock.ptr, written)),
      lengths: Uint32Array.from(new Uint32Array(this.exports.memory.buffer, lengthsBlock.ptr, written)),
      input: Uint8Array.from(new Uint8Array(this.exports.memory.buffer, this.inputPtr, inputLen))
    };
  }
  normalizedTokenOffsetsAscii(text, removeStopwords = true) {
    const inputLen = this.writeInput(text);
    const total = toNumber(this.exports.bunnltk_wasm_count_normalized_tokens_ascii(inputLen, removeStopwords ? 1 : 0));
    this.assertNoError("normalizedTokenOffsetsAscii.count");
    if (total === 0) {
      return {
        total: 0,
        offsets: new Uint32Array(0),
        lengths: new Uint32Array(0),
        input: new Uint8Array(0)
      };
    }
    const offsetsBlock = this.ensureBlock("norm_offsets", total * Uint32Array.BYTES_PER_ELEMENT);
    const lengthsBlock = this.ensureBlock("norm_lengths", total * Uint32Array.BYTES_PER_ELEMENT);
    const written = toNumber(this.exports.bunnltk_wasm_fill_normalized_token_offsets_ascii(inputLen, removeStopwords ? 1 : 0, offsetsBlock.ptr, lengthsBlock.ptr, total));
    this.assertNoError("normalizedTokenOffsetsAscii.fill");
    return {
      total: written,
      offsets: Uint32Array.from(new Uint32Array(this.exports.memory.buffer, offsetsBlock.ptr, written)),
      lengths: Uint32Array.from(new Uint32Array(this.exports.memory.buffer, lengthsBlock.ptr, written)),
      input: Uint8Array.from(new Uint8Array(this.exports.memory.buffer, this.inputPtr, inputLen))
    };
  }
  tokenizeAscii(text) {
    const { total, offsets, lengths, input } = this.tokenOffsetsAscii(text);
    const out = new Array(total);
    for (let i = 0;i < total; i += 1) {
      const start = offsets[i];
      const len = lengths[i];
      out[i] = this.decoder.decode(input.subarray(start, start + len)).toLowerCase();
    }
    return out;
  }
  sentenceTokenizePunktAscii(text) {
    const inputLen = this.writeInput(text);
    const total = toNumber(this.exports.bunnltk_wasm_count_sentences_punkt_ascii(inputLen));
    this.assertNoError("sentenceTokenizePunktAscii.count");
    if (total === 0)
      return [];
    const offsetsBlock = this.ensureBlock("sent_offsets", total * Uint32Array.BYTES_PER_ELEMENT);
    const lengthsBlock = this.ensureBlock("sent_lengths", total * Uint32Array.BYTES_PER_ELEMENT);
    const written = toNumber(this.exports.bunnltk_wasm_fill_sentence_offsets_punkt_ascii(inputLen, offsetsBlock.ptr, lengthsBlock.ptr, total));
    this.assertNoError("sentenceTokenizePunktAscii.fill");
    const offsets = new Uint32Array(this.exports.memory.buffer, offsetsBlock.ptr, written);
    const lengths = new Uint32Array(this.exports.memory.buffer, lengthsBlock.ptr, written);
    const input = new Uint8Array(this.exports.memory.buffer, this.inputPtr, inputLen);
    const out = new Array(written);
    for (let i = 0;i < written; i += 1) {
      const start = offsets[i];
      const len = lengths[i];
      out[i] = this.decoder.decode(input.subarray(start, start + len));
    }
    return out;
  }
  normalizeTokensAscii(text, removeStopwords = true) {
    const { total, offsets, lengths, input } = this.normalizedTokenOffsetsAscii(text, removeStopwords);
    const out = new Array(total);
    for (let i = 0;i < total; i += 1) {
      const start = offsets[i];
      const len = lengths[i];
      out[i] = this.decoder.decode(input.subarray(start, start + len)).toLowerCase();
    }
    return out;
  }
  perceptronPredictBatch(featureIds, tokenOffsets, weights, modelFeatureCount, tagCount) {
    assertPerceptronBuffers(featureIds, tokenOffsets, weights, modelFeatureCount, tagCount);
    if (tokenOffsets.length === 0)
      return new Uint16Array(0);
    const tokenCount = tokenOffsets.length - 1;
    const featureBlock = this.ensureBlock("perceptron_feature_ids", featureIds.length * Uint32Array.BYTES_PER_ELEMENT);
    const offsetBlock = this.ensureBlock("perceptron_token_offsets", tokenOffsets.length * Uint32Array.BYTES_PER_ELEMENT);
    const weightBlock = this.ensureBlock("perceptron_weights", weights.length * Float32Array.BYTES_PER_ELEMENT);
    const outBlock = this.ensureBlock("perceptron_out_tags", tokenCount * Uint16Array.BYTES_PER_ELEMENT);
    new Uint32Array(this.exports.memory.buffer, featureBlock.ptr, featureIds.length).set(featureIds);
    new Uint32Array(this.exports.memory.buffer, offsetBlock.ptr, tokenOffsets.length).set(tokenOffsets);
    new Float32Array(this.exports.memory.buffer, weightBlock.ptr, weights.length).set(weights);
    this.exports.bunnltk_wasm_perceptron_predict_batch(featureBlock.ptr, featureIds.length, offsetBlock.ptr, tokenCount, weightBlock.ptr, modelFeatureCount, tagCount, outBlock.ptr, weights.length);
    this.assertNoError("perceptronPredictBatch");
    return Uint16Array.from(new Uint16Array(this.exports.memory.buffer, outBlock.ptr, tokenCount));
  }
  wordnetMorphyAscii(word, pos) {
    const inputLen = this.writeInput(word);
    const outBlock = this.ensureBlock("wordnet_morphy", Math.max(64, inputLen + 8));
    const posCode = pos === "n" ? 1 : pos === "v" ? 2 : pos === "a" ? 3 : pos === "r" ? 4 : 0;
    const written = this.exports.bunnltk_wasm_wordnet_morphy_ascii(inputLen, posCode, outBlock.ptr, outBlock.bytes);
    this.assertNoError("wordnetMorphyAscii");
    if (written <= 0)
      return "";
    return this.decoder.decode(new Uint8Array(this.exports.memory.buffer, outBlock.ptr, written));
  }
  evaluateLanguageModelIds(input) {
    const tokenBlock = this.ensureBlock("lm_token_ids", input.tokenIds.length * Uint32Array.BYTES_PER_ELEMENT);
    const sentBlock = this.ensureBlock("lm_sentence_offsets", input.sentenceOffsets.length * Uint32Array.BYTES_PER_ELEMENT);
    const probeFlatBlock = this.ensureBlock("lm_probe_flat", Math.max(1, input.probeContextFlat.length) * Uint32Array.BYTES_PER_ELEMENT);
    const probeLensBlock = this.ensureBlock("lm_probe_lens", Math.max(1, input.probeContextLens.length) * Uint32Array.BYTES_PER_ELEMENT);
    const probeWordBlock = this.ensureBlock("lm_probe_words", Math.max(1, input.probeWordIds.length) * Uint32Array.BYTES_PER_ELEMENT);
    const scoreBlock = this.ensureBlock("lm_scores", Math.max(1, input.probeWordIds.length) * Float64Array.BYTES_PER_ELEMENT);
    const pplTokensBlock = this.ensureBlock("lm_ppl_tokens", Math.max(1, input.perplexityTokenIds.length) * Uint32Array.BYTES_PER_ELEMENT);
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
    const perplexity = this.exports.bunnltk_wasm_lm_eval_ids(tokenBlock.ptr, input.tokenIds.length, sentBlock.ptr, input.sentenceOffsets.length, input.order, modelType, input.gamma, input.discount, input.vocabSize, probeFlatBlock.ptr, input.probeContextFlat.length, probeLensBlock.ptr, probeWordBlock.ptr, input.probeWordIds.length, scoreBlock.ptr, input.probeWordIds.length, pplTokensBlock.ptr, input.perplexityTokenIds.length, prefixBlock.ptr, input.prefixTokenIds.length);
    this.assertNoError("evaluateLanguageModelIds");
    const scores = Float64Array.from(new Float64Array(this.exports.memory.buffer, scoreBlock.ptr, input.probeWordIds.length));
    return { scores, perplexity };
  }
  chunkIobIds(input) {
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
      new Uint16Array(this.exports.memory.buffer, outLabelBlock.ptr, input.tokenTagIds.length).fill(65535);
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
    this.exports.bunnltk_wasm_chunk_iob_ids(tokenTagsBlock.ptr, input.tokenTagIds.length, atomOffBlock.ptr, atomLenBlock.ptr, atomFlatBlock.ptr, input.atomAllowedFlat.length, atomMinBlock.ptr, atomMaxBlock.ptr, input.atomMins.length, ruleOffBlock.ptr, ruleCountBlock.ptr, ruleLabelBlock.ptr, input.ruleLabelIds.length, outLabelBlock.ptr, outBeginBlock.ptr, input.tokenTagIds.length);
    this.assertNoError("chunkIobIds");
    return {
      labelIds: Uint16Array.from(new Uint16Array(this.exports.memory.buffer, outLabelBlock.ptr, input.tokenTagIds.length)),
      begins: Uint8Array.from(new Uint8Array(this.exports.memory.buffer, outBeginBlock.ptr, input.tokenTagIds.length))
    };
  }
  cykRecognizeIds(input) {
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
    const out = this.exports.bunnltk_wasm_cyk_recognize_ids(tokenBitsBlock.ptr, input.tokenBits.length, bLeftBlock.ptr, bRightBlock.ptr, bParentBlock.ptr, input.binaryLeft.length, uChildBlock.ptr, uParentBlock.ptr, input.unaryChild.length, input.startSymbol);
    this.assertNoError("cykRecognizeIds");
    return out === 1;
  }
  naiveBayesLogScoresIds(input) {
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
    this.exports.bunnltk_wasm_naive_bayes_log_scores_ids(docBlock.ptr, input.docTokenIds.length, input.vocabSize, matrixBlock.ptr, input.tokenCountsMatrix.length, labelDocBlock.ptr, labelTokBlock.ptr, input.labelDocCounts.length, input.totalDocs, input.smoothing, outBlock.ptr, input.labelDocCounts.length);
    this.assertNoError("naiveBayesLogScoresIds");
    return Float64Array.from(new Float64Array(this.exports.memory.buffer, outBlock.ptr, input.labelDocCounts.length));
  }
  bleuStatsIds(input) {
    const refsFlatBlock = this.ensureBlock("bleu_refs_flat", Math.max(1, input.refsFlat.length) * Uint32Array.BYTES_PER_ELEMENT);
    const refsOffBlock = this.ensureBlock("bleu_refs_offsets", Math.max(1, input.refsOffsets.length) * Uint32Array.BYTES_PER_ELEMENT);
    const groupStartsBlock = this.ensureBlock("bleu_group_starts", Math.max(1, input.hypRefGroupStarts.length) * Uint32Array.BYTES_PER_ELEMENT);
    const groupCountsBlock = this.ensureBlock("bleu_group_counts", Math.max(1, input.hypRefCounts.length) * Uint32Array.BYTES_PER_ELEMENT);
    const hypsFlatBlock = this.ensureBlock("bleu_hyps_flat", Math.max(1, input.hypsFlat.length) * Uint32Array.BYTES_PER_ELEMENT);
    const hypsOffBlock = this.ensureBlock("bleu_hyps_offsets", Math.max(1, input.hypsOffsets.length) * Uint32Array.BYTES_PER_ELEMENT);
    const outBlock = this.ensureBlock("bleu_out", 12 * BigUint64Array.BYTES_PER_ELEMENT);
    if (input.refsFlat.length > 0) {
      new Uint32Array(this.exports.memory.buffer, refsFlatBlock.ptr, input.refsFlat.length).set(input.refsFlat);
    }
    new Uint32Array(this.exports.memory.buffer, refsOffBlock.ptr, input.refsOffsets.length).set(input.refsOffsets);
    new Uint32Array(this.exports.memory.buffer, groupStartsBlock.ptr, input.hypRefGroupStarts.length).set(input.hypRefGroupStarts);
    new Uint32Array(this.exports.memory.buffer, groupCountsBlock.ptr, input.hypRefCounts.length).set(input.hypRefCounts);
    if (input.hypsFlat.length > 0) {
      new Uint32Array(this.exports.memory.buffer, hypsFlatBlock.ptr, input.hypsFlat.length).set(input.hypsFlat);
    }
    new Uint32Array(this.exports.memory.buffer, hypsOffBlock.ptr, input.hypsOffsets.length).set(input.hypsOffsets);
    this.exports.bunnltk_wasm_bleu_stats_ids(refsFlatBlock.ptr, input.refsFlat.length, refsOffBlock.ptr, input.refsOffsets.length, groupStartsBlock.ptr, groupCountsBlock.ptr, input.hypRefGroupStarts.length, hypsFlatBlock.ptr, input.hypsFlat.length, hypsOffBlock.ptr, input.hypsOffsets.length, input.maxOrder, outBlock.ptr, 12);
    this.assertNoError("bleuStatsIds");
    const out = new BigUint64Array(this.exports.memory.buffer, outBlock.ptr, 12);
    return {
      clipped: out.slice(0, 5),
      totals: out.slice(5, 10),
      refLen: out[10],
      hypLen: out[11]
    };
  }
  nistStatsIds(input) {
    const refsFlatBlock = this.ensureBlock("nist_refs_flat", Math.max(1, input.refsFlat.length) * Uint32Array.BYTES_PER_ELEMENT);
    const refsOffBlock = this.ensureBlock("nist_refs_offsets", Math.max(1, input.refsOffsets.length) * Uint32Array.BYTES_PER_ELEMENT);
    const groupStartsBlock = this.ensureBlock("nist_group_starts", Math.max(1, input.hypRefGroupStarts.length) * Uint32Array.BYTES_PER_ELEMENT);
    const groupCountsBlock = this.ensureBlock("nist_group_counts", Math.max(1, input.hypRefCounts.length) * Uint32Array.BYTES_PER_ELEMENT);
    const hypsFlatBlock = this.ensureBlock("nist_hyps_flat", Math.max(1, input.hypsFlat.length) * Uint32Array.BYTES_PER_ELEMENT);
    const hypsOffBlock = this.ensureBlock("nist_hyps_offsets", Math.max(1, input.hypsOffsets.length) * Uint32Array.BYTES_PER_ELEMENT);
    const outBlock = this.ensureBlock("nist_out", 14 * Float64Array.BYTES_PER_ELEMENT);
    if (input.refsFlat.length > 0) {
      new Uint32Array(this.exports.memory.buffer, refsFlatBlock.ptr, input.refsFlat.length).set(input.refsFlat);
    }
    new Uint32Array(this.exports.memory.buffer, refsOffBlock.ptr, input.refsOffsets.length).set(input.refsOffsets);
    new Uint32Array(this.exports.memory.buffer, groupStartsBlock.ptr, input.hypRefGroupStarts.length).set(input.hypRefGroupStarts);
    new Uint32Array(this.exports.memory.buffer, groupCountsBlock.ptr, input.hypRefCounts.length).set(input.hypRefCounts);
    if (input.hypsFlat.length > 0) {
      new Uint32Array(this.exports.memory.buffer, hypsFlatBlock.ptr, input.hypsFlat.length).set(input.hypsFlat);
    }
    new Uint32Array(this.exports.memory.buffer, hypsOffBlock.ptr, input.hypsOffsets.length).set(input.hypsOffsets);
    this.exports.bunnltk_wasm_nist_stats_ids(refsFlatBlock.ptr, input.refsFlat.length, refsOffBlock.ptr, input.refsOffsets.length, groupStartsBlock.ptr, groupCountsBlock.ptr, input.hypRefGroupStarts.length, hypsFlatBlock.ptr, input.hypsFlat.length, hypsOffBlock.ptr, input.hypsOffsets.length, input.n, outBlock.ptr, 14);
    this.assertNoError("nistStatsIds");
    const out = new Float64Array(this.exports.memory.buffer, outBlock.ptr, 14);
    return {
      numerators: out.slice(0, 5),
      denominators: out.slice(5, 10),
      lRef: out[10],
      lSys: out[11]
    };
  }
}
