import { expect, test } from "bun:test";
import { resolve } from "node:path";
import {
  defaultPunktModel,
  parsePunktModel,
  PunktSentenceTokenizerSubset,
  PunktTrainerSubset,
  sentenceTokenizePunkt,
  serializePunktModel,
  trainPunktModel,
} from "../src/punkt";

type PythonPunktResult = {
  sentences: string[];
};

function runPythonPunkt(trainText: string, text: string): PythonPunktResult {
  const proc = Bun.spawnSync(
    ["python", "bench/python_punkt_baseline.py", "--train-text", trainText, "--text", text],
    {
      cwd: resolve(import.meta.dir, ".."),
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  if (proc.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(proc.stderr));
  }
  return JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as PythonPunktResult;
}

test("punkt model trains, serializes, and tokenizes", () => {
  const trainText = "Dr. Smith went home. Dr. Jones stayed. This is a test.";
  const model = trainPunktModel(trainText);
  const json = serializePunktModel(model);
  const roundTrip = parsePunktModel(json);
  expect(roundTrip.abbreviations.length).toBeGreaterThan(0);
  expect(Object.keys(roundTrip.abbreviationScores ?? {}).length).toBeGreaterThan(0);
  expect(Object.keys(roundTrip.orthographicContext ?? {}).length).toBeGreaterThan(0);

  const out = sentenceTokenizePunkt("Dr. Smith stayed home. He slept.", roundTrip);
  expect(out).toEqual(["Dr. Smith stayed home.", "He slept."]);
});

test("punkt model compares against python trainer on parity sample", () => {
  const trainText = [
    "Dr. Adams wrote a paper. Dr. Brown reviewed it.",
    "The U.S. team won. The match ended yesterday.",
    "Mr. Lee met Ms. Kim in Jan. They discussed results.",
  ].join(" ");

  const text = "Dr. Adams arrived yesterday. He presented the paper. Mr. Lee agreed.";
  const model = trainPunktModel(trainText);
  const jsSentences = sentenceTokenizePunkt(text, model);
  const pySentences = runPythonPunkt(trainText, text).sentences;

  // Compare a deterministic parity sample used during training.
  expect(jsSentences).toEqual(pySentences);
});

test("default punkt model supports abbreviation-heavy text", () => {
  const model = defaultPunktModel();
  const out = sentenceTokenizePunkt("Dr. Smith lives in the U.S. He works at 9 a.m.", model);
  expect(out).toEqual(["Dr. Smith lives in the U.S.", "He works at 9 a.m."]);
});

test("punkt trainer/tokenizer subset wrappers mirror nltk-style workflow", () => {
  const trainer = new PunktTrainerSubset();
  trainer.train("Dr. Adams wrote a paper. Dr. Brown reviewed it.");
  trainer.train("Mr. Lee met Ms. Kim in Jan. They discussed results.");
  const tokenizer = new PunktSentenceTokenizerSubset(trainer.getParams());
  const out = tokenizer.tokenize("Dr. Adams arrived yesterday. He presented the paper.");
  expect(out).toEqual(["Dr. Adams arrived yesterday.", "He presented the paper."]);
});

test("punkt tokenizer wrapper can train directly", () => {
  const tokenizer = new PunktSentenceTokenizerSubset();
  tokenizer.train("Dr. Adams stayed. Dr. Brown left.");
  const out = tokenizer.tokenize("Dr. Adams returned. He smiled.");
  expect(out).toEqual(["Dr. Adams returned.", "He smiled."]);
});
