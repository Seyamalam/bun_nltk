import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sentenceTokenizeSubset } from "../index";

type Fixture = {
  cases: Array<{ name: string; input: string; expected: string[] }>;
};

type PythonResult = {
  sentence_count: number;
  sentences: string[];
  total_seconds: number;
};

function runPython(text: string): PythonResult {
  const proc = Bun.spawnSync(["python", "bench/python_sentence_baseline.py", "--text", text], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });

  if (proc.exitCode !== 0) {
    throw new Error(`python sentence baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  }

  return JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as PythonResult;
}

function main() {
  const fixturePath = resolve(import.meta.dir, "..", "test", "fixtures", "sentence_tokenizer_cases.json");
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as Fixture;

  const rows: Array<{ name: string; parity: boolean }> = [];

  for (const item of fixture.cases) {
    const js = sentenceTokenizeSubset(item.input);
    const py = runPython(item.input).sentences;
    rows.push({ name: item.name, parity: JSON.stringify(js) === JSON.stringify(py) });
  }

  const parity = rows.every((r) => r.parity);
  if (!parity) {
    const failed = rows.filter((r) => !r.parity).map((r) => r.name);
    throw new Error(`sentence parity failed for: ${failed.join(", ")}`);
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
}

main();
