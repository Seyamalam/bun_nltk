import { expect, test } from "bun:test";
import { trainNaiveBayesTextClassifier, loadNaiveBayesTextClassifier, NaiveBayesTextClassifier } from "../src/classify.ts";
import { trainPositiveNaiveBayesTextClassifier, loadPositiveNaiveBayesTextClassifier, PositiveNaiveBayesTextClassifier } from "../src/positive_naive_bayes.ts";
import { WasmNltk } from "../src/wasm.ts";
import type { CategoricalNBSerialized } from "../src/categorical_nb.ts";
import golden from "./fixtures/text_nb_405347e.json";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
function compare(actual: Json, expected: Json): void {
  if (typeof expected === "number") {
    expect(typeof actual).toBe("number");
    // Rust/WASM and JS logarithms differ at the last bit; no rounded labels,
    // probabilities-as-accuracy proxies, or missing serialization fields.
    expect(Math.abs((actual as number) - expected)).toBeLessThanOrEqual(2e-14 * Math.max(1, Math.abs(expected)));
  } else if (Array.isArray(expected)) {
    expect(Array.isArray(actual)).toBe(true);
    expect((actual as Json[]).length).toBe(expected.length);
    expected.forEach((value, index) => compare((actual as Json[])[index]!, value));
  } else if (expected !== null && typeof expected === "object") {
    expect(Object.keys(actual as object).sort()).toEqual(Object.keys(expected).sort());
    for (const [key, value] of Object.entries(expected)) compare((actual as { [key: string]: Json })[key]!, value);
  } else expect(actual).toBe(expected);
}

test("text NB complete outputs match versioned pre-migration TS algorithms", () => {
  const capture = (): Json => {
    const proc = Bun.spawnSync(["bun", "test/fixtures/text_nb_golden.capture.ts"]);
    if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
    return JSON.parse(new TextDecoder().decode(proc.stdout)) as Json;
  };
  compare(capture(), JSON.parse(JSON.stringify(golden)) as Json);
  // Keep CI/package tests independent of git history. Explicit regeneration is
  // available via the capture's --base flag for auditing the frozen fixture.
}, 20000);

test("categorical text NB probabilities and ties match NLTK 3.10.3", () => {
  let seed = 73;
  const random = (n: number): number => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
  const words = ["a", "b", "a'", "'x", "2", "3", "café"];
  const text = (): string => Array.from({ length: random(8) }, () => words[random(words.length)]!).join(" ");
  const cases = Array.from({ length: 12 }, (_, i) => {
    const rows = Array.from({ length: 18 }, (_, j) => ({ label: ["A", "B", "__proto__"][j % 3]!, text: text() }));
    const queries = ["", "unknown", ...Array.from({ length: 10 }, text)];
    return { rows, queries, smoothing: [0.1, 0.5, 1, 2][i % 4]! };
  });
  const script = `import json,sys,re,nltk
from nltk.probability import LidstoneProbDist
assert nltk.__version__ == '3.10.3', nltk.__version__
def features(text):
 d={}
 for word in re.findall(r"[A-Za-z0-9']+",text):
  word=word.lower(); d[word]=d.get(word,0)+1
 return d
out=[]
for case in json.load(sys.stdin):
 clf=nltk.NaiveBayesClassifier.train([(features(r['text']),r['label']) for r in case['rows']],estimator=lambda fd,bins=None:LidstoneProbDist(fd,case['smoothing'],bins))
 out.append([{'label':clf.classify(features(t)), 'scores':{l:clf.prob_classify(features(t)).logprob(l) for l in clf.labels()}} for t in case['queries']])
print(json.dumps(out))`;
  const proc = Bun.spawnSync(["python3", "-c", script], { stdin: Buffer.from(JSON.stringify(cases)) });
  if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
  const expected = JSON.parse(new TextDecoder().decode(proc.stdout)) as Array<Array<{ label: string; scores: Record<string, number> }>>;
  for (const [i, item] of cases.entries()) {
    const model = trainNaiveBayesTextClassifier(item.rows, { smoothing: item.smoothing });
    const restored = loadNaiveBayesTextClassifier(JSON.parse(JSON.stringify(model.toJSON())));
    for (const [j, query] of item.queries.entries()) {
      expect(model.classify(query)).toBe(expected[i]![j]!.label);
      for (const row of model.predict(query)) expect(row.logProb).toBeCloseTo(expected[i]![j]!.scores[row.label]!, 11);
      expect(restored.predict(query)).toEqual(model.predict(query));
    }
  }
}, 20000);

test("text NB round trips, incremental training, replacement training, and detached JSON", () => {
  const rows = [{ label: "B", text: "a a" }, { label: "A", text: "b" }];
  const more = [{ label: "__proto__", text: "b 2" }];
  for (const modelKind of ["categorical", "multinomial"] as const) {
    const model = trainNaiveBayesTextClassifier(rows, { model: modelKind, smoothing: 0.7 });
    const restored = loadNaiveBayesTextClassifier(model.toJSON());
    model.train(more); restored.train(more);
    expect(restored.toJSON()).toEqual(model.toJSON());
    for (const query of ["", "a", "unknown", "a unknown", "b 2"]) expect(restored.predict(query)).toEqual(model.predict(query));
    const detached = model.toJSON(); detached.labels.push("mutated");
    expect(model.labels()).not.toContain("mutated");
  }
  const options = { maxFeatures: 128, positivePrior: 0.4, positiveLabel: "__proto__", negativeLabel: "constructor" };
  const positive = trainPositiveNaiveBayesTextClassifier(["a"], ["b", "a"], options);
  const restored = loadPositiveNaiveBayesTextClassifier(positive.toJSON());
  positive.train([{ text: "b" }], [{ text: "a" }, { text: "a b" }], { positivePrior: 0.8 });
  restored.train(["b"], ["a", "a b"], { positivePrior: 0.8 });
  expect(positive.toJSON()).toEqual(restored.toJSON());
  expect(positive.predict("a b")).toEqual(restored.predict("a b"));
  const fresh = trainPositiveNaiveBayesTextClassifier(["b"], ["a", "a b"], { ...options, positivePrior: 0.8 });
  expect(positive.toJSON()).toEqual(fresh.toJSON());
});

test("positive text NB preserves vocabulary truncation, document frequency, and prior sanitization", () => {
  const words = Array.from({ length: 160 }, (_, i) => `word${String(i).padStart(3, "0")}`);
  const positive = trainPositiveNaiveBayesTextClassifier([words.join(" "), "word159 word159 word159"], [words.join(" "), "word159"], {
    maxFeatures: 3, positivePrior: 2,
  });
  const payload = positive.toJSON();
  expect(payload.options.maxFeatures).toBe(128);
  expect(payload.positivePrior).toBe(0.999);
  expect(payload.vocabulary).toEqual(["word159", ...words.slice(0, 127)]);
  expect(positive.predict("word159 word159")).toEqual(positive.predict("word159"));
  const lower = trainPositiveNaiveBayesTextClassifier(["a"], ["b"], { positivePrior: -2 });
  expect(lower.toJSON().positivePrior).toBe(0.001);
  lower.train(["a"], ["b"], { positivePrior: NaN });
  expect(lower.toJSON().positivePrior).toBe(0.5);
  expect(loadPositiveNaiveBayesTextClassifier(lower.toJSON()).predict("a")).toEqual(lower.predict("a"));
  const saved = lower.toJSON();
  saved.presentLogPos[0] = -1.2350633913959672;
  saved.absentLogPosSum = -5.694899900138186;
  expect(loadPositiveNaiveBayesTextClassifier(saved).toJSON()).toEqual(saved);
});

test("text NB preserves empty and all-OOV v1 contracts and rejects malformed models", () => {
  for (const kind of ["categorical", "multinomial"] as const) {
    const empty = new NaiveBayesTextClassifier({ model: kind });
    expect(empty.train([]).predict("")).toEqual([]);
    expect(() => empty.classify("x")).toThrow("no labels");
  }
  const model = trainNaiveBayesTextClassifier([{ label: "A", text: "a a" }, { label: "B", text: "b" }], { model: "multinomial" });
  expect(model.predict("a unknown")).toEqual(model.predict("a"));
  expect(model.predict("unknown")).not.toEqual(model.predict(""));
  const categorical = trainNaiveBayesTextClassifier([{ label: "x", text: "a" }]).toJSON() as CategoricalNBSerialized;
  expect(() => loadNaiveBayesTextClassifier({ ...categorical, features: [["a", [[[1, 2]]]]] })).toThrow();
  expect(() => loadNaiveBayesTextClassifier({ ...categorical, labels: ["x", "x"], labelDocCounts: [1, 0] })).toThrow();
  const positive = new PositiveNaiveBayesTextClassifier();
  expect(() => positive.predict("x")).toThrow("not trained");
  expect(() => positive.train([], ["a"])).toThrow("positive examples");
  expect(() => positive.train(["a"], [])).toThrow("unlabeled examples");
  positive.train(["a"], ["b"]);
  expect(() => loadPositiveNaiveBayesTextClassifier({ ...positive.toJSON(), presentLogPos: [] })).toThrow();
});

test("text NB stateless WASM ABI releases result data with its runtime", async () => {
  const runtime = await WasmNltk.init();
  const result = JSON.parse(runtime.textNaiveBayes(JSON.stringify({ action: "loadPositive", model: {} }))) as { error: string };
  expect(result.error).toContain("missing field");
  runtime.dispose();
  expect(() => runtime.textNaiveBayes("{}")).toThrow("disposed");
});

test("packaged Node root performs Rust text NB training, scoring, and serialization", () => {
  const script = `import { trainNaiveBayesTextClassifier, loadNaiveBayesTextClassifier, trainPositiveNaiveBayesTextClassifier, loadPositiveNaiveBayesTextClassifier } from './dist/portable/index.node.js';
const rows = [{label:'A',text:'a a'},{label:'B',text:'b'}];
const output = [];
for (const kind of ['categorical','multinomial']) {
 const model = trainNaiveBayesTextClassifier(rows,{model:kind,smoothing:0.7});
 const restored = loadNaiveBayesTextClassifier(model.toJSON());
 output.push([model.toJSON(),model.predict('a'),restored.predict('a')]);
}
const positive = trainPositiveNaiveBayesTextClassifier(['a'],['b','a'],{positivePrior:0.3});
output.push([positive.toJSON(),positive.predict('a'),loadPositiveNaiveBayesTextClassifier(positive.toJSON()).predict('a')]);
console.log(JSON.stringify(output));`;
  const proc = Bun.spawnSync(["node", "--input-type=module", "-e", script]);
  if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
  const rows = [{ label: "A", text: "a a" }, { label: "B", text: "b" }];
  const output: unknown[] = [];
  for (const kind of ["categorical", "multinomial"] as const) {
    const model = trainNaiveBayesTextClassifier(rows, { model: kind, smoothing: 0.7 });
    output.push([model.toJSON(), model.predict("a"), loadNaiveBayesTextClassifier(model.toJSON()).predict("a")]);
  }
  const positive = trainPositiveNaiveBayesTextClassifier(["a"], ["b", "a"], { positivePrior: 0.3 });
  output.push([positive.toJSON(), positive.predict("a"), loadPositiveNaiveBayesTextClassifier(positive.toJSON()).predict("a")]);
  expect(JSON.parse(new TextDecoder().decode(proc.stdout))).toEqual(output);
});
