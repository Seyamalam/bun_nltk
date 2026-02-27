import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type BrowserThreshold = {
  max_median_seconds: number;
  max_punkt_median_seconds?: number;
  max_lm_median_seconds?: number;
  max_chunk_median_seconds?: number;
  max_morphy_median_seconds?: number;
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
  punkt_median_seconds: number;
  lm_median_seconds: number;
  chunk_median_seconds: number;
  morphy_median_seconds: number;
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
          bunnltk_wasm_alloc: (size: number) => number;
          bunnltk_wasm_count_tokens_ascii: (len: number) => bigint | number;
          bunnltk_wasm_count_ngrams_ascii: (len: number, n: number) => bigint | number;
          bunnltk_wasm_count_sentences_punkt_ascii: (len: number) => bigint | number;
          bunnltk_wasm_wordnet_morphy_ascii: (len: number, pos: number, outPtr: number, outCap: number) => number;
          bunnltk_wasm_lm_eval_ids: (
            tokenIdsPtr: number,
            tokenIdsLen: number,
            sentenceOffsetsPtr: number,
            sentenceOffsetsLen: number,
            order: number,
            modelType: number,
            gamma: number,
            discount: number,
            vocabSize: number,
            probeContextFlatPtr: number,
            probeContextFlatLen: number,
            probeContextLensPtr: number,
            probeWordsPtr: number,
            probeCount: number,
            outScoresPtr: number,
            outScoresLen: number,
            perplexityTokensPtr: number,
            perplexityLen: number,
            prefixTokensPtr: number,
            prefixLen: number,
          ) => number;
          bunnltk_wasm_chunk_iob_ids: (
            tokenTagIdsPtr: number,
            tokenCount: number,
            atomAllowedOffsetsPtr: number,
            atomAllowedLengthsPtr: number,
            atomAllowedFlatPtr: number,
            atomAllowedFlatLen: number,
            atomMinsPtr: number,
            atomMaxsPtr: number,
            atomCount: number,
            ruleAtomOffsetsPtr: number,
            ruleAtomCountsPtr: number,
            ruleLabelIdsPtr: number,
            ruleCount: number,
            outLabelIdsPtr: number,
            outBeginsPtr: number,
            outCapacity: number,
          ) => bigint | number;
        };

        const encoder = new TextEncoder();
        const encoded = encoder.encode(sourceText as string);
        const inputPtr = Number(exp.bunnltk_wasm_input_ptr());
        const capacity = Number(exp.bunnltk_wasm_input_capacity());
        if (encoded.length > capacity) {
          throw new Error(`dataset exceeds wasm input capacity: ${encoded.length} > ${capacity}`);
        }

        const timings: number[] = [];
        const punktTimings: number[] = [];
        const lmTimings: number[] = [];
        const chunkTimings: number[] = [];
        const morphyTimings: number[] = [];
        let tokens = 0;
        let ngrams = 0;
        const median = (vals: number[]) => {
          const sorted = [...vals].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
        };

        const alloc = (bytes: number) => {
          const ptr = Number(exp.bunnltk_wasm_alloc(bytes));
          if (!ptr) throw new Error(`wasm alloc failed for ${bytes}`);
          return ptr;
        };

        // Pre-allocated tiny LM tensors.
        const tokenIds = new Uint32Array([1, 2, 3, 4, 1, 2, 5, 4]);
        const sentenceOffsets = new Uint32Array([0, 4, 8]);
        const probeFlat = new Uint32Array([1, 2]);
        const probeLens = new Uint32Array([2]);
        const probeWords = new Uint32Array([3]);
        const pplTokens = new Uint32Array([1, 2, 3, 4]);
        const prefix = new Uint32Array([0, 0]);
        const lmScores = new Float64Array(1);
        const pTokenIds = alloc(tokenIds.byteLength);
        const pSentenceOffsets = alloc(sentenceOffsets.byteLength);
        const pProbeFlat = alloc(probeFlat.byteLength);
        const pProbeLens = alloc(probeLens.byteLength);
        const pProbeWords = alloc(probeWords.byteLength);
        const pPplTokens = alloc(pplTokens.byteLength);
        const pPrefix = alloc(prefix.byteLength);
        const pLmScores = alloc(lmScores.byteLength);
        new Uint32Array(exp.memory.buffer, pTokenIds, tokenIds.length).set(tokenIds);
        new Uint32Array(exp.memory.buffer, pSentenceOffsets, sentenceOffsets.length).set(sentenceOffsets);
        new Uint32Array(exp.memory.buffer, pProbeFlat, probeFlat.length).set(probeFlat);
        new Uint32Array(exp.memory.buffer, pProbeLens, probeLens.length).set(probeLens);
        new Uint32Array(exp.memory.buffer, pProbeWords, probeWords.length).set(probeWords);
        new Uint32Array(exp.memory.buffer, pPplTokens, pplTokens.length).set(pplTokens);
        new Uint32Array(exp.memory.buffer, pPrefix, prefix.length).set(prefix);

        // Pre-allocated tiny chunk tensors.
        const tokenTagIds = new Uint16Array([1, 2, 2, 3, 4, 5]);
        const atomAllowedOffsets = new Uint32Array([0, 1, 2, 3, 4]);
        const atomAllowedLengths = new Uint32Array([1, 1, 1, 1, 1]);
        const atomAllowedFlat = new Uint16Array([1, 2, 3, 4, 5]);
        const atomMins = new Uint8Array([0, 0, 1, 1, 0]);
        const atomMaxs = new Uint8Array([1, 255, 255, 255, 1]);
        const ruleAtomOffsets = new Uint32Array([0, 3]);
        const ruleAtomCounts = new Uint32Array([3, 2]);
        const ruleLabelIds = new Uint16Array([0, 1]);
        const pTokenTagIds = alloc(tokenTagIds.byteLength);
        const pAtomOff = alloc(atomAllowedOffsets.byteLength);
        const pAtomLen = alloc(atomAllowedLengths.byteLength);
        const pAtomFlat = alloc(atomAllowedFlat.byteLength);
        const pAtomMins = alloc(atomMins.byteLength);
        const pAtomMaxs = alloc(atomMaxs.byteLength);
        const pRuleOff = alloc(ruleAtomOffsets.byteLength);
        const pRuleCount = alloc(ruleAtomCounts.byteLength);
        const pRuleLabel = alloc(ruleLabelIds.byteLength);
        const pOutLabel = alloc(tokenTagIds.length * 2);
        const pOutBegin = alloc(tokenTagIds.length);
        const outMorph = alloc(64);
        new Uint16Array(exp.memory.buffer, pTokenTagIds, tokenTagIds.length).set(tokenTagIds);
        new Uint32Array(exp.memory.buffer, pAtomOff, atomAllowedOffsets.length).set(atomAllowedOffsets);
        new Uint32Array(exp.memory.buffer, pAtomLen, atomAllowedLengths.length).set(atomAllowedLengths);
        new Uint16Array(exp.memory.buffer, pAtomFlat, atomAllowedFlat.length).set(atomAllowedFlat);
        new Uint8Array(exp.memory.buffer, pAtomMins, atomMins.length).set(atomMins);
        new Uint8Array(exp.memory.buffer, pAtomMaxs, atomMaxs.length).set(atomMaxs);
        new Uint32Array(exp.memory.buffer, pRuleOff, ruleAtomOffsets.length).set(ruleAtomOffsets);
        new Uint32Array(exp.memory.buffer, pRuleCount, ruleAtomCounts.length).set(ruleAtomCounts);
        new Uint16Array(exp.memory.buffer, pRuleLabel, ruleLabelIds.length).set(ruleLabelIds);

        const morphWords = ["dogs", "sprinted", "faster", "research_papers"];
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

          const punktStart = performance.now();
          void exp.bunnltk_wasm_count_sentences_punkt_ascii(encoded.length);
          if (Number(exp.bunnltk_wasm_last_error_code()) !== 0) throw new Error("punkt wasm error");
          punktTimings.push((performance.now() - punktStart) / 1000);

          const morphStart = performance.now();
          for (const w of morphWords) {
            const wBytes = encoder.encode(w);
            new Uint8Array(exp.memory.buffer).set(wBytes, inputPtr);
            void exp.bunnltk_wasm_wordnet_morphy_ascii(wBytes.length, 0, outMorph, 64);
            if (Number(exp.bunnltk_wasm_last_error_code()) !== 0) throw new Error("morphy wasm error");
          }
          morphyTimings.push((performance.now() - morphStart) / 1000);

          const lmStart = performance.now();
          void exp.bunnltk_wasm_lm_eval_ids(
            pTokenIds,
            tokenIds.length,
            pSentenceOffsets,
            sentenceOffsets.length,
            3,
            2,
            0.1,
            0.75,
            6,
            pProbeFlat,
            probeFlat.length,
            pProbeLens,
            pProbeWords,
            probeWords.length,
            pLmScores,
            lmScores.length,
            pPplTokens,
            pplTokens.length,
            pPrefix,
            prefix.length,
          );
          if (Number(exp.bunnltk_wasm_last_error_code()) !== 0) throw new Error("lm wasm error");
          lmTimings.push((performance.now() - lmStart) / 1000);

          const chunkStart = performance.now();
          void exp.bunnltk_wasm_chunk_iob_ids(
            pTokenTagIds,
            tokenTagIds.length,
            pAtomOff,
            pAtomLen,
            pAtomFlat,
            atomAllowedFlat.length,
            pAtomMins,
            pAtomMaxs,
            atomMins.length,
            pRuleOff,
            pRuleCount,
            pRuleLabel,
            ruleLabelIds.length,
            pOutLabel,
            pOutBegin,
            tokenTagIds.length,
          );
          if (Number(exp.bunnltk_wasm_last_error_code()) !== 0) throw new Error("chunk wasm error");
          chunkTimings.push((performance.now() - chunkStart) / 1000);
        }

        return {
          median_seconds: median(timings),
          tokens,
          ngrams,
          punkt_median_seconds: median(punktTimings),
          lm_median_seconds: median(lmTimings),
          chunk_median_seconds: median(chunkTimings),
          morphy_median_seconds: median(morphyTimings),
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
      if (threshold.max_punkt_median_seconds && result.punkt_median_seconds > threshold.max_punkt_median_seconds) {
        throw new Error(`${name} punkt median exceeded threshold`);
      }
      if (threshold.max_lm_median_seconds && result.lm_median_seconds > threshold.max_lm_median_seconds) {
        throw new Error(`${name} lm median exceeded threshold`);
      }
      if (threshold.max_chunk_median_seconds && result.chunk_median_seconds > threshold.max_chunk_median_seconds) {
        throw new Error(`${name} chunk median exceeded threshold`);
      }
      if (threshold.max_morphy_median_seconds && result.morphy_median_seconds > threshold.max_morphy_median_seconds) {
        throw new Error(`${name} morphy median exceeded threshold`);
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
    "| Browser | Token/Ngram Median Sec | Punkt Median Sec | LM Median Sec | Chunk Median Sec | Morphy Median Sec | Tokens | Ngrams(n=2) |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
  ];
  for (const [name, result] of Object.entries(results)) {
    mdLines.push(
      `| ${name} | ${result.median_seconds.toFixed(6)} | ${result.punkt_median_seconds.toFixed(6)} | ${result.lm_median_seconds.toFixed(6)} | ${result.chunk_median_seconds.toFixed(6)} | ${result.morphy_median_seconds.toFixed(6)} | ${result.tokens} | ${result.ngrams} |`,
    );
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
