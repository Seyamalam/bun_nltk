import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  parsePcfgGrammar,
  probabilisticChartParse,
  trainMaxEntTextClassifier,
  trainNaiveBayesTextClassifier,
  type MaxEntExample,
  type NaiveBayesExample,
  type ParseTree,
} from "../index";

type PcfgFixture = {
  grammar: string;
  cases: string[][];
};

type ClassifierFixture = {
  train: Array<{ label: string; text: string }>;
  test: Array<{ label: string; text: string }>;
};

function selectBalanced<T extends { label: string }>(rows: T[], perLabel: number): T[] {
  const byLabel = new Map<string, T[]>();
  for (const row of rows) {
    const bucket = byLabel.get(row.label) ?? [];
    bucket.push(row);
    byLabel.set(row.label, bucket);
  }
  const out: T[] = [];
  for (const label of [...byLabel.keys()].sort((a, b) => a.localeCompare(b))) {
    out.push(...(byLabel.get(label) ?? []).slice(0, perLabel));
  }
  return out;
}

function runJson(command: string[], cwd: string): Record<string, unknown> {
  const proc = Bun.spawnSync(command, { cwd, stdout: "pipe", stderr: "pipe" });
  if (proc.exitCode !== 0) {
    throw new Error(`command failed (${command.join(" ")}): ${new TextDecoder().decode(proc.stderr)}`);
  }
  return JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as Record<string, unknown>;
}

function main() {
  const root = resolve(import.meta.dir, "..");
  const artifactsDir = resolve(root, "artifacts");
  mkdirSync(artifactsDir, { recursive: true });
  const fixtureDir = resolve(root, "test", "fixtures", "nltk_imported");
  const pcfgPath = resolve(fixtureDir, "pcfg_treebank_fixture.json");
  const clfPath = resolve(fixtureDir, "classifier_movie_reviews_fixture.json");
  if (!existsSync(pcfgPath) || !existsSync(clfPath)) {
    throw new Error(`imported NLTK fixtures missing. expected ${pcfgPath} and ${clfPath}`);
  }

  const pcfgFixture = JSON.parse(readFileSync(pcfgPath, "utf8")) as PcfgFixture;
  const clfFixture = JSON.parse(readFileSync(clfPath, "utf8")) as ClassifierFixture;

  const grammar = parsePcfgGrammar(pcfgFixture.grammar);
  const parserCases = pcfgFixture.cases.slice(0, 10);
  if (parserCases.length === 0) {
    throw new Error("imported parser fixture has zero cases; rerun fixtures:import:nltk");
  }
  const parserPayloadPath = resolve(artifactsDir, "parity_imported_pcfg_payload.json");
  let parserChecks = 0;
  let parserCompared = 0;
  for (const tokens of parserCases) {
    const js = probabilisticChartParse(tokens, grammar);

    writeFileSync(
      parserPayloadPath,
      `${JSON.stringify(
        {
          grammar: pcfgFixture.grammar,
          tokens,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    const py = runJson(
      ["python3", "bench/python_pcfg_baseline.py", "--payload-file", parserPayloadPath],
      root,
    ) as { tree: string | null; prob: number };
    parserCompared += 1;
    if (!js || !py.tree) {
      if (!js && !py.tree) parserChecks++;
      continue;
    }
    const relProbDelta = Math.abs(js.prob - py.prob) / Math.max(1e-12, Math.abs(py.prob));
    const bracket = (tree: ParseTree): string =>
      `(${tree.label} ${tree.children.map((child) => (typeof child === "string" ? child : bracket(child))).join(" ")})`;
    const sameTree = bracket(js.tree).replace(/\s+/g, " ").trim() === py.tree.replace(/\s+/g, " ").trim();
    if (!sameTree || relProbDelta > 1e-9)
      console.error(JSON.stringify({ tokens, js: bracket(js.tree), jsProb: js.prob, py, relProbDelta }));
    if (sameTree && relProbDelta <= 1e-9) {
      parserChecks += 1;
    }
  }

  const train = selectBalanced(clfFixture.train, 120) as NaiveBayesExample[];
  const test = selectBalanced(clfFixture.test, 40) as NaiveBayesExample[];
  const classifierPayloadPath = resolve(artifactsDir, "parity_imported_classifier_payload.json");
  const maxentPayloadPath = resolve(artifactsDir, "parity_imported_maxent_payload.json");

  const nb = trainNaiveBayesTextClassifier(train, { smoothing: 1.0 });
  writeFileSync(
    classifierPayloadPath,
    `${JSON.stringify({ train, test, rounds: 1, smoothing: 1.0 }, null, 2)}\n`,
    "utf8",
  );
  const pyNb = runJson(
    ["python3", "bench/python_classifier_baseline.py", "--payload-file", classifierPayloadPath],
    root,
  ) as { predictions: string[]; accuracy: number };
  const nbEval = nb.evaluate(test);
  const nbAccuracyDelta = Math.abs(nbEval.accuracy - pyNb.accuracy);
  const nbPred = test.map((row) => nb.classify(row.text));
  const nbAgreement =
    nbPred.length === pyNb.predictions.length
      ? nbPred.filter((label, i) => label === pyNb.predictions[i]).length / nbPred.length
      : 0;

  const maxentTrain = train as MaxEntExample[];
  const maxentTest = test as MaxEntExample[];
  const maxent = trainMaxEntTextClassifier(maxentTrain, {
    epochs: 10,
    learningRate: 0.15,
    l2: 1e-4,
    maxFeatures: 10000,
  });
  const maxentPred = maxentTest.map((row) => maxent.classify(row.text));
  writeFileSync(
    maxentPayloadPath,
    `${JSON.stringify({ train: maxentTrain, test: maxentTest, max_iter: 10 }, null, 2)}\n`,
    "utf8",
  );
  const pyMaxent = runJson(
    ["python3", "bench/python_maxent_baseline.py", "--payload-file", maxentPayloadPath],
    root,
  ) as { predictions: string[]; accuracy: number };
  const maxentEval = maxent.evaluate(maxentTest);
  const maxentAccuracyDelta = Math.abs(maxentEval.accuracy - pyMaxent.accuracy);
  const agreement =
    maxentPred.length === pyMaxent.predictions.length
      ? maxentPred.filter((label, idx) => label === pyMaxent.predictions[idx]!).length / maxentPred.length
      : 0;
  const parity =
    parserCompared === parserCases.length &&
    parserChecks === parserCompared &&
    nbAgreement === 1 &&
    agreement === 1;

  console.log(
    JSON.stringify(
      {
        parity,
        probability_relative_tolerance: 1e-9,
        nb_agreement: nbAgreement,
        parser_checks: parserChecks,
        parser_total: parserCases.length,
        parser_compared: parserCompared,
        nb_accuracy: nbEval.accuracy,
        nb_py_accuracy: pyNb.accuracy,
        nb_accuracy_delta: nbAccuracyDelta,
        maxent_accuracy: maxentEval.accuracy,
        maxent_py_accuracy: pyMaxent.accuracy,
        maxent_accuracy_delta: maxentAccuracyDelta,
        maxent_agreement: agreement,
      },
      null,
      2,
    ),
  );
  if (!parity) process.exitCode = 1;
}

main();
