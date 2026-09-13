import fixture from "../test/fixtures/nltk-model-parity.json";
import { SentimentIntensityAnalyzer } from "../src/sentiment";
const analyzer = new SentimentIntensityAnalyzer();
// Versioned cases cover every lexicon entry, rules, punctuation, and duplicate words.
const cases = fixture.sentiment;
const failures = cases.filter(
  (row) => JSON.stringify(row.scores) !== JSON.stringify(analyzer.polarityScores(row.text)),
);
console.log(
  JSON.stringify(
    {
      parity: failures.length === 0,
      oracle: `NLTK ${fixture.nltk}`,
      case_count: cases.length,
      fields: ["neg", "neu", "pos", "compound"],
      failed: failures.length,
      failures: failures.slice(0, 10),
    },
    null,
    2,
  ),
);
if (failures.length) process.exitCode = 1;
