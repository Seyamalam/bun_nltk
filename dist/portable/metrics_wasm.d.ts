/** Evaluation ABI marshaling only. Status is separate from numeric NaN and None. */
type MetricsExports = {
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
declare class MetricZeroDivisionError extends RangeError {
    constructor();
}
declare function internLabels<T>(a: Iterable<T>, b: Iterable<T>, extra?: Iterable<T>): {
    a: Uint32Array;
    b: Uint32Array;
    labels: T[];
    ids: Map<T, number>;
};
type Block = {
    ptr: number;
    bytes: number;
};
declare class MetricsWasm {
    private readonly exports;
    private readonly allocate;
    constructor(exports: MetricsExports, allocate: (key: string, bytes: number) => Block);
    private block;
    private u32;
    private f64;
    private check;
    private scalar;
    setScore(op: number, a: Uint32Array, b: Uint32Array, label?: number, alpha?: number): number | null;
    binary(equal: boolean): number;
    interval(a: number, b: number): number;
    accuracy(a: Uint32Array, b: Uint32Array): number;
    logLikelihood(probabilities: Float64Array): number;
    spearman(a: Uint32Array, ar: Float64Array, b: Uint32Array, br: Float64Array): number;
    ranks(scores: Float64Array, gap: number): Uint32Array;
    segmentation(a: Uint32Array, b: Uint32Array, ab: Uint32Array, bb: Uint32Array, flags: number, k: number): number;
    confusion(a: Uint32Array, b: Uint32Array, labels: readonly unknown[]): {
        order: Uint32Array;
        cells: Uint32Array;
        correct: number;
        total: number;
        accuracy: number;
    };
    confusionScore(op: number, cells: Uint32Array, label: number, alpha?: number): number;
    translation(op: number, packet: Uint32Array, min: number, max: number, beta: number, whitespace: boolean): number;
    nistLengthPenalty(reference: number, hypothesis: number): number;
}

export { MetricZeroDivisionError, MetricsWasm, internLabels };
export type { MetricsExports };
