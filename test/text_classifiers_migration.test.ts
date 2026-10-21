import { expect, test } from "bun:test";
import { TextFeatureVectorizer, flattenSparseBatch, type VectorizerSerialized, type VectorizerOptions } from "../src/features.ts";
import { DecisionTreeTextClassifier, type DecisionTreeSerialized } from "../src/decision_tree.ts";
import { SgdMaxEntTextClassifier, type MaxEntSerialized as SgdSerialized, type MaxEntPrediction, type MaxEntExample, type MaxEntOptions } from "../src/maxent_sgd.ts";
import { IisMaxEnt, type IisSerialized } from "../src/maxent_iis.ts";
import { MaxEntTextClassifier } from "../src/maxent.ts";
import { WasmNltk } from "../src/wasm.ts";
import { train_decision_tree_text_classifier, train_max_ent_text_classifier } from "../src/nltk_aliases.ts";
import fixture from "./fixtures/text_classifiers_405347e.json";

type Snapshot<T, P> = { saved: T; predictions: P[][]; retrained: T; retrainedPredictions: P[][] };
const golden: {
  rows: MaxEntExample[]; replacement: MaxEntExample[]; queries: string[];
  vectorizers: { options: VectorizerOptions; saved: VectorizerSerialized; vectors: { indices: number[]; values: number[] }[]; retrained: VectorizerSerialized }[];
  trees: (Snapshot<DecisionTreeSerialized, { label: string; score: number }> & { options: ConstructorParameters<typeof DecisionTreeTextClassifier>[0] })[];
  sgd: (Snapshot<SgdSerialized, MaxEntPrediction> & { options: MaxEntOptions })[];
  iis: (Snapshot<IisSerialized, MaxEntPrediction> & { epochs: number })[];
} = JSON.parse(JSON.stringify(fixture));

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
function compare(actual: Json, expected: Json, path = ""): void {
  if (typeof expected === "number") {
    expect(typeof actual).toBe("number");
    if (Number.isInteger(expected) && !/weights|bias|probability|logit/.test(path)) {
      expect(actual).toBe(expected);
      return;
    }
    // Accumulated Newton/exp differences, not rounded weights or label-only parity.
    expect(Math.abs((actual as number) - expected)).toBeLessThanOrEqual(2e-12 * Math.max(1, Math.abs(expected)));
  } else if (Array.isArray(expected)) {
    expect(Array.isArray(actual)).toBe(true);
    expect((actual as Json[]).length).toBe(expected.length);
    expected.forEach((value, index) => compare((actual as Json[])[index]!, value, `${path}/${index}`));
  } else if (expected !== null && typeof expected === "object") {
    expect(Object.keys(actual as object).sort()).toEqual(Object.keys(expected).sort());
    for (const [key, value] of Object.entries(expected)) compare((actual as { [key: string]: Json })[key]!, value, `${path}/${key}`);
  } else expect(actual).toBe(expected);
}

test("legacy text vectorizer/tree/SGD/IIS complete snapshots match frozen 405347e TS", () => {
  const proc = Bun.spawnSync(["bun", "test/fixtures/text_classifiers_golden.capture.ts"]);
  if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
  compare(JSON.parse(new TextDecoder().decode(proc.stdout)) as Json, JSON.parse(JSON.stringify(fixture)) as Json);
}, 20000);

test("replacement training and versioned loads retain complete weights, biases, vectors, and OOV", () => {
  for (const item of golden.vectorizers) {
    const model = TextFeatureVectorizer.fromJSON(item.saved);
    expect(model.toJSON()).toEqual(item.saved);
    expect(model.featureCount).toBe(item.saved.vocabulary.length);
    const vectors = model.transformMany(golden.queries);
    expect(vectors.map((v) => ({ indices: [...v.indices], values: [...v.values] }))).toEqual(item.vectors);
    const flat = flattenSparseBatch(vectors);
    expect(flat.docOffsets.at(-1)).toBe(flat.featureIds.length);
    model.fit(golden.replacement.map((r) => r.text));
    expect(model.toJSON()).toEqual(item.retrained);
  }
  for (const item of golden.trees) {
    const model = DecisionTreeTextClassifier.fromJSON(item.saved);
    expect(model.toJSON()).toEqual(item.saved);
    expect(golden.queries.map((t) => model.predict(t))).toEqual(item.predictions);
    model.train(golden.replacement);
    expect(model.toJSON()).toEqual(item.retrained);
    const fresh = new DecisionTreeTextClassifier(item.options).train(golden.replacement);
    expect(model.toJSON()).toEqual(fresh.toJSON());
  }
  for (const item of [...golden.sgd, ...golden.iis]) {
    const model = MaxEntTextClassifier.fromSerialized(item.saved);
    expect(model.toJSON()).toEqual(item.saved);
    compare(golden.queries.map((t) => model.predict(t)) as Json, item.predictions as Json);
    model.train(golden.replacement);
    compare(model.toJSON() as Json, item.retrained as Json);
    compare(golden.queries.map((t) => model.predict(t)) as Json, item.retrainedPredictions as Json);
  }
});

test("empty training, uniform OOV/tie policies, one-label IIS, and detached snapshots", () => {
  const vec = new TextFeatureVectorizer({ ngramMin: 1e8, ngramMax: 1e9 }).fit(["a b"]);
  expect(vec.transform("a").indices.length).toBe(0);
  expect(new TextFeatureVectorizer().fit([]).featureCount).toBe(0);
  const tree = new DecisionTreeTextClassifier();
  expect(() => tree.classify("a")).toThrow("not trained");
  expect(() => tree.train([])).toThrow("requires examples");
  const sgd = new SgdMaxEntTextClassifier();
  expect(sgd.predict("a")).toEqual([]);
  expect(() => sgd.classify("a")).toThrow("no labels");
  expect(() => sgd.train([])).toThrow("at least one");
  expect(() => sgd.train([{ label: "A", text: "a" }])).toThrow("at least 2 labels");
  expect(() => sgd.train([{ label: "A", text: "" }, { label: "B", text: "É" }])).toThrow("empty vocabulary");
  const uniform = SgdMaxEntTextClassifier.fromSerialized({ version: 1, labels: ["A", "B"], vocabulary: ["a"], weights: [[0], [0]], bias: [0, 0],
    options: { epochs: 1, learningRate: 0.1, l2: 0, maxFeatures: 100 } });
  expect(uniform.classify("unknown")).toBe("A");
  const iis = new IisMaxEnt(1);
  expect(iis.predict("a")).toEqual([]);
  expect(() => iis.train([])).toThrow("at least one");
  iis.train([{ label: "A", text: "" }, { label: "B", text: "" }]);
  expect(iis.classify("unknown")).toBe("B");
  expect(iis.toJSON().features).toEqual([]);
  compare(new IisMaxEnt().train([{ label: "A", text: "a" }]).predict("a") as Json, [{ label: "A", probability: 1, logit: 0 }]);
  const surrogateTie = new IisMaxEnt(1).train([{ label: "\u{10000}", text: "" }, { label: "\ue000", text: "" }]);
  expect(surrogateTie.labelsList()).toEqual(["\u{10000}", "\ue000"]);
  expect(surrogateTie.classify("")).toBe("\ue000");
  const saved = uniform.toJSON(); saved.weights[0]![0] = 100; saved.bias[0] = 100;
  expect(uniform.toJSON().weights[0]).toEqual([0]);
  const treeSaved = new DecisionTreeTextClassifier().train(golden.rows).toJSON();
  const restored = DecisionTreeTextClassifier.fromJSON(treeSaved);
  treeSaved.labels.push("mutated");
  expect(restored.toJSON().labels).not.toContain("mutated");
});

test("malformed vector/tree/v1-v2 MaxEnt snapshots reject before scoring", () => {
  const v = golden.vectorizers[0]!.saved;
  expect(() => TextFeatureVectorizer.fromJSON({ ...v, vocabulary: ["a", "a"] })).toThrow();
  expect(() => TextFeatureVectorizer.fromJSON({ ...v, ngramMin: NaN })).toThrow();
  const t = golden.trees[0]!.saved;
  expect(() => DecisionTreeTextClassifier.fromJSON({ ...t, tree: { kind: "split", featureId: 99999, feature: "bad", absent: t.tree, present: t.tree } })).toThrow();
  const s = golden.sgd[0]!.saved;
  expect(() => SgdMaxEntTextClassifier.fromSerialized({ ...s, weights: [[0], ...s.weights.slice(1)] })).toThrow();
  expect(() => SgdMaxEntTextClassifier.fromSerialized({ ...s, bias: [Infinity, ...s.bias.slice(1)] })).toThrow();
  const i = golden.iis[0]!.saved;
  expect(() => IisMaxEnt.fromSerialized({ ...i, version: 2, algorithm: "iis", features: [["a", 0, i.labels[0]!]], weights: [0] })).toThrow();
  expect(() => IisMaxEnt.fromSerialized({ ...i, version: 2, algorithm: "iis", features: [i.features[0]!, i.features[0]!], weights: [0, 0] })).toThrow();
});

test("Rust text IIS feature mapping, base-2 weights and probabilities match NLTK 3.10.3", () => {
  const cases = [2, 5, 9].map((epochs) => ({ rows: golden.rows, queries: golden.queries, epochs }));
  const script = `import json,sys,re,nltk
from nltk.classify.maxent import MaxentClassifier,BinaryMaxentFeatureEncoding
assert nltk.__version__ == '3.10.3',nltk.__version__
def features(text):
 d={}
 for word in re.findall(r"[A-Za-z0-9']+",text):
  word=word.lower();d[word]=d.get(word,0)+1
 return d
out=[]
for case in json.load(sys.stdin):
 train=[(features(r['text']),r['label']) for r in case['rows']]
 encoding=BinaryMaxentFeatureEncoding.train(train,labels=sorted({l for _,l in train}))
 clf=MaxentClassifier.train(train,algorithm='iis',trace=0,max_iter=case['epochs'],encoding=encoding)
 out.append({'features':[list(k) for k in encoding._mapping], 'weights':list(clf.weights()),'predictions':[{l:clf.prob_classify(features(t)).prob(l) for l in encoding.labels()} for t in case['queries']]})
print(json.dumps(out))`;
  const proc = Bun.spawnSync(["python3", "-c", script], { stdin: Buffer.from(JSON.stringify(cases)) });
  if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
  const result = JSON.parse(new TextDecoder().decode(proc.stdout)) as Array<{ features: [string, number, string][]; weights: number[]; predictions: Record<string, number>[] }>;
  for (const [index, c] of cases.entries()) {
    const model = new IisMaxEnt(c.epochs).train(c.rows);
    expect(model.toJSON().features).toEqual(result[index]!.features);
    compare(model.toJSON().weights as Json, result[index]!.weights as Json, "weights");
    for (const [q, text] of c.queries.entries()) {
      for (const row of model.predict(text)) expect(row.probability).toBeCloseTo(result[index]!.predictions[q]![row.label]!, 11);
    }
  }
}, 20000);

test("Rust legacy text tree topology/classification matches sorted-stump NLTK", () => {
  const cases = [{ maxDepth: 1, minSamples: 1 }, { maxDepth: 7, minSamples: 1 }, { maxDepth: 100, minSamples: 10 }];
  const script = `import json,sys,re,nltk
from nltk.classify.decisiontree import DecisionTreeClassifier as Tree
assert nltk.__version__ == '3.10.3',nltk.__version__
original=Tree.best_stump
Tree.best_stump=staticmethod(lambda names,rows,verbose=False:original(sorted(names),rows,verbose))
def features(text):return {w.lower():True for w in re.findall(r"[A-Za-z0-9']+",text)}
def topology(t):
 if t._fname is None:return {'kind':'leaf','label':t._label}
 return {'kind':'split','feature':t._fname,'absent':topology(t._decisions[None]),'present':topology(t._decisions[True])}
p=json.load(sys.stdin);out=[]
for c in p['cases']:
 t=Tree.train([(features(r['text']),r['label']) for r in p['rows']],depth_cutoff=c['maxDepth'],support_cutoff=c['minSamples'])
 out.append({'topology':topology(t),'predictions':[t.classify(features(q)) for q in p['queries']]})
print(json.dumps(out))`;
  const proc = Bun.spawnSync(["python3", "-c", script], { stdin: Buffer.from(JSON.stringify({ cases, rows: golden.rows, queries: golden.queries })) });
  if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
  const result = JSON.parse(new TextDecoder().decode(proc.stdout)) as Array<{ topology: Json; predictions: string[] }>;
  type Node = ReturnType<DecisionTreeTextClassifier["toJSON"]>["tree"];
  function topology(node: Node): Json {
    return node.kind === "leaf" ? { kind: "leaf", label: node.label } : { kind: "split", feature: node.feature, absent: topology(node.absent), present: topology(node.present) };
  }
  cases.forEach((options, index) => {
    const model = new DecisionTreeTextClassifier(options).train(golden.rows);
    expect(topology(model.toJSON().tree)).toEqual(result[index]!.topology);
    expect(golden.queries.map((text) => model.classify(text))).toEqual(result[index]!.predictions);
  });
}, 20000);

test("existing snake_case factories still expose Rust text engines", () => {
  expect(train_decision_tree_text_classifier(golden.rows).toJSON()).toEqual(new DecisionTreeTextClassifier().train(golden.rows).toJSON());
  expect(train_max_ent_text_classifier(golden.rows, { algorithm: "sgd", epochs: 1 }).toJSON()).toEqual(new SgdMaxEntTextClassifier({ epochs: 1 }).train(golden.rows).toJSON());
});

test("text classifier WASM ABI errors and disposal", async () => {
  const runtime = await WasmNltk.init();
  expect(JSON.parse(runtime.textClassifiers('{"action":"loadTree","model":{}}')).error).toContain("missing field");
  runtime.dispose();
  expect(() => runtime.textClassifiers("{}")).toThrow("disposed");
});

test("portable Node root trains, scores and reloads both legacy MaxEnt versions and tree", () => {
  const script = `import {trainMaxEntTextClassifier,loadMaxEntTextClassifier,trainDecisionTreeTextClassifier,loadDecisionTreeTextClassifier} from './dist/portable/index.node.js';
const rows=${JSON.stringify(golden.rows)};const out=[];
for(const algorithm of ['sgd','iis']){const m=trainMaxEntTextClassifier(rows,{algorithm,epochs:2});out.push([m.toJSON(),m.predict('a unknown'),loadMaxEntTextClassifier(m.toJSON()).predict('a unknown')]);}
const t=trainDecisionTreeTextClassifier(rows,{maxDepth:7,minSamples:1});out.push([t.toJSON(),t.predict('a'),loadDecisionTreeTextClassifier(t.toJSON()).predict('a')]);
console.log(JSON.stringify(out));`;
  const proc = Bun.spawnSync(["node", "--input-type=module", "-e", script]);
  if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
  const output: unknown[] = [];
  for (const algorithm of ["sgd", "iis"] as const) {
    const model = new MaxEntTextClassifier({ algorithm, epochs: 2 }).train(golden.rows);
    output.push([model.toJSON(), model.predict("a unknown"), MaxEntTextClassifier.fromSerialized(model.toJSON()).predict("a unknown")]);
  }
  const tree = new DecisionTreeTextClassifier({ maxDepth: 7, minSamples: 1 }).train(golden.rows);
  output.push([tree.toJSON(), tree.predict("a"), DecisionTreeTextClassifier.fromJSON(tree.toJSON()).predict("a")]);
  expect(JSON.parse(new TextDecoder().decode(proc.stdout))).toEqual(output);
});
