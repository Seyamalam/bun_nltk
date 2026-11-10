import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadPerceptronTaggerModel, PerceptronTagger, posTagPerceptronAscii, WasmNltk, type GoldSentence } from "../index";

const fixture = JSON.parse(
  readFileSync(resolve(import.meta.dir, "fixtures", "pos_tagger_cases.json"), "utf8"),
) as {
  cases: Array<{ name: string; input: string }>;
};

type PythonResult = {
  token_count: number;
  tags: Array<{ token: string; tag: string }>;
  total_seconds: number;
};

function runPython(text: string): PythonResult {
  const proc = Bun.spawnSync(
    ["python3", "bench/python_tagger_baseline.py", "--text", text, "--model", "models/perceptron_tagger_ascii.json"],
    {
      cwd: resolve(import.meta.dir, ".."),
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  if (proc.exitCode !== 0) {
    throw new Error(`python perceptron baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  }
  return JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as PythonResult;
}

test("perceptron model loads", () => {
  const model = loadPerceptronTaggerModel();
  expect(model.featureCount).toBeGreaterThan(100);
  expect(model.tagCount).toBeGreaterThan(5);
  expect(model.weights.length).toBe(model.featureCount * model.tagCount);
});

test("perceptron Native/JS/WASM/Python parity on fixture cases", async () => {
  const model = loadPerceptronTaggerModel();
  const wasm = await WasmNltk.init();
  try {
    for (const item of fixture.cases) {
      const nativeOut = posTagPerceptronAscii(item.input, { model }).map((row) => ({ token: row.token, tag: row.tag }));
      const js = posTagPerceptronAscii(item.input, { model, useNative: false }).map((row) => ({
        token: row.token,
        tag: row.tag,
      }));
      const wasmOut = posTagPerceptronAscii(item.input, { model, wasm, useWasm: true }).map((row) => ({
        token: row.token,
        tag: row.tag,
      }));
      const py = runPython(item.input).tags;
      expect(nativeOut).toEqual(py);
      expect(js).toEqual(py);
      expect(wasmOut).toEqual(py);
    }
  } finally {
    wasm.dispose();
  }
});

// NLTK 3.10.3 doctest pins — trained-tagger surface.
test("perceptron tagger: NLTK train/tag/normalize contract", () => {
  const t = new PerceptronTagger(false);
  t.train([
    [["today", "NN"], ["is", "VBZ"], ["good", "JJ"], ["day", "NN"]],
    [["yes", "NNS"], ["it", "PRP"], ["beautiful", "JJ"]],
  ] as GoldSentence[]);
  expect([...t.classes].sort()).toEqual(["JJ", "NN", "NNS", "PRP", "VBZ"]);
  // NLTK doctest: [('today','NN'),('is','PRP'),('a','PRP'),('beautiful','JJ'),('day','NN')]
  expect(t.tag("today is a beautiful day".split(" "))).toEqual([
    ["today", "NN"], ["is", "PRP"], ["a", "PRP"], ["beautiful", "JJ"], ["day", "NN"],
  ]);
  // normalize pins
  expect(["word", "Word", "has-hyphen", "-lead", "1999", "12x", "x12", ""].map((w) => t.normalize(w)))
    .toEqual(["word", "word", "!HYPHEN", "-lead", "!YEAR", "!DIGITS", "x12", ""]);
  expect(t.paramFiles("eng")).toEqual([
    "averaged_perceptron_tagger_eng.weights.json",
    "averaged_perceptron_tagger_eng.tagdict.json",
    "averaged_perceptron_tagger_eng.classes.json",
  ]);
});

test("perceptron tagger: NLTK metric surface on trained model", () => {
  const t = new PerceptronTagger(false);
  t.train([
    [["today", "NN"], ["is", "VBZ"], ["good", "JJ"], ["day", "NN"]],
    [["yes", "NNS"], ["it", "PRP"], ["beautiful", "JJ"]],
  ] as GoldSentence[]);
  const gold = [[["today", "NN"], ["is", "VBZ"]]] as GoldSentence[];
  expect(t.accuracy(gold)).toBe(0.5);
  expect(Object.fromEntries(t.precision(gold))).toEqual({ NN: 1, PRP: 0, VBZ: 0 });
  expect(Object.fromEntries(t.recall(gold))).toEqual({ NN: 1, PRP: 0, VBZ: 0 });
  const table = t.evaluatePerTag(gold);
  expect(table).toContain(" NN | 1.0000 | 1.0000 | 1.0000");
  expect(table).toContain("PRP | 0.0000 | 0.0000 | 0.0000");
});

test("perceptron tagger: empty classes predict raises like NLTK max()", () => {
  const t = new PerceptronTagger(false);
  expect(() => t.tag(["x"])).toThrow("max() iterable argument is empty");
});

test("perceptron tagger: encode/decode_json_obj round trip", () => {
  const t = new PerceptronTagger(false);
  t.train([
    [["today", "NN"], ["is", "VBZ"], ["good", "JJ"], ["day", "NN"]],
    [["yes", "NNS"], ["it", "PRP"], ["beautiful", "JJ"]],
  ] as GoldSentence[]);
  const enc = t.encodeJsonObj();
  expect(enc[1]).toEqual({});
  expect([...enc[2]].sort()).toEqual(["JJ", "NN", "NNS", "PRP", "VBZ"]);
  const t2 = new PerceptronTagger(false);
  t2.decodeJsonParams(enc);
  expect([...t2.classes].sort()).toEqual([...t.classes].sort());
  expect(t2.tag("today is a beautiful day".split(" "))).toEqual(
    t.tag("today is a beautiful day".split(" ")),
  );
});
