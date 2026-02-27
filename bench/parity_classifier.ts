import { resolve } from "node:path";
import { trainNaiveBayesTextClassifier, type NaiveBayesExample } from "../index";

const trainRows: NaiveBayesExample[] = [
  { label: "pos", text: "excellent amazing great product happy joy" },
  { label: "pos", text: "good wonderful fast happy smooth" },
  { label: "neg", text: "awful bad terrible product sad hate" },
  { label: "neg", text: "slow broken painful angry bad" },
];

const testRows: NaiveBayesExample[] = [
  { label: "pos", text: "great happy smooth excellent" },
  { label: "neg", text: "bad broken terrible slow" },
  { label: "pos", text: "wonderful joy good fast" },
  { label: "neg", text: "awful hate angry painful" },
];

function main() {
  const clf = trainNaiveBayesTextClassifier(trainRows, { smoothing: 1.0 });
  const jsPred = testRows.map((row) => clf.classify(row.text));
  const payload = JSON.stringify({
    train: trainRows,
    test: testRows,
    rounds: 1,
  });
  const proc = Bun.spawnSync(["python", "bench/python_classifier_baseline.py", "--payload", payload], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    throw new Error(`python classifier baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  }
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as { predictions: string[]; accuracy: number };
  const jsAcc = clf.evaluate(testRows).accuracy;
  const parity = JSON.stringify(jsPred) === JSON.stringify(py.predictions);
  if (!parity) {
    throw new Error("classifier parity failed");
  }
  console.log(
    JSON.stringify(
      {
        parity,
        js_accuracy: jsAcc,
        py_accuracy: py.accuracy,
      },
      null,
      2,
    ),
  );
}

main();

