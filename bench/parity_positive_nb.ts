import { resolve } from "node:path";
import { trainPositiveNaiveBayesTextClassifier } from "../index";

const positiveRows = [
  "excellent amazing great product happy joy",
  "good wonderful fast happy smooth",
  "great smooth support love",
  "joyful excellent quality",
];

const unlabeledRows = [
  ...positiveRows,
  "awful bad terrible product sad hate",
  "slow broken painful angry bad",
  "refund delay broken support",
  "hate angry failure",
];

const testRows = [
  { label: "pos", text: "great happy smooth excellent" },
  { label: "neg", text: "bad broken terrible slow" },
  { label: "pos", text: "wonderful joy good fast" },
  { label: "neg", text: "awful hate angry painful" },
];

function main() {
  const clf = trainPositiveNaiveBayesTextClassifier(positiveRows, unlabeledRows, {
    positivePrior: 0.5,
    positiveLabel: "pos",
    negativeLabel: "neg",
  });
  const jsPred = testRows.map((row) => clf.classify(row.text));
  const jsAcc = clf.evaluate(testRows).accuracy;

  const payload = JSON.stringify({
    positive: positiveRows,
    unlabeled: unlabeledRows,
    test: testRows,
    positive_prior: 0.5,
    positive_label: "pos",
    negative_label: "neg",
    rounds: 1,
  });
  const proc = Bun.spawnSync(["python", "bench/python_positive_nb_baseline.py", "--payload", payload], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as { predictions: string[]; accuracy: number };

  const agreement =
    jsPred.length === py.predictions.length
      ? jsPred.filter((label, idx) => label === py.predictions[idx]!).length / jsPred.length
      : 0;
  const parity = jsAcc >= 0.75 && py.accuracy >= 0.75 && agreement >= 0.5;
  if (!parity) {
    throw new Error(
      `positive nb parity failed: jsAcc=${jsAcc.toFixed(4)} pyAcc=${py.accuracy.toFixed(4)} agreement=${agreement.toFixed(4)}`,
    );
  }
  console.log(JSON.stringify({ parity: true, jsAcc, pyAcc: py.accuracy, agreement }, null, 2));
}

main();
