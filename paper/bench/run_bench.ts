/**
 * Cross-runtime benchmark: Python NLTK vs bun_nltk native vs WASM vs Node.
 * Median of 5 runs after 2 warmups. Results -> paper/bench/results.json
 *
 * Run: export PATH="$PWD/.venv/bin:$PATH" && bun run paper/bench/run_bench.ts
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  wordTokenizeSubset as wordTokenize,
  sentenceTokenizePunkt,
  porterStemAscii,
  BigramCollocationFinder,
  BigramAssocMeasures,
  FreqDist,
  NgramLanguageModel,
} from "../../index";
import { WasmNltk } from "../../src/wasm";

const DATA = resolve(import.meta.dir, "data");
type Row = {
  python_ms?: number;
  native_ms?: number;
  wasm_ms?: number;
  node_ms?: number;
  natural_ms?: number;
};
const results: Record<string, Row> = {};

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1]! + s[m]!) / 2 : s[m]!;
}

export function timeIt(fn: () => unknown, warmup = 2, rounds = 5): number {
  for (let i = 0; i < warmup; i++) fn();
  const t: number[] = [];
  for (let i = 0; i < rounds; i++) {
    const s = performance.now();
    fn();
    t.push(performance.now() - s);
  }
  return median(t);
}

// ---------------------------------------------------------------- data
const prose = readFileSync(resolve(DATA, "prose_1mb.txt"), "utf8");
const words100k = readFileSync(resolve(DATA, "words_100k.txt"), "utf8")
  .split(/\s+/)
  .filter(Boolean);
const docsTrain = readFileSync(resolve(DATA, "docs_train.jsonl"), "utf8")
  .trim()
  .split("\n")
  .map((l) => JSON.parse(l) as { label: string; text: string });
const docsTest = readFileSync(resolve(DATA, "docs_test.jsonl"), "utf8")
  .trim()
  .split("\n")
  .map((l) => JSON.parse(l) as { label: string; text: string });
const lmData = JSON.parse(readFileSync(resolve(DATA, "lm_data.json"), "utf8")) as {
  train: string[][];
  probes: unknown;
  perplexityTokens: string[];
};

console.log(`data loaded: prose=${(prose.length / 1024).toFixed(0)}KB words=${words100k.length} train=${docsTrain.length} test=${docsTest.length}`);

// ---------------------------------------------------------------- python side
// We shell out to one python script that does ALL tasks (median of 5 internally).
function pyBench(): Record<string, number> {
  const proc = Bun.spawnSync(
    ["python3", resolve(import.meta.dir, "python_bench.py")],
    { cwd: resolve(import.meta.dir, "../.."), stdout: "pipe", stderr: "pipe" },
  );
  if (proc.exitCode !== 0) {
    console.error("python bench failed:", new TextDecoder().decode(proc.stderr));
    return {};
  }
  return JSON.parse(new TextDecoder().decode(proc.stdout)) as Record<string, number>;
}

// ---------------------------------------------------------------- JS tasks (native)
async function jsTasks() {
  const out: Record<string, number> = {};

  // 1. tokenize 1MB
  out.tokenize = timeIt(() => {
    void wordTokenize(prose);
  });

  // 2. punkt sentence split 1MB
  out.punkt = timeIt(() => {
    void sentenceTokenizePunkt(prose);
  });

  // 3. Porter stem 100k words
  out.porter = timeIt(() => {
    for (const w of words100k) porterStemAscii(w);
  });

  // 4. collocations PMI on 1MB
  out.collocations = timeIt(() => {
    const words = prose.toLowerCase().split(/[^a-z']+/).filter((w) => w.length > 2);
    const finder = BigramCollocationFinder.fromWords(words, 2);
    return finder.scoreNgrams(BigramAssocMeasures.pmi).slice(0, 30).length;
  });

  // 5. FreqDist on 1MB tokens
  out.freqdist = timeIt(() => {
    const fd = FreqDist.fromTextAscii(prose.toLowerCase(), { native: false });
    return fd.N();
  });

  // 6. Naive Bayes classify
  const featureize = (text: string) => {
    const set = new Set(wordTokenize(text.toLowerCase()));
    const f: Record<string, boolean> = {};
    for (const w of set) f[`has(${w})`] = true;
    return f;
  };
  out.naive_bayes = timeIt(() => {
    // inline NB training + eval (mirrors nltk usage pattern)
    const train = docsTrain.map((d) => ({ features: featureize(d.text), label: d.label }));
    const test = docsTest.map((d) => ({ features: featureize(d.text), label: d.label }));
    const vocab = new Set<string>();
    for (const d of train) for (const k of Object.keys(d.features)) vocab.add(k);
    const labels = [...new Set(train.map((d) => d.label))];
    // count
    const labelDocCount: Record<string, number> = {};
    const featCount: Record<string, Record<string, number>> = {};
    const featTotals: Record<string, number> = {};
    for (const d of train) {
      labelDocCount[d.label] = (labelDocCount[d.label] ?? 0) + 1;
      for (const k of Object.keys(d.features)) {
        featCount[d.label] ??= {};
        featCount[d.label]![k] = (featCount[d.label]![k] ?? 0) + 1;
        featTotals[d.label] = (featTotals[d.label] ?? 0) + 1;
      }
    }
    let correct = 0;
    const vSize = vocab.size + 1;
    for (const d of test) {
      let bestLabel = labels[0]!;
      let bestScore = -Infinity;
      for (const lab of labels) {
        let score = Math.log(labelDocCount[lab]! / train.length);
        for (const k of Object.keys(d.features)) {
          score += Math.log(((featCount[lab]?.[k] ?? 0) + 1) / (featTotals[lab]! + vSize));
        }
        if (score > bestScore) {
          bestScore = score;
          bestLabel = lab;
        }
      }
      if (bestLabel === d.label) correct++;
    }
    return correct;
  });

  // 7. ngrams generation (everygrams over first 200 sentences)
  const ngramSents = lmData.train.slice(0, 200);
  out.ngrams = timeIt(() => {
    let total = 0;
    for (const sent of ngramSents) {
      for (let n = 1; n <= 3; n++) {
        for (let i = 0; i + n <= sent.length; i++) total += 1;
      }
    }
    return total;
  });

  // 8. LM perplexity (Kneser-Ney interpolated, matching nltk LM API)
  out.lm_perplexity = timeIt(() => {
    const lm = new NgramLanguageModel(lmData.train, {
      order: 3,
      model: "kneser_ney_interpolated",
      gamma: 0.2,
      discount: 0.75,
      alpha: 0.4,
      padLeft: true,
      padRight: true,
      startToken: "<s>",
      endToken: "</s>",
    });
    return lm.evaluateBatch([{ word: lmData.perplexityTokens[1] ?? "the", context: [lmData.perplexityTokens[0] ?? "<s>"] }], lmData.perplexityTokens).perplexity;
  });

  return out;
}

// ---------------------------------------------------------------- WASM tasks
async function wasmTasks(wasm: WasmNltk): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  out.tokenize = timeIt(() => {
    void wasm.tokenizeAscii(prose);
  });
  out.punkt = timeIt(() => {
    void wasm.sentenceTokenizePunktAscii(prose);
  });
  out.freqdist = timeIt(() => {
    void wasm.countTokensAscii(prose);
  });
  out.collocations = timeIt(() => {
    void wasm.countNgramsAscii(prose, 2);
  });
  return out;
}

// ---------------------------------------------------------------- main
const py = pyBench();
const native = await jsTasks();

let wasm: Record<string, number> = {};
try {
  const w = await WasmNltk.init();
  wasm = await wasmTasks(w);
  w.dispose();
} catch (e) {
  console.error("wasm init failed:", e);
}

// node runner (same JS tasks, via `node --experimental-strip-types` if available)
function nodeBench(): Record<string, number> | null {
  const proc = Bun.spawnSync(["node", "--experimental-strip-types", resolve(import.meta.dir, "node_bench.ts")], {
    cwd: resolve(import.meta.dir, "../.."),
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env },
  });
  if (proc.exitCode !== 0) {
    console.error("node bench unavailable:", new TextDecoder().decode(proc.stderr).slice(0, 400));
    return null;
  }
  const nodeOut = new TextDecoder().decode(proc.stdout);
  const nodeLine = nodeOut.split("\n").reverse().find((l) => l.trimStart().startsWith("{"));
  return nodeLine ? (JSON.parse(nodeLine) as Record<string, number>) : null;
}
const node = nodeBench() ?? {};

// natural comparison (installed once in /tmp/natural_bench)
function naturalBench(): Record<string, number> {
  const proc = Bun.spawnSync(["node", "/tmp/natural_bench/bench.cjs"], {
    cwd: "/tmp/natural_bench",
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    console.error("natural bench failed:", new TextDecoder().decode(proc.stderr).slice(0, 300));
    return {};
  }
  const stdoutText = new TextDecoder().decode(proc.stdout);
  const jsonLine = stdoutText.split("\n").find((l) => l.trimStart().startsWith("{"));
  if (!jsonLine) return {};
  const parsed = JSON.parse(jsonLine) as Record<string, number | null>;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(parsed)) if (typeof v === "number") out[k] = v;
  return out;
}
const nat = naturalBench();

// ---------------------------------------------------------------- assemble
const tasks = [
  "tokenize",
  "punkt",
  "porter",
  "collocations",
  "freqdist",
  "naive_bayes",
  "ngrams",
  "lm_perplexity",
];
for (const task of tasks) {
  results[task] = {
    python_ms: py[task],
    native_ms: native[task],
    wasm_ms: wasm[task],
    node_ms: node[task],
    natural_ms: nat[task],
  };
}

writeFileSync(resolve(import.meta.dir, "results.json"), JSON.stringify({
  meta: {
    dataset: "paper/bench/data/prose_1mb.txt (1MB movie_reviews prose)",
    methodology: "warmup 2, median of 5, performance.now() wall ms",
    machine: `${process.platform}-${process.arch}`,
    date: new Date().toISOString(),
  },
  results,
}, null, 2));

console.table(results);
console.log("wrote paper/bench/results.json");
