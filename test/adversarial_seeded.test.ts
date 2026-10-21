import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { WasmNltk } from "../src/wasm.ts";
import { ParsingRuntime, Tree } from "../src/rust_parse.ts";

const wasmBytes = new Uint8Array(readFileSync(new URL("../native/bun_nltk.wasm", import.meta.url)));
const seeds = [0, 1, 1337, 0xffffffff];
function generator(seed: number): () => number {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
}

test("seeded Unicode distance/span/stream properties survive interleaved errors", () => {
  const wasm = WasmNltk.initSync(wasmBytes);
  const atoms = ["a", "é", "e\u0301", "😀", "中", "\u0000", "\u200d", "\u{10ffff}", " ", "\t", "'", "!"];
  try {
    for (const seed of seeds) {
      const random = generator(seed);
      const text = () => Array.from({ length: random() % 24 }, () => atoms[random() % atoms.length]!).join("");
      for (let trial = 0; trial < 48; trial++) {
        const a = text(), b = text(), c = text(), label = `seed=${seed} trial=${trial}`;
        const scalarA = [...a], scalarB = [...b];
        const ab = wasm.editDistance(a, b);
        expect(ab, label).toBe(wasm.editDistance(b, a));
        expect(wasm.editDistance(a, a), label).toBe(0);
        expect(ab, label).toBeGreaterThanOrEqual(Math.abs(scalarA.length - scalarB.length));
        expect(ab, label).toBeLessThanOrEqual(Math.max(scalarA.length, scalarB.length));
        expect(ab, label).toBeLessThanOrEqual(wasm.editDistance(a, c) + wasm.editDistance(c, b));
        const spans = wasm.tokenizerSpans(a, "wordpunct"), tokens = wasm.tokenize(a, "wordpunct");
        expect(spans.map(([start, end]) => scalarA.slice(start, end).join("")), label).toEqual(tokens);
        for (let i = 0; i < spans.length; i++) {
          expect(spans[i]![0], label).toBeGreaterThanOrEqual(i === 0 ? 0 : spans[i - 1]![1]);
          expect(spans[i]![1], label).toBeLessThanOrEqual(scalarA.length);
        }
        const bytes = new TextEncoder().encode(a), order = 1 + random() % 4;
        const stream = wasm.createAsciiMetricsStream(order);
        try {
          for (let offset = 0; offset < bytes.length;) {
            const end = Math.min(bytes.length, offset + 1 + random() % 7);
            stream.update(bytes.subarray(offset, end)); offset = end;
          }
          expect(stream.finish(), label).toEqual(wasm.computeAsciiMetrics(a, order));
        } finally { stream.dispose(); }
        expect(() => wasm.tokenize(`${a}\ud800`), label).toThrow();
        expect(wasm.tokenize(a, "wordpunct"), label).toEqual(tokens);
      }
    }
  } finally { wasm.dispose(); }
});

test("seeded malformed model loads preserve exact floating-point roundtrips and recovery", () => {
  const wasm = WasmNltk.initSync(wasmBytes);
  const model = { version: 2, model: "categorical", smoothing: 0.7, totalDocs: 2, labels: ["A", "B"], labelDocCounts: [1, 1], features: [["a", [[[1, 1]], []]]] };
  const load = (value: unknown) => JSON.parse(wasm.textNaiveBayes(JSON.stringify({ action: "loadCategorical", model: value })));
  try {
    expect(load(model)).toEqual(model);
    const invalid = [
      null, [], {}, { ...model, version: 0 }, { ...model, smoothing: 0 },
      { ...model, labels: ["A", "A"] }, { ...model, labelDocCounts: [1] },
      { ...model, totalDocs: -1 }, { ...model, features: [["a", [[[1, 2]], []]]] },
      { ...model, features: [["a", [[[1, 1], [1, 1]], []]]] },
    ];
    for (const seed of seeds) {
      const random = generator(seed);
      for (let trial = 0; trial < 32; trial++) {
        expect(load(invalid[random() % invalid.length]).error, `seed=${seed} trial=${trial}`).toBeString();
        expect(load(model)).toEqual(model);
      }
    }
    for (const input of ["{", "null", "[]", '{"action":"loadTree","model":{}}', '{"action":"loadSgd","model":{"weights":[1e309]}}']) {
      expect(JSON.parse(wasm.textClassifiers(input)).error).toBeString();
    }
    expect(load(model)).toEqual(model);
  } finally { wasm.dispose(); }
});

test("real WASM handles stay stale after free and fresh allocations; disposed instances are isolated", () => {
  const wasm = WasmNltk.initSync(wasmBytes), independent = WasmNltk.initSync(wasmBytes);
  const train = () => wasm.categoricalNaiveBayesTrain({ pairs: Uint32Array.of(0, 1), offsets: Uint32Array.of(0, 1), labels: Uint32Array.of(0), labelCount: 1, smoothing: 0.5 });
  const retired: number[] = [];
  try {
    for (let round = 0; round < 24; round++) {
      const handle = train();
      expect(retired).not.toContain(handle);
      for (const stale of retired) expect(() => wasm.categoricalNaiveBayesPredict(stale, Uint32Array.of(0, 1), 1)).toThrow();
      expect(wasm.categoricalNaiveBayesPredict(handle, Uint32Array.of(0, 1), 1)[0]).toBe(0); // log2(1)
      wasm.categoricalNaiveBayesFree(handle); wasm.categoricalNaiveBayesFree(handle);
      retired.push(handle);
    }
    const stream = wasm.createAsciiMetricsStream(2);
    stream.update(new TextEncoder().encode("a b")); stream.dispose(); stream.dispose();
    expect(() => stream.update(new Uint8Array())).toThrow("disposed");
    const live = wasm.createAsciiMetricsStream(2);
    wasm.dispose(); wasm.dispose();
    expect(() => live.finish()).toThrow("disposed");
    expect(() => wasm.tokenize("a")).toThrow("disposed");
    expect(independent.tokenize("can't")).toEqual(["ca", "n't"]);
  } finally { wasm.dispose(); independent.dispose(); }
});

test("bounded staging rejects byte-oversized Unicode inputs without poisoning streams", () => {
  const wasm = WasmNltk.initSync(wasmBytes, 128);
  try {
    for (const text of ["x".repeat(129), "😀".repeat(33), "é".repeat(65)]) {
      expect(() => wasm.countTokensAscii(text)).toThrow(RangeError);
      expect(() => wasm.tokenize(text)).toThrow(RangeError);
      expect(wasm.tokenize("ok")).toEqual(["ok"]);
    }
    const limited = wasm.createAsciiMetricsStream(2, { maxTokenBytes: 8 });
    try {
      expect(() => limited.update(new TextEncoder().encode("x".repeat(9)))).toThrow();
      expect(() => limited.finish()).toThrow();
    } finally { limited.dispose(); }
    expect(() => wasm.editDistance("a".repeat(2001), "")).toThrow(RangeError);
    expect(wasm.editDistance("😀", "")).toBe(1);
  } finally { wasm.dispose(); }
});

test("deep string trees reject bounded nesting and malformed brackets then recover", async () => {
  const runtime = await ParsingRuntime.load({ wasmBytes });
  try {
    // Keep valid request trees below serde_json's separate recursion guard.
    for (const depth of [1, 8, 24]) {
      const text = "(N ".repeat(depth) + "😀" + ")".repeat(depth);
      const tree = Tree.fromstring(runtime, text);
      expect(tree.height()).toBe(depth + 1);
      expect(tree.leaves()).toEqual(["😀"]);
      expect(tree.pformat({ margin: 100000 })).toBe(text);
    }
    for (const text of ["(N ".repeat(256) + "x" + ")".repeat(256), "(N ".repeat(4096), ")", "(N x))", "(N"]) {
      expect(() => Tree.fromstring(runtime, text)).toThrow();
      expect(Tree.fromstring(runtime, "(N ok)").leaves()).toEqual(["ok"]);
    }
  } finally { runtime.dispose(); }
});
