import { resolve } from "node:path";
import {
  binaryDistance,
  editDistanceAlign,
  fMeasure,
  intervalDistance,
  jaccardDistance,
  logLikelihood,
  masiDistance,
  pk,
  precision,
  recall,
  sorensenDiceDistance,
  sorensenDiceSimilarity,
  spearmanCorrelation,
  windowdiff,
} from "../src/distance_metrics";

type PythonResult = {
  jaccard: number[];
  masi: number[];
  binary: number[];
  interval: number[];
  align: number[][][];
  precision: Array<number | null>;
  recall: Array<number | null>;
  f_measure: Array<number | null>;
  loglik: number[];
  windowdiff: number[];
  pk: number[];
  spearman: number[];
};

function main() {
  const jaccardPairs = [
    [["a", "b", "c"], ["a", "b", "d"]],
    [[1, 2, 3], [1, 2, 3]],
    [["x"], ["y"]],
    [["a", "b"], ["c", "d"]],
  ];
  const masiPairs = [
    [[1, 2], [1, 2, 3, 4]],
    [[1, 2], [1, 2]],
    [[1, 2], [2, 3]],
    [[1], [2]],
    [["a", "b", "c"], ["a"]],
  ];
  const binaryPairs = [
    ["same", "same"],
    ["a", "b"],
    [1, 1],
    [1, 3],
  ];
  const intervalPairs = [
    [1, 10],
    [4, -5],
    [0, 0],
    [2.5, 0.5],
  ];
  const alignPairs = [
    ["rain", "shine"],
    ["shine", "shine"],
    ["rain", "brainy"],
    ["", "brainy"],
    ["", ""],
    ["abc", "abc"],
    ["kitten", "sitting"],
  ];
  const prfPairs = [
    [["a", "b", "c"], ["a", "b", "d"]],
    [["a"], []],
    [[], ["a"]],
    [["a", "b"], ["b", "a"]],
    [["x", "y"], ["y", "z"]],
  ];
  const prfAlphaCases = [
    [["a", "b", "c"], ["a", "b", "d"], 0.5],
    [["a", "b", "c"], ["a", "b", "d"], 0.25],
    [["a", "b"], ["b", "a"], 0.75],
  ];
  const loglikCases = [
    [["a", "b"], [{ a: 0.7, b: 0.3 }, { a: 0.2, b: 0.8 }]],
    [["x"], [{ x: 1.0 }]],
  ];
  const windowdiffCases = [
    ["000100000010", "000100000010", 3, "1", false],
    ["000100000010", "000010000100", 3, "1", false],
    ["000010000100", "100000010000", 3, "1", false],
    ["000100000010", "000010000100", 3, "1", true],
    ["1100100000", "1100010000", 3, "1", true],
  ];
  const pkCases = [
    ["0100010000", "1111111111", 2, "1"],
    ["0100010000", "0000000000", 2, "1"],
    ["0100010000", "0100010000", 2, "1"],
    ["0100".repeat(25), "1".repeat(100), null, "1"],
    ["1100100000", "1100010000", 3, "1"],
  ];
  const spearmanCases = [
    [{ a: 1, b: 2, c: 3 }, { a: 1, b: 3, c: 2 }],
    [{ a: 1, b: 2, c: 3 }, { c: 3, b: 2, a: 1 }],
    [{ a: 1, b: 2 }, { a: 2, b: 1 }],
    [
      [
        ["a", 1],
        ["b", 2],
        ["c", 3],
      ],
      [
        ["a", 3],
        ["b", 2],
        ["c", 1],
      ],
    ],
  ];

  const payload = JSON.stringify({
    jaccard_pairs: jaccardPairs,
    masi_pairs: masiPairs,
    binary_pairs: binaryPairs,
    interval_pairs: intervalPairs,
    align_pairs: alignPairs,
    prf_pairs: prfPairs,
    prf_alpha_cases: prfAlphaCases,
    loglik_cases: loglikCases,
    windowdiff_cases: windowdiffCases,
    pk_cases: pkCases,
    spearman_cases: spearmanCases,
  });

  const proc = Bun.spawnSync(
    ["python3", "bench/python_distance_baseline.py", "--payload", payload],
    {
      cwd: resolve(import.meta.dir, ".."),
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  if (proc.exitCode !== 0) {
    throw new Error(`python distance baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  }
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as PythonResult;

  const js: PythonResult = {
    jaccard: jaccardPairs.map(([a, b]) => jaccardDistance(new Set(a), new Set(b))),
    masi: masiPairs.map(([a, b]) => masiDistance(new Set(a), new Set(b))),
    binary: binaryPairs.map(([a, b]) => binaryDistance(a, b)),
    interval: intervalPairs.map(([a, b]) => intervalDistance(a, b)),
    align: alignPairs.map(([s1, s2]) => editDistanceAlign(s1, s2)),
    precision: prfPairs.map(([r, t]) => precision(new Set(r), new Set(t))),
    recall: prfPairs.map(([r, t]) => recall(new Set(r), new Set(t))),
    f_measure: prfAlphaCases.map(([r, t, alpha]) =>
      fMeasure(new Set(r), new Set(t), alpha as number),
    ),
    loglik: loglikCases.map(([reference, dists]) =>
      logLikelihood(reference as string[], dists as Array<Record<string, number>>),
    ),
    windowdiff: windowdiffCases.map(([seg1, seg2, k, boundary, weighted]) =>
      windowdiff(seg1 as string, seg2 as string, k as number, boundary as string, weighted as boolean),
    ),
    pk: pkCases.map(([ref, hyp, k, boundary]) =>
      pk(ref as string, hyp as string, k as number | null, boundary as string),
    ),
    spearman: spearmanCases.map(([r1, r2]) =>
      spearmanCorrelation(r1 as Record<string, number>, r2 as Record<string, number>),
    ),
  };

  const tolerance = 1e-9;
  let exact = true;
  let tolerant = true;
  const mismatches: string[] = [];

  for (const key of Object.keys(js) as Array<keyof PythonResult>) {
    const jsValues = js[key] as unknown[];
    const pyValues = py[key] as unknown[];
    if (jsValues.length !== pyValues.length) {
      exact = false;
      tolerant = false;
      mismatches.push(`${key}: length ${jsValues.length} != ${pyValues.length}`);
      continue;
    }
    for (let i = 0; i < jsValues.length; i += 1) {
      const a = jsValues[i];
      const b = pyValues[i];
      if (typeof a === "number" && typeof b === "number") {
        if (a !== b) {
          exact = false;
          if (!(Math.abs(a - b) <= tolerance)) {
            tolerant = false;
            mismatches.push(`${key}[${i}]: js=${a} py=${b}`);
          }
        }
      } else if (JSON.stringify(a) !== JSON.stringify(b)) {
        exact = false;
        tolerant = false;
        mismatches.push(`${key}[${i}]: js=${JSON.stringify(a)} py=${JSON.stringify(b)}`);
      }
    }
  }

  // Sørensen–Dice has no python counterpart in nltk 3.10.3; sanity-check the
  // canonical definition instead.
  const diceSanity =
    sorensenDiceSimilarity(new Set(["a", "b", "c"]), new Set(["a", "b", "d"])) === 2 / 3 &&
    Math.abs(sorensenDiceDistance(new Set(["a", "b", "c"]), new Set(["a", "b", "d"])) - 1 / 3) <
      1e-12;

  const parity = exact && diceSanity;
  if (!tolerant || !diceSanity) {
    throw new Error(`distance metrics parity failed:\n${mismatches.join("\n")}`);
  }

  console.log(
    JSON.stringify({
      parity,
      parity_tolerant: tolerant,
      dice_sanity: diceSanity,
      case_counts: Object.fromEntries(
        Object.entries(js).map(([k, v]) => [k, (v as unknown[]).length]),
      ),
    }),
  );
}

main();
