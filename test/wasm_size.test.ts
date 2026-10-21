import { expect, test } from "bun:test";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

test("shipped WASM stays within the browser size threshold", () => {
  const root = resolve(import.meta.dir, "..");
  const thresholds = JSON.parse(
    readFileSync(resolve(root, "bench/browser_wasm_thresholds.json"), "utf8"),
  ) as { size_bytes_max: number };
  const size = statSync(resolve(root, "native/bun_nltk.wasm")).size;
  expect(size).toBeLessThanOrEqual(thresholds.size_bytes_max);
});
