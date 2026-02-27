import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { tokenizeAsciiNative } from "../index";

test("ascii tokenizer parity with python regex baseline", () => {
  const text = "Dr. Smith's lab tested 42 samples, and U.S. teams re-tested them!";
  const js = tokenizeAsciiNative(text);
  const proc = Bun.spawnSync(["python", "bench/python_tokenizer_baseline.py", "--text", text], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(proc.stderr));
  }
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as { tokens: string[] };
  expect(js).toEqual(py.tokens);
});

