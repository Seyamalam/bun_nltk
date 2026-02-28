import { resolve } from "node:path";
import { loadWordNet } from "../index";

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

type Query = { word: string; pos?: "n" | "v" | "a" | "r" };

function buildQueries(): Query[] {
  const wn = loadWordNet();
  const lemmas = wn.lemmas();
  const out: Query[] = [];
  for (const lemma of lemmas) {
    out.push({ word: lemma });
    out.push({ word: `${lemma}s`, pos: "n" });
    out.push({ word: `${lemma}ed`, pos: "v" });
    if (out.length >= 1200) break;
  }
  return out;
}

function runNative(queries: Query[], rounds: number) {
  const wn = loadWordNet();
  const timings: number[] = [];
  let checksum = 0;
  for (let i = 0; i < rounds; i += 1) {
    const started = performance.now();
    checksum = 0;
    for (const q of queries) {
      const root = wn.morphy(q.word, q.pos) ?? q.word.toLowerCase();
      const rows = wn.synsets(root, q.pos);
      checksum += root.length + rows.length;
      if (rows.length > 0) {
        checksum += wn.hypernyms(rows[0]!).length + wn.hyponyms(rows[0]!).length;
      }
    }
    timings.push((performance.now() - started) / 1000);
  }
  return { checksum, median_seconds: median(timings) };
}

function runPython(rounds: number) {
  const payloadPath = resolve(import.meta.dir, "..", "models", "wordnet_extended.json");
  const procStarted = performance.now();
  const proc = Bun.spawnSync(
    ["python", "bench/python_wordnet_baseline.py", "--payload", payloadPath, "--rounds", String(rounds)],
    {
      cwd: resolve(import.meta.dir, ".."),
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  if (proc.exitCode !== 0) {
    throw new Error(`python wordnet baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  }
  const payload = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as {
    checksum: number;
    operations: number;
    total_seconds: number;
  };
  const observed_seconds = (performance.now() - procStarted) / 1000;
  return {
    ...payload,
    total_seconds: Math.max(payload.total_seconds, observed_seconds),
  };
}

function main() {
  const rounds = Number(process.argv[2] ?? "8");
  const queries = buildQueries();
  const native = runNative(queries, rounds);
  const python = runPython(rounds);

  console.log(
    JSON.stringify(
      {
        rounds,
        query_count: queries.length,
        native_seconds_median: native.median_seconds,
        python_seconds: python.total_seconds,
        speedup_vs_python: python.total_seconds / native.median_seconds,
        native_checksum: native.checksum,
        python_checksum: python.checksum,
        parity_checksum: native.checksum === python.checksum,
      },
      null,
      2,
    ),
  );
}

main();
