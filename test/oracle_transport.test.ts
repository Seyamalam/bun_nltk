import { expect, test } from "bun:test";
import { resolve } from "node:path";

test("Python oracle receives payloads larger than Linux's single-argument limit", () => {
  const payload = JSON.stringify({ text: "a".repeat(256 * 1024) });
  const proc = Bun.spawnSync([
    "python3", "-c", "import json,sys; print(len(json.load(sys.stdin)['text']))",
  ], {
    cwd: resolve(import.meta.dir, ".."),
    stdin: new TextEncoder().encode(payload),
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(proc.exitCode).toBe(0);
  expect(Number(new TextDecoder().decode(proc.stdout).trim())).toBe(256 * 1024);
});
