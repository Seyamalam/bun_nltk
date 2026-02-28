import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sentenceTokenizePunkt, trainPunktModel } from "../index";

type CaseRow = {
  name: string;
  train_text: string;
  text: string;
};

test(
  "extended punkt parity corpus keeps high agreement with python baseline",
  () => {
    const fixturePath = resolve(import.meta.dir, "fixtures", "punkt_extended_parity_cases.json");
    const rows = JSON.parse(readFileSync(fixturePath, "utf8")) as CaseRow[];
    let passed = 0;

    for (const row of rows) {
      const model = trainPunktModel(row.train_text);
      const js = sentenceTokenizePunkt(row.text, model);
      const proc = Bun.spawnSync(["python", "bench/python_punkt_baseline.py", "--train-text", row.train_text, "--text", row.text], {
        cwd: resolve(import.meta.dir, ".."),
        stdout: "pipe",
        stderr: "pipe",
      });
      if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
      const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as { sentences: string[] };
      if (JSON.stringify(js) === JSON.stringify(py.sentences)) passed += 1;
    }

    const agreement = rows.length === 0 ? 0 : passed / rows.length;
    expect(agreement).toBeGreaterThanOrEqual(0.875);
  },
  30_000,
);
