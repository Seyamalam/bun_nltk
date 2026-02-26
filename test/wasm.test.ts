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
  } finally {
    wasm.dispose();
  }
});
