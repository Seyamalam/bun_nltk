import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import manifest from "../models/nltk-models.manifest.json";
import { SentimentIntensityAnalyzer } from "../src/sentiment";

test("NLTK model exports retain their published checksums", () => {
  for (const [path, metadata] of Object.entries(manifest.files)) {
    const content = readFileSync(new URL(`../${path}`, import.meta.url));
    expect(content.length).toBe(metadata.bytes);
    expect(createHash("sha256").update(content).digest("hex")).toBe(metadata.sha256);
  }
});
test("VADER, tokenizers, trained Punkt parameters, and NE labels match NLTK fixtures exactly", () => {
  const proc = Bun.spawnSync(["bun", "run", "bench/parity_nltk_models.ts"], {
    cwd: new URL("..", import.meta.url).pathname,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0)
    throw new Error(new TextDecoder().decode(proc.stdout) + new TextDecoder().decode(proc.stderr));
  expect(JSON.parse(new TextDecoder().decode(proc.stdout)).parity).toBe(true);
});
test("custom VADER lexicon augments the full lexicon and supports explicit zero values", () => {
  const analyzer = new SentimentIntensityAnalyzer({ lexicon: { codexcellent: 3, good: 0 } });
  expect(analyzer.polarityScores("codexcellent")).toEqual({
    neg: 0,
    neu: 0,
    pos: 1,
    compound: 0.6124,
  });
  expect(analyzer.polarityScores("good")).toEqual({ neg: 0, neu: 1, pos: 0, compound: 0 });
  expect(analyzer.polarityScores("horrible").compound).toBeLessThan(0);
});
