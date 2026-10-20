import { expect, test } from "bun:test";
import { WasmNltk } from "../src/wasm";
import { computeAsciiMetrics, countUniqueNgramsAscii } from "../src/native";

test("WASM aggregate metrics count distinct bigrams rather than distinct hashes", async () => {
  const words = Array.from({ length: 128 }, (_, i) => `word${i}`);
  const tokens = words.flatMap((a) => words.flatMap((b) => [a, b]));
  const expected = new Set(tokens.slice(1).map((b, i) => JSON.stringify([tokens[i], b]))).size;
  const wasm = await WasmNltk.init();
  try {
    expect(wasm.computeAsciiMetrics(tokens.join(" "), 2)).toEqual({ tokens: tokens.length, uniqueTokens: 128, ngrams: tokens.length - 1, uniqueNgrams: expected });
    expect(computeAsciiMetrics(tokens.join(" "), 2)).toEqual(wasm.computeAsciiMetrics(tokens.join(" "), 2));
    expect(countUniqueNgramsAscii(tokens.join(" "), 2)).toBe(expected);
    expect(wasm.computeAsciiMetrics("A a B", 0xffffffff)).toEqual({ tokens: 3, uniqueTokens: 2, ngrams: 0, uniqueNgrams: 0 });
  } finally { wasm.dispose(); }
});
