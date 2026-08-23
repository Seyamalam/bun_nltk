import { resolve } from "node:path";
import { AnnotationTask, type AnnotationLabel, type AnnotationTriple } from "../src/agreement_metrics";

type RawTriple = [coder: string, item: string, label: string | number | string[]];

type CaseSpec = {
  name: string;
  data: RawTriple[];
  labelKind?: "scalar" | "sets" | "numbers";
  distance?: "binary" | "masi" | "interval";
  methods?: string[];
  calls?: Array<{ method: string; args?: string[]; name: string }>;
};

const cases: CaseSpec[] = [
  {
    // Two coders, two labels, mixed agreement.
    name: "two_coders_two_labels",
    data: [
      ["a", "1", "yes"],
      ["b", "1", "yes"],
      ["a", "2", "no"],
      ["b", "2", "no"],
      ["a", "3", "yes"],
      ["b", "3", "no"],
      ["a", "4", "no"],
      ["b", "4", "no"],
    ],
    methods: ["avg_Ao", "S", "pi", "kappa", "multi_kappa", "alpha"],
  },
  {
    // Three coders, three labels.
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
      ["c1", "4", "b"],
      ["c2", "4", "b"],
      ["c3", "4", "a"],
      ["c1", "5", "a"],
      ["c2", "5", "a"],
      ["c3", "5", "b"],
    ],
    methods: ["avg_Ao", "S", "pi", "kappa", "multi_kappa", "alpha"],
  },
  {
    // Perfect agreement across three coders and three labels.
    name: "perfect_agreement",
    data: [
      ["c1", "1", "x"],
      ["c2", "1", "x"],
      ["c3", "1", "x"],
      ["c1", "2", "y"],
      ["c2", "2", "y"],
      ["c3", "2", "y"],
      ["c1", "3", "z"],
      ["c2", "3", "z"],
      ["c3", "3", "z"],
    ],
    methods: ["avg_Ao", "S", "pi", "kappa", "multi_kappa", "alpha"],
  },
  {
    // Total disagreement between two coders (kappa is undefined here in NLTK:
    // expected agreement reaches 1.0 and divides by zero, so it is omitted).
    name: "total_disagreement",
    data: [
      ["a", "1", "yes"],
      ["b", "1", "no"],
      ["a", "2", "yes"],
      ["b", "2", "no"],
      ["a", "3", "no"],
      ["b", "3", "yes"],
      ["a", "4", "no"],
      ["b", "4", "yes"],
    ],
    methods: ["avg_Ao", "S", "pi", "alpha"],
  },
  {
    // Missing items gotcha: coder c3 annotates an extra item that c1/c2 never
    // see. NLTK CANNOT run avg_Ao/kappa/pi here (Ao(c1, c3) raises
    // StopIteration -> RuntimeError because c1 lacks item "4"), but a direct
    // Ao(c1, c2) call works and still divides by the TOTAL item count
    // (len(self.I) == 4), so the score drops below 1.0 despite c1/c2 agreeing
    // perfectly on every item they both annotated. alpha() also works: items
    // with fewer than two ratings are ignored.
    name: "missing_items",
    data: [
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
    ],
    methods: ["alpha"],
    calls: [{ method: "Ao", args: ["c1", "c2"], name: "Ao_c1_c2" }],
  },
  {
    // MASI distance over set-valued labels.
    name: "masi_distance",
    labelKind: "sets",
    distance: "masi",
    data: [
      ["a", "1", ["own"]],
      ["b", "1", ["own"]],
      ["a", "2", ["own", "other"]],
      ["b", "2", ["own"]],
      ["a", "3", ["other"]],
      ["b", "3", ["own", "other"]],
      ["a", "4", ["own", "other"]],
      ["b", "4", ["own", "other"]],
    ],
    methods: ["avg_Ao", "pi", "alpha"],
  },
  {
    // Interval distance with numeric labels exercises the weighted kappa.
    name: "weighted_kappa_interval",
    labelKind: "numbers",
    distance: "interval",
    data: [
      ["a", "1", 1],
      ["b", "1", 1],
      ["a", "2", 2],
      ["b", "2", 3],
      ["a", "3", 3],
      ["b", "3", 2],
      ["a", "4", 1],
      ["b", "4", 2],
    ],
    methods: ["Do_Kw", "weighted_kappa"],
  },
];

const METHOD_MAP: Record<string, (task: AnnotationTask, ...args: string[]) => number> = {
  Ao: (t, cA, cB) => t.ao(cA, cB),
  avg_Ao: (t) => t.avgAo(),
  S: (t) => t.s(),
  pi: (t) => t.pi(),
  kappa: (t) => t.kappa(),
  multi_kappa: (t) => t.multiKappa(),
  alpha: (t) => t.alpha(),
  Do_Kw: (t) => t.doKw(),
  weighted_kappa: (t) => t.weightedKappa(),
};

function round10(value: number): number {
  const rounded = Math.round(value * 1e10) / 1e10;
  return rounded === 0 ? 0 : rounded;
}

function buildTask(spec: CaseSpec): AnnotationTask {
  let distance: ((a: AnnotationLabel, b: AnnotationLabel) => number) | undefined;
  if (spec.distance === "masi") {
    // Local MASI implementation matching nltk.metrics.distance.masi_distance.
    distance = (l1, l2) => {
      const s1 = l1 as Set<string>;
      const s2 = l2 as Set<string>;
      let intersection = 0;
      for (const x of s1) if (s2.has(x)) intersection += 1;
      const union = new Set([...s1, ...s2]).size;
      let m: number;
      if (s1.size === s2.size && s1.size === intersection) m = 1;
      else if (intersection === Math.min(s1.size, s2.size)) m = 2 / 3;
      else if (intersection > 0) m = 1 / 3;
      else m = 0;
      return 1 - (intersection / union) * m;
    };
  } else if (spec.distance === "interval") {
    distance = (l1, l2) => (Number(l1) - Number(l2)) ** 2;
  }
  const data =
    spec.labelKind === "sets"
      ? spec.data.map(
          ([c, i, labels]) => [c, i, new Set(labels as string[])] as AnnotationTriple,
        )
      : spec.labelKind === "numbers"
        ? spec.data.map(([c, i, n]) => [c, i, Number(n)] as AnnotationTriple)
        : (spec.data as AnnotationTriple[]);
  return new AnnotationTask(data, distance);
}

function main() {
  const payload = JSON.stringify({
    cases: cases.map(({ name, data, labelKind, distance, methods, calls }) => ({
      name,
      data,
      label_kind: labelKind,
      distance,
      methods,
      calls,
    })),
  });
  const proc = Bun.spawnSync(
    ["python3", "bench/python_agreement_baseline.py", "--payload", payload],
    {
      cwd: resolve(import.meta.dir, ".."),
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  if (proc.exitCode !== 0) {
    throw new Error(`python agreement baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  }
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as Record<
    string,
    Record<string, number>
  >;

  const js: Record<string, Record<string, number>> = {};
  for (const spec of cases) {
    const task = buildTask(spec);
    const caseResult: Record<string, number> = {};
    for (const method of spec.methods ?? []) {
      caseResult[method] = round10(METHOD_MAP[method]!(task));
    }
    for (const call of spec.calls ?? []) {
      const fn = METHOD_MAP[call.method];
      if (fn === undefined) {
        throw new Error(`unknown method ${call.method}`);
      }
      caseResult[call.name] = round10(fn(task, ...(call.args ?? [])));
    }
    js[spec.name] = caseResult;
  }

  const parity = JSON.stringify(js) === JSON.stringify(py);
  if (!parity) {
    throw new Error(`agreement parity failed:\njs=${JSON.stringify(js)}\npy=${JSON.stringify(py)}`);
  }

  console.log(
    JSON.stringify(
      {
        parity,
        cases: cases.length,
        coefficients: [...new Set(cases.flatMap((c) => c.methods))].sort(),
      },
      null,
      2,
    ),
  );
}

main();
