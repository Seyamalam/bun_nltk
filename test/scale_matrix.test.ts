import { expect, test } from "bun:test";
import { existsSync, readFileSync, unlinkSync } from "node:fs";

test("scale benchmark verifies cold-process output and memory at a tiny input", () => {
  if (process.platform !== "linux" || !existsSync("/usr/bin/time")) return;
  const output = `/tmp/opencode/nltk-scale-smoke-${process.pid}.json`;
  const result = Bun.spawnSync(["bun", "bench/scale_matrix.ts"], {
    env: { ...process.env, BUN_NLTK_BENCH_SIZES: "1024", BUN_NLTK_BENCH_VOCABULARIES: undefined, BUN_NLTK_BENCH_ROUNDS: "3", BUN_NLTK_BENCH_OUTPUT: output },
    stdout: "pipe", stderr: "pipe", timeout: 30_000,
  });
  if (result.exitCode !== 0) throw new Error(new TextDecoder().decode(result.stderr));
  try {
    expect(JSON.parse(new TextDecoder().decode(result.stdout)).parity).toBe(true);
    const report = JSON.parse(readFileSync(output, "utf8"));
    expect(report.schemaVersion).toBe(2);
    expect(report.provenance.commit).toMatch(/^[a-f0-9]{40}$/);
    expect(report.provenance.sha256["bench/scale_matrix.ts"]).toMatch(/^[a-f0-9]{64}$/);
    expect(report.rows[0].datasetKind).toBe("repeated-1MiB-block");
    expect(report.rows[0].vocabularySize).toBe(128);
    for (const group of Object.values(report.rows[0].samples) as Array<Array<{ peakRssBytes: number }>>) {
      expect(group.length).toBe(3);
      expect(group.every((sample) => sample.peakRssBytes > 0)).toBe(true);
    }
  } finally { unlinkSync(output); }
});

test("scale benchmark supports fresh seeded vocabulary and rejects mismatched settings", () => {
  if (process.platform !== "linux" || !existsSync("/usr/bin/time")) return;
  const output = `/tmp/opencode/nltk-vocabulary-smoke-${process.pid}.json`;
  const env = { ...process.env, BUN_NLTK_BENCH_SIZES: "8192", BUN_NLTK_BENCH_VOCABULARIES: "4", BUN_NLTK_BENCH_ROUNDS: "3", BUN_NLTK_BENCH_OUTPUT: output };
  const result = Bun.spawnSync(["bun", "bench/scale_matrix.ts"], { env, stdout: "pipe", stderr: "pipe", timeout: 30_000 });
  if (result.exitCode !== 0) throw new Error(new TextDecoder().decode(result.stderr));
  try {
    const report = JSON.parse(readFileSync(output, "utf8"));
    expect(report.rows[0].datasetKind).toBe("fresh-seeded-word-sequence");
    expect(report.rows[0].vocabularySize).toBe(4);
    // Exact byte sizes may end with one truncated word outside the word pool.
    expect(report.rows[0].samples.python[0].uniqueTokens).toBe(5);
    expect(report.rows[0].parity).toBe(true);
  } finally { unlinkSync(output); }
  for (const vocabulary of ["4,8", "0", "1000001", "NaN"]) {
    const invalid = Bun.spawnSync(["bun", "bench/scale_matrix.ts"], { env: { ...env, BUN_NLTK_BENCH_VOCABULARIES: vocabulary }, stdout: "pipe", stderr: "pipe" });
    expect(invalid.exitCode).not.toBe(0);
    expect(existsSync(output)).toBe(false);
  }
});
