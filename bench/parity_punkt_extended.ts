import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sentenceTokenizePunkt, trainPunktModel } from "../index";

type CaseRow = {
  name: string;
  train_text: string;
  text: string;
};

function main() {
  const fixturePath = resolve(import.meta.dir, "..", "test", "fixtures", "punkt_extended_parity_cases.json");
  const rows = JSON.parse(readFileSync(fixturePath, "utf8")) as CaseRow[];

  let passed = 0;
  const details: Array<{ name: string; parity: boolean; js_count: number; py_count: number }> = [];
  for (const row of rows) {
    const model = trainPunktModel(row.train_text);
    const js = sentenceTokenizePunkt(row.text, model);
    const proc = Bun.spawnSync(["python", "bench/python_punkt_baseline.py", "--train-text", row.train_text, "--text", row.text], {
      cwd: resolve(import.meta.dir, ".."),
      stdout: "pipe",
      stderr: "pipe",
    });
    if (proc.exitCode !== 0) {
      throw new Error(`python punkt baseline failed (${row.name}): ${new TextDecoder().decode(proc.stderr)}`);
    }
    const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as { sentences: string[] };
    const parity = JSON.stringify(js) === JSON.stringify(py.sentences);
    if (parity) passed += 1;
    details.push({ name: row.name, parity, js_count: js.length, py_count: py.sentences.length });
  }

  const agreement = rows.length === 0 ? 0 : passed / rows.length;
  const parity = agreement >= 0.875;
  if (!parity) {
    const failed = details.filter((row) => !row.parity).map((row) => row.name);
    throw new Error(`extended punkt parity failed: agreement=${agreement.toFixed(3)} failed=${failed.join(",")}`);
  }

  console.log(
    JSON.stringify(
      {
        parity,
        case_count: rows.length,
        passed,
        agreement,
        details,
      },
      null,
      2,
    ),
  );
}

main();
