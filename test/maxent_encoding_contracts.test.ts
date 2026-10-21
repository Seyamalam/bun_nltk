import { expect, test } from "bun:test";
import { BinaryMaxentFeatureEncoding, TypedMaxentFeatureEncoding, pythonFloat, PYTHON_INT, PYTHON_FLOAT, type MaxentEncodingExample, type MaxentFeatureset } from "../src/maxent_feature_encoding";
import { RustMaxentClassifier, type FeatureMaxentOptions } from "../src/feature_maxent";
import { WasmNltk } from "../src/wasm";

test("Rust Binary/Typed encoding train+encode+describe+labels+length differential NLTK 3.10.3", () => {
  const train: MaxentEncodingExample[] = [
    [{ x: "A", n: 1, flag: true, nil: null }, "B"],
    [{ x: "A", n: 2, flag: false }, "A"],
    [{ x: "B", n: pythonFloat(1), flag: true, nil: null }, "B"],
    [{ x: "B", n: 2.5, flag: 1, nil: "None" }, "A"],
    [{ x: "A", n: 0, flag: false }, "A"],
  ];
  const probes: MaxentFeatureset[] = [{ x: "A", n: -3, flag: true, nil: null }, { x: "new", n: pythonFloat(1), flag: false }, { n: 1.5, flag: 1, nil: "new" }, {}, { unknown: "value" }];
  const cases = [];
  for (const typed of [false, true]) for (const cutoff of [0, 2, 4]) for (const always of [false, true]) for (const unseen of [false, true]) cases.push({ typed, cutoff, always, unseen, train, probes });
  const proc = Bun.spawnSync(["python3", "-c", `
import nltk,json,sys
from nltk.classify.maxent import BinaryMaxentFeatureEncoding,TypedMaxentFeatureEncoding
assert nltk.__version__ == '3.10.3'
def features(fs):
 return {k:(float(v['value']) if isinstance(v,dict) else v) for k,v in fs.items()}
out=[]
for c in json.load(sys.stdin):
 cls=TypedMaxentFeatureEncoding if c['typed'] else BinaryMaxentFeatureEncoding
 d=cls.train([(features(f),l) for f,l in c['train']], c['cutoff'], ['B','A'], alwayson_features=c['always'], unseen_features=c['unseen'])
 # Hash-set order of unseen feature ids is unspecified; compare semantic descriptions.
 out.append({'length':d.length(),'labels':d.labels(),'descriptions':[d.describe(i) for i in range(d.length())],
 'encodings':[[[(d.describe(i),v) for i,v in d.encode(features(f),l)] for l in ['B','A','unknown']] for f in c['probes']]})
print(json.dumps(out))`], { stdin: new TextEncoder().encode(JSON.stringify(cases)), stdout: "pipe", stderr: "pipe", timeout: 120_000 });
  if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
  const expected = JSON.parse(new TextDecoder().decode(proc.stdout)) as Array<{ length: number; labels: string[]; descriptions: string[]; encodings: Array<Array<Array<[string, number]>>> }>;
  for (const [i, c] of cases.entries()) {
    const cls = c.typed ? TypedMaxentFeatureEncoding : BinaryMaxentFeatureEncoding;
    const d = cls.train(train, c.cutoff, ["B", "A"], { alwayson_features: c.always, unseen_features: c.unseen });
    try {
      const wanted = expected[i]!;
      expect(d.length()).toBe(wanted.length);
      expect(d.labels()).toEqual(wanted.labels);
      expect(Array.from({ length: d.length() }, (_, id) => d.describe(id)).sort()).toEqual([...wanted.descriptions].sort());
      for (const [j, f] of probes.entries()) for (const [k, label] of ["B", "A", "unknown"].entries()) {
        expect(d.encode(f, label).map(([id, value]) => [d.describe(id), value]), `case ${i}, probe ${j}, label ${label}`).toEqual(wanted.encodings[j]![k]!);
      }
    } finally { d.dispose(); }
  }
});

test("Encoding constructors preserve supplied feature ids and reject malformed mapping", () => {
  const d = new BinaryMaxentFeatureEncoding(["A", "B"], new Map([
    [["x", null, "A"] as const, 1], [["x", true, "B"] as const, 0],
  ]), true, true);
  try {
    expect(d.encode({ x: 1 }, "B")).toEqual([[0, 1], [3, 1]]);
    expect(d.encode({ x: undefined }, "A")).toEqual([[1, 1], [2, 1]]);
    expect(d.describe(-1)).toBe("x==None and label is 'A'");
    expect(() => d.describe(1.5)).toThrow("expected an int");
    expect(() => d.describe(100)).toThrow("Bad feature id");
  } finally { d.dispose(); }
  expect(() => new BinaryMaxentFeatureEncoding(["A"], [[["x", 1, "A"], 2]])).toThrow("Mapping values");
  expect(() => new BinaryMaxentFeatureEncoding(["A"], [[["x", 1, "A"], 0], [["x", true, "A"], 1]])).toThrow("invalid");
  expect(() => BinaryMaxentFeatureEncoding.train([[{ x: 1 }, "B"]], 0, ["A"])).toThrow("Unexpected label");
});

test("Typed encoding integral Python floats, bool subclass behavior, zeros and empty spaces", () => {
  const d = new TypedMaxentFeatureEncoding(["A"], [[["n", PYTHON_INT, "A"], 0], [["n", PYTHON_FLOAT, "A"], 1]]);
  try {
    expect(d.encode({ n: 0 }, "A")).toEqual([[0, 0]]);
    expect(d.encode({ n: pythonFloat(1) }, "A")).toEqual([[1, 1]]);
    expect(d.encode({ n: true }, "A")).toEqual([]);
  } finally { d.dispose(); }
  const empty = TypedMaxentFeatureEncoding.train([], 0, [], { alwayson_features: true, unseen_features: true });
  expect(empty.labels()).toEqual([]);
  expect(empty.length()).toBe(0);
  expect(empty.encode({ x: null }, "A")).toEqual([]);
  empty.dispose();
  expect(() => empty.encode({}, "A")).toThrow("disposed");
});

test("Custom encoding is rejected rather than silently training the default binary model", async () => {
  const runtime = await WasmNltk.init();
  const encoding = BinaryMaxentFeatureEncoding.train([[{ x: true }, "A"]]);
  try {
    const options = { encoding } as unknown as FeatureMaxentOptions;
    expect(() => RustMaxentClassifier.train(runtime, [[{ x: true }, "A"]], options)).toThrow("not integrated");
  } finally { encoding.dispose(); runtime.dispose(); }
});

test("Existing default IIS/GIS train probabilities and log probabilities remain NLTK-compatible", async () => {
  const train = [[{ x: true, nil: null }, "A"], [{ x: 1 }, "A"], [{ x: false, nil: "None" }, "B"], [{ x: 0 }, "B"]] as const;
  const probes = [{ x: 1, nil: null }, { x: false }, { x: "unseen" }, {}];
  const proc = Bun.spawnSync(["python3", "-c", `
import json,sys,nltk
from nltk.classify import MaxentClassifier
assert nltk.__version__ == '3.10.3'
c=json.load(sys.stdin);out=[]
for algorithm in ['iis','gis']:
 d=MaxentClassifier.train([(f,l) for f,l in c['train']],algorithm=algorithm,max_iter=8,trace=0)
 out.append([{l:[d.prob_classify(f).prob(l),d.prob_classify(f).logprob(l)] for l in d.labels()} for f in c['probes']])
print(json.dumps(out))`], { stdin: new TextEncoder().encode(JSON.stringify({ train, probes })), stdout: "pipe", stderr: "pipe", timeout: 120_000 });
  if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
  const expected = JSON.parse(new TextDecoder().decode(proc.stdout)) as Array<Array<Record<string, [number, number]>>>;
  const runtime = await WasmNltk.init();
  try {
    for (const [i, algorithm] of (["iis", "gis"] as const).entries()) {
      const d = RustMaxentClassifier.train(runtime, train, { algorithm, maxIter: 8 });
      try {
        for (const [j, features] of probes.entries()) for (const row of d.predict(features)) {
          expect(row.probability).toBeCloseTo(expected[i]![j]![row.label]![0], 10);
          expect(row.logProb).toBeCloseTo(expected[i]![j]![row.label]![1], 10);
        }
      } finally { d.dispose(); }
    }
  } finally { runtime.dispose(); }
});
