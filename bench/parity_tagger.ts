import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadPerceptronTaggerModel, posTagPerceptronAscii, WasmNltk } from "../index";

type Fixture = {
  cases: Array<{ name: string; input: string }>;
};

type PythonResult = {
  token_count: number;
  tags: Array<{ token: string; tag: string }>;
  total_seconds: number;
};

function runPython(text: string): PythonResult {
  const proc = Bun.spawnSync(["python", "bench/python_tagger_baseline.py", "--text", text], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });

  if (proc.exitCode !== 0) {
    throw new Error(`python tagger baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  }

  return JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as PythonResult;
}

async function main() {
  const fixturePath = resolve(import.meta.dir, "..", "test", "fixtures", "pos_tagger_cases.json");
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as Fixture;
  const model = loadPerceptronTaggerModel();

  const rows: Array<{ name: string; parity: boolean }> = [];
  const wasm = await WasmNltk.init();
  try {
    for (const item of fixture.cases) {
      const js = posTagPerceptronAscii(item.input, { model }).map((row) => ({ token: row.token, tag: row.tag }));
      const wasmOut = posTagPerceptronAscii(item.input, {
        model,
        wasm,
        useWasm: true,
      }).map((row) => ({ token: row.token, tag: row.tag }));
      const py = runPython(item.input).tags;
      rows.push({
        name: item.name,
        parity: JSON.stringify(js) === JSON.stringify(py) && JSON.stringify(js) === JSON.stringify(wasmOut),
      });
    }

    const parity = rows.every((r) => r.parity);
    if (!parity) {
      const failed = rows.filter((r) => !r.parity).map((r) => r.name);
      throw new Error(`tagger parity failed for: ${failed.join(", ")}`);
    }

    console.log(
      JSON.stringify(
        {
          parity,
          cases: rows.length,
        },
        null,
        2,
      ),
    );
  } finally {
    wasm.dispose();
  }
}

await main();
