import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  everygramsAsciiNative,
  porterStemAscii,
  posTagAsciiNative,
  sentenceTokenizeSubset,
  skipgramsAsciiNative,
  tokenizeAsciiNative,
} from "../index";

type CoverageFixture = {
  tokenizer_cases: Array<{ name: string; input: string; expected_lower: string[] }>;
  sentence_cases: Array<{ name: string; input: string; expected: string[] }>;
  everygram_cases: Array<{ name: string; input: string; min_len: number; max_len: number; expected: string[][] }>;
  skipgram_cases: Array<{ name: string; input: string; n: number; k: number; expected: string[][] }>;
  porter_cases: Array<{ word: string; stem: string }>;
  pos_cases: Array<{ name: string; input: string; expected_tags: string[] }>;
};

type SuiteSummary = {
  name: string;
  total: number;
  passed: number;
  failed: number;
};

type Failure = {
  suite: string;
  name: string;
  expected: unknown;
  actual: unknown;
};

const root = resolve(import.meta.dir, "..");
const fixturePath = resolve(root, "test", "fixtures", "nltk_coverage_slices.json");
const outputDir = resolve(root, "artifacts");
const outputJson = resolve(outputDir, "parity-report.json");
const outputMd = resolve(outputDir, "parity-report.md");

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function main() {
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as CoverageFixture;
  const failures: Failure[] = [];
  const suites: SuiteSummary[] = [];

  const runSuite = <T>(name: string, items: T[], check: (item: T) => { caseName: string; expected: unknown; actual: unknown }) => {
    let passed = 0;
    for (const item of items) {
      const result = check(item);
      if (deepEqual(result.expected, result.actual)) {
        passed += 1;
      } else {
        failures.push({
          suite: name,
          name: result.caseName,
          expected: result.expected,
          actual: result.actual,
        });
      }
    }
    suites.push({
      name,
      total: items.length,
      passed,
      failed: items.length - passed,
    });
  };

  runSuite("tokenizer", fixture.tokenizer_cases, (item) => ({
    caseName: item.name,
    expected: item.expected_lower,
    actual: tokenizeAsciiNative(item.input),
  }));

  runSuite("sentence", fixture.sentence_cases, (item) => ({
    caseName: item.name,
    expected: item.expected,
    actual: sentenceTokenizeSubset(item.input),
  }));

  runSuite("everygrams", fixture.everygram_cases, (item) => ({
    caseName: item.name,
    expected: item.expected,
    actual: everygramsAsciiNative(item.input, item.min_len, item.max_len),
  }));

  runSuite("skipgrams", fixture.skipgram_cases, (item) => ({
    caseName: item.name,
    expected: item.expected,
    actual: skipgramsAsciiNative(item.input, item.n, item.k),
  }));

  runSuite("porter", fixture.porter_cases, (item) => ({
    caseName: item.word,
    expected: item.stem,
    actual: porterStemAscii(item.word),
  }));

  runSuite("pos", fixture.pos_cases, (item) => ({
    caseName: item.name,
    expected: item.expected_tags,
    actual: posTagAsciiNative(item.input).map((row) => row.tag),
  }));

  const total = suites.reduce((sum, suite) => sum + suite.total, 0);
  const passed = suites.reduce((sum, suite) => sum + suite.passed, 0);
  const failed = total - passed;

  const report = {
    generated_at: new Date().toISOString(),
    total,
    passed,
    failed,
    suites,
    failures,
  };

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(outputJson, JSON.stringify(report, null, 2), "utf8");

  const lines: string[] = [];
  lines.push("# Parity Report");
  lines.push("");
  lines.push(`- Total: ${total}`);
  lines.push(`- Passed: ${passed}`);
  lines.push(`- Failed: ${failed}`);
  lines.push("");
  lines.push("| Suite | Total | Passed | Failed |");
  lines.push("|---|---:|---:|---:|");
  for (const suite of suites) {
    lines.push(`| ${suite.name} | ${suite.total} | ${suite.passed} | ${suite.failed} |`);
  }
  if (failures.length > 0) {
    lines.push("");
    lines.push("## Failures");
    for (const failure of failures) {
      lines.push(`- ${failure.suite}/${failure.name}`);
    }
  }
  writeFileSync(outputMd, `${lines.join("\n")}\n`, "utf8");

  console.log(JSON.stringify(report, null, 2));
  if (failed > 0) {
    process.exit(1);
  }
}

main();
