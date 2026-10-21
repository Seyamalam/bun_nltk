import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { cpus, release, tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { bootstrapMedianRatio, median } from "../bench/statistics";
import { artifactPath, hostStatus, inspectNativeArtifact, nativeTargets } from "./native-provenance";
import type { NativeTarget } from "./native-provenance";
import { smokeNativeSource } from "./smoke-native-source";

type JsonObject = Record<string, unknown>;

const root = resolve(import.meta.dir, "..");
const args = process.argv.slice(2);
const booleanOptions = new Set(["--status", "--smoke"]);
const valueOptions = new Set(["--target", "--rounds", "--output", "--library", "--provenance"]);
const seen = new Set<string>();
for (let i = 0; i < args.length; i++) {
  const name = args[i]!;
  if (seen.has(name) || (!booleanOptions.has(name) && !valueOptions.has(name))) throw new Error(`Unknown or duplicate native-host option: ${name}`);
  seen.add(name);
  if (valueOptions.has(name) && (!args[++i] || args[i]!.startsWith("--"))) throw new Error(`Missing value for ${name}`);
}

function argument(name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

const requestedTarget = argument("--target") ?? `${process.platform}-${process.arch}`;
if (!nativeTargets.includes(requestedTarget as NativeTarget)) throw new Error(`Unsupported native host: ${requestedTarget}`);
const requested = requestedTarget as NativeTarget;
const gate = hostStatus(requested, process.platform, process.arch);
if (args.includes("--status") || gate.status === "blocked") {
  console.log(JSON.stringify({ ok: false, target: requested, host_validation: gate, artifact: inspectNativeArtifact(root, requested) }, null, 2));
  process.exit(args.includes("--status") ? 0 : 1);
} else if (args.includes("--smoke")) {
  const library = resolve(argument("--library") ?? artifactPath(root, requested));
  const artifact = inspectNativeArtifact(root, requested, library, argument("--provenance"));
  if (artifact.status !== "fresh") throw new Error(`Source-native smoke requires fresh provenance: ${artifact.status}: ${artifact.reason}`);
  const report = { ...(await smokeNativeSource(library, requested)), artifact };
  const output = argument("--output");
  if (output) {
    mkdirSync(dirname(resolve(output)), { recursive: true });
    writeFileSync(resolve(output), `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
if (args.includes("--library") || process.env.BUN_NLTK_NATIVE_LIB) throw new Error("Candidate overrides require --smoke; full validation must load the actual packaged prebuilt");

const rounds = Number(argument("--rounds") ?? "7");
if (!Number.isInteger(rounds) || !Number.isFinite(rounds) || rounds < 5) {
  throw new Error("--rounds must be an integer of at least 5");
}

const target = `${process.platform}-${process.arch}`;
const supportedTargets = new Set(["darwin-arm64", "linux-x64", "win32-x64"]);
if (!supportedTargets.has(target)) {
  throw new Error(
    `No prebuilt native library is available for ${target}. Supported hosts: darwin-arm64, linux-x64, win32-x64.`,
  );
}

const extension = process.platform === "win32" ? "dll" : process.platform === "darwin" ? "dylib" : "so";
const expectedNativePath = resolve(root, "native", "prebuilt", target, `bun_nltk.${extension}`);
const artifactFreshness = inspectNativeArtifact(root, requested, expectedNativePath, argument("--provenance"));
if (artifactFreshness.status !== "fresh") {
  throw new Error(`Packaged native artifact is ${artifactFreshness.status}: ${artifactFreshness.reason}. Run scripts/native-freshness-check.ts and stage a genuine-host refresh; current HEAD alone is not binary provenance.`);
}
const expectedPackageArtifacts = [
  resolve(root, "native", "prebuilt", "darwin-arm64", "bun_nltk.dylib"),
  resolve(root, "native", "prebuilt", "linux-x64", "bun_nltk.so"),
  resolve(root, "native", "prebuilt", "win32-x64", "bun_nltk.dll"),
  resolve(root, "native", "bun_nltk.wasm"),
];

for (const path of expectedPackageArtifacts) {
  if (!existsSync(path)) {
    throw new Error(
      `Missing release artifact: ${relative(root, path)}. Pull the complete validation commit before running this script.`,
    );
  }
}

function runInherited(label: string, command: string[]): void {
  console.log(`\n[native host] ${label}`);
  const proc = Bun.spawnSync(command, { cwd: root, stdout: "inherit", stderr: "inherit" });
  if (proc.exitCode !== 0) throw new Error(`${label} failed with exit code ${proc.exitCode}`);
}

function runText(label: string, command: string[]): string {
  console.log(`\n[native host] ${label}`);
  const proc = Bun.spawnSync(command, { cwd: root, stdout: "pipe", stderr: "pipe" });
  const stdout = new TextDecoder().decode(proc.stdout).trim();
  const stderr = new TextDecoder().decode(proc.stderr).trim();
  if (proc.exitCode !== 0) {
    throw new Error(`${label} failed (${proc.exitCode})\nstdout:\n${stdout}\nstderr:\n${stderr}`);
  }
  return stdout;
}

function runJson(label: string, command: string[]): JsonObject {
  return JSON.parse(runText(label, command)) as JsonObject;
}

function commandVersion(command: string[]): string {
  return runText(`${command[0]} version`, command).split(/\r?\n/, 1)[0]!.trim();
}

function timeMs(operation: () => number): { elapsed: number; result: number } {
  const started = performance.now();
  const result = operation();
  return { elapsed: performance.now() - started, result };
}

console.log(`Native host validation for ${target}`);

const nativeApi = await import("../index");
if (resolve(nativeApi.nativeLibraryPath()) !== expectedNativePath) {
  throw new Error(`Loaded an unexpected native library: ${nativeApi.nativeLibraryPath()}`);
}

const smokeText = "Dr. Smith built three native models. They run on the host operating system.";
const smokeNativeCount = nativeApi.countTokensAscii(smokeText);
const smokeJsCount = nativeApi.countTokensAsciiJs(smokeText);
if (smokeNativeCount !== smokeJsCount || smokeNativeCount !== 13) {
  throw new Error(`Native token smoke mismatch: native=${smokeNativeCount}, TypeScript=${smokeJsCount}`);
}

runInherited("focused native correctness tests", [
  "bun",
  "test",
  "--timeout",
  "30000",
  "test/native.test.ts",
  "test/linear_models.test.ts",
  "test/cluster_native.test.ts",
]);

const tokenText = "alpha beta gamma delta epsilon zeta eta theta 12345\n".repeat(25_000);
const nativeTokenSamples: number[] = [];
const jsTokenSamples: number[] = [];
nativeApi.countTokensAscii(tokenText);
nativeApi.countTokensAsciiJs(tokenText);
for (let round = 0; round < rounds; round += 1) {
  const operations =
    round % 2 === 0
      ? (["native", "typescript"] as const)
      : (["typescript", "native"] as const);
  for (const implementation of operations) {
    const measurement = timeMs(() =>
      implementation === "native"
        ? nativeApi.countTokensAscii(tokenText)
        : nativeApi.countTokensAsciiJs(tokenText),
    );
    if (measurement.result !== 225_000) {
      throw new Error(`${implementation} token benchmark returned ${measurement.result}, expected 225000`);
    }
    (implementation === "native" ? nativeTokenSamples : jsTokenSamples).push(measurement.elapsed);
  }
}
const tokenSpeedup = bootstrapMedianRatio(jsTokenSamples, nativeTokenSamples, { seed: 0x5eed2030 });

const linear = runJson("linear-model native versus TypeScript benchmark", [
  "bun",
  "run",
  "bench/compare_linear_training_native_vs_js.ts",
  "6000",
  "1200",
  String(rounds),
]);
const hmm = runJson("HMM native versus TypeScript benchmark", [
  "bun",
  "run",
  "bench/compare_hmm_native_vs_js.ts",
  "240",
  "160",
  String(rounds),
]);
const kmeans = runJson("K-means native versus TypeScript benchmark", [
  "bun",
  "run",
  "bench/compare_kmeans_native_vs_js.ts",
  "20000",
  "16",
  "8",
  String(rounds),
]);

const packageJson = (await Bun.file(resolve(root, "package.json")).json()) as {
  name: string;
  version: string;
};
const packageTemp = mkdtempSync(join(tmpdir(), "bun-nltk-host-"));
let packageSmoke: JsonObject;
try {
  runText("pack release tarball", ["bun", "pm", "pack", "--ignore-scripts", "--destination", packageTemp]);
  const tarball = resolve(packageTemp, `${packageJson.name}-${packageJson.version}.tgz`);
  if (!existsSync(tarball)) throw new Error(`Expected package tarball was not created: ${tarball}`);
  packageSmoke = runJson("install and execute the tarball on this host", [
    "bun",
    "run",
    "scripts/npm-smoke-test.ts",
    tarball,
  ]);
  if (packageSmoke.ok !== true) throw new Error("Installed tarball smoke did not report ok: true");
} finally {
  rmSync(packageTemp, { recursive: true, force: true });
}

const revision = runText("git revision", ["git", "rev-parse", "HEAD"]);
const finalFreshness = inspectNativeArtifact(root, requested, expectedNativePath, argument("--provenance"));
if (finalFreshness.status !== "fresh" || finalFreshness.sha256 !== artifactFreshness.sha256) throw new Error("Native artifact or sources changed during host validation");
const outputPath = resolve(
  argument("--output") ?? resolve(root, "artifacts", `native-host-${target}.json`),
);
mkdirSync(dirname(outputPath), { recursive: true });

const report = {
  schema_version: 2,
  generated_at: new Date().toISOString(),
  ok: true,
  validation_revision: revision,
  source_revision: artifactFreshness.source_revision,
  artifact_freshness: artifactFreshness,
  environment: {
    platform: process.platform,
    architecture: process.arch,
    os_release: release(),
    cpu: cpus()[0]?.model ?? "unknown",
    bun: commandVersion(["bun", "--version"]),
    rounds_per_implementation: rounds,
  },
  native_artifact: {
    target,
    path: relative(root, expectedNativePath),
    bytes: statSync(expectedNativePath).size,
  },
  checks: {
    native_library_loaded: true,
    focused_native_tests_passed: true,
    packaged_tarball_installed_and_executed: packageSmoke.ok === true,
    native_and_typescript_outputs_matched: true,
  },
  measurements: {
    token_count: {
      bytes_per_round: Buffer.byteLength(tokenText),
      tokens_per_round: 225_000,
      native_ms_median: median(nativeTokenSamples),
      typescript_ms_median: median(jsTokenSamples),
      native_ms_samples: nativeTokenSamples,
      typescript_ms_samples: jsTokenSamples,
      speedup_native_vs_typescript: tokenSpeedup.estimate,
      speedup_ci95: tokenSpeedup,
    },
    linear_text_training: linear,
    hmm_viterbi_decoding: hmm,
    kmeans_euclidean: kmeans,
  },
};

writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`\nNative host validation passed.`);
console.log(`Send this report file back to the maintainer: ${outputPath}`);
