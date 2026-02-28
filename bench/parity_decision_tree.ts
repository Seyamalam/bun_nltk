import { resolve } from "node:path";
import { trainDecisionTreeTextClassifier, type DecisionTreeExample } from "../index";

const trainRows: DecisionTreeExample[] = [
  { label: "tech", text: "kernel memory cpu scheduler cache" },
  { label: "tech", text: "server database api throughput latency" },
  { label: "finance", text: "bond yield inflation rates earnings" },
  { label: "finance", text: "liquidity equity guidance central bank" },
];

const testRows: DecisionTreeExample[] = [
  { label: "tech", text: "cpu cache scheduler" },
  { label: "finance", text: "bond rates inflation" },
  { label: "tech", text: "api server latency" },
  { label: "finance", text: "equity earnings bank" },
];

function main() {
  const clf = trainDecisionTreeTextClassifier(trainRows, { maxDepth: 8, minSamples: 1, maxCandidateFeatures: 128 });
  const jsPred = testRows.map((row) => clf.classify(row.text));
  const jsEval = clf.evaluate(testRows);

  const payload = JSON.stringify({ train: trainRows, test: testRows, rounds: 1 });
  const proc = Bun.spawnSync(["python", "bench/python_decision_tree_baseline.py", "--payload", payload], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) throw new Error(new TextDecoder().decode(proc.stderr));
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as {
    accuracy: number;
    predictions: string[];
  };

  const agree =
    py.predictions.length === jsPred.length
      ? jsPred.filter((pred, i) => pred === py.predictions[i]!).length / jsPred.length
      : 0;
  const parity = jsEval.accuracy >= 0.5 && py.accuracy >= 0.5 && agree >= 0.5;
  if (!parity) {
    throw new Error(
      `decision tree parity mismatch: js_acc=${jsEval.accuracy.toFixed(4)} py_acc=${py.accuracy.toFixed(4)} agreement=${agree.toFixed(4)}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        parity,
        js_accuracy: jsEval.accuracy,
        py_accuracy: py.accuracy,
        agreement: agree,
      },
      null,
      2,
    ),
  );
}

main();
