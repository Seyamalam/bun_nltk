import { expect, test } from "bun:test";
import { resolve } from "node:path";
import {
  featureChartParse,
  featureEarleyParse,
  parseFeatureCfgGrammar,
  parseTextWithFeatureCfg,
  parseTextWithFeatureEarley,
  type ParseTree,
} from "../index";

const featureGrammarText = `
S[num=?n] -> NP[num=?n] VP[num=?n]
NP[num=sg] -> 'dog'
NP[num=pl] -> 'dogs'
VP[num=sg] -> 'runs'
VP[num=pl] -> 'run'
`;

function toBracket(tree: ParseTree): string {
  const children = tree.children
    .map((child) => (typeof child === "string" ? child : toBracket(child)))
    .join(" ");
  return `(${tree.label}${children ? ` ${children}` : ""})`;
}

test("feature chart parser enforces simple agreement", () => {
  const grammar = parseFeatureCfgGrammar(featureGrammarText);
  const ok = featureChartParse(["dog", "runs"], grammar);
  const bad = featureChartParse(["dog", "run"], grammar);
  expect(ok.length).toBeGreaterThan(0);
  expect(bad.length).toBe(0);
});

test("parseTextWithFeatureCfg tokenizes and parses text", () => {
  const trees = parseTextWithFeatureCfg("Dogs run.", featureGrammarText);
  expect(trees.length).toBeGreaterThan(0);
  expect(toBracket(trees[0]!)).toContain("S[num=pl]");
});

test("feature parser parity with python nltk feature chart parser", () => {
  const grammar = parseFeatureCfgGrammar(featureGrammarText);
  const tokens = ["dog", "runs"];
  const jsTrees = featureChartParse(tokens, grammar).map(toBracket);

  const payload = JSON.stringify({
    grammar: featureGrammarText,
    tokens,
  });
  const proc = Bun.spawnSync(["python", "bench/python_feature_parser_baseline.py", "--payload", payload], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(proc.stderr));
  }
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as {
    parse_count: number;
    trees: string[];
  };

  expect(jsTrees.length).toBe(py.parse_count);
  expect(jsTrees[0]).toContain("dog");
  expect(jsTrees[0]).toContain("runs");
  expect(py.trees[0] ?? "").toContain("dog");
  expect(py.trees[0] ?? "").toContain("runs");
});

test("feature earley parser subset enforces agreement", () => {
  const grammar = parseFeatureCfgGrammar(featureGrammarText);
  const ok = featureEarleyParse(["dog", "runs"], grammar);
  const bad = featureEarleyParse(["dog", "run"], grammar);
  expect(ok.length).toBeGreaterThan(0);
  expect(bad.length).toBe(0);
});

test("parseTextWithFeatureEarley tokenizes and parses text", () => {
  const trees = parseTextWithFeatureEarley("Dogs run.", featureGrammarText);
  expect(trees.length).toBeGreaterThan(0);
  expect(toBracket(trees[0]!)).toContain("S[num=pl]");
});

test("feature earley parity with python nltk feature earley parser", () => {
  const grammar = parseFeatureCfgGrammar(featureGrammarText);
  const tokens = ["dog", "runs"];
  const jsTrees = featureEarleyParse(tokens, grammar).map(toBracket);

  const payload = JSON.stringify({
    grammar: featureGrammarText,
    tokens,
  });
  const proc = Bun.spawnSync(["python", "bench/python_feature_earley_baseline.py", "--payload", payload], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(proc.stderr));
  }
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as {
    parse_count: number;
    trees: string[];
  };

  expect(jsTrees.length).toBe(py.parse_count);
  expect(jsTrees[0]).toContain("dog");
  expect(jsTrees[0]).toContain("runs");
  expect(py.trees[0] ?? "").toContain("dog");
  expect(py.trees[0] ?? "").toContain("runs");
});
