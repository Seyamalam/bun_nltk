export class MetricZeroDivisionError extends RangeError {
  constructor() {
    super("division by zero");
    this.name = "ZeroDivisionError";
  }
}
export function internLabels(a, b, extra = []) {
  const ids = new Map;
  const encode = (values) => Uint32Array.from(values, (label) => {
    let id = ids.get(label);
    if (id === undefined) {
      id = ids.size;
      if (id >= 4294967295)
        throw new RangeError("too many distinct labels");
      ids.set(label, id);
    }
    return id;
  });
  const left = encode(a), right = encode(b);
  encode(extra);
  return { a: left, b: right, labels: [...ids.keys()], ids };
}

export class MetricsWasm {
  exports;
  allocate;
  constructor(exports, allocate) {
    this.exports = exports;
    this.allocate = allocate;
  }
  block(key, bytes) {
    const ptr = this.allocate(`evaluation_${key}`, bytes).ptr;
    if (typeof this.exports.bunnltk_wasm_set_score !== "function") {
      throw new Error("incompatible WASM artifact: rebuild with bun run build:wasm");
    }
    return ptr;
  }
  u32(key, values) {
    const ptr = this.block(key, values.byteLength);
    new Uint32Array(this.exports.memory.buffer, ptr, values.length).set(values);
    return ptr;
  }
  f64(key, values) {
    const ptr = this.block(key, values.byteLength);
    new Float64Array(this.exports.memory.buffer, ptr, values.length).set(values);
    return ptr;
  }
  check(status) {
    if (status === 2)
      throw new MetricZeroDivisionError;
    if (status === 3)
      throw new RangeError("invalid metric input");
    if (status === 4)
      throw new RangeError("unknown metric label");
    if (status === 5) {
      const error = new RangeError("numeric overflow");
      error.name = "OverflowError";
      throw error;
    }
    if (status !== 0)
      throw new Error(`unknown metrics ABI status ${status}`);
  }
  scalar(call) {
    const out = this.block("scalar", 8);
    const status = call(out);
    if (status === 1)
      return null;
    this.check(status);
    return new Float64Array(this.exports.memory.buffer, out, 1)[0];
  }
  setScore(op, a, b, label = 0, alpha = 0.5) {
    const ap = this.u32("set_a", a), bp = this.u32("set_b", b);
    return this.scalar((out) => this.exports.bunnltk_wasm_set_score(op, ap, a.length, bp, b.length, label, alpha, out));
  }
  binary(equal) {
    this.block("scalar", 8);
    return this.exports.bunnltk_wasm_binary_score(Number(equal));
  }
  interval(a, b) {
    this.block("scalar", 8);
    return this.exports.bunnltk_wasm_interval_score(a, b);
  }
  accuracy(a, b) {
    const ap = this.u32("accuracy_a", a), bp = this.u32("accuracy_b", b);
    return this.scalar((out) => this.exports.bunnltk_wasm_accuracy_score(ap, a.length, bp, b.length, out));
  }
  logLikelihood(probabilities) {
    const p = this.f64("probabilities", probabilities);
    return this.scalar((out) => this.exports.bunnltk_wasm_log_likelihood_score(p, probabilities.length, out));
  }
  spearman(a, ar, b, br) {
    const ap = this.u32("rank_a", a), arp = this.f64("rank_ar", ar), bp = this.u32("rank_b", b), brp = this.f64("rank_br", br);
    return this.scalar((out) => this.exports.bunnltk_wasm_spearman_score(ap, arp, a.length, bp, brp, b.length, out));
  }
  ranks(scores, gap) {
    const p = this.f64("scores", scores), out = this.block("ranks", scores.length * 4);
    this.check(this.exports.bunnltk_wasm_ranks_from_scores(p, scores.length, gap, out));
    return Uint32Array.from(new Uint32Array(this.exports.memory.buffer, out, scores.length));
  }
  segmentation(a, b, ab, bb, flags, k) {
    if (a.length !== b.length)
      throw new RangeError("Segmentations have unequal length");
    const ap = this.u32("seg_a", a), bp = this.u32("seg_b", b), abp = this.u32("seg_ab", ab), bbp = this.u32("seg_bb", bb);
    return this.scalar((out) => this.exports.bunnltk_wasm_segmentation_score(ap, bp, a.length, abp, ab.length, bbp, bb.length, flags, k, out));
  }
  confusion(a, b, labels) {
    if (a.length !== b.length)
      throw new RangeError("Lists must have the same length.");
    let mode = 0;
    let keys = new Uint32Array;
    let offsets = new Uint32Array;
    if (labels.every((v) => typeof v === "string")) {
      mode = 2;
      const flat = [], starts = [0];
      for (const label of labels) {
        for (const c of label)
          flat.push(c.codePointAt(0));
        starts.push(flat.length);
      }
      keys = Uint32Array.from(flat);
      offsets = Uint32Array.from(starts);
    } else if (labels.every((v) => typeof v === "number")) {
      mode = 1;
      keys = Float64Array.from(labels);
    }
    const ap = this.u32("cm_a", a), bp = this.u32("cm_b", b);
    const kp = keys instanceof Float64Array ? this.f64("cm_keys", keys) : this.u32("cm_keys", keys);
    const op = this.u32("cm_offsets", offsets);
    const order = this.block("cm_order", labels.length * 4), cells = this.block("cm_cells", a.length * 12), meta = this.block("cm_meta", 40);
    this.check(this.exports.bunnltk_wasm_confusion_build(ap, bp, a.length, labels.length, mode, kp, op, keys.length, order, cells, meta));
    const values = new Float64Array(this.exports.memory.buffer, meta, 5);
    return {
      order: Uint32Array.from(new Uint32Array(this.exports.memory.buffer, order, labels.length)),
      cells: Uint32Array.from(new Uint32Array(this.exports.memory.buffer, cells, values[1] * 3)),
      correct: values[2],
      total: values[3],
      accuracy: values[4]
    };
  }
  confusionScore(op, cells, label, alpha = 0.5) {
    const p = this.u32("cm_probe", cells);
    return this.scalar((out) => this.exports.bunnltk_wasm_confusion_score(op, p, cells.length / 3, label, alpha, out));
  }
  translation(op, packet, min, max, beta, whitespace) {
    const p = this.u32("translation", packet);
    return this.scalar((out) => this.exports.bunnltk_wasm_translation_score(op, p, packet.length, min, max, beta, Number(whitespace), out));
  }
  nistLengthPenalty(reference, hypothesis) {
    return this.scalar((out) => this.exports.bunnltk_wasm_nist_length_score(reference, hypothesis, out));
  }
}
