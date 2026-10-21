import { internLabels } from "./metrics_wasm.ts";
import { syncWasm } from "./sync_wasm.ts";

/** NLTK accuracy: unequal lengths and an empty test are errors. */
export function accuracy<T>(reference: ReadonlyArray<T>, test: ReadonlyArray<T>): number {
  if (reference.length !== test.length) throw new RangeError("Lists must have the same length.");
  // NaN is unequal even to itself in positional equality (unlike Set membership).
  const label = (value: T): T | symbol => typeof value === "number" && Number.isNaN(value) ? Symbol() : value;
  const input = internLabels(reference.map(label), test.map(label));
  return syncWasm().evaluationMetrics().accuracy(input.a, input.b);
}

/** Sparse Rust counts, preserving JS label identities. Formatting is not implemented. */
export class ConfusionMatrix<T = string> {
  readonly labels: T[];
  readonly correct: number;
  readonly total: number;
  /** Convenience score with the existing JS empty convention (zero). */
  readonly accuracy: number;
  private readonly ids: Map<T, number>;
  private readonly cells: Uint32Array;
  private readonly lookup = new Map<number, Map<number, number>>();

  constructor(reference: ReadonlyArray<T>, test: ReadonlyArray<T>) {
    if (reference.length !== test.length) throw new RangeError("Lists must have the same length.");
    const input = internLabels(reference, test);
    const result = syncWasm().evaluationMetrics().confusion(input.a, input.b, input.labels);
    this.ids = input.ids; this.cells = result.cells;
    this.labels = Array.from(result.order, (id) => input.labels[id]!);
    this.correct = result.correct; this.total = result.total; this.accuracy = result.accuracy;
    for (let i = 0; i < this.cells.length; i += 3) {
      const row = this.lookup.get(this.cells[i]!) ?? new Map<number, number>();
      row.set(this.cells[i + 1]!, this.cells[i + 2]!); this.lookup.set(this.cells[i]!, row);
    }
  }
  private id(label: T): number {
    const id = this.ids.get(label);
    if (id === undefined) throw new RangeError("unknown confusion-matrix label");
    return id;
  }
  get(reference: T, test: T): number {
    const a = this.id(reference), b = this.id(test);
    return this.lookup.get(a)?.get(b) ?? 0;
  }
  precision(label: T): number { return syncWasm().evaluationMetrics().confusionScore(0, this.cells, this.id(label)); }
  recall(label: T): number { return syncWasm().evaluationMetrics().confusionScore(1, this.cells, this.id(label)); }
  fMeasure(label: T, alpha = 0.5): number {
    const result = syncWasm().evaluationMetrics().confusionScore(2, this.cells, this.id(label), typeof alpha === "number" ? alpha : NaN);
    if (typeof alpha !== "number" && result !== 0) throw new TypeError("alpha must be numeric");
    return result;
  }
  f_measure(label: T, alpha = 0.5): number { return this.fMeasure(label, alpha); }
  /** Legacy dense output; capped explicitly rather than risking quadratic OOM. */
  toMatrix(): number[][] {
    if (this.labels.length > 2048) throw new RangeError("dense confusion matrix exceeds 2048 labels; use ConfusionMatrix.get instead");
    return this.labels.map((a) => this.labels.map((b) => this.get(a, b)));
  }
}
