import { expect, test } from "bun:test";
import { accuracy, ConfusionMatrix, confusionMatrix, binaryDistance, intervalDistance, jaccardDistance, masiDistance,
  precision, recall, fMeasure, presence, fractionalPresence, metricsLogLikelihood, windowdiff, pk,
  spearmanCorrelation, ranksFromScores, ranksFromSequence, sorensenDiceSimilarity, WasmNltk, corpusChrF, corpusNist, nistLengthPenalty } from "../index.ts";
import type { ProbabilityMap, Ranking, Segmentation } from "../index.ts";
import { readFileSync } from "node:fs";

type Case = { op: string; args: unknown[] };
type OracleResult = { value?: unknown; error?: string };
const decode = (value: unknown): number => value === "@nan" ? NaN : value === "@inf" ? Infinity : value === "@-inf" ? -Infinity : value as number;

function oracle(cases: Case[]): OracleResult[] {
  const proc = Bun.spawnSync(["python3", "test/metrics_oracle.py"], {
    cwd: new URL("..", import.meta.url).pathname, stdin: Buffer.from(JSON.stringify(cases)), stdout: "pipe", stderr: "pipe",
  });
  if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
  return JSON.parse(new TextDecoder().decode(proc.stdout)) as OracleResult[];
}
function run({ op, args }: Case): unknown {
  const [a, b, c, d, e] = args;
  const sa = () => new Set(a as (string | number)[]), sb = () => new Set(b as (string | number)[]);
  switch (op) {
    case "jaccard": return jaccardDistance(sa(), sb());
    case "masi": return masiDistance(sa(), sb());
    case "precision": return precision(sa(), sb());
    case "recall": return recall(sa(), sb());
    case "fmeasure": return fMeasure(sa(), sb(), decode(c));
    case "presence": return presence(c)(sa(), sb());
    case "fractional": return fractionalPresence(c)(sa(), sb());
    case "binary": return binaryDistance(a, b);
    case "interval": return intervalDistance(decode(a), decode(b));
    case "windowdiff": return windowdiff(a as Segmentation, b as Segmentation, c as number, d as string | number | boolean, e as boolean);
    case "pk": return pk(a as Segmentation, b as Segmentation, c as number | null, d as string | number | boolean);
    case "spearman": return spearmanCorrelation(a as Ranking, b as Ranking);
    case "ranks": return ranksFromScores(a as [unknown, number][], decode(b));
    case "sequence": return ranksFromSequence(a as unknown[]);
    case "accuracy": return accuracy(a as unknown[], b as unknown[]);
    case "confusion": {
      const cm = new ConfusionMatrix(a as unknown[], b as unknown[]);
      return { labels: cm.labels, matrix: cm.toMatrix(), precision: cm.labels.map((v) => cm.precision(v)),
        recall: cm.labels.map((v) => cm.recall(v)), fmeasure: cm.labels.map((v) => cm.fMeasure(v)), correct: cm.correct, total: cm.total };
    }
    case "loglik": return metricsLogLikelihood(a as string[], (b as ProbabilityMap[]).map((dist) => Object.fromEntries(Object.entries(dist).map(([k, v]) => [k, decode(v)]))));
    case "chrf": return corpusChrF(a as Array<string | string[]>, b as Array<string | string[]>, { minLen: c as number, maxLen: d as number, beta: decode(e), ignoreWhitespace: args[5] as boolean });
    case "nist": return corpusNist(a as string[][][], b as string[][], { n: c as number });
    case "nist_penalty": return nistLengthPenalty(decode(a), decode(b));
    default: throw new Error(`unknown test operation ${op}`);
  }
}
function compare(actual: unknown, expected: unknown): void {
  if (expected === "@nan") { expect(actual).toBeNaN(); return; }
  if (expected === "@inf") { expect(actual).toBe(Infinity); return; }
  if (expected === "@-inf") { expect(actual).toBe(-Infinity); return; }
  if (expected === "@-zero") { expect(Object.is(actual, -0)).toBe(true); return; }
  if (typeof expected === "number" && Number.isFinite(expected)) {
    expect(typeof actual).toBe("number");
    const tolerance = Math.max(1, Math.abs(expected)) * 2e-12;
    expect(Math.abs((actual as number) - expected)).toBeLessThanOrEqual(tolerance);
  } else if (Array.isArray(expected)) {
    expect(Array.isArray(actual)).toBe(true); expect((actual as unknown[]).length).toBe(expected.length);
    expected.forEach((v, i) => compare((actual as unknown[])[i], v));
  } else if (expected !== null && typeof expected === "object") {
    expect(Object.keys(actual as object)).toEqual(Object.keys(expected));
    for (const [k, v] of Object.entries(expected)) compare((actual as Record<string, unknown>)[k], v);
  } else { expect(actual).toEqual(expected); }
}
function differential(cases: Case[]): void {
  const expected = oracle(cases);
  cases.forEach((row, i) => {
    const result = expected[i]!;
    if (result.error) {
      let error: unknown;
      try { run(row); } catch (caught) { error = caught; }
      expect(error, JSON.stringify(row)).toBeInstanceOf(result.error === "TypeError" ? TypeError : RangeError);
      if (result.error === "ZeroDivisionError" || result.error === "OverflowError") expect((error as Error).name).toBe(result.error);
    } else {
      try { compare(run(row), result.value); }
      catch (error) { throw new Error(`${JSON.stringify(row)}: ${String(error)}`); }
    }
  });
}
let seed = 7103103;
function random(n: number): number { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; }
const sample = <T>(values: T[], n: number): T[] => Array.from({ length: n }, () => values[random(values.length)]!);

test("Rust sets: 896 pinned NLTK behavioral cases including empty, invalid alpha, and None", () => {
  const cases: Case[] = [];
  for (let i = 0; i < 128; i++) {
    const a = sample([0, 1, 2, 3, "1", "\0", "__proto__"], random(12));
    const b = sample([0, 1, 2, 3, "1", "\0", "__proto__"], random(12));
    for (const op of ["jaccard", "masi", "precision", "recall", "fmeasure", "presence", "fractional"]) {
      cases.push({ op, args: [a, b, op === "fmeasure" ? [-2, -1, 0, 0.25, 0.5, 1, 2, "@nan", "@inf"][i % 9] : 1] });
    }
  }
  differential(cases);
});
test("Rust segmentation: 262 pinned NLTK cases including Unicode, multi-character/empty boundaries and invalid windows", () => {
  const cases: Case[] = [];
  for (let i = 0; i < 128; i++) {
    const n = random(40);
    let a: Segmentation, b: Segmentation, boundary: string | number | boolean;
    if (i % 3 === 0) {
      a = sample([true, false, 0, 1, 2], n); b = sample([true, false, 0, 1, 2], n); boundary = true;
    } else {
      a = sample(["0", "1", "😀"], n).join(""); b = sample(["0", "1", "😀"], n).join(""); boundary = ["1", "😀", "11", ""][i % 4]!;
    }
    const k = [0, 1, n, n + 1, n + 2, -1, 1.5][i % 7]!;
    cases.push({ op: "windowdiff", args: [a, b, k, boundary, i % 2 === 0] });
    cases.push({ op: "pk", args: [a, b, i % 5 === 0 ? null : k, boundary] });
  }
  cases.push({ op: "pk", args: ["00000", "11111", null, "1"] }, { op: "pk", args: ["", "", null, "1"] },
    { op: "pk", args: ["01", "0", 1, "1"] }, { op: "windowdiff", args: ["01", "0", 1, "1", false] },
    { op: "pk", args: ["01", "10", 1, 1] }, { op: "windowdiff", args: ["01", "10", 1, 1, false] });
  differential(cases);
});
test("Rust ranking: 258 pinned NLTK behavioral cases; duplicate keys and score ties", () => {
  const cases: Case[] = [];
  for (let i = 0; i < 128; i++) {
    const keys = [0, 1, "0", "1", "__proto__", "a", "b"];
    const pairs = (): [string | number, number][] => Array.from({ length: random(18) }, () => [keys[random(keys.length)]!, random(8) / 2]);
    const a = pairs(), b = pairs();
    cases.push({ op: "spearman", args: [a, b] }, { op: "ranks", args: [a, [0, 1e-15, 0.5, -1, "@nan"][i % 5]] });
  }
  cases.push({ op: "sequence", args: [["a", "a", 1, "1"]] }, { op: "spearman", args: [{ a: 1 }, { b: 1 }] });
  differential(cases);
});
test("Rust confusion/accuracy: 164 pinned NLTK behavioral cases, codepoint sorting and empty/unequal inputs", () => {
  const cases: Case[] = [];
  for (let i = 0; i < 80; i++) {
    const labels = i % 2 === 0 ? ["a", "Z", "😀", "\ue000", "é", "\0", "__proto__"] : [-10, 2, 1, 0, 100];
    const n = random(32), a = sample<string | number>(labels, n), b = sample<string | number>(labels, n);
    cases.push({ op: "confusion", args: [a, b] }, { op: "accuracy", args: [a, b] });
  }
  for (const op of ["confusion", "accuracy"]) cases.push({ op, args: [[], []] }, { op, args: [["a"], []] });
  differential(cases);
});
test("Rust likelihood/scalars: 16 pinned NLTK cases, zero/missing probability, NaN and domain errors", () => {
  const cases: Case[] = [
    { op: "loglik", args: [[], []] }, { op: "loglik", args: [["a"], []] },
    ...[0, 0.125, 1, 2, -1, "@nan", "@inf"].map((p) => ({ op: "loglik", args: [["a"], [{ a: p }]] })),
    { op: "loglik", args: [["missing"], [{}]] },
    ...[[1, 1], [1, 4], ["a", "b"]].map((args) => ({ op: "binary", args })),
    ...[[1, 10], ["@nan", 1], ["@inf", "@inf"]].map((args) => ({ op: "interval", args })),
  ];
  differential(cases);
});
test("JS identity marshaling does not stringify objects, symbols, numeric/string ranking keys", () => {
  const a = {}, b = {}, symbol = Symbol("a");
  expect(jaccardDistance(new Set([a, b, symbol, 1, "1"]), new Set([a, symbol, "1"]))).toBeCloseTo(0.4, 12);
  expect(precision(new Set([a]), new Set([b]))).toBe(0);
  expect(binaryDistance(a, b)).toBe(1); expect(binaryDistance(a, a)).toBe(0);
  expect(spearmanCorrelation([[1, 0], ["1", 1]], [[1, 1], ["1", 0]])).toBe(-1);
  expect(spearmanCorrelation(new Map([[a, 0], [b, 1]]), new Map([[a, 1], [b, 0]]))).toBe(-1);
  const cm = new ConfusionMatrix([a, b, symbol], [b, b, symbol]);
  expect(cm.labels).toEqual([a, b, symbol]); expect(cm.get(a, b)).toBe(1);
  expect(accuracy([a, b], [b, b])).toBe(0.5);
  expect(() => cm.get(a, {})).toThrow(RangeError); expect(() => cm.get({}, a)).toThrow(RangeError);
  expect(confusionMatrix([], [])).toEqual({ labels: [], matrix: [], accuracy: 0 });
});
test("Rust ChrF/NIST: 276 pinned NLTK behavioral cases with Unicode whitespace, collision tokens, arbitrary orders and invalid/empty inputs", () => {
  const cases: Case[] = [];
  for (let i = 0; i < 128; i++) {
    const chars = ["a", "b", "😀", "\u001c", "\u0085", "\ufeff", " ", "\u00a0", "\0"];
    const ns = 1 + random(3);
    const references = Array.from({ length: ns }, () => sample(chars, random(18)).join(""));
    const hypotheses = Array.from({ length: ns }, () => sample(chars, random(18)).join(""));
    cases.push({ op: "chrf", args: [references, hypotheses, i % 3, 1 + i % 8, [0, 1, 3, -3, "@nan", "@inf"][i % 6], i % 2 === 0] });
    const tokens = ["a", "b", "\u0001", "a\u0001b", "", "__proto__"];
    const refs = Array.from({ length: ns }, () => Array.from({ length: 1 + random(3) }, () => sample(tokens, random(14))));
    const hyps = Array.from({ length: ns }, () => sample(tokens, random(14)));
    cases.push({ op: "nist", args: [refs, hyps, i % 8] });
  }
  cases.push({ op: "chrf", args: [["abc def"], [["abc", "def"]], 0, 3, 3, true] },
    { op: "chrf", args: [[], [], 1, 6, 3, true] }, { op: "chrf", args: [["a"], ["b"], 4, 1, 3, true] },
    { op: "chrf", args: [["a"], ["a"], 1, 1, 1e300, true] }, { op: "chrf", args: [["a"], [], 1, 6, 3, true] },
    { op: "chrf", args: [["a"], ["a"], -1, 2, 3, true] },
    { op: "nist", args: [[], [], 5] }, { op: "nist", args: [[[]], [["a"]], 1] },
    { op: "nist", args: [[[[]]], [["a"]], 1] }, { op: "nist", args: [[[["a"]]], [], 1] },
    ...[[6, 6], [6, 4], [6, 0], [0, 1], [-1, 2], [1, -2], ["@nan", 2], [1, "@inf"], [1, "@-inf"], ["@inf", 1]].map((args) => ({ op: "nist_penalty", args })));
  differential(cases);
});
test("Rust score statuses keep None, NaN, division errors and invalid JS values distinct", () => {
  expect(accuracy([NaN], [NaN])).toBe(0);
  expect(binaryDistance(NaN, NaN)).toBe(1);
  expect(fMeasure(new Set([1]), new Set(), NaN)).toBeNull();
  expect(fMeasure(new Set([1]), new Set([1]), NaN)).toBeNaN();
  expect(() => fMeasure(new Set([1]), new Set([1, 2]), -1)).toThrow("division by zero");
  expect(() => precision([] as unknown as Set<unknown>, new Set())).toThrow(TypeError);
  expect(() => sorensenDiceSimilarity(new Set(), new Set())).toThrow("division by zero");
  const cm = new ConfusionMatrix(["a", "a"], ["a", "b"]);
  expect(() => cm.fMeasure("a", 2)).toThrow("division by zero");
});
test("NLTK invalid alpha short-circuits only for None and zero-overlap sets", () => {
  differential([
    { op: "fmeasure", args: [[1], [], "not a number"] },
    { op: "fmeasure", args: [[1], [2], "not a number"] },
    { op: "fmeasure", args: [[1], [1], "not a number"] },
  ]);
});
test("Sparse confusion scales without allocating a quadratic matrix", () => {
  const labels = Array.from({ length: 5000 }, (_, i) => i);
  const cm = new ConfusionMatrix(labels, labels);
  expect(cm.correct).toBe(5000); expect(cm.get(4999, 4999)).toBe(1); expect(cm.get(0, 4999)).toBe(0);
  expect(() => cm.toMatrix()).toThrow(RangeError);
});
test("Explicit WASM evaluation entrypoint behaves and rejects use after disposal", () => {
  const runtime = WasmNltk.initSync(readFileSync(new URL("../native/bun_nltk.wasm", import.meta.url)));
  const metrics = runtime.evaluationMetrics();
  expect(metrics.setScore(0, Uint32Array.of(1, 2), Uint32Array.of(2, 3))).toBeCloseTo(2 / 3, 12);
  expect(() => metrics.setScore(999, new Uint32Array(), new Uint32Array())).toThrow(RangeError);
  runtime.dispose(); expect(() => metrics.binary(true)).toThrow();
});
test("Raw evaluation ABI rejects misaligned, out-of-memory and malformed packet ranges", () => {
  const bytes = readFileSync(new URL("../native/bun_nltk.wasm", import.meta.url));
  const exports = new WebAssembly.Instance(new WebAssembly.Module(bytes), {}).exports as unknown as {
    memory: WebAssembly.Memory;
    bunnltk_wasm_alloc(size: number): number;
    bunnltk_wasm_free(ptr: number, size: number): void;
    bunnltk_wasm_set_score(op: number, ap: number, an: number, bp: number, bn: number, label: number, alpha: number, out: number): number;
    bunnltk_wasm_translation_score(op: number, p: number, n: number, min: number, max: number, beta: number, whitespace: number, out: number): number;
  };
  const out = exports.bunnltk_wasm_alloc(32);
  try {
    expect(exports.bunnltk_wasm_set_score(0, 1, 1, 0, 0, 0, 0.5, out)).toBe(3);
    expect(exports.bunnltk_wasm_set_score(0, exports.memory.buffer.byteLength, 1, 0, 0, 0, 0.5, out)).toBe(3);
    expect(exports.bunnltk_wasm_translation_score(0, 0, 0, 1, 6, 3, 1, out)).toBe(3);
    expect(exports.bunnltk_wasm_set_score(0, 0, 0, 0, 0, 0, 0.5, out)).toBe(2);
  } finally { exports.bunnltk_wasm_free(out, 32); }
});
test("Generated Node modules execute the migrated metrics, not only imports", () => {
  const result = Bun.spawnSync(["node", "--input-type=module", "-e", `
    import assert from "node:assert/strict";
    import { precision, pk, spearmanCorrelation } from "./dist/portable/distance_metrics.js";
    import { accuracy, ConfusionMatrix } from "./dist/portable/metrics.js";
    import { sentenceChrF, sentenceNist } from "./dist/portable/translation_metrics_extra.js";
    import { WasmNltk } from "./dist/portable/wasm.js";
    import * as root from "./dist/portable/index.node.js";
    const a = {}, b = {};
    assert.equal(precision(new Set([a]), new Set([b])), 0);
    assert.equal(precision(new Set([a]), new Set()), null);
    assert.equal(spearmanCorrelation([[1,0],["1",1]], [[1,1],["1",0]]), -1);
    assert.equal(pk("00000", "11111"), 1);
    assert.equal(accuracy([a,b],[b,b]), 0.5);
    const cm = new ConfusionMatrix(["Z","a"],["a","a"]);
    assert.deepEqual(cm.labels, ["Z","a"]); assert.equal(cm.precision("a"), 0.5);
    assert.equal(sentenceChrF("abc", "abc", {maxLen:3}), 1);
    assert.ok(sentenceNist([["a","b","c"]], ["a","b","c"], {n:3}) > 0);
    assert.equal(root.jaccardDistance(new Set([1,2]),new Set([1,2])), 0);
    assert.equal(root.sentenceChrF("abc","abc",{maxLen:3}), 1);
    const wasm = await WasmNltk.init();
    assert.equal(wasm.evaluationMetrics().binary(true), 0); wasm.dispose();
  `], { cwd: new URL("..", import.meta.url).pathname, stdout: "pipe", stderr: "pipe" });
  expect(new TextDecoder().decode(result.stderr)).toBe("");
  expect(result.exitCode).toBe(0);
});
