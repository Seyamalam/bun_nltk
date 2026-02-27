import { resolve } from "node:path";
import { trainMaxEntTextClassifier, type MaxEntExample } from "../index";

const trainRows: MaxEntExample[] = [
  { label: "pos", text: "excellent amazing great product happy joy" },
  { label: "pos", text: "good wonderful fast happy smooth" },
  { label: "neg", text: "awful bad terrible product sad hate" },
  { label: "neg", text: "slow broken painful angry bad" },
  { label: "pos", text: "great smooth support love" },
  { label: "neg", text: "broken slow support hate" },
];

const testRows: MaxEntExample[] = [
  { label: "pos", text: "great happy smooth excellent" },
  { label: "neg", text: "bad broken terrible slow" },
  { label: "pos", text: "wonderful joy good fast" },
  { label: "neg", text: "awful hate angry painful" },
];

function main() {
  const clf = trainMaxEntTextClassifier(trainRows, { epochs: 14, learningRate: 0.2, l2: 1e-4, maxFeatures: 4096 });
  const jsPred = testRows.map((row) => clf.classify(row.text));
  const payload = JSON.stringify({
    train: trainRows,
    test: testRows,
    max_iter: 14,
  });
  const proc = Bun.spawnSync(["python", "bench/python_maxent_baseline.py", "--payload", payload], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) throw new Error(`python maxent baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as { predictions: string[]; accuracy: number };
  const agreement =
    jsPred.length === py.predictions.length
      ? jsPred.filter((label, idx) => label === py.predictions[idx]!).length / jsPred.length
      : 0;
  const jsAcc = clf.evaluate(testRows).accuracy;
  if (jsAcc < 0.75 || py.accuracy < 0.75 || agreement < 0.75) {
    throw new Error(`maxent parity failed: jsAcc=${jsAcc}, pyAcc=${py.accuracy}, agreement=${agreement}`);
  }
  console.log(JSON.stringify({ parity: true, jsAcc, pyAcc: py.accuracy, agreement }, null, 2));
}

main();

