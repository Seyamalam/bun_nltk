import { createHash } from "node:crypto";
import { closeSync, mkdirSync, openSync, readFileSync, readSync, rmdirSync, unlinkSync, writeFileSync, writeSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { arch, cpus, platform, release, totalmem } from "node:os";

type Result = {
  seconds: number; tokens: number; ngrams: number; uniqueTokens: number; uniqueNgrams: number;
  countsSha256?: string; runtime: string; bunVersion?: string; nltk?: string; linearMemoryBytes?: number;
};
type Sample = Result & { peakRssBytes: number; wallSeconds: number };
const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = `/tmp/opencode/bun-nltk-scale-matrix/${process.pid}`;
const worker = process.argv[2] === "--worker";

async function runWorker(mode: string, path: string): Promise<void> {
  if (mode === "native-stream") {
    const { NativeFreqDistStream } = await import("../src/native.ts");
    const stream = new NativeFreqDistStream();
    const started = performance.now();
    const fd = openSync(path, "r");
    const buffer = Buffer.alloc(1024 * 1024);
    try {
      let size: number;
      while ((size = readSync(fd, buffer, 0, buffer.length, null)) > 0) stream.update(buffer.toString("ascii", 0, size));
      stream.flush();
      const tokens = [...stream.tokenFreqDistHash()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
      const grams = stream.bigramFreqDistHash().sort((a, b) => a.leftHash < b.leftHash ? -1 : a.leftHash > b.leftHash ? 1 : a.rightHash < b.rightHash ? -1 : a.rightHash > b.rightHash ? 1 : 0);
      const hash = createHash("sha256");
      for (const [h, n] of tokens) hash.update(`${h}:${n}\n`);
      for (const { leftHash, rightHash, count } of grams) hash.update(`${leftHash}:${rightHash}:${count}\n`);
      console.log(JSON.stringify({ seconds: (performance.now() - started) / 1000,
        tokens: tokens.reduce((s, [, n]) => s + n, 0), ngrams: grams.reduce((s, g) => s + g.count, 0),
        uniqueTokens: tokens.length, uniqueNgrams: grams.length, countsSha256: hash.digest("hex"), runtime: process.version, bunVersion: Bun.version,
      } satisfies Result));
    } finally { closeSync(fd); stream.dispose(); }
  } else {
    const { WasmNltk } = await import("../src/wasm.ts");
    const wasm = await WasmNltk.init();
    const started = performance.now();
    try {
      let metrics;
      if (mode === "wasm-stream") {
        const stream = wasm.createAsciiMetricsStream(2);
        const fd = openSync(path, "r"), buffer = Buffer.alloc(1024 * 1024);
        try {
          let size: number;
          while ((size = readSync(fd, buffer, 0, buffer.length, null)) > 0) stream.update(buffer.subarray(0, size));
          metrics = stream.finish();
        } finally { closeSync(fd); stream.dispose(); }
      } else { metrics = wasm.computeAsciiMetrics(readFileSync(path, "utf8"), 2); }
      console.log(JSON.stringify({ ...metrics, seconds: (performance.now() - started) / 1000,
        runtime: process.version, ...(typeof Bun !== "undefined" ? { bunVersion: Bun.version } : {}), linearMemoryBytes: wasm.memoryBytes } satisfies Result));
    } finally { wasm.dispose(); }
  }
}

function measure(command: string[], name: string): Sample {
  const rssPath = resolve(temporary, `${name}.rss`);
  const start = performance.now();
  try {
    const child = Bun.spawnSync(["/usr/bin/time", "-f", "%M", "-o", rssPath, ...command], { cwd: root, stdout: "pipe", stderr: "pipe", timeout: 600_000 });
    if (child.exitCode !== 0) throw new Error(new TextDecoder().decode(child.stderr));
    const result = JSON.parse(new TextDecoder().decode(child.stdout)) as Result;
    const peakRssBytes = Number(readFileSync(rssPath, "utf8").trim()) * 1024;
    if (!Number.isFinite(result.seconds) || result.seconds < 0 || !Number.isFinite(peakRssBytes) || peakRssBytes <= 0) throw new Error("invalid timing or RSS sample");
    return { ...result, peakRssBytes, wallSeconds: (performance.now() - start) / 1000 };
  } finally { unlinkSync(rssPath); }
}

function dataset(path: string, size: number): string {
  // Fixed 1 MiB pseudorandom ASCII block, repeated for larger sizes. Low-entropy
  // vocabulary intentionally isolates input-size scaling, not vocabulary growth.
  let seed = 1337;
  const words = Array.from({ length: 128 }, (_, i) => `word${i}`);
  const fragments: string[] = [];
  let length = 0;
  while (length < 1024 * 1024) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const text = `${words[(seed >>> 16) % words.length]} `;
    fragments.push(text);
    length += text.length;
  }
  const block = Buffer.from(fragments.join("").slice(0, 1024 * 1024));
  const fd = openSync(path, "wx");
  const hash = createHash("sha256");
  try {
    for (let offset = 0; offset < size; offset += block.length) {
      const bytes = block.subarray(0, Math.min(block.length, size - offset));
      let written = 0;
      while (written < bytes.length) {
        const count = writeSync(fd, bytes, written, bytes.length - written);
        if (count === 0) throw new Error("dataset write made no progress");
        written += count;
      }
      hash.update(bytes);
    }
  } finally { closeSync(fd); }
  return hash.digest("hex");
}

function median(values: number[]): number { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)]!; }

async function main(): Promise<void> {
  const sizes = (process.env.BUN_NLTK_BENCH_SIZES ?? "1024,1048576,16777216,67108864,268435456,1073741824").split(",").map(Number);
  const rounds = Number(process.env.BUN_NLTK_BENCH_ROUNDS ?? 3);
  if (sizes.some((s) => !Number.isSafeInteger(s) || s < 1 || s > 2 ** 31) || !Number.isSafeInteger(rounds) || rounds < 3 || rounds % 2 === 0) throw new RangeError("positive sizes up to 2 GiB and odd rounds >=3 required");
  mkdirSync(temporary, { recursive: true });
  const startedAt = new Date().toISOString();
  const git = (args: string[]) => {
    const result = Bun.spawnSync(["git", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
    if (result.exitCode !== 0) throw new Error("cannot capture benchmark revision");
    return new TextDecoder().decode(result.stdout).trim();
  };
  const digest = (path: string) => createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex");
  const provenance = {
    startedAt, commit: git(["rev-parse", "HEAD"]), worktreeStatus: git(["status", "--porcelain"]),
    machine: { platform: platform(), release: release(), arch: arch(), cpu: cpus()[0]?.model, cpuCount: cpus().length, totalMemoryBytes: totalmem() },
    sha256: Object.fromEntries(["bench/scale_matrix.ts", "bench/python_scale_baseline.py", "native/bun_nltk.wasm", "native/prebuilt/linux-x64/bun_nltk.so"].map((path) => [path, digest(path)])),
  };
  const rows: unknown[] = [];
  for (const sizeBytes of sizes) {
    const path = resolve(temporary, `dataset-${sizeBytes}-${Date.now()}.txt`);
    const sha256 = dataset(path, sizeBytes);
    try {
      const samples: Record<string, Sample[]> = { python: [], native: [], bunWasmStream: [], nodeWasmStream: [] };
      if (sizeBytes <= 64 * 1024 * 1024) { samples.bunWasm = []; samples.nodeWasm = []; }
      for (let round = 0; round < rounds; round++) {
        samples.python!.push(measure(["python3", "bench/python_scale_baseline.py", path], "python"));
        samples.native!.push(measure(["bun", "bench/scale_matrix.ts", "--worker", "native-stream", path], "native"));
        samples.bunWasmStream!.push(measure(["bun", "bench/scale_matrix.ts", "--worker", "wasm-stream", path], "bun-wasm-stream"));
        samples.nodeWasmStream!.push(measure(["node", "bench/scale_matrix.ts", "--worker", "wasm-stream", path], "node-wasm-stream"));
        if (samples.bunWasm) {
          samples.bunWasm.push(measure(["bun", "bench/scale_matrix.ts", "--worker", "wasm-batch", path], "bun-wasm"));
          samples.nodeWasm!.push(measure(["node", "bench/scale_matrix.ts", "--worker", "wasm-batch", path], "node-wasm"));
        }
      }
      const oracle = samples.python![0]!;
      for (const group of Object.values(samples)) for (const sample of group) {
        for (const key of ["tokens", "ngrams", "uniqueTokens", "uniqueNgrams"] as const) if (sample[key] !== oracle[key]) throw new Error(`parity failure: ${key} at ${sizeBytes} bytes: ${JSON.stringify({sample,oracle})}`);
        if (sample.countsSha256 && sample.countsSha256 !== oracle.countsSha256) throw new Error(`full frequency parity failure at ${sizeBytes}`);
      }
      const summary = Object.fromEntries(Object.entries(samples).map(([name, group]) => [name, {
        medianSeconds: median(group.map((s) => s.seconds)), medianWallSeconds: median(group.map((s) => s.wallSeconds)),
        peakRssBytes: Math.max(...group.map((s) => s.peakRssBytes)),
        speedup: median(samples.python!.map((s) => s.seconds)) / median(group.map((s) => s.seconds)),
        memoryRatio: Math.max(...group.map((s) => s.peakRssBytes)) / Math.max(...samples.python!.map((s) => s.peakRssBytes)),
      }]));
      rows.push({ sizeBytes, sha256, parity: true, summary, samples, wasmBatchSkipped: sizeBytes > 64 * 1024 * 1024 ? "batch cases omitted above 64 MiB; streaming tested instead" : null });
      console.error(JSON.stringify({ sizeBytes, parity: true, summary }));
    } finally { unlinkSync(path); }
  }
  const output = resolve(root, process.env.BUN_NLTK_BENCH_OUTPUT ?? "artifacts/scale-matrix.json");
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify({ schemaVersion: 2, generatedAt: new Date().toISOString(), provenance, rounds, rows,
    scope: "ASCII token and bigram distributions; native additionally computes heuristic conditional tags. Python uses streaming NLTK FreqDist/bigrams. WASM reports matching aggregate counts only.",
    limitations: ["Repeated low-entropy 1 MiB block; vocabulary scaling and all NLP features require separate workloads.", "Peak RSS includes runtime imports and cold-process overhead; wall time includes initialization.", "Native streaming uses 64-bit hashes, not collision-free token keys.", "WASM batches above 64 MiB are not attempted. WASM streaming counts exact keys, comparing aggregate counts only; browsers have separate smoke tests."],
  }, null, 2) + "\n");
  console.log(JSON.stringify({ output, cases: rows.length, parity: true }));
}

if (worker) await runWorker(process.argv[3]!, process.argv[4]!);
else {
  try { await main(); }
  finally { rmdirSync(temporary); }
}
