import { expect, test } from "bun:test";
import { resolve } from "node:path";
import {
  AnnotationTask,
  type AgreementDistanceFn,
  type AnnotationTriple,
} from "../src/agreement_metrics";
import { masiDistance } from "../src/distance_metrics";

type AgreementPayload = {
  cases: Array<{
    name: string;
    data: Array<[string, string, unknown]>;
    label_kind?: "scalar" | "sets" | "numbers";
    distance?: "binary" | "masi" | "interval";
    methods?: string[];
    calls?: Array<{ method: string; args?: string[]; name: string }>;
  }>;
};

function runPythonBaseline(payload: AgreementPayload): Record<string, Record<string, number>> {
  const proc = Bun.spawnSync(
    ["python3", "bench/python_agreement_baseline.py", "--payload", JSON.stringify(payload)],
    {
      cwd: resolve(import.meta.dir, ".."),
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  if (proc.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(proc.stderr));
  }
  const stdout = new TextDecoder().decode(proc.stdout);
  expect(stdout.trim().split("\n")).toHaveLength(1);
  return JSON.parse(stdout.trim()) as Record<string, Record<string, number>>;
}

const twoCodersTwoLabels: AnnotationTriple[] = [
  ["a", "1", "yes"],
  ["b", "1", "yes"],
  ["a", "2", "no"],
  ["b", "2", "no"],
  ["a", "3", "yes"],
  ["b", "3", "no"],
  ["a", "4", "no"],
  ["b", "4", "no"],
];

test("docstring example: coders in either order agree perfectly on one item", () => {
  expect(new AnnotationTask([["b", "1", "stat"], ["a", "1", "stat"]]).avgAo()).toBe(1.0);
  expect(new AnnotationTask([["a", "1", "othr"], ["b", "1", "othr"]]).avgAo()).toBe(1.0);
});

test("perfect agreement yields 1.0 for every coefficient", () => {
  const data: AnnotationTriple[] = [
    ["c1", "1", "x"],
    ["c2", "1", "x"],
    ["c3", "1", "x"],
    ["c1", "2", "y"],
    ["c2", "2", "y"],
    ["c3", "2", "y"],
    ["c1", "3", "z"],
    ["c2", "3", "z"],
    ["c3", "3", "z"],
  ];
  const task = new AnnotationTask(data);
  expect(task.avgAo()).toBe(1);
  expect(task.s()).toBe(1);
  expect(task.pi()).toBe(1);
  expect(task.kappa()).toBe(1);
  expect(task.multiKappa()).toBe(1);
  expect(task.alpha()).toBe(1);
  expect(task.fleissKappa()).toBeCloseTo(1, 10);
});

test("two coders / two labels: hand-checkable coefficients", () => {
  const task = new AnnotationTask(twoCodersTwoLabels);
  // a and b agree on items 1, 2, 4 -> Ao(a,b) = 3/4.
  expect(task.ao("a", "b")).toBeCloseTo(0.75, 12);
  // avg_Ao over the single pair equals that value.
  expect(task.avgAo()).toBeCloseTo(0.75, 12);
  // Label frequencies: yes x3, no x5 over 8 annotations; Ae_pi = (9+25)/64 = 0.53125.
  expect(task.pi()).toBeCloseTo((0.75 - 0.53125) / (1 - 0.53125), 12);
});

test("total disagreement gives ao = 0 and pi = -1", () => {
  const data: AnnotationTriple[] = [
    ["a", "1", "yes"],
    ["b", "1", "no"],
    ["a", "2", "yes"],
    ["b", "2", "no"],
    ["a", "3", "no"],
    ["b", "3", "yes"],
    ["a", "4", "no"],
    ["b", "4", "yes"],
  ];
  const task = new AnnotationTask(data);
  expect(task.avgAo()).toBe(0);
  expect(task.s()).toBe(-1);
  expect(task.pi()).toBe(-1);
  // Krippendorff's alpha can go negative under systematic disagreement.
  expect(task.alpha()).toBeCloseTo(-0.75, 12);
});

test("kappa is undefined when both coders use one identical label (NLTK divides by zero)", () => {
  const data: AnnotationTriple[] = [
    ["a", "1", "x"],
    ["b", "1", "x"],
    ["a", "2", "x"],
    ["b", "2", "x"],
  ];
  const task = new AnnotationTask(data);
  // Expected agreement reaches exactly 1 while Ao is also 1: NLTK raises
  // ZeroDivisionError (0 / 0); JS yields NaN under IEEE semantics.
  expect(task.aeKappa("a", "b")).toBe(1);
  expect(Number.isNaN(task.kappaPairwise("a", "b"))).toBe(true);
});

test("three coders: pairwise averaging over coder pairs", () => {
  const data: AnnotationTriple[] = [
    ["c1", "1", "a"],
    ["c2", "1", "a"],
    ["c3", "1", "b"],
    ["c1", "2", "b"],
    ["c2", "2", "b"],
    ["c3", "2", "a"],
    ["c1", "3", "a"],
    ["c2", "3", "b"],
    ["c3", "3", "a"],
    ["c1", "4", "b"],
    ["c2", "4", "b"],
    ["c3", "4", "a"],
    ["c1", "5", "a"],
    ["c2", "5", "a"],
    ["c3", "5", "b"],
  ];
  const task = new AnnotationTask(data);
  const expected =
    (task.ao("c1", "c2") + task.ao("c1", "c3") + task.ao("c2", "c3")) / 3;
  expect(task.avgAo()).toBeCloseTo(expected, 12);
  expect(task.kappa()).toBeCloseTo(
    (task.kappaPairwise("c1", "c2") +
      task.kappaPairwise("c1", "c3") +
      task.kappaPairwise("c2", "c3")) /
      3,
    12,
  );
});

test("missing items: Ao divides by total item count even when both paired coders skipped one", () => {
  const data: AnnotationTriple[] = [
    ["c1", "1", "pos"],
    ["c2", "1", "pos"],
    ["c3", "1", "pos"],
    ["c1", "2", "neg"],
    ["c2", "2", "neg"],
    ["c3", "2", "neg"],
    ["c1", "3", "pos"],
    ["c2", "3", "pos"],
    ["c3", "3", "pos"],
    ["c3", "4", "neg"],
  ];
  const task = new AnnotationTask(data);
  // c1/c2 agree on all three shared items but len(I) == 4.
  expect(task.ao("c1", "c2")).toBeCloseTo(0.75, 12);
  // alpha ignores items with fewer than two ratings.
  expect(task.alpha()).toBeCloseTo(1, 12);
});

test("agr throws like NLTK StopIteration when one coder lacks an item", () => {
  const data: AnnotationTriple[] = [
    ["c1", "1", "pos"],
    ["c3", "1", "neg"],
    ["c1", "2", "pos"],
  ];
  const task = new AnnotationTask(data);
  expect(() => task.ao("c1", "c3")).toThrow(/StopIteration/);
});

test("MASI distance changes scores versus binary distance for set labels", () => {
  const raw: Array<[string, string, string[]]> = [
    ["a", "1", ["own"]],
    ["b", "1", ["own"]],
    ["a", "2", ["own", "other"]],
    ["b", "2", ["own"]],
    ["a", "3", ["other"]],
    ["b", "3", ["own", "other"]],
    ["a", "4", ["own", "other"]],
    ["b", "4", ["own", "other"]],
  ];
  const toSets = (rows: Array<[string, string, string[]]>): AnnotationTriple[] =>
    rows.map(([c, i, labels]) => [c, i, new Set(labels)]);

  // GOTCHA: NLTK's binary_distance works on frozensets because Python compares
  // them by value; JS Set identity means binaryDistance(Set, Set) is always 1.
  // Use a value-equality binary distance to mirror the frozenset behavior.
  const eqSets = (s1: Set<string>, s2: Set<string>): boolean =>
    s1.size === s2.size && [...s1].every((x) => s2.has(x));
  const setBinaryDistance = (l1: unknown, l2: unknown): number =>
    eqSets(l1 as Set<string>, l2 as Set<string>) ? 0 : 1;

  const binary = new AnnotationTask(toSets(raw), setBinaryDistance);
  const masi = new AnnotationTask(toSets(raw), masiDistance as AgreementDistanceFn);
  // Binary distance treats every set mismatch as full disagreement;
  // MASI softens partial overlaps like {own, other} vs {own}.
  expect(binary.avgAo()).toBeCloseTo(0.5, 12);
  expect(masi.avgAo()).toBeCloseTo(2 / 3, 12);
});

test("weighted kappa uses the interval distance", () => {
  const data: AnnotationTriple[] = [
    ["a", "1", 1],
    ["b", "1", 1],
    ["a", "2", 2],
    ["b", "2", 3],
    ["a", "3", 3],
    ["b", "3", 2],
    ["a", "4", 1],
    ["b", "4", 2],
  ];
  const intervalDistance = (l1: number, l2: number) => (l1 - l2) ** 2 / 4;
  const task = new AnnotationTask(data, intervalDistance as never);
  // Do_Kw normalizes by max_distance=1 here; distances are (d^2)/4.
  // Per item: 0, 1/4, 1/4, 1/4 -> sum 0.75 over 4 items -> 0.1875.
  expect(task.doKw()).toBeCloseTo(0.1875, 12);
  expect(Number.isFinite(task.weightedKappa())).toBe(true);
});

test("alpha degenerate cases mirror NLTK", () => {
  expect(new AnnotationTask([["a", "1", "x"], ["b", "1", "x"]]).alpha()).toBe(1);
  expect(() => new AnnotationTask([]).alpha()).toThrow("Cannot calculate alpha, no data present!");
  expect(() =>
    new AnnotationTask([
      ["a", "1", "x"],
      ["a", "1", "y"],
    ]).alpha(),
  ).toThrow("Cannot calculate alpha, only one coder and item present!");
});

test("fleissKappa matches the textbook 2-rater perfect/hand case", () => {
  // Classic Fleiss example subset: 10 items, 2 raters... use a tiny known case:
  // 3 items x 2 raters, categories {a, b}: item1 (a,a), item2 (a,a), item3 (b,a).
  const data: AnnotationTriple[] = [
    ["r1", "1", "a"],
    ["r2", "1", "a"],
    ["r1", "2", "a"],
    ["r2", "2", "a"],
    ["r1", "3", "b"],
    ["r2", "3", "a"],
  ];
  const task = new AnnotationTask(data);
  // P_i: 1, 1, 0 -> P_bar = 2/3; p_a = 5/6, p_b = 1/6 -> Pe = 26/36.
  const pe = (5 / 6) ** 2 + (1 / 6) ** 2;
  expect(task.fleissKappa()).toBeCloseTo((2 / 3 - pe) / (1 - pe), 12);
});

test("loadArray appends incrementally like NLTK load_array", () => {
  const task = new AnnotationTask();
  task.loadArray([
    ["a", "1", "x"],
    ["b", "1", "x"],
  ]);
  task.loadArray([
    ["a", "2", "y"],
    ["b", "2", "y"],
  ]);
  expect(task.avgAo()).toBe(1);
  expect(task.Nk("string:x")).toBe(2);
  expect(task.Nk("string:y")).toBe(2);
});

test("python3 baseline parity (spawn)", () => {
  const payload: AgreementPayload = {
    cases: [
      {
        name: "two_coders_two_labels",
        data: twoCodersTwoLabels as Array<[string, string, unknown]>,
        methods: ["avg_Ao", "S", "pi", "kappa", "multi_kappa", "alpha"],
      },
      {
        name: "three_coders",
        data: [
          ["c1", "1", "a"],
          ["c2", "1", "a"],
          ["c3", "1", "b"],
          ["c1", "2", "b"],
          ["c2", "2", "b"],
          ["c3", "2", "a"],
          ["c1", "3", "a"],
          ["c2", "3", "b"],
          ["c3", "3", "a"],
        ],
        methods: ["avg_Ao", "pi", "kappa", "alpha"],
      },
      {
        name: "masi",
        label_kind: "sets",
        distance: "masi",
        data: [
          ["a", "1", ["own"]],
          ["b", "1", ["own"]],
          ["a", "2", ["own", "other"]],
          ["b", "2", ["own"]],
          ["a", "3", ["other"]],
          ["b", "3", ["own", "other"]],
        ],
        methods: ["avg_Ao", "pi", "alpha"],
      },
      {
        name: "missing_items",
        data: [
          ["c1", "1", "pos"],
          ["c2", "1", "pos"],
          ["c3", "1", "pos"],
          ["c1", "2", "neg"],
          ["c2", "2", "neg"],
          ["c3", "2", "neg"],
          ["c3", "3", "pos"],
        ],
        methods: ["alpha"],
        calls: [{ method: "Ao", args: ["c1", "c2"], name: "Ao_c1_c2" }],
      },
    ],
  };

  const py = runPythonBaseline(payload);
  const round10 = (v: number): number => {
    const r = Math.round(v * 1e10) / 1e10;
    return r === 0 ? 0 : r;
  };
  const METHOD_MAP: Record<string, (t: AnnotationTask, ...args: string[]) => number> = {
    Ao: (t, cA, cB) => t.ao(cA, cB),
    avg_Ao: (t) => t.avgAo(),
    S: (t) => t.s(),
    pi: (t) => t.pi(),
    kappa: (t) => t.kappa(),
    multi_kappa: (t) => t.multiKappa(),
    alpha: (t) => t.alpha(),
  };

  for (const spec of payload.cases) {
    const distance =
      spec.distance === "masi"
        ? (masiDistance as never)
        : undefined;
    const data = (
      spec.label_kind === "sets"
        ? spec.data.map(([c, i, labels]) => [c, i, new Set(labels as string[])])
        : spec.data
    ) as AnnotationTriple[];
    const task = new AnnotationTask(data, distance);
    const js: Record<string, number> = {};
    for (const method of spec.methods ?? []) {
      const fn = METHOD_MAP[method];
      if (fn === undefined) throw new Error(`unknown method ${method}`);
      js[method] = round10(fn(task));
    }
    for (const call of spec.calls ?? []) {
      const fn = METHOD_MAP[call.method];
      if (fn === undefined) throw new Error(`unknown method ${call.method}`);
      js[call.name] = round10(fn(task, ...(call.args ?? [])));
    }
    for (const [method, value] of Object.entries(js)) {
      expect(py[spec.name]?.[method]).toBeDefined();
      expect(Math.abs((py[spec.name]?.[method] ?? Number.NaN) - value)).toBeLessThan(1e-9);
    }
  }
});
