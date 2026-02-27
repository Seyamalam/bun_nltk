import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { computeAsciiMetrics, normalizeTokensAsciiNative, tokenizeAsciiNative, WasmNltk } from "../index";

function ensureWasmBuilt(): void {
  const wasmPath = resolve(import.meta.dir, "..", "native", "bun_nltk.wasm");
  if (existsSync(wasmPath)) return;

  const proc = Bun.spawnSync(["bun", "run", "build:wasm"], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "inherit",
    stderr: "inherit",
  });
  if (proc.exitCode !== 0) {
    throw new Error("failed to build wasm binary for tests");
  }
}

test("wasm wrapper metrics and token APIs match native", async () => {
  ensureWasmBuilt();
  const wasm = await WasmNltk.init();
  try {
    const text = "The quick brown fox and the dog. Running quickly is useful.";
    expect(wasm.computeAsciiMetrics(text, 2)).toEqual(computeAsciiMetrics(text, 2));
    expect(wasm.tokenizeAscii(text)).toEqual(tokenizeAsciiNative(text));
    expect(wasm.normalizeTokensAscii(text, true)).toEqual(normalizeTokensAsciiNative(text, true));
    expect(wasm.sentenceTokenizePunktAscii("Dr. Smith went home. He slept.")).toEqual([
      "Dr. Smith went home.",
      "He slept.",
    ]);
    expect(wasm.wordnetMorphyAscii("dogs", "n")).toBe("dog");

    const lmEval = wasm.evaluateLanguageModelIds({
      tokenIds: Uint32Array.from([1, 2, 3, 4, 1, 2, 5, 4]),
      sentenceOffsets: Uint32Array.from([0, 4, 8]),
      order: 3,
      model: "kneser_ney_interpolated",
      gamma: 0.1,
      discount: 0.75,
      vocabSize: 6,
      probeContextFlat: Uint32Array.from([1, 2]),
      probeContextLens: Uint32Array.from([2]),
      probeWordIds: Uint32Array.from([3]),
      perplexityTokenIds: Uint32Array.from([1, 2, 3, 4]),
      prefixTokenIds: Uint32Array.from([0, 0]),
    });
    expect(lmEval.scores.length).toBe(1);
    expect(lmEval.scores[0]!).toBeGreaterThan(0);
    expect(Number.isFinite(lmEval.perplexity)).toBeTrue();

    const chunkEval = wasm.chunkIobIds({
      tokenTagIds: Uint16Array.from([1, 2, 2, 3]),
      atomAllowedOffsets: Uint32Array.from([0, 1, 2]),
      atomAllowedLengths: Uint32Array.from([1, 1, 1]),
      atomAllowedFlat: Uint16Array.from([1, 2, 3]),
      atomMins: Uint8Array.from([0, 0, 1]),
      atomMaxs: Uint8Array.from([1, 255, 255]),
      ruleAtomOffsets: Uint32Array.from([0]),
      ruleAtomCounts: Uint32Array.from([3]),
      ruleLabelIds: Uint16Array.from([0]),
    });
    expect(chunkEval.labelIds[0]!).toBe(0);
    expect(chunkEval.labelIds[3]!).toBe(0);
  } finally {
    wasm.dispose();
  }
});
