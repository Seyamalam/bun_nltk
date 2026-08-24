/**
 * Machine-translation evaluation: BLEU / GLEU / METEOR / chrF / RIBES scores
 * for sentence pairs drawn from the NLTK doctests.
 *
 * Run: bun run paper/usecases/translate_eval.ts
 */
import { sentenceBleu } from "../../src/metrics";
import { sentenceGleu } from "../../src/translate_gleu";
import { meteorScore } from "../../src/translate_meteor";
import { sentenceChrF } from "../../src/translation_metrics_extra";
import { sentenceRibes } from "../../src/translate_ribes";

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9']+|[^\sa-z0-9']/gi) ?? []).map((t) => t.toLowerCase());
}

type Pair = { name: string; references: string[]; hypothesis: string };

// Classic NLTK doctest sentences.
const PAIRS: Pair[] = [
  {
    name: "BLEU doctest pair",
    references: [
      "It is a guide to action that ensures that the military will forever heed Party instructions",
      "It is the guiding principle which guarantees the military forces always being under the command of the Party",
      "It is the practical guide for the army always to heed the directions of the party",
    ],
    hypothesis: "It is a guide to action which ensures that the military always obeys the commands of the party",
  },
  {
    name: "METEOR doctest pair",
    references: [
      "It is a guide to action that ensures that the military will forever heed Party instructions",
    ],
    hypothesis: "It is a guide to action which ensures that the military always obeys the commands of the party",
  },
  {
    name: "RIBES doctest-style pair",
    references: [
      "he was elected vice president of the business association at that time",
    ],
    hypothesis: "he was elected as vice president of the business association at that time",
  },
];

console.log("== MT evaluation metrics: BLEU / GLEU / METEOR / chrF / RIBES ==\n");

const t0 = performance.now();

const results = PAIRS.map(({ name, references, hypothesis }) => {
  const refs = references.map(tokenize);
  const hyp = tokenize(hypothesis);

  const bleu = sentenceBleu(refs, hyp);
  const gleu = sentenceGleu(refs, hyp);
  const meteor = meteorScore(refs, hyp);
  const chrf = sentenceChrF(references, hypothesis); // chrF works on character n-grams
  const ribes = sentenceRibes(refs, hyp);

  return { name, references, hypothesis, bleu, gleu, meteor, chrf, ribes };
});

const tMetrics = performance.now();

for (const row of results) {
  console.log(`${row.name}:`);
  console.log(`  REF: ${row.references.join(" | ")}`);
  console.log(`  HYP: ${row.hypothesis}`);
  console.log("");
}

console.log("Scores (1.0 = perfect match with a reference):");
console.table(
  results.map((row) => ({
    metric_pair: row.name.replace(/ doctest(-style)? pair/i, ""),
    BLEU: row.bleu.toFixed(4),
    GLEU: row.gleu.toFixed(4),
    METEOR: row.meteor.toFixed(4),
    chrF: row.chrf.toFixed(4),
    RIBES: row.ribes.toFixed(4),
  })),
);

const tEnd = performance.now();
console.log("\nTiming:");
console.log(`  all metrics for ${PAIRS.length} pairs: ${(tMetrics - t0).toFixed(2)} ms`);
console.log(`  total wall time (incl. printing prep): ${(tEnd - t0).toFixed(2)} ms`);
