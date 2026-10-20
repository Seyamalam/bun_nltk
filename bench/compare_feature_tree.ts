import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { arch, cpus, platform, release, totalmem } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { FeatureSet, LabeledFeatureset } from "../src/feature_types.ts";

type Data = {
  train: LabeledFeatureset[]; probes: FeatureSet[];
  options: { binary: boolean; entropyCutoff: number; depthCutoff: number; supportCutoff: number };
};
type Result = {
  runtime: string; bunVersion?: string; nltk?: string; initSeconds?: number; linearMemoryBytes?: number;
  trainSeconds: number; predictSeconds: number; predictionCount: number; predictionsSha256: string; labels: string[];
};
type Sample = Result & { peakRssBytes: number; wallSeconds: number };
const root = fileURLToPath(new URL("../", import.meta.url));

async function worker(path: string): Promise<void> {
  const data = JSON.parse(readFileSync(path, "utf8")) as Data;
  const { WasmNltk } = await import("../dist/portable/wasm.js");
  const { RustDecisionTreeClassifier } = await import("../dist/portable/feature_tree.js");
  let started = performance.now();
  const runtime = await WasmNltk.init();
  const initSeconds = (performance.now() - started) / 1000;
  started = performance.now();
  const model = RustDecisionTreeClassifier.train(runtime, data.train, data.options);
  const trainSeconds = (performance.now() - started) / 1000;
  try {
    started = performance.now();
    const predictions = model.classifyMany(data.probes);
    const predictSeconds = (performance.now() - started) / 1000;
    console.log(JSON.stringify({ runtime: process.version, ...(typeof Bun !== "undefined" ? { bunVersion: Bun.version } : {}),
      initSeconds, trainSeconds, predictSeconds, linearMemoryBytes: runtime.memoryBytes,
      predictionCount: predictions.length, predictionsSha256: createHash("sha256").update(predictions.join("\n")).digest("hex"), labels: model.labels().sort(),
    } satisfies Result));
  } finally { model.dispose(); runtime.dispose(); }
}

function dataset(size: number, binary: boolean): Data {
  const row = (index: number): LabeledFeatureset => {
    if (binary) {
      const position = index % 60;
      const x = position >= 30, y = position >= 20 && position < 30 || position >= 45;
      return [{ x, y, "noise 😀": Math.floor(index / 60) % 7 }, x ? "C" : y ? "B" : "A"];
    }
    const label = index % 3;
    const features: FeatureSet = { "CASE 😀": ["Red", "red", "a b"][label]! };
    // Balanced irrelevant features are shared by each consecutive label triple.
    for (let i = 0; i < 7; i++) features[`noise ${i}`] = (Math.floor(index / 3) + i) % 7;
    return [features, `L${label}`];
  };
  return { train: Array.from({ length: size }, (_, i) => row(i)), probes: Array.from({ length: Math.max(64, Math.floor(size / 4)) }, (_, i) => row(i + size)[0]),
    options: { binary, entropyCutoff: 0.05, depthCutoff: 100, supportCutoff: 10 } };
}

function git(args: string[]): string {
  const result = Bun.spawnSync(["git", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error("cannot capture benchmark revision");
  return new TextDecoder().decode(result.stdout).trim();
}
const sha256 = (path: string) => createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex");
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;

async function main(): Promise<void> {
  const sizes = (process.env.BUN_NLTK_TREE_SIZES ?? "60,2400,12000").split(",").map(Number);
  const rounds = Number(process.env.BUN_NLTK_TREE_ROUNDS ?? 3);
  if (sizes.some((size) => !Number.isSafeInteger(size) || size < 60 || size > 1_000_000 || size % 60 !== 0)
    || !Number.isSafeInteger(rounds) || rounds < 3 || rounds % 2 === 0) throw new RangeError("sizes must be multiples of 60 up to one million; odd rounds >=3 required");
  const temporary = mkdtempSync("/tmp/opencode/bun-nltk-feature-tree-");
  const provenance = {
    startedAt: new Date().toISOString(), commit: git(["rev-parse", "HEAD"]), worktreeStatus: git(["status", "--porcelain"]),
    machine: { platform: platform(), release: release(), arch: arch(), cpu: cpus()[0]?.model, cpuCount: cpus().length, totalMemoryBytes: totalmem() },
    sha256: Object.fromEntries(["bench/compare_feature_tree.ts", "bench/python_feature_tree.py", "rust/src/categorical_tree.rs", "native/bun_nltk.wasm", "dist/portable/feature_tree.js", "dist/portable/wasm.js"].map((path) => [path, sha256(path)])),
  };
  const rows = [];
  function measure(command: string[], name: string): Sample {
    const rss = resolve(temporary, `${name}.rss`);
    const started = performance.now();
    const result = Bun.spawnSync(["/usr/bin/time", "-f", "%M", "-o", rss, ...command], { cwd: root, stdout: "pipe", stderr: "pipe", timeout: 120_000 });
    try {
      if (result.exitCode !== 0) throw new Error(new TextDecoder().decode(result.stderr));
      const sample = JSON.parse(new TextDecoder().decode(result.stdout)) as Result;
      const peakRssBytes = Number(readFileSync(rss, "utf8").trim()) * 1024;
      if (![sample.trainSeconds, sample.predictSeconds, peakRssBytes].every(Number.isFinite) || peakRssBytes <= 0) throw new Error("invalid benchmark sample");
      return { ...sample, peakRssBytes, wallSeconds: (performance.now() - started) / 1000 };
    } finally { unlinkSync(rss); }
  }
  for (const size of sizes) for (const binary of [false, true]) {
    const data = dataset(size, binary);
    const path = resolve(temporary, `${size}-${binary}.json`);
    writeFileSync(path, JSON.stringify(data));
    try {
      const samples: Record<string, Sample[]> = { python: [], bunWasm: [], nodeWasm: [] };
      for (let round = 0; round < rounds; round++) {
        samples.python!.push(measure(["python3", "bench/python_feature_tree.py", path], "python"));
        samples.bunWasm!.push(measure(["bun", "bench/compare_feature_tree.ts", "--worker", path], "bun"));
        samples.nodeWasm!.push(measure(["node", "bench/compare_feature_tree.ts", "--worker", path], "node"));
      }
      const oracle = samples.python![0]!;
      for (const sample of Object.values(samples).flat()) {
        if (sample.predictionCount !== oracle.predictionCount || sample.predictionsSha256 !== oracle.predictionsSha256 || JSON.stringify(sample.labels) !== JSON.stringify(oracle.labels)) {
          throw new Error(`prediction/label parity failed at size=${size}, binary=${binary}`);
        }
      }
      const summary = Object.fromEntries(Object.entries(samples).map(([name, group]) => [name, {
        medianTrainSeconds: median(group.map((sample) => sample.trainSeconds)), medianPredictSeconds: median(group.map((sample) => sample.predictSeconds)),
        medianWallSeconds: median(group.map((sample) => sample.wallSeconds)), peakRssBytes: Math.max(...group.map((sample) => sample.peakRssBytes)),
        trainSpeedup: median(samples.python!.map((sample) => sample.trainSeconds)) / median(group.map((sample) => sample.trainSeconds)),
      }]));
      rows.push({ trainingRows: size, predictionRows: data.probes.length, datasetBytes: readFileSync(path).length, datasetSha256: sha256(path),
        profile: binary ? "binary-refinement" : "categorical-stump", options: data.options, parity: true, summary, samples });
      console.error(JSON.stringify({ size, binary, parity: true, summary }));
    } finally { unlinkSync(path); }
  }
  const output = resolve(root, process.env.BUN_NLTK_TREE_OUTPUT ?? "artifacts/feature-tree-benchmark.json");
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), provenance, rounds, rows,
    scope: "Lossless RustDecisionTreeClassifier WASM versus unmodified NLTK 3.10.3 feature trees; identical JSON training/probe sets and matched prediction digests/label sets.",
    limitations: ["Synthetic balanced low-cardinality features; not all NLP tasks, tree shapes or adversarial inputs.", "Prediction parity does not imply identical tied split structures; Python retains its randomized set ordering.", "Training/prediction timings exclude JSON reads/imports/WASM initialization; Rust training includes feature marshaling. Init timings are reported separately.", "Peak RSS and wall time include cold runtime/imports, JSON data and output hashing. WASM linear memory is not total memory.", "No browser timing or native tree ABI is measured; legacy text-tree benchmarks are unrelated."],
  }, null, 2) + "\n");
  console.log(JSON.stringify({ output, cases: rows.length, parity: true }));
}

if (process.argv[2] === "--worker") await worker(process.argv[3]!);
else await main();
