/** --base evaluates only original algorithms at 405347e, recursively including their TS dependencies. */
import { resolve } from "node:path";
import { TextFeatureVectorizer } from "../../src/features.ts";
import { DecisionTreeTextClassifier } from "../../src/decision_tree.ts";
import { SgdMaxEntTextClassifier } from "../../src/maxent_sgd.ts";
import { IisMaxEnt } from "../../src/maxent_iis.ts";

const base = process.argv.includes("--base");
const modules = new Map<string, string>();
function original(path: string): string {
  const cached = modules.get(path);
  if (cached) return cached;
  const proc = Bun.spawnSync(["git", "show", `405347e:${path}`]);
  if (proc.exitCode !== 0) throw new Error(`missing baseline: ${path}`);
  const source = new TextDecoder().decode(proc.stdout).replace(/from "\.\/([^".]+)"/g,
    (_, name: string) => `from "${name === "native" ? resolve(import.meta.dir, "../../src/native.ts") : original(`src/${name}.ts`)}"`);
  const js = new Bun.Transpiler({ target: "bun" }).transformSync(source, "ts");
  const url = `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
  modules.set(path, url);
  return url;
}
const Vectorizer: typeof TextFeatureVectorizer = base ? (await import(original("src/features.ts"))).TextFeatureVectorizer : TextFeatureVectorizer;
const Tree: typeof DecisionTreeTextClassifier = base ? (await import(original("src/decision_tree.ts"))).DecisionTreeTextClassifier : DecisionTreeTextClassifier;
const Sgd: typeof SgdMaxEntTextClassifier = base ? (await import(original("src/maxent_sgd.ts"))).SgdMaxEntTextClassifier : SgdMaxEntTextClassifier;
const Iis: typeof IisMaxEnt = base ? (await import(original("src/maxent_iis.ts"))).IisMaxEnt : IisMaxEnt;
let seed = 137;
const random = (n: number): number => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
const words = ["a", "A", "b", "x'", "'", "1", "2", "a2", "a10", "café", "É", "constructor"];
const text = (): string => Array.from({ length: random(9) }, () => words[random(words.length)]!).join(" ");
const queries = ["", "unknown", "a a a", "a2 a10 1 2", "café É x'", "constructor", ...Array.from({ length: 8 }, text)];
const rows = [{ label: "__proto__", text: "a a 1 café" }, { label: "constructor", text: "b b x'" }, { label: "A", text: "a2 a10 '" },
  ...Array.from({ length: 15 }, (_, i) => ({ label: ["__proto__", "constructor", "A"][i % 3]!, text: text() }))];
const replacement = [{ label: "z", text: "z z y" }, { label: "y", text: "y y x" }, { label: "z", text: "x z" }];
const vectorizers = [
  {}, { ngramMin: 2, ngramMax: 3 }, { ngramMin: 0, ngramMax: -3, binary: true, maxFeatures: 1 },
  { ngramMin: 1, ngramMax: 3, binary: true, maxFeatures: 65 },
].map((options) => {
  const model = new Vectorizer(options).fit(rows.map((r) => r.text));
  const saved = model.toJSON();
  const sparse = (t: string) => { const v = model.transform(t); return { indices: [...v.indices], values: [...v.values] }; };
  const vectors = queries.map(sparse);
  model.fit(replacement.map((r) => r.text));
  return { options, saved, vectors, retrained: model.toJSON(), retrainedVectors: queries.map(sparse) };
});
const trees = [{}, { maxDepth: 1, minSamples: 1 }, { maxDepth: 9, minSamples: 1, maxCandidateFeatures: 4 }].map((options) => {
  const model = new Tree(options).train(rows);
  const saved = model.toJSON();
  const predictions = queries.map((t) => model.predict(t));
  model.train(replacement);
  return { options, saved, predictions, retrained: model.toJSON(), retrainedPredictions: queries.map((t) => model.predict(t)) };
});
const sgd = [{ epochs: 1 }, { epochs: 7, learningRate: 0.31, l2: 0.4, maxFeatures: 1 }, { epochs: 25, learningRate: 0.02, l2: 0 }].map((options) => {
  const model = new Sgd(options).train(rows);
  const saved = model.toJSON();
  const predictions = queries.map((t) => model.predict(t));
  model.train(replacement);
  return { options, saved, predictions, retrained: model.toJSON(), retrainedPredictions: queries.map((t) => model.predict(t)) };
});
const iis = [-1, 1, 2, 2.5, 9].map((epochs) => {
  const model = new Iis(epochs).train(rows);
  const saved = model.toJSON();
  const predictions = queries.map((t) => model.predict(t));
  model.train(replacement);
  return { epochs, saved, predictions, retrained: model.toJSON(), retrainedPredictions: queries.map((t) => model.predict(t)) };
});
const longRows = [{ label: "A", text: Array.from({ length: 905 }, (_, i) => `w${i}`).join(" ") }, { label: "B", text: "other" }];
const long = new Iis(2).train(longRows);
const capRows = [
  { label: "B", text: Array.from({ length: 180 }, (_, i) => `word${i}`).join(" ") },
  { label: "A", text: "word179 word179 word178" },
];
const capVectorizer = new Vectorizer({ maxFeatures: 1, binary: true }).fit(capRows.map((r) => r.text));
const capSgd = new Sgd({ epochs: 2, maxFeatures: 1, learningRate: 0.3, l2: 0.2 }).train(capRows);
const capTree = new Tree({ maxFeatures: 1, minSamples: 1 }).train(capRows);
const oneIis = new Iis(3).train([{ label: "A", text: "a" }]);
const emptyIis = new Iis(2).train([{ label: "A", text: "" }, { label: "B", text: "É" }]);
console.log(JSON.stringify({ base: "405347e", rows, replacement, queries, vectorizers, trees, sgd, iis,
  longIis: { rows: longRows, saved: long.toJSON(), predictions: ["", "w1 other", longRows[0]!.text].map((t) => long.predict(t)) },
  capped: { rows: capRows, vectorizer: capVectorizer.toJSON(), sgd: capSgd.toJSON(), tree: capTree.toJSON(),
    predictions: ["", "word179 word179 word178", "word150 unknown"].map((t) => ({ sgd: capSgd.predict(t), tree: capTree.predict(t) })) },
  oneIis: { saved: oneIis.toJSON(), predictions: ["", "a a", "a"].map((t) => oneIis.predict(t)) },
  emptyIis: { saved: emptyIis.toJSON(), predictions: ["", "unknown"].map((t) => emptyIis.predict(t)) } }));
