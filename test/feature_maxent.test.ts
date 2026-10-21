import { expect, test } from "bun:test";
import { RustMaxentClassifier, type FeatureMaxentOptions } from "../src/feature_maxent";
import { MaxentClassifier } from "../src/classifier_compat";
import { WasmNltk } from "../src/wasm";
import type { FeatureSet, LabeledFeatureset } from "../src/feature_types";

function featureSet(random: () => number, values: unknown[]): FeatureSet {
  const row: FeatureSet = {};
  for (const name of ["x", "y", "CASE", "a b", "😀"]) {
    if (random() < 0.72) row[name] = values[Math.floor(random() * values.length)] as FeatureSet[string];
  }
  return row;
}

test("Rust MaxEnt matches NLTK 3.10.3 IIS and GIS probabilities", async () => {
  const values = ["Red", "red", "😀", "a b", "", 0, 1, true, false, null];
  let seed = 1337;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const cases: Array<{
    train: LabeledFeatureset[]; probes: FeatureSet[]; options: FeatureMaxentOptions;
  }> = [];

  for (const algorithm of ["iis", "gis"] as const) {
    for (const maxIter of [1, 2, 5, 20]) {
      for (const countCutoff of [0, 2]) {
        const train: LabeledFeatureset[] = Array.from({ length: 24 }, (_, index) => [featureSet(random, values), `L${index % 3}`]);
        cases.push({
          train,
          probes: [...Array.from({ length: 20 }, () => featureSet(random, values)), {}, { x: "unseen", y: null }],
          options: { algorithm, maxIter, countCutoff },
        });
      }
    }
    // Explicit label order, including a label with no training rows.
    const train: LabeledFeatureset[] = [
      [{ x: "a", y: 1 }, "B"], [{ x: "a", y: 2 }, "A"], [{ x: "b", y: 1 }, "B"],
      [{ x: "b", y: 2 }, "A"], [{ x: "a", y: 1 }, "A"],
    ];
    cases.push({
      train,
      probes: [{ x: "a", y: 1 }, { x: "b", y: 2 }, { x: "c" }, {}],
      options: { algorithm, maxIter: 12, labels: ["C", "A", "B"] },
    });
    // NLTK's max_acc/min_accdelta path compares log likelihood because of
    // CutoffChecker's historical behavior; these cases exercise that path.
    for (const options of [
      { minLl: 0.02, minLldelta: 0.001 },
      { maxAcc: 0.01, minAccdelta: 0.0001 },
    ] as FeatureMaxentOptions[]) {
      cases.push({
        train: Array.from({ length: 18 }, (_, index) => [featureSet(random, values), `L${index % 2}`]),
        probes: Array.from({ length: 12 }, () => featureSet(random, values)),
        options: { algorithm, maxIter: 40, ...options },
      });
    }
  }

  const python = Bun.spawnSync(["python3", "-c", `
import json,sys,nltk
from nltk.classify import MaxentClassifier
assert nltk.__version__ == '3.10.3', nltk.__version__
out=[]
for c in json.load(sys.stdin):
    o=c['options']
    kwargs=dict(algorithm=o['algorithm'], max_iter=o['maxIter'], count_cutoff=o.get('countCutoff',0), trace=0)
    for key in ('minLl','minLldelta','maxAcc','minAccdelta'):
        if key in o:
            kwargs[{'minLl':'min_ll','minLldelta':'min_lldelta','maxAcc':'max_acc','minAccdelta':'min_accdelta'}[key]]=o[key]
    if o.get('labels') is not None: kwargs['labels']=o['labels']
    model=MaxentClassifier.train([(features,label) for features,label in c['train']], **kwargs)
    rows=[]
    for probe in c['probes']:
        dist=model.prob_classify(probe)
        rows.append({'prediction':model.classify(probe),'probabilities':{label:dist.prob(label) for label in model.labels()}})
    out.append({'labels':model.labels(),'rows':rows})
print(json.dumps(out))
`], { stdin: new TextEncoder().encode(JSON.stringify(cases)), stdout: "pipe", stderr: "pipe", timeout: 120_000 });
  if (python.exitCode !== 0) throw new Error(new TextDecoder().decode(python.stderr));
  const expected = JSON.parse(new TextDecoder().decode(python.stdout)) as Array<{
    labels: string[]; rows: Array<{ prediction: string; probabilities: Record<string, number> }>;
  }>;

  const runtime = await WasmNltk.init();
  try {
    for (const [index, data] of cases.entries()) {
      const model = RustMaxentClassifier.train(runtime, data.train, data.options);
      try {
        const want = expected[index]!;
        expect(model.labels().sort(), `case ${index} labels`).toEqual([...want.labels].sort());
        for (const [probeIndex, probe] of data.probes.entries()) {
          const actual = model.predict(probe);
          expect(actual.map((row) => row.label).sort()).toEqual([...want.labels].sort());
          for (const row of actual) {
            const wanted = want.rows[probeIndex]!.probabilities[row.label]!;
            expect(Math.abs(row.probability - wanted), `case ${index} probe ${probeIndex} ${row.label}`).toBeLessThan(1e-9);
          }
          if (!model.predict(probe).some((row) => row.probability > 0.499)) continue;
          expect(model.classify(probe), `case ${index} probe ${probeIndex} prediction`).toBe(want.rows[probeIndex]!.prediction);
        }
      } finally {
        model.dispose();
      }
    }
  } finally {
    runtime.dispose();
  }
});

test("MaxEnt serialization preserves labels, typed values and probabilities", async () => {
  const runtime = await WasmNltk.init();
  try {
    const train: LabeledFeatureset[] = [
      [{ x: "Red", y: 1, case: null }, "upper"],
      [{ x: "red", y: 2, case: false }, "lower"],
      [{ x: "Red", y: 2, case: true }, "upper"],
      [{ x: "red", y: 1, case: null }, "lower"],
      [{ x: "a b", y: 1, case: "😀" }, "space"],
    ];
    for (const algorithm of ["iis", "gis"] as const) {
      const model = RustMaxentClassifier.train(runtime, train, { algorithm, maxIter: 30 });
      try {
        const payload = model.toJSON();
        const restored = RustMaxentClassifier.fromJSON(runtime, JSON.parse(JSON.stringify(payload)));
        try {
          expect(restored.labels()).toEqual(model.labels());
          for (const probe of train.map((row) => row[0])) {
            expect(restored.predict(probe)).toEqual(model.predict(probe));
            expect(restored.classify(probe)).toBe(model.classify(probe));
          }
          expect(restored.mostInformativeFeatures(3)).toEqual(model.mostInformativeFeatures(3));
        } finally {
          restored.dispose();
        }
      } finally {
        model.dispose();
      }
    }
  } finally {
    runtime.dispose();
  }
});

test("MaxentClassifier defaults to the lossless Rust feature model with NLTK aliases", async () => {
  const train: LabeledFeatureset[] = [
    [{ good: true, score: 9 }, "pos"],
    [{ good: true, score: 8 }, "pos"],
    [{ bad: true, score: 1 }, "neg"],
    [{ bad: true, score: 2 }, "neg"],
  ];
  const classifier = MaxentClassifier.train(train, { maxIter: 20 });
  try {
    expect(classifier.classify({ good: true, score: 10 })).toBe("pos");
    expect(classifier.classify_many([{ bad: true, score: 0 }, { good: true, score: 7 }])).toEqual(["neg", "pos"]);
    const pdist = classifier.prob_classify({ good: true, score: 7 });
    expect(pdist.max()).toBe("pos");
    expect(pdist.prob("pos") + pdist.prob("neg")).toBeCloseTo(1, 12);
    expect(classifier.labels().sort()).toEqual(["neg", "pos"]);
    expect(classifier.most_informative_features(2)).toHaveLength(2);
  } finally {
    classifier.dispose();
  }
});

test("MaxEnt rejects malformed feature data and preserves Python equality", async () => {
  const runtime = await WasmNltk.init();
  try {
    expect(() => RustMaxentClassifier.train(runtime, [])).toThrow("at least one example");
    expect(() => RustMaxentClassifier.train(runtime, [[{ x: 1 }, "A"], [{ x: 2 }, "A"]], { labels: ["A", "B"] }))
      .not.toThrow();
    expect(() => RustMaxentClassifier.train(runtime, [[{ x: 1 }, "C"]], { labels: ["A", "B"] })).toThrow("Unexpected label");
    expect(() => RustMaxentClassifier.train(runtime, [[{ x: 1 }, "A"], [{ x: 2 }, "B"]], { labels: ["A", "A"] })).toThrow("duplicate");
    expect(() => RustMaxentClassifier.train(runtime, [[{ x: 1 }, "A"], [{ x: 2 }, "B"]], { maxIter: -1 })).toThrow();
    const model = RustMaxentClassifier.train(runtime, [
      [{ x: 1 }, "number"], [{ x: true }, "number"], [{ x: "1" }, "string"],
    ]);
    try {
      expect(model.classifyMany([{ x: 1 }, { x: true }, { x: "1" }])).toEqual(["number", "number", "string"]);
    } finally {
      model.dispose();
      model.dispose();
    }
    expect(() => model.classify({ x: 1 })).toThrow("disposed");
  } finally {
    runtime.dispose();
  }
});
