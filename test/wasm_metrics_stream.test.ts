import { expect, test } from "bun:test";
import { WasmNltk } from "../src/wasm";

test("WASM exact stream matches batch across arbitrary byte boundaries and interleaved streams", async () => {
  const wasm = await WasmNltk.init();
  const encoder = new TextEncoder();
  const text = "Hello WORLD! 'a' a A12\0abc😀def last";
  const bytes = encoder.encode(text);
  try {
    for (let order = 1; order <= 8; order++) for (let size = 1; size <= bytes.length; size++) {
      const stream = wasm.createAsciiMetricsStream(order);
      try {
        for (let start = 0; start < bytes.length; start += size) {
          stream.update(bytes.subarray(start, start + size));
          wasm.countTokensAscii("staging overwrites cannot corrupt stream state");
        }
        expect(stream.finish()).toEqual(wasm.computeAsciiMetrics(text, order));
        expect(stream.finish()).toEqual(wasm.computeAsciiMetrics(text, order));
        expect(() => stream.update(bytes)).toThrow("finished");
      } finally { stream.dispose(); }
    }
    const left = wasm.createAsciiMetricsStream(2), right = wasm.createAsciiMetricsStream(2);
    left.update(encoder.encode("hell")); right.update(encoder.encode("a b")); left.update(encoder.encode("o world"));
    expect(left.finish()).toEqual(wasm.computeAsciiMetrics("hello world", 2));
    expect(right.finish()).toEqual(wasm.computeAsciiMetrics("a b", 2));
    left.dispose(); right.dispose();
  } finally { wasm.dispose(); }
});

test("WASM streaming corpus exceeds batch limit with bounded vocabulary memory", async () => {
  const wasm = await WasmNltk.init();
  const stream = wasm.createAsciiMetricsStream(2);
  const chunk = new TextEncoder().encode("a b ".repeat(256 * 1024));
  try {
    for (let i = 0; i < 129; i++) stream.update(chunk);
    expect(stream.finish()).toEqual({ tokens: 129 * 524288, uniqueTokens: 2, ngrams: 129 * 524288 - 1, uniqueNgrams: 2 });
    expect(wasm.memoryBytes).toBeLessThan(8 * 1024 * 1024);
  } finally { stream.dispose(); wasm.dispose(); }
}, 30_000);

test("WASM exact streaming does not merge colliding bigrams", async () => {
  const words = Array.from({ length: 128 }, (_, i) => `word${i}`);
  const tokens = words.flatMap((a) => words.flatMap((b) => [a, b]));
  const expected = new Set(tokens.slice(1).map((b, i) => JSON.stringify([tokens[i], b]))).size;
  const bytes = new TextEncoder().encode(tokens.join(" "));
  const wasm = await WasmNltk.init(), stream = wasm.createAsciiMetricsStream(2);
  try {
    for (let i = 0; i < bytes.length; i += 997) stream.update(bytes.subarray(i, i + 997));
    expect(stream.finish()).toEqual({ tokens: tokens.length, uniqueTokens: 128, ngrams: tokens.length - 1, uniqueNgrams: expected });
  } finally { stream.dispose(); wasm.dispose(); }
});

test("WASM stream validates limits and never reports partial counts as success", async () => {
  const wasm = await WasmNltk.init({ maxInputBytes: 32 });
  try {
    for (const n of [0, 65, NaN]) expect(() => wasm.createAsciiMetricsStream(n)).toThrow(RangeError);
    for (const options of [{ maxTokenBytes: 0 }, { maxUniqueTokens: -1 }, { maxUniqueNgrams: 0 }]) expect(() => wasm.createAsciiMetricsStream(2, options)).toThrow(RangeError);
    for (const [options, text] of [[{ maxTokenBytes: 2 }, "long"], [{ maxUniqueTokens: 1 }, "a b "], [{ maxUniqueNgrams: 1 }, "a b c "]] as const) {
      const stream = wasm.createAsciiMetricsStream(2, options);
      expect(() => stream.update(new TextEncoder().encode(text))).toThrow();
      expect(() => stream.finish()).toThrow("failed");
      stream.dispose(); stream.dispose();
      expect(() => stream.finish()).toThrow("disposed");
    }
    const stream = wasm.createAsciiMetricsStream(2);
    expect(() => stream.update(new Uint8Array(33))).toThrow(RangeError);
    expect(() => stream.finish()).toThrow("failed");
    stream.dispose();
    const empty = wasm.createAsciiMetricsStream(2);
    expect(empty.finish()).toEqual({ tokens: 0, uniqueTokens: 0, ngrams: 0, uniqueNgrams: 0 });
    empty.dispose();
    const other = wasm.createAsciiMetricsStream(2);
    wasm.dispose();
    expect(() => other.finish()).toThrow("disposed");
  } finally { wasm.dispose(); }
});
