import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { packageFiles } from "../scripts/package-size-check.ts";

test("package gate counts exact file bytes rather than Bun's rounded KB display", () => {
  const root = mkdtempSync("/tmp/opencode/bun-nltk-package-size-");
  try {
    writeFileSync(join(root, "fixture with spaces.bin"), new Uint8Array(1234));
    expect(packageFiles("packed 1.2KB fixture with spaces.bin\n", root)).toEqual([
      { path: "fixture with spaces.bin", bytes: 1234 },
    ]);
    expect(() => packageFiles("packed 1KB ../escape\n", root)).toThrow(/unsafe/);
    expect(() => packageFiles("packed 1KB fixture with spaces.bin\npacked 1KB fixture with spaces.bin", root)).toThrow(/duplicate/);
    expect(() => packageFiles("no selected files", root)).toThrow(/no package files/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
