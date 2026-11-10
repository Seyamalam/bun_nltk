import type { Alignment } from "./translate_api";

/** `nltk.translate.metrics.alignment_error_rate` — AER of `hypothesis` vs gold `reference`. */
export function alignment_error_rate(
  reference: Alignment,
  hypothesis: Alignment,
  possible?: Alignment,
): number {
  const pos = possible ?? reference;
  if (possible !== undefined && !reference.issubset(pos)) {
    throw new Error("reference must be a subset of possible");
  }
  return 1.0 - (hypothesis.intersection(reference).size + hypothesis.intersection(pos).size) / (hypothesis.size + reference.size);
}
