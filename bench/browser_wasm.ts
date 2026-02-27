import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type BrowserThreshold = {
  max_median_seconds: number;
};

type Thresholds = {
  dataset: string;
  rounds: number;
  size_bytes_max: number;
  browsers: Record<string, BrowserThreshold>;
};

type BrowserResult = {
  median_seconds: number;
  tokens: number;
  ngrams: number;
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

async function runInBrowser(
  launcher: { launch: (options: { headless: boolean; timeout: number }) => Promise<{ newPage: () => Promise<{ evaluate: (fn: unknown, args: unknown) => Promise<BrowserResult> }>; close: () => Promise<void> }> },
  wasmBytes: Uint8Array,
  text: string,
  rounds: number,
  launchTimeoutMs: number,
): Promise<BrowserResult> {
  const browser = await launcher.launch({ headless: true, timeout: launchTimeoutMs });
  try {
    const page = await browser.newPage();
    return await page.evaluate(
      async ({ wasmArray, sourceText, evalRounds }) => {
        const wasm = Uint8Array.from(wasmArray as number[]);
        const { instance } = await WebAssembly.instantiate(wasm, {});
        const exp = instance.exports as {
          memory: WebAssembly.Memory;
          bunnltk_wasm_last_error_code: () => number;
          bunnltk_wasm_input_ptr: () => number;
          bunnltk_wasm_input_capacity: () => number;
          bunnltk_wasm_count_tokens_ascii: (len: number) => bigint | number;
          bunnltk_wasm_count_ngrams_ascii: (len: number, n: number) => bigint | number;
        };

        const encoder = new TextEncoder();
        const encoded = encoder.encode(sourceText as string);
        const inputPtr = Number(exp.bunnltk_wasm_input_ptr());
        const capacity = Number(exp.bunnltk_wasm_input_capacity());
        if (encoded.length > capacity) {
          throw new Error(`dataset exceeds wasm input capacity: ${encoded.length} > ${capacity}`);
        }

        const timings: number[] = [];
        let tokens = 0;
        let ngrams = 0;
        for (let i = 0; i < (evalRounds as number); i += 1) {
          const mem = new Uint8Array(exp.memory.buffer);
          mem.set(encoded, inputPtr);

          const started = performance.now();
          tokens = Number(exp.bunnltk_wasm_count_tokens_ascii(encoded.length));
          ngrams = Number(exp.bunnltk_wasm_count_ngrams_ascii(encoded.length, 2));
          const elapsed = (performance.now() - started) / 1000;
          const err = Number(exp.bunnltk_wasm_last_error_code());
          if (err !== 0) {
            throw new Error(`wasm runtime error code: ${err}`);
          }
          timings.push(elapsed);
        }

        return {
          median_seconds: (() => {
            const sorted = [...timings].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
          })(),
          tokens,
          ngrams,
        };
      },
      {
        wasmArray: Array.from(wasmBytes),
        sourceText: text,
        evalRounds: rounds,
      },
    );
  } finally {
    await browser.close();
  }
}

async function main() {
  const root = resolve(import.meta.dir, "..");
  const thresholdsPath = resolve(root, "bench", "browser_wasm_thresholds.json");
  const thresholds = JSON.parse(readFileSync(thresholdsPath, "utf8")) as Thresholds;

  const datasetPath = resolve(root, thresholds.dataset);
  const wasmPath = resolve(root, "native", "bun_nltk.wasm");
  const text = readFileSync(datasetPath, "utf8");
  const wasmBytes = new Uint8Array(readFileSync(wasmPath));

  const playwright = await import("playwright");
  const runners: Record<string, { launch: (options: { headless: boolean; timeout: number }) => Promise<{ newPage: () => Promise<{ evaluate: (fn: unknown, args: unknown) => Promise<BrowserResult> }>; close: () => Promise<void> }> }> = {
    chromium: playwright.chromium,
    firefox: playwright.firefox,
  };

  const results: Record<string, BrowserResult> = {};
  const skipped: Array<{ browser: string; reason: string }> = [];
  const strictMode = process.env.CI === "true";
  const launchTimeoutMs = strictMode ? 300000 : 20000;
  for (const [name, threshold] of Object.entries(thresholds.browsers)) {
    const launcher = runners[name];
    if (!launcher) {
      throw new Error(`unsupported browser in thresholds: ${name}`);
    }
    try {
      const result = await runInBrowser(launcher, wasmBytes, text, thresholds.rounds, launchTimeoutMs);
      if (result.median_seconds > threshold.max_median_seconds) {
        throw new Error(`${name} median exceeded threshold: ${result.median_seconds} > ${threshold.max_median_seconds}`);
      }
      results[name] = result;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (strictMode) {
        throw error;
      }
      skipped.push({ browser: name, reason });
    }
  }

  if (Object.keys(results).length === 0 && strictMode) {
    throw new Error("no browser benchmark completed successfully");
  }

  const output = {
    dataset: thresholds.dataset,
    rounds: thresholds.rounds,
    wasm_size_bytes: wasmBytes.length,
    browsers: results,
    skipped_browsers: skipped,
    strict_mode: strictMode,
  };

  const artifactsDir = resolve(root, "artifacts");
  mkdirSync(artifactsDir, { recursive: true });
  writeFileSync(resolve(artifactsDir, "browser-wasm-bench.json"), JSON.stringify(output, null, 2), "utf8");

  const mdLines = [
    "# Browser WASM Bench",
    "",
    `- Dataset: ${thresholds.dataset}`,
    `- Rounds: ${thresholds.rounds}`,
    `- WASM size (bytes): ${wasmBytes.length}`,
    "",
    "| Browser | Median Seconds | Tokens | Ngrams(n=2) |",
    "|---|---:|---:|---:|",
  ];
  for (const [name, result] of Object.entries(results)) {
    mdLines.push(`| ${name} | ${result.median_seconds.toFixed(6)} | ${result.tokens} | ${result.ngrams} |`);
  }
  if (skipped.length > 0) {
    mdLines.push("");
    mdLines.push("## Skipped");
    for (const item of skipped) {
      mdLines.push(`- ${item.browser}: ${item.reason}`);
    }
  }
  writeFileSync(resolve(artifactsDir, "browser-wasm-bench.md"), `${mdLines.join("\n")}\n`, "utf8");

  console.log(JSON.stringify(output, null, 2));
}

await main();
