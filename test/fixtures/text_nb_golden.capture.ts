/** Regenerate only with --base: runs the algorithms frozen at 405347e, not migrated code. */
import { resolve } from "node:path";
import { trainNaiveBayesTextClassifier as currentNB } from "../../src/classify.ts";
import { trainPositiveNaiveBayesTextClassifier as currentPositive } from "../../src/positive_naive_bayes.ts";
import type { CategoricalNaiveBayes } from "../../src/categorical_nb.ts";
import type { MultinomialNaiveBayesTextClassifier } from "../../src/multinomial_nb.ts";
import type { PositiveNaiveBayesTextClassifier } from "../../src/positive_naive_bayes.ts";

async function original<T>(path: string, name: string): Promise<T> {
  const proc = Bun.spawnSync(["git", "show", `405347e:${path}`]);
  if (proc.exitCode !== 0) throw new Error("missing versioned TS baseline 405347e");
  const source = new TextDecoder().decode(proc.stdout).replace(/from "\.\/([^".]+)"/g,
    (_, module: string) => `from "${resolve(import.meta.dir, "../../src", `${module}.ts`)}"`);
  const js = new Bun.Transpiler({ target: "bun" }).transformSync(source, "ts");
  const module = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`) as Record<string, T>;
  return module[name]!;
}
const base = process.argv.includes("--base");
const OriginalCategorical = base ? await original<typeof CategoricalNaiveBayes>("src/categorical_nb.ts", "CategoricalNaiveBayes") : undefined;
const OriginalMultinomial = base ? await original<typeof MultinomialNaiveBayesTextClassifier>("src/multinomial_nb.ts", "MultinomialNaiveBayesTextClassifier") : undefined;
const OriginalPositive = base ? await original<typeof PositiveNaiveBayesTextClassifier>("src/positive_naive_bayes.ts", "PositiveNaiveBayesTextClassifier") : undefined;
type NB = { train(examples: Parameters<typeof currentNB>[0]): NB; toJSON(): ReturnType<ReturnType<typeof currentNB>["toJSON"]>; predict(text: string): ReturnType<ReturnType<typeof currentNB>["predict"]> };
const trainNaiveBayesTextClassifier: (examples: Parameters<typeof currentNB>[0], options: Parameters<typeof currentNB>[1]) => NB = base
  ? (examples, options) => (options?.model === "multinomial"
    ? new OriginalMultinomial!(options) : new OriginalCategorical!(options?.smoothing)).train(examples)
  : currentNB;
const trainPositiveNaiveBayesTextClassifier: typeof currentPositive = base
  ? (positive, unlabeled, options) => new OriginalPositive!(options).train(positive, unlabeled, { positivePrior: options?.positivePrior })
  : currentPositive;
const rows = [
  { label: "B", text: "A a a' 2 café 'x" },
  { label: "A", text: "b b a' 1" },
  { label: "B", text: "A 1" },
];
const additional = [{ label: "__proto__", text: "b z" }, { label: "A", text: "z z" }];
const queries = ["", "a", "a a a'", "unseen", "b z", "É 1 'x"];
const nb = ["categorical", "multinomial"].map((kind) => {
  const options = { model: kind as "categorical" | "multinomial", smoothing: 0.7 };
  const model = trainNaiveBayesTextClassifier(rows, options);
  const serialized = model.toJSON();
  const predictions = queries.map((text) => model.predict(text));
  model.train(additional);
  return { options, serialized, predictions, continued: model.toJSON(), continuedPredictions: queries.map((text) => model.predict(text)) };
});
const positive = ["a a a' 'x", "a 1 café"];
const unlabeled = [...positive, "b b 2", "b a'", "'x 1"];
const options = { maxFeatures: 128, positivePrior: 0.3, positiveLabel: "__proto__", negativeLabel: "constructor" };
const model = trainPositiveNaiveBayesTextClassifier(positive, unlabeled, options);
const serialized = model.toJSON();
const predictions = queries.map((text) => model.predict(text));
model.train(unlabeled, positive, { positivePrior: 0.85 });
console.log(JSON.stringify({ base: "405347e", rows, additional, queries, nb, positive: { positive, unlabeled, options, serialized, predictions, retrained: model.toJSON(), retrainedPredictions: queries.map((text) => model.predict(text)) } }));
