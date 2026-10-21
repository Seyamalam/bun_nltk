import { expect, test } from "bun:test";
import { readFileSync, unlinkSync } from "node:fs";
import { hash, workloads } from "../bench/lifecycle/workloads.mjs";
import { WasmNltk } from "../src/wasm.ts";
import { run } from "../bench/lifecycle/workloads.mjs";

test("versioned lifecycle workloads retain oracle-derived input and output pins", async () => {
  const pins = JSON.parse(readFileSync(new URL("../bench/lifecycle/pins.json", import.meta.url), "utf8"));
  const wasm = await WasmNltk.init();
  try {
    for (const task of workloads()) {
      expect(await hash(task)).toBe(pins[task.id].inputSha256);
      expect(await hash(run(wasm, task))).toBe(pins[task.id].outputSha256);
    }
  } finally { wasm.dispose(); }
});

test("local lifecycle runner records cold processes, hashes, memory and bounded throughput", () => {
  const output = `/tmp/opencode/bun-nltk-lifecycle-test-${process.pid}.json`;
  const result = Bun.spawnSync(["bun", "bench/lifecycle_matrix.ts", "--runtimes", "bun,node", "--rounds", "3", "--repetitions", "1", "--output", output], { stdout: "pipe", stderr: "pipe", timeout: 30_000 });
  if (result.exitCode !== 0) throw new Error(new TextDecoder().decode(result.stderr) + new TextDecoder().decode(result.stdout));
  try {
    const report = JSON.parse(readFileSync(output, "utf8"));
    expect(report.complete).toBe(true);
    expect(report.provenance.sha256["native/bun_nltk.wasm"]).toMatch(/^[a-f0-9]{64}$/);
    for (const name of ["bun", "node"]) {
      expect(report.results[name].status).toBe("measured-and-pinned");
      expect(report.results[name].samples.length).toBe(3);
      for (const sample of report.results[name].samples) {
        expect(sample.runtime).toBeString();
        expect(sample.coldProcessSeconds).toBeGreaterThan(0);
        expect(sample.coldProcessSeconds).toBeGreaterThanOrEqual(sample.coldSeconds);
        expect(sample.peakRssBytes).toBeGreaterThan(0);
        expect(sample.memory.afterSteady.rss).toBeGreaterThan(0);
        expect(sample.memory.wasmLinearMemoryBytes).toBeGreaterThan(0);
        for (const row of sample.results) {
          expect(row.samplesSeconds.length).toBe(3);
          expect(row.apiCallsPerSecond).toBeGreaterThan(0);
          expect(row.outputSha256).toMatch(/^[a-f0-9]{64}$/);
        }
      }
    }
  } finally { unlinkSync(output); }
});

test("requested missing oracle is failed evidence rather than a silent pass", () => {
  const output = `/tmp/opencode/bun-nltk-lifecycle-failed-${process.pid}.json`;
  const result = Bun.spawnSync(["bun", "bench/lifecycle_matrix.ts", "--runtimes", "python", "--python", "/nonexistent/bun-nltk-oracle", "--output", output], { stdout: "pipe", stderr: "pipe", timeout: 10_000 });
  expect(result.exitCode).not.toBe(0);
  try {
    const report = JSON.parse(readFileSync(output, "utf8"));
    expect(report.complete).toBe(false);
    expect(report.results.python.status).toBe("failed");
    expect(report.results.python.samples).toEqual([]);
    expect(report.results.python.error).toContain("ENOENT");
  } finally { unlinkSync(output); }
});
