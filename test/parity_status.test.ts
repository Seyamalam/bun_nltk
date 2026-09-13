import { statusFromChecks } from "../scripts/parity-tracker";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { classifyParity, summarizeParity, missingFixtureResult } from "../scripts/parity-status";
test("skips and missing correctness evidence cannot produce passing parity", () => {
  expect(classifyParity(0, { parity: true, skipped: true }).status).toBe("skipped");
  expect(classifyParity(1, { parity: true }).status).toBe("failed");
  expect(classifyParity(0, { speedup: 100 }).status).toBe("failed");
  expect(classifyParity(0, { parity: false, speedup: 100 }).status).toBe("failed");
  expect(classifyParity(0, { parity: true, speedup: 0.01 }).status).toBe("passed");
});
test("strict gate distinguishes unsupported scope and blocks skipped required groups", () => {
  const results = {
    exact: classifyParity(0, { parity: true }),
    imported: { status: "skipped" as const, required: true },
    java: { status: "unsupported" as const, required: false },
  };
  const summary = summarizeParity(results);
  expect(summary.ok).toBe(false);
  expect(summary.counts).toEqual({ passed: 1, failed: 0, skipped: 1, unsupported: 1 });
  expect(summary.checks.imported).toBe(false);
  expect(summarizeParity({ exact: results.exact, java: results.java }).ok).toBe(true);
});

test("missing imported files are explicitly skipped, including a partially present fixture set", () => {
  const dir = mkdtempSync(join(tmpdir(), "nltk-fixture-gate-"));
  try {
    const files = [join(dir, "parser.json"), join(dir, "classifier.json")];
    writeFileSync(files[0]!, "{}");
    const missing = missingFixtureResult(files)!;
    expect(missing.status).toBe("skipped");
    expect(missing.reason).toContain("classifier.json");
    expect(summarizeParity({ imported: missing }).ok).toBe(false);
    writeFileSync(files[1]!, "{}");
    expect(missingFixtureResult(files)).toBeNull();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("tracker correctness status is unchanged by benchmark speed", () => {
  const def = {module:"sample",feature:"sample",requiredParity:["sample"],requiredSpeedups:["sample_x"],tests:[],benches:[]};
  expect(statusFromChecks(def,{sample:true},{sample_x:.01}).status).toBe("implemented");
  expect(statusFromChecks(def,{sample:true},{}).status).toBe("implemented");
  expect(statusFromChecks(def,{sample:false},{sample_x:100}).status).toBe("partial");
  expect(statusFromChecks(def,{}, {sample_x:100}).status).toBe("missing");
});
