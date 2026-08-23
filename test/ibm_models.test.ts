import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { IBMModel1 } from "../src/ibm1";
import { IBMModel2 } from "../src/ibm2";

// NLTK doctest: AlignedSent(words=German, mots=English); translation is mots -> words,
// so translation_table['buch']['book'] means P(book | buch)... actually t='buch' is a
// WORD (target) and s='book' is a MOT (source).
const BITEXT = [
  { words: ["klein", "ist", "das", "haus"], mots: ["the", "house", "is", "small"] },
  { words: ["das", "haus", "ist", "ja", "groß"], mots: ["the", "house", "is", "big"] },
  { words: ["das", "buch", "ist", "ja", "klein"], mots: ["the", "book", "is", "small"] },
  { words: ["das", "haus"], mots: ["the", "house"] },
  { words: ["das", "buch"], mots: ["the", "book"] },
  { words: ["ein", "buch"], mots: ["a", "book"] },
];

function runPythonBaseline(payload: object): { translations: Record<string, number> } {
  const proc = Bun.spawnSync(
    ["python3", "bench/python_ibm_baseline.py", "--payload", JSON.stringify(payload)],
    {
      cwd: resolve(import.meta.dir, ".."),
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  if (proc.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(proc.stderr));
  }
  return JSON.parse(new TextDecoder().decode(proc.stdout).trim());
}

test("IBMModel1 matches NLTK doctest values", () => {
  const ibm1 = new IBMModel1(BITEXT, 5);
  // NLTK doctest expects these exact rounded values.
  expect(Number(ibm1.translation_table.get("buch")?.get("book")!.toFixed(3))).toBe(0.889);
  expect(Number(ibm1.translation_table.get("das")?.get("book")!.toFixed(3))).toBe(0.062);
  expect(Number(ibm1.translation_table.get("buch")?.get("NULL")!.toFixed(3))).toBe(0.113);
  expect(Number(ibm1.translation_table.get("ja")?.get("NULL")!.toFixed(3))).toBe(0.073);
});

test("IBMModel2 trains and produces sane probabilities", () => {
  const ibm2 = new IBMModel2(BITEXT, 5);
  const buchBook = ibm2.translation_table.get("buch")?.get("book") ?? 0;
  expect(buchBook).toBeGreaterThan(0.5);
});

test("python3 baseline parity: IBMModel1 + IBMModel2 translation tables", () => {
  const iterations = 5;
  const ibm1 = new IBMModel1(BITEXT, iterations);
  const ibm2 = new IBMModel2(BITEXT, iterations);

  const probes = [
    ["buch", "book"],
    ["das", "book"],
    ["buch", "NULL"],
    ["ja", "NULL"],
    ["haus", "the"],
    ["klein", "small"],
    ["ein", "a"],
    ["groß", "big"],
  ];

  const py = runPythonBaseline({
    bitext: BITEXT,
    iterations,
    probes,
    models: ["ibm1", "ibm2"],
  });

  const tol = 1e-9;
  for (const [model, table] of [
    ["ibm1", ibm1.translation_table],
    ["ibm2", ibm2.translation_table],
  ] as const) {
    for (const [t, s] of probes as unknown as ReadonlyArray<readonly [string, string]>) {
      const jsVal = table.get(t)?.get(s) ?? 1e-12;
      const pyVal = py.translations[`${model}|${t}|${s}`];
      expect(pyVal).toBeDefined();
      expect(Math.abs(jsVal - pyVal!)).toBeLessThanOrEqual(tol * Math.max(1, pyVal!));
    }
  }
});
