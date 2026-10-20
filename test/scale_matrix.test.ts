import { expect, test } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";

test("scale benchmark verifies cold-process output and memory at a tiny input", () => {
  if (process.platform !== "linux" || !existsSync("/usr/bin/time")) return;
  const output = `/tmp/opencode/nltk-scale-smoke-${process.pid}.json`;
  const result = Bun.spawnSync(["bun", "bench/scale_matrix.ts"], {
    env: { ...process.env, BUN_NLTK_BENCH_SIZES: "1024", BUN_NLTK_BENCH_ROUNDS: "3", BUN_NLTK_BENCH_OUTPUT: output },
    stdout: "pipe", stderr: "pipe", timeout: 30_000,
  });
  if (result.exitCode !== 0) throw new Error(new TextDecoder().decode(result.stderr));
  expect(JSON.parse(new TextDecoder().decode(result.stdout)).parity).toBe(true);
  unlinkSync(output);
});
