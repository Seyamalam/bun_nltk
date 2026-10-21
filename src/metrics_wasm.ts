/** Evaluation ABI marshaling only. Status is separate from numeric NaN and None. */
export type MetricsExports = {
  memory: WebAssembly.Memory;
  bunnltk_wasm_set_score(op: number, ap: number, an: number, bp: number, bn: number, label: number, alpha: number, out: number): number;
  bunnltk_wasm_interval_score(a: number, b: number): number;
  bunnltk_wasm_binary_score(equal: number): number;
  bunnltk_wasm_accuracy_score(ap: number, an: number, bp: number, bn: number, out: number): number;
  bunnltk_wasm_log_likelihood_score(p: number, n: number, out: number): number;
  bunnltk_wasm_spearman_score(ap: number, ar: number, an: number, bp: number, br: number, bn: number, out: number): number;
  bunnltk_wasm_ranks_from_scores(p: number, n: number, gap: number, out: number): number;
  bunnltk_wasm_segmentation_score(ap: number, bp: number, n: number, abp: number, abn: number, bbp: number, bbn: number, flags: number, k: number, out: number): number;
  bunnltk_wasm_confusion_build(ap: number, bp: number, n: number, count: number, mode: number, keys: number, offsets: number, keysLen: number, labels: number, cells: number, meta: number): number;
  bunnltk_wasm_confusion_score(op: number, cells: number, n: number, label: number, alpha: number, out: number): number;
  bunnltk_wasm_translation_score(op: number, p: number, n: number, min: number, max: number, beta: number, whitespace: number, out: number): number;
  bunnltk_wasm_nist_length_score(reference: number, hypothesis: number, out: number): number;
};

export class MetricZeroDivisionError extends RangeError {
  constructor() { super("division by zero"); this.name = "ZeroDivisionError"; }
}

export function internLabels<T>(a: Iterable<T>, b: Iterable<T>, extra: Iterable<T> = []): { a: Uint32Array; b: Uint32Array; labels: T[]; ids: Map<T, number> } {
  const ids = new Map<T, number>();
  const encode = (values: Iterable<T>): Uint32Array => Uint32Array.from(values, (label) => {
    let id = ids.get(label);
    if (id === undefined) {
      id = ids.size;
      if (id >= 0xffffffff) throw new RangeError("too many distinct labels");
      ids.set(label, id);
    }
    return id;
  });
  const left = encode(a), right = encode(b);
  encode(extra);
  return { a: left, b: right, labels: [...ids.keys()], ids };
}

type Block = { ptr: number; bytes: number };
export class MetricsWasm {
  private readonly exports: MetricsExports;
  private readonly allocate: (key: string, bytes: number) => Block;
  constructor(exports: MetricsExports, allocate: (key: string, bytes: number) => Block) {
    this.exports = exports;
    this.allocate = allocate;
  }

  private block(key: string, bytes: number): number {
    // allocate also checks the owning runtime's disposed state.
    const ptr = this.allocate(`evaluation_${key}`, bytes).ptr;
    if (typeof this.exports.bunnltk_wasm_set_score !== "function") {
      throw new Error("incompatible WASM artifact: rebuild with bun run build:wasm");
    }
    return ptr;
  }
  private u32(key: string, values: Uint32Array): number {
    const ptr = this.block(key, values.byteLength);
    new Uint32Array(this.exports.memory.buffer, ptr, values.length).set(values);
    return ptr;
  }
  private f64(key: string, values: Float64Array): number {
    const ptr = this.block(key, values.byteLength);
    new Float64Array(this.exports.memory.buffer, ptr, values.length).set(values);
    return ptr;
  }
  private check(status: number): void {
    if (status === 2) throw new MetricZeroDivisionError();
    if (status === 3) throw new RangeError("invalid metric input");
    if (status === 4) throw new RangeError("unknown metric label");
    if (status === 5) { const error = new RangeError("numeric overflow"); error.name = "OverflowError"; throw error; }
    if (status !== 0) throw new Error(`unknown metrics ABI status ${status}`);
  }
  private scalar(call: (out: number) => number): number | null {
    const out = this.block("scalar", 8);
    const status = call(out);
    if (status === 1) return null;
    this.check(status);
    return new Float64Array(this.exports.memory.buffer, out, 1)[0]!;
  }
  setScore(op: number, a: Uint32Array, b: Uint32Array, label = 0, alpha = 0.5): number | null {
    const ap = this.u32("set_a", a), bp = this.u32("set_b", b);
    return this.scalar((out) => this.exports.bunnltk_wasm_set_score(op, ap, a.length, bp, b.length, label, alpha, out));
  }
  binary(equal: boolean): number {
    this.block("scalar", 8);
    return this.exports.bunnltk_wasm_binary_score(Number(equal));
  }
  interval(a: number, b: number): number {
    this.block("scalar", 8);
    return this.exports.bunnltk_wasm_interval_score(a, b);
  }
  accuracy(a: Uint32Array, b: Uint32Array): number {
    const ap = this.u32("accuracy_a", a), bp = this.u32("accuracy_b", b);
    return this.scalar((out) => this.exports.bunnltk_wasm_accuracy_score(ap, a.length, bp, b.length, out))!;
  }
  logLikelihood(probabilities: Float64Array): number {
    const p = this.f64("probabilities", probabilities);
    return this.scalar((out) => this.exports.bunnltk_wasm_log_likelihood_score(p, probabilities.length, out))!;
  }
  spearman(a: Uint32Array, ar: Float64Array, b: Uint32Array, br: Float64Array): number {
    const ap = this.u32("rank_a", a), arp = this.f64("rank_ar", ar), bp = this.u32("rank_b", b), brp = this.f64("rank_br", br);
    return this.scalar((out) => this.exports.bunnltk_wasm_spearman_score(ap, arp, a.length, bp, brp, b.length, out))!;
  }
  ranks(scores: Float64Array, gap: number): Uint32Array {
    const p = this.f64("scores", scores), out = this.block("ranks", scores.length * 4);
    this.check(this.exports.bunnltk_wasm_ranks_from_scores(p, scores.length, gap, out));
    return Uint32Array.from(new Uint32Array(this.exports.memory.buffer, out, scores.length));
  }
  segmentation(a: Uint32Array, b: Uint32Array, ab: Uint32Array, bb: Uint32Array, flags: number, k: number): number {
    if (a.length !== b.length) throw new RangeError("Segmentations have unequal length");
    const ap = this.u32("seg_a", a), bp = this.u32("seg_b", b), abp = this.u32("seg_ab", ab), bbp = this.u32("seg_bb", bb);
    return this.scalar((out) => this.exports.bunnltk_wasm_segmentation_score(ap, bp, a.length, abp, ab.length, bbp, bb.length, flags, k, out))!;
  }
  confusion(a: Uint32Array, b: Uint32Array, labels: readonly unknown[]): { order: Uint32Array; cells: Uint32Array; correct: number; total: number; accuracy: number } {
    if (a.length !== b.length) throw new RangeError("Lists must have the same length.");
    let mode = 0;
    let keys: Uint32Array | Float64Array = new Uint32Array();
    let offsets = new Uint32Array();
    if (labels.every((v) => typeof v === "string")) {
      mode = 2;
      const flat: number[] = [], starts = [0];
      for (const label of labels as readonly string[]) {
        for (const c of label) flat.push(c.codePointAt(0)!);
        starts.push(flat.length);
      }
      keys = Uint32Array.from(flat); offsets = Uint32Array.from(starts);
    } else if (labels.every((v) => typeof v === "number")) {
      mode = 1; keys = Float64Array.from(labels as readonly number[]);
    }
    const ap = this.u32("cm_a", a), bp = this.u32("cm_b", b);
    const kp = keys instanceof Float64Array ? this.f64("cm_keys", keys) : this.u32("cm_keys", keys);
    const op = this.u32("cm_offsets", offsets);
    const order = this.block("cm_order", labels.length * 4), cells = this.block("cm_cells", a.length * 12), meta = this.block("cm_meta", 40);
    this.check(this.exports.bunnltk_wasm_confusion_build(ap, bp, a.length, labels.length, mode, kp, op, keys.length, order, cells, meta));
    const values = new Float64Array(this.exports.memory.buffer, meta, 5);
    return { order: Uint32Array.from(new Uint32Array(this.exports.memory.buffer, order, labels.length)),
      cells: Uint32Array.from(new Uint32Array(this.exports.memory.buffer, cells, values[1]! * 3)), correct: values[2]!, total: values[3]!, accuracy: values[4]! };
  }
  confusionScore(op: number, cells: Uint32Array, label: number, alpha = 0.5): number {
    const p = this.u32("cm_probe", cells);
    return this.scalar((out) => this.exports.bunnltk_wasm_confusion_score(op, p, cells.length / 3, label, alpha, out))!;
  }
  translation(op: number, packet: Uint32Array, min: number, max: number, beta: number, whitespace: boolean): number {
    const p = this.u32("translation", packet);
    return this.scalar((out) => this.exports.bunnltk_wasm_translation_score(op, p, packet.length, min, max, beta, Number(whitespace), out))!;
  }
  nistLengthPenalty(reference: number, hypothesis: number): number {
    return this.scalar((out) => this.exports.bunnltk_wasm_nist_length_score(reference, hypothesis, out))!;
  }
}
