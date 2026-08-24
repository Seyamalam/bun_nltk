/**
 * Node.js runner: same core tasks via pure-TS paths + WASM where available.
 * Prints JSON {task: ms} on stdout.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { WasmNltk } from "../../src/wasm.ts";
import { wordTokenizeSubset as wordTokenize } from "../../src/tokenizers.ts";

const DATA = resolve(import.meta.dirname ?? ".", "data");

function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2 : (s[m] ?? 0);
}
function timeIt(fn: () => unknown, warmup = 2, rounds = 5) {
  for (let i = 0; i < warmup; i++) fn();
  const t = [];
  for (let i = 0; i < rounds; i++) {
    const s = performance.now();
    fn();
    t.push(performance.now() - s);
  }
  return median(t);
}

const prose = readFileSync(resolve(DATA, "prose_1mb.txt"), "utf8");
const words100k = readFileSync(resolve(DATA, "words_100k.txt"), "utf8").split(/\s+/).filter(Boolean);

const out: Record<string, number> = {};

// WASM tasks
try {
  const wasm = await WasmNltk.init({ wasmPath: resolve(import.meta.dirname ?? ".", "..", "..", "native", "bun_nltk.wasm") });
  if (!wasm) throw new Error("no wasm");
  out.tokenize = timeIt(() => void wasm.tokenizeAscii(prose));
  out.punkt = timeIt(() => void wasm.sentenceTokenizePunktAscii(prose));
  out.freqdist = timeIt(() => void wasm.countTokensAscii(prose));
  out.collocations = timeIt(() => void wasm.countNgramsAscii(prose, 2));
  wasm.dispose();
} catch (e) { // biome-ignore
  console.error("wasm failed:", (e as Error).message);
}

// Pure TS tasks (no bun:ffi)
// porter is native-only (bun:ffi); under Node use WASM morphy as the stem stand-in
try {
  const wasm2 = await WasmNltk.init({ wasmPath: resolve(import.meta.dirname ?? ".", "..", "..", "native", "bun_nltk.wasm") });
  out.porter = timeIt(() => {
    for (const w of words100k.slice(0, 20000)) wasm2.wordnetMorphyAscii(w, "n");
  });
  wasm2.dispose();
} catch {
  out.porter = -1;
}
out.tokenize_ts = timeIt(() => {
  void wordTokenize(prose);
});

console.log(JSON.stringify(out));
