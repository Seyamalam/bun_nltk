import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { corpusChrF, nistLengthPenalty, sentenceChrF, sentenceNist } from "../index";

const REF1 = "It is a guide to action that ensures that the military will forever heed Party commands".split(" ");
const HYP1 = "It is a guide to action which ensures that the military always obeys the commands of the party".split(" ");
const HYP2 = "It is to insure the troops forever hearing the activity guidebook that party direct".split(" ");

const NIST_REFS = [
  "It is a guide to action that ensures that the military will forever heed Party commands".split(" "),
  "It is the guiding principle which guarantees the military forces always being under the command of the Party".split(" "),
  "It is the practical guide for the army always to heed the directions of the party".split(" "),
];

test("sentenceChrF matches nltk doctest values", () => {
  expect(sentenceChrF(REF1, HYP1)).toBeCloseTo(0.6349, 3);
  expect(sentenceChrF(REF1, HYP2)).toBeCloseTo(0.333, 3);
  expect(sentenceChrF("the cat is on the mat".split(" "), "the the the the the the the".split(" "))).toBeCloseTo(0.1468, 3);
});

test("sentenceChrF accepts strings and token arrays identically", () => {
  expect(sentenceChrF(REF1.join(" "), HYP1.join(" "))).toBeCloseTo(sentenceChrF(REF1, HYP1), 12);
});

test("sentenceChrF supports custom n-gram ranges and beta", () => {
  const score = sentenceChrF(REF1, HYP1, { minLen: 2, maxLen: 3 });
  expect(score).toBeCloseTo(0.6617, 3);
  expect(score).toBeGreaterThan(0);
  expect(sentenceChrF(REF1, HYP1, { beta: 2.0 })).toBeLessThan(sentenceChrF(REF1, HYP1, { beta: 3.0 }));
});

test("sentenceChrF epsilon behavior on empty or disjoint inputs", () => {
  expect(sentenceChrF(["aaa", "bbb"], ["xxx", "yyy"])).toBeCloseTo(1e-16, 15);
  expect(sentenceChrF(["some", "words"], [])).toBeCloseTo(1e-16, 15);
});

test("corpusChrF macro-averages over sentences and n-gram orders", () => {
  const ref2 = "It is the guiding principle which guarantees the military forces always being under the command of the Party".split(" ");
  const score = corpusChrF([REF1, ref2, REF1, ref2], [HYP1, HYP2, HYP2, HYP1]);
  expect(score).toBeCloseTo(0.391, 3);
});

test("sentenceNist matches nltk doctest values", () => {
  expect(sentenceNist(NIST_REFS, HYP1)).toBeCloseTo(3.3709, 3);
  expect(sentenceNist(NIST_REFS, HYP2)).toBeCloseTo(1.4619, 3);
});

test("nistLengthPenalty follows Doddington eq. 3", () => {
  expect(nistLengthPenalty(6, 6)).toBe(1);
  expect(nistLengthPenalty(6, 9)).toBe(1);
  expect(nistLengthPenalty(6, 4)).toBeCloseTo(Math.exp((Math.log(0.5) / Math.log(1.5) ** 2) * Math.log(4 / 6) ** 2), 12);
  expect(nistLengthPenalty(6, 0)).toBe(0);
});

test("sentenceNist applies no penalty when hypothesis length matches references", () => {
  const score = sentenceNist([["the", "cat", "sat", "on", "the", "mat"]], ["the", "cat", "sat", "on", "the", "mat"], { n: 3 });
  expect(score).toBeGreaterThan(0);
});

test("sentenceNist throws when hypotheses are shorter than the n-gram order (python ZeroDivisionError)", () => {
  expect(() => sentenceNist([["one", "two", "three"]], ["one", "two"])).toThrow();
  expect(() => sentenceNist([["some", "words", "here"]], [])).toThrow();
});

test("optional python parity for chrF and NIST via nltk baselines", () => {
  const chrfCases = [
    { reference: REF1, hypothesis: HYP1 },
    { reference: "the cat is on the mat".split(" "), hypothesis: "the the the the the the the".split(" ") },
    { reference: REF1.join(" "), hypothesis: HYP1.join(" "), min_len: 2, max_len: 3 },
  ];
  const nistCases = [
    { references: NIST_REFS, hypothesis: HYP1, n: 5 },
    { references: [["one", "two", "three", "four", "five", "six"]], hypothesis: ["one", "two"], n: 2 },
  ];
  const jsChrf = chrfCases.map((c) =>
    sentenceChrF(c.reference, c.hypothesis, { minLen: c.min_len, maxLen: c.max_len }),
  );
  const jsNist = nistCases.map((c) => sentenceNist(c.references, c.hypothesis, { n: c.n }));

  const proc = Bun.spawnSync(
    [
      "python3",
      "bench/python_translation_metrics_baseline.py",
      "--payload",
      JSON.stringify({ chrf: chrfCases, nist: nistCases }),
    ],
    { cwd: resolve(import.meta.dir, ".."), stdout: "pipe", stderr: "pipe" },
  );
  if (proc.exitCode !== 0) {
    console.warn("skipping python chrF/NIST parity:", new TextDecoder().decode(proc.stderr).trim());
    return;
  }
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as { chrf: number[]; nist: number[] };
  jsChrf.forEach((score, i) => expect(Math.abs(score - py.chrf[i]!)).toBeLessThanOrEqual(1e-9));
  jsNist.forEach((score, i) => expect(Math.abs(score - py.nist[i]!)).toBeLessThanOrEqual(1e-9));
});
