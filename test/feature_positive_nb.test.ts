import { expect, test } from "bun:test";
import { RustPositiveNaiveBayesClassifier, type FeatureSet } from "../src/feature_nb";
import { PositiveNaiveBayesClassifier } from "../src/classifier_compat";
import { WasmNltk } from "../src/wasm";

test("Rust positive feature NB matches NLTK categorical probabilities, clipping and unseen values", async () => {
  type Case = { positive: FeatureSet[]; unlabeled: FeatureSet[]; probes: FeatureSet[]; prior: number; smoothing: number };
  const cases: Case[] = [
    { positive: [{ x: "red", y: "blue" }], unlabeled: [{ x: "red", y: "blue" }, { x: "blue", y: "red" }], probes: [{ x: "red", y: "blue" }, { x: "blue", y: "red" }, { x: "unseen" }, {}, { unknown: "red" }], prior: 0.5, smoothing: 0.5 },
    { positive: [{ x: null }, {}], unlabeled: [{ x: "null" }, { x: true }, { x: 1 }, {}], probes: [{ x: null }, { x: "null" }, { x: 1 }, { x: true }, { x: false }, {}], prior: 0.7, smoothing: 0.5 },
    { positive: [], unlabeled: [], probes: [{}], prior: 0.5, smoothing: 0.5 },
    { positive: [{ x: "😀" }], unlabeled: [], probes: [{ x: "😀" }, { x: "unknown" }, {}], prior: 0, smoothing: 0.5 },
    { positive: [], unlabeled: [{ x: 1 }], probes: [{ x: 1 }, { x: 2 }, {}], prior: 0.9, smoothing: 0.5 },
  ];
  let seed = 1984;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const values = ["Red", "red", "😀", "a b", "", true, false, 0, 1, 2, null] as const;
  function features(): FeatureSet {
    const row: FeatureSet = {};
    for (const name of ["x", "y", "CASE", "a b", "😀"]) if (random() < 0.75) row[name] = values[Math.floor(random() * values.length)]!;
    return row;
  }
  for (const prior of [0, 0.1, 0.5, 0.9, 0.999]) for (const smoothing of [0.1, 0.5, 1, 2]) {
    cases.push({ positive: Array.from({ length: 30 }, features), unlabeled: Array.from({ length: 75 }, features), probes: Array.from({ length: 40 }, features), prior, smoothing });
  }
  const result = Bun.spawnSync(["python3", "-c", `
import json,sys,nltk
from nltk.classify import PositiveNaiveBayesClassifier
from nltk.probability import LidstoneProbDist
assert nltk.__version__ == '3.10.3'
output=[]
for c in json.load(sys.stdin):
 model=PositiveNaiveBayesClassifier.train(c['positive'],c['unlabeled'],c['prior'],lambda fd,bins: LidstoneProbDist(fd,c['smoothing'],bins))
 output.append([{'positive':model.prob_classify(p).prob(True),'negative':model.prob_classify(p).prob(False),'label':model.classify(p)} for p in c['probes']])
print(json.dumps(output))
`], { stdin: new TextEncoder().encode(JSON.stringify(cases)), stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(new TextDecoder().decode(result.stderr));
  const expected = JSON.parse(new TextDecoder().decode(result.stdout)) as Array<Array<{ positive: number; negative: number; label: boolean }>>;
  const runtime = await WasmNltk.init();
  try {
    cases.forEach((data, i) => {
      const model = RustPositiveNaiveBayesClassifier.train(runtime, data.positive, data.unlabeled, { positivePrior: data.prior, smoothing: data.smoothing });
      try {
        data.probes.forEach((probe, j) => {
          const rows = model.predict(probe), oracle = expected[i]![j]!;
          expect(rows[0]!.probability, JSON.stringify({ i, j, probe, rows, oracle })).toBeCloseTo(oracle.positive, 12);
          expect(rows[1]!.probability).toBeCloseTo(oracle.negative, 12);
          expect(model.classify(probe)).toBe(oracle.label ? "pos" : "neg");
        });
      } finally { model.dispose(); }
    });
  } finally { runtime.dispose(); }
});

test("positive feature compatibility API retains typed associations and True tie order", () => {
  const model = PositiveNaiveBayesClassifier.train([{ x: "red", y: "blue" }], [{ x: "red", y: "blue" }, { x: "blue", y: "red" }], { positiveLabel: "A", negativeLabel: "Z" });
  try {
    expect(model.classifyMany([{ x: "red", y: "blue" }, { x: "blue", y: "red" }])).toEqual(["A", "Z"]);
    expect(model.classify({})).toBe("A");
    expect(model.probClassify({}).max()).toBe("A");
    expect(model.labels()).toEqual(["A", "Z"]);
  } finally { model.dispose(); }
});

test("positive feature classifier validates prior, smoothing, labels and lifecycle", async () => {
  const runtime = await WasmNltk.init();
  try {
    for (const positivePrior of [-1, 1, NaN, Infinity]) expect(() => RustPositiveNaiveBayesClassifier.train(runtime, [], [], { positivePrior })).toThrow(RangeError);
    for (const smoothing of [0, -1, NaN, Infinity]) expect(() => RustPositiveNaiveBayesClassifier.train(runtime, [], [], { smoothing })).toThrow(RangeError);
    expect(() => RustPositiveNaiveBayesClassifier.train(runtime, [], [], { positiveLabel: "same", negativeLabel: "same" })).toThrow(TypeError);
    expect(() => RustPositiveNaiveBayesClassifier.train(runtime, [{ x: NaN }], [])).toThrow(TypeError);
    expect(() => RustPositiveNaiveBayesClassifier.train(runtime, [{ x: 1, y: 2 }], [], { maxFeatures: 1 })).toThrow(RangeError);
    const model = RustPositiveNaiveBayesClassifier.train(runtime, [{ x: undefined }], [{ x: "null" }]);
    expect(model.classify({ x: null })).toBe("pos");
    model.dispose();
    model.dispose();
    expect(() => model.classify({})).toThrow("disposed");
  } finally { runtime.dispose(); }
});
