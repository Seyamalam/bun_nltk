import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { arch, cpus, platform, release } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { hash, workloads } from "./lifecycle/workloads.mjs";

type Row = { id: string; inputSha256: string; outputSha256: string; samplesSeconds: number[]; repetitions: number };
type Sample = { runtime?: string; results: Row[]; [key: string]: unknown };
const root = fileURLToPath(new URL("../", import.meta.url));
const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) {
  const flag = process.argv[i]!, value = process.argv[i + 1];
  if (!["--runtimes", "--rounds", "--repetitions", "--python", "--output"].includes(flag) || value === undefined) throw new Error(`invalid option ${flag}`);
  args.set(flag, value);
}
const rounds = Number(args.get("--rounds") ?? 3), repetitions = Number(args.get("--repetitions") ?? 10);
if (!Number.isSafeInteger(rounds) || rounds < 3 || rounds > 15 || !Number.isSafeInteger(repetitions) || repetitions < 1 || repetitions > 1000) throw new RangeError("rounds 3..15 and repetitions 1..1000 required");
const names = (args.get("--runtimes") ?? "bun,node,python,chromium,firefox").split(",");
if (names.some((name) => !["bun", "node", "python", "chromium", "firefox", "webkit"].includes(name)) || new Set(names).size !== names.length) throw new Error("supported unique runtimes: bun,node,python,chromium,firefox,webkit");
const pins = JSON.parse(readFileSync(resolve(root, "bench/lifecycle/pins.json"), "utf8")) as Record<string, { inputSha256: string; outputSha256: string }>;
const runtimePins = JSON.parse(readFileSync(resolve(root, "bench/lifecycle/runtime-pins.json"), "utf8")) as Record<string, Record<string, string>>;
const tasks = workloads();
for (const task of tasks) if (await hash(task) !== pins[task.id]?.inputSha256) throw new Error(`workload pin changed: ${task.id}; version the workload, do not silently refresh pins`);

async function worker(command: string[], stdin?: string): Promise<Sample> {
  const start = performance.now();
  return new Promise((resolveResult, reject) => {
    const child = spawn(command[0]!, command.slice(1), { cwd: root, stdio: ["pipe", "pipe", "pipe"], timeout: 60_000 });
    let stdout = "", stderr = "", coldProcessSeconds: number | null = null;
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
      if (coldProcessSeconds === null && stdout.includes('"cold-ready"')) coldProcessSeconds = (performance.now() - start) / 1000;
    });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code !== 0) { reject(new Error(`${command[0]} failed code=${code} signal=${signal}: ${stderr}`)); return; }
      try {
        const result = stdout.trim().split("\n").map((line) => JSON.parse(line) as Sample & { phase: string }).find((row) => row.phase === "result");
        if (!result || coldProcessSeconds === null) throw new Error("missing lifecycle worker phases");
        resolveResult({ ...result, coldProcessSeconds, processWallSeconds: (performance.now() - start) / 1000 });
      } catch (error) { reject(error); }
    });
    child.stdin.end(stdin);
  });
}

async function browserSamples(name: "chromium" | "firefox" | "webkit"): Promise<Sample[]> {
  const temporary = `/tmp/opencode/bun-nltk-lifecycle-${process.pid}-${randomUUID()}`;
  const build = await Bun.build({ entrypoints: [resolve(root, "bench/lifecycle/browser.ts")], outdir: temporary, target: "browser", format: "esm", splitting: true });
  if (!build.success) throw new Error(`browser bundle failed: ${build.logs}`);
  const files = new Map(build.outputs.map((file) => [`/${file.path.slice(temporary.length + 1)}`, file.path]));
  const server = createServer((request, response) => {
    const path = request.url === "/kernel.wasm" ? resolve(root, "native/bun_nltk.wasm") : files.get(request.url ?? "");
    response.setHeader("Cache-Control", "no-store");
    if (request.url === "/") { response.setHeader("Content-Type", "text/html"); response.end("<!doctype html><title>NLP lifecycle bench</title>"); }
    else if (path) { response.setHeader("Content-Type", path.endsWith(".wasm") ? "application/wasm" : "text/javascript"); response.end(readFileSync(path)); }
    else { response.statusCode = 404; response.end(); }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing benchmark server address");
  const origin = `http://127.0.0.1:${address.port}`;
  let browser;
  try {
    const playwright = await import("playwright");
    browser = await playwright[name].launch({ headless: true, timeout: 20_000 });
    const samples: Sample[] = [];
    for (let round = 0; round < rounds; round++) {
      const context = await browser.newContext();
      try {
        const page = await context.newPage();
        page.setDefaultTimeout(60_000);
        await page.goto(origin);
        let timer: ReturnType<typeof setTimeout> | undefined;
        const evaluation = page.evaluate(async ({ origin, rounds, repetitions }) => {
          const started = performance.now();
          const module = await import(`${origin}/browser.js`) as { benchmark: (rounds: number, repetitions: number) => Promise<Sample> };
          const harnessImportSeconds = (performance.now() - started) / 1000;
          const sample = await module.benchmark(rounds, repetitions);
          return { ...sample, harnessImportSeconds, userAgent: navigator.userAgent };
        }, { origin, rounds, repetitions });
        let result: Sample;
        try {
          result = await Promise.race([evaluation, new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`${name} benchmark exceeded 60 seconds`)), 60_000);
          })]);
        } finally { if (timer) clearTimeout(timer); }
        samples.push({ ...result, runtime: browser.version() });
      } finally { await context.close(); }
    }
    return samples;
  } finally {
    try { await browser?.close(); }
    finally {
      await new Promise<void>((done, reject) => server.close((error) => error ? reject(error) : done()));
      for (const file of build.outputs) unlinkSync(file.path);
      rmdirSync(temporary);
    }
  }
}

function validate(sample: Sample, name: string): void {
  if (!runtimePins[name]) throw new Error(`runtime has no comparison pin: ${name}`);
  for (const [key, version] of Object.entries(runtimePins[name]!)) {
    if (sample[key] !== version) throw new Error(`runtime pin mismatch: ${name}.${key} expected ${version}, received ${String(sample[key])}`);
  }
  if (sample.results.length !== tasks.length) throw new Error("incomplete workload results");
  for (const task of tasks) {
    const row = sample.results.find((value) => value.id === task.id), pin = pins[task.id]!;
    if (!row || row.inputSha256 !== pin.inputSha256 || row.outputSha256 !== pin.outputSha256) throw new Error(`pinned output mismatch: ${task.id}`);
    if (row.samplesSeconds.length !== rounds || row.samplesSeconds.some((n) => !Number.isFinite(n) || n < 0) || row.repetitions !== repetitions) throw new Error(`invalid timings: ${task.id}`);
  }
}

const results: Record<string, { status: string; samples: Sample[]; error?: string }> = {};
for (const name of names) {
  const samples: Sample[] = [];
  try {
    if (["chromium", "firefox", "webkit"].includes(name)) samples.push(...await browserSamples(name as "chromium" | "firefox" | "webkit"));
    else {
      for (let round = 0; round < rounds; round++) {
        const command = name === "python"
          ? [args.get("--python") ?? process.env.BUN_NLTK_ORACLE_PYTHON ?? resolve(root, ".venv/bin/python3"), "bench/lifecycle/oracle.py"]
          : [name, "bench/lifecycle/worker.ts", String(rounds), String(repetitions)];
        samples.push(await worker(command, name === "python" ? JSON.stringify({ tasks, rounds, repetitions }) : undefined));
      }
    }
    for (const sample of samples) validate(sample, name);
    for (const sample of samples) {
      for (const row of sample.results) {
        const sorted = [...row.samplesSeconds].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
        const medianSeconds = sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
        Object.assign(row, { medianSeconds, apiCallsPerSecond: medianSeconds > 0 ? repetitions / medianSeconds : null,
          timerResolutionLimited: row.samplesSeconds.some((n) => n === 0) });
      }
    }
    results[name] = { status: "measured-and-pinned", samples };
  } catch (error) {
    results[name] = { status: "failed", samples, error: error instanceof Error ? error.message : String(error) };
  }
}
const git = (args: string[]) => { const result = spawnSync("git", args, { cwd: root, encoding: "utf8" }); if (result.status !== 0) throw new Error("git provenance failed"); return result.stdout.trim(); };
const digest = (path: string) => createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex");
const report = {
  schemaVersion: 1, generatedAt: new Date().toISOString(), complete: Object.values(results).every((row) => row.status === "measured-and-pinned"),
  provenance: { commit: git(["rev-parse", "HEAD"]), worktreeStatus: git(["status", "--porcelain"]),
    host: { platform: platform(), arch: arch(), release: release(), cpu: cpus()[0]?.model, logicalCpus: cpus().length },
    sha256: Object.fromEntries(["bench/lifecycle_matrix.ts", "bench/lifecycle/workloads.mjs", "bench/lifecycle/worker.ts", "bench/lifecycle/browser.ts", "bench/lifecycle/oracle.py", "bench/lifecycle/pins.json", "bench/lifecycle/runtime-pins.json", "native/bun_nltk.wasm"].filter((p) => existsSync(resolve(root, p))).map((p) => [p, digest(p)])) },
  methodology: { rounds, repetitions, requestedRuntimes: names, warmupCalls: 1,
    cold: "Fresh processes or browser contexts, not OS-cache flushes. Process-launch-to-cold-ready includes launcher and imports; browser launch/navigation excluded. coldSeconds includes loader import, WASM bytes, instantiate and first wordpunct call; browser bundle harness import reported separately. Python includes pinned NLTK import and payload read, no WASM.",
    throughput: "Samples time repetitions of complete typed API calls including marshaling/output allocation; hashes excluded. No concurrent benchmark workers. Coarse browser timers can report zero; retain raw zeros, flag timerResolutionLimited and report null throughput for zero medians. Increase repetitions for useful measurements.",
    memory: "Bun/Node process.memoryUsage snapshots and process.resourceUsage peak RSS; Python resource peak RSS (not current RSS); browser performance.memory where exposed (nonstandard), null otherwise; WASM linear memory high-water, not live allocations. No forced GC. No cross-metric memory ratios.",
    parity: "Exact SHA256 of JSON arrays; Python3.14.4/NLTK3.10.3 output pins. No tolerance/speed claims; missing runtime is a failure, not a pass." }, results,
};
const output = resolve(args.get("--output") ?? "artifacts/lifecycle-matrix.json");
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ complete: report.complete, output, runtimes: Object.fromEntries(Object.entries(results).map(([name, result]) => [name, { status: result.status, error: result.error }])) }));
if (!report.complete) process.exitCode = 1;
