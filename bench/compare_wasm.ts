import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { countNgramsAscii, countTokensAscii } from "../index";

type PythonResult = {
  tokens: number;
  ngrams: number;
  total_seconds: number;
};

type WasmExports = {
  memory: WebAssembly.Memory;
  bunnltk_wasm_input_ptr: () => number;
  bunnltk_wasm_input_capacity: () => number;
  bunnltk_wasm_count_tokens_ascii: (inputLen: number) => bigint;
  bunnltk_wasm_count_ngrams_ascii: (inputLen: number, n: number) => bigint;
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

async function loadWasm(): Promise<WasmExports> {
  const wasmPath = resolve(import.meta.dir, "..", "native", "bun_nltk.wasm");
  const bytes = readFileSync(wasmPath);
  const { instance } = await WebAssembly.instantiate(bytes, {});
  return instance.exports as unknown as WasmExports;
}

function runNative(text: string, n: number, rounds: number) {
  const timings: number[] = [];
  let tokens = 0;
  let ngrams = 0;

  for (let i = 0; i < rounds; i += 1) {
    const started = performance.now();
    tokens = countTokensAscii(text);
    ngrams = countNgramsAscii(text, n);
    timings.push((performance.now() - started) / 1000);
  }

  return { tokens, ngrams, medianSeconds: median(timings) };
}

function runWasm(exports: WasmExports, input: Uint8Array, n: number, rounds: number) {
  const ptr = exports.bunnltk_wasm_input_ptr();
  const capacity = exports.bunnltk_wasm_input_capacity();
  if (input.length > capacity) {
    throw new Error(`dataset too large for wasm input buffer: ${input.length} > ${capacity}`);
  }

  const mem = new Uint8Array(exports.memory.buffer);
  mem.set(input, ptr);

  const timings: number[] = [];
  let tokens = 0;
  let ngrams = 0;

  for (let i = 0; i < rounds; i += 1) {
    const started = performance.now();
    tokens = Number(exports.bunnltk_wasm_count_tokens_ascii(input.length));
    ngrams = Number(exports.bunnltk_wasm_count_ngrams_ascii(input.length, n));
    timings.push((performance.now() - started) / 1000);
  }

  return { tokens, ngrams, medianSeconds: median(timings) };
}

function runPython(inputPath: string, n: number): PythonResult {
  const proc = Bun.spawnSync(["python", "bench/python_baseline.py", "--input", inputPath, "--n", String(n)], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });

  if (proc.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(proc.stderr));
  }

  return JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as PythonResult;
}

async function main() {
  const inputPath = process.argv[2] ?? "bench/datasets/synthetic.txt";
  const n = Number(process.argv[3] ?? "2");
  const rounds = Number(process.argv[4] ?? "5");

  const root = resolve(import.meta.dir, "..");
  const text = readFileSync(resolve(root, inputPath), "utf8");
  const inputBytes = new TextEncoder().encode(text);

  const native = runNative(text, n, rounds);
  const wasm = runWasm(await loadWasm(), inputBytes, n, rounds);
  const python = runPython(inputPath, n);

  if (native.tokens !== python.tokens || native.ngrams !== python.ngrams) {
    throw new Error("native/python parity mismatch");
  }
  if (wasm.tokens !== python.tokens || wasm.ngrams !== python.ngrams) {
    throw new Error("wasm/python parity mismatch");
  }

  console.log(
    JSON.stringify(
      {
        dataset: inputPath,
        n,
        rounds,
        parity: true,
        native_seconds_median: native.medianSeconds,
        wasm_seconds_median: wasm.medianSeconds,
        python_seconds: python.total_seconds,
        native_speedup_vs_python: python.total_seconds / native.medianSeconds,
        wasm_speedup_vs_python: python.total_seconds / wasm.medianSeconds,
      },
      null,
      2,
    ),
  );
}

await main();
