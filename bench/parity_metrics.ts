import { resolve } from "node:path";
import { corpusBleu, editDistance, sentenceBleu } from "../index";

function almostEqual(left: number, right: number, tol: number): boolean {
  return Math.abs(left - right) <= tol;
}

function main() {
  const refs = [
    ["the", "cat", "is", "on", "the", "mat"],
    ["there", "is", "a", "cat", "on", "the", "mat"],
  ];
  const hyp = ["the", "cat", "is", "on", "the", "mat"];
  const corpusRefs = [refs];
  const corpusHyps = [hyp];
  const edits = [
    { left: "kitten", right: "sitting", substitution_cost: 1, transpositions: false },
    { left: "ab", right: "ba", substitution_cost: 1, transpositions: true },
  ];

  const payload = JSON.stringify({
    refs,
    hyp,
    corpus_refs: corpusRefs,
    corpus_hyps: corpusHyps,
    edits,
  });
  const proc = Bun.spawnSync(["python", "bench/python_metrics_baseline.py", "--payload", payload], {
    cwd: resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    throw new Error(`python metrics baseline failed: ${new TextDecoder().decode(proc.stderr)}`);
  }
  const py = JSON.parse(new TextDecoder().decode(proc.stdout).trim()) as {
    edit: number[];
    sentence_bleu: number;
    corpus_bleu: number;
  };

  const js = {
    edit: [
      editDistance("kitten", "sitting"),
      editDistance("ab", "ba", { transpositions: true }),
    ],
    sentence_bleu: sentenceBleu(refs, hyp),
    corpus_bleu: corpusBleu(corpusRefs, corpusHyps),
  };

  const parity =
    JSON.stringify(js.edit) === JSON.stringify(py.edit) &&
    almostEqual(js.sentence_bleu, py.sentence_bleu, 0.05) &&
    almostEqual(js.corpus_bleu, py.corpus_bleu, 0.05);

  if (!parity) {
    throw new Error(
      `metrics parity failed: js=${JSON.stringify(js)} py=${JSON.stringify(py)}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        parity,
        sentence_bleu: js.sentence_bleu,
        corpus_bleu: js.corpus_bleu,
        edit_cases: js.edit.length,
      },
      null,
      2,
    ),
  );
}

main();

