import { expect, test } from "bun:test";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";
import {
  ARC_EAGER, ARC_STANDARD, ChartCell, Configuration, DemoScorer, DependencyGraph,
  DependencyScorerI, DependencySpan, NaiveBayesDependencyScorer, ProbabilisticLeafEdge,
  ProbabilisticDependencyGrammar, ProbabilisticProduction, Nonterminal, ProbabilisticTree, ProbabilisticTreeEdge, Transition,
  deprecated, extract_test_sentences,
  gzip_open_unicode, normalize_resource_url, ParsingRuntime,
} from "../index";

const ORACLE = resolve(import.meta.dir, "parse_internals_oracle.py");
const PYTHON = resolve(import.meta.dir, "../.venv/bin/python3");

type Outcome<T> = { value: T } | { error: string; message: string };

function runOracle<T>(payload: unknown): T {
  const proc = Bun.spawnSync([PYTHON, ORACLE], {
    cwd: resolve(import.meta.dir, ".."),
    stdin: new TextEncoder().encode(JSON.stringify(payload)),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
  return JSON.parse(new TextDecoder().decode(proc.stdout)) as T;
}

const CONLL = "1\tCathy\t_\tN\t_\t_\t2\tsu\t_\t_\n" +
  "2\tzag\t_\tV\t_\t_\t0\tROOT\t_\t_\n" +
  "3\them\t_\tPron\t_\t_\t2\tobj1\t_\t_\n" +
  "4\tzwaaien\t_\tAdj\t_\t_\t2\tvc\t_\t_\n" +
  "5\t.\t_\tPunc\t_\t_\t4\tpunct\t_\t_";

test("transition Configuration/Transition ops match NLTK 3.10.3 arc-standard and arc-eager", () => {
  const cases = [
    { algorithm: ARC_STANDARD, ops: [
      { name: "shift" }, { name: "left_arc", args: ["nsubj"] },
      { name: "right_arc", args: ["obj"] }, { name: "reduce" }, { name: "shift" },
    ] },
    { algorithm: ARC_EAGER, ops: [
      { name: "left_arc", args: ["nsubj"] }, { name: "right_arc", args: ["obj"] },
      { name: "reduce" }, { name: "shift" },
    ] },
  ] as const;
  type Py = Array<Outcome<{ states: unknown[]; features: string[] }>>;
  const py = runOracle<Py>({ kind: "transition", cases });
  cases.forEach((row, i) => {
    const expected = py[i]!;
    if (!("value" in expected)) throw new Error(expected.error);
    const conf = new Configuration(new DependencyGraph(CONLL));
    const transition = new Transition(row.algorithm);
    const states: unknown[] = [String(conf)];
    for (const op of row.ops) {
      const result = (transition as unknown as Record<string, (c: Configuration, r?: string) => -1 | undefined>)[op.name]!(conf, ...("args" in op ? op.args : []));
      states.push({
        op: op.name, result: result === undefined ? null : result,
        stack: [...conf.stack], buffer: [...conf.buffer], arcs: conf.arcs.map((a) => [...a]),
      });
    }
    expect(states).toEqual(expected.value.states);
    expect(conf.extract_features()).toEqual(expected.value.features);
  });
});

test("Transition constructor rejects unknown algorithms like NLTK", () => {
  const py = runOracle<Array<Outcome<string>>>({ kind: "transition_ctor", algorithms: ["arc-standard", "arc-eager", "bogus"] });
  expect(py[0]).toEqual({ value: "arc-standard" });
  expect(py[1]).toEqual({ value: "arc-eager" });
  expect("error" in py[2]! && py[2]!.error).toBe("ValueError");
  expect(() => new Transition(ARC_STANDARD)).not.toThrow();
  expect(() => new Transition(ARC_EAGER)).not.toThrow();
  expect(() => new Transition("bogus")).toThrow(/only support/);
});

test("DependencySpan repr/str/head_index/eq/lt match NLTK 3.10.3", () => {
  const cases = [
    { args: [0, 2, 1, [2, 0], ["a", "b"]], other: [0, 2, 1, [2, 0], ["x", "y"]] },
    { args: [0, 2, 1, [2, 0], ["a", "b"]], other: [0, 2, 1, [3, 0], ["a", "b"]] },
    { args: [1, 2, 1, [], []] },
  ];
  type Row = { repr: string; str: string; head_index: number; eq?: boolean; ne?: boolean; lt?: Outcome<boolean>; hash_eq?: boolean };
  const py = runOracle<Array<Outcome<Row>>>({ kind: "spans", cases });
  cases.forEach((row, i) => {
    const expected = py[i]!;
    if (!("value" in expected)) throw new Error(expected.error);
    const span = new DependencySpan(...(row.args as [number, number, number, number[], string[]]));
    expect(span.repr()).toBe(expected.value.repr);
    expect(String(span)).toBe(expected.value.str);
    expect(span.head_index()).toBe(expected.value.head_index);
    if ("other" in row) {
      const other = new DependencySpan(...(row.other! as [number, number, number, number[], string[]]));
      expect(span.equals(other)).toBe(expected.value.eq!);
      expect(!span.equals(other)).toBe(expected.value.ne!);
      if (expected.value.lt && "value" in expected.value.lt) expect(span.lessThan(other)).toBe(expected.value.lt.value);
      expect(span.comparisonKey() === other.comparisonKey()).toBe(expected.value.hash_eq!);
    }
  });
});

test("ChartCell dedups spans by comparison key like a Python set", () => {
  const py = runOracle<{ str: string; size: number; entries: string[] }>({
    kind: "chartcell", x: 1, y: 3,
    spans: [[0, 1, 0, [], []], [0, 1, 0, [], []], [1, 2, 1, [], []]],
  });
  const cell = new ChartCell(1, 3);
  const spans: Array<[number, number, number, number[], string[]]> = [[0, 1, 0, [], []], [0, 1, 0, [], []], [1, 2, 1, [], []]];
  for (const args of spans) cell.add(new DependencySpan(...args));
  expect(cell.size).toBe(py.size);
  expect(cell.values().map((span) => span.repr()).sort()).toEqual(py.entries);
});

test("DependencyScorerI/DemoScorer/NaiveBayesDependencyScorer match NLTK 3.10.3", () => {
  type Py = {
    ctor: Outcome<null>; demo_train: Outcome<null>; demo_score: Outcome<number[][][]>;
    abstract_train: Outcome<null>; nb_train: Outcome<null>; nb_score: Outcome<number[][][]>;
  };
  const py = runOracle<Py>({ kind: "scorers" });
  expect("error" in py.ctor && py.ctor.error).toBe("TypeError");
  expect(() => new DependencyScorerI()).toThrow(/abstract interface/);
  expect("error" in py.abstract_train && py.abstract_train.error).toBe("NotImplementedError");
  const scorer = Object.create(DependencyScorerI.prototype) as DependencyScorerI;
  try {
    scorer.train([]);
    throw new Error("expected throw");
  } catch (error) {
    expect((error as Error).name).toBe("NotImplementedError");
  }
  const demo = new DemoScorer();
  expect(demo.train([])).toBeUndefined();
  expect(demo.score(new DependencyGraph(CONLL))).toEqual((py.demo_score as { value: number[][][] }).value);
  const nb = new NaiveBayesDependencyScorer();
  const graphs = [new DependencyGraph(CONLL)];
  expect(nb.train(graphs)).toBeUndefined();
  const scores = nb.score(graphs[0]!);
  const expected = (py.nb_score as { value: number[][][] }).value;
  expect(scores.length).toBe(expected.length);
  scores.forEach((row, i) => row.forEach((cell, j) => {
    expect(cell[0]!).toBeCloseTo(expected[i]![j]![0]!, 9);
  }));
});

test("extract_test_sentences matches NLTK 3.10.3 parsing", () => {
  const cases = [
    { text: "# comment\nTrue: a b c\nFalse: x y\n3: one two three\njust words here\n;another comment\n%pct\n\n" },
    { text: "no colon" },
  ];
  const py = runOracle<Array<Outcome<Array<[string[], boolean | number | null]>>>>({ kind: "test_sentences", cases });
  cases.forEach((row, i) => {
    const expected = py[i]!;
    if (!("value" in expected)) throw new Error(expected.error);
    expect(extract_test_sentences(row.text)).toEqual(expected.value);
  });
});

test("normalize_resource_url matches NLTK 3.10.3 incl. unsafe-path rejection", () => {
  const urls = [
    "nltk:home/nltk", "nltk:/home/nltk", "file:grammar.fcfg", "file:///dir/file",
    "dir/file", "https://example.com/dir/file", "nltk:C:/dir/file", "../up/down",
    "./dot/file", "nltk:%2fetc%2fpasswd", "file://C:/dir/file", "//server/share",
  ];
  const py = runOracle<Array<Outcome<string>>>({ kind: "resource_url", urls });
  urls.forEach((url, i) => {
    const expected = py[i]!;
    if ("value" in expected) {
      expect(normalize_resource_url(url)).toBe(expected.value);
    } else {
      expect(() => normalize_resource_url(url)).toThrow(/Unsafe resource path/);
    }
  });
});

test("gzip_open_unicode decodes gzip text like NLTK 3.10.3", () => {
  const text = "hello wörld\nline two";
  const py = runOracle<string>({ kind: "gzip_text", text });
  const bytes = gzipSync(Buffer.from(text, "utf-8"));
  expect(gzip_open_unicode("ignored.gz", "rb", 9, "utf-8", bytes)).toBe(py);
});

test("probabilistic edges and ProbabilisticTree prob mixin behavior", async () => {
  const leaf = new ProbabilisticLeafEdge("dog", 4);
  expect(leaf.prob()).toBe(1.0);
  expect(leaf.is_complete()).toBe(true);
  const edge = new ProbabilisticTreeEdge(0.5, [0, 1], "NP", ["dog"], 1);
  expect(edge.prob()).toBe(0.5);
  expect(edge.key()).toContain("p:0.5");
  const moved = edge.move_dot_forward(2);
  expect(moved.prob()).toBe(0.5);
  const runtime = await ParsingRuntime.load();
  const tree = new ProbabilisticTree(runtime, "S", ["the", "dog"], { prob: 0.25 });
  expect(tree.prob()).toBe(0.25);
  expect(tree.logprob()).toBe(-2);
  tree.set_logprob(-3);
  expect(tree.prob()).toBeCloseTo(0.125, 12);
  tree.set_prob(0.5);
  expect(tree.logprob()).toBe(-1);
  const plain = new ProbabilisticTree(runtime, "NP");
  expect(plain.prob()).toBeNull();
  expect(plain.logprob()).toBeNull();
  expect(() => new ProbabilisticTree(runtime, "S", [], { prob: 0.1, logprob: -1 })).toThrow(/either prob or logprob/);
});

test("ProbabilisticDependencyGrammar contains/repr and deprecated wrapper", () => {
  const p1 = new ProbabilisticProduction(new Nonterminal("taught"), ["price"], { prob: 0.5 });
  const pdg = new ProbabilisticDependencyGrammar([p1], new Map([["taught", 1]]), new Map([["the", "DT"]]));
  expect(pdg.contains("taught", "price")).toBe(true);
  expect(pdg.contains("taught", "stock")).toBe(false);
  expect(pdg.repr()).toBe("Statistical Dependency grammar with 1 productions");
  const wrapped = deprecated("nltk 3.10.3", () => 42);
  expect(wrapped()).toBe(42);
});
