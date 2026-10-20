import { expect, test } from "bun:test";
import { WasmNltk } from "../src/wasm";
import { RustNaiveBayesClassifier, type FeatureSet, type LabeledFeatureset } from "../src/feature_nb";
import { NaiveBayesClassifier } from "../src/classifier_compat";

test("feature Naive Bayes preserves names, types, case and null/missing associations against NLTK", async () => {
  const cases: Array<{ train: LabeledFeatureset[]; probes: FeatureSet[]; smoothing: number }> = [
    { train: [[{ x: "red", y: "blue" }, "A"], [{ x: "blue", y: "red" }, "B"]], probes: [{ x: "red", y: "blue" }, { x: "blue", y: "red" }, {}, { unknown: "red" }], smoothing: 0.5 },
    { train: [[{ x: null }, "none"], [{}, "none"], [{ x: "null" }, "string"]], probes: [{ x: null }, {}, { x: "null" }, { x: "unseen" }], smoothing: 0.5 },
    { train: [[{ "x y": "Red" }, "upper"], [{ "x y": "red" }, "lower"], [{ x: "y Red" }, "other"]], probes: [{ "x y": "Red" }, { "x y": "red" }, { x: "y Red" }], smoothing: 0.5 },
    { train: [[{ x: 1 }, "num"], [{ x: true }, "num"], [{ x: "1" }, "str"]], probes: [{ x: 1 }, { x: true }, { x: "1" }, { x: false }], smoothing: 1 },
  ];
  let seed = 1337;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const choices = ["Red", "red", "a b", "😀", "", 0, 1, 2, true, false, null] as const;
  function features(): FeatureSet {
    const result: FeatureSet = {};
    for (const name of ["x", "y", "CASE", "a b", "😀"]) if (random() < 0.7) result[name] = choices[Math.floor(random() * choices.length)]!;
    return result;
  }
  for (const smoothing of [0.1, 0.5, 1, 2]) {
    const train: LabeledFeatureset[] = Array.from({ length: 120 }, (_, i) => [features(), `label_${i % 3}`]);
    cases.push({ train, probes: Array.from({ length: 150 }, features), smoothing });
  }
  const python = Bun.spawnSync(["python3", "-c", `
import json,sys,nltk
from nltk.classify import NaiveBayesClassifier
from nltk.probability import LidstoneProbDist
assert nltk.__version__ == '3.10.3', nltk.__version__
results=[]
for case in json.load(sys.stdin):
 gamma=case['smoothing']
 model=NaiveBayesClassifier.train(case['train'], estimator=lambda fd,bins=None: LidstoneProbDist(fd,gamma,bins))
 results.append([{'label':model.classify(p),'probabilities':{l:model.prob_classify(p).prob(l) for l in model.labels()}} for p in case['probes']])
print(json.dumps(results))
`], { stdin: new TextEncoder().encode(JSON.stringify(cases)), stdout: "pipe", stderr: "pipe" });
  if (python.exitCode !== 0) throw new Error(new TextDecoder().decode(python.stderr));
  const expected = JSON.parse(new TextDecoder().decode(python.stdout)) as Array<Array<{ label: string; probabilities: Record<string, number> }>>;
  const runtime = await WasmNltk.init();
  try {
    for (const [i, data] of cases.entries()) {
      const classifier = RustNaiveBayesClassifier.train(runtime, data.train, { smoothing: data.smoothing });
      try {
        for (const [j, probe] of data.probes.entries()) {
          expect(classifier.classify(probe), JSON.stringify({ i, j, probe, actual: classifier.predict(probe), expected: expected[i]![j] })).toBe(expected[i]![j]!.label);
          for (const row of classifier.predict(probe)) expect(Math.abs(row.probability - expected[i]![j]!.probabilities[row.label]!)).toBeLessThan(1e-12);
        }
      } finally { classifier.dispose(); }
    }
  } finally { runtime.dispose(); }
});

test("existing NaiveBayesClassifier API now uses lossless Rust features", () => {
  const classifier = NaiveBayesClassifier.train([[{ x: "red", y: "blue" }, "A"], [{ x: "blue", y: "red" }, "B"]]);
  try {
    expect(classifier.classifyMany([{ x: "red", y: "blue" }, { x: "blue", y: "red" }])).toEqual(["A", "B"]);
    expect(classifier.probClassify({ x: "red", y: "blue" }).prob("A")).toBeCloseTo(0.9, 14);
    expect(classifier.probClassify({}).max()).toBe("B");
  } finally { classifier.dispose(); }
});

test("Rust feature classifier validates input and model lifecycle", async () => {
  const runtime = await WasmNltk.init();
  try {
    expect(() => RustNaiveBayesClassifier.train(runtime, [])).toThrow();
    for (const smoothing of [0, -1, NaN, Infinity]) expect(() => RustNaiveBayesClassifier.train(runtime, [[{}, "A"]], { smoothing })).toThrow();
    const classifier = RustNaiveBayesClassifier.train(runtime, [[{ x: undefined }, "A"], [{ x: "null" }, "B"]]);
    expect(classifier.classify({ x: null })).toBe("A");
    expect(() => classifier.predict({ x: NaN })).toThrow(TypeError);
    expect(() => runtime.categoricalNaiveBayesTrain({ pairs: Uint32Array.of(0, 1), offsets: Uint32Array.of(0, 2), labels: Uint32Array.of(0), labelCount: 1, smoothing: 0.5 })).toThrow();
    classifier.dispose();
    classifier.dispose();
    expect(() => classifier.classify({})).toThrow("disposed");
    const other = RustNaiveBayesClassifier.train(runtime, [[{}, "A"]]);
    runtime.dispose();
    expect(() => other.classify({})).toThrow("disposed");
  } finally { runtime.dispose(); }
});
