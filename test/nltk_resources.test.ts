import { expect, test } from "bun:test";
import { resolve } from "node:path";

test("explicit NLTK resource provisioning rejects unsafe archives and detects offline drift", () => {
  const root = resolve(import.meta.dir, "..");
  const result = Bun.spawnSync([
    "python3", "-m", "unittest", "discover", "-s", "test", "-p", "test_nltk_resources.py",
  ], { cwd: root, stdout: "pipe", stderr: "pipe", timeout: 30_000 });
  if (result.exitCode !== 0) throw new Error(new TextDecoder().decode(result.stderr));
  expect(new TextDecoder().decode(result.stderr)).toContain("Ran 9 tests");
  expect(result.exitCode).toBe(0);
});
