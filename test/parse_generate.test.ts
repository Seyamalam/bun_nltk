import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { CFG } from "../src/grammar";
import { generate } from "../src/parse_generate";
import { demo_grammar } from "../index";

const ORACLE = resolve(import.meta.dir, "parse_generate_oracle.py");
const PYTHON = resolve(import.meta.dir, "../.venv/bin/python3");

function runOracle<T>(kind: string): T {
  const proc = Bun.spawnSync([PYTHON, ORACLE, kind], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) throw new Error(`oracle failed: ${proc.stderr.toString()}`);
  return JSON.parse(proc.stdout.toString().trim().split("\n").pop()!) as T;
}

const GRAMMAR = `
S -> NP VP
NP -> Det N
NP -> 'John'
VP -> V NP
Det -> 'the' | 'a'
N -> 'man' | 'dog'
V -> 'saw' | 'walked'
`;

test("generate() sentence stream matches oracle (depth, n, n=0)", () => {
  const oracle = runOracle<{ depth3: string[]; n3: string[]; n0: string[] }>("generate");
  const g = CFG.fromstring(GRAMMAR);
  const flat = (iter: Generator<string[]>) => [...iter].map((s) => s.join(" "));
  expect(flat(generate(g, { depth: 3 }))).toEqual(oracle.depth3);
  expect(flat(generate(g, { depth: 5, n: 3 }))).toEqual(oracle.n3);
  expect(flat(generate(g, { depth: 5, n: 0 }))).toEqual(oracle.n0);
});

test("demo_grammar() matches oracle productions", () => {
  const oracle = runOracle<{ start: string; productions: string[] }>("demo_grammar");
  const g = demo_grammar();
  expect(String(g.start())).toBe(oracle.start);
  expect(g.productions().map(String)).toEqual(oracle.productions);
});
