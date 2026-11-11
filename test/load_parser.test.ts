import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
import { load_parser, show_cfg } from "../src/inference_discourse";
import { dataPath } from "../src/data";

const ORACLE = resolve(import.meta.dir, "load_parser_oracle.py");
const PYTHON = resolve(import.meta.dir, "../.venv/bin/python3");
const DATA = resolve(import.meta.dir, "../.cache/nltk-data");
const GRAMMARS = `${DATA}/grammars`;

// The oracle script writes these fixtures; mirror them for the TS side.
writeFileSync(`${GRAMMARS}/load_parser_test.cfg`, "S -> NP VP\nNP -> 'John'\nVP -> V NP\nNP -> 'Mary'\nV -> 'sees'\n");
writeFileSync(
  `${GRAMMARS}/load_parser_test.pcfg`,
  "S -> NP VP [1.0]\nNP -> 'John' [0.5]\nNP -> 'Mary' [0.5]\nVP -> V NP [1.0]\nV -> 'sees' [1.0]\n",
);
writeFileSync(`${GRAMMARS}/load_parser_show.cfg`, "## comment line\n\nS -> NP VP\n\n## another\nVP -> V\n");

if (!dataPath.includes(DATA)) dataPath.push(DATA);

const oracle = (() => {
  const proc = Bun.spawnSync([PYTHON, ORACLE], {
    cwd: resolve(import.meta.dir, ".."),
    env: { ...process.env, NLTK_DATA: DATA },
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) throw new Error(`oracle failed: ${proc.stderr.toString()}`);
  const line = proc.stdout.toString().trim().split("\n").pop()!;
  return JSON.parse(line.replace(/^json:/, "")) as {
    cfg_parser: string;
    cfg_trees: string[];
    cfg_trace0: string;
    pcfg_parser: string;
    pcfg_trees: string[];
    pcfg_probs: number[];
    cfg_custom_parser: string;
    cfg_custom_trees: string[];
    fcfg_parser: string;
    fcfg_chart: string;
    missing: { err: string; msg: string };
    fol: { err: string; msg: string };
    show_cfg: string;
    show_cfg_escape: string;
  };
})();

// cfg/pcfg/fcfg dispatch, trees, probs, errors, show_cfg output match oracle
/** Serialize a plain {label, children} chart tree to NLTK bracket format. */
function bracket(t: any): string {
  if (typeof t === "string") return t;
  return `(${t.label}${t.children.length ? ` ${t.children.map(bracket).join(" ")}` : ""})`;
}

test("load_parser: .cfg dispatches to ChartParser and parses like oracle", () => {
  const p = load_parser("grammars/load_parser_test.cfg") as any;
  expect(oracle.cfg_parser).toBe("ChartParser"); // NltkChartParser is our ChartParser port
  const trees = [...p.parse("John sees Mary".split(" "))].map(bracket);
  expect(trees.sort()).toEqual(oracle.cfg_trees);
});

test("load_parser: .pcfg dispatches to InsideChartParser with probs", () => {
  const p = load_parser("grammars/load_parser_test.pcfg") as any;
  expect(oracle.pcfg_parser).toBe("InsideChartParser");
  const trees = [...p.parse("John sees Mary".split(" "))];
  expect(trees.map((t: any) => t.prob)).toEqual(oracle.pcfg_probs);
  expect(trees.map(bracket)).toEqual(
    oracle.pcfg_trees.map((s) => s.replace(/ \(p=[0-9.]+\)$/, "")),
  );
});

test("load_parser: custom parser class and .fcfg dispatch", () => {
  const { TopDownChartParser } = require("../src/chart") as any;
  const p = load_parser("grammars/load_parser_test.cfg", 0, TopDownChartParser) as any;
  const trees = [...p.parse("John sees Mary".split(" "))].map(bracket);
  expect(trees.sort()).toEqual(oracle.cfg_custom_trees);

  const f = load_parser("grammars/book_grammars/feat0.fcfg") as any;
  expect(f.constructor.name).toBe("FeatureChartParser");
  expect(oracle.fcfg_parser).toBe("FeatureChartParser");
  expect(oracle.fcfg_chart).toBe("FeatureChart");
});

test("load_parser: missing resource and unrecognized format errors", () => {
  expect(() => load_parser("grammars/nonexistent_grammar.cfg")).toThrow();
  try {
    load_parser("grammars/nonexistent_grammar.cfg");
  } catch (e) {
    expect((e as Error).name).toBe(oracle.missing.err);
  }
  expect(oracle.missing.err).toBe("LookupError");
  try {
    load_parser("grammars/background.fol");
  } catch (e) {
    expect((e as Error).name).toBe(oracle.fol.err);
  }
  expect(oracle.fol.err).toBe("LookupError");
});

test("show_cfg: filters escaped and empty lines like oracle", () => {
  const out: string[] = [];
  const orig = console.log;
  console.log = (s: string) => out.push(s);
  try {
    show_cfg("grammars/load_parser_show.cfg");
  } finally {
    console.log = orig;
  }
  expect(`${out.join("\n")}\n`).toBe(oracle.show_cfg);

  const out2: string[] = [];
  console.log = (s: string) => out2.push(s);
  try {
    show_cfg("grammars/load_parser_show.cfg", "#");
  } finally {
    console.log = orig;
  }
  expect(`${out2.join("\n")}\n`).toBe(oracle.show_cfg_escape);
});
