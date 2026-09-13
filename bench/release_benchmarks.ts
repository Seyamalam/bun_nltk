import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { cpus, platform, release, arch, totalmem } from "node:os";
import { resolve } from "node:path";
import {
  trainNaiveBayesTextClassifier,
  trainMaxEntTextClassifier,
  trainConditionalExponentialTextClassifier,
  trainDecisionTreeTextClassifier,
  trainNgramLanguageModel,
  sentenceTokenizePunkt,
  SentimentIntensityAnalyzer,
  neChunkIob,
  parsePcfgGrammar,
  probabilisticChartParse,
  type ParseTree,
} from "../index";
import golden from "../test/fixtures/nltk-model-parity.json";

type Row = { text: string; label: string };
type ClassifierTask = { kind: "nb" | "maxent" | "condexp" | "decision_tree"; train: Row[]; test: Row[] };
type LmTask = {
  kind: "lm";
  sentences: string[][];
  probes: { word: string; context: string[] }[];
  perplexityTokens: string[];
  order: 3;
  model: "kneser_ney_interpolated";
  discount: number;
};
type Task =
  | ClassifierTask
  | LmTask
  | { kind: "punkt"; text: string }
  | { kind: "sentiment"; texts: string[] }
  | { kind: "ner"; sentences: [string, string][][] }
  | { kind: "pcfg"; grammar: string; sentences: string[][] };
const root = resolve(import.meta.dir, "..");
const output = resolve(root, process.argv[2] ?? "artifacts/release-benchmarks.json");
const rounds = Number(process.argv[3] ?? 5);
if (!Number.isInteger(rounds) || rounds < 3) throw new Error("At least three measured rounds are required");
const python = resolve(root, ".venv/bin/python3");
const sentiment = new SentimentIntensityAnalyzer();
function rows(size: number, offset = 0): Row[] {
  const lex = [
    ["good", "great", "excellent", "happy", "smooth", "fast", "love", "amazing"],
    ["bad", "awful", "terrible", "sad", "broken", "slow", "hate", "angry"],
  ];
  return Array.from({ length: size }, (_, j) => {
    const i = j + offset,
      l = i % 2,
      words = lex[l]!;
    return {
      label: l ? "neg" : "pos",
      text: `${words[i % 8]} ${words[(i * 7 + 3) % 8]} product ${words[(i * 13 + 2) % 8]} support ${l ? "pain" : "joy"}`,
    };
  });
}
const text = golden.tokenizers.map((row) => row.text).join("\n\n");
const tokens = (
  readFileSync(resolve(root, "bench/datasets/gate_synthetic.txt"), "utf8").match(/[A-Za-z0-9']+/g) ?? []
)
  .slice(0, 42000)
  .map((word) => word.toLowerCase());
const sentences = Array.from({ length: Math.floor(tokens.length / 14) }, (_, i) =>
  tokens.slice(i * 14, i * 14 + 14),
);
const pcfg = JSON.parse(
  readFileSync(resolve(root, "test/fixtures/nltk_imported/pcfg_treebank_fixture.json"), "utf8"),
) as { grammar: string; cases: string[][] };
const tasks: Task[] = [
  { kind: "nb", train: rows(2400), test: rows(600, 2400) },
  { kind: "decision_tree", train: rows(2400), test: rows(600, 2400) },
  { kind: "maxent", train: rows(900), test: rows(250, 900) },
  { kind: "condexp", train: rows(1000), test: rows(300, 1000) },
  {
    kind: "lm",
    sentences,
    probes: sentences.slice(0, 20).map((sentence) => ({ word: sentence[2]!, context: sentence.slice(0, 2) })),
    perplexityTokens: sentences[1500]!,
    order: 3,
    model: "kneser_ney_interpolated",
    discount: 0.75,
  },
  { kind: "punkt", text },
  { kind: "sentiment", texts: golden.sentiment.map((row) => row.text) },
  { kind: "ner", sentences: golden.ner.map((row) => row.tokens as [string, string][]) },
  { kind: "pcfg", grammar: pcfg.grammar, sentences: pcfg.cases },
];
function bracket(tree: ParseTree): string {
  return `(${tree.label} ${tree.children.map((child) => (typeof child === "string" ? child : bracket(child))).join(" ")})`;
}
function run(task: Task): unknown {
  switch (task.kind) {
    case "nb":
      return classify(trainNaiveBayesTextClassifier(task.train), task.test);
    case "maxent":
      return classify(trainMaxEntTextClassifier(task.train, { epochs: 12 }), task.test);
    case "condexp":
      return classify(trainConditionalExponentialTextClassifier(task.train, { epochs: 12 }), task.test);
    case "decision_tree":
      return classify(trainDecisionTreeTextClassifier(task.train), task.test);
    case "lm":
      return trainNgramLanguageModel(task.sentences, task).evaluateBatch(task.probes, task.perplexityTokens);
    case "punkt":
      return sentenceTokenizePunkt(task.text);
    case "sentiment":
      return task.texts.map((text) => sentiment.polarityScores(text));
    case "ner":
      return task.sentences.map((tokens) => neChunkIob(tokens.map(([token, tag]) => ({ token, tag }))));
    case "pcfg": {
      const grammar = parsePcfgGrammar(task.grammar);
      return task.sentences.map((tokens) => {
        const result = probabilisticChartParse(tokens, grammar);
        return result ? { tree: bracket(result.tree), prob: result.prob } : null;
      });
    }
  }
}
function classify(model: { classify(text: string): string }, test: Row[]): string[] {
  return test.map((row) => model.classify(row.text));
}
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b),
    i = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[i]! : (sorted[i - 1]! + sorted[i]!) / 2;
}
function equivalent(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number")
    return Math.abs(a - b) <= 1e-10 * Math.max(Math.abs(a), Math.abs(b), 1e-300);
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((x, i) => equivalent(x, b[i]));
  if (a && b && typeof a === "object" && typeof b === "object") {
    const left = a as Record<string, unknown>,
      right = b as Record<string, unknown>;
    return (
      Object.keys(left).length === Object.keys(right).length &&
      Object.keys(left).every((key) => equivalent(left[key], right[key]))
    );
  }
  return a === b;
}
mkdirSync(resolve(root, "artifacts"), { recursive: true });
const results = [];
let pythonVersion = "",
  nltkVersion = "";
for (const task of tasks) {
  console.error(`Benchmarking ${task.kind}: one warmup + ${rounds} measured runs per runtime`);
  run(task);
  const samples: number[] = [];
  let result: unknown;
  for (let i = 0; i < rounds; i++) {
    const start = performance.now();
    result = run(task);
    samples.push((performance.now() - start) / 1000);
  }
  const input = JSON.stringify({ ...task, rounds });
  const payloadPath = resolve(root, `artifacts/release-benchmark-${task.kind}.json`);
  writeFileSync(payloadPath, input);
  const py = Bun.spawnSync([python, "bench/python_release_benchmarks.py", payloadPath], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });
  rmSync(payloadPath);
  if (py.exitCode !== 0) throw new Error(new TextDecoder().decode(py.stderr));
  const reference = JSON.parse(new TextDecoder().decode(py.stdout)) as {
    nltk: string;
    python: string;
    samples_seconds: number[];
    result: unknown;
  };
  pythonVersion = reference.python;
  nltkVersion = reference.nltk;
  const parity = equivalent(result, reference.result);
  const bunMedian = median(samples),
    pythonMedian = median(reference.samples_seconds);
  results.push({
    workload: task.kind,
    input_sha256: createHash("sha256").update(JSON.stringify(task)).digest("hex"),
    input_size:
      "train" in task
        ? { train: task.train.length, test: task.test.length }
        : "text" in task
          ? { characters: task.text.length }
          : "texts" in task
            ? { texts: task.texts.length }
            : { sentences: task.sentences.length },
    parity,
    bun_samples_seconds: samples,
    python_samples_seconds: reference.samples_seconds,
    bun_median_seconds: bunMedian,
    python_median_seconds: pythonMedian,
    python_over_bun: pythonMedian / bunMedian,
  });
  if (!parity) {
    console.error(JSON.stringify({ kind: task.kind, bun: result, python: reference.result }).slice(0, 5000));
  }
}
const report = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  package_version: (await Bun.file(resolve(root, "package.json")).json()).version,
  host: {
    platform: platform(),
    arch: arch(),
    os_release: release(),
    cpu: cpus()[0]?.model,
    logical_cpus: cpus().length,
    memory_bytes: totalmem(),
  },
  runtimes: { bun: Bun.version, python: pythonVersion, nltk: nltkVersion },
  methodology: {
    rounds,
    warmup_rounds: 1,
    timing:
      "In-process wall time; imports, process startup, file I/O and warmup excluded. Text classifiers include feature extraction, training and one test prediction pass; LM includes training and scoring; PCFG includes grammar parsing; pretrained inference excludes one-time model load.",
    execution: "Sequential workloads and runtimes, no concurrent benchmark processes",
    numeric_relative_tolerance: 1e-10,
  },
  results,
};
writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ ok: results.every((row) => row.parity), output, results }, null, 2));
if (results.some((row) => !row.parity)) process.exitCode = 1;
