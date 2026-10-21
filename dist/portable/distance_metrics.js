import { readFileSync } from "node:fs";
import { syncWasm } from "./sync_wasm.js";
import { internLabels } from "./metrics_wasm.js";
function setScore(op, a, b, alpha = 0.5, extra = []) {
  if (!(a instanceof Set) || !(b instanceof Set))
    throw new TypeError("reference and test should be sets");
  const input = internLabels(a, b, extra);
  const result = syncWasm().evaluationMetrics().setScore(op, input.a, input.b, extra.length ? input.ids.get(extra[0]) : 0, typeof alpha === "number" ? alpha : NaN);
  if (typeof alpha !== "number" && result !== null && result !== 0)
    throw new TypeError("alpha must be numeric");
  return result;
}
export function jaccardDistance(a, b) {
  return setScore(0, a, b);
}
export function masiDistance(a, b) {
  return setScore(1, a, b);
}
export function binaryDistance(a, b) {
  return syncWasm().evaluationMetrics().binary(a === b);
}
export function sorensenDiceSimilarity(a, b) {
  return setScore(2, a, b);
}
export function sorensenDiceDistance(a, b) {
  return setScore(3, a, b);
}
export function intervalDistance(a, b) {
  if (typeof a !== "number" || typeof b !== "number")
    throw new TypeError("non-numeric labels not supported with interval distance");
  return syncWasm().evaluationMetrics().interval(a, b);
}
export function presence(label) {
  return (x, y) => setScore(7, x, y, 0.5, [label]);
}
export function fractionalPresence(label) {
  return (x, y) => setScore(8, x, y, 0.5, [label]);
}
export function customDistance(file) {
  const data = new Map;
  for (const line of readFileSync(file, "utf8").split(`
`)) {
    const trimmed = line.trim();
    if (trimmed === "")
      continue;
    const [a, b, dist] = trimmed.split("\t");
    if (a === undefined || b === undefined || dist === undefined)
      throw new RangeError(`malformed custom distance line: ${trimmed}`);
    const value = Number.parseFloat(dist);
    const row = data.get(a) ?? new Map;
    row.set(b, value);
    data.set(a, row);
    const reverse = data.get(b) ?? new Map;
    reverse.set(a, value);
    data.set(b, reverse);
  }
  return (x, y) => {
    const value = data.get(x)?.get(y);
    if (value === undefined)
      throw new RangeError(`no custom distance defined for (${x}, ${y})`);
    return value;
  };
}
export function editDistanceAlign(s1, s2, substitutionCost = 1) {
  return syncWasm().editDistanceAlign(s1, s2, substitutionCost);
}
export function precision(reference, test) {
  return setScore(4, reference, test);
}
export function recall(reference, test) {
  return setScore(5, reference, test);
}
export function fMeasure(reference, test, alpha = 0.5) {
  return setScore(6, reference, test, alpha);
}
export function logLikelihood(reference, test) {
  if (reference.length !== test.length)
    throw new RangeError("Lists must have the same length.");
  const probabilities = Float64Array.from(reference, (label, i) => {
    const dist = test[i];
    if (dist === undefined)
      throw new TypeError(`distribution ${i} missing`);
    const value = Object.hasOwn(dist, label) ? dist[label] : 0;
    if (typeof value !== "number")
      throw new TypeError("probabilities must be numeric");
    return value;
  });
  return syncWasm().evaluationMetrics().logLikelihood(probabilities);
}
function segmentationInput(a, b, boundary) {
  if (typeof a !== "string" && !Array.isArray(a) || typeof b !== "string" && !Array.isArray(b))
    throw new TypeError("segmentations must be strings or arrays");
  const left = typeof a === "string" ? Array.from(a) : a;
  const right = typeof b === "string" ? Array.from(b) : b;
  if (left.length !== right.length)
    throw new RangeError("Segmentations have unequal length");
  if ((typeof a === "string" || typeof b === "string") && typeof boundary !== "string")
    throw new TypeError("string boundary must be a string");
  const ab = typeof a === "string" ? Array.from(boundary) : [boundary];
  const bb = typeof b === "string" ? Array.from(boundary) : [boundary];
  const normalize = (v) => typeof v === "boolean" ? Number(v) : v;
  const labels = internLabels(left.map(normalize), right.map(normalize), [...ab, ...bb].map(normalize));
  return {
    a: labels.a,
    b: labels.b,
    ab: Uint32Array.from(ab, (v) => labels.ids.get(normalize(v))),
    bb: Uint32Array.from(bb, (v) => labels.ids.get(normalize(v))),
    flags: Number(typeof a === "string") | Number(typeof b === "string") << 1
  };
}
export function windowdiff(seg1, seg2, k, boundary = "1", weighted = false) {
  const input = segmentationInput(seg1, seg2, boundary);
  if (!Number.isSafeInteger(k))
    throw new TypeError("window width must be an integer");
  if (k < 0)
    throw new RangeError("Window width k should not be negative");
  if (k > input.a.length)
    throw new RangeError("Window width k should be smaller or equal than segmentation lengths");
  return syncWasm().evaluationMetrics().segmentation(input.a, input.b, input.ab, input.bb, input.flags | (weighted ? 16 : 0), k);
}
export function pk(ref, hyp, k = null, boundary = "1") {
  const input = segmentationInput(ref, hyp, boundary);
  if (k !== null && !Number.isSafeInteger(k))
    throw new TypeError("window width must be an integer");
  if (k !== null && k < 0)
    throw new RangeError("Window width k should not be negative");
  return syncWasm().evaluationMetrics().segmentation(input.a, input.b, input.ab, input.bb, input.flags | 4 | (k === null ? 8 : 0), k ?? 0);
}
function rankingPairs(ranks) {
  if (ranks instanceof Map || Array.isArray(ranks))
    return [...ranks];
  if (typeof ranks === "object" && ranks !== null)
    return Object.entries(ranks);
  throw new TypeError("rankings must be records, maps, or key/rank pairs");
}
function rankValues(pairs) {
  return Float64Array.from(pairs, (pair) => {
    if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[1] !== "number")
      throw new TypeError("rank pairs must contain a key and numeric rank");
    return pair[1];
  });
}
export function spearmanCorrelation(ranks1, ranks2) {
  const a = rankingPairs(ranks1), b = rankingPairs(ranks2);
  const ar = rankValues(a), br = rankValues(b);
  const input = internLabels(a.map((v) => v[0]), b.map((v) => v[0]));
  return syncWasm().evaluationMetrics().spearman(input.a, ar, input.b, br);
}
export function ranksFromSequence(sequence) {
  return Array.from(sequence, (value, i) => [value, i]);
}
export function ranksFromScores(scores, rankGap = 0.000000000000001) {
  if (typeof rankGap !== "number")
    throw new TypeError("rankGap must be numeric");
  const pairs = [...scores];
  const ranks = syncWasm().evaluationMetrics().ranks(rankValues(pairs), rankGap);
  return pairs.map(([key], i) => [key, ranks[i]]);
}

export { ranksFromSequence as ranks_from_sequence, ranksFromScores as ranks_from_scores };
