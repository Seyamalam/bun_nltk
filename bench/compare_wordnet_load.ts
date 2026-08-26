import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadWordNetPacked, WordNet, type WordNetMiniPayload } from "../src/wordnet";
import { bootstrapMedianRatio, median } from "./statistics";

type Backend = "native" | "js";

type Result = {
  backend: Backend;
  implementation: string;
  load_ms: number;
  rss_delta_bytes: number;
  heap_delta_bytes: number;
  external_delta_bytes: number;
  checksum: number;
};

const packedPath = resolve(import.meta.dir, "..", "models", "wordnet_full.bin");

function readPackedPayload(path: string): WordNetMiniPayload {
  const bytes = readFileSync(path);
  const magic = new TextDecoder().decode(bytes.subarray(0, 5));
  if (magic !== "BNWN1") throw new Error(`invalid WordNet pack magic: ${magic}`);
  const length = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(5, true);
  return JSON.parse(new TextDecoder().decode(bytes.subarray(9, 9 + length))) as WordNetMiniPayload;
}

function load(backend: Backend): WordNet {
  return backend === "native" ? loadWordNetPacked(packedPath) : new WordNet(readPackedPayload(packedPath));
}

function collect(): void {
  const backend = process.argv[3] as Backend;
  if (backend !== "native" && backend !== "js") throw new Error(`invalid backend: ${backend}`);

  Bun.gc(true);
  const before = process.memoryUsage();
  const started = performance.now();
  const model = load(backend);
  const loadMs = performance.now() - started;
  const rows = model.lookupBatch([{ word: "dogs", pos: "n" }, { word: "running", pos: "v" }]);
  Bun.gc(true);
  const after = process.memoryUsage();

  const result: Result = {
    backend,
    implementation: model.constructor.name,
    load_ms: loadMs,
    rss_delta_bytes: after.rss - before.rss,
    heap_delta_bytes: after.heapUsed - before.heapUsed,
    external_delta_bytes: after.external - before.external,
    checksum: rows.reduce((sum, row) => sum + row.root.length + row.synsets.length, 0),
  };
  console.log(JSON.stringify(result));
}

function runChild(backend: Backend): Result {
  const proc = Bun.spawnSync([process.execPath, import.meta.path, "--collect", backend], {
    stdout: "pipe",
    stderr: "inherit",
  });
  if (proc.exitCode !== 0) throw new Error(`${backend} benchmark failed with code ${proc.exitCode}`);
  return JSON.parse(new TextDecoder().decode(proc.stdout)) as Result;
}

function summarize(results: Result[]) {
  return {
    implementation: results[0]!.implementation,
    checksum: results[0]!.checksum,
    load_ms_median: median(results.map((result) => result.load_ms)),
    load_ms_samples: results.map((result) => result.load_ms),
    rss_delta_bytes_median: median(results.map((result) => result.rss_delta_bytes)),
    rss_delta_bytes_samples: results.map((result) => result.rss_delta_bytes),
    heap_delta_bytes_median: median(results.map((result) => result.heap_delta_bytes)),
    external_delta_bytes_median: median(results.map((result) => result.external_delta_bytes)),
  };
}

if (!existsSync(packedPath)) {
  throw new Error("models/wordnet_full.bin is required; run bun run wordnet:prepare:default");
}

if (process.argv[2] === "--collect") {
  collect();
} else {
  const rounds = Math.max(2, Number(process.argv[2] ?? "9"));
  const nativeResults: Result[] = [];
  const jsResults: Result[] = [];
  for (let round = 0; round < rounds; round += 1) {
    if (round % 2 === 0) {
      nativeResults.push(runChild("native"));
      jsResults.push(runChild("js"));
    } else {
      jsResults.push(runChild("js"));
      nativeResults.push(runChild("native"));
    }
  }
  if (nativeResults.some((result) => result.implementation !== "NativeBackedWordNet")) {
    throw new Error("native WordNet backend did not load");
  }
  if (nativeResults.some((result) => result.checksum !== jsResults[0]!.checksum)) {
    throw new Error("native/TypeScript WordNet checksum mismatch");
  }

  const native = summarize(nativeResults);
  const js = summarize(jsResults);
  const speedup = bootstrapMedianRatio(js.load_ms_samples, native.load_ms_samples);

  console.log(
    JSON.stringify(
      {
        rounds,
        native,
        js,
        load_speedup_native_vs_js: speedup.estimate,
        speedup_ci95: speedup,
        rss_reduction_native_vs_js: 1 - native.rss_delta_bytes_median / js.rss_delta_bytes_median,
      },
      null,
      2,
    ),
  );
}
