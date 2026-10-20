import { expect, test } from "bun:test";
import { RustDecisionTreeClassifier, type FeatureTreeOptions } from "../src/feature_tree";
import { DecisionTreeClassifier } from "../src/classifier_compat";
import { WasmNltk } from "../src/wasm";
import type { FeatureSet, LabeledFeatureset } from "../src/feature_types";

test("Rust categorical tree matches NLTK 3.10.3 with deterministic split-tie ordering", async () => {
  const cases: Array<{ train: LabeledFeatureset[]; probes: FeatureSet[]; options: FeatureTreeOptions }> = [];
  const values = ["Red", "red", "😀", "a b", "", 0, 1, true, false, null];
  for (const binary of [false, true]) {
    for (const depthCutoff of [1, 2, 100]) {
      for (const supportCutoff of [0, 10, 1000]) {
        const train: LabeledFeatureset[] = values.flatMap((value, index) => Array.from({ length: 4 }, (_, j): LabeledFeatureset => [
          { "CASE 😀": value }, `L${(index + (j === 0 ? 1 : 0)) % 3}`,
        ]));
        train.push([{}, "missing"], [{}, "missing"]);
        cases.push({ train, probes: [...values.map((value): FeatureSet => ({ "CASE 😀": value })), {}, { "CASE 😀": "unseen" }], options: { binary, depthCutoff, supportCutoff } });
      }
    }
    // Unique root and child split gains; no reliance on Python's set order.
    for (const depthCutoff of [1, 2, 3]) {
      const train: LabeledFeatureset[] = [];
      for (const [x, y, label, count] of [[0, 0, "A", 20], [0, 1, "B", 10], [1, 0, "C", 15], [1, 1, "C", 15]] as const) {
        for (let i = 0; i < count; i++) train.push([{ x, y }, label]);
      }
      cases.push({ train, probes: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }, { x: 1, y: 1 }, {}], options: { binary, depthCutoff, supportCutoff: 0 } });
    }
  }
  let seed = 1337;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const features = (): FeatureSet => {
    const row: FeatureSet = {};
    for (const name of ["x", "y", "CASE 😀"]) if (random() < 0.75) row[name] = values[Math.floor(random() * values.length)];
    return row;
  };
  for (let i = 0; i < 12; i++) {
    cases.push({ train: Array.from({ length: 80 }, (_, j): LabeledFeatureset => [features(), `L${j % 3}`]),
      probes: Array.from({ length: 50 }, features), options: { binary: i % 2 === 0, depthCutoff: 1 + i % 6, supportCutoff: i % 4 } });
  }
  const python = Bun.spawnSync(["python3", "-c", `
import json,sys,nltk
from nltk.classify import DecisionTreeClassifier
assert nltk.__version__ == '3.10.3', nltk.__version__
out=[]
for c in json.load(sys.stdin):
 o=c['options']
 # NLTK iterates hash sets. Control only candidate order, not the algorithm,
 # to test this library's documented first-seen policy for split ties.
 original_stump=DecisionTreeClassifier.best_stump
 original_binary=DecisionTreeClassifier.best_binary_stump
 values={}
 for features,label in c['train']:
  for name,value in features.items():
   if value not in values.setdefault(name,[]): values[name].append(value)
 def names(rows):
  return list(dict.fromkeys(name for features,label in rows for name in features))
 def ordered_stump(feature_names,rows,verbose=False):
  return original_stump(names(rows),rows,verbose)
 def ordered_binary(feature_names,rows,feature_values,verbose=False):
  return original_binary(names(rows),rows,values,verbose)
 DecisionTreeClassifier.best_stump=staticmethod(ordered_stump)
 DecisionTreeClassifier.best_binary_stump=staticmethod(ordered_binary)
 model=DecisionTreeClassifier.train(c['train'],depth_cutoff=o['depthCutoff'],support_cutoff=o['supportCutoff'],binary=o['binary'])
 out.append({'predictions':[model.classify(p) for p in c['probes']],'labels':sorted(model.labels())})
 DecisionTreeClassifier.best_stump=staticmethod(original_stump)
 DecisionTreeClassifier.best_binary_stump=staticmethod(original_binary)
print(json.dumps(out))
`], { stdin: new TextEncoder().encode(JSON.stringify(cases)), stdout: "pipe", stderr: "pipe", timeout: 30_000 });
  if (python.exitCode !== 0) throw new Error(new TextDecoder().decode(python.stderr));
  const expected = JSON.parse(new TextDecoder().decode(python.stdout)) as Array<{ predictions: string[]; labels: string[] }>;
  const runtime = await WasmNltk.init();
  try {
    for (const [index, data] of cases.entries()) {
      const model = RustDecisionTreeClassifier.train(runtime, data.train, data.options);
      try {
        expect(model.classifyMany(data.probes), `tree case ${index} ${JSON.stringify(data.options)}`).toEqual(expected[index]!.predictions);
        expect(model.labels().sort()).toEqual(expected[index]!.labels);
      } finally { model.dispose(); }
    }
  } finally { runtime.dispose(); }
});

test("untied feature tree matches unmodified NLTK defaults including last-label fallback", async () => {
  const train: LabeledFeatureset[] = [[{ "x y": "Red" }, "A"], [{ "x y": "red" }, "B"], [{}, "missing"]];
  const probes: FeatureSet[] = [{ "x y": "Red" }, { "x y": "red" }, {}, { "x y": "new" }];
  const python = Bun.spawnSync(["python3", "-c", `
import json,sys,nltk
from nltk.classify import DecisionTreeClassifier
assert nltk.__version__ == '3.10.3'
c=json.load(sys.stdin)
t=DecisionTreeClassifier.train(c['train'])
print(json.dumps([t.classify(p) for p in c['probes']]))
`], { stdin: new TextEncoder().encode(JSON.stringify({ train, probes })), stdout: "pipe", stderr: "pipe" });
  if (python.exitCode !== 0) throw new Error(new TextDecoder().decode(python.stderr));
  const runtime = await WasmNltk.init();
  const model = RustDecisionTreeClassifier.train(runtime, train);
  try { expect(model.classifyMany(probes)).toEqual(JSON.parse(new TextDecoder().decode(python.stdout))); }
  finally { model.dispose(); runtime.dispose(); }
});

test("feature tree preserves case, whitespace, associations and Python numeric equality", async () => {
  const runtime = await WasmNltk.init();
  try {
    for (const train of [
      [[{ x: "Red" }, "upper"], [{ x: "red" }, "lower"]],
      [[{ x: "a b" }, "space"], [{ x: "a-b" }, "dash"]],
      [[{ "😀": 1 }, "number"], [{ "😀": "1" }, "string"]],
      [[{ x: "red", y: "blue" }, "A"], [{ x: "blue", y: "red" }, "B"]],
    ] as LabeledFeatureset[][]) {
      const model = RustDecisionTreeClassifier.train(runtime, train);
      try { expect(model.classifyMany(train.map((row) => row[0]))).toEqual(train.map((row) => row[1])); }
      finally { model.dispose(); }
    }
    const model = RustDecisionTreeClassifier.train(runtime, [[{ x: 1 }, "number"], [{ x: true }, "number"], [{ x: "1" }, "string"]]);
    try { expect(model.classifyMany([{ x: 1 }, { x: true }, { x: "1" }])).toEqual(["number", "number", "string"]); }
    finally { model.dispose(); }
  } finally { runtime.dispose(); }
});

test("tree adapter validates parameters, lossless limits and lifecycle", async () => {
  const runtime = await WasmNltk.init();
  const rows: LabeledFeatureset[] = [[{ x: 1, y: 2 }, "A"], [{ x: 2, y: 1 }, "B"]];
  try {
    expect(() => RustDecisionTreeClassifier.train(runtime, [])).toThrow(RangeError);
    for (const depthCutoff of [0, -1, 1.5, NaN, 101]) expect(() => RustDecisionTreeClassifier.train(runtime, rows, { depthCutoff })).toThrow(RangeError);
    for (const entropyCutoff of [-1, NaN, Infinity]) expect(() => RustDecisionTreeClassifier.train(runtime, rows, { entropyCutoff })).toThrow(RangeError);
    expect(() => RustDecisionTreeClassifier.train(runtime, rows, { maxFeatures: 1 })).toThrow("lossy");
    expect(() => RustDecisionTreeClassifier.train(runtime, rows, { maxCandidateFeatures: 1 })).toThrow("lossy");
    expect(() => RustDecisionTreeClassifier.train(runtime, rows, { maxDepth: 1, depthCutoff: 2 })).toThrow("conflicting");
    expect(() => runtime.decisionTreeTrain({ pairs: Uint32Array.of(0, 1, 0, 2), offsets: Uint32Array.of(0, 2), labels: Uint32Array.of(0), labelCount: 1, entropyCutoff: 0.05, depthCutoff: 1, supportCutoff: 0, binary: false })).toThrow();
    const model = RustDecisionTreeClassifier.train(runtime, rows);
    expect(() => model.classify({ x: NaN })).toThrow(TypeError);
    model.dispose(); model.dispose();
    expect(() => model.classify({})).toThrow("disposed");
    const other = RustDecisionTreeClassifier.train(runtime, rows);
    runtime.dispose();
    expect(() => other.classify({})).toThrow("disposed");
    other.dispose();
  } finally { runtime.dispose(); }
});

test("existing feature DecisionTreeClassifier uses Rust and retains one-hot probability extension", () => {
  const model = DecisionTreeClassifier.train([[{ x: "Red" }, "upper"], [{ x: "red" }, "lower"]]);
  try {
    expect(model.classifyMany([{ x: "Red" }, { x: "red" }])).toEqual(["upper", "lower"]);
    expect(model.probClassify({ x: "red" }).prob("lower")).toBe(1);
  } finally { model.dispose(); }
});
