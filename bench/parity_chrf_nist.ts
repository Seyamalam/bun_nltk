import { resolve } from "node:path";
import { sentenceChrF } from "../src/translation_metrics_extra";
import { sentenceNist } from "../src/translation_metrics_extra";

const TOLERANCE = 1e-9;

type ChrFCase = {
  id: string;
  reference: string | string[];
  hypothesis: string | string[];
  min_len?: number;
  max_len?: number;
  beta?: number;
  ignore_whitespace?: boolean;
};

type NistCase = {
  id: string;
  references: string[][];
  hypothesis: string[];
  n?: number;
};

function main() {
  const chrfCases: ChrFCase[] = [
    {
      id: "bleu_paper_hyp1",
      reference: "It is a guide to action that ensures that the military will forever heed Party commands".split(" "),
      hypothesis: "It is a guide to action which ensures that the military always obeys the commands of the party".split(" "),
    },
    {
      id: "bleu_paper_hyp2",
      reference: "It is a guide to action that ensures that the military will forever heed Party commands".split(" "),
      hypothesis: "It is to insure the troops forever hearing the activity guidebook that party direct".split(" "),
    },
    {
      id: "the_the_the",
      reference: "the cat is on the mat".split(" "),
      hypothesis: "the the the the the the the".split(" "),
    },
    {
      id: "identical",
      reference: ["a", "small", "step"],
      hypothesis: ["a", "small", "step"],
    },
    {
      id: "disjoint_epsilon",
      reference: ["aaa", "bbb"],
      hypothesis: ["xxx", "yyy"],
    },
    {
      id: "string_inputs",
      reference: "It is a guide to action that ensures that the military will forever heed Party commands",
      hypothesis: "It is a guide to action which ensures that the military always obeys the commands of the party",
    },
    {
      id: "custom_ngrams_beta",
      reference: "It is a guide to action that ensures that the military will forever heed Party commands".split(" "),
      hypothesis: "It is a guide to action which ensures that the military always obeys the commands of the party".split(" "),
      min_len: 2,
      max_len: 3,
      beta: 2.0,
    },
    {
      id: "keep_whitespace",
      reference: "ab cd",
      hypothesis: "abcd ef",
      ignore_whitespace: false,
    },
    {
      id: "empty_hypothesis",
      reference: "some words here".split(" "),
      hypothesis: [],
    },
  ];

  const nistCases: NistCase[] = [
    {
      id: "doctest_hyp1",
      references: [
        "It is a guide to action that ensures that the military will forever heed Party commands".split(" "),
        "It is the guiding principle which guarantees the military forces always being under the command of the Party".split(" "),
        "It is the practical guide for the army always to heed the directions of the party".split(" "),
      ],
      hypothesis: "It is a guide to action which ensures that the military always obeys the commands of the party".split(" "),
    },
    {
      id: "doctest_hyp2",
      references: [
        "It is a guide to action that ensures that the military will forever heed Party commands".split(" "),
        "It is the guiding principle which guarantees the military forces always being under the command of the Party".split(" "),
        "It is the practical guide for the army always to heed the directions of the party".split(" "),
      ],
      hypothesis: "It is to insure the troops forever hearing the activity guidebook that party direct".split(" "),
    },
    {
      id: "identical_no_penalty",
      references: [["the", "cat", "sat", "on", "the", "mat"]],
      hypothesis: ["the", "cat", "sat", "on", "the", "mat"],
    },
    {
      id: "short_hypothesis_penalty",
      references: [
        ["one", "two", "three", "four", "five", "six"],
        ["one", "two"],
      ],
      hypothesis: ["one", "two", "three"],
      n: 3,
    },
    {
      id: "ngram_order_2",
      references: [
        ["a", "b", "c", "d"],
        ["a", "b", "x", "y"],
      ],
      hypothesis: ["a", "b", "c", "z"],
      n: 2,
    },
  ];

  const jsChrf = chrfCases.map((c) =>
    sentenceChrF(c.reference, c.hypothesis, {
      minLen: c.min_len,
      maxLen: c.max_len,
      beta: c.beta,
      ignoreWhitespace: c.ignore_whitespace,
    }),
  );
  const jsNist = nistCases.map((c) => sentenceNist(c.references, c.hypothesis, { n: c.n }));

  const payload = JSON.stringify({
    chrf: chrfCases.map(({ id: _id, ...rest }) => rest),
    nist: nistCases.map(({ id: _id, ...rest }) => rest),
  });
  const proc = Bun.spawnSync(
    ["python3", "bench/python_translation_metrics_baseline.py", "--payload", payload],
    {
      cwd: resolve(import.meta.dir, ".."),
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  if (proc.exitCode !== 0) {
    throw new Error(`python translation metrics baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  }
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as {
    chrf: number[];
    nist: number[];
  };

  let maxAbsDiff = 0;
  const diffs: Array<{ metric: string; id: string; js: number; py: number; absDiff: number }> = [];
  const compare = (metric: string, cases: Array<{ id: string }>, js: number[], pyVals: number[]) => {
    if (js.length !== pyVals.length) throw new Error(`${metric} case count mismatch`);
    cases.forEach((c, i) => {
      const absDiff = Math.abs(js[i]! - pyVals[i]!);
      maxAbsDiff = Math.max(maxAbsDiff, absDiff);
      diffs.push({ metric, id: c.id, js: js[i]!, py: pyVals[i]!, absDiff });
    });
  };
  compare("chrf", chrfCases, jsChrf, py.chrf);
  compare("nist", nistCases, jsNist, py.nist);

  const parity = diffs.every((row) => row.absDiff <= TOLERANCE);
  if (!parity) {
    throw new Error(
      `chrf/nist parity failed beyond ${TOLERANCE}:\n${diffs
        .filter((row) => row.absDiff > TOLERANCE)
        .map((row) => JSON.stringify(row))
        .join("\n")}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        parity,
        tolerance_used: TOLERANCE,
        max_abs_diff: maxAbsDiff,
        chrf_cases: chrfCases.length,
        nist_cases: nistCases.length,
        scores: diffs,
      },
      null,
      2,
    ),
  );
}

main();
