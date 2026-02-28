import { rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { trainDecisionTreeTextClassifier, type DecisionTreeExample } from "../index";

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function generateDataset(trainSize = 2400, testSize = 600): { train: DecisionTreeExample[]; test: DecisionTreeExample[] } {
  const tech = ["kernel", "memory", "cpu", "server", "cache", "api", "latency", "throughput"];
  const fin = ["bond", "yield", "inflation", "rates", "equity", "earnings", "liquidity", "guidance"];
  const common = ["market", "signal", "trend", "report", "analysis"];
  const row = (label: "tech" | "finance", i: number): DecisionTreeExample => {
    const lex = label === "tech" ? tech : fin;
    const a = lex[i % lex.length]!;
    const b = lex[(i * 7 + 3) % lex.length]!;
    const c = common[(i * 5 + 1) % common.length]!;
    return { label, text: `${a} ${b} ${c}` };
  };
  const train: DecisionTreeExample[] = [];
  const test: DecisionTreeExample[] = [];
  for (let i = 0; i < trainSize; i += 1) train.push(row(i % 2 === 0 ? "tech" : "finance", i));
  for (let i = 0; i < testSize; i += 1) test.push(row(i % 2 === 0 ? "tech" : "finance", i + trainSize));
  return { train, test };
}

function runNative(train: DecisionTreeExample[], test: DecisionTreeExample[], rounds: number) {
  const timings: number[] = [];
  let accuracy = 0;
  for (let i = 0; i < rounds; i += 1) {
    const started = performance.now();
    const clf = trainDecisionTreeTextClassifier(train, { maxDepth: 8, minSamples: 2, maxCandidateFeatures: 256 });
    accuracy = clf.evaluate(test).accuracy;
    timings.push((performance.now() - started) / 1000);
  }
  return { median_seconds: median(timings), accuracy };
}

function runPython(train: DecisionTreeExample[], test: DecisionTreeExample[], rounds: number) {
  const payloadPath = resolve(import.meta.dir, "datasets", "decision_tree_payload.json");
  writeFileSync(payloadPath, `${JSON.stringify({ train, test, rounds }, null, 2)}\n`, "utf8");
  const proc = Bun.spawnSync(["python", "bench/python_decision_tree_baseline.py", "--payload-file", payloadPath], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  rmSync(payloadPath, { force: true });
  if (proc.exitCode !== 0) {
    throw new Error(`python decision tree baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  }
  return JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as {
    accuracy: number;
    total_seconds: number;
  };
}

function main() {
  const trainSize = Number(process.argv[2] ?? "2400");
  const testSize = Number(process.argv[3] ?? "600");
  const rounds = Number(process.argv[4] ?? "3");
  const { train, test } = generateDataset(trainSize, testSize);
  const native = runNative(train, test, rounds);
  const python = runPython(train, test, rounds);
  console.log(
    JSON.stringify(
      {
        train_size: train.length,
        test_size: test.length,
        rounds,
        native_accuracy: native.accuracy,
        python_accuracy: python.accuracy,
        native_seconds_median: native.median_seconds,
        python_seconds: python.total_seconds,
        speedup_vs_python: python.total_seconds / native.median_seconds,
      },
      null,
      2,
    ),
  );
}

main();
