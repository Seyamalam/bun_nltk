import { internLabels } from "./metrics_wasm.js";
import { syncWasm } from "./sync_wasm.js";
export function accuracy(reference, test) {
  if (reference.length !== test.length)
    throw new RangeError("Lists must have the same length.");
  const label = (value) => typeof value === "number" && Number.isNaN(value) ? Symbol() : value;
  const input = internLabels(reference.map(label), test.map(label));
  return syncWasm().evaluationMetrics().accuracy(input.a, input.b);
}

export class ConfusionMatrix {
  labels;
  correct;
  total;
  accuracy;
  ids;
  cells;
  lookup = new Map;
  constructor(reference, test) {
    if (reference.length !== test.length)
      throw new RangeError("Lists must have the same length.");
    const input = internLabels(reference, test);
    const result = syncWasm().evaluationMetrics().confusion(input.a, input.b, input.labels);
    this.ids = input.ids;
    this.cells = result.cells;
    this.labels = Array.from(result.order, (id) => input.labels[id]);
    this.correct = result.correct;
    this.total = result.total;
    this.accuracy = result.accuracy;
    for (let i = 0;i < this.cells.length; i += 3) {
      const row = this.lookup.get(this.cells[i]) ?? new Map;
      row.set(this.cells[i + 1], this.cells[i + 2]);
      this.lookup.set(this.cells[i], row);
    }
  }
  id(label) {
    const id = this.ids.get(label);
    if (id === undefined)
      throw new RangeError("unknown confusion-matrix label");
    return id;
  }
  get(reference, test) {
    const a = this.id(reference), b = this.id(test);
    return this.lookup.get(a)?.get(b) ?? 0;
  }
  precision(label) {
    return syncWasm().evaluationMetrics().confusionScore(0, this.cells, this.id(label));
  }
  recall(label) {
    return syncWasm().evaluationMetrics().confusionScore(1, this.cells, this.id(label));
  }
  fMeasure(label, alpha = 0.5) {
    const result = syncWasm().evaluationMetrics().confusionScore(2, this.cells, this.id(label), typeof alpha === "number" ? alpha : NaN);
    if (typeof alpha !== "number" && result !== 0)
      throw new TypeError("alpha must be numeric");
    return result;
  }
  f_measure(label, alpha = 0.5) {
    return this.fMeasure(label, alpha);
  }
  toMatrix() {
    if (this.labels.length > 2048)
      throw new RangeError("dense confusion matrix exceeds 2048 labels; use ConfusionMatrix.get instead");
    return this.labels.map((a) => this.labels.map((b) => this.get(a, b)));
  }
}
