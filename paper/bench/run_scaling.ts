/**
 * Scaling study: dataset-size scaling (Part A) + real popular corpora (Part B).
 * Runners: Python NLTK (.venv python3, via python_scaling.py) vs bun_nltk native
 * vs bun_nltk WASM (WasmNltk). Warmup 2, median of 5.
 *
 * Output: paper/bench/scaling_results.json + markdown tables on stdout.
 *
 * Run: export PATH="$PWD/.venv/bin:$PATH" && bun run paper/bench/run_scaling.ts
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  wordTokenizeSubset,
  sentenceTokenizePunkt,
  BigramCollocationFinder,
  BigramAssocMeasures,
  FreqDist,
} from "../../index";
import { WasmNltk } from "../../src/wasm";

const DATA = resolve(import.meta.dir, "data");
const SIZES_KB = [10, 100, 1024, 10240] as const;
const SIZE_FILES: Record<number, string> = { 10: "prose_10kb.txt", 100: "prose_100kb.txt", 1024: "prose_1000kb.txt", 10240: "prose_10000kb.txt" };
const NLTK_DATA = resolve(process.env.HOME!, "nltk_data/corpora");

type RunnerRow = { python_ms?: number | null; native_ms?: number | null; wasm_ms?: number | null };

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1]! + s[m]!) / 2 : s[m]!;
}

function timeIt(fn: () => unknown, warmup = 2, rounds = 5): number {
  for (let i = 0; i < warmup; i++) fn();
  const t: number[] = [];
  for (let i = 0; i < rounds; i++) {
    const s = performance.now();
    fn();
    t.push(performance.now() - s);
  }
  return median(t);
}

// ---------------------------------------------------------------- tasks
function wordsForBigrams(text: string): string[] {
  return text.toLowerCase().match(/[a-z']+/g)?.filter((w) => w.length > 2) ?? [];
}

const jsTasks = {
  tokenize(text: string): number {
    return wordTokenizeSubset(text).length;
  },
  punkt(text: string): number {
    return sentenceTokenizePunkt(text).length;
  },
  bigrams(text: string): number {
    const finder = BigramCollocationFinder.fromWords(wordsForBigrams(text), 2);
    return finder.scoreNgrams(BigramAssocMeasures.pmi).slice(0, 30).length;
  },
  freqdist(text: string): number {
    return FreqDist.fromTextAscii(wordsForBigrams(text).join(" "), { native: false }).N();
  },
};

// ---------------------------------------------------------------- data
function loadSizeTexts(): Record<number, string> {
  const out: Record<number, string> = {};
  for (const kb of SIZES_KB) {
    const p = resolve(DATA, SIZE_FILES[kb]!);
    if (!existsSync(p)) throw new Error(`missing size file: ${p}`);
    out[kb] = readFileSync(p, "utf8");
  }
  return out;
}

function loadCorpusText(name: string): string {
  if (name === "brown") {
    const dir = resolve(NLTK_DATA, "brown");
    const parts: string[] = [];
    const files = readdirSync(dir).filter((f) => f.startsWith("c")).sort();
    for (const fn of files) {
      parts.push(readFileSync(resolve(dir, fn), "latin1"));
    }
    return parts.join("\n");
  }
  if (name === "gutenberg") {
    const files = ["milton-paradise.txt", "austen-emma.txt", "melville-moby_dick.txt"];
    return files.map((f) => readFileSync(resolve(NLTK_DATA, "gutenberg", f), "utf8")).join("\n");
  }
  throw new Error(`unknown corpus ${name}`);
}

// ---------------------------------------------------------------- python side
function pyBench(): { py: Record<string, unknown>; ok: boolean } {
  const proc = Bun.spawnSync(["python3", resolve(import.meta.dir, "python_scaling.py")], {
    cwd: resolve(import.meta.dir, "../.."),
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
  });
  const stdout = new TextDecoder().decode(proc.stdout);
  if (proc.exitCode !== 0) {
    console.error("python bench failed:", new TextDecoder().decode(proc.stderr));
    return { py: {}, ok: false };
  }
  // last line with a JSON object is the result
  const line = stdout.split("\n").reverse().find((l) => l.trimStart().startsWith("{"));
  if (!line) {
    console.error("python bench produced no JSON. stdout tail:", stdout.slice(-500));
    return { py: {}, ok: false };
  }
  return { py: JSON.parse(line), ok: true };
}

// ---------------------------------------------------------------- main
async function main() {
  const texts = loadSizeTexts();

  let wasm: WasmNltk | null = null;
  let wasmErr: string | null = null;
  try {
    wasm = await WasmNltk.init();
  } catch (e) {
    wasmErr = String(e);
  }

  const errors: string[] = [];

  // ---- Part A: JS runners over sizes ----------------------------------
  const scaling: Record<string, Record<string, RunnerRow>> = {};
  for (const task of ["tokenize", "punkt", "bigrams"] as const) {
    scaling[task] = {};
    for (const kb of SIZES_KB) {
      const text = texts[kb]!;
      const row: RunnerRow = {};

      try {
        row.native_ms = timeIt(() => jsTasks[task](text));
      } catch (e) {
        row.native_ms = null;
        errors.push(`native ${task} ${kb}KB failed: ${String(e)}`);
      }

      if (wasm) {
        const w = wasm;
        const wtask =
          task === "tokenize"
            ? (t: string) => void w!.tokenizeAscii(t)
            : task === "punkt"
              ? (t: string) => void w!.sentenceTokenizePunktAscii(t)
              : (t: string) => void w!.countNgramsAscii(t, 2);
        try {
          wtask(text); // smoke
          row.wasm_ms = timeIt(() => wtask(text));
        } catch (e) {
          row.wasm_ms = null;
          errors.push(`wasm ${task} ${kb}KB failed: ${String(e)}`);
        }
      } else {
        row.wasm_ms = null;
      }

      scaling[task][String(kb)] = row;
      console.log(
        `[js] ${task} ${kb}KB native=${row.native_ms?.toFixed(1) ?? "null"}ms wasm=${row.wasm_ms?.toFixed(1) ?? "null"}ms`,
      );
    }
  }

  // ---- Part B: JS runners over real corpora ---------------------------
  const realJs: Record<string, Record<string, number | null>> = {};
  const corpusMeta: Record<string, { chars: number }> = {};
  const corpusNames = ["brown", "gutenberg"];
  for (const name of corpusNames) {
    let text: string;
    try {
      text = loadCorpusText(name);
    } catch (e) {
      errors.push(`${name}: load failed: ${String(e)}`);
      continue;
    }
    corpusMeta[name] = { chars: text.length };
    realJs[name] = {};
    for (const [task, fn] of Object.entries(jsTasks)) {
      try {
        fn(text); // smoke
        realJs[name][`${task}_native_ms`] = timeIt(() => fn(text));
      } catch (e) {
        realJs[name][`${task}_native_ms`] = null;
        errors.push(`native ${name}/${task} failed: ${String(e)}`);
      }
    }
    if (wasm) {
      const wtasks: Array<[string, (t: string) => unknown]> = [
        ["tokenize", (t) => void wasm!.tokenizeAscii(t)],
        ["punkt", (t) => void wasm!.sentenceTokenizePunktAscii(t)],
        ["freqdist", (t) => void wasm!.countTokensAscii(wordsForBigrams(t).join(" "))],
      ];
      for (const [task, fn] of wtasks) {
        try {
          fn(text); // smoke
          realJs[name][`${task}_wasm_ms`] = timeIt(() => fn(text));
        } catch (e) {
          realJs[name][`${task}_wasm_ms`] = null;
          errors.push(`wasm ${name}/${task} failed: ${String(e)}`);
        }
      }
    }
    console.log(`[js] ${name}:`, realJs[name]);
  }

  // ---- Python side ------------------------------------------------------
  console.log("\nrunning python side (may take a few minutes)...");
  const { py, ok: pyOk } = pyBench();
  if (!pyOk) errors.push("python runner failed entirely (see stderr above)");

  // merge python timings into Part A
  const pyScaling = (py.size_scaling ?? {}) as Record<string, Record<string, number>>;
  for (const task of ["tokenize", "punkt", "bigrams"] as const) {
    for (const kb of SIZES_KB) {
      const v = pyScaling[String(kb)]?.[`${task}_python_ms`];
      if (scaling[task]![String(kb)]) {
        scaling[task]![String(kb)]!.python_ms = typeof v === "number" ? v : null;
        if (typeof v !== "number" && pyOk) errors.push(`python ${task} ${kb}KB missing`);
      }
    }
  }
  if (Array.isArray(py.errors)) errors.push(...(py.errors as string[]));

  // ---- assemble output ---------------------------------------------------
  const resultsJson: any = {
    meta: {
      description: "bun_nltk scaling study: prose size scaling + real popular corpora",
      methodology: "warmup 2, median of 5, wall-clock ms",
      machine: `${process.platform}-${process.arch}`,
      date: new Date().toISOString(),
      size_files: SIZES_KB.map((kb) => `data/prose_${kb}kb.txt`),
      punkt_model: "trained once on fixed 200KB prefix of prose_1024kb.txt (all runners)",
      bigram_task: "lowercase [a-z']+ words len>2 -> BigramCollocationFinder PMI top-30",
    },
    size_scaling_kb: scaling,
    real_datasets: {} as Record<string, any>,
  };

  const pyReal = (py.real_datasets ?? {}) as Record<string, any>;

  function buildRealEntry(name: string): any {
    const entry: any = {
      name,
      chars: corpusMeta[name]?.chars ?? pyReal[name]?.chars ?? null,
      token_count: pyReal[name]?.token_count ?? null,
      skipped: pyReal[name]?.skipped ?? false,
      reason: pyReal[name]?.reason ?? undefined,
      timings: {} as Record<string, number | null>,
    };
    const js = realJs[name] ?? {};
    const pr = pyReal[name] ?? {};
    for (const task of ["tokenize", "punkt", "freqdist", "bigrams"]) {
      entry.timings[`${task}_python_ms`] = pr[`${task}_ms`] ?? null;
      if (js[`${task}_native_ms`] !== undefined) entry.timings[`${task}_native_ms`] = js[`${task}_native_ms`];
      if (js[`${task}_wasm_ms`] !== undefined) entry.timings[`${task}_wasm_ms`] = js[`${task}_wasm_ms`];
    }
    return entry;
  }
  for (const name of corpusNames) if (corpusMeta[name]) resultsJson.real_datasets[name] = buildRealEntry(name);
  if (pyReal.reuters) resultsJson.real_datasets.reuters = pyReal.reuters;

  if (errors.length) resultsJson.errors = errors;
  if (wasmErr) resultsJson.wasm_init_error = wasmErr;

  writeFileSync(resolve(import.meta.dir, "scaling_results.json"), JSON.stringify(resultsJson, null, 2));

  // ---- markdown tables ----------------------------------------------------
  const fmt = (v: number | null | undefined) => (typeof v === "number" ? v.toFixed(1) : "—");
  const lines: string[] = [];

  lines.push("## Size scaling (median ms, warmup 2 / rounds 5)\n");
  for (const task of ["tokenize", "punkt", "bigrams"] as const) {
    lines.push(`### ${task}\n`);
    lines.push("| size | python_ms | native_ms | wasm_ms |");
    lines.push("|------|-----------|-----------|---------|");
    for (const kb of SIZES_KB) {
      const r = scaling[task]![String(kb)]!;
      lines.push(`| ${kb >= 1024 ? `${(kb / 1024).toFixed(kb >= 10240 ? 0 : 1)}MB` : `${kb}KB`} | ${fmt(r.python_ms)} | ${fmt(r.native_ms)} | ${fmt(r.wasm_ms)} |`);
    }
    lines.push("");
  }

  lines.push("## Real corpora (median ms, warmup 2 / rounds 5)\n");
  lines.push("| corpus | tokens | runner | tokenize | punkt | freqdist |");
  lines.push("|--------|--------|--------|----------|-------|----------|");
  for (const name of Object.keys(resultsJson.real_datasets)) {
    const e = resultsJson.real_datasets[name];
    if (e.skipped) {
      lines.push(`| ${name} | — | skipped: ${e.reason} | | | |`);
      continue;
    }
    for (const r of ["python", "native", "wasm"]) {
      const key = `_${r}_ms`;
      const hasAny = Object.keys(e.timings).some((k) => k.endsWith(key));
      if (!hasAny) continue;
      lines.push(
        `| ${name} | ${e.token_count ?? "—"} | ${r} | ${fmt(e.timings[`tokenize${key}`])} | ${fmt(e.timings[`punkt${key}`])} | ${fmt(e.timings[`freqdist${key}`] ?? e.timings[`bigrams${key}`])} |`,
      );
    }
  }
  lines.push("");

  const md = lines.join("\n");
  console.log("\n" + md);
  writeFileSync(resolve(import.meta.dir, "scaling_summary.md"), md);
  console.log("wrote paper/bench/scaling_results.json and paper/bench/scaling_summary.md");

  wasm?.dispose();
}

await main();
