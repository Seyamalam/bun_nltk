import { statSync, writeFileSync } from "node:fs";
import { cpus, platform, release } from "node:os";
import { resolve } from "node:path";

type JsonObject = Record<string, unknown>;

const root = resolve(import.meta.dir, "..");
const rounds = Math.max(5, Number(process.argv[2] ?? "15"));
const outputPath = resolve(
  process.argv[3] ?? resolve(root, "paper", "bench", "native_migration_results.json"),
);

function run(command: string[]): string {
  const proc = Bun.spawnSync(command, { cwd: root, stdout: "pipe", stderr: "pipe" });
  const stdout = new TextDecoder().decode(proc.stdout).trim();
  const stderr = new TextDecoder().decode(proc.stderr).trim();
  if (proc.exitCode !== 0) {
    throw new Error(`${command.join(" ")} failed (${proc.exitCode})\nstdout:\n${stdout}\nstderr:\n${stderr}`);
  }
  return stdout;
}

function runJson(command: string[]): JsonObject {
  return JSON.parse(run(command)) as JsonObject;
}

function version(command: string[]): string {
  return run(command).split(/\r?\n/, 1)[0]!.trim();
}

const linear = runJson([
  "bun",
  "run",
  "bench/compare_linear_training_native_vs_js.ts",
  "6000",
  "1200",
  String(rounds),
]);
const hmm = runJson([
  "bun",
  "run",
  "bench/compare_hmm_native_vs_js.ts",
  "240",
  "160",
  String(rounds),
]);
const kmeans = runJson([
  "bun",
  "run",
  "bench/compare_kmeans_native_vs_js.ts",
  "20000",
  "16",
  "8",
  String(rounds),
]);
const wordnetLoad = runJson([
  "bun",
  "run",
  "bench/compare_wordnet_load.ts",
  String(rounds),
]);
const wordnetBatch = runJson([
  "bun",
  "run",
  "bench/compare_wordnet_native_vs_js.ts",
  "400",
  String(rounds),
]);

const pack = runJson(["npm", "pack", "--dry-run", "--json"]);
const packRecord = Array.isArray(pack) ? (pack[0] as JsonObject) : pack;
const artifactPaths = {
  darwin_arm64_dylib: "native/prebuilt/darwin-arm64/bun_nltk.dylib",
  linux_x64_so: "native/prebuilt/linux-x64/bun_nltk.so",
  windows_x64_dll: "native/prebuilt/win32-x64/bun_nltk.dll",
  wasm: "native/bun_nltk.wasm",
};
const artifactsBytes = Object.fromEntries(
  Object.entries(artifactPaths).map(([name, path]) => [name, statSync(resolve(root, path)).size]),
) as Record<string, number>;
artifactsBytes.combined = Object.values(artifactsBytes).reduce((sum, bytes) => sum + bytes, 0);

const report = {
  schema_version: 2,
  generated_at: new Date().toISOString(),
  environment: {
    machine: cpus()[0]?.model ?? "unknown",
    platform: `${platform()} ${process.arch}`,
    os_release: release(),
    bun: version(["bun", "--version"]),
    rustc: version(["rustc", "--version"]),
    rounds_per_implementation: rounds,
  },
  statistics: {
    interval: "95% percentile bootstrap confidence interval of the median speedup ratio",
    bootstrap_iterations: 10_000,
    deterministic_seeded_resampling: true,
    raw_samples_included: true,
  },
  measurements: {
    linear_text_training: linear,
    hmm_viterbi_decoding: hmm,
    kmeans_euclidean: kmeans,
    wordnet_load: wordnetLoad,
    wordnet_batch_lookup: wordnetBatch,
  },
  artifacts_bytes: artifactsBytes,
  package: {
    files: Array.isArray(packRecord.files) ? packRecord.files.length : null,
    packed_bytes: packRecord.size ?? null,
    unpacked_bytes: packRecord.unpackedSize ?? null,
  },
};

writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, output: outputPath, rounds }, null, 2));
