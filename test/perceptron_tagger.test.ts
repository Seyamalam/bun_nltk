import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadPerceptronTaggerModel, posTagPerceptronAscii, WasmNltk } from "../index";

const fixture = JSON.parse(
  readFileSync(resolve(import.meta.dir, "fixtures", "pos_tagger_cases.json"), "utf8"),
) as {
  cases: Array<{ name: string; input: string }>;
};

type PythonResult = {
  token_count: number;
  tags: Array<{ token: string; tag: string }>;
  total_seconds: number;
};

function runPython(text: string): PythonResult {
  const proc = Bun.spawnSync(
    ["python", "bench/python_tagger_baseline.py", "--text", text, "--model", "models/perceptron_tagger_ascii.json"],
    {
      cwd: resolve(import.meta.dir, ".."),
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  if (proc.exitCode !== 0) {
    throw new Error(`python perceptron baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  }
  return JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as PythonResult;
}

test("perceptron model loads", () => {
  const model = loadPerceptronTaggerModel();
  expect(model.featureCount).toBeGreaterThan(100);
  expect(model.tagCount).toBeGreaterThan(5);
  expect(model.weights.length).toBe(model.featureCount * model.tagCount);
});

test("perceptron JS/WASM/Python parity on fixture cases", async () => {
  const model = loadPerceptronTaggerModel();
  const wasm = await WasmNltk.init();
  try {
    for (const item of fixture.cases) {
      const js = posTagPerceptronAscii(item.input, { model }).map((row) => ({ token: row.token, tag: row.tag }));
      const wasmOut = posTagPerceptronAscii(item.input, { model, wasm, useWasm: true }).map((row) => ({
        token: row.token,
        tag: row.tag,
      }));
      const py = runPython(item.input).tags;
      expect(js).toEqual(py);
      expect(wasmOut).toEqual(py);
    }
  } finally {
    wasm.dispose();
  }
});
