import { expect, test } from "bun:test";
import { RustMaxentClassifier } from "../src/feature_maxent.ts";
import { BinaryMaxentFeatureEncoding, TypedMaxentFeatureEncoding, pythonFloat,
  type MaxentEncodingExample, type MaxentFeatureset } from "../src/maxent_feature_encoding.ts";
import { WasmNltk } from "../src/wasm.ts";
import { MaxentClassifier } from "../src/classifier_compat.ts";

type Case = {
  typed: boolean; algorithm: "iis" | "gis"; iterations: number; cutoff: number;
  always: boolean; unseen: boolean; rows: MaxentEncodingExample[]; probes: MaxentFeatureset[];
};

test("Custom Binary/Typed weighted IIS/GIS train, encode, prob/logprob and JSON match NLTK 3.10.3", async () => {
  const cases: Case[] = [];
  const rows: MaxentEncodingExample[] = [
    [{ n: 0.25, i: 1, x: "a", nil: null, flag: true }, "B"],
    [{ n: pythonFloat(1), i: 2, x: "b", nil: "None", flag: false }, "A"],
    [{ n: 1.5, i: 1, x: "b", nil: null, flag: true }, "B"],
    [{ n: 0.5, i: 3, x: "a", nil: "None", flag: false }, "A"],
    [{ n: 0.75, i: 2, x: "a", nil: null, flag: true }, "A"],
    [{ n: 1.25, i: 1, x: "b", nil: "None", flag: false }, "B"],
  ];
  const probes: MaxentFeatureset[] = [
    ...rows.map(row => row[0]), {}, { x: "unseen", nil: undefined }, { n: pythonFloat(1), i: 0 },
    { n: -0.5, i: -2 }, { n: true, flag: 1 }, { n: 1, flag: false }, { n: 2.5, i: 4, other: "new" },
  ];
  for (const typed of [false, true]) for (const algorithm of ["iis", "gis"] as const)
    for (const iterations of [1, 5, 20]) for (const cutoff of [0, 2]) for (const always of [false, true])
      cases.push({ typed, algorithm, iterations, cutoff, always, unseen: true, rows, probes });
  const python = Bun.spawnSync(["python3", "-c", `
import json,sys,math,nltk,numpy
from nltk.classify.maxent import MaxentClassifier,BinaryMaxentFeatureEncoding,TypedMaxentFeatureEncoding
assert nltk.__version__=='3.10.3'
assert sys.version_info[:3]==(3,14,4)
# NLTK's unattested-feature path uses this removed NumPy 1.x constant.
# Restore only the constant, without changing NLTK's algorithms.
numpy.NINF=-numpy.inf
def features(row):
    return {k:float(v['value']) if isinstance(v,dict) else v for k,v in row.items()}
out=[]
for c in json.load(sys.stdin):
    cls=TypedMaxentFeatureEncoding if c['typed'] else BinaryMaxentFeatureEncoding
    rows=[(features(f),l) for f,l in c['rows']]
    enc=cls.train(rows,c['cutoff'],labels=['A','B'],alwayson_features=c['always'],unseen_features=c['unseen'])
    if c['algorithm']=='gis': enc.C=12
    model=MaxentClassifier.train(rows,algorithm=c['algorithm'],encoding=enc,max_iter=c['iterations'],trace=0)
    assert not any(math.isnan(w) for w in model.weights()), (c['typed'],c['algorithm'],c['iterations'],c['cutoff'],c['always'],model.weights())
    result=[]
    for f in c['probes']:
        f=features(f); dist=model.prob_classify(f)
        result.append({l:[dist.prob(l),dist.logprob(l)] for l in model.labels()})
    out.append({'results':result,'weights':{enc.describe(i):('-Infinity' if w==-math.inf else float(w)) for i,w in enumerate(model.weights())},
      'encoding':[{l:[[enc.describe(i),v] for i,v in enc.encode(features(f),l)] for l in enc.labels()} for f in c['probes']]})
def safe(v):
    if isinstance(v,float) and not math.isfinite(v): return 'NaN' if math.isnan(v) else ('-Infinity' if v<0 else 'Infinity')
    if isinstance(v,list): return [safe(x) for x in v]
    if isinstance(v,dict): return {k:safe(x) for k,x in v.items()}
    return v
print(json.dumps(safe(out),allow_nan=False))
`], { stdin: new TextEncoder().encode(JSON.stringify(cases.map(c => ({ ...c, probes: c.probes.map(f =>
  Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v === undefined ? null : v]))) })))), stdout: "pipe", stderr: "pipe", timeout: 120_000 });
  if (python.exitCode !== 0) throw new Error(new TextDecoder().decode(python.stderr));
  const expected = JSON.parse(new TextDecoder().decode(python.stdout)) as Array<{
    results: Array<Record<string, [number | string, number | string]>>;
    weights: Record<string, number | "-Infinity">;
    encoding: Array<Record<string, Array<[string, number]>>>;
  }>;
  const runtime = await WasmNltk.init();
  try {
    for (const [index, c] of cases.entries()) {
      const Encoding = c.typed ? TypedMaxentFeatureEncoding : BinaryMaxentFeatureEncoding;
      const encoding = Encoding.train(c.rows, c.cutoff, ["A", "B"], { alwayson_features: c.always, unseen_features: c.unseen });
      const supplied = Object.assign(encoding, c.algorithm === "gis" ? { C: 12 } : {});
      const model = RustMaxentClassifier.train(runtime, c.rows, { algorithm: c.algorithm, max_iter: c.iterations, encoding: supplied });
      const restored = RustMaxentClassifier.fromJSON(runtime, JSON.parse(JSON.stringify(model.toJSON())));
      try {
        const wanted = expected[index]!;
        for (const [id, weight] of model.weights().entries()) {
          const want = wanted.weights[encoding.describe(id)]!;
          if (want === "-Infinity") expect(weight).toBe(-Infinity);
          else expect(Math.abs(weight - want), `case ${index} weight ${id}`).toBeLessThan(1e-8);
        }
        for (const [p, probe] of c.probes.entries()) {
          for (const label of encoding.labels()) {
            expect(encoding.encode(probe, label).map(([id, v]) => [encoding.describe(id), v]), `case ${index} encoding ${p}`)
              .toEqual(wanted.encoding[p]![label]!);
          }
          expect(restored.predict(probe)).toEqual(model.predict(probe));
          const dist = model.prob_classify(probe);
          const predictions = model.predict(probe);
          for (const row of predictions) {
            const [prob, log] = wanted.results[p]![row.label]!;
            if (typeof prob === "string") expect(row.probability).toBe(Number(prob));
            else expect(Math.abs(row.probability - prob), `case ${index} prob ${p}`).toBeLessThan(1e-9);
            if (typeof log === "string") expect(row.logProb).toBe(Number(log));
            else expect(Math.abs(row.logProb - log), `case ${index} log ${p}`).toBeLessThan(1e-8);
            expect(dist.prob(row.label)).toBe(row.probability);
            expect(dist.logprob(row.label)).toBe(row.logProb);
          }
          if (predictions.every(row => Number.isFinite(row.probability))) {
            const best = [...predictions].sort((a, b) => b.probability - a.probability || b.label.localeCompare(a.label))[0]!;
            expect(model.classify(probe)).toBe(best.label);
          }
        }
      } finally { restored.dispose(); model.dispose(); encoding.dispose(); }
    }
  } finally { runtime.dispose(); }
});

test("Custom encoding retains Python equality, rejects NaN, and is caller-owned", async () => {
  const runtime = await WasmNltk.init();
  const rows: MaxentEncodingExample[] = [[{ x: true, nil: null }, "A"], [{ x: "1", nil: "None" }, "B"]];
  const encoding = BinaryMaxentFeatureEncoding.train(rows);
  try {
    const model = RustMaxentClassifier.train(runtime, rows, { encoding, maxIter: 5 });
    expect(model.predict({ x: true, nil: null })).toEqual(model.predict({ x: 1, nil: undefined }));
    expect(() => model.predict({ x: NaN })).toThrow("finite");
    const before = encoding.encode({ x: true }, "A");
    model.dispose(); model.dispose();
    expect(encoding.encode({ x: 1 }, "A")).toEqual(before);
    expect(() => model.predict({})).toThrow("disposed");
  } finally { encoding.dispose(); runtime.dispose(); }
});

test("Custom MaxEnt validates serialized contracts and compatibility aliases", async () => {
  const runtime = await WasmNltk.init();
  const rows: MaxentEncodingExample[] = [[{ n: pythonFloat(1), x: "a" }, "A"], [{ n: 0.5, x: "b" }, "B"]];
  const encoding = TypedMaxentFeatureEncoding.train(rows);
  try {
    const classifier = MaxentClassifier.train(rows, { encoding, maxIter: 5 });
    try {
      expect(classifier.prob_classify_many(rows.map(row => row[0])).map(dist => dist.prob("A")))
        .toEqual(classifier.probClassifyMany(rows.map(row => row[0])).map(dist => dist.prob("A")));
      expect(classifier.classify_many(rows.map(row => row[0]))).toEqual(classifier.classifyMany(rows.map(row => row[0])));
      expect(() => MaxentClassifier.train(rows, { encoding, algorithm: "sgd" })).toThrow("Rust IIS/GIS");
    } finally { classifier.dispose(); }
    const model = RustMaxentClassifier.train(runtime, rows, { encoding, maxIter: 5 });
    try {
      const payload = model.toJSON();
      if (payload.version !== 2) throw new Error("expected custom format");
      expect(() => RustMaxentClassifier.fromJSON(runtime, { ...payload, weights: [NaN] })).toThrow("weights");
      expect(() => RustMaxentClassifier.fromJSON(runtime, { ...payload, weights: [] })).toThrow("length");
      expect(() => RustMaxentClassifier.fromJSON(runtime, { ...payload, algorithm: "gis" })).toThrow("C");
      expect(() => model.mostInformativeFeatures()).toThrow("not integrated");
      const restored = RustMaxentClassifier.fromJSON(runtime, JSON.parse(JSON.stringify(payload)));
      try { expect(restored.toJSON()).toEqual(payload); } finally { restored.dispose(); }
    } finally { model.dispose(); }
    const overridden = new BinaryMaxentFeatureEncoding(["A"], []);
    try {
      overridden.encode = () => [];
      expect(() => RustMaxentClassifier.train(runtime, [[{}, "A"]], { encoding: overridden })).toThrow("overridden");
    } finally { overridden.dispose(); }
  } finally { encoding.dispose(); runtime.dispose(); }
});
